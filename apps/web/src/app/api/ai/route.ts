import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AIAction =
  | "polish"
  | "summary"
  | "tldr"
  | "translate"
  | "chat"
  | "visitor_chat"
  | "beautify"
  | "compact"
  | "format"
  | "selection_polish"
  | "selection_shorten"
  | "selection_expand"
  | "selection_rewrite"
  | "selection_translate";

const PROMPTS: Record<Exclude<AIAction, "chat" | "visitor_chat" | "translate" | "selection_rewrite" | "selection_translate">, string> = {
  polish: `You are an expert editor. Polish the following Markdown document:
- Fix grammar, spelling, and punctuation errors
- Improve clarity and readability
- Ensure consistent tone and style
- Clean up Markdown formatting (proper headings, lists, emphasis)
- Do NOT change the meaning or remove any content
- Do NOT add new information
- Preserve the original language
- Output ONLY the polished Markdown — no explanations, no wrapping`,

  summary: `You are an expert at summarizing documents. Write a concise summary of the following Markdown document:
- 2-4 sentences that capture the key points
- Written in the same language as the original
- Output ONLY the summary text as a single paragraph — no headings, no wrapping, no explanations`,

  beautify: `You are an expert technical illustrator. Take the input (which may be ASCII art, a rough diagram, or a plain code block) and redraw it as a polished Mermaid diagram.

ALWAYS output a Mermaid diagram inside a single \`\`\`mermaid fence. Pick the diagram type that best fits the content:
- Process / system / relationship → \`graph LR\` or \`graph TD\` flowchart with subgraphs
- Hierarchy → \`graph TD\` with subgraphs
- Decision logic → \`graph TD\` with diamond decision nodes
- Sequence of steps between actors → \`sequenceDiagram\`
- State machine → \`stateDiagram-v2\`
- Class / data model → \`classDiagram\` or \`erDiagram\`

When producing Mermaid:
- Use subgraphs to group related nodes
- Add classDef styles for visual variety (use orange #fb923c for the key/important nodes, and zinc shades #27272a/#3f3f46 for supporting ones, with white #fafafa text)
- Use shape syntax: \`A["Process"]\`, \`B(("Start/End"))\`, \`C{"Decision"}\`, \`D[/"Input"/]\`, \`E[("Database")]\`
- **CRITICAL: ALWAYS wrap every node label in double quotes** — \`A["any text"]\` not \`A[any text]\`. This prevents parse errors when labels contain \`{ } ( ) / \\ | : . , < > # @ %\` or whitespace. NEVER write \`G[memory.wiki/{id}]\` — write \`G["memory.wiki/{id}"]\`.
- Add edge labels where they clarify relationships: \`A -->|"label"| B\` (also quoted)
- Use only ASCII characters in node IDs (left of the bracket): A, B1, node_x — never spaces or punctuation
- Choose direction (LR or TD) that fits the content best
- Keep node text concise

Output ONLY the final Markdown — no commentary, no explanations, no surrounding prose.`,

  tldr: `You are an expert at creating TL;DR sections. Create a TL;DR for the following Markdown document:
- 2-5 bullet points covering the most important takeaways
- Each bullet should be one clear, actionable sentence
- Written in the same language as the original
- Format as a Markdown list with - prefix
- Output ONLY the bullet list — no headings, no "TL;DR:" prefix, no wrapping, no explanations
- Do NOT include any part of the original document in your output
- Do NOT include code blocks, diagrams, or any content from the source — only the bullet points`,

  format: `You are an expert markdown editor. Take the raw text below and structure it as clean, well-formatted Markdown:
- Add appropriate headings (## / ###) where the text shifts topic or section
- Break runs of prose into paragraphs
- Detect lists hidden in prose (e.g., "First, ... Second, ... Third, ...") and render as Markdown lists (- or 1.)
- Detect tables hidden in prose / pipe-or-tab-separated rows and render as Markdown tables
- Detect quotes (lines beginning with someone's name + ":" or attribution) and render as > blockquotes
- Detect code / commands / file paths and wrap with backticks or fenced \`\`\` blocks as appropriate
- Preserve every distinct fact / sentence — do NOT summarize, abbreviate, or drop content
- Preserve the original language
- Do NOT add new information or commentary
- Output ONLY the formatted Markdown — no preamble, no explanation, no surrounding fences`,

  compact: `You are an expert editor specializing in concise writing. Compact the following Markdown document:
- Cut the length by roughly half while preserving every distinct idea
- Keep ALL headings, code blocks, math, diagrams (mermaid), tables, and links exactly as they are
- Tighten prose: remove filler, redundancy, throat-clearing, hedges
- Merge short adjacent paragraphs when they cover one idea
- Convert long enumerations to tighter bullet lists when it shortens them
- Preserve the original language, structure, and section order
- Do NOT drop any heading, code block, table, image, math expression, or diagram
- Do NOT add new information, opinions, or sections
- Output ONLY the compacted Markdown — no commentary, no wrapping fences`,

  selection_polish: `You are an expert editor. Polish ONLY the snippet below:
- Fix grammar, spelling, punctuation
- Improve clarity and flow
- Preserve meaning, tone, language, and any inline Markdown formatting
- Do NOT add new ideas, do NOT explain
- Output ONLY the polished snippet text — no quotes, no wrapping, no "Here is…"`,

  selection_shorten: `You are an expert editor. Shorten the snippet below:
- Cut length by roughly half while preserving the core meaning
- Preserve language and any inline Markdown formatting
- Do NOT add information
- Output ONLY the shortened snippet — no quotes, no wrapping, no explanations`,

  selection_expand: `You are an expert writer. Expand the snippet below with substance:
- Add concrete detail, examples, or clarification that genuinely deepen the idea
- Do NOT pad with filler, repetition, or generic statements
- Preserve language, tone, and the original meaning
- Preserve any inline Markdown formatting
- Output ONLY the expanded snippet — no quotes, no wrapping, no explanations`,
};

