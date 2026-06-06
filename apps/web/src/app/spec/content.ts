/**
 * /spec — single source of truth for both /spec (en) and /ko/spec.
 * Blocks-based shape so sections can mix paragraphs, callout boxes,
 * code samples, and lists in arbitrary order.
 */

export type Locale = "en" | "ko";

export type SpecBlock =
  | { kind: "p";       html: string }
  | { kind: "ul";      items: string[] }
  | { kind: "ol";      items: string[] }
  | { kind: "pre";     lang?: string; code: string }
  | { kind: "callout"; html: string };           // multi-line HTML inside a bordered box

export interface SpecSection {
  id: string;
  num: string;       // "00", "01", ...
  title: string;
  blocks: SpecBlock[];
}

export interface SpecContent {
  nav: { label: string; href: string }[];
  navCta: string;
  navCtaHref: string;
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    meta: string;          // license + version line (HTML)
  };
  toc: { heading: string; items: { id: string; label: string }[] };
  sections: SpecSection[];
  footnote: string;
  footer: {
    columns: { title: string; links: { label: string; href: string }[] }[];
    bottomLeft: string;
    bottomRight: string;
    tagline: string;
    parent: { label: string; href: string };
  };
}

/* ─────────────────────────────────────────────────────────────
   ENGLISH
   ───────────────────────────────────────────────────────────── */

