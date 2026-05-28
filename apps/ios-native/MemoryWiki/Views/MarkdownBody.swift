// MarkdownBody — lightweight in-house markdown renderer for the
// iOS doc reader. The web uses markdown-it + KaTeX + Mermaid via
// a 700KB JS pipeline; iOS doesn't need parity on equations and
// diagrams in v1, just clean prose. Native SwiftUI render gives
// the brand control (Noto Sans body, Cal Sans display headings,
// JetBrains Mono code) the web has.
//
// Block grammar handled:
//   - ATX headings (# / ## / ###)
//   - Paragraphs (separated by blank line)
//   - Fenced code blocks ``` (optional language label)
//   - Blockquotes (>)
//   - Unordered lists (- / *)
//   - Ordered lists (1. / 2.)
//   - Thematic break (---)
// Inline grammar via SwiftUI's AttributedString(markdown:) which
// understands **bold**, *italic*, `code`, [text](url).

import SwiftUI
import UIKit

struct MarkdownBody: View {
    let markdown: String

    private var blocks: [MarkdownBlock] { MarkdownBlock.parse(markdown) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(blocks.indices, id: \.self) { idx in
                MarkdownBlockView(block: blocks[idx])
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // Body-wide text selection — the per-block .textSelection
        // modifiers SwiftUI inherits from this one. Lets the user
        // long-press anywhere to start a system selection handle.
        .textSelection(.enabled)
    }
}

/// Heading record extracted from a parsed MarkdownBody — used
/// by DocumentDetailView's table-of-contents sheet to render
/// + jump to sections.
struct MarkdownHeading: Identifiable, Hashable {
    let id = UUID()
    let level: Int
    let text: String
}

extension MarkdownBody {
    /// Walk the parsed blocks and return every heading in
    /// document order. Used by the TOC sheet.
    static func headings(in markdown: String) -> [MarkdownHeading] {
        MarkdownBlock.parse(markdown).compactMap { block in
            if case .heading(let level, let text) = block {
                return MarkdownHeading(level: level, text: text)
            }
            return nil
        }
    }
}

// MARK: - Block model

enum MarkdownBlock: Hashable {
    case heading(Int, String)
    case paragraph(String)
    case codeBlock(lang: String?, source: String)
    case blockquote(String)
    case bulletList([String])
    case orderedList([String])
    /// GFM task list — each entry is (checked, label). Parsed
    /// out of bullet lists where the first chars are `[ ]` /
    /// `[x]` / `[X]`. Rendered as a checkbox row.
    case taskList([(Bool, String)])
    /// GFM table — header cells + body rows. Parsed when a
    /// paragraph starts with a pipe line followed by a separator
    /// line of dashes.
    case table(header: [String], rows: [[String]])
    case thematicBreak
    /// Standalone image: a paragraph that's just `![alt](url)`.
    /// Pulled out of the paragraph stream so the renderer can
    /// give it its own AsyncImage with a brand-styled frame.
    case image(alt: String, url: String)

    static func == (lhs: MarkdownBlock, rhs: MarkdownBlock) -> Bool {
        switch (lhs, rhs) {
        case (.heading(let a, let b), .heading(let c, let d)): return a == c && b == d
        case (.paragraph(let a), .paragraph(let b)): return a == b
        case (.codeBlock(let l, let s), .codeBlock(let l2, let s2)): return l == l2 && s == s2
        case (.blockquote(let a), .blockquote(let b)): return a == b
        case (.bulletList(let a), .bulletList(let b)): return a == b
        case (.orderedList(let a), .orderedList(let b)): return a == b
        case (.taskList(let a), .taskList(let b)):
            return a.map { "\($0.0)|\($0.1)" } == b.map { "\($0.0)|\($0.1)" }
        case (.table(let h1, let r1), .table(let h2, let r2)): return h1 == h2 && r1 == r2
        case (.thematicBreak, .thematicBreak): return true
        case (.image(let a, let u), .image(let a2, let u2)): return a == a2 && u == u2
        default: return false
        }
    }
    func hash(into hasher: inout Hasher) {
        switch self {
        case .heading(let l, let t): hasher.combine(0); hasher.combine(l); hasher.combine(t)
        case .paragraph(let t): hasher.combine(1); hasher.combine(t)
        case .codeBlock(let l, let s): hasher.combine(2); hasher.combine(l); hasher.combine(s)
        case .blockquote(let t): hasher.combine(3); hasher.combine(t)
        case .bulletList(let a): hasher.combine(4); hasher.combine(a)
        case .orderedList(let a): hasher.combine(5); hasher.combine(a)
        case .taskList(let a): hasher.combine(6); for it in a { hasher.combine(it.0); hasher.combine(it.1) }
        case .table(let h, let r): hasher.combine(7); hasher.combine(h); hasher.combine(r)
        case .thematicBreak: hasher.combine(8)
        case .image(let a, let u): hasher.combine(9); hasher.combine(a); hasher.combine(u)
        }
    }

