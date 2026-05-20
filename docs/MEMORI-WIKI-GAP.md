# memori.wiki — Gap Analysis vs Current Codebase

> Companion to `MEMORI-WIKI-SPEC.md`. Audited against `apps/web/` on
> 2026-05-14 and re-framed after a strategic decision to position
> memory.wiki as an **AI-era wiki**, not a literal Wikipedia-shape wiki.
>
> Original draft of this file treated every Tier 1 feature in the
> spec as a blocker. That assumed memory.wiki needed `[[wikilinks]]` + a
> manual link graph because the brand says "wiki." This rewrite
> rejects that assumption: the *AI-era* version of a wiki replaces
> hand-authored linking with semantic concept extraction, which memory.wiki
> already ships at production grade.

---

## 0. TL;DR

memory.wiki is already an **AI-era wiki** at production depth. What the
2003-era wiki does with `[[wikilinks]]`, memory.wiki does with
`concept_index` + `concept_relations` + hybrid semantic retrieval +
Anthropic Haiku reranker. The graph isn't missing — it's built by
the AI from the prose, not by the human typing brackets.

The only features still missing to honour the `memori.wiki` brand
promise are two surfaces (search UI, spec page) plus one re-packaging
(concept-backlinks rendered per doc). Everything else in the spec is
either shipped or correctly deferred.

**Critical-path before rebrand**:
1. **F3** Hub search UI (4–6h — backend already shipped)
2. **F8** Public `/spec` page (½–1 day)
3. **F2′** Concept-backlinks panel (½ day — derived from existing concept_index)
4. Onboarding/marketing copy explaining "AI does the linking"

Total: ~2 days of build. Then the rebrand is honest.

**Explicitly NOT shipping**: `[[wikilink]]` syntax (F1). See §4 for
the rationale.

---

## 1. The reframe: two interpretations of "wiki"

| Aspect | Wikipedia-shape (2003) | AI-era (2026) |
|---|---|---|
| Graph construction | Author types `[[link]]` | LLM extracts concepts |
| Graph discovery | "What links here" page | Concept page + recall API |
| Search | Full-text | Hybrid semantic + BM25 + rerank |
| Curation | Categories typed by hand | Bundles + auto-lint |
| Index update | Manual category/redirect work | Nightly lint + concept rebuild |

memory.wiki commits to the AI-era column. Importing 2003-era mechanics on
top would dilute the differentiator: a 2026 product with `[[link]]`
syntax becomes "Obsidian with cloud sync." The differentiator is
that **the AI does the linking; you write**.

---

## 2. What's actually shipped (audited)

### 2.1 Memory & graph layer — production-grade

| Spec | Code reality |
|---|---|
| **F4 Concept Index** | `concept_index` + `concept_relations` tables (migrations `027`, `028`). Per-concept hub page at `app/hub/[slug]/c/[concept]/page.tsx` with neighbor concepts. Builder code in `lib/hub-lint.ts`, surfaced via Hub auto-management. |
| **F5 Semantic Retrieval** | `POST /api/hub/[slug]/recall` accepts `{ question, k, level: doc/chunk/bundle, hybrid, rerank }`. Doc + chunk + bundle level retrieval. Hybrid = BM25 reciprocal-rank-fusion + pgvector cosine. Rerank = Anthropic Haiku cross-encoder. Telemetry logged. **Past spec.** |
| **F6 llms.txt** | `app/hub/[slug]/llms.txt/route.ts` follows llmstxt.org standard, includes `?compact=1` / `?digest=1` hints. |
| **F7 Compact form** | `?compact` query param wired across raw routes via `lib/markdown-compact.ts`. 30–50% token cuts working. |
| **F9 AI Wiki Lint** | `lib/hub-lint.ts` (297 lines): orphans, semantic duplicates, title-mismatch. 4-level aggressiveness in Hub auto-management. Contradictions + stale flagging deferred (not blocking). |
| **F11 Version history UI** | `versions.map` rendered in MdEditor (line 13931). Restore via `updateDocument`. Author-distinction column (human vs llm-lint) deferred — not blocking. |
| **F17 Public hub directory** | `/hubs` page, listed in `sitemap.ts`, has metadata. Depth (featured / trending) is post-launch. |

### 2.2 Partial — needs the UI shell

| Spec | Backend | Frontend |
|---|---|---|
| **F3 Hub-wide search** | ✅ `documents.search_vector` tsvector + `/api/search` + semantic variant | ❌ no `app/hub/[slug]/search` page, no search bar in hub viewer |
| **F14 Native LLM 인식** | ✅ `/docs/integrate` ships 6 tool-specific snippets | ⚠️ no formal partner cert / "Recognized by" page (post-launch) |

---

## 3. Real blockers before rebrand (3 features, ~2 days)

### 3.1 F3 — Hub search UI

**Why**: Even an AI-era wiki needs a typed-search-box affordance.
The backend already does the work; only the surface is missing.

**Build**: `app/hub/[slug]/search/page.tsx` with input + results
list (title + 200-char highlighted snippet + link). Search box icon
on the hub home that opens the search surface.

**Estimate**: 4–6 hours.

### 3.2 F8 — Public `/spec` page

**Why**: Brand pillar #4 is "Open spec, not platform lock-in." Day
one of `memori.wiki` requires the spec to actually exist.

**Build**: `app/spec/page.tsx` (top-level — the URL itself is the
pillar) documenting:
- URL patterns (Doc / Bundle / Hub / Concept / llms.txt / `?compact`
  / `?q=` / `graph.json` for future)
