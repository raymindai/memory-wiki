/**
 * File import: convert various formats to Markdown.
 * Supports: .md, .txt, .html, .docx, .pdf, .csv, .json, .xml, .rtf, .rst, .tex
 */

import { htmlToMarkdown } from "./html-to-md";

// ─── PDF ───
// Uses server-side API (pdfjs-dist via unpdf for text) — auth headers
// are forwarded so the server can attribute extracted images to the
// caller. Without them the server's anonymous branch skips image
// extraction entirely.
async function pdfToMarkdown(file: File, authHeaders: Record<string, string> = {}): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/import/pdf", { method: "POST", body: formData, headers: authHeaders });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to parse PDF" }));
    throw new Error(err.error);
  }

  const { text, title } = await res.json();
  let md = text || "";

  // Add title as heading if available
  if (title) {
    md = `# ${title}\n\n${md}`;
  }

  return md;
}

// ─── Office files (PPTX, XLSX, ODP, etc.) ───
async function officeToMarkdown(file: File, authHeaders: Record<string, string> = {}): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/import/office", { method: "POST", body: formData, headers: authHeaders });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to parse file" }));
    throw new Error(err.error);
  }

  const { text } = await res.json();
  return text || "";
}

// ─── DOCX (Word) ───
async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return htmlToMarkdown(result.value);
}

// ─── CSV → Markdown table ───
function csvToMarkdown(text: string): string {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return text;

  // Simple CSV parser (handles quoted fields)
  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const rows = lines.map(parseRow);
  const colCount = Math.max(...rows.map((r) => r.length));

  // Pad rows to same length
  const padded = rows.map((r) => {
    while (r.length < colCount) r.push("");
    return r;
  });

  // Build markdown table
  const header = `| ${padded[0].join(" | ")} |`;
  const separator = `| ${padded[0].map(() => "---").join(" | ")} |`;
  const body = padded
    .slice(1)
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");

  return [header, separator, body].join("\n");
}

// ─── JSON → fenced code block ───
function jsonToMarkdown(text: string): string {
  try {
    const parsed = JSON.parse(text);
    const pretty = JSON.stringify(parsed, null, 2);
    return "```json\n" + pretty + "\n```";
  } catch {
    return "```json\n" + text + "\n```";
  }
}

// ─── XML → fenced code block ───
function xmlToMarkdown(text: string): string {
  return "```xml\n" + text + "\n```";
}

// ─── HTML file → Markdown ───
function htmlFileToMarkdown(text: string): string {
  // Extract body content if full HTML document
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : text;
  return htmlToMarkdown(content);
}

// ─── RTF → plain text (basic extraction) ───
function rtfToMarkdown(text: string): string {
  // Strip RTF control words and groups, extract plain text
  const result = text
    .replace(/\{\\fonttbl[^}]*\}/g, "")
    .replace(/\{\\colortbl[^}]*\}/g, "")
    .replace(/\{\\stylesheet[^}]*\}/g, "")
    .replace(/\{\\info[^}]*\}/g, "")
    .replace(/\\par\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\line\b/g, "\n")
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\[a-z]+\d*\s?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return result;
}

