// CaptureView — the multi-method capture surface.
//
// Apple Notes treats capture as "write a document." We treat it as
// "drop a memory" — text is one of several inputs, alongside URL
// paste, photo OCR, voice dictation, and (soon) file import.
// The mode picker just under the header surfaces those methods so
// the user doesn't have to guess; Write is the default.
//
// Header style stays consistent with MDs / Bundles / Settings /
// Start — large display "Capture" title at the top-left, optional
// char-count chip, and Cancel / Save controls on the right that
// only appear while there's content to save.

import SwiftUI
import UIKit
import ImageIO
import UniformTypeIdentifiers
import Speech
import AVFoundation

struct CaptureView: View {
    @EnvironmentObject private var router: AppRouter
    @State private var titleDraft = ""
    @State private var bodyDraft = ""
    @State private var saving = false
    @State private var savedURL: URL?
    @State private var errorMessage: String?
    @State private var clipboardURL: URL?
    @State private var showPhotoPicker = false
    @State private var showOCRPicker = false
    @State private var showURLSheet = false
    @State private var showImportSheet = false
    /// Discriminator for transient banners so each capture surface
    /// gets its own icon + tint instead of every toast looking the
    /// same. Errors carry a distinct red treatment so a failure
    /// reads as a failure at a glance.
    enum ToastKind {
        case photo, ocr, voice, urlImport, fileImport, success, error, info

        var icon: String {
            switch self {
            case .photo:      return "camera.fill"
            case .ocr:        return "text.viewfinder"
            case .voice:      return "mic.fill"
            case .urlImport:  return "link"
            case .fileImport: return "tray.and.arrow.down.fill"
            case .success:    return "checkmark.circle.fill"
            case .error:      return "exclamationmark.triangle.fill"
            case .info:       return "info.circle.fill"
            }
        }
    }
    struct Toast: Equatable {
        var message: String
        var kind: ToastKind
    }
    @State private var ocrBanner: Toast? = nil
    @State private var ocrBannerDismissTask: Task<Void, Never>? = nil
    /// Sticky progress indicator for long-running flows (photo
    /// resize + upload, URL import, file import). Title is the
    /// stage label, detail is an optional size / page / count
    /// substring. Set to nil when the work completes or errors.
    struct ProcessingStatus: Equatable {
        var title: String
        var detail: String? = nil
    }
    @State private var processing: ProcessingStatus? = nil
    /// OCR text awaiting user confirmation — shown in a preview
    /// chip with Insert / Discard so the user can read what was
    /// recognised before it lands in the body draft.
    @State private var pendingOCR: String? = nil
    /// Set when dictation reports a permission-denial error so an
    /// alert with an Open Settings deeplink can offer a one-tap
    /// fix instead of just toasting the failure.
    @State private var permissionAlertShown: Bool = false
    @State private var permissionAlertMessage: String = ""
    /// Engine's running best-guess transcript while dictating —
    /// shown in the DictationBanner so the user can see what's
    /// being heard before any of it is committed to the draft.
    @State private var dictationInterim: String = ""
    /// Uploaded photo attachments — accumulate visually as a
    /// thumbnail strip so the user can SEE what they've added.
    /// Raw markdown is generated at save time.
    struct PhotoAttachment: Identifiable {
        let id = UUID()
        let url: URL
        let thumbnail: UIImage
    }
    @State private var attachments: [PhotoAttachment] = []
    @State private var uploadInProgress = false
    enum CaptureField { case title, body }
    @FocusState private var focused: CaptureField?
    /// Mirror of @FocusState for the body field, which is a
    /// UIViewRepresentable (MarkdownEditor) — @FocusState ignores
    /// writes that don't match a SwiftUI `.focused()` modifier in
    /// the hierarchy, so setting `focused = .body` was being
    /// silently dropped. This @State Bool, driven by the editor's
    /// onFocusChange callback, is what the header + overlay logic
    /// actually reads to decide "is the body editing right now."
    @State private var bodyFocused: Bool = false
    /// Single source of truth for "any field has the keyboard" —
    /// title via @FocusState, body via the bridge above.
    private var anyFocused: Bool { focused != nil || bodyFocused }
    @State private var keyboardUp = false
    /// Live keyboard height (0 when down). Used to position our
    /// custom pill bar as a SwiftUI overlay just above the keyboard
    /// so we control spacing + horizontal insets — the system
    /// `.toolbar(.keyboard)` placement caps the bar's chrome and
    /// clips our content.
    @State private var keyboardHeight: CGFloat = 0

    @AppStorage("mw.draft.title") private var persistedTitle: String = ""
    @AppStorage("mw.draft.body") private var persistedBody: String = ""
    /// User-controlled dictation language list (comma-separated
    /// BCP-47 identifiers). Defaults to ko-KR + en-US — Settings →
    /// Voice → Dictation language lets the user pick any locale
    /// SFSpeechRecognizer supports on this device.
    @AppStorage("mw.dictationLocales") private var dictationLocales: String = "ko-KR,en-US"
    @State private var restorableTitle: String? = nil
    @State private var restorableBody: String? = nil
    @State private var dictation = DictationController()
    @State private var isDictating = false

    private var combinedMarkdown: String {
        let t = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let b = bodyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let photoLines = attachments.map { "![Photo](\($0.url.absoluteString))" }.joined(separator: "\n\n")
        var parts: [String] = []
        if !t.isEmpty { parts.append("# \(t)") }
        if !b.isEmpty { parts.append(b) }
        if !photoLines.isEmpty { parts.append(photoLines) }
        return parts.joined(separator: "\n\n")
    }
    private var hasDraftContent: Bool {
        !titleDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !bodyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !attachments.isEmpty
    }
    private var canSave: Bool {
        !saving && savedURL == nil && hasDraftContent
    }
    private var hasRestorable: Bool {
        (restorableTitle?.isEmpty == false) || (restorableBody?.isEmpty == false)
    }
    private var charCount: Int { combinedMarkdown.count }

