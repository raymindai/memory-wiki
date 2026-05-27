// App Intents — surfaces Memory.Wiki actions in Shortcuts.app,
// Spotlight, Siri, and the Action Button. iOS 16+. The
// AppShortcutsProvider lists "ready-to-use" intents that appear
// automatically (no user setup) so the moment the app installs,
// "Capture a note" / "Search Memory.Wiki" are usable from Siri.

import AppIntents
import SwiftUI
import UIKit

// MARK: - Capture intent

/// Opens the app on the Capture tab. Optional text parameter is
/// dropped into the draft so chained shortcuts (clipboard →
/// Memory.Wiki, dictated note → Memory.Wiki) work out of the
/// box.
struct CaptureNoteIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture a note"
    static var description = IntentDescription("Open the Capture tab. Optionally pre-fill with text.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Note text", default: "")
    var text: String

    func perform() async throws -> some IntentResult {
        // Stash the pre-fill so CaptureView picks it up on .active
        // — direct binding from a background context isn't safe
        // without an actor hop.
        if !text.isEmpty {
            UserDefaults.standard.set(text, forKey: "mw.intent.captureText")
        }
        await MainActor.run {
            AppRouter.shared.selectedTab = .capture
        }
        return .result()
    }
}

// MARK: - Search intent

struct SearchMemoryIntent: AppIntent {
    static var title: LocalizedStringResource = "Search Memory.Wiki"
    static var description = IntentDescription("Search your captured notes by title or meaning.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Query")
    var query: String

    func perform() async throws -> some IntentResult {
        UserDefaults.standard.set(query, forKey: "mw.intent.searchQuery")
        await MainActor.run {
            AppRouter.shared.selectedTab = .timeline
            NotificationCenter.default.post(name: .mwOpenSearch, object: nil)
        }
        return .result()
    }
}

// MARK: - Open hub intent

struct OpenHubIntent: AppIntent {
    static var title: LocalizedStringResource = "Open my Memory.Wiki hub"
    static var description = IntentDescription("Open your @username hub on memory.wiki.")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult {
        let slug = await MainActor.run { AuthManager.shared.session?.hubSlug }
        guard let slug, !slug.isEmpty,
              let url = URL(string: "https://memory.wiki/@\(slug)") else {
            throw intentError("Sign in first so I know which hub to open.")
        }
        await UIApplication.shared.open(url)
        return .result()
    }

    /// Convenience helper for throwing a user-readable error from
    /// `perform()`. AppIntent's NSError bridging is verbose.
    private func intentError(_ msg: String) -> Error {
        NSError(domain: "wiki.memory.intent", code: 1,
                userInfo: [NSLocalizedDescriptionKey: msg])
    }
}

// MARK: - Copy hub URL intent

/// Side-grade of OpenHubIntent for users who want the URL
/// pasted into another app rather than opening Safari. Most
/// useful as a Shortcut tile on the home screen.
struct CopyHubURLIntent: AppIntent {
    static var title: LocalizedStringResource = "Copy my Memory.Wiki URL"
    static var description = IntentDescription("Copies a paste-ready 'Use <url> as my context' prompt for AI.")
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let slug = await MainActor.run { AuthManager.shared.session?.hubSlug }
        guard let slug, !slug.isEmpty else {
            throw NSError(domain: "wiki.memory.intent", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Sign in first."])
        }
        let url = "https://memory.wiki/@\(slug)"
        let prompt = "Use \(url) as my context."
        await MainActor.run {
            UIPasteboard.general.string = prompt
        }
        return .result(value: prompt)
    }
}

// MARK: - Shortcut provider

/// Surfaces the intents above in Shortcuts.app immediately on
/// install — no user setup. Spotlight + Siri pick these up too,
/// using the phrases below.
struct MemoryWikiShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CaptureNoteIntent(),
            phrases: [
                "Capture a note in \(.applicationName)",
                "New note in \(.applicationName)",
                "\(.applicationName)에 노트 캡쳐",
            ],
            shortTitle: "Capture",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: SearchMemoryIntent(),
            phrases: [
                "Search \(.applicationName)",
                "Find in \(.applicationName)",
                "\(.applicationName)에서 검색",
            ],
            shortTitle: "Search",
            systemImageName: "magnifyingglass"
        )
        AppShortcut(
            intent: OpenHubIntent(),
            phrases: [
                "Open my \(.applicationName) hub",
                "내 \(.applicationName) 열기",
            ],
            shortTitle: "Open hub",
            systemImageName: "safari"
        )
        AppShortcut(
            intent: CopyHubURLIntent(),
            phrases: [
                "Copy my \(.applicationName) URL",
                "Copy AI context from \(.applicationName)",
            ],
            shortTitle: "Copy URL",
            systemImageName: "doc.on.doc"
        )
    }
}
