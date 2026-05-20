import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, DocsNav, SiteFooter } from "@/components/docs";

const mono = { fontFamily: "var(--font-geist-mono), monospace" } as const;

export const metadata: Metadata = {
  title: "memori.wiki — Open Spec",
  description:
    "URL 계약, retrieval API, llms.txt, bundle digest, concept index 의 공개 스펙. 어떤 AI 도구든 구현 가능. memori.wiki 는 AI 시대 wiki — 링킹은 AI 가 하고 사용자는 글을 씁니다.",
  alternates: {
    canonical: "https://memory.wiki/ko/spec",
    languages: { en: "https://memory.wiki/spec" },
  },
  openGraph: {
    title: "memori.wiki — Open Spec",
    description: "AI 시대 wiki 를 위한 URL 계약 + retrieval API + llms.txt. 오픈, MIT 라이선스 엔진.",
    url: "https://memory.wiki/ko/spec",
    images: [{ url: "/api/og?title=memori.wiki%20Spec", width: 1200, height: 630 }],
  },
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ ...mono, fontSize: 12.5, color: "var(--text-primary)", background: "var(--toggle-bg)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border-dim)" }}>
      {children}
    </code>
  );
}

function Block({ children, lang }: { children: string; lang?: string }) {
  return (
    <div style={{ margin: "12px 0 24px" }}>
      <CodeBlock lang={lang}>{children}</CodeBlock>
    </div>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 96, marginBottom: 56 }}>
      <p style={{ ...mono, color: "var(--accent)", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{eyebrow}</p>
      <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: "0 0 14px" }}>{title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.75, color: "var(--text-muted)", maxWidth: 720 }}>{children}</div>
    </section>
  );
}

