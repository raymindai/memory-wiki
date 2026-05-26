"use client";

/**
 * /how — full technical walkthrough.
 * Single 720px reading column, manifesto-shape: narrative + PureProse +
 * code snippets + the cross-AI benchmark table woven in at the point
 * the reader is asking "okay, but does this actually work?".
 */

import Link from "next/link";
import "../manifesto/manifesto.css";
import "./how.css";
import {
  PureProse,
  PureCodeBlock,
} from "@/components/pure";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";

const DOC_FRONTMATTER = `---
mw_doc: 1
title: "React hooks crash course"
url: https://memory.wiki/abc123
updated: 2026-05-26T10:14:00Z
source: "ChatGPT (chat.openai.com)"
tags: ["react", "hooks", "useEffect", "rendering"]
concept_count: 9
relation_count: 7
---

# React hooks crash course
…clean markdown body, exactly what you saved.

## Concepts (this doc)
- **React Hooks** — function-only API for stateful logic
- **useState** — local component state
- **useEffect** — side effects, cleanup, deps
- **Stale closure** — captured state pitfall in callbacks
- …

## Concept relations (this doc)
- **useState** → *is a* → **React Hooks**
- **useEffect** → *is a* → **React Hooks**
- **Stale closure** → *caused by* → **useEffect**
- **Dependencies array** → *governs* → **Stale closure**
- …`;

const BUNDLE_DIGEST = `---
mw_bundle: 1
id: bnd789
title: "Frontend craft"
url: https://memory.wiki/b/bnd789
document_count: 12
updated: 2026-05-26T10:14:00Z
analysis_generated_at: 2026-05-24T08:00:00Z
analysis_stale: false
---

# Frontend craft
> A reading list around modern React, hooks, and rendering.

## Themes
- React Server Components vs client components
- Hook composition patterns
- Performance budgets

## Cross-document insights
- Three docs agree on "lift state up only when needed"
- Two docs contradict on RSC + Suspense boundaries

## Key takeaways
- ...

## Concepts (this bundle)
- **React Hooks** (from "React hooks crash course")
- **Server Components** (from "RSC field notes")
- **Suspense** (from "Streaming with Suspense")

1. [React hooks crash course](https://memory.wiki/abc123) — the primer
2. [RSC field notes](https://memory.wiki/def456) — production lessons
…`;

const HUB_LLMS_TXT = `# Hyunsang's hub — memory.wiki/@hyunsang

> Personal knowledge base, public docs.

## Documents
- [React hooks crash course](https://memory.wiki/abc123) — the primer
- [Cross-AI eval methodology](https://memory.wiki/ghi321) — how we benchmark
…

## Bundles
- [Frontend craft](https://memory.wiki/b/bnd789) — React reading list
- [LLM eval](https://memory.wiki/b/bnd654) — methodology notes

## Concepts (hub-wide)
- React Hooks, Server Components, Suspense, RAG, hybrid retrieval, …`;

const PASTE_FLOW = `You: read memory.wiki/@hyunsang and answer using my notes
Claude: (fetches /raw/hub/hyunsang → gets the manifest)
        (walks links to specific docs as needed)
        Based on your "Cross-AI eval methodology" doc and
        "Frontend craft" bundle, here's the answer …`;

