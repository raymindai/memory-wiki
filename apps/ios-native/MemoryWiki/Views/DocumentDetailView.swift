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
    @State private var detail: DocumentDetail?
    @State private var loading = true
    @State private var error: String?
    @State private var copiedAi = false

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
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { copyAiPrompt() } label: {
                        Label("Copy as AI prompt", systemImage: "sparkles")
                    }
                    Button { UIPasteboard.general.string = seed.publicURL.absoluteString } label: {
                        Label("Copy URL", systemImage: "link")
                    }
                    Divider()
                    Link(destination: seed.publicURL) {
                        Label("Open on memory.wiki", systemImage: "arrow.up.right.square")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 15, weight: .regular))
                        .foregroundStyle(Brand.textPrimary)
                }
            }
        }
        .task { await load() }
        .refreshable { await load(force: true) }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                DocStatusIcon(doc: detail?.asDocument ?? seed, size: 22)
                Text(detail?.displayTitle ?? seed.displayTitle)
                    .font(Brand.display(size: 26))
                    .foregroundStyle(Brand.textPrimary)
                    .tracking(0)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .lineLimit(4)
            }
            // Mono URL chip below the title — quick visual confirm
            // that THIS is the canonical URL that paste-anywhere
            // hands to AI clients.
            HStack(spacing: 8) {
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
        if let detail {
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

    private func load(force: Bool = false) async {
        if !force && detail != nil { return }
        loading = true
        error = nil
        do {
            detail = try await APIClient.shared.document(id: seed.id)
            loading = false
        } catch {
            self.error = error.localizedDescription
            loading = false
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
