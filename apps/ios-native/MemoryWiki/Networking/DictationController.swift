// DictationController — wraps SFSpeechRecognizer + AVAudioEngine
// for on-device speech-to-text in the Capture editor. Returns
// finalised utterances (not per-frame partials) so the draft
// doesn't flicker as the engine refines its guess.
//
// Locale strategy: takes a list of locale identifiers; tries them
// in order, falling back if a locale isn't installed on-device.
// Default call site passes ["ko-KR", "en-US"] which covers both
// of the founder's working languages.

import Foundation
import AVFoundation
import Speech

@MainActor
final class DictationController: ObservableObject {
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var lastFinalLength = 0
    private var onRecognise: ((String) -> Void)?
    private var onError: ((String) -> Void)?
    private var onStop: (() -> Void)?

    /// Begin a dictation session. The first available locale in
    /// `locales` is used; permissions are requested if needed.
    func start(locales: [String],
               onRecognise: @escaping (String) -> Void,
               onError: @escaping (String) -> Void,
               onStop: @escaping () -> Void) {
        self.onRecognise = onRecognise
        self.onError = onError
        self.onStop = onStop

        // Pick the first installed recognizer from the candidate
        // list. Falls back to the system default if none match.
        let candidates = locales.compactMap { id -> SFSpeechRecognizer? in
            let r = SFSpeechRecognizer(locale: Locale(identifier: id))
            return (r?.isAvailable ?? false) ? r : nil
        }
        recognizer = candidates.first ?? SFSpeechRecognizer()
        guard let recognizer, recognizer.isAvailable else {
            onError("Speech recognition is unavailable on this device.")
            return
        }

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                switch status {
                case .authorized:
                    self.requestMicAndRun()
                case .denied, .restricted, .notDetermined:
                    self.onError?("Enable Speech Recognition in iOS Settings → Memory.Wiki.")
                @unknown default:
                    self.onError?("Speech recognition not authorised.")
                }
            }
        }
    }

    func stop() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        onStop?()
        onStop = nil
    }

    // MARK: - Internals

    private func requestMicAndRun() {
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                guard let self else { return }
                if granted {
                    self.run()
                } else {
                    self.onError?("Enable Microphone in iOS Settings → Memory.Wiki.")
                }
            }
        }
    }

    private func run() {
        guard let recognizer else { return }

        // Audio session — record + measurement mode so iOS picks
        // the right mic and disables aggressive processing that
        // can chew up speech endpoints.
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            onError?("Mic setup failed: \(error.localizedDescription)")
            return
        }

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if #available(iOS 16.0, *) {
            req.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
            req.addsPunctuation = true
        }
        request = req

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buf, _ in
            self?.request?.append(buf)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            onError?("Couldn't start audio engine.")
            return
        }
        lastFinalLength = 0

        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                // Emit only the NEW tail beyond the last finalised
                // length so callers don't see repeats as the
                // engine refines partials.
                if result.isFinal {
                    let tail = String(text.dropFirst(self.lastFinalLength)).trimmingCharacters(in: .whitespaces)
                    if !tail.isEmpty {
                        DispatchQueue.main.async { self.onRecognise?(tail) }
                    }
                    self.lastFinalLength = text.count
                }
            }
            if let error {
                // Cancelled tasks throw .canceled — that's user
                // intent, not a real error worth surfacing.
                let ns = error as NSError
                if ns.code != 203 && ns.code != 209 {
                    DispatchQueue.main.async {
                        self.onError?("Dictation: \(error.localizedDescription)")
                    }
                }
            }
        }
    }
}
