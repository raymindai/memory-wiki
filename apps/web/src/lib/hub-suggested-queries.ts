import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Suggested queries panel (W8).
 *
 * Graphify's GRAPH_REPORT.md ends with "Suggested queries" so the user
 * has a starting point for what to ask. memory.wiki does the same, but
 * personalized to each owner's hub. The AI looks at recent docs + a
 * shape of what the hub covers, and proposes five questions the owner
 * could ask their AI tools, paired with the hub URL as context.
 *
 * Cached lightly (60s on the public markdown surface). Computed on
 * demand for the JSON endpoint so a force-refresh is fast.
 */

const SAMPLE_DOCS_MAX = 25;
const SAMPLE_TITLES_MAX = 60;

interface DocSeed {
  id: string;
  title: string | null;
  updated_at: string | null;
  source: string | null;
}

export interface SuggestedQuery {
  question: string;
  why: string;
}

export interface SuggestedQueriesReport {
  computedAt: string;
  totalDocs: number;
  queries: SuggestedQuery[];
}

export async function computeSuggestedQueries(
  supabase: SupabaseClient,
  userId: string,
): Promise<SuggestedQueriesReport> {
  const { data: latest } = await supabase
    .from("documents")
    .select("id, title, updated_at, source")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_draft", false)
    .order("updated_at", { ascending: false })
    .limit(SAMPLE_TITLES_MAX);
  const docs = (latest as DocSeed[] | null) ?? [];

  if (docs.length === 0) {
    return { computedAt: new Date().toISOString(), totalDocs: 0, queries: [] };
  }

  const recent = docs.slice(0, SAMPLE_DOCS_MAX);
  const titlesBlock = recent
    .map((d, i) => `${i + 1}. ${(d.title || "Untitled").slice(0, 100)}`)
    .join("\n");

  const sourceCounts: Record<string, number> = {};
  for (const d of docs) {
    const s = (d.source || "manual").split(":")[0];
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }
  const sourcesBlock = Object.entries(sourceCounts)
    .map(([s, n]) => `${s}: ${n}`)
    .join(", ");

  const prompt = `You are looking at a user's personal knowledge hub. Below are the titles of their ${docs.length} most recently-updated documents and a breakdown of where they came from. Suggest five questions the owner could productively ask an AI assistant by pasting their hub URL as context.

Recent document titles:
${titlesBlock}

Source breakdown: ${sourcesBlock}

Output strict JSON only, no fences:
{
  "queries": [
    {"question": "<question text>", "why": "<one-sentence rationale>"},
    ...
  ]
}

Rules:
- Exactly 5 questions.
- Each question should be specific to the apparent topics in the titles. Avoid generic prompts like "summarize my hub."
- Each rationale explains why this question is productive given the hub's current state.
- Keep questions under 18 words and rationales under 25 words.`;

  const result = await runProviderChain(prompt);
  return {
    computedAt: new Date().toISOString(),
    totalDocs: docs.length,
    queries: result,
  };
}

export function formatSuggestedQueriesMarkdown(report: SuggestedQueriesReport): string {
  if (report.queries.length === 0) {
    return "# Suggested queries\n\n_No documents yet. Add some captures and come back._\n";
  }
  const lines: string[] = ["# Suggested queries", ""];
  lines.push(`> Computed at ${report.computedAt}. Based on the ${report.totalDocs} most recent docs in this hub.`);
  lines.push("");
  for (const q of report.queries) {
    lines.push(`## ${q.question}`);
    lines.push("");
    lines.push(q.why);
    lines.push("");
  }
  return lines.join("\n");
}

async function runProviderChain(prompt: string): Promise<SuggestedQuery[]> {
  if (process.env.ANTHROPIC_API_KEY) {
    const out = await runAnthropic(prompt, process.env.ANTHROPIC_API_KEY);
    if (out.length > 0) return out;
  }
  if (process.env.OPENAI_API_KEY) {
    const out = await runOpenAI(prompt, process.env.OPENAI_API_KEY);
    if (out.length > 0) return out;
  }
  if (process.env.GEMINI_API_KEY) {
    const out = await runGemini(prompt, process.env.GEMINI_API_KEY);
    if (out.length > 0) return out;
  }
  return [];
}

function parseQueries(text: string): SuggestedQuery[] {
  const stripped = text.replace(/```json|```/g, "").trim();
  const candidates: string[] = [stripped];
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      const list = Array.isArray(obj?.queries) ? obj.queries : [];
      const out: SuggestedQuery[] = [];
      for (const q of list) {
        if (q && typeof q.question === "string" && typeof q.why === "string") {
          out.push({
            question: q.question.trim().slice(0, 200),
            why: q.why.trim().slice(0, 300),
          });
        }
      }
      if (out.length > 0) return out;
    } catch { /* try next */ }
  }
  return [];
}

async function runAnthropic(prompt: string, apiKey: string): Promise<SuggestedQuery[]> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return parseQueries(data.content?.[0]?.text || "");
  } catch { return []; }
}

async function runOpenAI(prompt: string, apiKey: string): Promise<SuggestedQuery[]> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return parseQueries(data.choices?.[0]?.message?.content || "");
  } catch { return []; }
}

async function runGemini(prompt: string, apiKey: string): Promise<SuggestedQuery[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return parseQueries(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
  } catch { return []; }
}
