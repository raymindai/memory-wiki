import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { callAI } from "@/lib/ai-providers";

// POST /api/docs/transform
//
// Body: { markdown, intent, userId?, source?, title? }
//
// Run the captured `markdown` through an LLM using `intent` as the
// user's instruction ("extract pricing", "summarize in 5 bullets",
// "translate to Korean", etc.). Save the AI's output as a new doc
// and return its id + editToken just like /api/docs does.
//
// Used by the chrome extension's "capture with intent" textarea —
// the popup captures the full page/conversation, posts here, and
// publishes the transformed result to a memory.wiki URL the user
// can paste into any AI.
//
// Requires auth. Intent runs ARE explicitly the user's own AI
// request, so we don't honor anon flows here.

const SYSTEM_BASE = `You are memory.wiki's capture transformer. The user has just clipped a page or AI conversation and given you a short instruction in their own words about what to do with it.

Your job:
- Follow the instruction. Don't ask clarifying questions.
- Return well-formed markdown. Use headings, lists, blockquotes, code blocks where they help.
- Open with a single H1 title that names the transformed output (not the source page). The title should make the document scannable on a hub of saved memories.
- Preserve concrete facts, names, numbers, URLs, quotes. Don't hallucinate.
- **Preserve images.** Every \`![alt](url)\` in the source MUST appear in your output, verbatim, in roughly the same position relative to surrounding text. Do not drop, rename, summarize-into-text, or relocate them. The only exception is the explicit "extract X" / "just text" / "remove images" instructions where the user clearly asks for image removal.
- If the instruction is "summarize", be ruthless — short, structured, lossless on the key facts (but still keep the images).
- If the instruction is "extract X", drop everything that isn't X (images survive only if they belong to X).
- If the instruction is "translate", translate the body but keep the H1 in the target language too. Images stay.
- If the instruction is unclear or empty, return the source as-is with a brief one-line note.
- No preamble like "Here is the transformed content:". Just the markdown.`;

// Auto-prompts applied when `auto: true` is set and no user intent was
// typed. Maps detected page types to a structured-extraction directive
// the LLM follows. Generic / article pages are NOT auto-transformed —
// raw capture is already the right output there.
const AUTO_PROMPTS: Record<string, string> = {
  recipe:
    "Extract the recipe in this order:\n" +
    "1. H1 = dish name.\n" +
    "2. One-line summary (cuisine, prep+cook time, servings).\n" +
    "3. ## Ingredients — checklist `- [ ]` with exact quantities and units.\n" +
    "4. ## Steps — numbered list, one action per step, terse.\n" +
    "5. ## Notes — tips, substitutions, storage, only if the page has them.\n" +
    "Drop ads, comments, related recipes, ratings widgets, cookbook author bio.",
  movie:
    "Extract the film as:\n" +
    "1. H1 = title (year).\n" +
    "2. Properties block: director(s), runtime, genre(s), cast (top 5), rating (RT/IMDb if visible).\n" +
    "3. ## Synopsis — 2-3 sentences, no spoilers beyond what the source shows.\n" +
    "4. ## Reception — 1-2 sentences if reviews are present.\n" +
    "Drop ads, recommendations, trailer embeds, social share UI.",
  paper:
    "Extract the paper as:\n" +
    "1. H1 = paper title.\n" +
    "2. Properties: authors, venue/year, arXiv/DOI link if present.\n" +
    "3. ## Abstract — verbatim if available, else 3-4 sentence faithful summary.\n" +
    "4. ## Key contributions — 3-5 bullets, plain English.\n" +
    "5. ## Methods — 1 short paragraph.\n" +
    "6. ## Results — bullet list of headline numbers / findings.\n" +
    "Drop site chrome, login walls, related-paper sidebars.",
  product:
    "Extract the product as:\n" +
    "1. H1 = product name.\n" +
    "2. Properties: brand, price (with currency), rating, availability.\n" +
    "3. ## Description — 2-3 sentence faithful summary.\n" +
    "4. ## Key specs — markdown table (Spec | Value).\n" +
    "5. ## Pros — bullets, only if reviewer/editorial pros are stated.\n" +
    "6. ## Cons — bullets, same rule.\n" +
    "Drop ads, recommendations, customer-review feeds, shipping/return policy boilerplate.",
};