    static func parse(_ input: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = input.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var i = 0
        var pendingParagraph: [String] = []
        var pendingBullets: [String] = []
        var pendingOrdered: [String] = []
        var pendingQuote: [String] = []

        func flushParagraph() {
            if !pendingParagraph.isEmpty {
                blocks.append(.paragraph(pendingParagraph.joined(separator: " ").trimmingCharacters(in: .whitespaces)))
                pendingParagraph.removeAll()
            }
        }
        func flushBullets() {
            if !pendingBullets.isEmpty {
                // Split into task-list vs plain bullet list — if
                // EVERY item starts with `[ ]` / `[x]` / `[X]`
                // it's a GFM task list.
                let parsed: [(Bool, String)?] = pendingBullets.map { item in
                    let t = item.trimmingCharacters(in: .whitespaces)
                    if t.hasPrefix("[ ] ") { return (false, String(t.dropFirst(4))) }
                    if t.hasPrefix("[x] ") || t.hasPrefix("[X] ") { return (true, String(t.dropFirst(4))) }
                    return nil
                }
                if parsed.allSatisfy({ $0 != nil }) {
                    blocks.append(.taskList(parsed.compactMap { $0 }))
                } else {
                    blocks.append(.bulletList(pendingBullets))
                }
                pendingBullets.removeAll()
            }
        }
        func flushOrdered() {
            if !pendingOrdered.isEmpty {
                blocks.append(.orderedList(pendingOrdered))
                pendingOrdered.removeAll()
            }
        }
        func flushQuote() {
            if !pendingQuote.isEmpty {
                blocks.append(.blockquote(pendingQuote.joined(separator: " ").trimmingCharacters(in: .whitespaces)))
                pendingQuote.removeAll()
            }
        }
        func flushAll() { flushParagraph(); flushBullets(); flushOrdered(); flushQuote() }

        while i < lines.count {
            let line = lines[i]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Blank line — flush soft blocks.
            if trimmed.isEmpty {
                flushAll()
                i += 1
                continue
            }

            // Fenced code block
            if trimmed.hasPrefix("```") {
                flushAll()
                let lang = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                var code: [String] = []
                i += 1
                while i < lines.count {
                    let l = lines[i]
                    if l.trimmingCharacters(in: .whitespaces).hasPrefix("```") { i += 1; break }
                    code.append(l)
                    i += 1
                }
                blocks.append(.codeBlock(lang: lang.isEmpty ? nil : lang, source: code.joined(separator: "\n")))
                continue
            }

            // Heading
            if let level = headingLevel(trimmed) {
                flushAll()
                let text = String(trimmed.drop(while: { $0 == "#" })).trimmingCharacters(in: .whitespaces)
                blocks.append(.heading(level, text))
                i += 1
                continue
            }

            // Thematic break
            if trimmed == "---" || trimmed == "***" {
                flushAll()
                blocks.append(.thematicBreak)
                i += 1
                continue
            }

            // Standalone image line: ![alt](url) — only when the
            // line IS the image (with optional surrounding ws).
            // Inline images inside prose still fall through to
            // InlineMarkdown / AttributedString.
            if let image = parseStandaloneImage(trimmed) {
                flushAll()
                blocks.append(.image(alt: image.alt, url: image.url))
                i += 1
                continue
            }

            // GFM table — pipe-delimited header followed by a
            // separator line of dashes, followed by zero or more
            // body rows. Lines after a non-pipe line end the
            // table. We don't try to honour per-column alignment
            // (:---: etc.) yet; everything is left-aligned.
            if trimmed.contains("|") && i + 1 < lines.count {
                let next = lines[i + 1].trimmingCharacters(in: .whitespaces)
                if isTableSeparator(next), let header = parseTableRow(trimmed) {
                    flushAll()
                    var rows: [[String]] = []
                    i += 2  // skip header + separator
                    while i < lines.count {
                        let l = lines[i].trimmingCharacters(in: .whitespaces)
                        if l.isEmpty || !l.contains("|") { break }
                        if let row = parseTableRow(l) { rows.append(row) }
                        i += 1
                    }
                    blocks.append(.table(header: header, rows: rows))
                    continue
                }
            }

            // Blockquote
            if trimmed.hasPrefix(">") {
                flushParagraph(); flushBullets(); flushOrdered()
                pendingQuote.append(String(trimmed.dropFirst()).trimmingCharacters(in: .whitespaces))
                i += 1
                continue
            } else if !pendingQuote.isEmpty {
                flushQuote()
            }

            // Unordered list
            if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
                flushParagraph(); flushOrdered(); flushQuote()
                pendingBullets.append(String(trimmed.dropFirst(2)))
                i += 1
                continue
            } else if !pendingBullets.isEmpty {
                flushBullets()
            }

            // Ordered list
            if let firstDot = trimmed.firstIndex(of: "."), trimmed[..<firstDot].allSatisfy(\.isNumber) {
                let rest = trimmed[trimmed.index(after: firstDot)...]
                if rest.hasPrefix(" ") {
                    flushParagraph(); flushBullets(); flushQuote()
                    pendingOrdered.append(String(rest.dropFirst()))
                    i += 1
                    continue
                }
            }
            if !pendingOrdered.isEmpty { flushOrdered() }

            // Paragraph continuation
            pendingParagraph.append(line)
            i += 1
        }
        flushAll()
        return blocks
    }

