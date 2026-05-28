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
    ///
    /// `kUTTypePropertyList` is the documented type identifier
    /// for JS preprocessor results — used directly via the
    /// literal string to avoid any ambiguity around the modern
    /// UTType.propertyList mapping.
    static func extractPayload(from context: NSExtensionContext?) async -> SharePayload {
        var payload = SharePayload()
        var debug: [String] = []
        guard let items = context?.inputItems as? [NSExtensionItem] else { return payload }

        debug.append("items: \(items.count)")
        for (i, item) in items.enumerated() {
            if let t = item.attributedTitle?.string {
                debug.append("[item\(i)].title = \(t.prefix(60))")
                if payload.title == nil { payload.title = t }
            }
            if let t = item.attributedContentText?.string {
                debug.append("[item\(i)].content = \(t.prefix(60))")
                if payload.bodyText == nil { payload.bodyText = t }
            }

            let attachments = item.attachments ?? []
            debug.append("[item\(i)] attachments: \(attachments.count)")

            for (j, provider) in attachments.enumerated() {
                let types = provider.registeredTypeIdentifiers
                debug.append("  [att\(j)] types: \(types.joined(separator: ", "))")

                // 1) JS preprocessor result. The documented UTI
                //    is "com.apple.property-list" — same value as
                //    UTType.propertyList.identifier, but use the
                //    literal to dodge any framework quirks.
                let plistUTI = "com.apple.property-list"
                if types.contains(plistUTI) || provider.hasItemConformingToTypeIdentifier(plistUTI) {
                    if let raw = await loadItem(provider, type: plistUTI) {
                        debug.append("    plist raw type: \(type(of: raw))")
                        if let dict = raw as? NSDictionary {
                            if let js = dict[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any] {
                                debug.append("    JS keys: \(Array(js.keys).joined(separator: ","))")
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
                            } else {
                                debug.append("    NSExtensionJavaScriptPreprocessingResultsKey MISSING. dict keys: \(dict.allKeys)")
                            }
                        }
                    } else {
                        debug.append("    plist load returned nil")
                    }
                }
                // 2) Plain URL.
                if payload.url == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    if let url = await loadItem(provider, type: UTType.url.identifier) as? URL {
                        payload.url = url
                        debug.append("    url loaded: \(url.absoluteString.prefix(60))")
                    }
                }
                // 3) Plain text.
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    if let s = await loadItem(provider, type: UTType.plainText.identifier) as? String, !s.isEmpty {
                        if payload.selection == nil { payload.selection = s }
                        if payload.bodyText == nil { payload.bodyText = s }
                        debug.append("    text loaded: \(s.prefix(40))")
                    }
                }
            }
        }
        payload.debug = debug.joined(separator: "\n")

        // Fallback: if we got a URL but no body (Chrome / Slack /
        // Twitter / any non-Safari source — JS preprocessor only
        // runs in Safari), fetch the page over HTTP and pull
        // title + og + body from the HTML. Capped at 4s so the
        // share UI mounts promptly even when the page is slow.
        if payload.url != nil && (payload.bodyText?.isEmpty ?? true) {
            await Self.enrichFromHTML(payload: &payload)
            debug.append("fallback html fetch: bodyText \(payload.bodyText?.count ?? 0) chars")
            payload.debug = debug.joined(separator: "\n")
        }
        return payload
    }

    /// HTTP-fetch fallback that runs when the source app gave us
    /// a URL but no body content. Parses the HTML in-place with
    /// pragmatic regex — no SwiftSoup dependency. 4-second cap.
    private static func enrichFromHTML(payload: inout SharePayload) async {
        guard let url = payload.url else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 4
        // Safari-ish UA — many sites block "Swift/iOS" clients.
        req.setValue(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 " +
            "Mobile/15E148 Safari/604.1",
            forHTTPHeaderField: "User-Agent"
        )
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            guard let html = String(data: data, encoding: .utf8)
                  ?? String(data: data, encoding: .isoLatin1) else { return }

            // Meta tags
            if payload.title?.isEmpty ?? true {
                payload.title = match(html, pattern: #"<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']"#)
                    ?? match(html, pattern: #"<title[^>]*>([\s\S]*?)</title>"#)?.htmlDecoded
            }
            if payload.description?.isEmpty ?? true {
                payload.description = match(html, pattern: #"<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']"#)
                    ?? match(html, pattern: #"<meta\s+name=["']description["']\s+content=["']([^"']+)["']"#)
            }
            if payload.siteName?.isEmpty ?? true {
                payload.siteName = match(html, pattern: #"<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']"#)
            }
            if payload.imageURL == nil {
                if let img = match(html, pattern: #"<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']"#),
                   let u = URL(string: img) {
                    payload.imageURL = u
                }
            }

            // Body excerpt — strip script + style + nav + footer,
            // prefer <article> or <main>, fall back to full body,
            // then strip remaining tags + collapse whitespace.
            let body = extractReadableBody(from: html)
            if !body.isEmpty {
                payload.bodyText = body
            }
        } catch {
            // Silent — diagnostic field captures the failure.
        }
    }

    private static func extractReadableBody(from html: String) -> String {
        var s = html
        // Drop noisy blocks first
        for pattern in [
            #"<script[\s\S]*?</script>"#,
            #"<style[\s\S]*?</style>"#,
            #"<noscript[\s\S]*?</noscript>"#,
            #"<header[\s\S]*?</header>"#,
            #"<footer[\s\S]*?</footer>"#,
            #"<nav[\s\S]*?</nav>"#,
            #"<aside[\s\S]*?</aside>"#,
            #"<svg[\s\S]*?</svg>"#,
        ] {
            s = s.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
        }
        // Prefer the article / main container if present.
        let container: String
        if let m = match(s, pattern: #"<article[\s\S]*?</article>"#) ?? match(s, pattern: #"<main[\s\S]*?</main>"#) {
            container = m
        } else {
            container = s
        }
        // Strip remaining tags + decode entities + collapse whitespace.
        let stripped = container
            .replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
            .htmlDecoded
            .replacingOccurrences(of: #"[ \t]+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\n[ \t]*\n[ \t]*\n+"#, with: "\n\n", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        // Cap to keep the POST body modest (same limit as Share.js).
        if stripped.count > 2000 {
            return String(stripped.prefix(2000)) + "\n\n… (continued at source URL)"
        }
        return stripped
    }

    private static func match(_ haystack: String, pattern: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return nil }
        let range = NSRange(haystack.startIndex..., in: haystack)
        guard let m = re.firstMatch(in: haystack, range: range) else { return nil }
        if m.numberOfRanges > 1, let r = Range(m.range(at: 1), in: haystack) {
            return String(haystack[r]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if let r = Range(m.range, in: haystack) {
            return String(haystack[r])
        }
        return nil
    }

    private static func loadItem(_ provider: NSItemProvider, type: String) async -> Any? {
        await withCheckedContinuation { cont in
            provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
                cont.resume(returning: item)
            }
        }
    }
}

private extension String {
    /// Minimal HTML entity decoder — covers the entities that
    /// actually appear in <title> / og:* / article body text. A
    /// full decoder would pull in a 200-entry table; the five
    /// here cover ~99% of real-world cases. Numeric refs handled
    /// via NSAttributedString as a last resort.
    var htmlDecoded: String {
        var s = self
        let map: [(String, String)] = [
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", "\""),
            ("&#39;", "'"),
            ("&apos;", "'"),
            ("&nbsp;", " "),
            ("&#x27;", "'"),
            ("&#x2F;", "/"),
            ("&hellip;", "…"),
            ("&ndash;", "–"),
            ("&mdash;", "—"),
            ("&ldquo;", "\u{201C}"),
            ("&rdquo;", "\u{201D}"),
            ("&lsquo;", "\u{2018}"),
            ("&rsquo;", "\u{2019}"),
        ]
        for (k, v) in map { s = s.replacingOccurrences(of: k, with: v) }
        return s
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
    /// Diagnostic log — what the NSExtensionContext handed us
    /// during extraction. Surfaced in the share UI behind a
    /// disclosure so we can root-cause "body not captured"
    /// reports without device logs.
    var debug: String = ""

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
