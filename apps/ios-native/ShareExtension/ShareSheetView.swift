// ShareSheetView — SwiftUI surface inside the Share Extension.
// Brand chrome (dark zinc, JetBrains Mono captions, Noto Sans
// body) so the extension reads as the same product the main
// app is, even though it runs in a different process.
//
// Lays out:
//   - header  (memory.wiki wordmark, ink only, + close)
//   - source preview card  (URL, og:image thumbnail, site name)
//   - title field (pre-filled from page title)
//   - extra memory field   (extra free-form text the user wants
//                           to add to the saved doc)
//   - selection / body preview (read-only)
//   - actions: Save / Save & Open

import SwiftUI

struct ShareSheetView: View {
    let extensionContext: NSExtensionContext?
    let initial: SharePayload

    @Environment(\.openURL) private var openURL
    @State private var title: String
    @State private var memory: String
    @State private var working = false
    @State private var savedURL: URL?
    @State private var error: String?

    init(extensionContext: NSExtensionContext?, initial: SharePayload) {
        self.extensionContext = extensionContext
        self.initial = initial
        _title = State(initialValue: initial.title ?? "")
        _memory = State(initialValue: "")
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            ShareTheme.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    if savedURL == nil {
                        if let url = initial.url {
                            sourceCard(url: url)
                        }
                        titleField
                        memoryField
                        if let body = initial.bodyText, !body.isEmpty {
                            preview(label: "PAGE CONTENT", text: body)
                        } else if let sel = initial.selection, !sel.isEmpty {
                            preview(label: "SELECTION", text: sel)
                        }
                    } else if let u = savedURL {
                        successCard(url: u)
                    }
                    if let error {
                        Text(error)
                            .font(.system(size: 12))
                            .foregroundStyle(ShareTheme.microRed)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 110)
            }