// ─── LaTeX → basic Markdown ───
function latexToMarkdown(text: string): string {
  const md = text
    // Document structure
    .replace(/\\documentclass\{[^}]*\}/g, "")
    .replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\begin\{document\}/g, "")
    .replace(/\\end\{document\}/g, "")
    .replace(/\\maketitle/g, "")
    // Metadata
    .replace(/\\title\{([^}]*)\}/g, "# $1\n")
    .replace(/\\author\{([^}]*)\}/g, "*$1*\n")
    .replace(/\\date\{([^}]*)\}/g, "*$1*\n")
    // Sections
    .replace(/\\section\*?\{([^}]*)\}/g, "## $1")
    .replace(/\\subsection\*?\{([^}]*)\}/g, "### $1")
    .replace(/\\subsubsection\*?\{([^}]*)\}/g, "#### $1")
    // Formatting
    .replace(/\\textbf\{([^}]*)\}/g, "**$1**")
    .replace(/\\textit\{([^}]*)\}/g, "*$1*")
    .replace(/\\emph\{([^}]*)\}/g, "*$1*")
    .replace(/\\texttt\{([^}]*)\}/g, "`$1`")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    // Lists
    .replace(/\\begin\{itemize\}/g, "")
    .replace(/\\end\{itemize\}/g, "")
    .replace(/\\begin\{enumerate\}/g, "")
    .replace(/\\end\{enumerate\}/g, "")
    .replace(/\\item\s*/g, "- ")
    // Math
    .replace(/\$\$([^$]+)\$\$/g, "\n$$\n$1\n$$\n")
    .replace(/\\\[([^\]]+)\\\]/g, "\n$$\n$1\n$$\n")
    .replace(/\\\(([^)]+)\\\)/g, "$$$1$$")
    // Code
    .replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, "```\n$1\n```")
    .replace(/\\verb\|([^|]*)\|/g, "`$1`")
    // Links
    .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, "[$2]($1)")
    .replace(/\\url\{([^}]*)\}/g, "<$1>")
    // Images
    .replace(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g, "![]($2)")
    // Environments
    .replace(/\\begin\{quote\}/g, "> ")
    .replace(/\\end\{quote\}/g, "")
    .replace(/\\begin\{center\}/g, "")
    .replace(/\\end\{center\}/g, "")
    // Clean up
    .replace(/\\\\(\s)/g, "\n")
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1") // fallback: extract content from unknown commands
    .replace(/\\[a-zA-Z]+/g, "") // remove remaining commands
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return md;
}

// ─── RST (reStructuredText) → Markdown ───
function rstToMarkdown(text: string): string {
  const md = text
    // Title underlines → headings
    .replace(/^(.+)\n={3,}\s*$/gm, "# $1")
    .replace(/^(.+)\n-{3,}\s*$/gm, "## $1")
    .replace(/^(.+)\n~{3,}\s*$/gm, "### $1")
    .replace(/^(.+)\n\^{3,}\s*$/gm, "#### $1")
    // Inline formatting
    .replace(/\*\*([^*]+)\*\*/g, "**$1**")
    .replace(/\*([^*]+)\*/g, "*$1*")
    .replace(/``([^`]+)``/g, "`$1`")
    // Links
    .replace(/`([^<]+)<([^>]+)>`_/g, "[$1]($2)")
    // Directives
    .replace(/\.\. code-block::\s*(\w+)/g, "```$1")
    .replace(/\.\. image::\s*(.+)/g, "![]($1)")
    .replace(/\.\. note::/g, "> **Note:**")
    .replace(/\.\. warning::/g, "> **Warning:**")
    // Clean up
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return md;
}

// ─── Main import function ───
export type ImportFormat =
  | "md"
  | "txt"
  | "html"
  | "docx"
  | "pdf"
  | "csv"
  | "json"
  | "xml"
  | "rtf"
  | "rst"
  | "tex"
  | "office";

const SUPPORTED_EXTENSIONS: Record<string, ImportFormat> = {
  ".md": "md",
  ".markdown": "md",
  ".txt": "txt",
  ".text": "txt",
  ".html": "html",
  ".htm": "html",
  ".docx": "docx",
  ".pdf": "pdf",
  ".csv": "csv",
  ".tsv": "csv",
  ".json": "json",
  ".jsonl": "json",
  ".xml": "xml",
  ".svg": "xml",
  ".rtf": "rtf",
  ".rst": "rst",
  ".rest": "rst",
  ".tex": "tex",
  ".latex": "tex",
  ".pptx": "office",
  ".ppt": "office",
  ".xlsx": "office",
  ".xls": "office",
  ".odp": "office",
  ".ods": "office",
  ".odt": "office",
};

export function getFormatFromFilename(filename: string): ImportFormat | null {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? SUPPORTED_EXTENSIONS[ext] || null : null;
}

export function getSupportedAcceptString(): string {
  return Object.keys(SUPPORTED_EXTENSIONS)
    .map((ext) => ext)
    .join(",");
}

export interface MdfyResult {
  markdown: string;
  truncated?: boolean;
  finishReason?: string;
}

/**
 * Send raw text to AI for markdown structuring.
 * Returns structured markdown (+ metadata) or throws on failure.
 */
export async function mdfyText(text: string, filename?: string): Promise<MdfyResult> {
  // Unified with the doc-level Auto-Format quick action — both routes
  // used to live separately (/api/import/memory.wiki vs /api/ai action=format)
  // with subtly different prompts, so importing + "Structure it" produced a
  // slightly different result than running Auto-Format on the same
  // text. Calling the same endpoint guarantees identical behaviour.
  // filename is no longer passed to the prompt; the format action
  // operates on raw text regardless of source. 3MB input cap is
  // enforced server-side.
  void filename;
  const MAX_INPUT_BYTES = 3 * 1024 * 1024;
  const truncated = text.length > MAX_INPUT_BYTES;
  const trimmed = truncated ? text.slice(0, MAX_INPUT_BYTES) : text;
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "format", markdown: trimmed }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "AI processing failed" }));
    throw new Error(err.error || "AI processing failed");
  }
  const data = await res.json();
  return {
    markdown: data.result || "",
    truncated,
    finishReason: data.finishReason,
  };
}

