#!/usr/bin/env node
// seed-demo-account.mjs — provisions the App Store review demo
// account at demo@memory.wiki with a rich, varied corpus.
//
// What it creates (idempotent — re-running upserts):
//   - auth user `demo@memory.wiki` (no password; magic-link only;
//     auto-confirmed)
//   - profile row with hub_slug='demo', avatar, display_name
//   - 5 document folders (varied topics)
//   - 2 bundle folders
//   - 50 documents with rich markdown (headings, lists, tables,
//     code, math, mermaid, quotes, images, footnotes, task lists);
//     ~70 % live in folders, ~30 % loose; visibility split across
//     public / private / restricted
//   - 10 bundles, half folder-grouped, with descriptions + 3-8
//     member docs each
//   - timestamps spread across the last 90 days so the timeline
//     buckets (Today / Yesterday / This week / This month /
//     Earlier) all show real content
//
// USAGE:
//   cd apps/web
//   node --env-file=.env.local scripts/seed-demo-account.mjs
//
// After upserting rows it triggers embedding + graph analysis through
// the canonical lifecycle endpoints (direct service-role inserts don't
// fire those the way the user-facing routes do — see triggerAnalysis).
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// Optional env:
//   DEMO_BASE_URL   target for analysis endpoints (default https://memory.wiki;
//                   set to http://localhost:3002 to analyze against a local dev server)
//   SKIP_ANALYSIS   set to skip the embedding + graph trigger entirely

import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

// Deterministic id from a stable seed string — running the script
// twice with the same title produces the same id, so upserts
// actually dedupe instead of leaving stale rows around.
function deterministicId(prefix, seed) {
  const hash = createHash("sha256").update(`${prefix}:${seed}`).digest("hex");
  // 12-char alphanumeric-friendly slice — fits documents.id format.
  return hash.slice(0, 12);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const s = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_EMAIL = "demo@memory.wiki";
// Fixed password so App Store reviewers (and the founder) can sign
// in via the standard email+password flow. Rotate manually if it
// leaks; the account holds only seeded demo content.
const DEMO_PASSWORD = "DemoMemoryWiki2026!";

// ─── auth user ────────────────────────────────────────────────
async function ensureUser() {
  // Look up existing user by email via admin API.
  const { data: list } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list?.users.find(u => u.email === DEMO_EMAIL);
  if (!user) {
    const { data, error } = await s.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Memory.Wiki Demo" }
    });
    if (error) throw error;
    user = data.user;
    console.log("Created demo user:", user.id);
  } else {
    console.log("Reusing demo user:", user.id);
    // Reset password so subsequent runs don't lock anyone out.
    await s.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD, email_confirm: true });
  }
  return user;
}

// ─── profile ──────────────────────────────────────────────────
async function ensureProfile(userId) {
  const { error } = await s.from("profiles").upsert({
    id: userId,
    email: DEMO_EMAIL,
    display_name: "Memory.Wiki Demo",
    hub_slug: "memorywiki-demo",
    hub_public: true,
    hub_description:
      "A polished demo hub showing what Memory.Wiki can hold — research, engineering notes, reading log, project planning. Paste any URL into Claude or ChatGPT to see the cross-AI payload.",
    plan: "pro",
    avatar_style: "identicon",
    avatar_url: "https://api.dicebear.com/9.x/identicon/svg?seed=memorywikidemo"
  }, { onConflict: "id" });
  if (error) throw error;
}

// ─── folders ──────────────────────────────────────────────────
const DOC_FOLDERS = [
  { id: "demo-folder-ai-research", name: "AI & Research", emoji: "🧠", sort_order: 1 },
  { id: "demo-folder-engineering", name: "Engineering Notes", emoji: "🛠", sort_order: 2 },
  { id: "demo-folder-reading", name: "Reading & Books", emoji: "📚", sort_order: 3 },
  { id: "demo-folder-personal", name: "Personal & Journal", emoji: "✍️", sort_order: 4 },
  { id: "demo-folder-snippets", name: "Code Snippets", emoji: "💾", sort_order: 5 }
];
const BUNDLE_FOLDERS = [
  { id: "demo-bfolder-product", name: "Product Planning", emoji: "🚀", sort_order: 1 },
  { id: "demo-bfolder-themes", name: "Knowledge Themes", emoji: "🌐", sort_order: 2 }
];