    /// Splits a `| a | b | c |` line into ["a","b","c"]. Returns
    /// nil if the line isn't pipe-delimited cleanly.
    private static func parseTableRow(_ s: String) -> [String]? {
        var line = s.trimmingCharacters(in: .whitespaces)
        if line.hasPrefix("|") { line.removeFirst() }
        if line.hasSuffix("|") { line.removeLast() }
        let cells = line.split(separator: "|", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
        return cells.isEmpty ? nil : cells
    }

    /// Recognises `|---|---|` style separator rows. Allows
    /// alignment colons (`:---:`, `:---`, `---:`) per GFM spec.
    private static func isTableSeparator(_ s: String) -> Bool {
        guard s.contains("|"), s.contains("-") else { return false }
        guard let cells = parseTableRow(s), !cells.isEmpty else { return false }
        return cells.allSatisfy { cell in
            let core = cell.replacingOccurrences(of: ":", with: "")
            return !core.isEmpty && core.allSatisfy { $0 == "-" }
        }
    }

    /// `![alt](url)` on a line by itself — returns nil otherwise.
    private static func parseStandaloneImage(_ s: String) -> (alt: String, url: String)? {
        guard s.hasPrefix("![") else { return nil }
        guard let altClose = s.firstIndex(of: "]") else { return nil }
        let after = s.index(after: altClose)
        guard after < s.endIndex, s[after] == "(" else { return nil }
        guard let urlClose = s.lastIndex(of: ")"), urlClose > after else { return nil }
        let alt = String(s[s.index(s.startIndex, offsetBy: 2)..<altClose])
        let url = String(s[s.index(after: after)..<urlClose])
        guard !url.isEmpty else { return nil }
        return (alt, url)
    }

    private static func headingLevel(_ s: String) -> Int? {
        var n = 0
        for ch in s {
            if ch == "#" { n += 1 } else { break }
        }
        guard n >= 1 && n <= 6 else { return nil }
        let after = s.index(s.startIndex, offsetBy: n)
        guard after < s.endIndex, s[after] == " " else { return nil }
        return n
    }
}

// MARK: - Block view

private struct MarkdownBlockView: View {
    let block: MarkdownBlock

