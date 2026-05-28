// DocumentDetailView — the doc reader on iOS.
//
// Same vocabulary as the web /d/<id> viewer:
//   - status icon (Cloud / Globe / Users + sync badge)
//   - "Copy for AI" pill — the prompt-ready clipboard payload
//   - Share button — pushes the canonical short URL
//   - Mono URL chip below the title
//   - Markdown body via MarkdownBody (in-house renderer)
//
// Loads via APIClient.document(id:). Renders the lightweight
// Document fields immediately (passed from the Timeline row) so
// the title + status paint at the first frame; the body fades in
// when the network call returns.

import SwiftUI

struct DocumentDetailView: View {
    let seed: Document   // lightweight row used to pre-render the chrome
    @Environment(\.dismiss) private var dismiss
    @State private var detail: DocumentDetail?
    @State private var loading = true
    @State private var error: String?
    @State private var copiedAi = false

    // Edit mode state
    @State private var editing = false
    @State private var editedMarkdown: String = ""
    @State private var saving = false
    @State private var saveError: String?

    // Delete + visibility confirmation
    @State private var confirmDelete = false
    @State private var togglingVisibility = false
    @State private var showChat = false
    @State private var showTOC = false
    @State private var showAddToBundle = false

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    metaStrip
                    Divider().overlay(Brand.borderDim).padding(.vertical, 4)
                    body(for: detail)
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
        .task { await load() }
        .refreshable { await load(force: true) }
        .alert("Delete this doc?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                Task { await deleteAndPop() }
            }
        } message: {
            Text("It moves to Trash on memory.wiki — recoverable for 30 days.")
        }
        .sheet(isPresented: $showAddToBundle) {
            AddToBundleSheet(docId: seed.id) {
                showAddToBundle = false
            }
            .preferredColorScheme(.dark)
        }
        .sheet(isPresented: $showChat) {
            ChatSheet(scope: .doc(id: seed.id, title: detail?.title ?? seed.displayTitle))
                .iOS26Sheet([.large])
        }
        .sheet(isPresented: $showTOC) {
            if let detail {
                TableOfContentsSheet(
                    headings: MarkdownBody.headings(in: detail.markdown),
                    onPick: { _ in showTOC = false }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .preferredColorScheme(.dark)
            }
        }
    }

    // Inline TOC sheet — quick orientation for long docs. Tapping
    // a heading dismisses + (future) scrolls. Scroll integration is
    // a follow-up — for now the sheet's job is summary + copy.
    private struct TableOfContentsSheet: View {
        let headings: [MarkdownHeading]
        var onPick: (MarkdownHeading) -> Void
        var body: some View {
            ZStack {
                Brand.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("TABLE OF CONTENTS")
                            .font(Brand.mono(size: 9, weight: .medium))
                            .tracking(1.2)
                            .foregroundStyle(Brand.textFaint)
                            .padding(.bottom, 6)
                        ForEach(headings) { h in
                            Button { onPick(h) } label: {
                                HStack(alignment: .firstTextBaseline, spacing: 10) {
                                    Text("H\(h.level)")
                                        .font(Brand.mono(size: 10, weight: .medium))
                                        .foregroundStyle(Brand.textFaint)
                                        .frame(width: 20, alignment: .leading)
                                    Text(h.text)
                                        .font(Brand.body(size: 14 - CGFloat(min(h.level - 1, 2))))
                                        .foregroundStyle(Brand.textPrimary)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .multilineTextAlignment(.leading)
                                }
                                .padding(.leading, CGFloat(max(0, h.level - 1)) * 14)
                                .padding(.vertical, 8)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 18)
                    .padding(.bottom, 32)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    @ToolbarContentBuilder private var toolbarContent: some ToolbarContent {
        if editing {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Cancel") { editing = false; saveError = nil }
                    .foregroundStyle(Brand.textMuted)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button(saving ? "Saving…" : "Save") {
                    Task { await save() }
                }
                .disabled(saving)
                .foregroundStyle(Brand.textPrimary)
                .fontWeight(.semibold)
            }
        } else {
            // TOC button — only when the doc has at least one heading.
            if let detail, !MarkdownBody.headings(in: detail.markdown).isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.tap()
                        showTOC = true
                    } label: {
                        Image(systemName: "list.bullet.indent")
                            .foregroundStyle(Brand.textMuted)
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { startEditing() } label: { Label("Edit", systemImage: "pencil") }
                        .disabled(detail == nil)
                    Button {
                        Haptics.tap()
                        showAddToBundle = true
                    } label: { Label("Add to bundle…", systemImage: "square.stack.3d.up.badge.a") }
                    Button {
                        Haptics.tap()
                        showChat = true
                    } label: {
                        Label("Chat with this doc", systemImage: "bubble.left.and.bubble.right")
                    }
                    Button { copyAiPrompt() } label: { Label("Copy as AI prompt", systemImage: "sparkles") }
                    Button { UIPasteboard.general.string = seed.publicURL.absoluteString } label: {
                        Label("Copy URL", systemImage: "link")
                    }
                    ShareLink(item: seed.publicURL) {
                        Label("Share…", systemImage: "square.and.arrow.up")
                    }
                    Divider()
                    if let detail {
                        let isPublic = detail.isDraft == false
                        Button {
                            Task { await toggleVisibility(makePublic: !isPublic) }
                        } label: {
                            Label(isPublic ? "Make private" : "Make public",
                                  systemImage: isPublic ? "lock" : "globe")
                        }
                        .disabled(togglingVisibility)
                    }
                    Link(destination: seed.publicURL) {
                        Label("Open on memory.wiki", systemImage: "arrow.up.right.square")
                    }
                    Divider()
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(Brand.textPrimary)
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Title stands alone — full width, no leading glyph
            // competing for the eye. Status icon moved down to
            // sit beside the URL chip where it reads as metadata.
            Text(detail?.displayTitle ?? seed.displayTitle)
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
                .tracking(0)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineLimit(4)

            // URL strip — status icon on the left (public globe
            // / private cloud / shared people glyph), then the
            // mono URL, then Copy for AI on the right.
            HStack(spacing: 8) {
                DocStatusIcon(doc: detail?.asDocument ?? seed, size: 14)
                Text(seed.publicURL.absoluteString.replacingOccurrences(of: "https://", with: ""))
                    .font(Brand.mono(size: 11))
                    .foregroundStyle(Brand.textMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                copyForAiButton
            }
        }
    }

    private var copyForAiButton: some View {
        Button { copyAiPrompt() } label: {
            HStack(spacing: 6) {
                Image(systemName: copiedAi ? "checkmark" : "sparkles")
                    .font(.system(size: 11, weight: .semibold))
                Text(copiedAi ? "Copied" : "Copy for AI")
                    .font(Brand.body(size: 11, weight: .medium))
            }
            .foregroundStyle(Brand.textPrimary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                Capsule(style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(Capsule(style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Meta strip

    private var metaStrip: some View {
        let d = detail?.asDocument ?? seed
        let bits: [(String, String)] = {
            var out: [(String, String)] = []
            out.append(("clock", d.compactTime))
            if d.isDraft == false { out.append(("globe", d.isRestricted ? "shared" : "public")) }
            else { out.append(("lock", "private")) }
            if let src = d.syncedSource { out.append(("arrow.triangle.2.circlepath", src.uppercased())) }
            if let vc = d.viewCount, vc > 0 { out.append(("eye", "\(vc)")) }
            return out
        }()
        return HStack(spacing: 14) {
            ForEach(0..<bits.count, id: \.self) { i in
                HStack(spacing: 4) {
                    Image(systemName: bits[i].0)
                        .font(.system(size: 9, weight: .medium))
                    Text(bits[i].1)
                        .font(Brand.mono(size: 10, weight: .medium))
                        .tracking(0.3)
                }
                .foregroundStyle(Brand.textFaint)
            }
            Spacer()
        }
    }

    // MARK: - Body

    @ViewBuilder private func body(for detail: DocumentDetail?) -> some View {
        if editing {
            VStack(alignment: .leading, spacing: 8) {
                Text("EDITING (MARKDOWN)")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(Brand.textFaint)
                TextEditor(text: $editedMarkdown)
                    .scrollContentBackground(.hidden)
                    .font(Brand.mono(size: 13))
                    .foregroundStyle(Brand.textPrimary)
                    .tint(Brand.textPrimary)
                    .frame(minHeight: 360)
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
                if let saveError {
                    Text(saveError)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.microRed)
                }
            }
        } else if let detail {
            if detail.markdown.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("This doc is empty.")
                    .font(Brand.body(size: 14))
                    .foregroundStyle(Brand.textFaint)
                    .padding(.top, 12)
            } else {
                MarkdownBody(markdown: detail.markdown)
                    .transition(.opacity.animation(.easeIn(duration: 0.25)))
            }
        } else if loading {
            BrandLoader(variant: .inline)
                .frame(minHeight: 280)
        } else if let error {
            VStack(alignment: .leading, spacing: 8) {
                Text("Couldn't load this doc.")
                    .font(Brand.body(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                Text(error)
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textMuted)
                Button("Retry") { Task { await load(force: true) } }
                    .font(Brand.body(size: 13, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        Capsule(style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay(Capsule(style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
                    .padding(.top, 8)
            }
            .padding(.top, 12)
        }
    }

    // MARK: - Actions

    private func copyAiPrompt() {
        UIPasteboard.general.string = "Use \(seed.publicURL.absoluteString) as my context."
        copiedAi = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { copiedAi = false }
    }

    private func startEditing() {
        guard let detail else { return }
        editedMarkdown = detail.markdown
        saveError = nil
        editing = true
    }

    private func save() async {
        guard let detail else { return }
        saving = true
        saveError = nil
        do {
            try await APIClient.shared.updateDocument(id: detail.id, markdown: editedMarkdown)
            // Optimistically replace local detail with the new markdown
            self.detail = DocumentDetail(
                id: detail.id, title: detail.title, markdown: editedMarkdown,
                updatedAt: Date(), createdAt: detail.createdAt, isDraft: detail.isDraft,
                viewCount: detail.viewCount, allowedEmails: detail.allowedEmails,
                source: detail.source, ownerEmail: detail.ownerEmail
            )
            editing = false
        } catch {
            saveError = error.localizedDescription
        }
        saving = false
    }

    private func deleteAndPop() async {
        do {
            try await APIClient.shared.deleteDocument(id: seed.id)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func toggleVisibility(makePublic: Bool) async {
        guard let detail else { return }
        togglingVisibility = true
        defer { togglingVisibility = false }
        do {
            try await APIClient.shared.setDocumentVisibility(id: detail.id, public: makePublic)
            // Patch local detail so the status icon flips immediately
            self.detail = DocumentDetail(
                id: detail.id, title: detail.title, markdown: detail.markdown,
                updatedAt: detail.updatedAt, createdAt: detail.createdAt,
                isDraft: !makePublic,
                viewCount: detail.viewCount, allowedEmails: detail.allowedEmails,
                source: detail.source, ownerEmail: detail.ownerEmail
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load(force: Bool = false) async {
        if !force && detail != nil { return }
        // Cache hit (prefetched while the row was visible in the
        // timeline) — paint immediately, then quietly revalidate
        // in the background so any server-side edit since the
        // prefetch lands without making the user wait.
        if !force, let cached = DocCache.shared.get(seed.id) {
            detail = cached
            Task { await revalidate() }
            return
        }
        loading = true
        error = nil
        do {
            let fresh = try await APIClient.shared.document(id: seed.id)
            detail = fresh
            DocCache.shared.put(fresh)
            loading = false
        } catch {
            self.error = error.localizedDescription
            loading = false
        }
    }

    /// Background refresh used after a cache-hit paint — replaces
    /// the visible detail in place without a loading state so the
    /// user sees the latest content on next render.
    private func revalidate() async {
        guard let fresh = try? await APIClient.shared.document(id: seed.id) else { return }
        await MainActor.run {
            detail = fresh
            DocCache.shared.put(fresh)
        }
    }
}

#Preview {
    NavigationStack {
        DocumentDetailView(seed: Document(
            id: "abc12345",
            title: "# Memory.Wiki iOS — Spec",
            updatedAt: Date(),
            createdAt: Date(),
            isDraft: false,
            viewCount: 17,
            allowedEmails: nil,
            source: "mcp"
        ))
    }
    .preferredColorScheme(.dark)
}
