import Foundation

// MARK: - CLI Entry Point

let args = CommandLine.arguments

if args.count < 2 {
    print("""
    memory.wiki QuickLook Preview Generator

    Usage:
      mdfy-quicklook <markdown-file>           Print rendered HTML to stdout
      mdfy-quicklook <markdown-file> -o <out>  Write rendered HTML to file
      mdfy-quicklook <markdown-file> --open     Render and open in browser

    Examples:
      mdfy-quicklook README.md
      mdfy-quicklook README.md -o preview.html
      mdfy-quicklook README.md --open
    """)
    exit(1)
}

let markdownPath = args[1]

let absolutePath: String = markdownPath.hasPrefix("/")
    ? markdownPath
    : FileManager.default.currentDirectoryPath + "/" + markdownPath

guard FileManager.default.fileExists(atPath: absolutePath) else {
    fputs("Error: File not found: \(absolutePath)\n", stderr)
    exit(1)
}

guard let html = generatePreviewHTML(markdownPath: absolutePath) else {
    fputs("Error: Failed to generate preview\n", stderr)
    exit(1)
}

if args.contains("--open") {
    let tempDir = FileManager.default.temporaryDirectory
    let tempFile = tempDir.appendingPathComponent("mdfy-preview-\(UUID().uuidString).html")
    do {
        try html.write(to: tempFile, atomically: true, encoding: String.Encoding.utf8)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        process.arguments = [tempFile.path]
        try process.run()
        process.waitUntilExit()
        Thread.sleep(forTimeInterval: 2)
    } catch {
        fputs("Error: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
} else if let outputIndex = args.firstIndex(of: "-o"), outputIndex + 1 < args.count {
    let outputPath = args[outputIndex + 1]
    do {
        try html.write(toFile: outputPath, atomically: true, encoding: String.Encoding.utf8)
        print("Preview written to: \(outputPath)")
    } catch {
        fputs("Error writing output: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
} else {
    print(html)
}