    var body: some View {
        ZStack(alignment: .bottom) {
            Brand.background.ignoresSafeArea()
            // Backdrop blob only when the surface is truly idle —
            // not while focused, since the user's about to type
            // and the blob fading out mid-keystroke felt off.
            //
            // ALSO gated on `router.selectedTab == .capture`:
            // each AnimatedBlob spins a full WKWebView running an
            // SVG <animate> loop on the GPU forever. Keep-mounted
            // tabs meant this blob kept burning cycles even when
            // the user was on MDs/Bundles/etc — a measurable
            // contributor to the phone-gets-hot complaint.
            if router.selectedTab == .capture
                && !anyFocused
                && !hasDraftContent
                && clipboardURL == nil
                && !hasRestorable
                && savedURL == nil {
                AmbientBlob()
            }
            VStack(spacing: 0) {
                header
                if !hasDraftContent && !keyboardUp {
                    modePicker
                        .transition(.opacity)
                }
                chipsArea
                titleField
                bodyField
                if isDictating {
                    DictationBanner(interim: dictationInterim) { stopDictation() }
                        .padding(.horizontal, 14)
                        // Keyboard up: 24pt above keyboard. Keyboard
                        // down: 80pt so the banner sits clear of
                        // the floating tab bar (previously the
                        // banner slid behind the tab bar's blur
                        // strip when dictating with the keyboard
                        // dismissed).
                        .padding(.bottom, keyboardUp ? 24 : 80)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                if let processing {
                    ProcessingBanner(status: processing)
                        .padding(.horizontal, 14)
                        // Same conditional as DictationBanner — sit
                        // above the keyboard when it's up, sit above
                        // the floating tab bar otherwise.
                        .padding(.bottom, keyboardUp ? 24 : 80)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                } else if let ocrBanner {
                    OcrResultChip(toast: ocrBanner) { self.ocrBanner = nil }
                        .padding(.horizontal, 14)
                        .padding(.bottom, keyboardUp ? 24 : 80)
                }
                // Error surfaces via showBanner / ProcessingBanner —
                // a duplicate red strip down here just doubled the
                // same message. State variable is still kept for any
                // callers that introspect it.
            }
            // The body field's MarkdownEditor attaches its own
            // UIKit inputAccessoryView — no SwiftUI overlay needed
            // here.
        }
        .onAppear { onAppearEffects() }
        .onChange(of: focused) { _, isFocused in
            if isFocused != nil { refreshClipboard() }
        }
        .onChange(of: bodyFocused) { _, isFocused in
            if isFocused { refreshClipboard() }
        }
        .onChange(of: titleDraft) { _, new in persistedTitle = new }
        .onChange(of: bodyDraft) { _, new in persistedBody = new }
        .onReceive(NotificationCenter.default.publisher(for: .mwCapturePaste)) { _ in
            // Widget "Paste" shortcut — refresh clipboard and
            // bring the clipboard suggestion chip into view by
            // making sure we're not focused on a field.
            refreshClipboard()
            if let text = UIPasteboard.general.string, clipboardURL == nil {
                // Plain-text clipboard → seed body draft directly.
                bodyDraft = bodyDraft.isEmpty ? text : "\(bodyDraft)\n\n\(text)"
                focused = .body
                bodyFocused = true
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { notif in
            let h = (notif.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect)?.height ?? 0
            withAnimation(.snappy(duration: 0.22)) {
                keyboardUp = true
                keyboardHeight = h
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.snappy(duration: 0.22)) {
                keyboardUp = false
                keyboardHeight = 0
            }
        }
        .sheet(isPresented: $showPhotoPicker) {
            // Photo mode → upload original image, attach as thumbnail.
            // No OCR; sheet shows "Attach a photo" copy.
            PhotoCaptureSheet(isPresented: $showPhotoPicker, mode: .photo) { _, image in
                Task { await uploadPhoto(image) }
            }
            .iOS26Sheet([.medium])
        }
        .sheet(isPresented: $showOCRPicker) {
            // OCR mode → run Vision text recognition, surface a
            // preview chip before committing the text. The sheet
            // shows "Scan text from image" copy.
            PhotoCaptureSheet(isPresented: $showOCRPicker, mode: .ocr) { ocrText, _ in
                let clean = ocrText.trimmingCharacters(in: .whitespacesAndNewlines)
                if clean.isEmpty {
                    showBanner("No text recognised in this image.", .ocr)
                } else {
                    // Stash the recognised text in a preview chip so
                    // the user can confirm before it lands in the
                    // body. Tap Insert → appended; tap Discard →
                    // gone. Was previously auto-committed with no
                    // chance to review.
                    pendingOCR = clean
                    Haptics.success()
                }
            }
            .iOS26Sheet([.medium])
        }
        .sheet(isPresented: $showURLSheet) {
            URLImportSheet(isPresented: $showURLSheet) { url in
                Task { await saveURL(url) }
            }
            .iOS26Sheet([.medium])
        }
        .alert("Permission needed", isPresented: $permissionAlertShown) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Not now", role: .cancel) { }
        } message: {
            Text(permissionAlertMessage)
        }
        .sheet(isPresented: $showImportSheet) {
            ImportInfoSheet(isPresented: $showImportSheet) { url, data, contentType in
                let name = url.lastPathComponent
                Task { await importPickedFile(data: data, name: name, contentType: contentType) }
            }
            .iOS26Sheet([.medium, .large])
        }
    }

    // MARK: - Header (tab-consistent)

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("Capture")
                .font(Brand.display(size: 26))
                .foregroundStyle(Brand.textPrimary)
            if hasDraftContent {
                Text("\(charCount)")
                    .font(Brand.mono(size: 11))
                    .foregroundStyle(Brand.textFaint)
            }
            Spacer()
            if hasDraftContent || anyFocused {
                HStack(spacing: 8) {
                    Button {
                        Haptics.tap()
                        focused = nil
                        bodyFocused = false
                        if hasDraftContent {
                            restorableTitle = titleDraft
                            restorableBody = bodyDraft
                        }
                        titleDraft = ""
                        bodyDraft = ""
                    } label: {
                        Text("Cancel")
                            .font(Brand.body(size: 13, weight: .medium))
                            .foregroundStyle(Brand.textMuted)
                    }
                    .buttonStyle(.plain)
                    Button {
                        Task { await saveDraft() }
                    } label: {
                        HStack(spacing: 5) {
                            if saving {
                                ProgressView().scaleEffect(0.55).tint(Brand.background)
                            } else {
                                Image(systemName: "arrow.up")
                                    .font(.system(size: 10, weight: .bold))
                            }
                            Text(saving ? "Saving" : "Save")
                                .font(Brand.body(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(canSave ? Brand.background : Brand.textFaint)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().fill(canSave ? Brand.textPrimary : Brand.surface))
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSave)
                }
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 12)
        .animation(.snappy(duration: 0.18), value: focused)
        .animation(.snappy(duration: 0.18), value: bodyFocused)
        .animation(.snappy(duration: 0.18), value: hasDraftContent)
    }

    // MARK: - Mode picker (capture methods)

    /// Row of capture-method pills shown when the editor is empty
    /// and the keyboard is down. Surfaces the non-write entry
    /// paths (URL paste, photo OCR, voice dictation, file import)
    /// so the user doesn't have to know the bottom action bar by
    /// heart — they're discoverable at the top of the surface.
    private var modePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ModePill(icon: "pencil", label: "Write", accent: Brand.textPrimary) {
                    Haptics.tap()
                    focused = .title
                }
                ModePill(icon: "link", label: "URL", accent: Brand.microInfo) {
                    Haptics.tap()
                    showURLSheet = true
                }
                ModePill(icon: "camera", label: "Photo", accent: Brand.microWarn) {
                    Haptics.tap()
                    showPhotoPicker = true
                }
                ModePill(icon: "text.viewfinder", label: "OCR", accent: Brand.microInfo) {
                    Haptics.tap()
                    showOCRPicker = true
                }
                ModePill(icon: isDictating ? "mic.fill" : "mic",
                         label: isDictating ? "Stop" : "Voice",
                         accent: isDictating ? Brand.microRed : Brand.textPrimary) {
                    if isDictating { stopDictation() } else { startDictation() }
                }
                ModePill(icon: "tray.and.arrow.down", label: "Import", accent: Brand.textMuted) {
                    Haptics.tap()
                    showImportSheet = true
                }
            }
            .padding(.horizontal, 18)
        }
        .padding(.bottom, 10)
    }

    // MARK: - Smart chips