async function ensureFolders(userId) {
  const rows = [
    ...DOC_FOLDERS.map(f => ({ ...f, user_id: userId, section: "documents", collapsed: false })),
    ...BUNDLE_FOLDERS.map(f => ({ ...f, user_id: userId, section: "bundles", collapsed: false }))
  ];
  const { error } = await s.from("folders").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

// ─── doc content templates ────────────────────────────────────
// Each block returns rich markdown ≥ 250 words mixing the supported
// elements. The list is shuffled + recombined to produce 50 unique
// docs with varied length + texture.

const PARAGRAPHS = [
  "The interesting thing about long-context models isn't that they can read more — it's that they finally make the *retrieval* problem optional. When a model can hold the whole repo in context, the question shifts from \"what should I fetch?\" to \"what should I show?\". That's a UX question, not an infrastructure one.",
  "Most personal-knowledge tools optimise for input. The friction is on the way in: capture this thought, file it, tag it, link it. But the value lives on the way OUT — when the system surfaces the right note at the right moment without you asking. Capture-heavy products are easier to build; output-heavy ones are what people actually pay for.",
  "Reading other people's code is a higher-leverage activity than writing your own. You learn three things at once: what works, what doesn't, and why someone smart picked the trade-off you'd never have considered. The ratio of read-to-write hours quietly separates the engineers who plateau from the ones who keep compounding.",
  "Cross-AI portability is the structural moat OpenAI and Anthropic can't build for themselves. The user's context, exported as a public URL, becomes infrastructure that survives any single vendor's pivot. That's why the right primitive isn't an API key — it's a permalink.",
  "A good error message answers three questions: what happened, why it happened, and what to try next. Most ship the first, hint at the second, and forget the third. The fix is usually a single sentence longer.",
  "The hardest part of a 1-person startup isn't the work — it's the lack of a forcing function. Without a meeting on Tuesday, nothing has to ship on Monday. The schedule has to come from somewhere, and \"because I said so\" isn't enough.",
  "Branding is not the logo. It's the consistency of every micro-decision: button radius, copy voice, error tone, empty-state warmth. The logo just labels the bag. The branding is what's inside it.",
  "Markdown won because it was always good enough. Not the best at any one thing — never the fastest editor, never the prettiest output, never the most semantically rich. But always close enough that the switching cost killed every alternative."
];

const LISTS = [
  `### Three rules I keep returning to

- Ship one feature, deeply, before two features shallowly.
- The interface IS the product. The engine just has to keep up.
- Anything important should fit on one screen.`,
  `### Today's reading list

1. *Designing Data-Intensive Applications* — chapter 5 (replication)
2. The Hacker News thread on "What I learned writing a JIT"
3. A Stripe engineering blog post about idempotency keys
4. Karpathy's tweet thread about LLM evals`,
  `### Capture-flow check-list

- [x] Pulled from Safari via Share Sheet
- [x] OCR'd a whiteboard photo
- [x] Dictated three voice memos walking to coffee
- [ ] Imported the long PDF I was avoiding
- [ ] Cleaned the inbox folder`
];

const CODE_BLOCKS = [
  `\`\`\`swift
// SwiftUI: keep all five tab views mounted across tab switches so
// each view's @StateObject model persists.
ZStack {
    ForEach(AppTab.allCases, id: \\.self) { tab in
        view(for: tab)
            .opacity(router.selectedTab == tab ? 1 : 0)
            .allowsHitTesting(router.selectedTab == tab)
    }
}
\`\`\``,
  `\`\`\`python
# Tiny script that prints any URL's title.
import requests, re
def title(url: str) -> str:
    html = requests.get(url, timeout=5).text
    m = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
    return m.group(1).strip() if m else url
print(title("https://memory.wiki"))
\`\`\``,
  `\`\`\`typescript
// Server-sent events from /api/import/url
const res = await fetch("/api/import/url", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
  body: JSON.stringify({ url })
});
for await (const chunk of res.body!) {
  // parse SSE: 'event: stage' / 'data: {...}'
}
\`\`\``,
  `\`\`\`bash
# Resize + WebP-encode every PNG in the current folder.
for f in *.png; do
  sips -Z 1280 "$f" --setProperty format webp --out "\${f%.png}.webp"
done
\`\`\``
];

const TABLES = [
  `| Surface | Latency goal | Notes |
|---|---|---|
| Capture | <1s tap → toast | local-first, server is best-effort |
| Open | <500ms URL → LCP | edge cache for public URLs |
| Search | <250ms keystroke → results | semantic + lexical merged |`,
  `| Provider | Strength | Weakness |
|---|---|---|
| Claude | Long context, instruction following | Slow for tiny prompts |
| GPT-4o | Multimodal, fast | Drifts on long sessions |
| Cursor | Code-aware ranking | Locked to editor |`
];

const QUOTES = [
  `> "The best note-taking system is the one you already have open."
> — every productivity post ever, and also true`,
  `> "Make the easy thing the default and the hard thing possible."
> — design rule I keep stealing from Linear`,
  `> "If the user has to know how it works, you've failed."
> — paraphrased, but the spirit is right`
];

const MATH_BLOCKS = [
  `When the embedding similarity is

$$\\text{sim}(a, b) = \\frac{\\vec{a} \\cdot \\vec{b}}{\\|\\vec{a}\\| \\, \\|\\vec{b}\\|}$$

we expect cosine values between $-1$ and $1$ — but in practice high-dimensional sentence embeddings cluster near $0.3$, which is what makes nearest-neighbour search noisy.`,
  `The model's loss on the held-out set converged to $\\mathcal{L} = 2.41$ after roughly $1.2 \\times 10^4$ steps — well above the chance baseline of $\\log_2 50{,}000 \\approx 15.6$ bits per token but still leaving room for the next architecture pass.`
];

const MERMAID_BLOCKS = [
  `\`\`\`mermaid
flowchart LR
  Capture --> Organize
  Organize --> Use
  Use -.indispensability loop.-> Capture
\`\`\``,
  `\`\`\`mermaid
sequenceDiagram
  participant U as User
  participant M as Memory.Wiki
  participant A as AI
  U->>M: Save thought / URL / photo
  M-->>U: Permalink
  U->>A: "Use [URL] as my context"
  A-->>U: Answer grounded in the hub
\`\`\``
];

const IMAGE_BLOCKS = [
  `![Whiteboard sketch](https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80)`,
  `![Notes on a desk](https://images.unsplash.com/photo-1517842645767-c639042777db?w=1200&q=80)`,
  `![Calm reading nook](https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&q=80)`
];

const FOOTNOTE_BLOCKS = [
  `The thesis here[^1] is that delivery model matters more than retrieval quality.

[^1]: First articulated in the W6 internal note "Graph RAG is delivery, not retrieval."`
];

const TITLE_BANK = [
  // AI & Research
  "Why long-context models change the retrieval calculus",
  "Cross-AI portability as a structural moat",
  "Notes from the Claude Opus 4.7 release thread",
  "What \"agentic\" actually means in 2026",
  "The case for hub-shaped memory over vector recall",
  "Pricing AI features when the model cost is the floor",
  "On-device OCR is good enough for most capture flows",
  "Prompt caching changed how I structure long conversations",
  "Reading: Karpathy on LLM evals",
  "An evening with the new ChatGPT memory primitives",
  // Engineering Notes
  "SwiftUI keep-mounted tabs: the tradeoff",
  "Vercel function payload caps and how to ship around them",
  "WebP everywhere — a server-side policy decision",
  "Dark glass tab bar: blur vs opacity",
  "Skeleton placeholders are an underrated upgrade",
  "Race conditions in @FocusState + UIKit bridges",
  "Why I stopped trusting silent catch blocks",
  "iOS 26 floating chrome notes",
  "Profile manifest debugging diary",
  "The 30-second cache rule",
  // Reading & Books
  "Designing Data-Intensive Applications: chapter 5 takeaways",
  "Tidy First by Kent Beck",
  "The Pragmatic Programmer revisit",
  "How Big Things Get Done",
  "A Philosophy of Software Design",
  "Reading log: October-November",
  "Why I keep re-reading Drive",
  "Notes from Show Your Work",
  // Personal & Journal
  "Solo founder Tuesday",
  "Why I work in 90-minute blocks",
  "The Saturday review ritual",
  "What I learned saying no this month",
  "Tools I stopped using",
  "A note to my future self",
  "Q3 reflection",
  // Code Snippets
  "URL → markdown conversion (server-side recipe)",
  "Image resize ladder for upload",
  "iOS keyboard avoidance, the version that works",
  "Supabase RLS patterns I keep copy-pasting",
  "A tiny SSE parser in 30 lines of TS",
  "Bash one-liners I use weekly",
  "JSON schema for a doc with attachments",
  "Markdown table generator for daily check-ins",
  // Loose extras
  "What \"craftsman SaaS\" means to me",
  "Meeting with the legal team — context dump",
  "Why we said no to the Series A",
  "Travel notes: Seoul → Tokyo",
  "A list of products I'd build if I had infinite time",
  "A capture: thought I had at 3am",
  "Letter to a future hire"
];

// ─── body composer ────────────────────────────────────────────
function pick(arr, n) {
  const a = [...arr];
  const out = [];
  while (out.length < n && a.length) {
    out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
  }
  return out;
}

function composeBody(title, mix = 4) {
  // Always start with H1 title + lede paragraph
  const lede = PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
  const sections = [];
  sections.push(`# ${title}`);
  sections.push(lede);

  // Add 4-7 mixed blocks
  const blocks = [];
  blocks.push(...pick(PARAGRAPHS, 2));
  if (Math.random() > 0.3) blocks.push(LISTS[Math.floor(Math.random() * LISTS.length)]);
  if (Math.random() > 0.4) blocks.push(CODE_BLOCKS[Math.floor(Math.random() * CODE_BLOCKS.length)]);
  if (Math.random() > 0.5) blocks.push(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  if (Math.random() > 0.6) blocks.push(TABLES[Math.floor(Math.random() * TABLES.length)]);
  if (Math.random() > 0.7) blocks.push(MATH_BLOCKS[Math.floor(Math.random() * MATH_BLOCKS.length)]);
  if (Math.random() > 0.6) blocks.push(MERMAID_BLOCKS[Math.floor(Math.random() * MERMAID_BLOCKS.length)]);
  if (Math.random() > 0.7) blocks.push(IMAGE_BLOCKS[Math.floor(Math.random() * IMAGE_BLOCKS.length)]);
  if (Math.random() > 0.8) blocks.push(FOOTNOTE_BLOCKS[0]);

  // Add subheading + final summary
  const heading = ["## What changed", "## Next steps", "## Open questions", "## Recap"][
    Math.floor(Math.random() * 4)
  ];
  sections.push(blocks.join("\n\n"));
  sections.push(heading);
  sections.push(PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)]);

  return sections.join("\n\n");
}