function pickSystem(intent: string, pageType: string | undefined, auto: boolean): {
  system: string;
  effectiveIntent: string;
} {
  if (auto && pageType && AUTO_PROMPTS[pageType]) {
    return { system: SYSTEM_BASE, effectiveIntent: AUTO_PROMPTS[pageType] };
  }
  return { system: SYSTEM_BASE, effectiveIntent: intent };
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: {
    markdown?: string;
    intent?: string;
    userId?: string;
    source?: string;
    title?: string;
    auto?: boolean;
    pageType?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const markdown = typeof body.markdown === "string" ? body.markdown.trim() : "";
  const intent = typeof body.intent === "string" ? body.intent.trim() : "";
  const auto = body.auto === true;
  const pageType = typeof body.pageType === "string" ? body.pageType : "";
  if (!markdown) return NextResponse.json({ error: "markdown is required" }, { status: 400 });
  // Either the user typed an instruction, or we asked the server to pick one
  // from the detected page type via auto-mode.
  if (!intent && !(auto && pageType && AUTO_PROMPTS[pageType])) {
    return NextResponse.json({ error: "intent or auto+pageType is required" }, { status: 400 });
  }
  if (markdown.length > 200_000) {
    return NextResponse.json({ error: "markdown too large (max 200K chars)" }, { status: 413 });
  }

  // Resolve user — body.userId, JWT, or x-user-id header.
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = body.userId || verified?.userId || req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pick effective instruction: user's text, or auto-prompt by page type.
  const { system, effectiveIntent } = pickSystem(intent, pageType, auto);

  // Also pick up anonymousId for chrome-ext anon flows so the
  // attribution row gets the right identifier when userId is empty.
  const anonymousId = req.headers.get("x-anonymous-id") || undefined;

  // Run the transform.
  let transformed: string;
  try {
    transformed = await callTransformer(effectiveIntent, markdown, system, userId, anonymousId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI call failed";
    return NextResponse.json({ error: `AI: ${msg}` }, { status: 502 });
  }
  if (!transformed || transformed.trim().length === 0) {
    return NextResponse.json({ error: "AI returned empty output" }, { status: 502 });
  }

  // Prepend a single-line attribution above the H1 so future readers
  // see what produced the doc. User intent shows the prompt verbatim;
  // auto mode shows the detected page-type template name.
  const header = intent
    ? `> **AI prompt:** ${intent}`
    : `> _Auto-extracted as **${pageType}**_`;
  const finalMd = `${header}\n\n${transformed.trim()}\n`;
  let title = extractTitleFromMd(finalMd) || "AI transform";

  // Retry on (a) PK collision (nanoid clash) and (b) dedup-lock
  // violation. For dedup, append a short timestamp suffix to the
  // title so re-runs of the same source+intent don't collapse to
  // one doc — each transform deserves its own URL.
  let id = nanoid(8);
  const editToken = nanoid(32);
  let lastError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const tryTitle = attempt === 0 ? title : `${title} (${shortStamp()})`;
    const tryMd = attempt === 0 ? finalMd
      // Match "> **AI prompt:** ..." quote block (optional) then everything
      // else. Use [\s\S] in place of /s flag (which is es2018+ and our
      // tsconfig target doesn't enable).
      : finalMd.replace(/^(>[\s\S]*?\*\*AI prompt:\*\*[\s\S]*?\n\n)?([\s\S]*)$/,
          (_, q, rest) => (q || "") + bumpH1(rest, ` (${shortStamp()})`));
    id = nanoid(8);
    const { error } = await supabase.from("documents").insert({
      id,
      markdown: tryMd,
      title: tryTitle,
      edit_token: editToken,
      user_id: userId,
      edit_mode: "account",
      is_draft: true,
      source: body.source || "chrome-intent",
    });
    if (!error) {
      lastError = null;
      title = tryTitle;
      return NextResponse.json({ id, editToken, title, markdown: tryMd });
    }
    if (error.code === "23505") { lastError = error; continue; }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: lastError?.message || "insert failed" }, { status: 500 });
}

function shortStamp(): string {
  // "Jun 3 03:14" — readable + unique enough to break dedup at minute granularity.
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${months[d.getMonth()]} ${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function bumpH1(md: string, suffix: string): string {
  return md.replace(/^(#\s+.+?)\s*$/m, (_, h) => h + suffix);
}

function extractTitleFromMd(md: string): string {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim().slice(0, 100) : "";
}

// Route the transform through the shared cost-first cascade in
// lib/ai-providers. The previous inline 3-tier (gpt-5-nano →
// gemini-flash-lite → claude-haiku) is now the platform default
// for every AI surface, configurable per provider via site_config +
// the admin page. Caller still keeps its own SYSTEM_BASE prompt and
// concatenates with user instruction + source — callAI takes a
// single prompt string by design.
async function callTransformer(intent: string, sourceMd: string, system: string = SYSTEM_BASE, userId?: string, anonymousId?: string): Promise<string> {
  const prompt =
    `${system}\n\nInstruction:\n${intent}\n\n---\n\nSource markdown (clipped from a webpage or AI chat):\n\n${sourceMd}`;
  const result = await callAI({
    prompt,
    useLiteModel: true,        // chrome-ext intent is always a short transform
    temperature: 0.3,
    maxOutputTokens: 8192,
    userId,
    anonymousId,
    action: "transform",
  });
  if (!result.ok) {
    throw new Error(result.error || "All providers failed");
  }
  return result.text;
}
