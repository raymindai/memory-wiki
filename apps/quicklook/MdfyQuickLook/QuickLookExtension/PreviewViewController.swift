import Cocoa
import Quartz
import WebKit

class PreviewViewController: NSViewController, QLPreviewingController {

    var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 800, height: 600), configuration: config)
        webView.autoresizingMask = [.width, .height]
        self.view = webView
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            let fileSize = attributes[.size] as? Int64 ?? 0
            let maxSize: Int64 = 10_000_000 // 10MB

            var markdown: String
            if fileSize > maxSize {
                let truncatedData = try Data(contentsOf: url).prefix(Int(maxSize))
                markdown = (String(data: truncatedData, encoding: .utf8) ?? "") + "\n\n---\n\n> **Note:** This file was truncated for preview (original size: \(fileSize / 1_000_000)MB). Open in Memory.Wiki for the full document."
            } else {
                markdown = try String(contentsOf: url, encoding: .utf8)
            }
            let fileName = url.lastPathComponent
            let html = generateHTML(markdown: markdown, fileName: fileName)

            DispatchQueue.main.async {
                self.webView.loadHTMLString(html, baseURL: nil)
            }

            handler(nil)
        } catch {
            handler(error)
        }
    }

    // MARK: - HTML Generation

    private func generateHTML(markdown: String, fileName: String) -> String {
        let escaped = escapeForJS(markdown)
        let css = Self.previewCSS
        let template = Self.htmlTemplate
            .replacingOccurrences(of: "{{MDFY_CSS}}", with: css)
            .replacingOccurrences(of: "{{MARKDOWN_CONTENT}}", with: escaped)
            .replacingOccurrences(of: "{{FILE_NAME}}", with: escapeHTML(fileName))

        return template
    }

    private func escapeForJS(_ string: String) -> String {
        return string
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "`", with: "\\`")
            .replacingOccurrences(of: "$", with: "\\$")
            .replacingOccurrences(of: "\r\n", with: "\n")
    }

    private func escapeHTML(_ string: String) -> String {
        return string
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    // MARK: - Embedded Assets

    /// Full inline CSS -- no CDN dependency for styles
    static let previewCSS: String = """
    /* ── Base ── */
    .mdcore-rendered {
      color: var(--text-secondary);
      font-size: 0.9375rem;
      line-height: 1.8;
      word-wrap: break-word;
    }
    /* ── Headings ── */
    .mdcore-rendered h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
      letter-spacing: -0.025em;
    }
    .mdcore-rendered h2 {
      font-size: 1.375rem;
      font-weight: 600;
      color: var(--h2-color);
      margin: 2rem 0 0.75rem;
      padding-bottom: 0.375rem;
      border-bottom: 1px solid var(--border);
      letter-spacing: -0.015em;
    }
    .mdcore-rendered h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--h2-color);
      margin: 1.5rem 0 0.5rem;
    }
    .mdcore-rendered h4 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--h2-color);
      margin: 1.25rem 0 0.5rem;
    }
    .mdcore-rendered h5 {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-tertiary);
      margin: 1rem 0 0.375rem;
    }
    .mdcore-rendered h6 {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-muted);
      margin: 1rem 0 0.375rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    /* ── Paragraphs ── */
    .mdcore-rendered p { margin: 0.75rem 0; }
    .mdcore-rendered strong { color: var(--text-primary); font-weight: 600; }
    .mdcore-rendered em { color: var(--text-tertiary); font-style: italic; }
    /* ── Links ── */
    .mdcore-rendered a { color: var(--accent); text-decoration: none; transition: opacity 0.15s; }
    .mdcore-rendered a:hover { text-decoration: underline; opacity: 0.85; }
    /* ── Blockquotes ── */
    .mdcore-rendered blockquote {
      border-left: 3px solid var(--accent);
      margin: 1rem 0;
      padding: 0.5rem 1rem;
      background: var(--surface);
      border-radius: 0 8px 8px 0;
    }
    .mdcore-rendered blockquote p { margin: 0.25rem 0; }
    .mdcore-rendered blockquote blockquote { border-left-color: #71717a; margin: 0.5rem 0; }
    /* ── Inline Code ── */
    .mdcore-rendered code {
      font-family: var(--font-mono);
      font-size: 0.85em;
      background: var(--border);
      padding: 0.15em 0.4em;
      border-radius: 4px;
      color: var(--accent);
    }
    /* ── Code Blocks ── */
    .mdcore-rendered pre {
      margin: 1rem 0;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid var(--border);
      position: relative;
    }
    .mdcore-rendered pre code {
      display: block;
      padding: 1rem 1.25rem;
      background: var(--surface);
      color: var(--text-secondary);
      font-size: 0.8125rem;
      line-height: 1.65;
      border-radius: 8px;
      overflow-x: auto;
    }
    /* ── Tables ── */
    .mdcore-rendered table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.875rem;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .mdcore-rendered th {
      background: var(--surface);
      color: var(--text-primary);
      font-weight: 600;
      padding: 0.625rem 1rem;
      border-bottom: 2px solid var(--border);
      font-size: 0.8125rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      text-align: left;
    }
    .mdcore-rendered td {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--border-dim);
      text-align: left;
    }
    .mdcore-rendered td:empty::after { content: "\\00a0"; }
    .mdcore-rendered tr:last-child td { border-bottom: none; }
    .mdcore-rendered tr:hover td { background: var(--surface-hover); }
    /* ── Lists ── */
    .mdcore-rendered ul { margin: 0.75rem 0; padding-left: 1.5rem; list-style-type: disc; }
    .mdcore-rendered ol { margin: 0.75rem 0; padding-left: 1.5rem; list-style-type: decimal; }
    .mdcore-rendered ol ol { list-style-type: lower-alpha; }
    .mdcore-rendered ol ol ol { list-style-type: lower-roman; }
    .mdcore-rendered ol ol ol ol { list-style-type: upper-alpha; }
    .mdcore-rendered ul ul { list-style-type: circle; }
    .mdcore-rendered ul ul ul { list-style-type: square; }
    .mdcore-rendered li { margin: 0.3rem 0; }
    .mdcore-rendered li::marker { color: var(--text-muted); }
    /* ── Task Lists ── */
    .mdcore-rendered li:has(input[type="checkbox"]) {
      list-style: none;
      margin-left: -1.5rem;
      padding-left: 0.25rem;
    }
    .mdcore-rendered li input[type="checkbox"] {
      margin-right: 0.5rem;
      accent-color: var(--accent);
      transform: scale(1.2);
      width: 16px;
      height: 16px;
      vertical-align: middle;
    }
    .mdcore-rendered li input[type="checkbox"]:not(:checked) {
      appearance: none;
      -webkit-appearance: none;
      border: 2px solid var(--text-muted);
      border-radius: 3px;
      background: transparent;
      position: relative;
    }
    .mdcore-rendered li input[type="checkbox"]:checked {
      appearance: none;
      -webkit-appearance: none;
      border: 2px solid var(--accent);
      border-radius: 3px;
      background: var(--accent);
      position: relative;
    }
    .mdcore-rendered li input[type="checkbox"]:checked::after {
      content: "";
      position: absolute;
      left: 3px;
      top: 0px;
      width: 5px;
      height: 9px;
      border: solid #000;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    /* ── Description Lists ── */
    .mdcore-rendered dt { font-weight: 600; color: var(--text-primary); margin-top: 1rem; }
    .mdcore-rendered dd { margin-left: 1.5rem; color: var(--text-tertiary); }
    /* ── Strikethrough ── */
    .mdcore-rendered del { color: var(--text-muted); text-decoration: line-through; }
    /* ── Horizontal Rule ── */
    .mdcore-rendered hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
    /* ── KaTeX Math ── */
    .mdcore-rendered .katex { font-size: 1.05em; color: var(--math-color); }
    .mdcore-rendered .katex-display {
      margin: 1.5rem 0;
      padding: 1rem;
      background: var(--surface);
      border-radius: 8px;
      border: 1px solid var(--border);
      overflow-x: auto;
    }
    .mdcore-rendered .katex-display > .katex { color: var(--math-display-color); }
    /* ── Images ── */
    .mdcore-rendered img {
      max-width: 100%;
      border-radius: 8px;
      margin: 1rem 0;
      border: 1px solid var(--border);
    }
    /* ── Footnotes ── */
    .mdcore-rendered section.footnotes {
      margin-top: 2.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.8125rem;
      color: var(--text-tertiary);
    }
    .mdcore-rendered .footnote-ref a,
    .mdcore-rendered .footnote-backref {
      color: var(--accent);
      font-size: 0.75em;
      vertical-align: super;
    }
    /* ── Superscript / Subscript ── */
    .mdcore-rendered sup { font-size: 0.75em; vertical-align: super; }
    .mdcore-rendered sub { font-size: 0.75em; vertical-align: sub; }
    /* ── Callouts ── */
    .mdcore-rendered blockquote p:first-child strong:first-child { color: var(--accent); }
    """

    /// Full HTML template with inline fallback rendering.
    /// Uses CDN for JS libraries (marked, highlight.js, KaTeX, Mermaid) with
    /// a fallback that shows formatted raw markdown if CDN is unavailable.
    static let htmlTemplate: String = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{FILE_NAME}} - Memory.Wiki Preview</title>
    <style>
    /* System font stack */
    :root {
      --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
      --font-mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    }

    /* Dark theme (default) */
    :root {
      --background: #09090b;
      --foreground: #fafafa;
      --accent: #fb923c;
      --accent-dim: rgba(251, 146, 60, 0.15);
      --surface: #18181b;
      --surface-hover: rgba(251, 146, 60, 0.03);
      --border: #27272a;
      --border-dim: rgba(39, 39, 42, 0.6);
      --text-primary: #fafafa;
      --text-secondary: #d4d4d8;
      --text-tertiary: #a1a1aa;
      --text-muted: #71717a;
      --text-faint: #737373;
      --math-color: #c4b5fd;
      --math-display-color: #ddd6fe;
      --h2-color: #e4e4e7;
      --scrollbar-thumb: #27272a;
      --scrollbar-hover: #3f3f46;
      --fg: #fafafa;
      --muted: #737373;
    }

    /* Light theme */
    @media (prefers-color-scheme: light) {
      :root {
        --background: #faf9f7;
        --foreground: #18181b;
        --accent: #ea580c;
        --accent-dim: rgba(234, 88, 12, 0.1);
        --surface: #f4f4f5;
        --surface-hover: rgba(234, 88, 12, 0.04);
        --border: #e4e4e7;
        --border-dim: rgba(228, 228, 231, 0.6);
        --text-primary: #09090b;
        --text-secondary: #3f3f46;
        --text-tertiary: #71717a;
        --text-muted: #71717a;
        --text-faint: #a1a1aa;
        --math-color: #7c3aed;
        --math-display-color: #6d28d9;
        --h2-color: #27272a;
        --scrollbar-thumb: #a1a1aa;
        --scrollbar-hover: #a1a1aa;
        --fg: #18181b;
        --muted: #a1a1aa;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      height: 100%;
      background: var(--background);
      color: var(--foreground);
      font-family: var(--font-sans);
      -webkit-font-smoothing: antialiased;
    }
    body { display: flex; flex-direction: column; }

    /* Top bar */
    .mdfy-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--background);
      flex-shrink: 0;
      gap: 8px;
      flex-wrap: nowrap;
      overflow: hidden;
    }
    .mdfy-topbar-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex-shrink: 1; overflow: hidden; }
    .mdfy-logo { display: flex; align-items: center; flex-shrink: 0; }
    .mdfy-filename {
      font-size: 11px;
      color: var(--text-muted);
      font-family: var(--font-mono);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mdfy-topbar-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    @media (max-width: 480px) {
      .mdfy-topbar { padding: 6px 10px; }
      .mdfy-filename { display: none; }
      .mdfy-btn span { display: none; }
      .mdfy-btn { padding: 4px 8px; font-size: 11px; }
    }
    .mdfy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-secondary);
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .mdfy-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
    .mdfy-btn-primary { background: var(--accent); color: #000; border-color: var(--accent); }
    .mdfy-btn-primary:hover { opacity: 0.9; color: #000; }

    /* Content */
    .mdfy-content { flex: 1; overflow-y: auto; padding: 32px 40px 60px; }
    @media (max-width: 720px) { .mdfy-content { padding: 20px 16px 40px; } }
    .mdfy-content-inner { max-width: 780px; margin: 0 auto; }

    /* Injected rendered content styles */
    {{MDFY_CSS}}

    /* Scrollbar */
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
    *::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

    /* Code copy button */
    .code-block-wrapper { position: relative; }
    .code-copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      font-size: 11px;
      font-family: var(--font-mono);
      background: var(--surface);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s, background 0.15s, color 0.15s;
      z-index: 10;
    }
    .code-block-wrapper:hover .code-copy-btn { opacity: 1; }
    .code-copy-btn:hover { background: var(--accent-dim); color: var(--accent); }

    /* Mermaid */
    .mermaid-container {
      margin: 1.25rem 0;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: linear-gradient(145deg, var(--surface), var(--background));
      overflow-x: auto;
      text-align: center;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    @media (prefers-color-scheme: light) {
      .mermaid-container {
        background: linear-gradient(145deg, #f8f9fa, #ffffff);
        border-color: #e2e8f0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }
    }
    .mermaid-container svg { max-width: 100%; height: auto; }

    /* Light mode hljs overrides */
    @media (prefers-color-scheme: light) {
      .hljs { background: var(--surface) !important; color: var(--text-secondary) !important; }
      .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section, .hljs-link { color: #a626a4; }
      .hljs-string, .hljs-title, .hljs-name, .hljs-type, .hljs-attribute,
      .hljs-symbol, .hljs-bullet, .hljs-addition, .hljs-variable,
      .hljs-template-tag, .hljs-template-variable { color: #50a14f; }
      .hljs-comment, .hljs-quote, .hljs-deletion, .hljs-meta { color: #a0a1a7; }
      .hljs-number, .hljs-built_in, .hljs-builtin-name, .hljs-class .hljs-title { color: #c18401; }
      .hljs-function { color: #4078f2; }
    }

    /* Loading state */
    .mdfy-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--text-muted);
      gap: 12px;
    }
    .mdfy-loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Raw markdown fallback styles */
    .mdfy-raw-fallback {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      line-height: 1.8;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: var(--text-secondary);
      padding: 1rem;
    }
    </style>

    <!-- CDN: highlight.js theme (conditional on color scheme) -->
    <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github-dark.min.css"
          media="(prefers-color-scheme: dark)">
    <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css"
          media="(prefers-color-scheme: light)">

    <!-- CDN: KaTeX CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">

    </head>
    <body>

    <!-- Top Bar -->
    <div class="mdfy-topbar">
      <div class="mdfy-topbar-left">
        <div class="mdfy-logo">
          <span style="font-size:16px;font-weight:800;letter-spacing:-0.5px"><span style="color:var(--accent)">md</span><span style="color:var(--fg)">fy</span><span style="color:var(--muted)">.cc</span></span>
        </div>
        <span class="mdfy-filename">{{FILE_NAME}}</span>
      </div>
      <div class="mdfy-topbar-right">
        <a class="mdfy-btn" id="open-in-mdfy" href="https://memory.wiki" target="_blank" rel="noopener">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 1h6m0 0v6m0-6L8 8"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Open on Memory.Wiki
        </a>
        <button class="mdfy-btn" id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode">
          <svg id="theme-icon-sun" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="display:none">
            <circle cx="8" cy="8" r="3.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 3.4l1-1"/>
          </svg>
          <svg id="theme-icon-moon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="mdfy-content">
      <div class="mdfy-content-inner">
        <div id="preview" class="mdcore-rendered">
          <div class="mdfy-loading">
            <div class="mdfy-loading-spinner"></div>
            <span style="font-size: 13px;">Rendering...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- CDN JS libraries, loaded with fallback handling -->
    <script>
    // Track which libraries loaded successfully
    window.__mdfyLibs = { marked: false, hljs: false, katex: false, mermaid: false };

    // Theme toggle
    var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    function updateThemeIcons() {
      document.getElementById('theme-icon-sun').style.display = isDark ? 'none' : 'block';
      document.getElementById('theme-icon-moon').style.display = isDark ? 'block' : 'none';
    }
    function toggleTheme() {
      isDark = !isDark;
      if (isDark) {
        document.documentElement.style.colorScheme = 'dark';
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.style.colorScheme = 'light';
        document.documentElement.setAttribute('data-theme', 'light');
      }
      // Override CSS variables manually since prefers-color-scheme won't change
      var root = document.documentElement.style;
      if (isDark) {
        root.setProperty('--background', '#09090b');
        root.setProperty('--foreground', '#fafafa');
        root.setProperty('--accent', '#fb923c');
        root.setProperty('--surface', '#18181b');
        root.setProperty('--border', '#27272a');
        root.setProperty('--border-dim', 'rgba(39,39,42,0.6)');
        root.setProperty('--text-primary', '#fafafa');
        root.setProperty('--text-secondary', '#d4d4d8');
        root.setProperty('--text-muted', '#71717a');
        root.setProperty('--text-faint', '#737373');
        root.setProperty('--fg', '#fafafa');
        root.setProperty('--muted', '#737373');
        root.setProperty('--accent-dim', 'rgba(251, 146, 60, 0.15)');
        root.setProperty('--surface-hover', 'rgba(251, 146, 60, 0.03)');
        root.setProperty('--text-tertiary', '#a1a1aa');
        root.setProperty('--math-color', '#c4b5fd');
        root.setProperty('--math-display-color', '#ddd6fe');
        root.setProperty('--h2-color', '#e4e4e7');
        root.setProperty('--scrollbar-thumb', '#27272a');
        root.setProperty('--scrollbar-hover', '#3f3f46');
      } else {
        root.setProperty('--background', '#faf9f7');
        root.setProperty('--foreground', '#18181b');
        root.setProperty('--accent', '#ea580c');
        root.setProperty('--surface', '#f4f4f5');
        root.setProperty('--border', '#e4e4e7');
        root.setProperty('--border-dim', 'rgba(228,228,231,0.6)');
        root.setProperty('--text-primary', '#09090b');
        root.setProperty('--text-secondary', '#3f3f46');
        root.setProperty('--text-muted', '#71717a');
        root.setProperty('--text-faint', '#a1a1aa');
        root.setProperty('--fg', '#18181b');
        root.setProperty('--muted', '#a1a1aa');
        root.setProperty('--accent-dim', 'rgba(234, 88, 12, 0.1)');
        root.setProperty('--surface-hover', 'rgba(234, 88, 12, 0.04)');
        root.setProperty('--text-tertiary', '#71717a');
        root.setProperty('--math-color', '#7c3aed');
        root.setProperty('--math-display-color', '#6d28d9');
        root.setProperty('--h2-color', '#27272a');
        root.setProperty('--scrollbar-thumb', '#a1a1aa');
        root.setProperty('--scrollbar-hover', '#a1a1aa');
      }
      document.body.style.background = isDark ? '#09090b' : '#faf9f7';
      updateThemeIcons();
    }
    updateThemeIcons();
    </script>

    <script src="https://cdn.jsdelivr.net/npm/marked@14/marked.min.js"
            onload="window.__mdfyLibs.marked=true"
            onerror="console.warn('marked.js CDN unavailable')"></script>
    <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"
            onload="window.__mdfyLibs.hljs=true"
            onerror="console.warn('highlight.js CDN unavailable')"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"
            onload="window.__mdfyLibs.katex=true"
            onerror="console.warn('KaTeX CDN unavailable')"></script>
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/contrib/auto-render.min.js"
            onerror="console.warn('KaTeX auto-render CDN unavailable')"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
            onload="window.__mdfyLibs.mermaid=true"
            onerror="console.warn('Mermaid CDN unavailable')"></script>

    <script>
    (function() {
      'use strict';

      const markdownContent = `{{MARKDOWN_CONTENT}}`;
      const previewEl = document.getElementById('preview');

      // ================================================================
      // Fallback: full markdown-to-HTML without external libraries
      // Handles headings, bold, italic, code blocks, tables, task lists,
      // ordered/unordered lists, links, images, hr, blockquotes
      // ================================================================
      function basicMarkdownToHTML(md) {
        // First extract fenced code blocks to protect them
        var codeBlocks = [];
        md = md.replace(/```(\\w*)\\n([\\s\\S]*?)```/g, function(_, lang, code) {
          var idx = codeBlocks.length;
          codeBlocks.push('<div class="code-block-wrapper"><pre lang="' + lang + '"><code>'
            + code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            + '</code></pre></div>');
          return '\\n%%CODEBLOCK' + idx + '%%\\n';
        });

        // Escape HTML in remaining content
        md = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Inline code
        md = md.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Tables: detect lines with pipes
        md = md.replace(/(^\\|.+\\|\\n)(^\\|[-: |]+\\|\\n)((?:^\\|.+\\|\\n?)*)/gm, function(match, headerRow, sepRow, bodyRows) {
          var headers = headerRow.trim().split('|').filter(function(c) { return c.trim() !== ''; });
          var rows = bodyRows.trim().split('\\n').filter(function(r) { return r.trim() !== ''; });
          var html = '<table><thead><tr>';
          headers.forEach(function(h) { html += '<th>' + h.trim() + '</th>'; });
          html += '</tr></thead><tbody>';
          rows.forEach(function(row) {
            var cells = row.split('|').filter(function(c) { return c.trim() !== ''; });
            html += '<tr>';
            cells.forEach(function(c) { html += '<td>' + c.trim() + '</td>'; });
            html += '</tr>';
          });
          html += '</tbody></table>';
          return html;
        });

        // Process blocks line by line for lists
        var lines = md.split('\\n');
        var result = [];
        var inUl = false, inOl = false;
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          var taskMatch = line.match(/^\\s*[-*]\\s+\\[([ xX])\\]\\s+(.*)/);
          var ulMatch = !taskMatch && line.match(/^\\s*[-*+]\\s+(.*)/);
          var olMatch = line.match(/^\\s*\\d+\\.\\s+(.*)/);

          if (taskMatch) {
            if (!inUl) { result.push('<ul>'); inUl = true; }
            if (inOl) { result.push('</ol>'); inOl = false; }
            var checked = taskMatch[1] !== ' ' ? ' checked disabled' : ' disabled';
            result.push('<li><input type="checkbox"' + checked + '> ' + taskMatch[2] + '</li>');
          } else if (ulMatch) {
            if (!inUl) { result.push('<ul>'); inUl = true; }
            if (inOl) { result.push('</ol>'); inOl = false; }
            result.push('<li>' + ulMatch[1] + '</li>');
          } else if (olMatch) {
            if (!inOl) { result.push('<ol>'); inOl = true; }
            if (inUl) { result.push('</ul>'); inUl = false; }
            result.push('<li>' + olMatch[1] + '</li>');
          } else {
            if (inUl) { result.push('</ul>'); inUl = false; }
            if (inOl) { result.push('</ol>'); inOl = false; }
            result.push(line);
          }
        }
        if (inUl) result.push('</ul>');
        if (inOl) result.push('</ol>');
        var html = result.join('\\n');

        // Headings
        html = html.replace(/^######\\s+(.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^#####\\s+(.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\\s+(.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\\s+(.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\\s+(.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\\s+(.+)$/gm, '<h1>$1</h1>');

        // Bold & italic
        html = html.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
        html = html.replace(/\\*(.+?)\\*/g, '<em>$1</em>');

        // Images (before links so ![...](...) matches first)
        html = html.replace(/!\\[([^\\]]*?)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1">');

        // Links
        html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');

        // Horizontal rules
        html = html.replace(/^---+$/gm, '<hr>');
        html = html.replace(/^\\*\\*\\*+$/gm, '<hr>');

        // Blockquotes
        html = html.replace(/^&gt;\\s?(.+)$/gm, '<blockquote><p>$1</p></blockquote>');

        // Line breaks to paragraphs
        html = html.replace(/\\n\\n/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // Clean up empty paragraphs and nesting issues
        html = html.replace(/<p><\\/p>/g, '');
        html = html.replace(/<p>(<h[1-6]>)/g, '$1');
        html = html.replace(/(<\\/h[1-6]>)<\\/p>/g, '$1');
        html = html.replace(/<p>(<hr>)<\\/p>/g, '$1');
        html = html.replace(/<p>(<pre)/g, '$1');
        html = html.replace(/(<\\/pre>)<\\/p>/g, '$1');
        html = html.replace(/<p>(<blockquote>)/g, '$1');
        html = html.replace(/(<\\/blockquote>)<\\/p>/g, '$1');
        html = html.replace(/<p>(<table>)/g, '$1');
        html = html.replace(/(<\\/table>)<\\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\\/ul>)<\\/p>/g, '$1');
        html = html.replace(/<p>(<ol>)/g, '$1');
        html = html.replace(/(<\\/ol>)<\\/p>/g, '$1');
        html = html.replace(/<p>(%%CODEBLOCK)/g, '$1');
        html = html.replace(/(%%)<\\/p>/g, '$1');

        // Restore code blocks
        for (var j = 0; j < codeBlocks.length; j++) {
          html = html.replace('%%CODEBLOCK' + j + '%%', codeBlocks[j]);
        }

        return html;
      }

      // ================================================================
      // Wait for DOM + scripts to be ready, then render
      // ================================================================
      function render() {
        if (window.__mdfyLibs.marked && typeof marked !== 'undefined') {
          renderWithMarked();
        } else {
          // Fallback: basic rendering
          try {
            previewEl.innerHTML = basicMarkdownToHTML(markdownContent);
          } catch (e) {
            previewEl.innerHTML = '<pre class="mdfy-raw-fallback">'
              + markdownContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              + '</pre>';
          }
        }
      }

      function renderWithMarked() {
        const renderer = new marked.Renderer();

        renderer.code = function({ text, lang }) {
          const language = lang || '';
          const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

          if (language === 'mermaid') {
            return '<div class="mermaid-container"><pre class="mermaid">' + text + '</pre></div>';
          }

          return '<div class="code-block-wrapper">'
            + '<button class="code-copy-btn" onclick="copyCode(this)">Copy</button>'
            + '<pre lang="' + language + '"><code class="hljs language-' + language + '">'
            + escaped
            + '</code></pre></div>';
        };

        renderer.listitem = function({ text, task, checked }) {
          if (task) {
            const checkbox = '<input type="checkbox" disabled'
              + (checked ? ' checked' : '') + '> ';
            return '<li>' + checkbox + text + '</li>\\n';
          }
          return '<li>' + text + '</li>\\n';
        };

        marked.setOptions({
          renderer: renderer,
          gfm: true,
          breaks: false,
          pedantic: false,
          smartypants: false
        });

        try {
          previewEl.innerHTML = marked.parse(markdownContent);
        } catch (err) {
          previewEl.innerHTML = '<p style="color: var(--text-muted);">Render error: '
            + err.message + '</p><pre class="mdfy-raw-fallback">'
            + markdownContent.substring(0, 5000) + '</pre>';
          return;
        }

        // Syntax highlighting
        if (window.__mdfyLibs.hljs && typeof hljs !== 'undefined') {
          document.querySelectorAll('pre code').forEach(function(block) {
            try { hljs.highlightElement(block); } catch (e) {}
          });
        }

        // KaTeX math
        if (window.__mdfyLibs.katex && typeof renderMathInElement === 'function') {
          try {
            renderMathInElement(previewEl, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\\\(', right: '\\\\)', display: false },
                { left: '\\\\[', right: '\\\\]', display: true }
              ],
              throwOnError: false,
              trust: true
            });
          } catch (e) {}
        }

        // Mermaid diagrams
        if (window.__mdfyLibs.mermaid && typeof mermaid !== 'undefined') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'var(--font-sans)',
            themeVariables: isDark ? {
              primaryColor: '#27272a', primaryTextColor: '#d4d4d8',
              primaryBorderColor: '#3f3f46', lineColor: '#737373',
              secondaryColor: '#18181b', tertiaryColor: '#09090b',
              background: '#18181b', mainBkg: '#27272a',
              nodeBorder: '#3f3f46', clusterBkg: '#18181b',
              clusterBorder: '#3f3f46', titleColor: '#fafafa',
              edgeLabelBackground: '#18181b'
            } : {
              primaryColor: '#fff7ed', primaryTextColor: '#3f3f46',
              primaryBorderColor: '#e4e4e7', lineColor: '#a1a1aa',
              secondaryColor: '#f4f4f5', tertiaryColor: '#faf9f7',
              background: '#ffffff', mainBkg: '#fff7ed',
              nodeBorder: '#e4e4e7', clusterBkg: '#f4f4f5',
              clusterBorder: '#e4e4e7', titleColor: '#09090b',
              edgeLabelBackground: '#ffffff'
            }
          });

          document.querySelectorAll('.mermaid').forEach(async function(el, index) {
            try {
              const { svg } = await mermaid.render('mermaid-' + index, el.textContent.trim());
              el.innerHTML = svg;
              el.classList.remove('mermaid');
              el.classList.add('mermaid-rendered');
            } catch (e) {
              el.innerHTML = '<pre style="text-align:left;padding:1rem;font-size:12px;color:var(--text-muted);">'
                + el.textContent + '</pre>';
            }
          });
        }
      }

      // Render strategy: try CDN scripts first with a 2-second timeout.
      // If CDN doesn't load in time, fall back to the built-in renderer.
      var rendered = false;
      function tryRender() {
        if (rendered) return;
        rendered = true;
        render();
      }

      // Timeout: if CDN hasn't loaded marked.js in 2s, render with fallback
      var cdnTimeout = setTimeout(function() {
        if (!rendered) {
          console.warn('CDN timeout — using offline fallback renderer');
          tryRender();
        }
      }, 2000);

      if (document.readyState === 'complete') {
        setTimeout(function() { clearTimeout(cdnTimeout); tryRender(); }, 100);
      } else {
        window.addEventListener('load', function() {
          clearTimeout(cdnTimeout);
          setTimeout(tryRender, 100);
        });
      }
    })();

    // Try opening in the Memory.Wiki desktop app via custom URL scheme.
    // Falls back to https://memory.wiki if the desktop app is not installed.
    function openInMdfy(event) {
      event.preventDefault();
      var fileName = encodeURIComponent('{{FILE_NAME}}');
      var desktopUrl = 'memory.wiki://open?file=' + fileName;
      // Try custom scheme — if it fails (no handler), fall back to web
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = desktopUrl;
      document.body.appendChild(iframe);
      // After a short delay, if we're still here, open in browser
      setTimeout(function() {
        document.body.removeChild(iframe);
        window.open('https://memory.wiki', '_blank');
      }, 500);
      return false;
    }

    function copyCode(btn) {
      const pre = btn.parentElement.querySelector('pre');
      const code = pre ? pre.textContent : '';
      navigator.clipboard.writeText(code).then(function() {
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
      }).catch(function() {
        btn.textContent = 'Failed';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
      });
    }
    </script>
    </body>
    </html>
    """
}
