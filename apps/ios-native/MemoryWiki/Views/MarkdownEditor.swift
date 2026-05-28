// MarkdownEditor — UITextView wrapped as a SwiftUI view, with a
// real UIKit `inputAccessoryView` so the markdown toolbar docks
// flush against the keyboard's top edge with ZERO gap (every
// SwiftUI-native attempt — .toolbar(.keyboard), safeAreaInset
// — left a system-padding gutter we couldn't close).
//
// Toolbar is a Notes-style horizontally scrolling capsule pill
// containing every formatting token plus media buttons (camera,
// OCR text-scan, mic). Hosts callbacks back into the SwiftUI
// CaptureView so photo + voice + OCR flows reuse the same state.

import SwiftUI
import UIKit

struct MarkdownEditor: UIViewRepresentable {
    @Binding var text: String
    var isFocused: Bool
    var onFocusChange: (Bool) -> Void
    var onPhoto: () -> Void
    var onOCR: () -> Void
    var onStartDictation: () -> Void
    var onStopDictation: () -> Void
    var isDictating: Bool

    func makeUIView(context: Context) -> UITextView {
        let tv = FillingTextView()
        tv.delegate = context.coordinator
        tv.backgroundColor = .clear
        tv.textColor = UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
        tv.tintColor = UIColor(red: 0.98, green: 0.71, blue: 0.10, alpha: 1) // microWarn
        tv.font = MarkdownEditor.bodyFont
        tv.textContainerInset = UIEdgeInsets(top: 6, left: 14, bottom: 14, right: 14)
        tv.alwaysBounceVertical = true
        tv.keyboardDismissMode = .interactive
        tv.autocorrectionType = .yes
        tv.autocapitalizationType = .sentences
        tv.smartDashesType = .yes
        tv.smartQuotesType = .yes
        // Without this UITextView reports a small intrinsicContentSize
        // (just the text bounds), so SwiftUI inside a VStack stops
        // stretching it to fill the available height — the visible
        // tap area collapses to a one-line strip and taps below
        // the cursor row miss. Telling SwiftUI to "not hug, not
        // resist" stretches it to fill.
        tv.setContentHuggingPriority(.defaultLow, for: .vertical)
        tv.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        // Empty-state placeholder using a UILabel overlay; SwiftUI
        // overlay was being clipped by the input accessory frame.
        let placeholder = UILabel()
        placeholder.text = "Add more details…"
        placeholder.textColor = UIColor(red: 0.54, green: 0.54, blue: 0.57, alpha: 1)
        placeholder.font = MarkdownEditor.bodyFont
        placeholder.translatesAutoresizingMaskIntoConstraints = false
        // CRITICAL: without this the label intercepts the first
        // tap on the editor, dropping the user's focus attempt.
        placeholder.isUserInteractionEnabled = false
        tv.addSubview(placeholder)
        NSLayoutConstraint.activate([
            placeholder.topAnchor.constraint(equalTo: tv.topAnchor, constant: 8),
            placeholder.leadingAnchor.constraint(equalTo: tv.leadingAnchor, constant: 18),
        ])
        context.coordinator.placeholderLabel = placeholder

        // Attach the Notes-style toolbar pill as the keyboard
        // accessory. UIKit handles all show/hide timing — it
        // paints ONLY while the keyboard is on-screen, docked
        // flush against the keyboard's top edge.
        let bar = MarkdownPillBar(target: context.coordinator)
        tv.inputAccessoryView = bar
        context.coordinator.toolbar = bar
        return tv
    }