export const specEn: SpecContent = {
  nav: [
    { label: "About",     href: "/about" },
    { label: "Benchmark", href: "/about#benchmark" },
    { label: "Manifesto", href: "/manifesto" },
    { label: "Docs",      href: "/docs" },
  ],
  navCta: "Start your hub",
  navCtaHref: "/",
  hero: {
    eyebrow: "memory.wiki / spec",
    title: "An open spec for an AI-era wiki.",
    intro: "memory.wiki is a personal knowledge wiki that any AI can read. This page documents the URL contract, the retrieval API, the llms.txt manifest, and the bundle digest — the same primitives the memory.wiki reference implementation ships today. Other tools can implement this spec and interop with no platform lock-in.",
    meta: "Engine licence: MIT. Reference implementation: <a href=\"https://memory.wiki\">memory.wiki</a>. Spec version: 0.1 (draft, 2026-05-15).",
  },
  toc: {
    heading: "Contents",
    items: [
      { id: "why-this-spec",   label: "Why this spec" },
      { id: "url-contract",    label: "URL contract" },
      { id: "raw-markdown",    label: "Raw markdown variant" },
      { id: "query-knobs",     label: "Query knobs (compact / full / graph)" },
      { id: "llms-txt",        label: "llms.txt manifest" },
      { id: "bundle-digest",   label: "Bundle digest shape" },
      { id: "retrieval-api",   label: "Retrieval API" },
      { id: "concept-index",   label: "Concept index" },
      { id: "privacy",         label: "Privacy gates" },
      { id: "why-no-wikilinks",label: "Why no [[wikilinks]]" },
      { id: "partner-impl",    label: "Implementing this spec" },
    ],
  },
  sections: [
    {
      id: "why-this-spec", num: "00", title: "Why this spec exists",
      blocks: [
        { kind: "p", html: "Every AI dev tool — Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Aider — wants per-project context. Today users hand-curate that context in <code>CLAUDE.md</code> / <code>AGENTS.md</code> / <code>.cursor/rules</code> and it goes stale within a week. memory.wiki replaces the curation step with an AI-readable URL that returns a structured representation of a person's knowledge graph. Any tool that follows this spec can fetch the same payload and stay in sync." },
        { kind: "p", html: "The spec is intentionally minimal. Markdown for content, URLs for addressability, query parameters for token-economy knobs. No bespoke schema, no SDK lock-in. <strong>This is on purpose</strong> — the only way the spec earns adoption is by being cheap to implement." },
      ],
    },
    {
      id: "url-contract", num: "01", title: "URL contract",
      blocks: [
        { kind: "p", html: "Three scopes, each addressable, each AI-readable." },
        { kind: "callout", html: "<p><code>memory.wiki/{id}</code> &mdash; a single doc. Tightest token cost; one note, one decision.</p><p><code>memory.wiki/b/{id}</code> &mdash; a curated bundle of docs plus its pre-computed graph analysis (themes, insights, concept relations). Recommended scope for project-level tool config.</p><p><code>memory.wiki/@{user}</code> &mdash; the whole hub. Broad context, hub-wide concept index attached. Use sparingly.</p>" },
      ],
    },
    {
      id: "raw-markdown", num: "02", title: "Raw markdown variant",
      blocks: [
        { kind: "p", html: "Every public URL has a clean-markdown sibling at <code>/raw/...</code>:" },
        { kind: "pre", lang: "http", code: "GET /raw/{docId}\nGET /raw/b/{bundleId}\nGET /raw/hub/{slug}\nGET /raw/hub/{slug}/c/{concept}" },
        { kind: "p", html: "Response is <code>text/markdown</code>, charset UTF-8. Frontmatter (YAML) carries the bits an AI needs to attribute and reuse the doc — title, canonical URL, last-updated ISO timestamp, source, plus extracted tags and concept/relation counts:" },
        { kind: "pre", lang: "markdown", code: `---
mw_doc: 1
title: "React hooks crash course"
url: https://memory.wiki/abc123
updated: 2026-05-26T10:14:00Z
source: "ChatGPT"
tags: ["react", "hooks", "useEffect"]
concept_count: 9
relation_count: 7
---

# React hooks crash course
…clean markdown body…

## Concepts (this doc)
- **React Hooks** — function-only API for stateful logic
- **useState** — local component state
- …

## Concept relations (this doc)
- **useState** → *is a* → **React Hooks**
- **Stale closure** → *caused by* → **useEffect**
- …` },
        { kind: "p", html: "The <code>Concepts</code> and <code>Concept relations</code> sections at the end of the body are the doc-level knowledge graph — extracted by a background <code>doc_ontology</code> job (Claude Haiku) on first save and on each edit. Same typed-edge vocabulary as the bundle layer (<code>supports / elaborates / contradicts / exemplifies / contains / defines / depends_on / is a / causes</code>). Drop the appendix with <code>?compact</code> for pure body." },
        { kind: "p", html: "The middleware also routes <code>{id}.md</code> / <code>/b/{id}.md</code> / <code>/hub/{slug}.md</code> as convenience aliases so users can paste a <code>.md</code> suffix and get the raw form directly." },
      ],
    },
    {
      id: "query-knobs", num: "03", title: "Query knobs",
      blocks: [
        { kind: "p", html: "Three knobs control token economy on raw responses:" },
        { kind: "callout", html: "<p><code>?compact</code> &mdash; strip whitespace, drop noisy quote blocks, condense long lines. Works on every raw URL. Typical 30–50% token reduction.</p><p><code>?full=1</code> &mdash; bundle only. Inline every member doc body after the analysis section. Default returns the digest (link list).</p><p><code>?graph=0</code> &mdash; bundle only. Drop the canvas analysis section. Use when the receiving AI only wants the doc inventory.</p>" },
        { kind: "p", html: "Knobs combine. <code>?compact&full=1</code> returns every doc inline, whitespace stripped — useful for one-shot full-bundle context. <code>?compact&graph=0</code> returns the doc inventory only, no analysis." },
      ],
    },
    {
      id: "llms-txt", num: "04", title: "llms.txt manifest",
      blocks: [
        { kind: "p", html: "Following the <a href=\"https://llmstxt.org/\" target=\"_blank\" rel=\"noopener noreferrer\">llms.txt standard</a>: every public hub publishes a crawl manifest at:" },
        { kind: "pre", lang: "http", code: "GET /hub/{slug}/llms.txt" },
        { kind: "p", html: "The body lists every public doc and bundle with title, URL, and ≤200-char description, plus pointers to the <code>?compact</code> and <code>?digest</code> variants. Agents that prefer a manifest crawl over a one-shot payload fetch <code>llms.txt</code> first, then walk to specific docs on demand." },
        { kind: "p", html: "<code>/hub/{slug}/llms-full.txt</code> serves a denser variant capped at 80k tokens by default (override with <code>?cap=</code>) for AI tools that prefer one fetch over many." },
      ],
    },
    {
      id: "bundle-digest", num: "05", title: "Bundle digest shape",
      blocks: [
        { kind: "p", html: "Bundle responses ship the canvas analysis inline so the receiving AI inherits the prior AI's work for free:" },
        { kind: "pre", lang: "markdown", code: `---
mw_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>
analysis_stale: true        # only when a member doc was edited after the analysis
source: "memory.wiki"
---

# <Bundle title>
> <description>
**Intent:** <intent>

## Summary
<canvas summary>

## Themes
- ...

## Cross-document insights
- ...

## Key takeaways
- ...

## Open questions / gaps
- ...

## Notable connections
- **doc A** ↔ **doc B** — <relationship>

## Concepts (this bundle)
- **concept** (from **doc title**)

## Concept relations
- **conceptA** ↔ **conceptB** — <edge label>

1. [Doc 1](https://memory.wiki/<docId>) — annotation
2. [Doc 2](https://memory.wiki/<docId>) — annotation
...` },
      ],
    },
    {
      id: "retrieval-api", num: "06", title: "Retrieval API",
      blocks: [
        { kind: "p", html: "One endpoint, hybrid retrieval (semantic + keyword + optional rerank). Hub-scoped, public." },
        { kind: "pre", lang: "http", code: `POST /api/hub/{slug}/recall
Content-Type: application/json

{
  "question": "react hooks vs context",
  "k": 5,
  "level": "doc",         // doc | chunk | bundle
  "hybrid": true,         // chunk-level only — BM25 + vector reciprocal rank fusion
  "rerank": true          // Anthropic Haiku cross-encoder; doubles latency, raises precision
}` },
        { kind: "pre", lang: "json", code: `{
  "hub": { "slug": "you", "display_name": "..." },
  "results": [
    {
      "id": "abc123",
      "title": "React hooks crash course",
      "url": "https://memory.wiki/abc123",
      "snippet": "...react hooks let you...",
      "distance": 0.13,
      "updated_at": "2026-04-10T..."
    }
  ]
}` },
        { kind: "p", html: "<strong>k</strong> capped at 20. <strong>distance</strong> is cosine — lower is more relevant. <strong>level=chunk</strong> returns paragraph-level matches with doc id + heading path. <strong>level=bundle</strong> matches against bundle titles + descriptions." },
      ],
    },
    {
      id: "concept-index", num: "07", title: "Concept index",
      blocks: [
        { kind: "p", html: "The hub-wide concept index is the AI-era replacement for hand-typed categories and tags. Built incrementally by the bundle analysis pipeline — every Analyze run upserts concepts the LLM extracted from that bundle's docs." },
        { kind: "p", html: "Public surface:" },
        { kind: "pre", lang: "http", code: "GET /hub/{slug}/c/{concept}           # rendered per-concept page (HTML)\nGET /raw/hub/{slug}/c/{concept}        # same, raw markdown variant" },
        { kind: "p", html: "Per-concept page returns: canonical label, description, source documents, neighbour concepts. The neighbours come from <code>concept_relations</code> typed edges (supports / elaborates / contradicts / exemplifies / contains). Same edge vocabulary the bundle canvas uses." },
      ],
    },
    {
      id: "privacy", num: "08", title: "Privacy gates",
      blocks: [
        { kind: "p", html: "Three states, applied uniformly to docs, bundles, and hubs." },
        { kind: "callout", html: "<p><code>Public</code> &mdash; published; no <code>allowed_emails</code>. Anonymous AI fetches succeed.</p><p><code>Restricted</code> &mdash; published; <code>allowed_emails</code> set. Fetcher must pass <code>Authorization: Bearer &lt;token&gt;</code> as the owner, or <code>X-User-Email</code> matching an allowed address. Otherwise 403/404.</p><p><code>Private</code> &mdash; not published. Owner JWT only.</p>" },
        { kind: "p", html: "Every gating decision happens server-side in the raw-fetch routes — there's no path by which a URL can leak content the rendered viewer wouldn't already show. Revoking <code>allowed_emails</code> takes effect on the next fetch." },
      ],
    },
    {
      id: "why-no-wikilinks", num: "09", title: "Why no [[wikilinks]]",
      blocks: [
        { kind: "p", html: "Traditional wikis (Wikipedia, Roam, Obsidian) build their graph by having humans type <code>[[other page]]</code>. memory.wiki doesn't ship that syntax. It's a deliberate omission." },
        { kind: "p", html: "<code>[[wikilink]]</code> is a 2003-era mechanism for compensating for AI's absence. A user typing <code>[[React Hooks]]</code> tells the system &ldquo;these pages are related.&rdquo; In 2026 the AI does that work without being asked: <code>concept_index</code> extracts &quot;React Hooks&quot; as a concept from any doc that meaningfully discusses it, and <code>concept_relations</code> wires those concepts to neighbours by typed edges." },
        { kind: "p", html: "The user-facing replacement is the <strong>Related in this hub</strong> panel rendered below every public doc — other docs that share concepts with the current one, surfaced by the AI's analysis. Same information traditional backlinks would give, without anyone having to type the link." },
        { kind: "p", html: "<strong>The AI does the linking; you write.</strong>" },
      ],
    },
    {
      id: "partner-impl", num: "10", title: "Implementing this spec",
      blocks: [
        { kind: "p", html: "Three integration paths, all stable." },
        { kind: "ol", items: [
          "<strong>URL paste.</strong> Drop a memory.wiki URL into any AI chat. The model fetches the raw variant automatically. Zero config, works today across Claude / ChatGPT / Cursor / Gemini.",
          "<strong>Context file reference.</strong> Add the URL to <code>AGENTS.md</code> / <code>CLAUDE.md</code> / <code>.cursor/rules</code>. The AI dev tool fetches on every session boot. See <a href=\"/docs/integrate\">/docs/integrate</a> for per-tool snippets.",
          "<strong>API integration.</strong> Call <code>POST /api/hub/{slug}/recall</code> directly for precise retrieval. No SDK required — plain HTTP. The endpoint is hub-public, no API key needed.",
        ]},
        { kind: "p", html: "The reference renderer is <code>markdown-it</code> with footnotes + GFM, configured identically to TipTap so authoring and viewing surfaces produce the same DOM. Source: <a href=\"https://github.com/raymindai/memory-wiki\" target=\"_blank\" rel=\"noopener noreferrer\">github.com/raymindai/memory-wiki</a>." },
      ],
    },
  ],
  footnote: "Spec version 0.1 (draft) — open for feedback. PRs welcome via the repo.",
  footer: {
    columns: [
      { title: "Product",   links: [
        { label: "Workspace", href: "/" },
        { label: "Hubs",      href: "/hubs" },
        { label: "Spec",      href: "/spec" },
      ]},
      { title: "Surfaces",  links: [
        { label: "Web editor", href: "/" },
        { label: "Chrome",     href: "/plugins#chrome" },
        { label: "VS Code",    href: "/plugins#vscode" },
        { label: "Mac App",    href: "/plugins#desktop" },
        { label: "CLI",        href: "/plugins#cli" },
        { label: "MCP",        href: "/plugins#mcp" },
      ]},
      { title: "Resources", links: [
        { label: "About",     href: "/about" },
        { label: "Use cases", href: "/cases" },
        { label: "Benchmark", href: "/about#benchmark" },
        { label: "Manifesto", href: "/manifesto" },
        { label: "Docs",      href: "/docs" },
        { label: "GitHub",    href: "https://github.com/raymindai/memory-wiki" },
      ]},
      { title: "Legal",     links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms",   href: "/terms" },
      ]},
      { title: "Contact",   links: [
        { label: "hi@raymind.ai", href: "mailto:hi@raymind.ai" },
      ]},
    ],
    bottomLeft: "A product of Raymind.AI",
    bottomRight: "© 2026 memory.wiki. All rights reserved.",
    tagline: "Personal knowledge hub for the AI era.",
    parent: { label: "A product of Raymind.AI", href: "https://raymind.ai" },
  },
};

