//
//  AppDelegate.swift
//  macOS (App)
//
//  Created by Hyunsang Cho on 6/10/26.
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Center the window on first launch — storyboard's contentRect
        // is only used as an initial size, and AppKit's default origin
        // leaves the window in the bottom-left corner of the screen.
        // Centering here matches what every other macOS app does for a
        // single-window utility opened from Launchpad.
        DispatchQueue.main.async {
            NSApplication.shared.windows.first?.center()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

}
