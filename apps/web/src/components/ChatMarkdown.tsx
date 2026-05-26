"use client";

// Shared markdown renderer for chat panels (Doc / Bundle / Hub).
//
// Why not the WASM engine? Streamed deltas need a renderer that can
// handle partial input (a `**` may not be closed yet) without
// allocating a fresh WASM instance per token. This is a thin
// markdown subset tuned for chat: paragraphs, headings, lists,
// fenced code, plus inline bold/italic/code/citation chip.
//
// Why not the previous regex-on-string approach? It produced
// block-level elements inside an inline <span>, with stray <br/> tags
// between list <div>s — the browser handled it but rendered uneven
// spacing and broke list grouping. This renderer outputs a real React
// tree of <p> / <ul> / <ol> / <pre> blocks, citations rendered inside
// their host inline so paragraph flow stays intact.

import React from "react";
import { ScrollText } from "lucide-react";

export interface CitationDescriptor {
  /** What to show inside the chip (e.g., "abc123" or "1") */
  label: string;
  /** Full doc id passed to onCitationClick */
  docId: string;
  /** Optional title for the chip's title attribute */
  title?: string;
}

export interface ChatMarkdownProps {
  content: string;
  accent: string;
  accentDim: string;
  /** How citations look in the source text. The matcher returns the
   *  CitationDescriptor for the matched substring, or null to leave
   *  the substring as plain text. */
  citationRegex: RegExp;
  resolveCitation: (match: RegExpExecArray) => CitationDescriptor | null;
  onCitationClick?: (docId: string) => void;
}

type Block =
  | { type: "p"; text: string }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string; lang?: string }
  | { type: "blockquote"; text: string };