export default function HowPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const isKo = locale === "ko";

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/how" : "/how"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={[
        { id: "document",        label: isKo ? "문서가 태어남"        : "A document is born" },
        { id: "doc-kg",          label: isKo ? "문서 지식 그래프"     : "Doc-level knowledge graph" },
        { id: "bundle",          label: isKo ? "문서에서 번들로"      : "From doc to bundle" },
        { id: "hub",             label: isKo ? "허브"                  : "The hub" },
        { id: "updates",         label: isKo ? "수정이 일어날 때"     : "When something updates" },
        { id: "paste",           label: isKo ? "AI가 보는 것"          : "What the AI sees" },
        { id: "benchmark",       label: isKo ? "실제로 동작하나"      : "Does it actually work" },
        { id: "what-we-skipped", label: isKo ? "일부러 빠뜨린 것"     : "What we didn't build" },
      ]}
    >
          <div className="pure-manifesto-page">
            <div className="pure-manifesto-readtime mono">{isKo ? "8분 분량" : "8 min read"}</div>
            <h1 className="pure-manifesto-title">
              {isKo ? "Memory.Wiki가 실제로 어떻게 동작하나." : "How Memory.Wiki actually works."}
            </h1>
            <p className="pure-manifesto-intro">
              {isKo
                ? "문서가 생기고, 번들이 묶이고, 허브가 자동 발행되고, 수정이 전파되고, 어떤 AI라도 그 URL을 읽습니다. 이 페이지는 전체 라이프사이클을 그대로 보여줍니다 — 클라이언트에서 무엇이 일어나는지, 서버에서 무엇이 일어나는지, 외부 AI가 당신의 URL을 가져갈 때 무엇을 보는지."
                : "A document is born, a bundle assembles itself, a hub auto-publishes, updates ripple through, and any AI reads the URL. This page walks the whole lifecycle — what happens client-side, what happens server-side, and what an external AI sees when it fetches your URL."}
            </p>

            {/* 1 — A document is born */}
            <PureProse>
              <h2 id="document">{isKo ? "1. 문서가 태어나는 순간" : "1. A document is born"}</h2>
              <p>
                {isKo ? (
                  <>AI 대화의 유용한 한 덩어리를 캡처합니다 — 예를 들어 ChatGPT가 설명해준 React hooks. Chrome 확장 아이콘을 누릅니다. 3초 후 영구 URL이 생깁니다: <code>memory.wiki/abc123</code>.</>
                ) : (
                  <>You capture a useful chunk of an AI conversation — say, a ChatGPT explanation of React hooks. You click the Chrome extension. Three seconds later you have a permanent URL: <code>memory.wiki/abc123</code>.</>
                )}
              </p>
            </PureProse>

            <div className="pure-how-diagram">
              <div className="pure-how-row">
                <div className="pure-how-node">
                  <div className="pure-how-node-eyebrow">{isKo ? "원본" : "Source"}</div>
                  <div className="pure-how-node-label">{isKo ? "AI 채팅 페이지" : "AI chat page"}</div>
                  <div className="pure-how-node-sub">ChatGPT / Claude / Gemini</div>
                </div>
                <span className="pure-how-arrow">→</span>
                <div className="pure-how-node">
                  <div className="pure-how-node-eyebrow">{isKo ? "캡처" : "Capture"}</div>
                  <div className="pure-how-node-label">{isKo ? "DOM → 마크다운" : "DOM → markdown"}</div>
                  <div className="pure-how-node-sub">{isKo ? "UI 제거, 코드 보존" : "strip chrome, keep code"}</div>
                </div>
                <span className="pure-how-arrow">→</span>
                <div className="pure-how-node is-output">
                  <div className="pure-how-node-eyebrow">{isKo ? "저장" : "Stored"}</div>
                  <div className="pure-how-node-label">memory.wiki/abc123</div>
                  <div className="pure-how-node-sub">{isKo ? "v1 + 편집 토큰" : "v1 + edit token"}</div>
                </div>
              </div>
              <div className="pure-how-diagram-caption">
                {isKo ? "캡처 파이프라인 / 처음부터 끝까지 3초" : "Capture pipeline · 3 seconds end-to-end"}
              </div>
            </div>

            <PureProse>
              <p>{isKo ? "내부에서 일어난 일:" : "What happened under the hood:"}</p>
              <ol>
                {isKo ? (
                  <>
                    <li>확장이 채팅 페이지의 보이는 DOM을 따라가며 깨끗한 마크다운으로 변환합니다 — 코드 블록, 리스트, 헤딩은 보존, UI와 광고는 제거.</li>
                    <li>그 마크다운을 API로 POST합니다. 서버가 영구 ID를 발급하고, 이후 수정용 편집 토큰을 반환하고, 본문 옆에 YAML frontmatter 블록을 저장합니다.</li>
                    <li>문서가 버전 1이 됩니다. 이후 모든 편집은 새 버전을 만들고, URL은 절대 바뀌지 않고, 독자는 항상 최신 버전을 봅니다.</li>
                    <li>백그라운드로 <code>doc_ontology</code> 잡이 큐에 들어갑니다. LLM이 본문을 읽고, 문서가 다루는 개념들을 추출하고, 그 사이의 typed edge를 작성합니다. 이게 문서 레벨 지식 그래프입니다 (다음 섹션 참고).</li>
                  </>
                ) : (
                  <>
                    <li>The extension walked the visible DOM of the chat page and converted it to clean markdown — code blocks, lists, headings preserved; chrome and ads stripped.</li>
                    <li>It POSTed that markdown to the API. The server minted a permanent ID, returned an edit token (for later updates), and stored a YAML frontmatter block alongside the body.</li>
                    <li>The doc became version 1. Every subsequent edit creates a new version; the URL never changes, the latest version is what readers see.</li>
                    <li>A <code>doc_ontology</code> job was enqueued in the background. An LLM read the body, extracted the concepts the doc talks about, and wrote typed edges between them. That&apos;s the doc-level knowledge graph (see the next section).</li>
                  </>
                )}
              </ol>
            </PureProse>

            {/* 1b — Doc-level knowledge graph */}
            <PureProse>
              <h2 id="doc-kg">
                {isKo ? "1b. 문서 자체의 지식 그래프" : "1b. The document's own knowledge graph"}
              </h2>
              <p>
                {isKo ? (
                  <>문서는 단순한 마크다운이 아닙니다 — 작은 그래프이기도 합니다. 저장하자마자 백그라운드 추출기가 문서가 실제로 다루는 개념들 (분량에 따라 5~15개) 과 그 사이의 typed edge를 뽑아냅니다. 번들 레이어에서 쓰는 같은 edge 어휘 (<code>supports / elaborates / contradicts / exemplifies / contains / defines / depends_on</code>) 를 그대로 쓰되, 한 문서로 스코프가 좁혀져 있습니다.</>
                ) : (
                  <>A document is not just markdown — it&apos;s also a small graph. As soon as you save, a background extractor pulls out the concepts the doc actually discusses (5 to 15, depending on length) and the typed edges between them. Same edge vocabulary the bundle layer uses (<code>supports / elaborates / contradicts / exemplifies / contains / defines / depends_on</code>), just scoped to one doc.</>
                )}
              </p>
            </PureProse>

            <div className="pure-how-diagram">
              <div className="pure-how-bundle">
                <div className="pure-how-node">
                  <div className="pure-how-node-eyebrow">{isKo ? "입력" : "Input"}</div>
                  <div className="pure-how-node-label">{isKo ? "문서 마크다운" : "Doc markdown"}</div>
                  <div className="pure-how-node-sub">memory.wiki/abc123</div>
                </div>
                <span className="pure-how-arrow">→</span>
                <div className="pure-how-container">
                  <div className="pure-how-container-title">
                    {isKo ? "doc_ontology 출력" : "doc_ontology output"}
                  </div>
                  <ul className="pure-how-container-list">
                    <li><code>{isKo ? "개념" : "Concepts"}</code> React Hooks · useState · useEffect · Stale closure · Dependencies array</li>
                    <li><code>{isKo ? "관계" : "Relations"}</code> useState <em>{isKo ? "는 일종의" : "is a"}</em> React Hooks</li>
                    <li><code>{isKo ? "관계" : "Relations"}</code> useEffect <em>{isKo ? "는 일종의" : "is a"}</em> React Hooks</li>
                    <li><code>{isKo ? "관계" : "Relations"}</code> Stale closure <em>{isKo ? "는 인해 발생" : "caused by"}</em> useEffect</li>
                    <li><code>{isKo ? "관계" : "Relations"}</code> Dependencies array <em>{isKo ? "가 좌우" : "governs"}</em> Stale closure</li>
                  </ul>
                </div>
              </div>
              <div className="pure-how-diagram-caption">
                {isKo ? "문서 하나 → 자체 개념 그래프 / 번들 + 허브 레이어와 같은 어휘" : "One doc → its own concept graph · same vocab as bundle + hub layers"}
              </div>
            </div>

            <PureProse>
              <p>
                {isKo ? (
                  <>이 edge들은 <code>concept_relations</code>에 문서 id를 evidence로 저장됩니다. 같은 개념이 다른 문서에 나타나면, 사람이 <code>[[wikilink]]</code>를 칠 필요 없이 허브 레벨에서 그래프가 자동으로 문서들을 엮습니다.</>
                ) : (
                  <>These edges are stored in <code>concept_relations</code> with the doc id as evidence. When the same concept turns up in another doc, the graph stitches itself across docs at the hub level automatically — no <code>[[wikilinks]]</code> for the human to type.</>
                )}
              </p>
              <p>
                {isKo ? (
                  <>AI가 raw 엔드포인트로 <code>memory.wiki/abc123</code>을 가져오면 보이는 내용:</>
                ) : (
                  <>What an AI sees when it fetches <code>memory.wiki/abc123</code> via the raw endpoint:</>
                )}
              </p>
            </PureProse>
            <PureCodeBlock code={DOC_FRONTMATTER} lang="markdown" />
            <PureProse>
              <p>
                {isKo ? (
                  <>그게 Document URL의 모든 contract입니다: 깨끗한 마크다운 본문, AI에게 어떤 스코프를 받았는지 알려주는 frontmatter 블록, tags 리스트, 그리고 본문 아래에 추가되는 구조화된 grounding 시그널 — 문서 자체의 concept 그래프. SDK 없음, 인증 없음, rate limit 없음. 부록 빼고 공백만 정리한 본문이 필요하면 <code>?compact</code>를 붙이세요.</>
                ) : (
                  <>That&apos;s the whole contract for a Document URL: clean markdown body, a frontmatter block telling the AI which scope it just received, a tags list, and a structured grounding signal — the doc&apos;s own concept graph — appended below the body. No SDK, no auth, no rate limits. Pass <code>?compact</code> to drop the appendix and trim whitespace if you only want the prose.</>
                )}
              </p>
            </PureProse>

            {/* 2 — From doc to bundle */}
            <PureProse>
              <h2 id="bundle">{isKo ? "2. 문서에서 번들로" : "2. From doc to bundle"}</h2>
              <p>
                {isKo ? (
                  <>문서 하나도 유용합니다. 같은 주제의 문서 12개가 모이면 그 이상이 됩니다 — 큐레이션된 리딩 리스트에 cross-document 인사이트가 얹힌 것. 그게 <strong>번들</strong>입니다: <code>memory.wiki/b/bnd789</code>.</>
                ) : (
                  <>One doc is useful. Twelve docs on the same topic become something more — a curated reading list with cross-document insights. That&apos;s a <strong>bundle</strong>: <code>memory.wiki/b/bnd789</code>.</>
                )}
              </p>
            </PureProse>

            <div className="pure-how-diagram">
              <div className="pure-how-bundle">
                <div className="pure-how-bundle-stack">
                  <div className="pure-how-node">
                    <div className="pure-how-node-sub">memory.wiki/abc123</div>
                    <div className="pure-how-node-label">React hooks crash course</div>
                  </div>
                  <div className="pure-how-node">
                    <div className="pure-how-node-sub">memory.wiki/def456</div>
                    <div className="pure-how-node-label">RSC field notes</div>
                  </div>
                  <div className="pure-how-node">
                    <div className="pure-how-node-sub">{isKo ? "+ 문서 10개 더" : "+ 10 more docs"}</div>
                    <div className="pure-how-node-label">…</div>
                  </div>
                </div>
                <span className="pure-how-arrow">→</span>
                <div className="pure-how-container">
                  <div className="pure-how-container-title">memory.wiki/b/bnd789</div>
                  <ul className="pure-how-container-list">
                    <li><code>{isKo ? "테마" : "Themes"}</code> {isKo ? "RSC와 클라이언트, hook 조합" : "RSC vs client, hook composition"}</li>
                    <li><code>{isKo ? "인사이트" : "Insights"}</code> {isKo ? "3개 문서 동의, 2개 상충" : "3 docs agree, 2 contradict"}</li>
                    <li><code>{isKo ? "개념" : "Concepts"}</code> Hooks · Server Components · Suspense</li>
                    <li><code>{isKo ? "핵심" : "Takeaways"}</code> {isKo ? "+ 정렬된 링크 리스트" : "+ ordered link list"}</li>
                  </ul>
                </div>
              </div>
              <div className="pure-how-diagram-caption">
                {isKo ? "N개 문서 → 1개 번들 URL / 분석은 캐시, 매 fetch마다 재실행 안 함" : "N docs → 1 bundle URL · analysis cached, not re-run on every fetch"}
              </div>
            </div>

            <PureProse>
              <p>
                {isKo
                  ? "번들은 두 가지 방식으로 만듭니다. 에디터에서 직접 문서를 골라 묶거나, AI에게 묶어달라고 요청합니다 (\"React 렌더링 관련된 거 다 묶어줘\"). 어느 쪽이든 번들은 영구 URL을 얻습니다."
                  : "You build a bundle two ways. You hand-pick docs in the editor, or you ask the AI to assemble one (“bundle everything I have on React rendering”). Either way, the bundle gets its own permanent URL."}
              </p>
              <p>
                {isKo
                  ? "번들이 처음 분석될 때 LLM 한 번이 추출합니다: 한 줄 description, 문서들을 가로지르는 테마 3~5개, cross-document 인사이트와 모순점, concept relations, 핵심 takeaway. 분석은 번들의 digest에 캐시되고, 매 fetch마다 재생성되지 않습니다."
                  : "When a bundle is first analyzed, an LLM run extracts: a one-line description, three to five themes that cut across the docs, cross-document insights and contradictions, concept relations, and key takeaways. The analysis is cached in the bundle’s digest, not regenerated on every fetch."}
              </p>
              <p>
                {isKo
                  ? "번들 URL은 분석을 인라인으로 함께 보내므로 받는 AI는 이전 AI의 작업을 공짜로 이어받습니다:"
                  : "A bundle URL ships its analysis inline so the receiving AI inherits the prior AI’s work for free:"}
              </p>
            </PureProse>
            <PureCodeBlock code={BUNDLE_DIGEST} lang="markdown" />
            <PureProse>
              <p>
                {isKo
                  ? "Compact 번들 digest는 모든 멤버 문서를 인라인하는 것보다 토큰이 5~9× 저렴하면서도, 받는 AI가 필요시 특정 문서로 walk할 수 있게 해줍니다. 그 trade-off가 번들 레이어가 존재하는 이유 전부입니다."
                  : "The compact bundle digest is 5 to 9× cheaper in tokens than inlining every member doc, while still letting the receiving AI walk to any specific doc on demand. That tradeoff is the whole reason the bundle layer exists."}
              </p>
            </PureProse>

            {/* 3 — The hub */}
            <PureProse>
              <h2 id="hub">{isKo ? "3. 허브" : "3. The hub"}</h2>
              <p>
                {isKo ? (
                  <>당신의 허브는 발행한 모든 문서와 번들을 담는 namespace입니다. 제 것은 <code>memory.wiki/@hyunsang</code>입니다. 당신 것은 <code>memory.wiki/@&lt;you&gt;</code>입니다.</>
                ) : (
                  <>Your hub is the namespace that holds every doc and bundle you&apos;ve published. Mine is <code>memory.wiki/@hyunsang</code>. Yours is <code>memory.wiki/@&lt;you&gt;</code>.</>
                )}
              </p>
            </PureProse>

            <div className="pure-how-diagram">
              <div className="pure-how-container" style={{ maxWidth: 560 }}>
                <div className="pure-how-container-title">memory.wiki/@you</div>
                <ul className="pure-how-container-list">
                  <li><code>{isKo ? "문서" : "Docs"}</code> {isKo ? "47개 발행, public" : "47 published, public"}</li>
                  <li><code>{isKo ? "번들" : "Bundles"}</code> {isKo ? "8개 큐레이션, 분석 캐시 포함" : "8 curated, with cached analysis"}</li>
                  <li><code>index.md</code> {isKo ? "사람이 읽는 디렉토리" : "human-readable directory"}</li>
                  <li><code>SCHEMA.md</code> {isKo ? "기계가 읽는 구조" : "machine-readable structure"}</li>
                  <li><code>log.md</code> {isKo ? "시간순 히스토리" : "chronological history"}</li>
                  <li><code>llms.txt</code> {isKo ? "AI가 찾아낼 매니페스트" : "AI-discoverable manifest"}</li>
                  <li><code>{isKo ? "Concept index" : "Concept index"}</code> {isKo ? "허브 전체, 자동 추출" : "hub-wide, auto-extracted"}</li>
                </ul>
              </div>
              <div className="pure-how-diagram-caption">
                {isKo ? "namespace 하나. 저장하면 전부 자동 발행." : "One namespace. Everything auto-published as you save."}
              </div>
            </div>

            <PureProse>
              <p>
                {isKo ? (
                  <>허브 URL은 단일 문서를 가져오지 않습니다 — AI가 당신의 지식 레이어에 뭐가 있는지 파악할 수 있는 매니페스트를 반환합니다. <a href="https://llmstxt.org/" target="_blank" rel="noopener noreferrer">llms.txt</a> 표준을 따라:</>
                ) : (
                  <>The hub URL doesn&apos;t fetch a single document — it returns a manifest that lets the AI discover what&apos;s in your knowledge layer. Following the <a href="https://llmstxt.org/" target="_blank" rel="noopener noreferrer">llms.txt</a> standard:</>
                )}
              </p>
            </PureProse>
            <PureCodeBlock code={HUB_LLMS_TXT} lang="markdown" />
            <PureProse>
              <p>
                {isKo ? (
                  <>매니페스트는 발행하는대로 자동으로 빌드됩니다 — 수동 큐레이션 없음. 허브는 <code>index.md</code> (사람용), <code>SCHEMA.md</code> (기계용 구조), <code>log.md</code> (시간순 히스토리) 도 자동 발행합니다. 허브 전체에 걸친 concept index는 모든 문서를 가로질러, 같은 아이디어가 어디어디에 등장하는지를 드러냅니다.</>
                ) : (
                  <>The manifest is built automatically as you publish — no manual curation. The hub also auto-publishes an <code>index.md</code> (human-readable), a <code>SCHEMA.md</code> (machine-readable structure), and a <code>log.md</code> (chronological history). A hub-wide concept index spans every doc, surfacing where the same idea shows up across your knowledge.</>
                )}
              </p>
              <p>
                {isKo
                  ? "Claude나 ChatGPT에 허브 URL을 한 번 붙여넣는 것으로 충분합니다 — AI가 매니페스트를 가져와서, 필요한 문서로 walk합니다. 전체 corpus가 한 context window에 들어갈 필요가 없습니다."
                  : "Pasting the hub URL into Claude or ChatGPT once is enough — the AI fetches the manifest, then walks to specific docs on demand. The full corpus never has to fit in one context window."}
              </p>
            </PureProse>

            {/* 4 — When something updates */}
            <PureProse>
              <h2 id="updates">{isKo ? "4. 수정이 일어날 때" : "4. When something updates"}</h2>
              <p>
                {isKo
                  ? "문서를 편집합니다 — URL은 그대로. 새 버전이 스냅샷됩니다. 독자는 항상 최신을 보지만, 버전 간 diff를 볼 수도 있고, 이전 버전을 복원할 수도 있습니다."
                  : "You edit a doc — the URL stays the same. A new version is snapshotted. Readers always see the latest, but you can diff between versions or restore any prior one."}
              </p>
            </PureProse>

            <div className="pure-how-diagram">
              <div className="pure-how-timeline">
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">01</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>저장</strong>: <code>memory.wiki/abc123</code>에 편집을 저장. URL 그대로, 버전이 v2로.</>
                    ) : (
                      <><strong>You save</strong> an edit to <code>memory.wiki/abc123</code>. URL unchanged, version bumps to v2.</>
                    )}
                  </div>
                </div>
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">02</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>번들</strong>: 이 문서를 포함하는 번들들이 digest에 <code>analysis_stale: true</code> 표시.</>
                    ) : (
                      <><strong>Bundles</strong> that contain this doc mark <code>analysis_stale: true</code> in their digest.</>
                    )}
                  </div>
                </div>
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">03</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>허브 매니페스트</strong>: 재발행 — <code>llms.txt</code>, <code>index.md</code>, <code>log.md</code> 전부 업데이트.</>
                    ) : (
                      <><strong>Hub manifest</strong> re-publishes — <code>llms.txt</code>, <code>index.md</code>, <code>log.md</code> all updated.</>
                    )}
                  </div>
                </div>
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">04</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>Concept index</strong>: 백그라운드에서 증분 upsert — 전체 재빌드 없음.</>
                    ) : (
                      <><strong>Concept index</strong> runs an incremental upsert in the background — no full rebuild.</>
                    )}
                  </div>
                </div>
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">05</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>재분석</strong>: 번들 재분석 (클릭 또는 스케줄) 으로 stale 플래그를 지우고 인사이트를 갱신.</>
                    ) : (
                      <><strong>Re-analyze</strong> the bundle (click or schedule) to clear the stale flag and refresh insights.</>
                    )}
                  </div>
                </div>
              </div>
              <div className="pure-how-diagram-caption">
                {isKo ? "한 번의 편집 → 번들과 허브로 자동 전파." : "One edit → ripples through bundles and hub automatically."}
              </div>
            </div>

            <PureProse>
              <p>
                {isKo
                  ? "결과: 모든 URL이 항상 살아있음. 404 나는 거 없음. Stale 상태는 숨겨지지 않고 드러남. 노트를 위해 CI 파이프라인을 유지하지 않아도 됨."
                  : "Net effect: every URL is always live. Nothing 404s. Stale state is visible, not hidden. You don’t maintain a CI pipeline for your notes."}
              </p>
            </PureProse>

            {/* 5 — Reading from the other side */}
            <PureProse>
              <h2 id="paste">{isKo ? "5. 붙여넣었을 때 AI가 보는 것" : "5. What the AI sees when you paste"}</h2>
              <p>
                {isKo
                  ? "전체 아키텍처는 받는 AI가 깨끗하게 읽을 수 있을 때만 의미가 있습니다. Claude나 ChatGPT에 Memory.Wiki URL을 붙여넣었을 때 일어나는 일:"
                  : "The whole architecture only matters if the receiving AI can read it cleanly. Here’s what happens when you paste a Memory.Wiki URL into Claude or ChatGPT:"}
              </p>
            </PureProse>

            <div className="pure-how-diagram">
              <div className="pure-how-row">
                <div className="pure-how-node">
                  <div className="pure-how-node-eyebrow">{isKo ? "사용자" : "You"}</div>
                  <div className="pure-how-node-label">{isKo ? "URL 붙여넣기" : "Paste URL"}</div>
                  <div className="pure-how-node-sub">memory.wiki/@you</div>
                </div>
                <span className="pure-how-arrow">→</span>
                <div className="pure-how-node">
                  <div className="pure-how-node-eyebrow">AI</div>
                  <div className="pure-how-node-label">{isKo ? "/raw fetch" : "Fetch /raw"}</div>
                  <div className="pure-how-node-sub">{isKo ? "인증 없음, SDK 없음" : "no auth, no SDK"}</div>
                </div>
                <span className="pure-how-arrow">→</span>
                <div className="pure-how-node is-output">
                  <div className="pure-how-node-eyebrow">{isKo ? "서버" : "Server"}</div>
                  <div className="pure-how-node-label">{isKo ? "마크다운 반환" : "Returns markdown"}</div>
                  <div className="pure-how-node-sub">{isKo ? "frontmatter + 본문" : "frontmatter + body"}</div>
                </div>
              </div>
              <div className="pure-how-diagram-caption">
                {isKo ? "Claude · ChatGPT · Gemini · Cursor · Codex 모두 동일 흐름." : "Same flow for Claude · ChatGPT · Gemini · Cursor · Codex."}
              </div>
            </div>

            <PureCodeBlock code={PASTE_FLOW} lang="markdown" />
            <PureProse>
              <p>
                {isKo ? (
                  <>Claude (또는 ChatGPT, Gemini, Cursor) 가 raw 엔드포인트 — <code>/raw/hub/&lt;you&gt;</code> — 를 치고 frontmatter 블록이 붙은 plain 마크다운을 받습니다. Frontmatter가 AI에게: 이건 허브 매니페스트지 단일 문서가 아니라고 알려줍니다. AI는 매니페스트의 링크를 따라 필요한 문서로 walk합니다.</>
                ) : (
                  <>Claude (or ChatGPT, or Gemini, or Cursor) hits the raw endpoint — <code>/raw/hub/&lt;you&gt;</code> — and receives plain markdown with a frontmatter block. Frontmatter tells the AI: this is a hub manifest, not a single doc. The AI follows links from the manifest to specific docs as it needs them.</>
                )}
              </p>
              <p>
                {isKo
                  ? "받는 쪽은 SDK도, API 키도, 플러그인도 필요 없습니다. URL을 fetch할 수 있는 능력만 있으면 됩니다 — 모든 모던 AI 도구가 갖춘 능력."
                  : "The receiver doesn’t need an SDK, an API key, or a plugin. It needs only the ability to fetch URLs — a capability every modern AI tool ships."}
              </p>
              <p>
                {isKo ? (
                  <>토큰 경제: 어떤 raw URL에든 <code>?compact</code>를 붙이면 공백과 quote 블록이 제거됩니다 (보통 30~50% 절감). 번들에 <code>?full=1</code>을 붙이면 모든 멤버 문서가 인라인됩니다. 번들의 <code>?graph=0</code>은 분석 섹션을 뺍니다. 옵션들은 조합 가능.</>
                ) : (
                  <>Token economy: pass <code>?compact</code> on any raw URL to strip whitespace and noisy quote blocks (typical 30 to 50% reduction). Pass <code>?full=1</code> on a bundle to inline every member doc. <code>?graph=0</code> on a bundle drops the analysis section. Knobs combine.</>
                )}
              </p>
            </PureProse>

            {/* 6 — Does it actually work? → /benchmark summary card */}
            <PureProse>
              <h2 id="benchmark">{isKo ? "6. 실제로 동작하나?" : "6. Does it actually work?"}</h2>
              <p>
                {isKo
                  ? "URL contract는 주장입니다. 독립적으로 검증하기 위해 오픈 cross-AI 평가를 돌립니다 — 모든 주요 AI에 대해, 모델이 학습 때 봤을법한 허브와 절대로 못 봤을 허브 둘 다."
                  : "The URL contract is a claim. To verify it independently, we run an open cross-AI evaluation — every major AI, both a hub the model could plausibly have seen during training and a hub it definitely hasn’t."}
              </p>
              <p>
                {isKo ? (
                  <>핵심: 보이지 않는 허브에 대한 paste 모드에서 faithfulness <strong>100%</strong>. Browse 모드 (AI가 URL을 직접 fetch) <strong>98%</strong> — 2% 갭은 fetch 실패지, contract 실패가 아님. Adversarial refusal도 100% — URL 스코프 밖의 것을 물으면 AI가 답을 지어내지 않고 거부.</>
                ) : (
                  <>Headline: <strong>100%</strong> faithfulness on paste mode against the unseen hub. <strong>98%</strong> on browse mode (AI fetches the URL itself) — the 2% gap is fetch failure, not contract failure. Adversarial refusal also at 100% — when asked something outside the URL&apos;s scope, the AI refuses rather than fabricates.</>
                )}
              </p>
              <p>
                {isKo ? (
                  <>전체 방법론, judge 프롬프트, 라운드별 결과, 재현 레시피 →{" "}
                  <Link href={isKo ? "/benchmark" : "/benchmark"}>벤치마크 페이지 보기</Link>.</>
                ) : (
                  <>Full methodology, judge prompt, round-by-round results, replication recipe →{" "}
                  <Link href="/benchmark">read the benchmark page</Link>.</>
                )}
              </p>
            </PureProse>

            {/* 7 — What we did NOT build */}
            <PureProse>
              <h2 id="what-we-skipped">{isKo ? "7. 일부러 만들지 않은 것" : "7. What we deliberately did not build"}</h2>
              <p>
                {isKo ? "예상했을 법한 세 가지, 일부러 빠뜨린 것:" : "Three things you might expect that are intentionally absent:"}
              </p>
              <ul>
                {isKo ? (
                  <>
                    <li><strong><code>[[wikilink]]</code> 없음.</strong> 전통적 위키는 사람이 그래프를 타이핑하게 합니다. Memory.Wiki는 concept index를 자동 추출합니다 — 링크는 AI가 걸고, 당신은 글만 씁니다.</li>
                    <li><strong>SDK 없음.</strong> 인터페이스는 URL입니다. URL을 fetch할 수 있는 모든 것이 클라이언트.</li>
                    <li><strong>독자 블록 없음.</strong> 포맷은 마크다운 그 자체. Memory.Wiki가 내일 사라져도 당신 문서는 여전히 어떤 에디터에서든 열리는 마크다운 파일.</li>
                  </>
                ) : (
                  <>
                    <li><strong>No <code>[[wikilinks]]</code>.</strong> Traditional wikis make humans type the graph. Memory.Wiki extracts a concept index automatically — the AI does the linking, you write.</li>
                    <li><strong>No SDK.</strong> The interface is the URL. Anything that can fetch a URL is a client.</li>
                    <li><strong>No proprietary blocks.</strong> Markdown is the entire format. If Memory.Wiki disappears tomorrow, your docs are still markdown files you can open in any editor.</li>
                  </>
                )}
              </ul>
              <p>
                {isKo ? (
                  <>그게 시스템 전부. 직접 구현하고 싶으면 <Link href={isKo ? "/ko/spec" : "/spec"}>오픈 스펙</Link>이 모든 엔드포인트와 query 옵션을 문서화하고 있습니다.</>
                ) : (
                  <>That&apos;s the system. The full <Link href="/spec">open spec</Link> documents every endpoint and query knob if you want to implement against it.</>
                )}
              </p>
            </PureProse>
          </div>
    </PureDocsShell>
  );
}
