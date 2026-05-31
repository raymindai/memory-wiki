import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Host app is a minimal container for the QuickLook extension.
        // It runs as LSUIElement (no dock icon, no menu bar).
        // Just registering the extension, then quit.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            NSApp.terminate(nil)
        }
    }
}