    @ViewBuilder
    private var chipsArea: some View {
        if let ocr = pendingOCR {
            OcrPreviewChip(
                text: ocr,
                onInsert: {
                    if titleDraft.isEmpty {
                        titleDraft = "OCR · \(Date().formatted(date: .abbreviated, time: .shortened))"
                    }
                    bodyDraft = bodyDraft.isEmpty ? ocr : "\(bodyDraft)\n\n\(ocr)"
                    pendingOCR = nil
                    showBanner("Inserted \(ocr.count) characters from OCR.", .ocr)
                    Haptics.success()
                },
                onDiscard: {
                    pendingOCR = nil
                    Haptics.warning()
                }
            )
            .padding(.horizontal, 14)
            .padding(.top, 6)
        } else if hasRestorable && savedURL == nil {
            let preview = (restorableTitle?.isEmpty == false
                           ? restorableTitle!
                           : (restorableBody ?? ""))
            RestoreDraftChip(preview: preview) {
                titleDraft = restorableTitle ?? ""
                bodyDraft = restorableBody ?? ""
                restorableTitle = nil
                restorableBody = nil
            } onDismiss: {
                restorableTitle = nil
                restorableBody = nil
                persistedTitle = ""
                persistedBody = ""
            }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        } else if let url = clipboardURL, savedURL == nil {
            ClipboardChip(url: url, busy: saving) {
                Task { await saveURL(url) }
            } onDismiss: { clipboardURL = nil }
            .padding(.horizontal, 14)
            .padding(.top, 6)
        } else if let url = savedURL {
            SavedBanner(url: url, onView: {
                Haptics.selection()
                openSavedDocInApp(url: url)
            }, onDismiss: {
                savedURL = nil
                titleDraft = ""
                bodyDraft = ""
            })
            .padding(.horizontal, 14)
            .padding(.top, 6)
        }
    }

    // MARK: - Title field

    private var titleField: some View {
        TextField("",
                  text: $titleDraft,
                  prompt: Text("What's on your mind?")
                    .foregroundStyle(Brand.textFaint)
                    .font(Brand.display(size: 26)))
            .focused($focused, equals: .title)
            .font(Brand.display(size: 26))
            .foregroundStyle(Brand.textPrimary)
            .tint(Brand.microWarn)
            .submitLabel(.next)
            .onSubmit { focused = .body }
            .padding(.horizontal, 18)
            // Lift the title field off whichever chip lives in
            // chipsArea above it (Unsaved-draft / Clipboard /
            // Saved banner) — 4pt was kissing the chip's edge.
            .padding(.top, 14)
    }

    // MARK: - Body field