    func updateUIView(_ tv: UITextView, context: Context) {
        if tv.text != text { tv.text = text }
        context.coordinator.toolbar?.setDictating(isDictating)
        context.coordinator.placeholderLabel?.isHidden = !tv.text.isEmpty
        // Focus race-fix: UIKit calls becomeFirstResponder()
        // natively on tap, then keyboardWillShow re-renders SwiftUI
        // BEFORE the textViewDidBeginEditing delegate has bubbled
        // the focus back into our @FocusState. If we resign here
        // any time isFocused == false, that stale re-render would
        // kill the focus we just gained.
        //
        // Track the previous SwiftUI focus state and only resign
        // on a true `true → false` transition (Cancel pressed,
        // toolbar dismiss tapped, etc.). Initial false on first
        // tap is left alone — UIKit owns that path.
        let prev = context.coordinator.wasFocused
        context.coordinator.wasFocused = isFocused
        if isFocused && !tv.isFirstResponder {
            DispatchQueue.main.async { tv.becomeFirstResponder() }
        } else if !isFocused && prev && tv.isFirstResponder {
            DispatchQueue.main.async { tv.resignFirstResponder() }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    static let bodyFont: UIFont = {
        if let f = UIFont(name: "NotoSans-Regular", size: 16) { return f }
        return UIFont.systemFont(ofSize: 16)
    }()

    class Coordinator: NSObject, UITextViewDelegate {
        let parent: MarkdownEditor
        weak var toolbar: MarkdownPillBar?
        weak var textView: UITextView?
        weak var placeholderLabel: UILabel?
        /// Tracks the SwiftUI-side focus state across renders so
        /// updateUIView can distinguish a real true→false dismiss
        /// from a stale-render false (see updateUIView comment).
        var wasFocused: Bool = false

        init(_ parent: MarkdownEditor) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            self.textView = textView
            parent.text = textView.text
            placeholderLabel?.isHidden = !textView.text.isEmpty
        }
        func textViewDidBeginEditing(_ textView: UITextView) {
            self.textView = textView
            parent.onFocusChange(true)
        }
        func textViewDidEndEditing(_ textView: UITextView) {
            parent.onFocusChange(false)
        }

        // MARK: - Toolbar actions

        @objc func insert(_ scaffold: String) {
            UISelectionFeedbackGenerator().selectionChanged()
            guard let tv = textView ?? findTextView() else { return }
            let range = tv.selectedRange
            let mutable = NSMutableAttributedString(attributedString: tv.attributedText)
            let attr = NSAttributedString(string: scaffold, attributes: [
                .font: MarkdownEditor.bodyFont,
                .foregroundColor: UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
            ])
            mutable.replaceCharacters(in: range, with: attr)
            tv.attributedText = mutable
            tv.selectedRange = NSRange(location: range.location + scaffold.count, length: 0)
            parent.text = tv.text
            placeholderLabel?.isHidden = !tv.text.isEmpty
        }

        @objc func wrap(_ token: String) {
            UISelectionFeedbackGenerator().selectionChanged()
            guard let tv = textView ?? findTextView() else { return }
            let range = tv.selectedRange
            let body = (tv.text as NSString).substring(with: range)
            let replacement = "\(token)\(body)\(token)"
            let mutable = NSMutableAttributedString(attributedString: tv.attributedText)
            mutable.replaceCharacters(in: range, with: NSAttributedString(string: replacement, attributes: [
                .font: MarkdownEditor.bodyFont,
                .foregroundColor: UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
            ]))
            tv.attributedText = mutable
            tv.selectedRange = NSRange(
                location: range.length == 0 ? range.location + token.count : range.location + replacement.count,
                length: 0
            )
            parent.text = tv.text
            placeholderLabel?.isHidden = !tv.text.isEmpty
        }

        func insertLink() { insert("[text](https://)") }

        private func findTextView() -> UITextView? {
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
            if parent.isDictating { parent.onStopDictation() }
            else { parent.onStartDictation() }
        }
        func tappedPhoto() { parent.onPhoto() }
        func tappedOCR()   { parent.onOCR() }
        func dismissKeyboard() { textView?.resignFirstResponder() }
    }
}

/// Title-line UITextField wrapper that shares the same Notes-style
/// `inputAccessoryView` as the body editor. Single line, display
/// font, microWarn caret. Without this the SwiftUI-native TextField
/// would show the system keyboard with no toolbar — different
/// vocabulary from the body, jarring.
struct MarkdownTitleField: UIViewRepresentable {
    @Binding var text: String
    var isFocused: Bool
    var onFocusChange: (Bool) -> Void
    var onPhoto: () -> Void
    var onOCR: () -> Void
    var onStartDictation: () -> Void
    var onStopDictation: () -> Void
    var isDictating: Bool
    var onReturn: () -> Void

