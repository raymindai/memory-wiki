// PhotoCapture — camera + photo-library bridge for the Capture
// tab. Pick or shoot an image; Vision's VNRecognizeTextRequest
// extracts text on-device; the result becomes a new doc with the
// OCR'd text as the body. No image upload in v1 — the focus is
// the text. Future: rehost the image into /api/upload + embed.

import SwiftUI
import PhotosUI
import UIKit
import Vision

/// Two-button sheet — Camera or Photos — that returns the picked
/// image (and its OCR'd markdown) via a callback. Lives at the
/// CaptureView level; the sheet is the SwiftUI UI surface, the
/// underlying pickers are UIKit + PhotosUI.
struct PhotoCaptureSheet: View {
    @Binding var isPresented: Bool
    var onText: (String, UIImage) -> Void

    @State private var showCamera = false
    @State private var showLibrary = false

    var body: some View {
        ZStack {
            Brand.background.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Text("Add an image")
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

                Text("On-device OCR turns the image into a new markdown doc. Original photo isn't uploaded in this version.")
                    .font(Brand.body(size: 12))
                    .foregroundStyle(Brand.textMuted)
                    .lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button { showCamera = true } label: {
                    PickerButton(icon: "camera", label: "Take photo")
                }
                .buttonStyle(.plain)

                Button { showLibrary = true } label: {
                    PickerButton(icon: "photo.on.rectangle.angled", label: "Choose from Library")
                }
                .buttonStyle(.plain)

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
        Task.detached {
            let text = await PhotoCapture.ocr(image: image)
            await MainActor.run {
                onText(text, image)
                isPresented = false
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