    var body: some View {
        switch block {
        case .heading(let level, let text):
            HeadingView(level: level, text: text)
        case .paragraph(let text):
            InlineMarkdown(text: text)
                .font(Brand.body(size: 15))
                .foregroundStyle(Brand.textPrimary)
                .lineSpacing(5)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
        case .codeBlock(let lang, let source):
            CodeBlockView(lang: lang, source: source)
        case .blockquote(let text):
            HStack(alignment: .top, spacing: 12) {
                Rectangle()
                    .fill(Brand.border)
                    .frame(width: 2)
                InlineMarkdown(text: text)
                    .font(Brand.body(size: 15).italic())
                    .foregroundStyle(Brand.textMuted)
                    .lineSpacing(5)
                    .textSelection(.enabled)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .bulletList(let items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(items.indices, id: \.self) { i in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(Brand.textFaint)
                            .frame(width: 4, height: 4)
                            .padding(.top, 8)
                        InlineMarkdown(text: items[i])
                            .font(Brand.body(size: 15))
                            .foregroundStyle(Brand.textPrimary)
                            .lineSpacing(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                }
            }
        case .orderedList(let items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(items.indices, id: \.self) { i in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(i + 1).")
                            .font(Brand.mono(size: 12, weight: .medium))
                            .foregroundStyle(Brand.textFaint)
                            .frame(width: 18, alignment: .trailing)
                        InlineMarkdown(text: items[i])
                            .font(Brand.body(size: 15))
                            .foregroundStyle(Brand.textPrimary)
                            .lineSpacing(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                }
            }
        case .thematicBreak:
            Rectangle()
                .fill(Brand.borderDim)
                .frame(height: 1)
                .padding(.vertical, 8)
        case .image(let alt, let url):
            MarkdownImage(alt: alt, urlString: url)
        case .taskList(let items):
            VStack(alignment: .leading, spacing: 6) {
                ForEach(items.indices, id: \.self) { i in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: items[i].0 ? "checkmark.square.fill" : "square")
                            .font(.system(size: 14))
                            .foregroundStyle(items[i].0 ? Brand.microInfo : Brand.textFaint)
                            .frame(width: 18, alignment: .center)
                            .padding(.top, 2)
                        InlineMarkdown(text: items[i].1)
                            .font(Brand.body(size: 15))
                            .foregroundStyle(items[i].0 ? Brand.textMuted : Brand.textPrimary)
                            .strikethrough(items[i].0, color: Brand.textFaint)
                            .lineSpacing(4)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                }
            }
        case .table(let header, let rows):
            MarkdownTable(header: header, rows: rows)
        }
    }
}

/// GFM table renderer — uses a horizontal ScrollView so wide
/// tables stay readable on phone screens instead of being
/// crushed into one-character columns. Header row uses faint
/// mono caps, body rows alternate surface fills for readability.
private struct MarkdownTable: View {
    let header: [String]
    let rows: [[String]]

    private let cellMinWidth: CGFloat = 100

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 0) {
                    ForEach(header.indices, id: \.self) { i in
                        Text(header[i])
                            .font(Brand.mono(size: 10, weight: .medium))
                            .tracking(0.8)
                            .foregroundStyle(Brand.textFaint)
                            .textCase(.uppercase)
                            .frame(minWidth: cellMinWidth, alignment: .leading)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                    }
                }
                .background(Brand.surface)
                Rectangle().fill(Brand.borderDim).frame(height: 0.5)
                ForEach(rows.indices, id: \.self) { r in
                    HStack(spacing: 0) {
                        ForEach(0..<header.count, id: \.self) { c in
                            let cell = c < rows[r].count ? rows[r][c] : ""
                            InlineMarkdown(text: cell)
                                .font(Brand.body(size: 13))
                                .foregroundStyle(Brand.textPrimary)
                                .frame(minWidth: cellMinWidth, alignment: .leading)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                        }
                    }
                    .background(r.isMultiple(of: 2) ? Color.clear : Brand.surface.opacity(0.5))
                    if r < rows.count - 1 {
                        Rectangle().fill(Brand.borderDim.opacity(0.5)).frame(height: 0.5)
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Brand.borderDim, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }
}

// MARK: - Image block

private struct MarkdownImage: View {
    let alt: String
    let urlString: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        Rectangle()
                            .fill(Brand.surface)
                            .overlay(
                                ProgressView().scaleEffect(0.6).tint(Brand.textFaint)
                            )
                            .frame(maxWidth: .infinity, minHeight: 140)
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxWidth: .infinity)
                    case .failure:
                        Rectangle()
                            .fill(Brand.surface)
                            .overlay(
                                VStack(spacing: 4) {
                                    Image(systemName: "photo.badge.exclamationmark")
                                        .font(.system(size: 18))
                                        .foregroundStyle(Brand.textFaint)
                                    Text("Couldn't load image")
                                        .font(Brand.mono(size: 10))
                                        .foregroundStyle(Brand.textFaint)
                                }
                            )
                            .frame(maxWidth: .infinity, minHeight: 100)
                    @unknown default:
                        EmptyView()
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 1)
                )
            }
            if !alt.isEmpty {
                Text(alt)
                    .font(Brand.body(size: 11))
                    .foregroundStyle(Brand.textFaint)
                    .italic()
            }
        }
    }
}

