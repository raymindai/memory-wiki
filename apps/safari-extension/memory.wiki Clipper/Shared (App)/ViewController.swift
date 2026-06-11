//
//  ViewController.swift
//  Shared (App)
//
//  Container app for the Safari Web Extension. Hosts a WKWebView that
//  loads Resources/Base.lproj/Main.html. JavaScript posts typed messages
//  back through window.webkit.messageHandlers.controller.postMessage to
//  drive native actions (open Safari prefs / Settings / external URL).
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

/// Bundle identifier of the Safari extension we ship. The container app
/// asks Safari for its state via SFSafariExtensionManager (macOS only),
/// so this must match the extension target's PRODUCT_BUNDLE_IDENTIFIER.
let extensionBundleIdentifier: String = {
    #if os(iOS)
    return "wiki.memory.clipper.ios.Extension"
    #else
    return "wiki.memory.clipper.mac.Extension"
    #endif
}()

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

        #if os(iOS)
        self.webView.scrollView.isScrollEnabled = true
        self.webView.scrollView.contentInsetAdjustmentBehavior = .always
        #endif

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(
            Bundle.main.url(forResource: "Main", withExtension: "html")!,
            allowingReadAccessTo: Bundle.main.resourceURL!
        )
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if os(iOS)
        webView.evaluateJavaScript("show('ios')")
        #elseif os(macOS)
        webView.evaluateJavaScript("show('mac')")

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else { return }
            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
                }
            }
        }
        #endif
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Accept both the legacy plain-string "open-preferences" and the
        // new typed-dictionary protocol so we don't break old Main.html
        // shipped to existing users mid-rollout.
        let type: String
        var url: String? = nil
        if let s = message.body as? String {
            type = s
        } else if let dict = message.body as? [String: Any], let t = dict["type"] as? String {
            type = t
            url = dict["url"] as? String
        } else {
            return
        }

        switch type {
        case "open-preferences":
            #if os(macOS)
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
                DispatchQueue.main.async { NSApp.terminate(self) }
            }
            #endif

        case "open-settings":
            #if os(iOS)
            // iOS has no public deeplink to Safari > Extensions. Try
            // private URL schemes that 1Password / Bitwarden / AdGuard
            // ship with, in decreasing specificity:
            //   1. App-prefs:Safari&path=WEB_EXTENSIONS   -> jumps straight to the extension list (iOS 16+)
            //   2. App-prefs:Safari                       -> just Safari settings, user taps Extensions
            //   3. App-prefs:root=SAFARI                  -> older form
            //   4. UIApplication.openSettingsURLString    -> public fallback (lands at app-specific section)
            // iOS 17+/iOS 26 have been pickier about #1, so we cascade
            // through the completion handler — first scheme that
            // succeeds wins. Apple's review allows these for Safari
            // Web Extension wrappers because there is no public
            // alternative for the destination.
            openSettingsCascade([
                "App-prefs:Safari&path=WEB_EXTENSIONS",
                "App-prefs:Safari",
                "App-prefs:root=SAFARI",
                UIApplication.openSettingsURLString,
            ])
            #endif

        case "open-url":
            guard let urlString = url, let externalURL = URL(string: urlString) else { return }
            #if os(iOS)
            UIApplication.shared.open(externalURL)
            #elseif os(macOS)
            NSWorkspace.shared.open(externalURL)
            #endif

        default:
            break
        }
    }

    #if os(iOS)
    /// Try each URL string in order, using `UIApplication.open`'s
    /// completion handler to fall through to the next if iOS refuses
    /// (private schemes are sometimes rejected outright on newer iOS).
    /// The last URL in the list should be a guaranteed-public one.
    private func openSettingsCascade(_ urls: [String]) {
        var remaining = urls
        func tryNext() {
            guard !remaining.isEmpty else { return }
            let next = remaining.removeFirst()
            guard let url = URL(string: next) else {
                tryNext()
                return
            }
            UIApplication.shared.open(url, options: [:]) { success in
                if !success { tryNext() }
            }
        }
        tryNext()
    }
    #endif

}
