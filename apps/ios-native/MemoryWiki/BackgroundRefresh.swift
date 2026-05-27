// BackgroundRefresh — quiet periodic timeline + widget refresh
// via BGAppRefreshTask. The system fires us roughly every 30
// minutes (capped by iOS based on user habits + low-power state)
// to pull /api/user/documents and update both the in-app
// TimelineModel (if alive) and the Widget timeline.
//
// Foreground refresh: handled by App.scenePhase becoming
// .active in MemoryWikiApp — we kick a TimelineModel reload +
// WidgetCenter reload there so the moment the user opens the
// app, what they see is fresh.

import Foundation
import BackgroundTasks
import WidgetKit

@MainActor
enum BackgroundRefresh {
    static let taskIdentifier = "wiki.memory.MemoryWiki.recent-refresh"

    /// Register the background task identifier early in app
    /// launch. iOS rejects scheduleAppRefresh calls for
    /// identifiers that haven't been registered first.
    static func registerHandler() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            guard let refreshTask = task as? BGAppRefreshTask else { return }
            handle(refreshTask)
        }
    }

    /// Ask the system to fire `handle` in ~30+ minutes. iOS may
    /// run it sooner or later based on heuristics; we don't fight
    /// the system. Re-schedule after every successful fire so the
    /// loop is self-sustaining without launching the app.
    static func scheduleNext() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date().addingTimeInterval(30 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    private static func handle(_ task: BGAppRefreshTask) {
        scheduleNext()
        let work = Task {
            // Fetch into a discardable result — the value goes
            // away when this task ends but the act of fetching
            // warms the Supabase JWT + side-effects the widget
            // timeline below.
            _ = try? await SharedAPI.recentDocs(limit: 5)
            WidgetCenter.shared.reloadAllTimelines()
            task.setTaskCompleted(success: true)
        }
        task.expirationHandler = {
            work.cancel()
            task.setTaskCompleted(success: false)
        }
    }
}
