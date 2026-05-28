// ShareViewController — UI host for the iOS Share Extension. iOS
// instantiates this from Info.plist > NSExtensionPrincipalClass.
// We bridge straight to a SwiftUI host view; UIKit chrome is just
// the wrapper.
//
// Payload extraction handles three NSItemProvider type identifiers:
//   - public.url            : the canonical URL of the page
//   - public.plain-text     : user selection / shared text
//   - public.propertyList   : the result of Share.js (when Safari
//                             invokes us on a page) — gives us
//                             title, URL, selection, and the
//                             article body all at once.

import UIKit
import SwiftUI
import MobileCoreServices
import UniformTypeIdentifiers

@objc(ShareViewController)
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.035, green: 0.035, blue: 0.043, alpha: 1) // Brand.background
        // Kick off async payload extraction. SwiftUI shows a
        // light loading state until it lands; for Safari-page
        // shares this can take up to ~400ms while JS runs.
        Task { @MainActor in
            let payload = await Self.extractPayload(from: extensionContext)
            mount(payload: payload)
        }
    }

    @MainActor
    private func mount(payload: SharePayload) {
        let host = UIHostingController(rootView: ShareSheetView(
            extensionContext: extensionContext,
            initial: payload
        ))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }

    // MARK: - Payload extraction

    /// Pulls the page metadata + selection + body out of the
    /// NSItemProviders iOS hands the extension. Each provider
    /// type is checked in priority order — the JS preprocessor
    /// result wins because it's the richest (title + url +
    /// selection + body all together). Falls back to URL +
    /// plain-text providers for non-Safari hosts.
    static func extractPayload(from context: NSExtensionContext?) async -> SharePayload {
        var payload = SharePayload()
        guard let items = context?.inputItems as? [NSExtensionItem] else { return payload }

        for item in items {
            // attributedTitle / attributedContentText carry the
            // page title for Safari page shares — useful as a
            // fallback when JS preprocessing isn't available.
            if payload.title == nil, let t = item.attributedTitle?.string {
                payload.title = t
            }
            if payload.bodyText == nil, let t = item.attributedContentText?.string {
                payload.bodyText = t
            }

            for provider in item.attachments ?? [] {
                // 1) JS preprocessor result — richest source.
                if provider.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier) {
                    if let dict: NSDictionary = await loadItem(provider, type: UTType.propertyList.identifier) as? NSDictionary,
                       let js = dict[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any] {
                        if payload.url == nil, let s = js["url"] as? String, let u = URL(string: s) {
                            payload.url = u
                        }
                        let ogTitle = (js["ogTitle"] as? String).flatMap { $0.isEmpty ? nil : $0 }
                        let docTitle = (js["title"] as? String).flatMap { $0.isEmpty ? nil : $0 }
                        if payload.title == nil { payload.title = ogTitle ?? docTitle }
                        if let s = js["selection"] as? String, !s.isEmpty { payload.selection = s }
                        if let s = js["bodyText"] as? String, !s.isEmpty { payload.bodyText = s }
                        if let s = js["ogDescription"] as? String, !s.isEmpty { payload.description = s }
                        if let s = js["siteName"] as? String, !s.isEmpty { payload.siteName = s }
                        if let s = js["ogImage"] as? String, !s.isEmpty { payload.imageURL = URL(string: s) }
                    }
                }
                // 2) Plain URL.
                if payload.url == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    if let url = await loadItem(provider, type: UTType.url.identifier) as? URL {
                        payload.url = url
                    }
                }
                // 3) Plain text (user-selected, or whole pasted
                //    text from another app). Don't overwrite the
                //    page body if we already got one from JS.
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    if let s = await loadItem(provider, type: UTType.plainText.identifier) as? String, !s.isEmpty {
                        if payload.selection == nil { payload.selection = s }
                        if payload.bodyText == nil { payload.bodyText = s }
                    }
                }
            }
        }
        return payload
    }

    private static func loadItem(_ provider: NSItemProvider, type: String) async -> Any? {
        await withCheckedContinuation { cont in
            provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
                cont.resume(returning: item)
            }
        }
    }
}

struct SharePayload {
    var title: String? = nil
    /// Selected text the user highlighted on the page (or text
    /// passed by the source app, if it shared text directly).
    var selection: String? = nil
    /// Heuristic article body extracted by Share.js, or the
    /// shared text payload from a non-Safari source.
    var bodyText: String? = nil
    /// OpenGraph description if present.
    var description: String? = nil
    var siteName: String? = nil
    var url: URL? = nil
    var imageURL: URL? = nil

    /// Markdown to POST when the user hits Save. Order:
    ///   1. # title
    ///   2. Source: <url>
    ///   3. > selection  (if user highlighted something)
    ///   4. body         (article excerpt OR pasted text)
    ///   5. extra memory the user typed in the extension UI
    func toMarkdown(overrideTitle: String?, extraMemory: String?) -> String {
        var out: [String] = []
        let t = (overrideTitle?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                 ? overrideTitle
                 : title)?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let t, !t.isEmpty {
            out.append("# \(t)")
        }
        if let url {
            out.append("Source: \(url.absoluteString)")
        }
        if let s = selection?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
            let quoted = s.split(separator: "\n").map { "> \($0)" }.joined(separator: "\n")
            out.append(quoted)
        }
        if let b = bodyText?.trimmingCharacters(in: .whitespacesAndNewlines), !b.isEmpty {
            out.append(b)
        }
        if let m = extraMemory?.trimmingCharacters(in: .whitespacesAndNewlines), !m.isEmpty {
            out.append("---")
            out.append(m)
        }
        return out.joined(separator: "\n\n")
    }
}