- llms.txt format
- Retrieval API request/response shape with copy-ready examples
- Bundle digest output shape (mirroring `/raw/bundle/[id]`)
- MIT license claim for the engine

Links from footer of every viewer page + About + DocsNav.

**Estimate**: ½–1 day (mostly writing).

### 3.3 F2′ — Concept-backlinks panel (re-packaging, not new build)

**Why**: This is the AI-era replacement for traditional backlinks.
Spec's F2 says "Referenced by N docs." memory.wiki's `concept_index`
already knows, for every concept in a doc, which other docs share
that concept. Surface it.

**Build**: Doc viewer renders a "Related in your hub" section at the
bottom: list the top 5 docs that share the most concepts with the
current doc. Each row: title + ≤3 shared concept tags + link.

No new table, no new compute path — purely a SELECT on existing
`concept_index` reverse-keyed by doc id.

**Estimate**: ½ day.

---

## 4. What we're explicitly NOT shipping (and the rationale)

### 4.1 F1 — `[[wikilink]]` syntax

**Decision**: Skip permanently.

**Rationale**: `[[wikilink]]` is the defining gesture of the 2003-era
wiki — a manual mechanism humans use to compensate for AI's absence.
In 2026, the AI does that work and does it better:

- A `[[React Hooks]]` link assumes the writer knows the canonical
  page title. The AI doesn't need that crutch — it extracts "React
  Hooks" as a concept from any doc that meaningfully discusses it
  and auto-links them through `concept_relations`.
- A user who writes 50 docs over a year would only manually link a
  fraction of related pairs. The LLM lint catches the rest nightly.
- Adding `[[link]]` syntax forces the user back into 2003-era
  mental model — at which point we're competing with Obsidian, not
  defining a category.

**Marketing copy implication**: explicit "Why no `[[wikilinks]]`?"
explainer on /spec and /docs/integrate. Frame as "the AI does the
linking; you write." This is positioning, not absence.

### 4.2 F12 — Hub-level graph view

**Decision**: Defer indefinitely.

**Rationale**: The same information lives in two surfaces already:
the concept page (`/hub/[slug]/c/[concept]`) shows neighbors as
text, the bundle canvas (when relevant) shows it visually. A
whole-hub graph view is a power-user nicety, not a brand promise.

### 4.3 Spec's manual link graph features

Backlinks-as-manual-link-reverse (F2 in spec) → replaced by
concept-backlinks (F2′ above).

`Doc.outboundLinks: string[]` field → not needed.

`Link` graph-edge table → not needed.

### 4.4 F10, F13, F14 (formal), F15, F16, F18

Defer all to post-launch. None are brand-promise critical for the
rebrand window. The spec has them in Tier 2/3 already; the rebrand
doesn't need them.

---

## 5. Data-model decisions still needed

### 5.1 `unlisted` visibility (spec calls for 3-state)

Current model: `is_draft` (private vs published) + `allowed_emails`
(restricted). 2-axis.

Spec: `visibility: 'public' | 'unlisted' | 'private'`.

**Recommendation**: skip `unlisted`. The 2-axis model already
expresses "public but not in /hubs gallery" via `hub_public=false`
at the hub level; per-doc `unlisted` is one more knob most users
won't touch. Add later if data shows demand.

### 5.2 `DocVersion.authoredBy` distinction (human vs llm-lint)

Already exists as a column opportunity. Not blocking rebrand. Add
when F9 morning-digest lands (post-launch).

---

## 6. Sequenced plan

**Week 1 (build week)** — ~2 days
- Day 1: F3 Hub search UI + F2′ Concept-backlinks panel
- Day 2: F8 `/spec` page + footer + DocsNav link
- Buffer: marketing copy refresh (About, /docs/integrate, /hubs) to
  use "AI-era wiki" vocabulary explicitly

**Rebrand week** — out of scope here (see SPEC §6 migration plan)

**Post-launch (months 1–3)**
- F9 morning digest + author-distinction column
- F10 auto-build capture intelligence
- F12 hub graph view (if data justifies)

**Post-launch (months 4–6)**
- F14 partner certification (only if partners opt in)
- F15 verified profiles
- F5 deepening (Upstage Solar production-grade)

**Year 2+**
- F16 inter-hub, F18 marketplace, F13 templates

---

## 7. Founder decisions still open

Down from 5 in the original GAP draft to 2, because committing to
the AI-era interpretation kills three of them.

1. **`/spec` location** — top-level `/spec` (the URL is the pillar)
   or `/docs/spec` (more discoverable). Recommendation: top-level.

2. **Rebrand timing** — ship F3+F8+F2′ first then rename, or roll
   the rename and ship features in public? Spec §8.1 says "ship,
   then rename." Hold that line.

---

## 8. Risk: brand vocabulary expectation

Users googling "personal wiki" / "AI wiki" will arrive with the
Wikipedia mental model and may experience initial cognitive
dissonance ("where are the backlinks?"). Mitigation:

- Spec page (F8) opens with an explicit reframe block: "memori.wiki
  is an AI-era wiki. The AI does the linking; you write."
- Doc viewer's "Related in your hub" section (F2′) uses plain-
  language vocabulary, not "concept-backlinks." Users feel the
  utility before needing the terminology.
- Concept page header reframes itself: "Pages in your hub about
  X" (not "Concept: X").
- Onboarding (WelcomeOverlay) gains a slide showing concept-
  driven navigation.

The carrying-load of the reframe is the spec page itself + the
language we use on /hubs and About. Get those right and the
expectation problem evaporates inside the first session.

---

*— end of gap analysis (rev 2: AI-era reframe) —*