    /// Body field — UITextView wrapped via MarkdownEditor. The
    /// UITextView's inputAccessoryView pins our Notes-style pill
    /// flush against the keyboard top with zero gap — every SwiftUI
    /// path (.toolbar(.keyboard) / safeAreaInset / overlay+keyboard
    /// tracking) leaves a system-margin gutter. The FillingTextView
    /// subclass disables intrinsic-size hinting so SwiftUI stretches
    /// the editor to fill the bound height — that's what makes
    /// taps on empty space below the cursor actually focus the
    /// editor (previously the tap area collapsed to a single line).
    private var bodyField: some View {
        VStack(spacing: 0) {
            if !attachments.isEmpty {
                attachmentsStrip
            }
            MarkdownEditor(
                text: $bodyDraft,
                isFocused: bodyFocused,
                onFocusChange: { newFocus in
                    bodyFocused = newFocus
                    if newFocus { focused = nil }   // sibling fields lose focus
                },
                onPhoto: { showPhotoPicker = true },
                onOCR: { showOCRPicker = true },
                onStartDictation: { startDictation() },
                onStopDictation: { stopDictation() },
                isDictating: isDictating
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // SwiftUI-level tap fallback for empty/blank-area taps.
            // UITextView naturally focuses on tap when it has text,
            // but when empty the tap can land outside its layout
            // manager's text region and never trigger first-responder.
            // `.simultaneousGesture` so this doesn't steal taps from
            // the UITextView (which needs them to position the cursor
            // when the field is non-empty).
            .contentShape(Rectangle())
            .simultaneousGesture(
                TapGesture().onEnded { bodyFocused = true }
            )
        }
        .frame(maxHeight: .infinity)
    }

    /// Horizontal rail of every formatting / media button. Rendered
    /// as a SwiftUI overlay anchored above the keyboard rect (see
    /// `body`), so we control inner padding + horizontal insets +
    /// vertical breathing room. The rail itself is a glass capsule
    /// for visual separation from the dark body area; horizontal
    /// scrolling kicks in only when the content exceeds available
    /// width.
    private var keyboardToolbarRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                kbButton("number") { insertBody("\n# ") }
                kbButton("bold") { wrap("**") }
                kbButton("italic") { wrap("*") }
                kbButton("list.bullet") { insertBody("\n- ") }
                kbButton("list.number") { insertBody("\n1. ") }
                kbButton("checkmark.square") { insertBody("\n- [ ] ") }
                kbButton("chevron.left.forwardslash.chevron.right") { insertBody("\n```\n\n```\n") }
                kbButton("link") { insertBody("[text](https://)") }
                kbButton("quote.bubble") { insertBody("\n> ") }
                // Visual divider before media + voice — distinct
                // from formatting tokens.
                Rectangle().fill(Brand.borderDim)
                    .frame(width: 1, height: 18)
                    .padding(.horizontal, 4)
                kbButton("camera", tint: Brand.microWarn) { showPhotoPicker = true }
                kbButton("text.viewfinder", tint: Brand.microInfo) { showOCRPicker = true }
                kbButton(isDictating ? "mic.fill" : "mic",
                         tint: isDictating ? Brand.microRed : Brand.textPrimary) {
                    if isDictating { stopDictation() } else { startDictation() }
                }
                kbButton("keyboard.chevron.compact.down", tint: Brand.textMuted) {
                    focused = nil
                }
            }
            .padding(.horizontal, 8)
        }
        .background(
            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(Capsule(style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .clipShape(Capsule(style: .continuous))
        // Pill margin from screen edges — keeps the rail clearly
        // distinct from the surrounding body field.
        .padding(.horizontal, 10)
    }

    @ViewBuilder
    private func kbButton(_ systemName: String,
                          tint: Color = Brand.textPrimary,
                          action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection()
            action()
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(tint)
                .frame(width: 38, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Horizontal strip of attached photos. Tap thumbnail to
    /// remove. Each thumbnail is the actual uploaded image, so
    /// the user SEES what they've attached instead of a raw
    /// markdown link in the body.
    private var attachmentsStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(attachments) { att in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: att.thumbnail)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 76, height: 76)
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .strokeBorder(Brand.borderDim, lineWidth: 1)
                            )
                        Button {
                            Haptics.tap()
                            attachments.removeAll { $0.id == att.id }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(.white, .black.opacity(0.7))
                                .padding(4)
                        }
                        .buttonStyle(.plain)
                    }
                }
                if uploadInProgress {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Brand.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .strokeBorder(Brand.borderDim, lineWidth: 1)
                            )
                        ProgressView().tint(Brand.textMuted)
                    }
                    .frame(width: 76, height: 76)
                }
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
        }
    }

    /// Apple Notes-style toolbar: single rounded glass pill with
    /// every formatting + media button. Photo / OCR / Voice are
    /// reachable from inside the writing flow (not just from the
    /// empty-state mode picker), so the user can add a photo or
    /// dictate a sentence without leaving the draft.
    ///
    /// Anchored via .ignoresSafeArea(.container, edges: .bottom)
    /// so the system bottom safe area (home indicator) doesn't
    /// re-introduce the gap between this pill and the keyboard.
    private var markdownToolbar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                mdButton("number") { insertBody("\n# ") }
                mdButton("bold") { wrap("**") }
                mdButton("italic") { wrap("*") }
                mdButton("list.bullet") { insertBody("\n- ") }
                mdButton("list.number") { insertBody("\n1. ") }
                mdButton("checkmark.square") { insertBody("\n- [ ] ") }
                mdButton("chevron.left.forwardslash.chevron.right") { insertBody("\n```\n\n```\n") }
                mdButton("link") { insertBody("[text](https://)") }
                mdButton("quote.bubble") { insertBody("\n> ") }
                mdButton("minus") { insertBody("\n\n---\n\n") }
                // Visual divider before media + voice — distinct
                // from formatting tokens.
                Rectangle().fill(Brand.borderDim)
                    .frame(width: 1, height: 18)
                    .padding(.horizontal, 4)
                mdButton("camera", tint: Brand.microWarn) {
                    showPhotoPicker = true
                }
                mdButton("text.viewfinder", tint: Brand.microInfo) {
                    showOCRPicker = true
                }
                mdButton(isDictating ? "mic.fill" : "mic",
                         tint: isDictating ? Brand.microRed : Brand.textPrimary) {
                    if isDictating { stopDictation() } else { startDictation() }
                }
                mdButton("keyboard.chevron.compact.down", tint: Brand.textMuted) {
                    focused = nil
                }
            }
            .padding(.horizontal, 6)
        }
        .background(
            Capsule(style: .continuous)
                .fill(Brand.surface)
                .overlay(Capsule(style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .padding(.horizontal, 10)
        // No bottom padding — pill should sit flush above the
        // keyboard's suggestion bar.
        .padding(.bottom, 0)
        // Ignore the container's bottom safe area so the system
        // home-indicator inset doesn't push the pill UP and leave
        // a black gap below it. The keyboard itself covers the
        // home-indicator area when up.
        .ignoresSafeArea(.container, edges: .bottom)
    }

    @ViewBuilder
    private func mdButton(_ systemName: String,
                          tint: Color = Brand.textPrimary,
                          action: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection()
            action()
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(tint)
                // Notes button cell: square-ish, ample tap area,
                // no fill (the pill background handles framing).
                .frame(width: 40, height: 36)
        }
        .buttonStyle(.plain)
    }

    private func insertBody(_ scaffold: String) {
        if focused == .title { focused = .body }
        bodyDraft += scaffold
    }
    private func wrap(_ token: String) {
        if focused == .title {
            titleDraft += "\(token)\(token)"
        } else {
            bodyDraft += "\(token)\(token)"
        }
    }

    // MARK: - Lifecycle / save

    private func refreshClipboard() {
        let pb = UIPasteboard.general
        guard pb.hasURLs, let url = pb.url else { clipboardURL = nil; return }
        if savedURL?.absoluteString == url.absoluteString {
            clipboardURL = nil
        } else {
            clipboardURL = url
        }
    }

    private func onAppearEffects() {
        let prefillKey = "mw.intent.captureText"
        if let prefill = UserDefaults.standard.string(forKey: prefillKey), !prefill.isEmpty {
            bodyDraft = prefill
            UserDefaults.standard.removeObject(forKey: prefillKey)
        }
        if (!persistedTitle.isEmpty || !persistedBody.isEmpty)
            && !hasDraftContent {
            restorableTitle = persistedTitle.isEmpty ? nil : persistedTitle
            restorableBody = persistedBody.isEmpty ? nil : persistedBody
        }
        refreshClipboard()
    }

    private func saveDraft() async {
        let md = combinedMarkdown.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !md.isEmpty else { return }
        let titleHint = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        await run {
            let doc = try await APIClient.shared.createDocument(
                markdown: md,
                title: titleHint.isEmpty ? nil : titleHint
            )
            savedURL = doc.publicURL
            titleDraft = ""
            bodyDraft = ""
            persistedTitle = ""
            persistedBody = ""
            restorableTitle = nil
            restorableBody = nil
            focused = nil
            Haptics.success()
        }
    }

    /// Imports a URL via the SSE pipeline on `/api/import/url`.
    /// Branches server-side: YouTube → oEmbed + transcript; general
    /// web → HTML → Turndown → MD with images rehosted. Stage labels
    /// from the SSE stream flow into the sticky `processing` banner
    /// so the user sees exactly which step is running ("Fetching
    /// page", "Rehosting images", "Saving doc") instead of a single
    /// opaque spinner that could mean anything.
    private func saveURL(_ url: URL) async {
        withAnimation(.snappy) {
            processing = ProcessingStatus(title: "Starting import", detail: url.host)
        }
        do {
            let docURL = try await APIClient.shared.importURL(url) { stage in
                Task { @MainActor in
                    withAnimation(.snappy) {
                        processing = ProcessingStatus(title: stage, detail: url.host)
                    }
                }
            }
            savedURL = docURL
            clipboardURL = nil
            withAnimation(.snappy) { processing = nil }
            Haptics.success()
        } catch {
            withAnimation(.snappy) { processing = nil }
            errorMessage = error.localizedDescription
            showBanner("URL import failed: \(error.localizedDescription)", .error)
            Haptics.warning()
        }
    }

    private func run(_ action: @escaping () async throws -> Void) async {
        saving = true
        errorMessage = nil
        defer { saving = false }
        do { try await action() }
        catch { errorMessage = error.localizedDescription }
    }

    /// Open the saved doc inside the app — pushes DocumentDetailView
    /// onto the MDs tab's nav stack and switches tabs. Beats the
    /// previous "open in Safari" behaviour which dropped users out
    /// of the app right after saving.
    private func openSavedDocInApp(url: URL) {
        let id = url.lastPathComponent
        router.selectedTab = .timeline
        router.timelinePath = [.docDetailById(id)]
        // Clear the SavedBanner so coming back to Capture is a
        // fresh canvas.
        savedURL = nil
    }

    private func startDictation() {
        Haptics.tap()
        // Pre-check authorization so a previously-denied permission
        // immediately shows the Open-Settings alert instead of the
        // start() call silently no-op'ing (iOS doesn't re-prompt
        // after a denial; requestAuthorization just returns the
        // denied status with no UI).
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        let micStatus = AVAudioApplication.shared.recordPermission
        if speechStatus == .denied || speechStatus == .restricted {
            permissionAlertMessage = "Enable Speech Recognition in iOS Settings → Memory.Wiki to dictate notes."
            permissionAlertShown = true
            return
        }
        if micStatus == .denied {
            permissionAlertMessage = "Enable Microphone in iOS Settings → Memory.Wiki to dictate notes."
            permissionAlertShown = true
            return
        }
        // Don't drop focus — the new MarkdownEditor inputAccessoryView
        // stays attached while keyboard is up, so dictating in-place
        // is fine + the LISTENING banner overlays cleanly.
        let locales = dictationLocales
            .split(separator: ",")
            .map { String($0).trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        dictation.start(
            locales: locales.isEmpty ? ["en-US"] : locales,
            onRecognise: { recognised in
                bodyDraft += bodyDraft.isEmpty ? recognised : " " + recognised
                dictationInterim = ""
                showBanner("Heard: \"\(recognised.prefix(40))\"", .voice)
            },
            onInterim: { interim in
                dictationInterim = interim
            },
            onError: { msg in
                errorMessage = msg
                // Permission-denial paths surface "Enable … in iOS
                // Settings" strings — offer a direct Settings
                // deeplink alert so the user doesn't have to
                // context-switch and hunt manually.
                if msg.lowercased().contains("settings") {
                    permissionAlertMessage = msg
                    permissionAlertShown = true
                } else {
                    showBanner("Voice: \(msg)", .error)
                }
                dictationInterim = ""
                withAnimation(.snappy) { isDictating = false }
            },
            onStop: {
                dictationInterim = ""
                withAnimation(.snappy) { isDictating = false }
            }
        )
        withAnimation(.snappy) { isDictating = true }
    }

    private func stopDictation() {
        Haptics.tap()
        dictation.stop()
        dictationInterim = ""
        withAnimation(.snappy) { isDictating = false }
    }

    /// Uploads a captured photo. The image lands in `attachments`
    /// as a visual thumbnail (NOT raw markdown in the body) so
    /// the user sees what they've added. The `![Photo](url)`
    /// markdown is appended at save time via combinedMarkdown.
    ///
    /// Hard upload ceiling — Vercel's serverless function body
    /// cap on App Router is 4.5 MB regardless of our own
    /// MAX_FILE_SIZE check, so we have to land BELOW that in the
    /// request body itself or the platform rejects with
    /// FUNCTION_PAYLOAD_TOO_LARGE before our code runs. 3.5 MB
    /// gives multipart envelope overhead enough headroom.
    private static let uploadByteCeiling = 3_500_000

    /// iPhone HEIC / Live Photos come back massive (often 8-15 MB).
    /// Pipeline:
    ///   1. Resize so the longer edge ≤ 1600pt (~2.5 MP — plenty
    ///      for retina viewing on phone + desktop).
    ///   2. Encode as WebP at quality 0.75 (sharp re-encodes server-
    ///      side too but a lean payload makes the round trip).
    ///   3. If still over the ceiling, downsize / drop quality
    ///      iteratively until it fits.
    /// Falls back to JPEG if WebP encoding fails on some odd
    /// input (shouldn't happen on iOS 14+ but better than dying).
    private func uploadPhoto(_ image: UIImage) async {
        withAnimation(.snappy) {
            processing = ProcessingStatus(title: "Resizing photo", detail: "compressing for upload")
        }
        guard let (data, contentType, ext) = await prepareUploadPayload(image) else {
            withAnimation(.snappy) { processing = nil }
            showBanner("Couldn't compress the photo small enough to upload.", .error)
            return
        }
        withAnimation(.snappy) {
            processing = ProcessingStatus(title: "Uploading photo", detail: humanBytes(data.count))
        }
        uploadInProgress = true
        defer { uploadInProgress = false }
        Haptics.tap()
        do {
            let url = try await APIClient.shared.uploadImage(data: data, contentType: contentType, fileExtension: ext)
            attachments.append(PhotoAttachment(url: url, thumbnail: image))
            if titleDraft.isEmpty {
                titleDraft = "Photo · \(Date().formatted(date: .abbreviated, time: .shortened))"
            }
            withAnimation(.snappy) { processing = nil }
            showBanner("Photo added (\(humanBytes(data.count))).", .photo)
            Haptics.success()
        } catch {
            withAnimation(.snappy) { processing = nil }
            showBanner("Upload failed: \(error.localizedDescription)", .error)
            Haptics.warning()
        }
    }

    /// Try a sequence of (edge, quality) pairs until the encoded
    /// bytes fit under `softTarget` (then `uploadByteCeiling` as
    /// the absolute floor). Default starts at 1280pt @ WebP 0.70 —
    /// retina-sharp on every iPhone/iPad and typically lands under
    /// 500 KB for normal photos (vs. ~1.5 MB at 1600pt @ 0.75).
    /// Tries WebP first; only falls back to JPEG if ImageIO can't
    /// write WebP at all for this image.
    private func prepareUploadPayload(_ image: UIImage) async -> (Data, String, String)? {
        // First pair that produces ≤ softTarget bytes wins. If no
        // pair clears softTarget but the smallest clears ceiling,
        // ship that. Anything still above ceiling = nil → upload
        // refused before it leaves the device.
        // WebP @ 0.5 is visually clean for photos at viewing
        // sizes — most native-camera shots land 250-400 KB.
        let softTarget = 500_000          // 500 KB sweet spot
        let attempts: [(edge: CGFloat, q: CGFloat)] = [
            (1280, 0.50),
            (1024, 0.45),
            (900,  0.40),
            (800,  0.35),
            (640,  0.30)
        ]
        var lastWebP: Data? = nil
        for attempt in attempts {
            let prepped = resizeForUpload(image, maxEdge: attempt.edge)
            if let webp = prepped.webpData(quality: attempt.q) {
                lastWebP = webp
                if webp.count <= softTarget {
                    return (webp, "image/webp", "webp")
                }
            }
        }
        // Soft target unreachable — accept the smallest result we
        // got if it at least clears the absolute platform ceiling.
        if let webp = lastWebP, webp.count <= Self.uploadByteCeiling {
            return (webp, "image/webp", "webp")
        }
        // WebP encoder unavailable — drop back to JPEG with the
        // same ladder. Same two-tier acceptance (softTarget first,
        // ceiling as last resort).
        var lastJPEG: Data? = nil
        for attempt in attempts {
            let prepped = resizeForUpload(image, maxEdge: attempt.edge)
            if let jpeg = prepped.jpegData(compressionQuality: attempt.q) {
                lastJPEG = jpeg
                if jpeg.count <= softTarget {
                    return (jpeg, "image/jpeg", "jpg")
                }
            }
        }
        if let jpeg = lastJPEG, jpeg.count <= Self.uploadByteCeiling {
            return (jpeg, "image/jpeg", "jpg")
        }
        return nil
    }

    /// Scale `image` so the longer edge is at most `maxEdge` points
    /// (preserving aspect ratio). Returns the original if it's
    /// already within bounds.
    private func resizeForUpload(_ image: UIImage, maxEdge: CGFloat) -> UIImage {
        let w = image.size.width, h = image.size.height
        let longer = max(w, h)
        guard longer > maxEdge else { return image }
        let scale = maxEdge / longer
        let target = CGSize(width: w * scale, height: h * scale)
        let renderer = UIGraphicsImageRenderer(size: target)
        return renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
    }

    /// Short human size — used in the "Photo added (X)" toast so
    /// the user can sanity-check the upload was actually compact.
    private func humanBytes(_ count: Int) -> String {
        let kb = Double(count) / 1024
        if kb < 1024 { return String(format: "%.0f KB", kb) }
        return String(format: "%.1f MB", kb / 1024)
    }

    /// Imports a user-picked file (PDF/DOCX/PPTX/XLSX/MD/TXT) by
    /// POSTing to the right web endpoint in save mode. On success
    /// we drop a SavedBanner so the user can View the new doc.
    private func importPickedFile(data: Data, name: String, contentType: String) async {
        // PDF / DOCX parsing on the web side can take 5-20 seconds
        // depending on file size — the user needs to see that we
        // ARE working on it, not just a frozen UI. The sticky
        // banner stays up until the server returns or errors.
        withAnimation(.snappy) {
            processing = ProcessingStatus(
                title: "Importing \(name)",
                detail: humanBytes(data.count)
            )
        }
        Haptics.tap()
        do {
            let url = try await APIClient.shared.importFile(data: data, filename: name, contentType: contentType)
            savedURL = url
            withAnimation(.snappy) { processing = nil }
            showBanner("Imported. Tap View to open.", .fileImport)
            Haptics.success()
        } catch {
            withAnimation(.snappy) { processing = nil }
            showBanner("Import failed: \(error.localizedDescription)", .error)
            Haptics.warning()
        }
    }

    /// Surface a short-lived status banner that auto-dismisses
    /// after 2.5 s. Cancels any prior pending dismissal so back-
    /// to-back messages don't disappear early.
    /// Surface a short-lived status banner (kind drives the icon
    /// + colour treatment so e.g. errors don't blend in with
    /// successes). Auto-dismisses after 2.5 s — errors get 4.5 s
    /// because the user needs longer to read a failure.
    private func showBanner(_ message: String, _ kind: ToastKind = .info) {
        let toast = Toast(message: message, kind: kind)
        ocrBanner = toast
        ocrBannerDismissTask?.cancel()
        let lifetime: UInt64 = kind == .error ? 4_500_000_000 : 2_500_000_000
        ocrBannerDismissTask = Task { [toast] in
            try? await Task.sleep(nanoseconds: lifetime)
            if Task.isCancelled { return }
            await MainActor.run {
                if ocrBanner == toast { ocrBanner = nil }
            }
        }
    }
}

// MARK: - Pieces

struct AmbientBlob: View {
    var body: some View {
        GeometryReader { proxy in
            let dim = max(proxy.size.width, proxy.size.height) * 0.95
            AnimatedBlob(size: dim, theme: .dark)
                .opacity(0.045)
                .blur(radius: 12)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .center)
        }
        .ignoresSafeArea(.all)
        .allowsHitTesting(false)
    }
}