    func makeUIView(context: Context) -> UITextField {
        let tf = UITextField()
        tf.delegate = context.coordinator
        tf.backgroundColor = .clear
        tf.textColor = UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
        tf.tintColor = UIColor(red: 0.98, green: 0.71, blue: 0.10, alpha: 1)
        tf.font = MarkdownTitleField.titleFont
        tf.returnKeyType = .next
        tf.autocapitalizationType = .sentences
        tf.smartDashesType = .yes
        tf.smartQuotesType = .yes
        // Big-display placeholder via attributed string so we keep
        // the same font / muted colour as the body editor.
        tf.attributedPlaceholder = NSAttributedString(
            string: "What's on your mind?",
            attributes: [
                .font: MarkdownTitleField.titleFont,
                .foregroundColor: UIColor(red: 0.54, green: 0.54, blue: 0.57, alpha: 1)
            ]
        )
        tf.addTarget(context.coordinator, action: #selector(Coordinator.editingChanged(_:)), for: .editingChanged)
        // Share the same toolbar pill the body uses — buttons map
        // back into the Coordinator which mediates between text
        // field state and CaptureView callbacks.
        let bar = MarkdownPillBar(target: context.coordinator.bodyCoordinator)
        tf.inputAccessoryView = bar
        context.coordinator.toolbar = bar
        return tf
    }

    func updateUIView(_ tf: UITextField, context: Context) {
        if tf.text != text { tf.text = text }
        context.coordinator.toolbar?.setDictating(isDictating)
        if isFocused && !tf.isFirstResponder {
            DispatchQueue.main.async { tf.becomeFirstResponder() }
        } else if !isFocused && tf.isFirstResponder {
            DispatchQueue.main.async { tf.resignFirstResponder() }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    static let titleFont: UIFont = {
        if let f = UIFont(name: "CalSans-Regular", size: 26) { return f }
        return UIFont.systemFont(ofSize: 26, weight: .semibold)
    }()

    final class Coordinator: NSObject, UITextFieldDelegate {
        let parent: MarkdownTitleField
        weak var toolbar: MarkdownPillBar?
        weak var textField: UITextField?
        /// Adapter coordinator that bridges toolbar actions back
        /// to the parent. Each formatting button inserts into the
        /// title's text (with the same wrap/insert vocabulary).
        lazy var bodyCoordinator: MarkdownEditor.Coordinator = makeBridge()

        init(_ parent: MarkdownTitleField) { self.parent = parent }

        @objc func editingChanged(_ tf: UITextField) {
            textField = tf
            parent.text = tf.text ?? ""
        }
        func textFieldDidBeginEditing(_ textField: UITextField) {
            self.textField = textField
            parent.onFocusChange(true)
        }
        func textFieldDidEndEditing(_ textField: UITextField) {
            parent.onFocusChange(false)
        }
        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            parent.onReturn()
            return false
        }

        /// Build a bridge Coordinator that translates toolbar
        /// callbacks into title-field edits + parent callbacks.
        private func makeBridge() -> MarkdownEditor.Coordinator {
            // Construct a stub MarkdownEditor whose only purpose is
            // to provide the parent callbacks; the bridge overrides
            // insert/wrap to act on the text FIELD instead of a
            // text view.
            let stub = MarkdownEditor(
                text: .constant(""),
                isFocused: false,
                onFocusChange: { _ in },
                onPhoto: { [weak self] in self?.parent.onPhoto() },
                onOCR:   { [weak self] in self?.parent.onOCR() },
                onStartDictation: { [weak self] in self?.parent.onStartDictation() },
                onStopDictation:  { [weak self] in self?.parent.onStopDictation() },
                isDictating: parent.isDictating
            )
            return TitleBridgeCoordinator(stub, host: self)
        }
    }

    /// Subclass that overrides insert/wrap to target the title
    /// field. Toolbar formatting on the title line is rare but
    /// supported (bold / italic). Most users will tap the body
    /// then format — this just keeps the toolbar legal there.
    final class TitleBridgeCoordinator: MarkdownEditor.Coordinator {
        weak var host: Coordinator?
        init(_ parent: MarkdownEditor, host: Coordinator) {
            self.host = host
            super.init(parent)
        }
        override func insert(_ scaffold: String) {
            UISelectionFeedbackGenerator().selectionChanged()
            guard let tf = host?.textField else { return }
            tf.text = (tf.text ?? "") + scaffold
            host?.parent.text = tf.text ?? ""
        }
        override func wrap(_ token: String) {
            UISelectionFeedbackGenerator().selectionChanged()
            guard let tf = host?.textField else { return }
            tf.text = (tf.text ?? "") + "\(token)\(token)"
            host?.parent.text = tf.text ?? ""
        }
    }
}

// MARK: - Notes-style pill toolbar
//
// Capsule container with a horizontally scrolling button row.
// Sits as `UITextView.inputAccessoryView`, so iOS docks it flush
// against the keyboard's top edge — no SwiftUI safe-area padding
// inserts a gutter below the bar.

final class MarkdownPillBar: UIView, UIScrollViewDelegate {
    weak var target: MarkdownEditor.Coordinator?
    private var dictButton: UIButton?
    private let pill = UIView()
    private let scroll = UIScrollView()
    /// Edge fade overlays — pill-color gradients on the leading/
    /// trailing edges of the scroll area. Alpha is driven by
    /// scrollViewDidScroll so the hint only appears when there's
    /// actually more content beyond the edge.
    private let leftFade = UIView()
    private let rightFade = UIView()
    private let leftFadeLayer = CAGradientLayer()
    private let rightFadeLayer = CAGradientLayer()
    /// Pill background colour — also the opaque stop of the fade.
    private let pillColor = UIColor(red: 0.094, green: 0.094, blue: 0.106, alpha: 1)

    init(target: MarkdownEditor.Coordinator) {
        self.target = target
        super.init(frame: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 56))
        autoresizingMask = [.flexibleWidth]
        backgroundColor = .clear

        // The pill — capsule fill + hairline border. Lives inside
        // the bar with 8pt horizontal margins so it doesn't kiss
        // the screen edges.
        pill.backgroundColor = pillColor
        pill.layer.cornerRadius = 24
        pill.layer.borderWidth = 0.5
        pill.layer.borderColor = UIColor(red: 0.18, green: 0.18, blue: 0.20, alpha: 0.7).cgColor
        pill.translatesAutoresizingMaskIntoConstraints = false
        // Clip so the fade overlays follow the capsule corners
        // instead of bleeding past them.
        pill.clipsToBounds = true
        addSubview(pill)
        NSLayoutConstraint.activate([
            pill.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
            pill.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            pill.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            pill.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
            pill.heightAnchor.constraint(equalToConstant: 48),
        ])

        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.showsHorizontalScrollIndicator = false
        scroll.contentInset = UIEdgeInsets(top: 0, left: 8, bottom: 0, right: 8)
        scroll.delegate = self
        pill.addSubview(scroll)
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo: pill.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: pill.trailingAnchor),
            scroll.topAnchor.constraint(equalTo: pill.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: pill.bottomAnchor),
        ])

