// HelpView — in-app reference for every iOS-only flow the user
// might not discover by accident: Share Sheet, Home-screen
// widget, Spotlight, OCR camera, deep links, markdown shortcuts.
// Reachable from Settings → Help & Shortcuts.
//
// Design: expandable sections (DisclosureGroup) so the surface
// is scannable; each section opens to a short "what / how / why"
// triple. JetBrains Mono captions, ink body text, lime never.

import SwiftUI

struct HelpView: View {
    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    intro
                    section("Capture", sectionItems: captureItems)
                    section("Share from any app", sectionItems: shareItems)
                    section("Home & Lock screen widget", sectionItems: widgetItems)
                    section("Spotlight search", sectionItems: spotlightItems)
                    section("Camera + screenshot OCR", sectionItems: ocrItems)
                    section("Deep links", sectionItems: deeplinkItems)
                    section("Markdown shortcuts", sectionItems: markdownItems)
                    section("Frequently asked", sectionItems: faqItems)
                    footer
                }
                .padding(.horizontal, 18)
                .padding(.top, 18)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("Help")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Brand.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Quick start")
                .font(Brand.mono(size: 9, weight: .medium))
                .tracking(1.2)
                .foregroundStyle(Brand.textFaint)
            Text("Capture anywhere → AI organises → paste one URL.")
                .font(Brand.display(size: 22))
                .foregroundStyle(Brand.textPrimary)
            Text("This companion app focuses on three things: fast capture, instant access to anything you've ever saved, and a one-tap URL you can paste into any AI.")
                .font(Brand.body(size: 13))
                .foregroundStyle(Brand.textMuted)
                .lineSpacing(3)
                .padding(.top, 2)
        }
    }

    @ViewBuilder
    private func section(_ title: String, sectionItems: [HelpItem]) -> some View {
        VStack(spacing: 0) {
            DisclosureGroup {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(sectionItems) { item in
                        HelpItemRow(item: item)
                    }
                }
                .padding(.top, 12)
                .padding(.bottom, 6)
            } label: {
                Text(title)
                    .font(Brand.body(size: 15, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
            }
            .tint(Brand.textMuted)
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
        }
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Still stuck?")
                .font(Brand.body(size: 13, weight: .medium))
                .foregroundStyle(Brand.textPrimary)
            Text("Email hi@raymind.ai or visit memory.wiki/manifesto for the why.")
                .font(Brand.body(size: 12))
                .foregroundStyle(Brand.textMuted)
                .lineSpacing(2)
        }
        .padding(.top, 8)
    }

    // MARK: - Content

    private var captureItems: [HelpItem] { [
        HelpItem(icon: "plus", title: "Three ways to capture",
                 body: "Tap the Capture tab to write or paste, drop a URL from your clipboard (Memory.Wiki sniffs it automatically), or use the camera button for OCR."),
        HelpItem(icon: "doc.on.clipboard", title: "Clipboard sniffer",
                 body: "Copy a URL anywhere on iOS, then open the Capture tab. A one-tap chip lets you save the page as a doc with the URL as Source."),
        HelpItem(icon: "bolt.fill", title: "Quick Actions",
                 body: "Long-press the Memory.Wiki icon on your home screen to jump straight to New Capture or Search."),
    ] }

    private var shareItems: [HelpItem] { [
        HelpItem(icon: "square.and.arrow.up", title: "Save from Safari / any app",
                 body: "Tap the system Share button → scroll the second row of actions → tap Memory.Wiki. The doc lands in your Timeline."),
        HelpItem(icon: "ellipsis.circle", title: "Don't see Memory.Wiki?",
                 body: "Open the Share Sheet → scroll right → tap More → switch on Memory.Wiki + drag it up. iOS only shows enabled extensions."),
        HelpItem(icon: "globe", title: "What gets saved",
                 body: "Whatever the sending app passes us: the URL, the page title, and any selected text. The original page isn't re-uploaded — we keep the link."),
    ] }

    private var widgetItems: [HelpItem] { [
        HelpItem(icon: "rectangle.stack", title: "Add the widget",
                 body: "Long-press your home screen → tap + → search Memory.Wiki → pick Small, Medium, or Large. Tap any row to open the doc."),
        HelpItem(icon: "arrow.clockwise", title: "When it refreshes",
                 body: "On every doc create/edit/delete inside the app, on app foreground, and roughly every 30 minutes via background refresh."),
        HelpItem(icon: "lock", title: "Lock screen widget",
                 body: "Same long-press flow on the lock screen (iOS 16+). The widget reads your session from a shared keychain — no second sign-in."),
    ] }

    private var spotlightItems: [HelpItem] { [
        HelpItem(icon: "magnifyingglass", title: "Search across iOS",
                 body: "Pull down on the home screen → type any title from your docs. Memory.Wiki results show inline; tap to deep-link straight into the doc."),
        HelpItem(icon: "arrow.triangle.2.circlepath", title: "Index updates",
                 body: "Every time the Timeline reloads, the iOS Spotlight index is rebuilt with your latest docs. No manual step."),
    ] }

    private var ocrItems: [HelpItem] { [
        HelpItem(icon: "camera", title: "Capture from camera",
                 body: "Capture tab → camera button (top-right) → Take photo. Vision runs OCR on-device (en + ko) and drops the recognised text into your draft."),
        HelpItem(icon: "photo.on.rectangle.angled", title: "Capture from screenshots",
                 body: "Same camera button → Choose from Library. Useful for chat-app screenshots, scanned receipts, or whiteboard photos."),
        HelpItem(icon: "shield", title: "Stays on device",
                 body: "v1 does OCR locally with Vision; the image itself is never uploaded. We just save the extracted text as a new doc."),
    ] }

    private var deeplinkItems: [HelpItem] { [
        HelpItem(icon: "link", title: "URL scheme",
                 body: "memorywiki://doc/<id> opens a doc · memorywiki://bundle/<id> opens a bundle · memorywiki://capture opens the Capture tab. Useful for Shortcuts.app + other apps."),
        HelpItem(icon: "wand.and.stars", title: "Shortcuts.app integration",
                 body: "Build a Shortcut with 'Open URL' → memorywiki://capture to jump straight into note-taking with a single tap from anywhere."),
    ] }

    private var markdownItems: [HelpItem] { [
        HelpItem(icon: "number", title: "Headings",
                 body: "# Heading 1 · ## Heading 2 · ### Heading 3. The keyboard toolbar in the Capture editor has shortcuts for the common ones."),
        HelpItem(icon: "bold", title: "Inline format",
                 body: "**bold** · *italic* · `code` · [link text](https://…). Rendered in the reader; preserved as-is in the saved doc."),
        HelpItem(icon: "list.bullet", title: "Lists + quotes",
                 body: "- bullet · 1. numbered · > blockquote. Fenced code blocks with three backticks ``` plus an optional language label."),
    ] }

    private var faqItems: [HelpItem] { [
        HelpItem(icon: "person", title: "What's my @username?",
                 body: "Visit memory.wiki on the web once to claim your username. The Settings screen will then show your canonical URL — the one you paste into AI."),
        HelpItem(icon: "lock.shield", title: "Public vs private",
                 body: "Docs are private by default. Open one → ellipsis → Make public to publish at memory.wiki/<short-id>. Private docs are visible only to you."),
        HelpItem(icon: "rectangle.portrait.and.arrow.right", title: "Why sign out then back in?",
                 body: "If sync breaks or the widget shows stale data, sign out from Settings and sign back in. Your local data is cleared and rebuilt from the server."),
        HelpItem(icon: "questionmark.circle", title: "Found a bug?",
                 body: "Settings → Send feedback opens an email pre-filled with version + device info. We read every one."),
    ] }
}

private struct HelpItem: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let body: String
}

private struct HelpItemRow: View {
    let item: HelpItem
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.icon)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(Brand.textFaint)
                .frame(width: 22, alignment: .leading)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(Brand.body(size: 13, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                Text(item.body)
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textMuted)
                    .lineSpacing(2.5)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

#Preview {
    NavigationStack { HelpView() }
        .preferredColorScheme(.dark)
}