/// Capture-mode pill — icon + label on a quiet glass surface, with
/// the icon tinted in the relevant micro-color so the row reads
/// at a glance.
private struct ModePill: View {
    let icon: String
    let label: LocalizedStringKey
    let accent: Color
    var onTap: () -> Void
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(accent)
                Text(label)
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(Brand.surface)
                    .overlay(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }
}

/// URL paste sheet — explicit URL entry for the "Save a link" path.
/// Validates input, derives a host title. Auto-fills if the
/// clipboard currently holds a URL (one-tap "Use clipboard URL"
/// affordance instead of asking the user to paste manually).
private struct URLImportSheet: View {
    @Binding var isPresented: Bool
    var onSubmit: (URL) -> Void
    @State private var input = ""
    @State private var clipboardURL: URL? = nil
    @FocusState private var fieldFocus: Bool
    private var parsedURL: URL? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let withScheme = trimmed.lowercased().hasPrefix("http") ? trimmed : "https://\(trimmed)"
        return URL(string: withScheme)
    }
    var body: some View {
        NavigationStack {
            ZStack {
                // No opaque fill — the sheet container is glass via
                // .iOS26Sheet(), and Brand.background here would
                // cover it.
                VStack(alignment: .leading, spacing: 14) {
                    Text("Save a link")
                        .font(Brand.display(size: 22))
                        .foregroundStyle(Brand.textPrimary)
                    // Honest copy: this drops the link as a memory.
                    // Page enrichment (title scrape, summary) happens
                    // when you open it on memory.wiki — not on the
                    // device. Previously this read "auto-fetched and
                    // indexed," which overpromised the result.
                    Text("Fetches the page, converts it to markdown (text + images), and saves as a new memory. Works for web pages, YouTube videos, and most public URLs.")
                        .font(Brand.body(size: 13))
                        .foregroundStyle(Brand.textMuted)
                        .lineSpacing(3)
                    if let clip = clipboardURL, input.isEmpty {
                        Button {
                            input = clip.absoluteString
                            Haptics.selection()
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "doc.on.clipboard")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Brand.microInfo)
                                Text("Use clipboard URL")
                                    .font(Brand.body(size: 12, weight: .medium))
                                    .foregroundStyle(Brand.textPrimary)
                                Text(clip.host ?? clip.absoluteString)
                                    .font(Brand.mono(size: 11))
                                    .foregroundStyle(Brand.textFaint)
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Spacer()
                                Image(systemName: "arrow.right")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(Brand.textFaint)
                            }
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(Brand.surface)
                                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    TextField("https://…", text: $input)
                        .focused($fieldFocus)
                        .font(Brand.mono(size: 14))
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 14).padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Brand.surface)
                                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                        )
                        .submitLabel(.go)
                        .onSubmit {
                            if let url = parsedURL { onSubmit(url); isPresented = false }
                        }
                    // Inline validation hint — visible only when the
                    // user has typed something that doesn't parse as
                    // a URL. Save button stays disabled either way.
                    if !input.isEmpty && parsedURL == nil {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle")
                                .font(.system(size: 11))
                                .foregroundStyle(Brand.microWarn)
                            Text("That doesn't look like a valid URL.")
                                .font(Brand.body(size: 12))
                                .foregroundStyle(Brand.textMuted)
                        }
                    }
                    Button {
                        if let url = parsedURL { onSubmit(url); isPresented = false }
                    } label: {
                        Text("Save link")
                            .font(Brand.body(size: 15, weight: .semibold))
                            .foregroundStyle(parsedURL == nil ? Brand.textFaint : Brand.background)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(parsedURL == nil ? Brand.surface : Brand.textPrimary)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(parsedURL == nil)
                    Spacer()
                }
                .padding(.horizontal, 22)
                .padding(.top, 22)
            }
            .navigationTitle("URL")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { isPresented = false }
                        .foregroundStyle(Brand.textMuted)
                }
            }
            .toolbarBackground(Brand.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .onAppear {
            fieldFocus = true
            // Sniff the clipboard ONCE on appear so the suggestion
            // chip is immediately offered if relevant — saves a
            // paste round-trip. UIPasteboard.hasURLs is a privacy-
            // friendly check that doesn't read the contents.
            if UIPasteboard.general.hasURLs, let u = UIPasteboard.general.url {
                clipboardURL = u
            }
        }
    }
}

