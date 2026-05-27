// Haptics — convenience wrapper around the three feedback
// generators we actually use. Centralised so call sites don't
// have to remember which generator to instantiate, and so the
// whole app can be muted from one place later if we add a
// preference.

import UIKit

enum Haptics {
    /// Light selection tap — list-row taps, toggle flips, picker
    /// selections.
    static func selection() {
        let gen = UISelectionFeedbackGenerator()
        gen.prepare()
        gen.selectionChanged()
    }

    /// Success — doc saved, doc deleted, link copied, sign-in
    /// complete.
    static func success() {
        let gen = UINotificationFeedbackGenerator()
        gen.prepare()
        gen.notificationOccurred(.success)
    }

    /// Warning / error — failed save, network error, permission
    /// denial.
    static func warning() {
        let gen = UINotificationFeedbackGenerator()
        gen.prepare()
        gen.notificationOccurred(.warning)
    }

    /// Soft tap — page transitions, deep-link arrivals.
    static func tap() {
        let gen = UIImpactFeedbackGenerator(style: .soft)
        gen.prepare()
        gen.impactOccurred()
    }
}