function buildTranslatePrompt(targetLang: string): string {
  return `You are an expert translator. Translate the following Markdown document into ${targetLang}:
- Translate ALL text content accurately
- Preserve all Markdown formatting (headings, lists, tables, code blocks, links, emphasis)
- Do NOT translate code inside code blocks
- Do NOT translate URLs
- Preserve the document structure exactly
- Output ONLY the translated Markdown — no explanations, no wrapping`;
}

function buildSelectionTranslatePrompt(targetLang: string): string {
  return `You are an expert translator. Translate the snippet below into ${targetLang}:
- Translate accurately and naturally
- Preserve any inline Markdown formatting (bold, italic, code, links)
- Do NOT translate code inside code blocks or URLs
- Output ONLY the translated snippet — no quotes, no wrapping, no explanations`;
}

function buildSelectionRewritePrompt(instruction: string): string {
  const sanitized = instruction
    .replace(/["""]/g, "'")
    .replace(/\n/g, " ")
    .slice(0, 500);
  return `You are an expert editor. Rewrite the snippet below according to the user's instruction.

<instruction>${sanitized}</instruction>

Rules:
- Apply the instruction faithfully to the snippet
- Preserve any inline Markdown formatting unless the instruction says otherwise
- Do NOT explain what you did, do NOT prefix or wrap with quotes
- Output ONLY the rewritten snippet`;
}

/**
 * Visitor-facing chat prompt. Distinct from buildChatPrompt because
 * the visitor surface (/d/<id>'s Ask AI panel) is read-only — there
 * is no editing affordance for a visitor, so any "modify the doc"
 * branch is nonsense. The editor's chat path has three intents
 * (QUESTION / EDIT / CASUAL) and EDIT returns the entire document
 * body; that fell through to the visitor panel, so asking "TLDR"
 * returned "TLDR + whole doc". This prompt forces the model into
 * answer-only mode: never return the doc, never use ANSWER:/EDIT:
 * prefixes, just say the thing.
 */
function buildVisitorChatPrompt(instruction: string): string {
  const sanitized = instruction
    .replace(/["""]/g, "'")
    .replace(/\n/g, " ")
    .slice(0, 500);
  return `You are answering a reader's question about a document they're viewing.

The reader's question is between the <question> tags below.

<question>${sanitized}</question>

Rules:
- Answer using ONLY information from the document.
- Be concise and direct. Bullet points or short paragraphs are fine.
- If the reader asks for a TL;DR, summary, or list, output ONLY that — do NOT include the source document body in your reply.
- If the question can't be answered from the document, say so briefly.
- Do NOT prefix your reply with "ANSWER:", "EDIT:", or any tag.
- Do NOT echo the document. Do NOT quote large chunks. Cite sparingly when needed for clarity.
- Do NOT suggest edits. You are a reader, not an editor.
- Preserve the document's original language in your answer when natural.`;
}