/// Import sheet — primary action is the iOS file picker (PDF /
/// Office / Markdown / TXT). Rows below explain the other
/// channels with tap-through links to the relevant detail
/// pages on memory.wiki.
private struct ImportInfoSheet: View {
    @Binding var isPresented: Bool
    var onPickedFile: (URL, Data, String) -> Void
    @State private var showPicker = false
    @State private var importingName: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                // Glass via .iOS26Sheet container — no opaque fill.
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Import")
                            .font(Brand.display(size: 22))
                            .foregroundStyle(Brand.textPrimary)
                        Text("Bring existing content into your hub. iOS turns any of these into a Memory.Wiki doc:")
                            .font(Brand.body(size: 13))
                            .foregroundStyle(Brand.textMuted)
                            .lineSpacing(3)

                        // Format chips — micro-coloured glyph per
                        // extension so the supported set reads at a
                        // glance instead of as a comma list. Reds for
                        // PDF, blues for Office, ink for plain text.
                        FormatChipsRow()
                            .padding(.bottom, 4)

                        // Primary affordance — file picker. No white
                        // fill (the rest of the app reserves Brand.
                        // textPrimary as accent on ink). Glass surface
                        // with a microInfo glyph + ink label reads
                        // as primary without going stark white.
                        Button {
                            Haptics.tap()
                            showPicker = true
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "doc.badge.plus")
                                    .font(.system(size: 16, weight: .regular))
                                    .foregroundStyle(Brand.microInfo)
                                Text(importingName.map { "Importing \($0)…" } ?? "Pick a file from iOS")
                                    .font(Brand.body(size: 14, weight: .semibold))
                                    .foregroundStyle(Brand.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(Brand.textFaint)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 14)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(.ultraThinMaterial)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .strokeBorder(Brand.microInfo.opacity(0.45), lineWidth: 1)
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(importingName != nil)