        // Fade overlays — drawn on top of the scroll content so
        // partially-clipped buttons get blurred toward the pill
        // colour, suggesting "there's more this way." Width matches
        // the chevron's horizontal travel so the hint reads quickly
        // without dominating the bar.
        let fadeWidth: CGFloat = 28
        for (view, layer, isLeft) in [
            (leftFade, leftFadeLayer, true),
            (rightFade, rightFadeLayer, false)
        ] {
            view.translatesAutoresizingMaskIntoConstraints = false
            view.isUserInteractionEnabled = false
            view.alpha = 0
            layer.colors = isLeft
                ? [pillColor.cgColor, pillColor.withAlphaComponent(0).cgColor]
                : [pillColor.withAlphaComponent(0).cgColor, pillColor.cgColor]
            layer.startPoint = CGPoint(x: 0, y: 0.5)
            layer.endPoint = CGPoint(x: 1, y: 0.5)
            view.layer.addSublayer(layer)
            pill.addSubview(view)
            NSLayoutConstraint.activate([
                view.topAnchor.constraint(equalTo: pill.topAnchor),
                view.bottomAnchor.constraint(equalTo: pill.bottomAnchor),
                view.widthAnchor.constraint(equalToConstant: fadeWidth),
                isLeft
                    ? view.leadingAnchor.constraint(equalTo: pill.leadingAnchor)
                    : view.trailingAnchor.constraint(equalTo: pill.trailingAnchor),
            ])
        }

