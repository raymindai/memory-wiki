// BundleDetailView — bundle reader. Header carries the bundle
// title + description + visibility. "Deploy this bundle to any
// AI" card mirrors the web /b/<id> hero. Member docs list
// underneath uses the same DocStatusIcon row vocabulary as the
// timeline; tapping a member pushes the doc detail in this same
// NavigationStack.

import SwiftUI

struct BundleDetailView: View {
    let seed: AppBundle
    @State private var detail: BundleDetail?
    @State private var loading = true
    @State private var error: String?
    @State private var copiedAi = false
    @State private var showChat = false

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    if let desc = detail?.description ?? seed.description, !desc.isEmpty {
                        Text(desc)
                            .font(Brand.body(size: 14))
                            .foregroundStyle(Brand.textMuted)
                            .lineSpacing(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    deployCard
                    Divider().overlay(Brand.borderDim).padding(.vertical, 2)
                    membersSection
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
                    Button {
                        Haptics.tap()
                        showChat = true
                    } label: {
                        Label("Chat with this bundle", systemImage: "bubble.left.and.bubble.right")
                    }
                    Button { copyAiPrompt() } label: { Label("Copy as AI prompt", systemImage: "sparkles") }
                    Button { UIPasteboard.general.string = seed.publicURL.absoluteString } label: {
                        Label("Copy URL", systemImage: "link")
                    }
                    ShareLink(item: seed.publicURL) {
                        Label("Share…", systemImage: "square.and.arrow.up")
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
        // The doc-push destination now lives on BundlesView's
        // NavigationStack (as a BundlesRoute.docDetail case) —
        // the typed path requires the destination be registered
        // where the path lives, not nested deeper.
        .task { await load() }
        .refreshable { await load(force: true) }
        .sheet(isPresented: $showChat) {
            ChatSheet(scope: .bundle(id: seed.id, title: seed.displayTitle))
                .iOS26Sheet([.large])
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "square.stack.3d.up.fill")
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(Brand.textPrimary)
                .padding(.top, 4)
            Text(detail?.displayTitle ?? seed.displayTitle)
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
                .tracking(0)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Mirrors the web /b/<id> "Deploy this bundle to any AI"
    /// card. Mono URL pill + Copy-for-AI on the same row.
    private var deployCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Brand.textPrimary)
                Text("DEPLOY THIS BUNDLE TO ANY AI")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(Brand.textFaint)
            }
            Text("Paste the URL into Claude, ChatGPT, or Cursor. The bundle serves a structured digest that links to every member doc.")
                .font(Brand.body(size: 13))
                .foregroundStyle(Brand.textMuted)
                .lineSpacing(3)
            HStack(spacing: 0) {
                Text(seed.publicURL.absoluteString.replacingOccurrences(of: "https://", with: ""))
                    .font(Brand.mono(size: 12))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                Spacer()
                Divider().frame(width: 1).overlay(Brand.borderDim)
                Button { copyAiPrompt() } label: {
                    HStack(spacing: 6) {
                        Image(systemName: copiedAi ? "checkmark" : "sparkles")
                            .font(.system(size: 11, weight: .semibold))
                        Text(copiedAi ? "Copied" : "Copy for AI")
                            .font(Brand.body(size: 12, weight: .medium))
                    }
                    .foregroundStyle(Brand.textPrimary)
                    .padding(.horizontal, 12)
                }
                .buttonStyle(.plain)
            }
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Brand.surface.opacity(0.5))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }

    private var membersSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("MEMBERS")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1.2)
                    .foregroundStyle(Brand.textFaint)
                Spacer()
                if let n = detail?.documents.count {
                    Text("\(n)")
                        .font(Brand.mono(size: 10))
                        .foregroundStyle(Brand.textFaint)
                }
            }
            if loading && detail == nil {
                BrandLoader(variant: .inline).frame(height: 180)
            } else if let detail, !detail.documents.isEmpty {
                VStack(spacing: 6) {
                    ForEach(detail.documents) { doc in
                        // Push as BundlesRoute.docDetail so the
                        // typed NavigationStack(path: bundlesPath)
                        // actually accepts the value (TimelineRoute
                        // pushes were silently dropped).
                        NavigationLink(value: BundlesRoute.docDetail(doc)) {
                            MemberRow(doc: doc)
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else if let err = error {
                Text(err)
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.microRed)
            } else {
                Text("This bundle is empty.")
                    .font(Brand.body(size: 13))
                    .foregroundStyle(Brand.textFaint)
            }
        }
    }

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
            detail = try await APIClient.shared.bundle(id: seed.id)
            loading = false
        } catch {
            self.error = error.localizedDescription
            loading = false
        }
    }
}

private struct MemberRow: View {
    let doc: Document
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            DocStatusIcon(doc: doc, size: 16).frame(width: 22, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(doc.displayTitle)
                    .font(Brand.body(size: 14, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                    .lineLimit(1)
                Text(doc.compactTime)
                    .font(Brand.mono(size: 9))
                    .foregroundStyle(Brand.textFaint)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.textFaint)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

#Preview {
    NavigationStack {
        BundleDetailView(seed: AppBundle(
            id: "abc123",
            title: "v8 launch bundle",
            description: "Everything that shipped the week we flipped on /@<slug>",
            documentCount: 6,
            updatedAt: Date(),
            createdAt: Date().addingTimeInterval(-86400 * 3),
            isDraft: false,
            visibility: "public",
            allowedEmailsCount: 0
        ))
    }
    .preferredColorScheme(.dark)
}
