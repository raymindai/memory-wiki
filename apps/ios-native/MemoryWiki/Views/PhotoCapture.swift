// PhotoCapture — camera + photo-library bridge for the Capture
// tab. Two flavours via `Mode`:
//   .photo  → upload the original image, embed it as an attachment
//             thumbnail. No OCR.
//   .ocr    → run on-device Vision OCR, return only the extracted
//             text. Original image is not uploaded.
// The sheet adapts its title + guidance copy + secondary line to
// match the mode, so the user always knows what's about to happen.

import SwiftUI
import PhotosUI
import UIKit
import Vision

/// Two-button sheet — Camera or Photos — that returns the picked
/// image (and its OCR'd markdown) via a callback. Lives at the
/// CaptureView level; the sheet is the SwiftUI UI surface, the
/// underlying pickers are UIKit + PhotosUI.
struct PhotoCaptureSheet: View {
    /// Which behaviour this sheet performs. Title + copy + the
    /// returned tuple semantics all switch on this.
    enum Mode { case photo, ocr }

    @Binding var isPresented: Bool
    var mode: Mode = .ocr
    /// For `.photo` mode the first arg is empty; the image is the
    /// payload. For `.ocr` mode the first arg is the recognised
    /// text and the image is provided for optional preview.
    var onText: (String, UIImage) -> Void

    @State private var showCamera = false
    @State private var showLibrary = false
    /// Running OCR / upload state — the picker has dismissed but
    /// the work isn't done yet. Surface a spinner so the user
    /// doesn't think the sheet is frozen.
    @State private var processing = false

    private var title: String {
        mode == .photo ? "Attach a photo" : "Scan text from image"
    }
    private var subhead: String {
        switch mode {
        case .photo:
            return "Uploads the photo and embeds it in your memory. Tap a photo in the editor to view full size."
        case .ocr:
            return "Runs on-device OCR (English + Korean) and inserts the recognised text into your memory. The image itself is not uploaded."
        }
    }
    private var cameraLabel: String {
        mode == .photo ? "Take a new photo" : "Scan with camera"
    }
    private var libraryLabel: String {
        mode == .photo ? "Choose from Library" : "Pick image to scan"
    }

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Text(title)
                        .font(Brand.display(size: 22))
                        .foregroundStyle(Brand.textPrimary)
                    Spacer()
                    Button { isPresented = false } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Brand.textFaint)
                            .frame(width: 28, height: 28)
                            .background(Circle().fill(Brand.surface))
                    }
                    .buttonStyle(.plain)
                }

                Text(subhead)
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textMuted)
                    .lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button { showCamera = true } label: {
                    PickerButton(icon: "camera", label: cameraLabel)
                }
                .buttonStyle(.plain)
                .disabled(processing)

                Button { showLibrary = true } label: {
                    PickerButton(icon: "photo.on.rectangle.angled", label: libraryLabel)
                }
                .buttonStyle(.plain)
                .disabled(processing)

                if processing {
                    HStack(spacing: 8) {
                        ProgressView().scaleEffect(0.7).tint(Brand.textMuted)
                        Text(mode == .photo ? "Uploading photo…" : "Recognising text…")
                            .font(Brand.body(size: 12))
                            .foregroundStyle(Brand.textMuted)
                    }
                    .padding(.top, 4)
                }

                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 22)
        }
        .sheet(isPresented: $showCamera) {
            CameraPicker { image in
                showCamera = false
                handle(image)
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showLibrary) {
            LibraryPicker { image in
                showLibrary = false
                handle(image)
            }
            .ignoresSafeArea()
        }
    }

    private func handle(_ image: UIImage) {
        switch mode {
        case .photo:
            // Hand off to the parent — the upload happens there
            // via APIClient.uploadImage. Empty first arg signals
            // "no OCR was run."
            onText("", image)
            isPresented = false
        case .ocr:
            processing = true
            Task.detached {
                let text = await PhotoCapture.ocr(image: image)
                await MainActor.run {
                    processing = false
                    onText(text, image)
                    isPresented = false
                }
            }
        }
    }
}

private struct PickerButton: View {
    let icon: String
    let label: String
    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Brand.textPrimary)
                .frame(width: 22)
            Text(label)
                .font(Brand.body(size: 15, weight: .medium))
                .foregroundStyle(Brand.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Brand.textFaint)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Brand.borderDim, lineWidth: 1))
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

// MARK: - Helpers

enum PhotoCapture {
    /// Run Vision OCR on-device. Returns the joined text or "" if
    /// nothing recognised. The request uses .accurate so titles
    /// + body text both come back; for fast scanning (e.g. URL
    /// detection) .fast is the right choice but the user expects
    /// quality here.
    static func ocr(image: UIImage) async -> String {
        guard let cg = image.cgImage else { return "" }
        return await withCheckedContinuation { (cont: CheckedContinuation<String, Never>) in
            let request = VNRecognizeTextRequest { req, _ in
                let lines: [String] = (req.results as? [VNRecognizedTextObservation])?
                    .compactMap { $0.topCandidates(1).first?.string } ?? []
                cont.resume(returning: lines.joined(separator: "\n"))
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = ["en-US", "ko-KR"]
            let handler = VNImageRequestHandler(cgImage: cg, options: [:])
            DispatchQueue.global(qos: .userInitiated).async {
                try? handler.perform([request])
            }
        }
    }
}

// MARK: - UIKit bridges

private struct CameraPicker: UIViewControllerRepresentable {
    var onPick: (UIImage) -> Void
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .camera
        p.delegate = context.coordinator
        return p
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onPick: (UIImage) -> Void
        init(onPick: @escaping (UIImage) -> Void) { self.onPick = onPick }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            picker.dismiss(animated: true)
            if let img = info[.originalImage] as? UIImage { onPick(img) }
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}

private struct LibraryPicker: UIViewControllerRepresentable {
    var onPick: (UIImage) -> Void
    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = 1
        config.filter = .images
        let p = PHPickerViewController(configuration: config)
        p.delegate = context.coordinator
        return p
    }
    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPick: (UIImage) -> Void
        init(onPick: @escaping (UIImage) -> Void) { self.onPick = onPick }
        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else { return }
            provider.loadObject(ofClass: UIImage.self) { image, _ in
                guard let img = image as? UIImage else { return }
                DispatchQueue.main.async { self.onPick(img) }
            }
        }
    }
}