        let stack = UIStackView()
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 2
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            stack.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
        ])

        // Formatting tokens.
        stack.addArrangedSubview(button(systemName: "number") { [weak self] in self?.target?.insert("\n# ") })
        stack.addArrangedSubview(button(systemName: "bold") { [weak self] in self?.target?.wrap("**") })
        stack.addArrangedSubview(button(systemName: "italic") { [weak self] in self?.target?.wrap("*") })
        stack.addArrangedSubview(button(systemName: "list.bullet") { [weak self] in self?.target?.insert("\n- ") })
        stack.addArrangedSubview(button(systemName: "list.number") { [weak self] in self?.target?.insert("\n1. ") })
        stack.addArrangedSubview(button(systemName: "checkmark.square") { [weak self] in self?.target?.insert("\n- [ ] ") })
        stack.addArrangedSubview(button(systemName: "chevron.left.forwardslash.chevron.right") { [weak self] in self?.target?.insert("\n```\n\n```\n") })
        stack.addArrangedSubview(button(systemName: "link") { [weak self] in self?.target?.insertLink() })
        stack.addArrangedSubview(button(systemName: "quote.bubble") { [weak self] in self?.target?.insert("\n> ") })
        stack.addArrangedSubview(button(systemName: "minus") { [weak self] in self?.target?.insert("\n\n---\n\n") })
        // Divider
        let divider = UIView()
        divider.backgroundColor = UIColor(red: 0.18, green: 0.18, blue: 0.20, alpha: 1)
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.widthAnchor.constraint(equalToConstant: 1).isActive = true
        divider.heightAnchor.constraint(equalToConstant: 22).isActive = true
        let dividerWrap = UIView()
        dividerWrap.translatesAutoresizingMaskIntoConstraints = false
        dividerWrap.addSubview(divider)
        NSLayoutConstraint.activate([
            divider.centerYAnchor.constraint(equalTo: dividerWrap.centerYAnchor),
            divider.centerXAnchor.constraint(equalTo: dividerWrap.centerXAnchor),
            dividerWrap.widthAnchor.constraint(equalToConstant: 12),
        ])
        stack.addArrangedSubview(dividerWrap)
        // Media + voice.
        stack.addArrangedSubview(button(systemName: "camera", tint: UIColor(red: 0.98, green: 0.71, blue: 0.10, alpha: 1)) { [weak self] in self?.target?.tappedPhoto() })
        stack.addArrangedSubview(button(systemName: "text.viewfinder", tint: UIColor(red: 0.38, green: 0.65, blue: 0.98, alpha: 1)) { [weak self] in self?.target?.tappedOCR() })
        let dict = button(systemName: "mic") { [weak self] in self?.target?.tappedDictation() }
        dictButton = dict
        stack.addArrangedSubview(dict)
        stack.addArrangedSubview(button(systemName: "keyboard.chevron.compact.down", tint: UIColor(red: 0.63, green: 0.63, blue: 0.67, alpha: 1)) { [weak self] in self?.target?.dismissKeyboard() })
    }

    required init?(coder: NSCoder) { fatalError() }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: 56)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // CAGradientLayer doesn't auto-resize with its hosting
        // UIView; pin its frame to the view's bounds on each
        // layout pass. Disable implicit animations so the fade
        // doesn't slide during rotation / keyboard show.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        leftFadeLayer.frame = leftFade.bounds
        rightFadeLayer.frame = rightFade.bounds
        CATransaction.commit()
        updateFades()
    }

    // MARK: - UIScrollViewDelegate

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        updateFades()
    }

    /// Show/hide the leading & trailing fade overlays based on
    /// scroll position. Each fade ramps from 0 → 1 over the first
    /// 20pt of available scroll distance, so it appears gracefully
    /// instead of snapping in.
    private func updateFades() {
        let x = scroll.contentOffset.x + scroll.contentInset.left
        let maxX = scroll.contentSize.width - scroll.bounds.width + scroll.contentInset.right
        let ramp: CGFloat = 20
        leftFade.alpha = min(1, max(0, x / ramp))
        let remaining = max(0, maxX - scroll.contentOffset.x)
        rightFade.alpha = min(1, max(0, remaining / ramp))
    }

    func setDictating(_ active: Bool) {
        dictButton?.setImage(UIImage(systemName: active ? "mic.fill" : "mic"), for: .normal)
        dictButton?.tintColor = active
            ? UIColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1)
            : UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1)
    }

    private func button(systemName: String,
                        tint: UIColor = UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1),
                        action: @escaping () -> Void) -> UIButton {
        let b = UIButton(type: .system)
        b.setImage(UIImage(systemName: systemName), for: .normal)
        b.tintColor = tint
        b.imageView?.contentMode = .scaleAspectFit
        b.widthAnchor.constraint(equalToConstant: 40).isActive = true
        b.heightAnchor.constraint(equalToConstant: 40).isActive = true
        b.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return b
    }
}

/// UITextView subclass that reports no intrinsic content height.
/// Default UITextView returns the content size, which makes
/// SwiftUI shrink the view to a single-line strip when the text
/// is empty — collapsing the tap area below the cursor. Returning
/// noIntrinsicMetric lets SwiftUI's frame system size us to the
/// full available height of the parent (`.frame(maxHeight: .infinity)`).
final class FillingTextView: UITextView {
    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: UIView.noIntrinsicMetric)
    }
}