                        if let error {
                            Text(error)
                                .font(Brand.body(size: 12))
                                .foregroundStyle(Brand.microRed)
                                .padding(.horizontal, 4)
                        }

                        Text("OR USE A COMPANION CHANNEL")
                            .font(Brand.mono(size: 9, weight: .medium))
                            .tracking(1.2)
                            .foregroundStyle(Brand.textFaint)
                            .padding(.top, 12)
                            .padding(.bottom, 2)

                        ImportLinkRow(icon: "square.and.arrow.up",
                                      title: "iOS Share Sheet",
                                      detail: "From Safari, Notes, Mail, anywhere — tap Share → Memory.Wiki.",
                                      url: URL(string: "https://memory.wiki/install")!)
                        ImportLinkRow(icon: "globe",
                                      title: "Web upload (memory.wiki)",
                                      detail: "Drag PDF / Markdown / DOCX / TXT into the editor on memory.wiki.",
                                      url: URL(string: "https://memory.wiki/how")!)
                        ImportLinkRow(icon: "doc.text",
                                      title: "VS Code / Desktop / CLI / MCP",
                                      detail: "Capture from your editor or terminal — same hub.",
                                      url: URL(string: "https://memory.wiki/plugins")!)
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 22)
                    .padding(.bottom, 32)
                }
            }
            .navigationTitle("Import")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { isPresented = false }
                        .foregroundStyle(Brand.textMuted)
                }
            }
            .toolbarBackground(Brand.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
        }
        .fileImporter(
            isPresented: $showPicker,
            allowedContentTypes: [
                .pdf,
                .init(filenameExtension: "docx")!,
                .init(filenameExtension: "pptx")!,
                .init(filenameExtension: "xlsx")!,
                .plainText,
                .init(filenameExtension: "md") ?? .plainText,
                .init(filenameExtension: "markdown") ?? .plainText,
            ],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                Task { await pickedFile(url) }
            case .failure(let err):
                error = err.localizedDescription
            }
        }
    }

    private func pickedFile(_ url: URL) async {
        error = nil
        let filename = url.lastPathComponent
        importingName = filename
        defer { importingName = nil }
        // Need to start security-scoped access for file: URLs
        // returned by the document picker.
        let needsScope = url.startAccessingSecurityScopedResource()
        defer { if needsScope { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            let contentType = guessContentType(filename: filename)
            onPickedFile(url, data, contentType)
            isPresented = false
        } catch {
            self.error = "Couldn't read \(filename): \(error.localizedDescription)"
        }
    }

    private func guessContentType(filename: String) -> String {
        let lower = filename.lowercased()
        if lower.hasSuffix(".pdf") { return "application/pdf" }
        if lower.hasSuffix(".docx") { return "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
        if lower.hasSuffix(".pptx") { return "application/vnd.openxmlformats-officedocument.presentationml.presentation" }
        if lower.hasSuffix(".xlsx") { return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
        if lower.hasSuffix(".md") || lower.hasSuffix(".markdown") { return "text/markdown" }
        return "text/plain"
    }
}

/// Tappable row that opens a detail page on memory.wiki via
/// SwiftUI Link. Used by the Import sheet's companion-channel
/// section.
private struct ImportLinkRow: View {
    let icon: String
    let title: String
    let detail: String
    let url: URL
    var body: some View {
        Link(destination: url) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.textMuted)
                    .frame(width: 24, alignment: .leading)
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(Brand.body(size: 14, weight: .medium))
                        .foregroundStyle(Brand.textPrimary)
                    Text(detail)
                        .font(Brand.body(size: 12))
                        .foregroundStyle(Brand.textMuted)
                        .lineSpacing(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .padding(.top, 2)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Brand.surface)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
    }
}

/// Horizontal scroll of supported import formats — each chip is a
/// short uppercase label + micro-coloured glyph, grouped by
/// flavour: reds for PDF (Adobe), blues for Office (Microsoft),
/// muted ink for the plain-text family.
private struct FormatChipsRow: View {
    private struct Format: Identifiable {
        let id = UUID()
        let label: String
        let icon: String
        let tint: Color
    }
    private let formats: [Format] = [
        .init(label: "PDF",  icon: "doc.richtext",      tint: Brand.microRed),
        .init(label: "DOCX", icon: "doc.text",          tint: Brand.microInfo),
        .init(label: "PPTX", icon: "rectangle.on.rectangle", tint: Brand.microWarn),
        .init(label: "XLSX", icon: "tablecells",        tint: Brand.microInfo),
        .init(label: "MD",   icon: "number",            tint: Brand.textPrimary),
        .init(label: "TXT",  icon: "text.alignleft",    tint: Brand.textMuted)
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(formats) { f in
                    HStack(spacing: 6) {
                        Image(systemName: f.icon)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(f.tint)
                        Text(f.label)
                            .font(Brand.mono(size: 10, weight: .medium))
                            .tracking(0.8)
                            .foregroundStyle(Brand.textPrimary)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        Capsule()
                            .fill(Brand.surface)
                            .overlay(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
                    )
                }
            }
        }
    }
}

// MARK: - Chips