const HEADING = /^(#{1,3})\s+(.+)$/;
const BULLET = /^\s*[-*]\s+(.+)$/;
const NUMBERED = /^\s*\d+\.\s+(.+)$/;
const CODE_FENCE = /^```(\S*)\s*$/;
const QUOTE = /^>\s?(.*)$/;

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block — pass through as-is, no inline formatting inside.
    const fence = CODE_FENCE.exec(line);
    if (fence) {
      const lang = fence[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !CODE_FENCE.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing ```
      blocks.push({ type: "code", text: codeLines.join("\n"), lang });
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      i++;
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(BULLET.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (NUMBERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBERED.test(lines[i])) {
        items.push(NUMBERED.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (QUOTE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoteLines.push(QUOTE.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph: collect contiguous non-empty, non-block lines.
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (HEADING.test(next) || BULLET.test(next) || NUMBERED.test(next) || CODE_FENCE.test(next) || QUOTE.test(next)) break;
      paraLines.push(next);
      i++;
    }
    blocks.push({ type: "p", text: paraLines.join(" ") });
  }
  return blocks;
}

// Inline tokenizer — splits text into ordered tokens of:
//   { kind: "text", value }
//   { kind: "bold", value }
//   { kind: "italic", value }
//   { kind: "code", value }
//   { kind: "citation", descriptor }
// Citation regex is matched first so a citation inside `**...**`
// still becomes a chip (rare but possible).
type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "citation"; descriptor: CitationDescriptor };

function tokenizeInline(text: string, citationRegex: RegExp, resolveCitation: ChatMarkdownProps["resolveCitation"]): InlineToken[] {
  // Pass 1 — extract citation chips, leaving placeholders for plain text.
  const segments: Array<{ text: string } | { citation: CitationDescriptor }> = [];
  let lastIndex = 0;
  // Reset the regex lastIndex (caller-provided regex may be reused).
  const re = new RegExp(citationRegex.source, citationRegex.flags.includes("g") ? citationRegex.flags : citationRegex.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) segments.push({ text: text.slice(lastIndex, m.index) });
    const desc = resolveCitation(m);
    if (desc) segments.push({ citation: desc });
    else segments.push({ text: m[0] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });

  // Pass 2 — for each plain-text segment, run inline bold/italic/code.
  const tokens: InlineToken[] = [];
  for (const seg of segments) {
    if ("citation" in seg) {
      tokens.push({ kind: "citation", descriptor: seg.citation });
      continue;
    }
    tokens.push(...tokenizeFormatting(seg.text));
  }
  return tokens;
}

function tokenizeFormatting(text: string): InlineToken[] {
  // Greedy left-to-right scan picking the earliest match of `code`, **bold**, *italic*.
  const tokens: InlineToken[] = [];
  let rest = text;
  while (rest.length > 0) {
    const codeM = /`([^`\n]+)`/.exec(rest);
    const boldM = /\*\*([^*\n]+)\*\*/.exec(rest);
    const italicM = /(^|[^*])\*([^*\n]+)\*/.exec(rest);
    const candidates: Array<{ idx: number; len: number; kind: "bold" | "italic" | "code"; value: string; prefix?: string }> = [];
    if (codeM) candidates.push({ idx: codeM.index, len: codeM[0].length, kind: "code", value: codeM[1] });
    if (boldM) candidates.push({ idx: boldM.index, len: boldM[0].length, kind: "bold", value: boldM[1] });
    if (italicM) candidates.push({ idx: italicM.index + italicM[1].length, len: italicM[2].length + 2, kind: "italic", value: italicM[2], prefix: italicM[1] });
    if (candidates.length === 0) {
      tokens.push({ kind: "text", value: rest });
      break;
    }
    candidates.sort((a, b) => a.idx - b.idx);
    const pick = candidates[0];
    if (pick.idx > 0) tokens.push({ kind: "text", value: rest.slice(0, pick.idx) });
    tokens.push({ kind: pick.kind, value: pick.value });
    rest = rest.slice(pick.idx + pick.len);
  }
  return tokens;
}

function InlineRender({ tokens, accent, accentDim, onCitationClick }: { tokens: InlineToken[]; accent: string; accentDim: string; onCitationClick?: (docId: string) => void }) {
  return (
    <>
      {tokens.map((tok, i) => {
        switch (tok.kind) {
          case "text":
            return <React.Fragment key={i}>{tok.value}</React.Fragment>;
          case "bold":
            return <strong key={i}>{tok.value}</strong>;
          case "italic":
            return <em key={i}>{tok.value}</em>;
          case "code":
            return (
              <code
                key={i}
                style={{
                  background: "var(--toggle-bg)",
                  padding: "1px 5px",
                  borderRadius: 3,
                  fontSize: "0.9em",
                  wordBreak: "break-all",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {tok.value}
              </code>
            );
          case "citation": {
            const d = tok.descriptor;
            return (
              <button
                key={i}
                onClick={() => onCitationClick?.(d.docId)}
                title={d.title || `Open doc ${d.docId}`}
                className="inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded text-caption font-mono font-semibold transition-colors hover:brightness-125 align-baseline"
                style={{ background: accentDim, color: accent, verticalAlign: "baseline" }}
              >
                <ScrollText width={9} height={9} style={{ marginRight: 3 }} />
                {d.label}
              </button>
            );
          }
        }
      })}
    </>
  );
}

export default function ChatMarkdown({ content, accent, accentDim, citationRegex, resolveCitation, onCitationClick }: ChatMarkdownProps) {
  const blocks = parseBlocks(content);
  return (
    <div className="chat-md flex flex-col gap-2 min-w-0" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "p":
            return (
              <p key={i} style={{ margin: 0, lineHeight: 1.55 }}>
                <InlineRender
                  tokens={tokenizeInline(b.text, citationRegex, resolveCitation)}
                  accent={accent}
                  accentDim={accentDim}
                  onCitationClick={onCitationClick}
                />
              </p>
            );
          case "h": {
            const fontSize = b.level === 1 ? 15 : b.level === 2 ? 14 : 13;
            return (
              <div key={i} style={{ fontSize, fontWeight: 700, color: "var(--text-primary)", marginTop: i === 0 ? 0 : 6, marginBottom: 2, letterSpacing: 0.1 }}>
                <InlineRender
                  tokens={tokenizeInline(b.text, citationRegex, resolveCitation)}
                  accent={accent}
                  accentDim={accentDim}
                  onCitationClick={onCitationClick}
                />
              </div>
            );
          }
          case "ul":
            return (
              <ul key={i} style={{ margin: 0, paddingLeft: 18, listStyleType: "disc", display: "flex", flexDirection: "column", gap: 2 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ lineHeight: 1.5, color: "var(--text-primary)" }}>
                    <InlineRender
                      tokens={tokenizeInline(it, citationRegex, resolveCitation)}
                      accent={accent}
                      accentDim={accentDim}
                      onCitationClick={onCitationClick}
                    />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} style={{ margin: 0, paddingLeft: 20, listStyleType: "decimal", display: "flex", flexDirection: "column", gap: 2 }}>
                {b.items.map((it, j) => (
                  <li key={j} style={{ lineHeight: 1.5, color: "var(--text-primary)" }}>
                    <InlineRender
                      tokens={tokenizeInline(it, citationRegex, resolveCitation)}
                      accent={accent}
                      accentDim={accentDim}
                      onCitationClick={onCitationClick}
                    />
                  </li>
                ))}
              </ol>
            );
          case "blockquote":
            return (
              <div
                key={i}
                style={{
                  borderLeft: `2px solid ${accentDim}`,
                  paddingLeft: 10,
                  color: "var(--text-secondary)",
                  fontStyle: "italic",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                <InlineRender
                  tokens={tokenizeInline(b.text, citationRegex, resolveCitation)}
                  accent={accent}
                  accentDim={accentDim}
                  onCitationClick={onCitationClick}
                />
              </div>
            );
          case "code":
            return (
              <pre
                key={i}
                style={{
                  margin: 0,
                  padding: "8px 10px",
                  background: "var(--toggle-bg)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: 6,
                  overflowX: "auto",
                  maxWidth: "100%",
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "var(--text-primary)",
                    whiteSpace: "pre",
                    display: "block",
                  }}
                >
                  {b.text}
                </code>
              </pre>
            );
        }
      })}
    </div>
  );
}
