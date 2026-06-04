/**
 * LLM-driven markdown structuring for ingested raw text.
 *
 * Used by PDF / DOCX / scanned-paste pipelines that produce flat text
 * with no formatting. Routes through the shared cost-first cascade
 * (callAI). Returns null when the whole cascade fails so callers fall
 * back to the raw text.
 */

import { callAI } from "@/lib/ai-providers";

interface CleanOptions {
  /** Optional filename for context (helps with title detection). */
  filenameHint?: string;
  /** Human-readable source type ("PDF", "DOCX") for the prompt. */
  sourceLabel?: string;
}

const MAX_INPUT_BYTES = 3 * 1024 * 1024; // 3 MB cap; ~750k tokens worst case

const SYSTEM_PROMPT = `You are an expert at restructuring raw text into clean Markdown.

Rules:
- Detect headings, lists, tables, code blocks, blockquotes, and inline emphasis.
- Use # ## ### appropriately. Detect lists as - or 1. 2. 3.
- Wrap code in fenced blocks with language hints when you can identify the language.
- Preserve every word of the original content. Do NOT summarize, skip, paraphrase, or reorder.
- For non-English text, keep the original language.
- Output ONLY the Markdown. No explanations. No fences around the whole document.
- If the text is already well-structured, just clean it minimally.`;

export async function cleanMarkdownStructure(
  rawText: string,
  opts: CleanOptions = {},
): Promise<string | null> {
  if (!rawText || !rawText.trim()) return null;

  const trimmed = rawText.length > MAX_INPUT_BYTES ? rawText.slice(0, MAX_INPUT_BYTES) : rawText;
  const sourceLabel = opts.sourceLabel || "document";
  const filenameLine = opts.filenameHint ? ` named "${opts.filenameHint}"` : "";
  const userPrompt = `Restructure the following text extracted from a ${sourceLabel}${filenameLine}. The extraction lost all formatting; recover the structure as clean Markdown.\n\nRaw text:\n---\n${trimmed}\n---\n\nStructured Markdown:`;

  const result = await callAI({
    prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
    useLiteModel: false,
    temperature: 0.1,
    maxOutputTokens: 8192,
  });
  if (!result.ok) return null;
  const text = result.text.trim();
  return text || null;
}