function buildChatPrompt(instruction: string): string {
  // Sanitize instruction to prevent prompt injection
  const sanitized = instruction
    .replace(/["""]/g, "'")
    .replace(/\n/g, " ")
    .slice(0, 500);
  return `You are an expert document editor AI. You modify Markdown documents based on user instructions.

The user's instruction is between the <instruction> tags below.

<instruction>${sanitized}</instruction>

Determine the intent:
A) QUESTION — user is asking about the document content (e.g. "what does this say?", "explain this")
B) EDIT — user wants to modify the document (e.g. "add a section", "move this to the top", "rewrite the intro", "summarize and add at top")
C) CASUAL — greeting or unrelated (e.g. "ok", "thanks", "hi")

Rules:
- If A: Respond with "ANSWER:" followed by your concise answer. No markdown formatting.
- If B: Respond with "EDIT:" followed by the COMPLETE modified document in Markdown.
  CRITICAL for edits:
  - Output the ENTIRE document from start to finish, with the requested changes applied.
  - Preserve ALL existing content that was not asked to be changed.
  - Preserve all code blocks, math equations, diagrams, tables exactly as they are.
  - Only modify what the user explicitly asked to change.
  - If adding content, integrate it naturally into the document structure.
- If C: Respond with "ANSWER:" followed by a brief, friendly response.

ALWAYS start with exactly "ANSWER:" or "EDIT:" — no exceptions.`;
}

export async function POST(req: NextRequest) {
  // Provider resilience: tries Anthropic → OpenAI → Gemini with
  // runtime failover (see lib/ai-providers). At least one of the
  // three keys must be present.
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI API key not configured" }, { status: 503 });
  }

  let body: { action: AIAction; markdown: string; language?: string; instruction?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, markdown, language, instruction } = body;
  if (!action || !markdown || typeof markdown !== "string") {
    return NextResponse.json({ error: "action and markdown are required" }, { status: 400 });
  }

  const validActions: AIAction[] = [
    "polish", "summary", "tldr", "translate", "chat", "visitor_chat", "beautify", "compact", "format",
    "selection_polish", "selection_shorten", "selection_expand",
    "selection_rewrite", "selection_translate",
  ];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  if ((action === "translate" || action === "selection_translate") && !language) {
    return NextResponse.json({ error: "language is required for translate" }, { status: 400 });
  }

  if ((action === "chat" || action === "visitor_chat" || action === "selection_rewrite") && !instruction) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  // Build prompt based on action
  let systemPrompt: string;
  if (action === "translate") {
    systemPrompt = buildTranslatePrompt(language!);
  } else if (action === "selection_translate") {
    systemPrompt = buildSelectionTranslatePrompt(language!);
  } else if (action === "chat") {
    systemPrompt = buildChatPrompt(instruction!);
  } else if (action === "visitor_chat") {
    systemPrompt = buildVisitorChatPrompt(instruction!);
  } else if (action === "selection_rewrite") {
    systemPrompt = buildSelectionRewritePrompt(instruction!);
  } else {
    systemPrompt = PROMPTS[action];
  }

  const trailingLabel =
    action === "chat" ? "Modified document:"
    : action === "visitor_chat" ? "Answer:"
    : action.startsWith("selection_") ? "Snippet:"
    : action === "polish" || action === "translate" || action === "compact" ? "Result:"
    : "Output:";
  const fullPrompt = `${systemPrompt}

Document:
---
${markdown.slice(0, 3 * 1024 * 1024)}
---

${trailingLabel}`;

  // Per-action knobs: summary/tldr/selection-ops + visitor_chat + format
  // can use the lite model. `format` was on the primary tier before
  // and routinely sat for minutes because it's a pure structural pass
  // (raw text → headings/lists/tables) — exactly what Flash-class
  // models nail without the Pro overhead.
  const useLite = action === "summary" || action === "tldr" || action === "visitor_chat" || action === "format" || action.startsWith("selection_");
  const temperature =
    action === "polish" || action === "translate" || action === "compact"
      || action === "format"
      || action === "selection_polish" || action === "selection_translate"
      ? 0.1
      : 0.3;
  // Cap output at the input length × 1.4 for actions whose output
  // never exceeds the input (format restructures, compact shortens,
  // polish/translate replace 1:1). Gemini's stop-token detection is
  // tighter when the budget isn't oversized — the previous 65k cap
  // routinely made the model run on far past the natural end of the
  // doc, adding tens of seconds. Estimate tokens as chars / 3.5
  // (conservative for mixed CJK/Latin).
  const inputTokensEstimate = Math.ceil((markdown || "").length / 3.5);
  const maxOutputTokens =
    action === "summary" || action === "tldr" || action === "visitor_chat"
      ? 2048
      : action.startsWith("selection_")
        ? 8192
        : action === "format" || action === "polish" || action === "translate" || action === "compact"
          ? Math.min(65536, Math.max(4096, Math.ceil(inputTokensEstimate * 1.4)))
          : 65536;

  try {
    const result = await callAI({
      prompt: fullPrompt,
      temperature,
      maxOutputTokens,
      useLiteModel: useLite,
    });

    if (!result.ok) {
      console.error(`AI ${action} failover exhausted:`, result.status, result.error);
      return NextResponse.json(
        { error: result.error },
        { status: result.rateLimited ? 429 : result.status >= 500 ? 502 : result.status },
      );
    }

    return NextResponse.json({
      result: result.text,
      provider: result.provider,
      ...(result.finishReason && result.finishReason !== "STOP" && result.finishReason !== "end_turn" && result.finishReason !== "stop"
        ? { finishReason: result.finishReason }
        : {}),
    });
  } catch (err) {
    console.error(`AI ${action} error:`, err);
    return NextResponse.json({ error: "AI service unreachable." }, { status: 500 });
  }
}
