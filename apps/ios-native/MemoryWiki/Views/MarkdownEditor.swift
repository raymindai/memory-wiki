// MarkdownEditor — UITextView wrapped as a SwiftUI view, with a
// real UIKit `inputAccessoryView` so the markdown toolbar slides
// in with the keyboard and out with it. iOS guarantees the
// accessory view is shown ONLY while the keyboard is on-screen
// — that's exactly the contract SwiftUI's `.toolbar(.keyboard)`
// has failed to honour on this surface.
//
// API matches a SwiftUI TextEditor:
//   - `@Binding var text: String`
//   - `var focused: FocusState<Bool>.Binding`
//   - `var onInsert: (String) -> Void`  — toolbar buttons call
//     this to append at the cursor.
//
// Brand chrome: dark canvas, ink body, JetBrains Mono toolbar
// button labels, no system tinting.

import SwiftUI
import UIKit

struct MarkdownEditor: UIViewRepresentable {
    @Binding var text: String
    var isFocused: Bool
    var onFocusChange: (Bool) -> Void
    var onStartDictation: () -> Void
    var onStopDictation: () -> Void
    var isDictating: Bool

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.delegate = context.coordinator
        tv.backgroundColor = .clear
        tv.textColor = UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
        tv.tintColor = UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
        tv.font = MarkdownEditor.bodyFont
        tv.textContainerInset = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
        tv.alwaysBounceVertical = true
        tv.keyboardDismissMode = .interactive
        tv.autocorrectionType = .yes
        tv.autocapitalizationType = .sentences
        tv.smartDashesType = .yes
        tv.smartQuotesType = .yes

        // Attach the markdown toolbar as the keyboard accessory.
        // UIKit handles all the show/hide timing — it only paints
        // when the keyboard is on-screen, which is the fix.
        let bar = MarkdownToolbarBar(target: context.coordinator)
        tv.inputAccessoryView = bar
        context.coordinator.toolbar = bar
        return tv
    }

    func updateUIView(_ tv: UITextView, context: Context) {
        if tv.text != text { tv.text = text }
        // Update dictation button state on the toolbar so the
        // mic icon flips fill/stroke when dictation is active.
        context.coordinator.toolbar?.setDictating(isDictating)
        // Focus state — push if SwiftUI says we should be focused
        // and we aren't, and vice versa.
        if isFocused && !tv.isFirstResponder {
            DispatchQueue.main.async { tv.becomeFirstResponder() }
        } else if !isFocused && tv.isFirstResponder {
            DispatchQueue.main.async { tv.resignFirstResponder() }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    static let bodyFont: UIFont = {
        if let f = UIFont(name: "NotoSans-Regular", size: 15) { return f }
        return UIFont.systemFont(ofSize: 15)
    }()

    final class Coordinator: NSObject, UITextViewDelegate {
        let parent: MarkdownEditor
        weak var toolbar: MarkdownToolbarBar?
        weak var textView: UITextView?

        init(_ parent: MarkdownEditor) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            self.textView = textView
            parent.text = textView.text
        }
        func textViewDidBeginEditing(_ textView: UITextView) {
            self.textView = textView
            parent.onFocusChange(true)
        }
        func textViewDidEndEditing(_ textView: UITextView) {
            parent.onFocusChange(false)
        }

        // MARK: - Toolbar actions

        func insert(_ scaffold: String) {
            UISelectionFeedbackGenerator().selectionChanged()
            guard let tv = textView ?? findTextView() else { return }
            let range = tv.selectedRange
            let insertion = NSAttributedString(string: scaffold, attributes: [
                .font: MarkdownEditor.bodyFont,
                .foregroundColor: UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
            ])
            let mutable = NSMutableAttributedString(attributedString: tv.attributedText)
            mutable.replaceCharacters(in: range, with: insertion)
            tv.attributedText = mutable
            let newPos = range.location + scaffold.count
            tv.selectedRange = NSRange(location: newPos, length: 0)
            parent.text = tv.text
        }

        /// Wrap the current selection (or insert paired tokens at
        /// the caret with the cursor parked between them).
        func wrap(_ token: String) {
            UISelectionFeedbackGenerator().selectionChanged()
            guard let tv = textView ?? findTextView() else { return }
            let range = tv.selectedRange
            let body = (tv.text as NSString).substring(with: range)
            let replacement = "\(token)\(body)\(token)"
            let attributed = NSAttributedString(string: replacement, attributes: [
                .font: MarkdownEditor.bodyFont,
                .foregroundColor: UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
            ])
            let mutable = NSMutableAttributedString(attributedString: tv.attributedText)
            mutable.replaceCharacters(in: range, with: attributed)
            tv.attributedText = mutable
            // Place caret inside the tokens when there was no
            // selection; otherwise leave it after the wrap.
            let newLoc = range.length == 0
                ? range.location + token.count
                : range.location + replacement.count
            tv.selectedRange = NSRange(location: newLoc, length: 0)
            parent.text = tv.text
        }

        func insertLink() {
            insert(scaffold: "[text](https://)")
        }

        private func insert(scaffold: String) {
            insert(scaffold)
        }

        private func findTextView() -> UITextView? {
            // Recursive walk — UIWindow doesn't expose a
            // firstResponder property publicly, so we hunt down
            // the responder chain looking for a UITextView in
            // editing state. Used only as a fallback when the
            // delegate hasn't given us a strong ref yet.
            for scene in UIApplication.shared.connectedScenes {
                guard let ws = scene as? UIWindowScene else { continue }
                for window in ws.windows {
                    if let tv = Self.findEditing(in: window) { return tv }
                }
            }
            return nil
        }

        private static func findEditing(in view: UIView) -> UITextView? {
            if let tv = view as? UITextView, tv.isFirstResponder { return tv }
            for sub in view.subviews {
                if let tv = findEditing(in: sub) { return tv }
            }
            return nil
        }

        func tappedDictation() {
            if parent.isDictating {
                parent.onStopDictation()
            } else {
                parent.onStartDictation()
            }
        }

        func dismissKeyboard() {
            textView?.resignFirstResponder()
        }
    }
}

