// AnimatedBlob — renders the brand morph SVG with its <animate>
// tags intact. iOS Asset Catalog SVG rendering strips animation
// (and gets confused by the mask), so we host the SAME file the
// web uses in a transparent WKWebView. This keeps the iOS mark
// pixel-identical to memory.wiki — including the 10.867s morph
// cycle — instead of drifting to a re-implementation.
//
// The SVG is loaded from the app bundle (Resources/mwblob_morph.svg)
// rather than the asset catalog because asset catalog SVG support
// flattens animation. WKWebView pays a small one-time cost; we
// only mount one per screen.

import SwiftUI
import WebKit

struct AnimatedBlob: View {
    var size: CGFloat = 40
    /// "dark" loads mwblob_morph.svg (white blob, for dark canvas);
    /// "light" loads mwblob_morph_dark.svg (dark blob, for light).
    var theme: Theme = .dark

    enum Theme { case dark, light }

    var body: some View {
        BlobWebView(svgName: theme == .dark ? "mwblob_morph" : "mwblob_morph_dark")
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

private struct BlobWebView: UIViewRepresentable {
    let svgName: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.suppressesIncrementalRendering = false

        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.scrollView.bouncesZoom = false
        view.isUserInteractionEnabled = false
        view.scrollView.contentInsetAdjustmentBehavior = .never

        guard let url = Bundle.main.url(forResource: svgName, withExtension: "svg"),
              let svg = try? String(contentsOf: url) else {
            return view
        }

        // Inline the SVG into a minimal HTML doc so the body has
        // no margins and the SVG scales to fill the WebKit viewport.
        let html = """
        <!doctype html>
        <html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
        <style>
          html,body{margin:0;padding:0;background:transparent;height:100%;width:100%;overflow:hidden}
          svg{display:block;width:100%;height:100%}
        </style></head><body>\(svg)</body></html>
        """
        view.loadHTMLString(html, baseURL: nil)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

#Preview {
    ZStack {
        Brand.background.ignoresSafeArea()
        VStack(spacing: 20) {
            AnimatedBlob(size: 80)
            AnimatedBlob(size: 40)
            AnimatedBlob(size: 24)
        }
    }
}