            // Sticky bottom action bar — keeps Save/Save & Open
            // visible while the user scrolls preview content.
            VStack { Spacer(); actionBar }
                .ignoresSafeArea(.keyboard)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 6) {
            // Blob mark inline next to the wordmark — same
            // SwiftUI Shape the widget uses. Extensions can't
            // import the main app's AnimatedBlob, so we draw
            // the silhouette in code.
            ShareBlobMark()
                .frame(width: 18, height: 18)
            Text("memory.wiki")
                .font(.system(size: 18, weight: .semibold, design: .rounded))
                .foregroundStyle(ShareTheme.textPrimary)
            Text("SHARE")
                .font(.system(size: 9, weight: .medium, design: .monospaced))
                .tracking(1.2)
                .foregroundStyle(ShareTheme.textFaint)
            Spacer()
            Button { cancel() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ShareTheme.textMuted)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(ShareTheme.surface).overlay(Circle().strokeBorder(ShareTheme.borderDim, lineWidth: 1)))
            }
            .buttonStyle(.plain)
        }
        .padding(.bottom, 4)
    }

    // MARK: - Source preview

    private func sourceCard(url: URL) -> some View {
        HStack(alignment: .top, spacing: 10) {
            if let img = initial.imageURL {
                AsyncImage(url: img) { phase in
                    switch phase {
                    case .success(let i):
                        i.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Rectangle().fill(ShareTheme.surface)
                    }
                }
                .frame(width: 60, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(ShareTheme.surface)
                    Image(systemName: "link")
                        .font(.system(size: 16))
                        .foregroundStyle(ShareTheme.textFaint)
                }
                .frame(width: 60, height: 60)
            }
            VStack(alignment: .leading, spacing: 3) {
                if let site = initial.siteName, !site.isEmpty {
                    Text(site.uppercased())
                        .font(.system(size: 9, weight: .medium, design: .monospaced))
                        .tracking(1)
                        .foregroundStyle(ShareTheme.textFaint)
                }
                Text(initial.title ?? url.host ?? "Link")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(ShareTheme.textPrimary)
                    .lineLimit(2)
                Text(url.absoluteString)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(ShareTheme.textMuted)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(ShareTheme.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(ShareTheme.borderDim, lineWidth: 1))
        )
    }

    // MARK: - Fields

    private var titleField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("TITLE", systemImage: nil)
            TextField("Untitled", text: $title)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(ShareTheme.textPrimary)
                .tint(ShareTheme.textPrimary)
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(ShareTheme.surface)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(ShareTheme.borderDim, lineWidth: 1))
                )
        }
    }

    private var memoryField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("YOUR MEMORY (OPTIONAL)", systemImage: nil)
            TextEditor(text: $memory)
                .scrollContentBackground(.hidden)
                .font(.system(size: 14))
                .foregroundStyle(ShareTheme.textPrimary)
                .tint(ShareTheme.textPrimary)
                .frame(minHeight: 70, maxHeight: 100)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(ShareTheme.surface)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(ShareTheme.borderDim, lineWidth: 1))
                )
        }
    }

    private func preview(label: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(label, systemImage: nil)
            Text(text.trimmingCharacters(in: .whitespacesAndNewlines))
                .font(.system(size: 12))
                .foregroundStyle(ShareTheme.textMuted)
                .lineSpacing(3)
                .lineLimit(8)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(ShareTheme.canvas)
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(ShareTheme.borderDim, lineWidth: 1))
                )
        }
    }

    // MARK: - Success

    private func successCard(url: URL) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(ShareTheme.microLime)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Saved to Memory.Wiki")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ShareTheme.textPrimary)
                    Text(url.absoluteString.replacingOccurrences(of: "https://", with: ""))
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(ShareTheme.textMuted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer()
            }
            HStack(spacing: 8) {
                Button { copy(url) } label: {
                    ChipButton(label: "Copy URL", icon: "doc.on.doc")
                }
                ShareLink(item: url) {
                    ChipButton(label: "Share", icon: "square.and.arrow.up")
                }
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(ShareTheme.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(ShareTheme.borderDim, lineWidth: 1))
        )
    }

    // MARK: - Action bar

    private var actionBar: some View {
        HStack(spacing: 10) {
            if savedURL == nil {
                Button {
                    Task { await save(openAfter: false) }
                } label: {
                    Text(working ? "Saving…" : "Save")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ShareTheme.textPrimary)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(ShareTheme.surface)
                                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(ShareTheme.borderDim, lineWidth: 1))
                        )
                }
                .buttonStyle(.plain)
                .disabled(!canSave)
                .opacity(canSave ? 1 : 0.55)

                Button {
                    Task { await save(openAfter: true) }
                } label: {
                    Text("Save & Open")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ShareTheme.background)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(ShareTheme.textPrimary))
                }
                .buttonStyle(.plain)
                .disabled(!canSave)
                .opacity(canSave ? 1 : 0.55)
            } else {
                Button { finish() } label: {
                    Text("Done")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ShareTheme.background)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(ShareTheme.textPrimary))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 18)
        .background(
            ShareTheme.background
                .overlay(alignment: .top) {
                    Rectangle().fill(ShareTheme.borderDim).frame(height: 0.5)
                }
        )
    }

    private var canSave: Bool {
        !working && savedURL == nil &&
            !(title.isEmpty && memory.isEmpty && initial.url == nil && initial.bodyText == nil && initial.selection == nil)
    }

    // MARK: - Actions

    private func save(openAfter: Bool) async {
        working = true
        error = nil
        let md = initial.toMarkdown(
            overrideTitle: title.isEmpty ? nil : title,
            extraMemory: memory.isEmpty ? nil : memory
        )
        do {
            let url = try await SharedAPI.createDocument(
                markdown: md,
                title: title.isEmpty ? nil : title,
                source: "ios-share"
            )
            savedURL = url
            if openAfter {
                openMainApp(url: url)
            }
        } catch {
            self.error = error.localizedDescription
        }
        working = false
    }

    private func copy(_ url: URL) {
        UIPasteboard.general.string = url.absoluteString
    }

    /// Bounce to the main app at memorywiki://doc/<id>. SwiftUI's
    /// openURL environment is the only path Apple sanctions for
    /// extensions — UIApplication.shared is unavailable here.
    /// For custom schemes (memorywiki://) iOS routes back into
    /// the main app's onOpenURL handler.
    private func openMainApp(url canonicalURL: URL) {
        let id = canonicalURL.lastPathComponent
        let deepLink = URL(string: "memorywiki://doc/\(id)")!
        openURL(deepLink) { _ in
            // Whether the system says it "accepted" or not, the
            // extension's job is done — close it so the user lands
            // back in Safari (or wherever they came from) and iOS
            // routes the deep link to the main app.
            finish()
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    private func cancel() {
        extensionContext?.cancelRequest(withError: NSError(domain: "wiki.memory.share", code: 0))
    }

    /// Section-label primitive — mono caption above each input.
    private func Label(_ text: String, systemImage: String?) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .medium, design: .monospaced))
            .tracking(1)
            .foregroundStyle(ShareTheme.textFaint)
    }
}