/// UIKit-native toolbar bar — a UIView with a horizontal stack of
/// quiet buttons. Lives as `UITextView.inputAccessoryView` so
/// UIKit handles all show/hide timing with the keyboard.
final class MarkdownToolbarBar: UIView {
    weak var target: MarkdownEditor.Coordinator?
    private var dictButton: UIButton?

    init(target: MarkdownEditor.Coordinator) {
        self.target = target
        super.init(frame: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 44))
        autoresizingMask = [.flexibleWidth, .flexibleHeight]
        backgroundColor = UIColor(red: 0.094, green: 0.094, blue: 0.106, alpha: 1)
        layer.borderWidth = 0.5
        layer.borderColor = UIColor(red: 0.18, green: 0.18, blue: 0.20, alpha: 0.6).cgColor

        let stack = UIStackView()
        stack.axis = .horizontal
        stack.alignment = .center
        stack.distribution = .equalSpacing
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.heightAnchor.constraint(equalToConstant: 38),
        ])

        // Each scaffold button. Hash chosen over "H1/H2" labels
        // for compactness; tap inserts `\n# ` so the next caret
        // typing becomes a heading.
        stack.addArrangedSubview(button(systemName: "number") { [weak self] in self?.target?.insert("\n# ") })
        stack.addArrangedSubview(button(systemName: "bold") { [weak self] in self?.target?.wrap("**") })
        stack.addArrangedSubview(button(systemName: "italic") { [weak self] in self?.target?.wrap("*") })
        stack.addArrangedSubview(button(systemName: "list.bullet") { [weak self] in self?.target?.insert("\n- ") })
        stack.addArrangedSubview(button(systemName: "list.number") { [weak self] in self?.target?.insert("\n1. ") })
        stack.addArrangedSubview(button(systemName: "chevron.left.forwardslash.chevron.right") { [weak self] in self?.target?.insert("\n```\n\n```\n") })
        stack.addArrangedSubview(button(systemName: "link") { [weak self] in self?.target?.insertLink() })
        // Filler so the dictation + dismiss buttons stick to the
        // right edge regardless of stack distribution.
        let spacer = UIView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        spacer.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        stack.addArrangedSubview(spacer)
        let dict = button(systemName: "mic") { [weak self] in self?.target?.tappedDictation() }
        dictButton = dict
        stack.addArrangedSubview(dict)
        stack.addArrangedSubview(button(systemName: "keyboard.chevron.compact.down") { [weak self] in self?.target?.dismissKeyboard() })
    }

    required init?(coder: NSCoder) { fatalError() }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: 44)
    }

    func setDictating(_ active: Bool) {
        let name = active ? "mic.fill" : "mic"
        let tint = active
            ? UIColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1)
            : UIColor(red: 0.63, green: 0.63, blue: 0.67, alpha: 1)
        dictButton?.setImage(UIImage(systemName: name), for: .normal)
        dictButton?.tintColor = tint
    }

    private func button(systemName: String, action: @escaping () -> Void) -> UIButton {
        let b = UIButton(type: .system)
        b.setImage(UIImage(systemName: systemName), for: .normal)
        b.tintColor = UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
        b.imageView?.contentMode = .scaleAspectFit
        b.widthAnchor.constraint(greaterThanOrEqualToConstant: 32).isActive = true
        b.heightAnchor.constraint(equalToConstant: 38).isActive = true
        b.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return b
    }
}
