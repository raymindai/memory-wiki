// FeedbackComposer — MFMailComposeViewController wrapper that
// pre-fills version + device diagnostics so we get useful bug
// reports instead of "doesn't work". Falls back to a clear
// alert when the device has no mail account configured.

import SwiftUI
import UIKit
import MessageUI

struct FeedbackComposer: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    var onResult: ((MFMailComposeResult) -> Void)?

    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let mc = MFMailComposeViewController()
        mc.mailComposeDelegate = context.coordinator
        mc.setToRecipients(["hi@raymind.ai"])
        mc.setSubject("Memory.Wiki iOS feedback")
        mc.setMessageBody(Self.bodyTemplate(), isHTML: false)
        return mc
    }

    func updateUIViewController(_ uiViewController: MFMailComposeViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        let parent: FeedbackComposer
        init(_ parent: FeedbackComposer) { self.parent = parent }
        func mailComposeController(_ controller: MFMailComposeViewController,
                                   didFinishWith result: MFMailComposeResult,
                                   error: Error?) {
            controller.dismiss(animated: true) { [weak self] in
                self?.parent.isPresented = false
                self?.parent.onResult?(result)
            }
        }
    }

    /// Pre-fills the email body so we always see version + device
    /// info — saves a back-and-forth on bug reports.
    static func bodyTemplate() -> String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        let device = UIDevice.current
        let os = "\(device.systemName) \(device.systemVersion)"
        let model = device.model
        return """


        ---
        App: Memory.Wiki iOS v\(v) (\(b))
        Device: \(model) · \(os)
        Locale: \(Locale.current.identifier)
        """
    }
}

/// Tiny helper sheet that handles the "no mail account" fallback
/// by opening a mailto: URL instead — that pops Mail / Gmail /
/// Outlook depending on the user's default handler.
struct FeedbackLauncher {
    static func open(presenter: UIViewController? = nil) {
        if MFMailComposeViewController.canSendMail() {
            // Show modal — handled by SwiftUI sheet upstream; this
            // path is only used by callers without a binding.
            return
        }
        // Fallback to mailto:
        let body = FeedbackComposer.bodyTemplate()
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let subject = "Memory.Wiki iOS feedback"
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let url = URL(string: "mailto:hi@raymind.ai?subject=\(subject)&body=\(body)")
        if let url { UIApplication.shared.open(url) }
    }
}
