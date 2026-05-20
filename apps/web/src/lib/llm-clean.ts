/**
 * LLM-driven markdown structuring for ingested raw text.
 *
 * Used by PDF / DOCX / scanned-paste pipelines that produce flat text
 * with no formatting. Routes the call through the same provider chain
 * the rest of memory.wiki uses: Anthropic > OpenAI > Gemini.
 *
 * Returns null when no provider is configured or when every provider in
 * the chain fails. Callers should fall back to the raw text in that case
 * so the user's import still lands somewhere.
 */

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

  if (process.env.ANTHROPIC_API_KEY) {
    const out = await runAnthropic(userPrompt, process.env.ANTHROPIC_API_KEY);
    if (out) return out;
  }
  if (process.env.OPENAI_API_KEY) {
    const out = await runOpenAI(userPrompt, process.env.OPENAI_API_KEY);
    if (out) return out;
  }
  if (process.env.GEMINI_API_KEY) {
    const out = await runGemini(userPrompt, process.env.GEMINI_API_KEY);
    if (out) return out;
  }
  return null;
}

async function runAnthropic(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}

async function runOpenAI(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 8192,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}

async function runGemini(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 32768 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}