// MARK: - Brand tokens (mirrors the main app)

private enum ShareTheme {
    static let background  = Color(red: 0.035, green: 0.035, blue: 0.043)
    static let canvas      = Color(red: 0.027, green: 0.027, blue: 0.031)
    static let surface     = Color(red: 0.094, green: 0.094, blue: 0.106)
    static let borderDim   = Color(red: 0.180, green: 0.180, blue: 0.196).opacity(0.6)
    static let textPrimary = Color(red: 0.980, green: 0.980, blue: 0.980)
    static let textMuted   = Color(red: 0.631, green: 0.631, blue: 0.667)
    static let textFaint   = Color(red: 0.541, green: 0.541, blue: 0.569)
    static let microRed    = Color(red: 0.940, green: 0.270, blue: 0.270)
    static let microLime   = Color(red: 0.710, green: 1.000, blue: 0.100)
}

/// Brand blob silhouette drawn directly as a SwiftUI Shape.
/// Mirrors the Widget extension's BlobMark so all three iOS
/// surfaces (main app via WKWebView animation, widget, share
/// extension) carry the same mark.
private struct ShareBlobMark: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width
            let h = size.height
            var path = Path()
            path.move(to: CGPoint(x: w * 0.50, y: h * 0.08))
            path.addCurve(
                to: CGPoint(x: w * 0.92, y: h * 0.42),
                control1: CGPoint(x: w * 0.78, y: h * 0.08),
                control2: CGPoint(x: w * 0.95, y: h * 0.20)
            )
            path.addCurve(
                to: CGPoint(x: w * 0.78, y: h * 0.90),
                control1: CGPoint(x: w * 0.90, y: h * 0.65),
                control2: CGPoint(x: w * 0.94, y: h * 0.84)
            )
            path.addCurve(
                to: CGPoint(x: w * 0.25, y: h * 0.92),
                control1: CGPoint(x: w * 0.55, y: h * 0.98),
                control2: CGPoint(x: w * 0.40, y: h * 1.00)
            )
            path.addCurve(
                to: CGPoint(x: w * 0.06, y: h * 0.45),
                control1: CGPoint(x: w * 0.08, y: h * 0.82),
                control2: CGPoint(x: w * 0.04, y: h * 0.62)
            )
            path.addCurve(
                to: CGPoint(x: w * 0.50, y: h * 0.08),
                control1: CGPoint(x: w * 0.08, y: h * 0.18),
                control2: CGPoint(x: w * 0.28, y: h * 0.06)
            )
            path.closeSubpath()
            ctx.fill(path, with: .color(ShareTheme.textPrimary))
        }
    }
}

private struct ChipButton: View {
    let label: String
    let icon: String
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 11, weight: .medium))
            Text(label).font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(ShareTheme.textPrimary)
        .padding(.horizontal, 10).padding(.vertical, 7)
        .background(
            Capsule()
                .fill(ShareTheme.canvas)
                .overlay(Capsule().strokeBorder(ShareTheme.borderDim, lineWidth: 1))
        )
    }
}