export default function SpecPageKo() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav lang="ko" />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "56px 24px 96px" }}>
        <p style={{ ...mono, color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          memori.wiki / spec
        </p>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 16px", lineHeight: 1.15 }}>
          AI 시대 wiki 의 공개 스펙.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.7, color: "var(--text-muted)", marginBottom: 24, maxWidth: 720 }}>
          memori.wiki 는 어떤 AI 도 읽을 수 있는 개인 지식 wiki 입니다. 이 페이지는 URL 계약, retrieval API, llms.txt 매니페스트, bundle digest 를 문서화합니다 — memory.wiki 레퍼런스 구현이 오늘 ship 하는 같은 primitives. 다른 도구도 이 스펙을 구현해서 플랫폼 lock-in 없이 interop 가능합니다.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-faint)", marginBottom: 48, maxWidth: 720 }}>
          엔진 라이선스: MIT. 레퍼런스 구현:{" "}
          <Link href="https://memory.wiki" style={{ color: "var(--accent)" }}>memory.wiki</Link>. 스펙 버전: 0.1 (draft, 2026-05-15).
        </p>

        <nav style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginBottom: 56 }}>
          <p style={{ ...mono, fontSize: 10, color: "var(--text-faint)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>목차</p>
          <ol style={{ listStyle: "decimal inside", margin: 0, padding: 0, fontSize: 14, lineHeight: 2, color: "var(--text-secondary)" }}>
            {[
              ["why-this-spec", "이 스펙이 존재하는 이유"],
              ["url-contract", "URL 계약"],
              ["raw-markdown", "Raw 마크다운 변형"],
              ["query-knobs", "쿼리 노브 (compact / full / graph)"],
              ["llms-txt", "llms.txt 매니페스트"],
              ["bundle-digest", "Bundle digest 형태"],
              ["retrieval-api", "Retrieval API"],
              ["concept-index", "Concept index"],
              ["privacy", "프라이버시 게이트"],
              ["why-no-wikilinks", "왜 [[wikilink]] 없는가"],
              ["partner-impl", "이 스펙 구현하기"],
            ].map(([id, label]) => (
              <li key={id}>
                <Link href={`#${id}`} style={{ color: "var(--text-secondary)" }}>{label}</Link>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="why-this-spec" eyebrow="00" title="이 스펙이 존재하는 이유">
          <p>
            모든 AI 개발 도구 — Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Aider — 가 프로젝트별 컨텍스트를 원합니다. 오늘 사용자는 <Code>CLAUDE.md</Code> / <Code>AGENTS.md</Code> / <Code>.cursor/rules</Code> 에 그 컨텍스트를 손으로 큐레이션하고, 한 주 안에 stale 해집니다. memori.wiki 는 큐레이션 단계를 AI-readable URL 로 대체합니다 — 한 사람의 지식 그래프를 구조화한 표현을 반환. 이 스펙을 따르는 어떤 도구든 같은 payload 를 fetch 해서 동기화 유지 가능.
          </p>
          <p>
            스펙은 의도적으로 미니멀합니다. 콘텐츠는 마크다운, 주소는 URL, 토큰-경제 노브는 쿼리 파라미터. 특수 스키마 없음, SDK lock-in 없음. <strong>이건 의도된 것</strong> — 스펙이 adoption 을 얻는 유일한 방법은 *구현 비용이 싼 것*.
          </p>
        </Section>

        <Section id="url-contract" eyebrow="01" title="URL 계약">
          <p>세 가지 스코프, 각각 주소 지정 가능, 각각 AI-readable.</p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}><Code>memori.wiki/&#123;user&#125;/&#123;slug&#125;</Code> &nbsp; — &nbsp; 단일 문서. 토큰 비용 최소; 한 노트, 한 결정.</p>
            <p style={{ marginBottom: 12 }}><Code>memori.wiki/&#123;user&#125;/b/&#123;bundle&#125;</Code> &nbsp; — &nbsp; 큐레이션된 문서 묶음 + 사전 계산된 그래프 분석 (themes, insights, concept relations). 프로젝트 레벨 도구 설정의 권장 스코프.</p>
            <p style={{ marginBottom: 0 }}><Code>memori.wiki/&#123;user&#125;</Code> &nbsp; — &nbsp; 전체 hub. 넓은 컨텍스트, hub-wide concept index 포함. 사용 자제.</p>
          </div>
          <p style={{ marginTop: 20 }}>
            리브랜드 전환 기간 동안 <Code>memory.wiki/&#123;id&#125;</Code>, <Code>memory.wiki/b/&#123;id&#125;</Code>, <Code>memory.wiki/hub/&#123;slug&#125;</Code> 가 같은 payload 로 resolve. <Code>mori.wiki/...</Code> 는 <Code>memori.wiki/...</Code> 로 301.
          </p>
        </Section>

        <Section id="raw-markdown" eyebrow="02" title="Raw 마크다운 변형">
          <p>모든 공개 URL 은 <Code>/raw/...</Code> 에서 clean-markdown sibling 을 제공:</p>
          <Block lang="endpoints">{`GET /raw/{docId}
GET /raw/b/{bundleId}
GET /raw/hub/{slug}
GET /raw/hub/{slug}/c/{concept}`}</Block>
          <p>응답은 <Code>text/markdown</Code>, UTF-8, YAML frontmatter 블록이 AI 에게 어떤 스코프를 받았는지 알려줌. 브라우저에서 보면 plain 마크다운.</p>
          <p>미들웨어가 <Code>{`{id}.md`}</Code> / <Code>{`/b/{id}.md`}</Code> / <Code>{`/hub/{slug}.md`}</Code> 도 같은 곳으로 라우팅 — <Code>.md</Code> 접미사 paste 만으로 raw form 접근.</p>
        </Section>

        <Section id="query-knobs" eyebrow="03" title="쿼리 노브">
          <p>raw 응답의 토큰 경제를 제어하는 세 가지 노브:</p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}><Code>?compact</Code> &nbsp; — &nbsp; 공백 제거, noisy quote 블록 drop, 긴 라인 압축. 모든 raw URL 에서 동작. 일반적으로 30-50% 토큰 감소.</p>
            <p style={{ marginBottom: 12 }}><Code>?full=1</Code> &nbsp; — &nbsp; bundle 전용. 분석 섹션 뒤에 모든 멤버 doc 본문 인라인. 디폴트는 digest (링크 리스트).</p>
            <p style={{ marginBottom: 0 }}><Code>?graph=0</Code> &nbsp; — &nbsp; bundle 전용. 캔버스 분석 섹션 drop. 받는 AI 가 doc 인벤토리만 원할 때 사용.</p>
          </div>
          <p style={{ marginTop: 20 }}>
            노브 조합 가능. <Code>?compact&full=1</Code> 은 모든 doc 인라인 + 공백 제거 — one-shot 전체 번들 컨텍스트에 유용. <Code>?compact&graph=0</Code> 은 doc 인벤토리만, 분석 없음.
          </p>
        </Section>

        <Section id="llms-txt" eyebrow="04" title="llms.txt 매니페스트">
          <p>
            <Link href="https://llmstxt.org/" style={{ color: "var(--accent)" }}>llms.txt 표준</Link>을 따름: 모든 공개 hub 는 다음 위치에 크롤 매니페스트 publish:
          </p>
          <Block lang="endpoint">{`GET /hub/{slug}/llms.txt`}</Block>
          <p>본문은 모든 공개 doc 와 bundle 의 title, URL, ≤200자 설명 + <Code>?compact</Code> 와 <Code>?digest</Code> 변형 포인터. 매니페스트 크롤을 선호하는 에이전트는 <Code>llms.txt</Code> 를 먼저 fetch 후 필요한 doc 로 walk.</p>
          <p><Code>{`/hub/{slug}/llms-full.txt`}</Code> 는 디폴트 80k 토큰 (override: <Code>?cap=</Code>) 으로 더 densely 묶인 변형 — one-shot fetch 선호 AI 도구용.</p>
        </Section>

        <Section id="bundle-digest" eyebrow="05" title="Bundle digest 형태">
          <p>Bundle 응답은 캔버스 분석을 인라인으로 ship — 받는 AI 가 이전 AI 의 작업을 무료로 이어받음:</p>
          <Block lang="markdown">{`---
mdfy_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>
analysis_stale: true        # 분석 이후 멤버 doc 이 수정됐을 때만
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
...`}</Block>
        </Section>

        <Section id="retrieval-api" eyebrow="06" title="Retrieval API">
          <p>한 endpoint, 하이브리드 retrieval (semantic + keyword + 선택적 rerank). Hub-scoped, public.</p>
          <Block lang="request">{`POST /api/hub/{slug}/recall
Content-Type: application/json

{
  "question": "react hooks vs context",
  "k": 5,
  "level": "doc",         // doc | chunk | bundle
  "hybrid": true,         // chunk 레벨 전용 — BM25 + vector reciprocal rank fusion
  "rerank": true          // Anthropic Haiku cross-encoder; 지연 2배, 정밀도 향상
}`}</Block>
          <Block lang="response">{`{
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
}`}</Block>
          <p><strong>k</strong> 최대 20. <strong>distance</strong> 는 cosine — 낮을수록 관련성 높음. <strong>level=chunk</strong> 는 paragraph 레벨 매치 + doc id + heading path. <strong>level=bundle</strong> 은 번들 title + description 대상.</p>
        </Section>

        <Section id="concept-index" eyebrow="07" title="Concept index">
          <p>Hub-wide concept index 는 손으로 박는 카테고리/태그의 AI 시대 대체. Bundle 분석 파이프라인이 incremental 하게 구축 — Analyze 실행마다 LLM 이 그 번들의 docs 에서 추출한 concept upsert.</p>
          <p>공개 surface:</p>
          <Block lang="endpoints">{`GET /hub/{slug}/c/{concept}           # 렌더된 컨셉 페이지 (HTML)
GET /raw/hub/{slug}/c/{concept}        # 같은 내용, raw 마크다운`}</Block>
          <p>컨셉 페이지 반환: canonical label, description, source documents, neighbour concepts. Neighbours 는 <Code>concept_relations</Code> 의 타입 엣지 (supports / elaborates / contradicts / exemplifies / contains) 에서. 번들 캔버스가 쓰는 같은 엣지 vocabulary.</p>
        </Section>

        <Section id="privacy" eyebrow="08" title="프라이버시 게이트">
          <p>세 가지 상태, doc / bundle / hub 에 균일하게 적용.</p>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: "16px 20px", marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}><Code>Public</Code> &nbsp; — &nbsp; 퍼블리시 됨; <Code>allowed_emails</Code> 없음. 익명 AI fetch 성공.</p>
            <p style={{ marginBottom: 12 }}><Code>Restricted</Code> &nbsp; — &nbsp; 퍼블리시 됨; <Code>allowed_emails</Code> 설정. fetcher 가 owner JWT 의 <Code>Authorization: Bearer &lt;token&gt;</Code> 또는 허용 주소와 매치되는 <Code>X-User-Email</Code> 전달 필요. 아니면 403/404.</p>
            <p style={{ marginBottom: 0 }}><Code>Private</Code> &nbsp; — &nbsp; 퍼블리시 안 됨. Owner JWT 만 가능.</p>
          </div>
          <p style={{ marginTop: 20 }}>모든 게이팅 결정은 서버 사이드 raw-fetch 라우트에서 일어남 — URL 이 렌더된 viewer 가 안 보여주는 콘텐츠를 leak 할 경로 없음. <Code>allowed_emails</Code> 회수는 다음 fetch 부터 적용.</p>
        </Section>

        <Section id="why-no-wikilinks" eyebrow="09" title="왜 [[wikilink]] 없는가">
          <p>전통 wiki (Wikipedia, Roam, Obsidian) 는 사람이 <Code>[[other page]]</Code> 를 타이핑해서 그래프를 구축. memori.wiki 는 그 syntax 를 ship 하지 않음. 의도된 omission.</p>
          <p><Code>[[wikilink]]</Code> 는 AI 의 부재를 보완하기 위한 2003년 메커니즘. 사용자가 <Code>[[React Hooks]]</Code> 를 타이핑하는 건 시스템에게 &ldquo;이 페이지들은 관련이 있다&rdquo; 라고 알리는 것. 2026년에는 AI 가 묻지 않아도 그 작업을 함: <Code>concept_index</Code> 가 의미 있게 다루는 모든 doc 에서 &quot;React Hooks&quot; 를 컨셉으로 추출, <Code>concept_relations</Code> 가 그 컨셉을 이웃과 타입 엣지로 연결.</p>
          <p>사용자 facing 대체는 모든 공개 doc 아래 렌더링되는 <strong>Related in this hub</strong> 패널 — 현재 doc 와 컨셉을 공유하는 다른 docs, AI 의 분석이 surfaced. 전통 backlinks 가 줬을 같은 정보, 사람이 링크를 박을 필요 없음.</p>
          <p><strong>링킹은 AI 가 한다. 사용자는 글을 쓴다.</strong></p>
        </Section>

        <Section id="partner-impl" eyebrow="10" title="이 스펙 구현하기">
          <p>세 가지 통합 경로, 모두 안정적.</p>
          <ol style={{ paddingLeft: 20, margin: "12px 0 24px", lineHeight: 1.9 }}>
            <li><strong>URL paste.</strong> memori.wiki URL 을 어떤 AI 채팅에든 drop. 모델이 raw variant 를 자동 fetch. Zero config, Claude / ChatGPT / Cursor / Gemini 에서 오늘 동작.</li>
            <li><strong>컨텍스트 파일 reference.</strong> <Code>AGENTS.md</Code> / <Code>CLAUDE.md</Code> / <Code>.cursor/rules</Code> 에 URL 추가. AI 개발 도구가 매 세션 부팅마다 fetch. 도구별 스니펫: <Link href="/ko/docs/integrate" style={{ color: "var(--accent)" }}>/ko/docs/integrate</Link>.</li>
            <li><strong>API 통합.</strong> 정밀 retrieval 을 위해 <Code>POST /api/hub/&#123;slug&#125;/recall</Code> 직접 호출. SDK 불필요 — plain HTTP. Endpoint 는 hub-public, API 키 불필요.</li>
          </ol>
          <p>레퍼런스 렌더러는 <Code>markdown-it</Code> + footnotes + GFM. TipTap과 동일 config라 작성 측과 뷰어 측이 같은 DOM을 출력. 소스: <Link href="https://github.com/raymindai/mdcore" style={{ color: "var(--accent)" }}>github.com/raymindai/mdcore</Link>.</p>
        </Section>

        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 64, paddingTop: 24, borderTop: "1px solid var(--border-dim)" }}>
          스펙 버전 0.1 (draft) — 피드백 환영. 저장소 PR 으로.
        </p>
      </main>

      <SiteFooter lang="ko" />
    </div>
  );
}
