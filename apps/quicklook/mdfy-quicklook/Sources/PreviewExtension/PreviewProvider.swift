import Foundation

// MARK: - Memory.Wiki QuickLook Preview Generator

/// Escapes special characters for safe embedding in JavaScript template literals.
func escapeForJS(_ string: String) -> String {
    return string
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "`", with: "\\`")
        .replacingOccurrences(of: "$", with: "\\$")
        .replacingOccurrences(of: "\r\n", with: "\n")
}

/// Loads the HTML template from various locations.
func loadTemplate() -> String? {
    let executableURL = URL(fileURLWithPath: CommandLine.arguments[0])

    // Same directory as binary
    let sameDir = executableURL.deletingLastPathComponent().appendingPathComponent("template.html")
    if let content = try? String(contentsOf: sameDir, encoding: .utf8) { return content }

    // ~/.memory.wiki/quicklook/
    let homeDir = FileManager.default.homeDirectoryForCurrentUser
    let mdfyDir = homeDir.appendingPathComponent(".memory.wiki/quicklook/template.html")
    if let content = try? String(contentsOf: mdfyDir, encoding: .utf8) { return content }

    // Relative to source tree (development)
    let sourceDir = executableURL
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .appendingPathComponent("Sources/PreviewExtension/template.html")
    return try? String(contentsOf: sourceDir, encoding: .utf8)
}

/// Loads the preview CSS from various locations.
func loadCSS() -> String? {
    let executableURL = URL(fileURLWithPath: CommandLine.arguments[0])

    let sameDir = executableURL.deletingLastPathComponent().appendingPathComponent("preview.css")
    if let content = try? String(contentsOf: sameDir, encoding: .utf8) { return content }

    let homeDir = FileManager.default.homeDirectoryForCurrentUser
    let mdfyDir = homeDir.appendingPathComponent(".memory.wiki/quicklook/preview.css")
    if let content = try? String(contentsOf: mdfyDir, encoding: .utf8) { return content }

    let resourceDir = executableURL
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .appendingPathComponent("Resources/preview.css")
    return try? String(contentsOf: resourceDir, encoding: .utf8)
}

/// Generates a complete HTML document from a Markdown file path.
func generatePreviewHTML(markdownPath: String) -> String? {
    guard let markdownContent = try? String(contentsOfFile: markdownPath, encoding: .utf8) else {
        fputs("Error: Could not read file at \(markdownPath)\n", stderr)
        return nil
    }

    guard var template = loadTemplate() else {
        fputs("Error: Could not load template.html\n", stderr)
        return nil
    }

    let css = loadCSS() ?? ""
    let fileName = URL(fileURLWithPath: markdownPath).lastPathComponent
    let escapedContent = escapeForJS(markdownContent)

    template = template
        .replacingOccurrences(of: "{{MDFY_CSS}}", with: css)
        .replacingOccurrences(of: "{{MARKDOWN_CONTENT}}", with: escapedContent)
        .replacingOccurrences(of: "{{FILE_NAME}}", with: fileName)

    return template
}