private struct RestoreDraftChip: View {
    let preview: String
    var onRestore: () -> Void
    var onDismiss: () -> Void
    private var oneLine: String {
        preview.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespaces)
    }
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "tray.and.arrow.up")
                .font(.system(size: 12)).foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 1) {
                Text("UNSAVED DRAFT")
                    .font(Brand.mono(size: 8, weight: .medium)).tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(oneLine)
                    .font(Brand.body(size: 12)).foregroundStyle(Brand.textPrimary)
                    .lineLimit(1).truncationMode(.tail)
            }
            Spacer(minLength: 8)
            Button(action: { Haptics.tap(); onRestore() }) {
                Text("Restore")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
            .buttonStyle(.plain)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

private struct DictationBanner: View {
    /// Engine's running best-guess. Updates as the user speaks;
    /// emptied each time a chunk is finalised and committed to
    /// the draft. Empty string = nothing to preview right now
    /// (just listening), so we hide the preview row entirely.
    var interim: String = ""
    var onStop: () -> Void
    @State private var pulse = false
    var body: some View {
        VStack(alignment: .leading, spacing: interim.isEmpty ? 0 : 8) {
            HStack(spacing: 10) {
                Circle()
                    .fill(Brand.microRed)
                    .frame(width: 8, height: 8)
                    .opacity(pulse ? 1 : 0.3)
                    .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
                    .onAppear { pulse = true }
                Text("LISTENING")
                    .font(Brand.mono(size: 9, weight: .medium)).tracking(1)
                    .foregroundStyle(Brand.textMuted)
                Text("Korean + English")
                    .font(Brand.body(size: 11)).foregroundStyle(Brand.textFaint)
                Spacer()
                Button(action: onStop) {
                    Text("Stop")
                        .font(Brand.body(size: 12, weight: .medium))
                        .foregroundStyle(Brand.textPrimary)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().strokeBorder(Brand.borderDim, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            if !interim.isEmpty {
                // Italicised partial transcript so the user can
                // verify what's being heard before it lands in
                // the draft body. The text is the rolling tail
                // — past committed chunks aren't repeated.
                Text(interim)
                    .font(Brand.body(size: 13, weight: .regular).italic())
                    .foregroundStyle(Brand.textMuted)
                    .lineLimit(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, interim.isEmpty ? 8 : 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .animation(.snappy(duration: 0.18), value: interim.isEmpty)
    }
}

/// Sticky progress chip — spinner + title + optional detail.
/// Owned by CaptureView, dismissed only when the long-running
/// task finishes or errors. Distinct from OcrResultChip (which is
/// transient) because the user must know that work is still in
/// flight for resize / upload / SSE-staged imports.
private struct ProcessingBanner: View {
    let status: CaptureView.ProcessingStatus
    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
                .scaleEffect(0.7)
                .tint(Brand.textPrimary)
                .frame(width: 22, height: 22)
            VStack(alignment: .leading, spacing: 2) {
                Text(status.title)
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.textPrimary)
                if let detail = status.detail, !detail.isEmpty {
                    Text(detail)
                        .font(Brand.mono(size: 10))
                        .foregroundStyle(Brand.textFaint)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            Spacer()
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

/// Transient banner. Icon, tint, and (for error) border colour
/// flow from the toast's kind so a successful photo upload doesn't
/// look like a failed URL import.
private struct OcrResultChip: View {
    let toast: CaptureView.Toast
    var onDismiss: () -> Void

    private var tint: Color {
        switch toast.kind {
        case .photo:      return Brand.microWarn
        case .ocr:        return Brand.microInfo
        case .voice:      return Brand.microInfo
        case .urlImport:  return Brand.microInfo
        case .fileImport: return Brand.microInfo
        case .success:    return Brand.microLime
        case .error:      return Brand.microRed
        case .info:       return Brand.textMuted
        }
    }
    private var borderColor: Color {
        toast.kind == .error ? Brand.microRed.opacity(0.55) : Brand.borderDim
    }
    private var fill: AnyShapeStyle {
        toast.kind == .error
            ? AnyShapeStyle(Brand.microRed.opacity(0.10))
            : AnyShapeStyle(Brand.surface)
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: toast.kind.icon)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(tint)
            Text(toast.message)
                .font(Brand.body(size: 12, weight: toast.kind == .error ? .semibold : .regular))
                .foregroundStyle(Brand.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(fill)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(borderColor, lineWidth: 1))
        )
    }
}

/// OCR-confirmation chip — shows the first few lines of the
/// recognised text plus a char count so the user can sanity-check
/// before it gets dumped into the body. Insert appends, Discard
/// throws away. Replaces the previous auto-insert behaviour.
private struct OcrPreviewChip: View {
    let text: String
    var onInsert: () -> Void
    var onDiscard: () -> Void

    private var preview: String {
        let lines = text.split(separator: "\n").prefix(3).joined(separator: " · ")
        return String(lines)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "text.viewfinder")
                    .font(.system(size: 11))
                    .foregroundStyle(Brand.microInfo)
                Text("RECOGNISED \(text.count) CHARS")
                    .font(Brand.mono(size: 9, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Spacer()
            }
            Text(preview)
                .font(Brand.body(size: 12))
                .foregroundStyle(Brand.textPrimary)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 8) {
                Button(action: onDiscard) {
                    Text("Discard")
                        .font(Brand.body(size: 12, weight: .medium))
                        .foregroundStyle(Brand.textMuted)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .fill(Brand.surface)
                                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
                        )
                }
                .buttonStyle(.plain)
                Button(action: onInsert) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.down.to.line.compact")
                            .font(.system(size: 10, weight: .semibold))
                        Text("Insert into body")
                            .font(Brand.body(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(Capsule().fill(Brand.textPrimary))
                }
                .buttonStyle(.plain)
                Spacer()
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

private struct ClipboardChip: View {
    let url: URL
    let busy: Bool
    var onSave: () -> Void
    var onDismiss: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "doc.on.clipboard")
                .font(.system(size: 12)).foregroundStyle(Brand.textFaint)
            VStack(alignment: .leading, spacing: 1) {
                Text("FROM CLIPBOARD")
                    .font(Brand.mono(size: 8, weight: .medium)).tracking(1)
                    .foregroundStyle(Brand.textFaint)
                Text(url.absoluteString)
                    .font(Brand.mono(size: 11)).foregroundStyle(Brand.textPrimary)
                    .lineLimit(1).truncationMode(.middle)
            }
            Spacer(minLength: 8)
            Button(action: onSave) {
                Text(busy ? "Saving…" : "Save")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
            .buttonStyle(.plain)
            .disabled(busy)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

/// Saved banner — confirmation card after a successful save. View
/// pushes the doc inside the app (MDs tab → DocumentDetailView)
/// instead of bouncing out to Safari.
private struct SavedBanner: View {
    let url: URL
    var onView: () -> Void
    var onDismiss: () -> Void
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.microLime)
            Text(url.absoluteString.replacingOccurrences(of: "https://", with: ""))
                .font(Brand.mono(size: 11)).foregroundStyle(Brand.textPrimary)
                .lineLimit(1).truncationMode(.middle)
            Spacer()
            Button(action: onView) {
                Text("View")
                    .font(Brand.body(size: 12, weight: .medium))
                    .foregroundStyle(Brand.background)
                    .padding(.horizontal, 12).padding(.vertical, 6)
                    .background(Capsule().fill(Brand.textPrimary))
            }
            .buttonStyle(.plain)
            ShareLink(item: url) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 12)).foregroundStyle(Brand.textFaint)
            }
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Brand.textFaint)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
    }
}

#Preview { CaptureView() }

private extension UIImage {
    /// Encode this UIImage as WebP using ImageIO's
    /// CGImageDestination + `UTType.webP` (iOS 14+). Returns nil
    /// if the platform doesn't have a WebP encoder registered
    /// (extremely unlikely on iOS 14+, but the caller falls back
    /// to JPEG if so).
    ///
    /// `quality` is the standard 0…1 ImageIO compression hint —
    /// 0.78 lands roughly between visually-lossless and noticeable
    /// banding for a 2048pt-edge photo.
    func webpData(quality: CGFloat) -> Data? {
        guard let cg = cgImage else { return nil }
        let buffer = NSMutableData()
        let utType = UTType.webP.identifier as CFString
        guard let dest = CGImageDestinationCreateWithData(buffer as CFMutableData, utType, 1, nil) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: quality
        ]
        CGImageDestinationAddImage(dest, cg, options as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { return nil }
        return buffer as Data
    }
}