// MARK: - Heading

private struct HeadingView: View {
    let level: Int
    let text: String

    private var size: CGFloat {
        switch level {
        case 1: return 26
        case 2: return 22
        case 3: return 18
        default: return 16
        }
    }

    var body: some View {
        Text(text)
            .font(Brand.display(size: size))
            .foregroundStyle(Brand.textPrimary)
            .tracking(0)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, level == 1 ? 6 : 12)
            .padding(.bottom, level <= 2 ? 2 : 0)
            .textSelection(.enabled)
    }
}

// MARK: - Code block

private struct CodeBlockView: View {
    let lang: String?
    let source: String
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header strip — language label on the left, copy
            // button on the right. Always rendered (no lang label
            // when missing, but we keep the copy affordance).
            HStack(spacing: 0) {
                if let lang, !lang.isEmpty {
                    Text(lang.uppercased())
                        .font(Brand.mono(size: 9, weight: .medium))
                        .tracking(0.6)
                        .foregroundStyle(Brand.textMuted)
                } else {
                    Text("CODE")
                        .font(Brand.mono(size: 9, weight: .medium))
                        .tracking(0.6)
                        .foregroundStyle(Brand.textMuted)
                }
                Spacer()
                Button {
                    UIPasteboard.general.string = source
                    Haptics.success()
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { copied = false }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 10, weight: .medium))
                        Text(copied ? "COPIED" : "COPY")
                            .font(Brand.mono(size: 9, weight: .medium))
                            .tracking(0.6)
                    }
                    .foregroundStyle(Brand.textPrimary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            // Header strip needs to read as a SEPARATE band from
            // the dark canvas below. `Brand.canvas` is darker than
            // the doc page background so the strip was invisible
            // — use a brighter zinc surface + visible bottom rule.
            .background(Brand.border.opacity(0.5))
            .overlay(alignment: .bottom) {
                Rectangle().fill(Brand.border).frame(height: 1)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                Text(source)
                    .font(Brand.mono(size: 12))
                    .foregroundStyle(Brand.textPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .textSelection(.enabled)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Brand.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Brand.borderDim, lineWidth: 1)
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

// MARK: - Inline

/// SwiftUI's AttributedString markdown init handles **bold**,
/// *italic*, `code`, [text](url) — covers ~95% of inline syntax
/// without us writing a parser. Falls back to plain text on the
/// rare parse failure.
private struct InlineMarkdown: View {
    let text: String

    var body: some View {
        if let attr = try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            Text(attr)
                .tint(Brand.textPrimary)
        } else {
            Text(text)
        }
    }
}

#Preview {
    ScrollView {
        MarkdownBody(markdown: """
        # The Big Idea

        Memory.Wiki is your knowledge hub for the AI age. **Capture** from anywhere,
        let AI organize, paste *one URL* into Claude / ChatGPT / Cursor.

        ## How it works

        1. Capture from any app
        2. AI organizes in the background
        3. Paste your `@username` URL — every AI fetches markdown

        ## Code sample

        ```swift
        let url = URL(string: "https://memory.wiki/@you")!
        UIPasteboard.general.string = "Use \\(url) as my context."
        ```

        > One URL, every AI. That's the wedge.

        ---

        - Cross-AI = structurally hard for giants
        - URL = the smallest possible API
        - Companion mobile app keeps capture fast
        """)
        .padding(16)
    }
    .background(Brand.background)
}