/* ─────────────────────────────────────────────────────────────
   KOREAN
   ───────────────────────────────────────────────────────────── */

export const specKo: SpecContent = {
  nav: [
    { label: "소개",     href: "/ko/about" },
    { label: "벤치마크", href: "/ko/about#benchmark" },
    { label: "선언문",   href: "/ko/manifesto" },
    { label: "문서",     href: "/ko/docs" },
  ],
  navCta: "허브 시작하기",
  navCtaHref: "/",
  hero: {
    eyebrow: "memory.wiki / spec",
    title: "AI 시대 wiki의 공개 스펙.",
    intro: "memory.wiki는 어떤 AI도 읽을 수 있는 개인 지식 wiki입니다. 이 페이지는 URL 계약, retrieval API, llms.txt 매니페스트, bundle digest를 문서화합니다 — memory.wiki 레퍼런스 구현이 오늘 ship하는 같은 primitives. 다른 도구도 이 스펙을 구현해서 플랫폼 lock-in 없이 interop 가능합니다.",
    meta: "엔진 라이선스: MIT. 레퍼런스 구현: <a href=\"https://memory.wiki\">memory.wiki</a>. 스펙 버전: 0.1 (draft, 2026-05-15).",
  },
  toc: {
    heading: "목차",
    items: [
      { id: "why-this-spec",    label: "이 스펙이 존재하는 이유" },
      { id: "url-contract",     label: "URL 계약" },
      { id: "raw-markdown",     label: "Raw 마크다운 변형" },
      { id: "query-knobs",      label: "쿼리 노브 (compact / full / graph)" },
      { id: "llms-txt",         label: "llms.txt 매니페스트" },
      { id: "bundle-digest",    label: "Bundle digest 형태" },
      { id: "retrieval-api",    label: "Retrieval API" },
      { id: "concept-index",    label: "Concept index" },
      { id: "privacy",          label: "프라이버시 게이트" },
      { id: "why-no-wikilinks", label: "왜 [[wikilink]] 없는가" },
      { id: "partner-impl",     label: "이 스펙 구현하기" },
    ],
  },
  sections: [
    {
      id: "why-this-spec", num: "00", title: "이 스펙이 존재하는 이유",
      blocks: [
        { kind: "p", html: "모든 AI 개발 도구 — Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Aider — 가 프로젝트별 컨텍스트를 원합니다. 오늘 사용자는 <code>CLAUDE.md</code> / <code>AGENTS.md</code> / <code>.cursor/rules</code>에 그 컨텍스트를 손으로 큐레이션하고, 한 주 안에 stale해집니다. memory.wiki는 큐레이션 단계를 AI-readable URL로 대체합니다 — 한 사람의 지식 그래프를 구조화한 표현을 반환. 이 스펙을 따르는 어떤 도구든 같은 payload를 fetch해서 동기화 유지 가능." },
        { kind: "p", html: "스펙은 의도적으로 미니멀합니다. 콘텐츠는 마크다운, 주소는 URL, 토큰-경제 노브는 쿼리 파라미터. 특수 스키마 없음, SDK lock-in 없음. <strong>이건 의도된 것</strong> — 스펙이 adoption을 얻는 유일한 방법은 구현 비용이 싼 것." },
      ],
    },
    {
      id: "url-contract", num: "01", title: "URL 계약",
      blocks: [
        { kind: "p", html: "세 가지 스코프, 각각 주소 지정 가능, 각각 AI-readable." },
        { kind: "callout", html: "<p><code>memory.wiki/{id}</code> &mdash; 단일 문서. 토큰 비용 최소; 한 노트, 한 결정.</p><p><code>memory.wiki/b/{id}</code> &mdash; 큐레이션된 문서 묶음 + 사전 계산된 그래프 분석 (themes, insights, concept relations). 프로젝트 레벨 도구 설정의 권장 스코프.</p><p><code>memory.wiki/@{user}</code> &mdash; 전체 hub. 넓은 컨텍스트, hub-wide concept index 포함. 사용 자제.</p>" },
      ],
    },
    {
      id: "raw-markdown", num: "02", title: "Raw 마크다운 변형",
      blocks: [
        { kind: "p", html: "모든 공개 URL은 <code>/raw/...</code>에서 clean-markdown sibling을 제공:" },
        { kind: "pre", lang: "http", code: "GET /raw/{docId}\nGET /raw/b/{bundleId}\nGET /raw/hub/{slug}\nGET /raw/hub/{slug}/c/{concept}" },
        { kind: "p", html: "응답은 <code>text/markdown</code>, UTF-8. Frontmatter(YAML)는 AI가 attribute하고 재사용하는 데 필요한 정보를 담음 — title, canonical URL, updated ISO, source, 그리고 추출된 tags + concept/relation 카운트:" },
        { kind: "pre", lang: "markdown", code: `---
mw_doc: 1
title: "React hooks 속성"
url: https://memory.wiki/abc123
updated: 2026-05-26T10:14:00Z
source: "ChatGPT"
tags: ["react", "hooks", "useEffect"]
concept_count: 9
relation_count: 7
---

# React hooks 속성
…clean markdown body…

## Concepts (this doc)
- **React Hooks** — 함수형 컴포넌트의 stateful API
- **useState** — 컴포넌트 로컬 state
- …

## Concept relations (this doc)
- **useState** → *is a* → **React Hooks**
- **Stale closure** → *caused by* → **useEffect**
- …` },
        { kind: "p", html: "본문 끝의 <code>Concepts</code>와 <code>Concept relations</code> 섹션은 문서 레벨 knowledge graph — 백그라운드 <code>doc_ontology</code> 잡(Claude Haiku)이 첫 저장과 매 수정 시 추출. 번들 레이어와 같은 typed-edge vocabulary (<code>supports / elaborates / contradicts / exemplifies / contains / defines / depends_on / is a / causes</code>). 본문만 원하면 <code>?compact</code>로 부록 제거." },
        { kind: "p", html: "미들웨어가 <code>{id}.md</code> / <code>/b/{id}.md</code> / <code>/hub/{slug}.md</code>도 같은 곳으로 라우팅 — <code>.md</code> 접미사 paste만으로 raw form 접근." },
      ],
    },
    {
      id: "query-knobs", num: "03", title: "쿼리 노브",
      blocks: [
        { kind: "p", html: "raw 응답의 토큰 경제를 제어하는 세 가지 노브:" },
        { kind: "callout", html: "<p><code>?compact</code> &mdash; 공백 제거, noisy quote 블록 drop, 긴 라인 압축. 모든 raw URL에서 동작. 일반적으로 30~50% 토큰 감소.</p><p><code>?full=1</code> &mdash; bundle 전용. 분석 섹션 뒤에 모든 멤버 doc 본문 인라인. 디폴트는 digest (링크 리스트).</p><p><code>?graph=0</code> &mdash; bundle 전용. 캔버스 분석 섹션 drop. 받는 AI가 doc 인벤토리만 원할 때 사용.</p>" },
        { kind: "p", html: "노브 조합 가능. <code>?compact&full=1</code>은 모든 doc 인라인 + 공백 제거 — one-shot 전체 번들 컨텍스트에 유용. <code>?compact&graph=0</code>은 doc 인벤토리만, 분석 없음." },
      ],
    },
    {
      id: "llms-txt", num: "04", title: "llms.txt 매니페스트",
      blocks: [
        { kind: "p", html: "<a href=\"https://llmstxt.org/\" target=\"_blank\" rel=\"noopener noreferrer\">llms.txt 표준</a>을 따름: 모든 공개 hub는 다음 위치에 크롤 매니페스트 publish:" },
        { kind: "pre", lang: "http", code: "GET /hub/{slug}/llms.txt" },
        { kind: "p", html: "본문은 모든 공개 doc와 bundle의 title, URL, ≤200자 설명 + <code>?compact</code>와 <code>?digest</code> 변형 포인터. 매니페스트 크롤을 선호하는 에이전트는 <code>llms.txt</code>를 먼저 fetch 후 필요한 doc로 walk." },
        { kind: "p", html: "<code>/hub/{slug}/llms-full.txt</code>는 디폴트 80k 토큰 (override: <code>?cap=</code>)으로 더 densely 묶인 변형 — one-shot fetch 선호 AI 도구용." },
      ],
    },
    {
      id: "bundle-digest", num: "05", title: "Bundle digest 형태",
      blocks: [
        { kind: "p", html: "Bundle 응답은 캔버스 분석을 인라인으로 ship — 받는 AI가 이전 AI의 작업을 무료로 이어받음:" },
        { kind: "pre", lang: "markdown", code: `---
mw_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>
analysis_stale: true        # 분석 이후 멤버 doc이 수정됐을 때만
source: "memory.wiki"
---

# <Bundle title>
> <description>
**Intent:** <intent>

## Summary
<canvas summary>

## Themes
- ...

## Cross-document insights
- ...

## Key takeaways
- ...

## Open questions / gaps
- ...

## Notable connections
- **doc A** ↔ **doc B** — <relationship>

## Concepts (this bundle)
- **concept** (from **doc title**)

## Concept relations
- **conceptA** ↔ **conceptB** — <edge label>

1. [Doc 1](https://memory.wiki/<docId>) — annotation
2. [Doc 2](https://memory.wiki/<docId>) — annotation
...` },
      ],
    },
    {
      id: "retrieval-api", num: "06", title: "Retrieval API",
      blocks: [
        { kind: "p", html: "한 endpoint, 하이브리드 retrieval (semantic + keyword + 선택적 rerank). Hub-scoped, public." },
        { kind: "pre", lang: "http", code: `POST /api/hub/{slug}/recall
Content-Type: application/json

{
  "question": "react hooks vs context",
  "k": 5,
  "level": "doc",         // doc | chunk | bundle
  "hybrid": true,         // chunk 레벨 전용 — BM25 + vector reciprocal rank fusion
  "rerank": true          // Anthropic Haiku cross-encoder; 지연 2배, 정밀도 향상
}` },
        { kind: "pre", lang: "json", code: `{
  "hub": { "slug": "you", "display_name": "..." },
  "results": [
    {
      "id": "abc123",
      "title": "React hooks crash course",
      "url": "https://memory.wiki/abc123",
      "snippet": "...react hooks let you...",
      "distance": 0.13,
      "updated_at": "2026-04-10T..."
    }
  ]
}` },
        { kind: "p", html: "<strong>k</strong> 최대 20. <strong>distance</strong>는 cosine — 낮을수록 관련성 높음. <strong>level=chunk</strong>는 paragraph 레벨 매치 + doc id + heading path. <strong>level=bundle</strong>은 번들 title + description 대상." },
      ],
    },
    {
      id: "concept-index", num: "07", title: "Concept index",
      blocks: [
        { kind: "p", html: "Hub-wide concept index는 손으로 박는 카테고리/태그의 AI 시대 대체. Bundle 분석 파이프라인이 incremental하게 구축 — Analyze 실행마다 LLM이 그 번들의 docs에서 추출한 concept upsert." },
        { kind: "p", html: "공개 surface:" },
        { kind: "pre", lang: "http", code: "GET /hub/{slug}/c/{concept}           # 렌더된 컨셉 페이지 (HTML)\nGET /raw/hub/{slug}/c/{concept}        # 같은 내용, raw 마크다운" },
        { kind: "p", html: "컨셉 페이지 반환: canonical label, description, source documents, neighbour concepts. Neighbours는 <code>concept_relations</code>의 타입 엣지 (supports / elaborates / contradicts / exemplifies / contains)에서. 번들 캔버스가 쓰는 같은 엣지 vocabulary." },
      ],
    },
    {
      id: "privacy", num: "08", title: "프라이버시 게이트",
      blocks: [
        { kind: "p", html: "세 가지 상태, doc / bundle / hub에 균일하게 적용." },
        { kind: "callout", html: "<p><code>Public</code> &mdash; 퍼블리시 됨; <code>allowed_emails</code> 없음. 익명 AI fetch 성공.</p><p><code>Restricted</code> &mdash; 퍼블리시 됨; <code>allowed_emails</code> 설정. fetcher가 owner JWT의 <code>Authorization: Bearer &lt;token&gt;</code> 또는 허용 주소와 매치되는 <code>X-User-Email</code> 전달 필요. 아니면 403/404.</p><p><code>Private</code> &mdash; 퍼블리시 안 됨. Owner JWT만 가능.</p>" },
        { kind: "p", html: "모든 게이팅 결정은 서버 사이드 raw-fetch 라우트에서 일어남 — URL이 렌더된 viewer가 안 보여주는 콘텐츠를 leak할 경로 없음. <code>allowed_emails</code> 회수는 다음 fetch부터 적용." },
      ],
    },
    {
      id: "why-no-wikilinks", num: "09", title: "왜 [[wikilink]] 없는가",
      blocks: [
        { kind: "p", html: "전통 wiki (Wikipedia, Roam, Obsidian)는 사람이 <code>[[other page]]</code>를 타이핑해서 그래프를 구축. memory.wiki는 그 syntax를 ship하지 않음. 의도된 omission." },
        { kind: "p", html: "<code>[[wikilink]]</code>는 AI의 부재를 보완하기 위한 2003년 메커니즘. 사용자가 <code>[[React Hooks]]</code>를 타이핑하는 건 시스템에게 &ldquo;이 페이지들은 관련이 있다&rdquo;라고 알리는 것. 2026년에는 AI가 묻지 않아도 그 작업을 함: <code>concept_index</code>가 의미 있게 다루는 모든 doc에서 &quot;React Hooks&quot;를 컨셉으로 추출, <code>concept_relations</code>가 그 컨셉을 이웃과 타입 엣지로 연결." },
        { kind: "p", html: "사용자 facing 대체는 모든 공개 doc 아래 렌더링되는 <strong>Related in this hub</strong> 패널 — 현재 doc와 컨셉을 공유하는 다른 docs, AI의 분석이 surfaced. 전통 backlinks가 줬을 같은 정보, 사람이 링크를 박을 필요 없음." },
        { kind: "p", html: "<strong>링킹은 AI가 한다. 사용자는 글을 쓴다.</strong>" },
      ],
    },
    {
      id: "partner-impl", num: "10", title: "이 스펙 구현하기",
      blocks: [
        { kind: "p", html: "세 가지 통합 경로, 모두 안정적." },
        { kind: "ol", items: [
          "<strong>URL paste.</strong> memory.wiki URL을 어떤 AI 채팅에든 drop. 모델이 raw variant를 자동 fetch. Zero config, Claude / ChatGPT / Cursor / Gemini에서 오늘 동작.",
          "<strong>컨텍스트 파일 reference.</strong> <code>AGENTS.md</code> / <code>CLAUDE.md</code> / <code>.cursor/rules</code>에 URL 추가. AI 개발 도구가 매 세션 부팅마다 fetch. 도구별 스니펫: <a href=\"/ko/docs/integrate\">/ko/docs/integrate</a>.",
          "<strong>API 통합.</strong> 정밀 retrieval을 위해 <code>POST /api/hub/{slug}/recall</code> 직접 호출. SDK 불필요 — plain HTTP. Endpoint는 hub-public, API 키 불필요.",
        ]},
        { kind: "p", html: "레퍼런스 렌더러는 <code>markdown-it</code> + footnotes + GFM. TipTap과 동일 config라 작성 측과 뷰어 측이 같은 DOM을 출력. 소스: <a href=\"https://github.com/raymindai/memory-wiki\" target=\"_blank\" rel=\"noopener noreferrer\">github.com/raymindai/memory-wiki</a>." },
      ],
    },
  ],
  footnote: "스펙 버전 0.1 (draft) — 피드백 환영. 저장소 PR으로.",
  footer: {
    columns: [
      { title: "제품",       links: [
        { label: "워크스페이스", href: "/" },
        { label: "허브",         href: "/hubs" },
        { label: "Spec",         href: "/ko/spec" },
      ]},
      { title: "표면",       links: [
        { label: "웹 에디터", href: "/" },
        { label: "Chrome",   href: "/ko/plugins#chrome" },
        { label: "VS Code",  href: "/ko/plugins#vscode" },
        { label: "Mac App",  href: "/ko/plugins#desktop" },
        { label: "CLI",      href: "/ko/plugins#cli" },
        { label: "MCP",      href: "/ko/plugins#mcp" },
      ]},
      { title: "리소스",     links: [
        { label: "소개",     href: "/ko/about" },
        { label: "사용 사례", href: "/cases" },
        { label: "벤치마크", href: "/ko/about#benchmark" },
        { label: "선언문",   href: "/ko/manifesto" },
        { label: "문서",     href: "/ko/docs" },
        { label: "GitHub",   href: "https://github.com/raymindai/memory-wiki" },
      ]},
      { title: "법적 고지",  links: [
        { label: "개인정보처리방침", href: "/privacy" },
        { label: "이용 약관",        href: "/terms" },
      ]},
      { title: "연락처",     links: [
        { label: "hi@raymind.ai", href: "mailto:hi@raymind.ai" },
      ]},
    ],
    bottomLeft: "Raymind.AI 가 만든 제품",
    bottomRight: "© 2026 memory.wiki. All rights reserved.",
    tagline: "AI 시대의 개인 지식 허브.",
    parent: { label: "Raymind.AI 가 만든 제품", href: "https://raymind.ai" },
  },
};

export function getSpecContent(locale: Locale): SpecContent {
  return locale === "ko" ? specKo : specEn;
}
