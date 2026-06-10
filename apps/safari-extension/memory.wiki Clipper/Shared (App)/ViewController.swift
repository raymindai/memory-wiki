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
            if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(settingsURL)
            }
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

}
