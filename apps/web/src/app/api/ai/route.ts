import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AIAction =
  | "polish"
  | "summary"
  | "tldr"
  | "translate"
  | "chat"
  | "beautify"
  | "compact"
  | "selection_polish"
  | "selection_shorten"
  | "selection_expand"
  | "selection_rewrite"
  | "selection_translate";

// ─── AI Model Config (cached from site_config table) ───
const DEFAULT_PRIMARY_MODEL = "gemini-3-flash-preview";
const DEFAULT_LITE_MODEL = "gemini-3.1-flash-lite";

let cachedModels: { primary: string; lite: string } | null = null;
let cachedModelsAt = 0;
const MODEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getAIModels(): Promise<{ primary: string; lite: string }> {
  if (cachedModels && Date.now() - cachedModelsAt < MODEL_CACHE_TTL) {
    return cachedModels;
  }
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase
        .from("site_config")
        .select("key, value")
        .in("key", ["ai_model_primary", "ai_model_lite"]);
      const map: Record<string, string> = {};
      for (const row of data || []) map[row.key] = row.value;
      cachedModels = {
        primary: map["ai_model_primary"] || DEFAULT_PRIMARY_MODEL,
        lite: map["ai_model_lite"] || DEFAULT_LITE_MODEL,
      };
      cachedModelsAt = Date.now();
      return cachedModels;
    }
  } catch {
    // Fall through to defaults
  }
  cachedModels = { primary: DEFAULT_PRIMARY_MODEL, lite: DEFAULT_LITE_MODEL };
  cachedModelsAt = Date.now();
  return cachedModels;
}

const PROMPTS: Record<Exclude<AIAction, "chat" | "translate" | "selection_rewrite" | "selection_translate">, string> = {
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
- **CRITICAL: ALWAYS wrap every node label in double quotes** — \`A["any text"]\` not \`A[any text]\`. This prevents parse errors when labels contain \`{ } ( ) / \\ | : . , < > # @ %\` or whitespace. NEVER write \`G[mdfy.app/{id}]\` — write \`G["mdfy.app/{id}"]\`.
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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
    "polish", "summary", "tldr", "translate", "chat", "beautify", "compact",
    "selection_polish", "selection_shorten", "selection_expand",
    "selection_rewrite", "selection_translate",
  ];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  if ((action === "translate" || action === "selection_translate") && !language) {
    return NextResponse.json({ error: "language is required for translate" }, { status: 400 });
  }

  if ((action === "chat" || action === "selection_rewrite") && !instruction) {
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
  } else if (action === "selection_rewrite") {
    systemPrompt = buildSelectionRewritePrompt(instruction!);
  } else {
    systemPrompt = PROMPTS[action];
  }

  const fullPrompt = `${systemPrompt}

Document:
---
${markdown.slice(0, 3 * 1024 * 1024)}
---

${action === "chat" ? "Modified document:" : action.startsWith("selection_") ? "Snippet:" : action === "polish" || action === "translate" || action === "compact" ? "Result:" : "Output:"}`;

  // Resolve model from site_config (cached 5 min). Snippet ops are
  // small so they stay on the lite model for cost.
  const models = await getAIModels();
  const useLite = action === "summary" || action === "tldr" || action.startsWith("selection_");
  const modelName = useLite ? models.lite : models.primary;

  const callGemini = async (attempt: number): Promise<Response> => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature:
              action === "polish" || action === "translate" || action === "compact"
                || action === "selection_polish" || action === "selection_translate"
                ? 0.1
                : 0.3,
            maxOutputTokens:
              action === "summary" || action === "tldr"
                ? 2048
                : action.startsWith("selection_")
                  ? 8192
                  : 65536,
          },
        }),
      }
    );
    if (res.ok || res.status < 500 || attempt >= 2) return res;
    await new Promise((r) => setTimeout(r, 500 + attempt * 1000));
    return callGemini(attempt + 1);
  };

  try {
    const res = await callGemini(0);

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`AI ${action} error:`, res.status, errBody);
      let userMessage = "AI processing failed";
      if (res.status === 429) userMessage = "AI is rate-limited. Try again in a minute.";
      else if (res.status >= 500) userMessage = "AI service is temporarily unavailable.";
      return NextResponse.json({ error: userMessage }, { status: res.status === 429 ? 429 : 502 });
    }

    const data = await res.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = data.candidates?.[0]?.finishReason;

    if (!result.trim()) {
      return NextResponse.json(
        { error: finishReason === "SAFETY" ? "AI refused this content (safety filter)." : "AI returned empty result" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      result,
      ...(finishReason && finishReason !== "STOP" ? { finishReason } : {}),
    });
  } catch (err) {
    console.error(`AI ${action} error:`, err);
    return NextResponse.json({ error: "AI service unreachable." }, { status: 500 });
  }
}
