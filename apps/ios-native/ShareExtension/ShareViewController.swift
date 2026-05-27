// ShareViewController — UI host for the iOS Share Extension. iOS
// instantiates this from Info.plist > NSExtensionMainStoryboard
// / NSExtensionPrincipalClass. We bridge straight to a SwiftUI
// host view; UIKit chrome is just the wrapper.

import UIKit
import SwiftUI
import Social

@objc(ShareViewController)
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: ShareSheetView(
            extensionContext: extensionContext,
            initial: extractInitialPayload()
        ))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        host.didMove(toParent: self)
        view.backgroundColor = UIColor(red: 0.035, green: 0.035, blue: 0.043, alpha: 1) // matches Brand.background
    }

    /// Pulls whatever the host app shared with us (URL / plain
    /// text / both). Title defaults to nothing; SwiftUI fills it
    /// from the page title when iOS provides it.
    private func extractInitialPayload() -> SharePayload {
        var payload = SharePayload()
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return payload }
        for item in items {
            if let title = item.attributedTitle?.string ?? item.attributedContentText?.string {
                if payload.title == nil { payload.title = title }
            }
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier("public.url") {
                    let sem = DispatchSemaphore(value: 0)
                    provider.loadItem(forTypeIdentifier: "public.url", options: nil) { item, _ in
                        if let url = item as? URL { payload.url = url }
                        sem.signal()
                    }
                    _ = sem.wait(timeout: .now() + .seconds(2))
                } else if provider.hasItemConformingToTypeIdentifier("public.plain-text") {
                    let sem = DispatchSemaphore(value: 0)
                    provider.loadItem(forTypeIdentifier: "public.plain-text", options: nil) { item, _ in
                        if let s = item as? String { payload.text = s }
                        sem.signal()
                    }
                    _ = sem.wait(timeout: .now() + .seconds(2))
                }
            }
        }
        return payload
    }
}

struct SharePayload {
    var title: String? = nil
    var text: String? = nil
    var url: URL? = nil

    /// Markdown we'd POST if the user hit Save right now — H1
    /// title, optional source URL line, optional pasted text.
    func toMarkdown(overrideTitle: String?) -> String {
        var out: [String] = []
        if let t = (overrideTitle ?? title)?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty {
            out.append("# \(t)")
        }
        if let url {
            out.append("Source: \(url.absoluteString)")
        }
        if let text, !text.isEmpty {
            out.append(text)
        }
        return out.joined(separator: "\n\n")
    }
}
