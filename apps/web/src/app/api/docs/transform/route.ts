import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

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
- If the instruction is "summarize", be ruthless — short, structured, lossless on the key facts.
- If the instruction is "extract X", drop everything that isn't X.
- If the instruction is "translate", translate the body but keep the H1 in the target language too.
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

  // Run the transform.
  let transformed: string;
  try {
    transformed = await callTransformer(effectiveIntent, markdown, system);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI call failed";
    return NextResponse.json({ error: `AI: ${msg}` }, { status: 502 });
  }
  if (!transformed || transformed.trim().length === 0) {
    return NextResponse.json({ error: "AI returned empty output" }, { status: 502 });
  }

  // Prepend AI prompt as a quoted note above the H1 so future
  // readers see what the user asked for. The H1 the LLM produced
  // stays as the doc title.
  const finalMd = `> **AI prompt:** ${intent}\n\n${transformed.trim()}\n`;
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
      : finalMd.replace(/^(>\s*\*\*AI prompt:\*\*.*?\n\n)?(.*)/s,
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

async function callTransformer(intent: string, sourceMd: string, system: string = SYSTEM_BASE): Promise<string> {
  const userMsg =
    `Instruction:\n${intent}\n\n---\n\nSource markdown (clipped from a webpage or AI chat):\n\n${sourceMd}`;

  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    type Block = { type: string; text?: string };
    const blocks: Block[] = data.content || [];
    return blocks.filter((b) => b.type === "text").map((b) => b.text || "").join("").trim();
  }

  if (process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  }

  throw new Error("No LLM provider configured");
}