export async function importFile(
  file: File,
  authHeaders: Record<string, string> = {},
): Promise<{ markdown: string; title: string }> {
  const format = getFormatFromFilename(file.name);
  const title = file.name.replace(/\.[^.]+$/, "");

  if (!format) {
    // Check if file is likely text (not binary)
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
    const binaryExts = [".zip", ".rar", ".7z", ".gz", ".tar", ".exe", ".dmg", ".pkg", ".app", ".iso", ".bin", ".dat", ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".wav", ".flac", ".ogg", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp", ".ico", ".psd", ".ai", ".eps", ".indd"];
    if (binaryExts.includes(ext)) {
      throw new Error(`Unsupported format: ${ext}. Supported: MD, PDF, DOCX, PPTX, XLSX, HTML, CSV, LaTeX, RST, RTF, JSON, XML, TXT`);
    }
    // Fallback: try to read as text
    const text = await file.text();
    return { markdown: text, title };
  }

  // PDF: server-side API
  if (format === "pdf") {
    const markdown = await pdfToMarkdown(file, authHeaders);
    return { markdown, title };
  }

  // DOCX: client-side via mammoth
  if (format === "docx") {
    const buffer = await file.arrayBuffer();
    const markdown = await docxToMarkdown(buffer);
    return { markdown, title };
  }

  // Office (PPTX, XLSX, ODP, etc.): server-side API
  if (format === "office") {
    const markdown = await officeToMarkdown(file, authHeaders);
    return { markdown, title };
  }

  // Text formats
  const text = await file.text();

  let markdown: string;
  switch (format) {
    case "md":
    case "txt":
      markdown = text;
      break;
    case "html":
      markdown = htmlFileToMarkdown(text);
      break;
    case "csv":
      markdown = csvToMarkdown(text);
      break;
    case "json":
      markdown = jsonToMarkdown(text);
      break;
    case "xml":
      markdown = xmlToMarkdown(text);
      break;
    case "rtf":
      markdown = rtfToMarkdown(text);
      break;
    case "rst":
      markdown = rstToMarkdown(text);
      break;
    case "tex":
      markdown = latexToMarkdown(text);
      break;
    default:
      markdown = text;
  }

  return { markdown, title };
}