// ─── docs ─────────────────────────────────────────────────────
function nanoid12() {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

// folder routing per title — first 10 ↔ AI&Research, next 10 ↔
// engineering, ... — but ~30 % left null so the loose-doc bucket
// is visible too.
function folderForIndex(i) {
  if (i < 10) return "demo-folder-ai-research";
  if (i < 20) return "demo-folder-engineering";
  if (i < 28) return "demo-folder-reading";
  if (i < 35) return "demo-folder-personal";
  if (i < 43) return "demo-folder-snippets";
  return null;  // loose
}

// Visibility mix: 40% public, 30% draft (private), 20% restricted,
// 10% restricted+editors.
function visibilityForIndex(i) {
  const r = (i * 37 + 11) % 100;
  if (r < 40) return { is_draft: false, edit_mode: "view", allowed_emails: null };
  if (r < 70) return { is_draft: true,  edit_mode: "account", allowed_emails: null };
  if (r < 90) return {
    is_draft: false, edit_mode: "view",
    // Demo "shared" recipients only — never the founder's real address,
    // or these demo docs land permanently in hi@raymind.ai's own
    // "Shared with me" and can't be cleared (the seed re-adds them).
    allowed_emails: ["reviewer@apple.com", "collaborator@memory.wiki"]
  };
  return {
    is_draft: false, edit_mode: "account",
    allowed_emails: ["reviewer@apple.com", "team@memory.wiki"]
  };
}

async function seedDocuments(userId) {
  const docs = TITLE_BANK.slice(0, 50).map((title, i) => {
    const created = dateNDaysAgo(Math.floor(i * 1.7));
    const updated = dateNDaysAgo(Math.max(0, Math.floor(i * 1.7) - Math.floor(Math.random() * 3)));
    const vis = visibilityForIndex(i);
    return {
      id: deterministicId("doc", title),
      user_id: userId,
      title,
      markdown: composeBody(title),
      edit_token: deterministicId("tok", title) + deterministicId("tok2", title),
      folder_id: folderForIndex(i),
      is_draft: vis.is_draft,
      edit_mode: vis.edit_mode,
      allowed_emails: vis.allowed_emails,
      created_at: created,
      updated_at: updated,
      view_count: vis.is_draft ? 0 : Math.floor(Math.random() * 80)
    };
  });
  // Upsert in batches of 10 to keep payloads small.
  for (let i = 0; i < docs.length; i += 10) {
    const batch = docs.slice(i, i + 10);
    const { error } = await s.from("documents").upsert(batch, { onConflict: "id" });
    if (error) throw error;
  }
  console.log(`Seeded ${docs.length} documents`);
  return docs;
}

// ─── bundles ──────────────────────────────────────────────────
const BUNDLE_TITLES = [
  // Product Planning
  ["v8 launch plan", "demo-bfolder-product"],
  ["W9 iOS sweep punch-list", "demo-bfolder-product"],
  ["WebP everywhere — rollout", "demo-bfolder-product"],
  ["App Store submission checklist", "demo-bfolder-product"],
  ["Pricing experiments — Q4", "demo-bfolder-product"],
  // Knowledge Themes
  ["Cross-AI memory layer reading", "demo-bfolder-themes"],
  ["Personal-knowledge-management notes", "demo-bfolder-themes"],
  // Loose
  ["Weekend reading", null],
  ["Engineering decisions log", null],
  ["Pinned for the team", null]
];

function bundleVisibility(i) {
  // bundles.allowed_emails is NOT NULL — use [] for the public /
  // private cases, real list for the restricted case.
  if (i % 3 === 0) return { is_draft: false, edit_mode: "view", allowed_emails: [] };
  if (i % 3 === 1) return { is_draft: true,  edit_mode: "account", allowed_emails: [] };
  return {
    is_draft: false, edit_mode: "view",
    // Demo recipients only — not the founder's real address (see note above).
    allowed_emails: ["reviewer@apple.com", "collaborator@memory.wiki"]
  };
}

async function seedBundles(userId, docs) {
  const bundles = BUNDLE_TITLES.map(([title, folder_id], i) => {
    const vis = bundleVisibility(i);
    return {
      id: deterministicId("bundle", title),
      user_id: userId,
      title,
      description: `${title} — a curated set of memories grouped by theme. Reviewer note: this is generated demo content.`,
      edit_token: deterministicId("btok", title) + deterministicId("btok2", title),
      folder_id,
      is_draft: vis.is_draft,
      edit_mode: vis.edit_mode,
      allowed_emails: vis.allowed_emails,
      intent: "decompose",
      created_at: dateNDaysAgo(5 + i * 4),
      updated_at: dateNDaysAgo(i * 2),
      view_count: vis.is_draft ? 0 : Math.floor(Math.random() * 40)
    };
  });
  for (let i = 0; i < bundles.length; i += 5) {
    const { error } = await s.from("bundles").upsert(bundles.slice(i, i + 5), { onConflict: "id" });
    if (error) throw error;
  }
  console.log(`Seeded ${bundles.length} bundles`);

  // bundle_documents: 3-8 docs per bundle, picked from the seeded set.
  const links = [];
  for (const b of bundles) {
    const n = 3 + Math.floor(Math.random() * 6);
    const members = pick(docs, n);
    b.memberCount = members.length;   // used by triggerAnalysis (graph needs ≥2)
    members.forEach((doc, idx) => {
      links.push({
        bundle_id: b.id,
        document_id: doc.id,
        sort_order: idx,
        created_at: b.created_at
      });
    });
  }
  for (let i = 0; i < links.length; i += 50) {
    const { error } = await s.from("bundle_documents").upsert(
      links.slice(i, i + 50),
      { onConflict: "bundle_id,document_id" }
    );
    if (error) throw error;
  }
  console.log(`Seeded ${links.length} bundle members`);
  return bundles;
}

// ─── embedding + graph backfill ───────────────────────────────
// CRITICAL: this script writes rows via the service-role REST client,
// which bypasses the user-facing creation routes (POST /api/bundles,
// /api/docs) that normally fire embedding + graph analysis. The only
// automatic paths left for direct inserts are (a) Supabase DB webhooks,
// which fire on INSERT but NOT on a re-seed's UPDATE and silently drop
// fire-and-forget failures, and (b) the daily lifecycle-sweep cron,
// which ignores rows older than 30 days (the demo backdates content up
// to 90 days). Net result: a freshly-seeded demo had bundles with no
// graph_data and docs with no embedding.
//
// So we trigger the canonical lifecycle endpoints ourselves, exactly
// like the cron does — owner identity via x-user-id, plus userId in the
// graph body so DRAFT bundles authorize too. Idempotent (every endpoint
// is hash-gated), so re-running is cheap.
const BASE_URL = (process.env.DEMO_BASE_URL || "https://memory.wiki").replace(/\/$/, "");

async function mapLimit(items, limit, fn) {
  let done = 0;
  const queue = [...items.entries()];
  async function worker() {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      const [, item] = next;
      if (await fn(item)) done++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return done;
}

async function postJson(path, headers, body) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body || {})
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function triggerAnalysis(userId, docs, bundles) {
  if (process.env.SKIP_ANALYSIS) {
    console.log("\nSKIP_ANALYSIS set — leaving embedding + graph to webhooks/cron.");
    return;
  }
  const headers = { "x-user-id": userId };
  console.log(`\nTriggering embedding + graph analysis via ${BASE_URL} ...`);
  console.log("(LLM-bound; ~10-20 min for a full corpus. Set SKIP_ANALYSIS=1 to skip.)");

  const docsEmbedded = await mapLimit(docs, 5, (d) => postJson(`/api/embed/${d.id}`, headers));
  console.log(`  docs embedded:    ${docsEmbedded}/${docs.length}`);

  const bundlesEmbedded = await mapLimit(bundles, 5, (b) => postJson(`/api/embed/bundle/${b.id}`, headers));
  console.log(`  bundles embedded: ${bundlesEmbedded}/${bundles.length}`);

  const graphable = bundles.filter((b) => (b.memberCount || 0) >= 2);
  // userId in the body so draft bundles authorize on every prod version;
  // x-user-id header covers the post-fix path too.
  const bundlesGraphed = await mapLimit(graphable, 2, (b) =>
    postJson(`/api/bundles/${b.id}/graph`, headers, { userId }));
  console.log(`  bundles graphed:  ${bundlesGraphed}/${graphable.length} (≥2 members)`);
}

// ─── main ─────────────────────────────────────────────────────
(async () => {
  const user = await ensureUser();
  await ensureProfile(user.id);
  await ensureFolders(user.id);
  const docs = await seedDocuments(user.id);
  const bundles = await seedBundles(user.id, docs);
  await triggerAnalysis(user.id, docs, bundles);
  console.log("\nDONE.");
  console.log(`Demo email:    ${DEMO_EMAIL}`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
  console.log(`User ID:       ${user.id}`);
  console.log("\nGive these credentials to App Store reviewers in the");
  console.log("ASC \"App Review Information\" section.");
})().catch(err => {
  console.error(err);
  process.exit(1);
});
