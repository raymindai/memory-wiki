"use client";

import PureDocsShell from "@/components/PureDocsShell";
import { PureCodeBlock } from "@/components/pure";
import "./integrate-docs.css";

type Locale = "en" | "ko";

/* ─── Sidebar / on-this-page TOC ─── */
const TOC_EN = [
  { id: "overview",      label: "Overview" },
  { id: "quickstart",    label: "30-second setup" },
  { id: "pick-url",      label: "Pick the right URL" },
  { id: "permissions",   label: "Privacy & sharing" },
  { id: "agents-md",     label: "AGENTS.md (cross-tool)" },
  { id: "claude-code",   label: "Claude Code" },
  { id: "cursor",        label: "Cursor" },
  { id: "codex",         label: "Codex CLI" },
  { id: "gemini",        label: "Gemini CLI" },
  { id: "windsurf",      label: "Windsurf" },
  { id: "aider",         label: "Aider" },
  { id: "github-action", label: "GitHub Action sync" },
  { id: "staleness",     label: "Staleness + auto-analyze" },
];

const TOC_KO = [
  { id: "overview",    label: "개요" },
  { id: "quickstart",  label: "30초 셋업" },
  { id: "pick-url",    label: "어떤 URL 을 쓸지" },
  { id: "permissions", label: "권한과 공유" },
  { id: "agents-md",   label: "AGENTS.md — 여기부터" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor",      label: "Cursor" },
  { id: "codex",       label: "Codex CLI" },
  { id: "gemini",      label: "Gemini CLI" },
  { id: "windsurf",    label: "Windsurf" },
  { id: "aider",       label: "Aider" },
  { id: "staleness",   label: "Stale 와 auto-analyze" },
];

/* ─── ToolBlock ─── */
function ToolBlock({
  id,
  name,
  filePath,
  tagline,
  snippet,
  notes,
}: {
  id: string;
  name: string;
  filePath: string;
  tagline: string;
  snippet: string;
  notes?: React.ReactNode;
}) {
  return (
    <div id={id} className="pure-integrate-docs-tool">
      <div className="pure-integrate-docs-tool-head">
        <h3 className="pure-integrate-docs-tool-name">{name}</h3>
        <code className="pure-integrate-docs-tool-path">{filePath}</code>
      </div>
      <p className="pure-integrate-docs-tool-tagline">{tagline}</p>
      <PureCodeBlock code={snippet} lang="markdown" />
      {notes && <p className="pure-integrate-docs-tool-notes">{notes}</p>}
    </div>
  );
}

/* ─── Page ─── */
export default function IntegrateDocsPure({ locale = "en" }: { locale?: Locale }) {
  const isKo = locale === "ko";
  const toc = isKo ? TOC_KO : TOC_EN;
  const currentPath = isKo ? "/ko/docs/integrate" : "/docs/integrate";

  return (
    <PureDocsShell currentPath={currentPath} locale={locale} toc={toc}>
      {/* ───────── Overview ───────── */}
      <div id="overview" className="pure-integrate-docs-section pure-integrate-docs-section-first">
        <div className="pure-integrate-docs-eyebrow mono">Integrate</div>
        <h1 className="pure-integrate-docs-title">
          {isKo
            ? "AI 도구는 세션 사이를 기억하지 못합니다. 한 줄로 해결합니다."
            : "Your AI tools forget you between sessions. Fix it with one line."}
        </h1>
        {isKo ? (
          <>
            <p className="pure-integrate-docs-intro">
              Claude Code, Cursor, Codex, 그 외 모든 에이전트가 이미 <code>CLAUDE.md</code> / <code>AGENTS.md</code> / <code>.cursor/rules</code> 의 내용으로 부팅합니다. memory.wiki bundle 또는 hub 를 가리키는 한 줄만 추가하면, 다음 세션은 이전 결정, 노트, 분석이 <em>이미 로드된 상태로</em> 시작됩니다.
            </p>
            <p className="pure-integrate-docs-intro">
              URL 응답은 번들의 pre-computed 그래프 (themes, insights, concept relations) 를 같은 페이로드에 담아 보냅니다 &mdash; 받는 AI 는 이전 AI 의 작업을 <em>무료로</em> 이어받습니다. API 키 없음, vendor lock-in 없음, 도구별 플러그인 없음.
            </p>
          </>
        ) : (
          <>
            <p className="pure-integrate-docs-intro">
              Claude Code, Cursor, Codex, and every other agent boot with whatever you wrote in <code>CLAUDE.md</code> / <code>AGENTS.md</code> / <code>.cursor/rules</code>. Add a single line that points at your memory.wiki bundle or hub, and the next session opens with your prior decisions, notes, and analysis already loaded.
            </p>
            <p className="pure-integrate-docs-intro">
              The URL response carries the bundle&apos;s pre-computed graph (themes, insights, concept relations) in the same payload &mdash; the receiving AI inherits the prior AI&apos;s work for free. No vendor lock-in, no API keys, no per-tool plug-in.
            </p>
          </>
        )}
      </div>

      {/* ───────── 30-second setup ───────── */}
      <section id="quickstart" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">
          {isKo ? "30초 셋업" : "30-second setup"}
        </h2>
        <p className="pure-integrate-docs-body">
          {isKo
            ? "아래의 모든 도구에 같은 3 단계가 적용됩니다. 도구마다 어떤 파일에 한 줄을 박는지만 다릅니다."
            : "The same three steps apply to every tool below. The only thing that changes per tool is which file you drop the line into."}
        </p>
        <div className="pure-integrate-docs-callout">
          <ol className="pure-integrate-docs-ol">
            {isKo ? (
              <>
                <li>
                  <strong>번들 URL 복사</strong> &mdash; 프로젝트용이면 번들, 개인 컨텍스트면 hub URL. Deploy 패널에서 카피.
                </li>
                <li>
                  <strong>AI 도구의 컨텍스트 파일 열기</strong> (대부분 <code>AGENTS.md</code> 로 충분, 도구별 파일명은 아래).
                </li>
                <li>
                  <strong>한 줄 붙여넣기</strong>, 커밋, 끝.
                </li>
              </>
            ) : (
              <>
                <li>
                  <strong>Pick the bundle URL</strong> for the project (or the hub URL for personal context). Copy from the bundle&apos;s Deploy panel.
                </li>
                <li>
                  <strong>Open your AI tool&apos;s context file</strong> (<code>AGENTS.md</code> works for most; tool-specific names below).
                </li>
                <li>
                  <strong>Paste one line</strong>, commit, done.
                </li>
              </>
            )}
          </ol>
        </div>
        <PureCodeBlock
          code={isKo
            ? `# 프로젝트 컨텍스트

Working bundle: https://memory.wiki/b/<bundle-id>

매 세션마다 다시 읽어 스펙, 결정, 이전 추론을 받아오세요.
번들은 자체 그래프(themes, insights, concept relations)를 함께 전달합니다.`
            : `# Project context

Working bundle: https://memory.wiki/b/<bundle-id>

Re-read on every session for spec, decisions, prior reasoning.
The bundle carries its own graph (themes, insights, concept relations).`}
          lang="markdown"
        />
        <p className="pure-integrate-docs-body-faint">
          {isKo
            ? "이게 통합의 전부입니다. 아래는 도구별로 약간씩 다른 같은 3 단계입니다."
            : "That's the entire integration. Everything below is the per-tool variation of the same three steps."}
        </p>
      </section>

      {/* ───────── Pick the right URL ───────── */}
      <section id="pick-url" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">
          {isKo ? "어떤 URL 을 쓸지" : "Pick the right URL"}
        </h2>
        <p className="pure-integrate-docs-body">
          {isKo
            ? "memory.wiki 는 세 가지 URL 모양을 제공합니다. 프로젝트 스코프 도구 설정에는 거의 항상 bundle URL 이 맞습니다 — 캔버스 분석을 같이 가져가니까요."
            : "memory.wiki exposes three URL shapes. For project-scoped tool config, the bundle URL is almost always the right choice — it carries the canvas analysis with it."}
        </p>
        <div className="pure-integrate-docs-table">
          <div className="pure-integrate-docs-row">
            <code>memory.wiki/&#123;docId&#125;</code>
            <span className="pure-integrate-docs-row-tag mono">{isKo ? "단일 문서" : "single doc"}</span>
            <span className="pure-integrate-docs-row-desc">
              {isKo
                ? "한 스펙, 한 결정, 한 노트. 본문 + 문서 레벨 concepts/relations 부록까지 한 응답. 토큰 비용 최소 (부록 끄려면 ?compact)."
                : "One spec, one decision, one note. Body plus the doc-level concepts/relations appendix in one response. Tightest token cost (drop the appendix with ?compact)."}
            </span>
          </div>
          <div className="pure-integrate-docs-row">
            <code>memory.wiki/b/&#123;bundleId&#125;</code>
            <span className="pure-integrate-docs-row-tag accent mono">{isKo ? "번들" : "bundle"}</span>
            <span className="pure-integrate-docs-row-desc">
              {isKo ? (
                <>
                  <strong>AGENTS.md / .cursor/rules 추천 디폴트.</strong> 의도 단위로 묶인 3-20+ 문서, 캔버스 분석 (themes, insights, concept relations) 이 같은 응답에 포함.
                </>
              ) : (
                <>
                  <strong>Recommended for AGENTS.md / .cursor/rules.</strong> 3-20+ docs grouped by intent, plus the canvas analysis (themes, insights, concept relations) shipped in the same response.
                </>
              )}
            </span>
          </div>
          <div className="pure-integrate-docs-row">
            <code>memory.wiki/@&#123;you&#125;</code>
            <span className="pure-integrate-docs-row-tag mono">{isKo ? "전체 hub" : "whole hub"}</span>
            <span className="pure-integrate-docs-row-desc">
              {isKo
                ? "concept_index 가 포함된 개인 지식 그래프 전체. 사용 자제 — 넓은 컨텍스트는 토큰 비용이 커집니다."
                : "Your entire knowledge graph with concept_index. Use sparingly — broad context costs more tokens."}
            </span>
          </div>
        </div>
        <p className="pure-integrate-docs-body-faint">
          {isKo ? (
            <>
              <code>?compact</code> 로 공백 정리, <code>?full=1</code> (번들 전용) 로 멤버 문서 본문 인라인, <code>?graph=0</code> (번들 전용) 로 분석 섹션 제거.
            </>
          ) : (
            <>
              Append <code>?compact</code> to trim whitespace, <code>?full=1</code> (bundle only) to inline every member doc, <code>?graph=0</code> (bundle only) to drop the analysis section.
            </>
          )}
        </p>
      </section>

      {/* ───────── Privacy & sharing ───────── */}
      <section id="permissions" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">
          {isKo ? "권한과 공유" : "Privacy & sharing"}
        </h2>
        <p className="pure-integrate-docs-body">
          {isKo
            ? "raw-마크다운 엔드포인트는 viewer 의 게이팅을 그대로 따릅니다. 사람이 렌더된 페이지를 못 보면 AI 에이전트도 마크다운을 못 가져옵니다 — 아래 세 상태는 doc / bundle / hub 에 동일하게 적용됩니다."
            : "The raw-markdown endpoint mirrors the viewer's gating exactly. If a person can't see the rendered page, an AI agent can't fetch the markdown either — the three states below apply equally to docs, bundles, and hubs."}
        </p>

        <div className="pure-integrate-docs-table">
          <div className="pure-integrate-docs-row pure-integrate-docs-row-perm">
            <code>Public</code>
            <span className="pure-integrate-docs-row-desc">
              {isKo
                ? "퍼블리시 완료, allowed_emails 없음. AI 가 익명으로 fetch — 헤더 불필요. 오픈소스 프로젝트의 번들을 모든 컨트리뷰터의 AI 도구가 읽길 원할 때 맞는 설정."
                : "Published, no allowed_emails. Any AI fetches anonymously — no headers required. This is the right setting for an open-source project's bundle that you want every contributor's AI tools to read."}
            </span>
          </div>
          <div className="pure-integrate-docs-row pure-integrate-docs-row-perm">
            <code>Restricted</code>
            <span className="pure-integrate-docs-row-desc">
              {isKo ? (
                <>
                  퍼블리시 완료 + <code>allowed_emails</code> 설정. fetcher 가 자기 신원 식별 필요: 오너 JWT 의 <code>Authorization: Bearer &lt;token&gt;</code>, 혹은 허용 주소 중 하나와 매치되는 <code>X-User-Email</code> 헤더. 아니면 403 / 404.
                </>
              ) : (
                <>
                  Published, with <code>allowed_emails</code> set. The fetcher must identify itself: either an owner JWT in <code>Authorization: Bearer &lt;token&gt;</code>, or an <code>X-User-Email</code> header that matches one of the allowed addresses. Otherwise 403 / 404.
                </>
              )}
            </span>
          </div>
          <div className="pure-integrate-docs-row pure-integrate-docs-row-perm">
            <code>Private</code>
            <span className="pure-integrate-docs-row-desc">
              {isKo
                ? "아직 퍼블리시 안 됨. 오너 JWT 만 fetch 가능. 나머지에는 404 — auth 모르는 AI 도구 포함. 도구 설정에 박기 전 먼저 퍼블리시."
                : "Not yet published. Only the owner (via JWT) can fetch. Private items return 404 to everyone else — including AI tools that don't know your auth. Publish the bundle first before referencing it in tool config."}
            </span>
          </div>
        </div>

        <h3 className="pure-integrate-docs-sub-title">
          {isKo ? "실용 레시피" : "Practical recipes"}
        </h3>
        <ul className="pure-integrate-docs-ul">
          {isKo ? (
            <>
              <li>
                <strong>오픈소스 프로젝트</strong>: bundle public, <code>AGENTS.md</code> 에 붙임. 모든 컨트리뷰터의 AI 도구가 익명으로 fetch. 조율 불필요.
              </li>
              <li>
                <strong>내부 / 팀 프로젝트</strong>: <code>allowed_emails</code> 에 팀원. 각 팀원의 AI 도구가 <code>X-User-Email</code> 헤더를 보내야 함 &mdash; 대부분의 CLI 는 env 나 rc 파일로 헤더 템플릿 가능. 같은 list 가 rendered viewer 도 게이팅 → 비팀원은 두 surface 모두 404.
              </li>
              <li>
                <strong>혼자만의 사적 노트</strong>: hub URL 을 <code>~/.claude/CLAUDE.md</code> 에서 참조. hub 의 visibility 는 항목별 이지 hub 전체가 아님 &mdash; public 문서만 표면화, private 문서는 퍼블리시 전까지 숨김.
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>Open-source project</strong>: bundle public, paste in <code>AGENTS.md</code>. Every contributor&apos;s AI tool fetches anonymously. Zero coordination.
              </li>
              <li>
                <strong>Internal / team project</strong>: bundle with <code>allowed_emails</code> of teammates. Each teammate&apos;s AI tool needs to send <code>X-User-Email</code> &mdash; most CLIs let you template request headers via env or rc files. The bundle&apos;s rendered viewer also gates on the same list, so non-teammates see 404 in both surfaces.
              </li>
              <li>
                <strong>Solo / private notes</strong>: hub URL referenced from <code>~/.claude/CLAUDE.md</code>. Hub-wide visibility is per-item, not per-hub &mdash; public docs surface, private docs stay hidden until you publish them.
              </li>
            </>
          )}
        </ul>

        <p className="pure-integrate-docs-body-faint">
          {isKo ? (
            <>
              <strong>불변식</strong>: 모든 게이팅 결정은 서버 사이드 raw-fetch 라우트에서 일어남. rendered viewer 가 안 보여주는 콘텐츠가 URL 로 새는 일은 없음. 게이팅 변경 (예: <code>allowed_emails</code> 에서 이메일 제거) 은 다음 fetch 부터 적용 &mdash; 이미 로컬에 캐시된 마크다운은 그 한 번의 예외.
            </>
          ) : (
            <>
              <strong>Invariant</strong>: every gating decision happens server-side in the raw-fetch route. There&apos;s no way for the URL to leak content the rendered viewer wouldn&apos;t already show. Switching gating (e.g. removing an email from <code>allowed_emails</code>) takes effect on the next fetch &mdash; AI tools that already cached the markdown locally won&apos;t see the revocation until they re-fetch.
            </>
          )}
        </p>
      </section>

      {/* ───────── AGENTS.md ───────── */}
      <section id="agents-md" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">
          {isKo ? "AGENTS.md — 여기부터" : "AGENTS.md — start here"}
        </h2>
        <p className="pure-integrate-docs-body">
          {isKo ? (
            <>
              한 파일만 관리하고 싶다면 이게 그 파일입니다. <code>AGENTS.md</code> 는 &ldquo;repo 루트의 에이전트 지시 파일&rdquo; 에 대한 오픈 cross-tool 컨벤션 &mdash; Codex CLI, Claude Code, Aider 가 모두 읽습니다. 여기에 bundle URL 만 박으면 대부분의 에이전트가 바로 픽업, 도구별 설정 불필요.
            </>
          ) : (
            <>
              If you only want to maintain one file, this is the one. <code>AGENTS.md</code> is the open cross-tool convention for &ldquo;agent instructions at the repo root&rdquo; &mdash; Codex CLI, Claude Code, and Aider all read it. Drop your bundle URL here and most of your agents pick it up immediately, no per-tool config.
            </>
          )}
        </p>
        <ToolBlock
          id="agents-md-tool"
          name="AGENTS.md"
          filePath="AGENTS.md (project root)"
          tagline={isKo
            ? "한 파일로 Codex CLI, Claude Code, Aider, 그리고 컨벤션을 따르는 미래의 모든 에이전트 커버. 아래의 도구별 파일은 cross-tool 레이어에 들어가면 안 되는 nuance 만 위해 사용."
            : "One file, covered by Codex CLI, Claude Code, Aider, and any future agent that respects the convention. Use the tool-specific files below only for nuances that don't belong at the cross-tool layer."}
          snippet={isKo
            ? `# Project agents

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

이 프로젝트의 스펙, 결정, cross-doc 추론이 필요할 때 이 URL 을 fetch.
번들의 pre-computed 그래프 (themes, insights, concept relations) 가
같은 응답에 포함 — 별도 인덱스 호출 불필요.`
            : `# Project agents

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

Fetch this URL when you need this project's spec, decisions, or
cross-doc reasoning. The bundle's pre-computed graph (themes,
insights, concept relations) is in the same response — no separate
index call needed.`}
        />
        <p className="pure-integrate-docs-body-faint">
          {isKo ? (
            <>
              패턴: 도구별 override 는 각 도구의 파일 (<code>.cursor/rules/</code>, <code>GEMINI.md</code>, <code>.windsurfrules</code>) 에 두고, memory.wiki URL 만 <code>AGENTS.md</code> 에. URL 이 portable 한 부분, 도구별 nuance 는 도구별 위치.
            </>
          ) : (
            <>
              Pattern: keep tool-specific overrides in their respective files (<code>.cursor/rules/</code>, <code>GEMINI.md</code>, <code>.windsurfrules</code>) but put the memory.wiki URL in <code>AGENTS.md</code>. The URL is the portable bit; per-tool nuance stays per-tool.
            </>
          )}
        </p>
      </section>

      {/* ───────── Claude Code ───────── */}
      <section id="claude-code" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">Claude Code</h2>
        <ToolBlock
          id="claude-code-tool"
          name="Claude Code"
          filePath={isKo ? "CLAUDE.md (project root) — and AGENTS.md" : "CLAUDE.md (project root) — and AGENTS.md"}
          tagline={isKo
            ? "Claude Code 는 프로젝트 루트와 부모 디렉터리 모두에서 CLAUDE.md 를 auto-load 합니다 (AGENTS.md 도 함께). 둘 다 동작; CLAUDE.md 는 Claude 전용 override 의 적절한 위치."
            : "Claude Code auto-loads CLAUDE.md from the project root and every parent directory, plus AGENTS.md when present. Either file works; CLAUDE.md is the right home for Claude-specific overrides."}
          snippet={isKo
            ? `## Project context (from memory.wiki)

Bundle: https://memory.wiki/b/<bundle-id>

이 번들이 프로젝트의 스펙, ADR, 결정 + pre-computed 그래프
(themes, insights, concept relations) 를 담음.
cross-doc 컨텍스트가 필요할 때마다 다시 읽음.`
            : `## Project context (from memory.wiki)

Bundle: https://memory.wiki/b/<bundle-id>

This bundle carries the project's spec, ADRs, and decisions —
plus a pre-computed graph (themes, insights, concept relations).
Re-read it whenever you need cross-doc context.`}
          notes={isKo ? (
            <>
              모든 프로젝트에 걸친 user-global 메모리에는 <code>~/.claude/CLAUDE.md</code> 와 hub URL 사용.
            </>
          ) : (
            <>
              For user-global memory across all projects, use <code>~/.claude/CLAUDE.md</code> with your hub URL instead.
            </>
          )}
        />
      </section>

      {/* ───────── Cursor ───────── */}
      <section id="cursor" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">Cursor</h2>
        <ToolBlock
          id="cursor-tool"
          name="Cursor"
          filePath=".cursor/rules/memorywiki.mdc"
          tagline={isKo
            ? "Cursor 의 신규 multi-rule 포맷. frontmatter 가 룰 적용 범위 스코프, body 가 memory.wiki URL 보관. 번들마다 한 파일로 깨끗하게 분리."
            : "Cursor's newer multi-rule format. Frontmatter scopes when the rule applies; body holds the memory.wiki URL. Use one file per bundle for clean separation."}
          snippet={isKo
            ? `---
description: Project context from memory.wiki
alwaysApply: true
---

이 프로젝트 컨텍스트는 https://memory.wiki/b/<bundle-id> 에 있음.

스펙 / 결정 / 이전 추론이 필요할 때 그 URL 을 fetch.
응답은 번들의 그래프 분석 (themes, insights, gaps, connections) 이
기본으로 포함된 깨끗한 마크다운.`
            : `---
description: Project context from memory.wiki
alwaysApply: true
---

Project context lives at https://memory.wiki/b/<bundle-id>.

When you need spec / decisions / prior reasoning, fetch that URL.
The response is clean markdown with the bundle's graph analysis
(themes, insights, gaps, connections) included by default.`}
          notes={isKo ? (
            <>
              레거시 단일 파일 <code>.cursorrules</code> 도 동작 &mdash; frontmatter 없이 body 내용만 루트의 <code>.cursorrules</code> 에.
            </>
          ) : (
            <>
              Legacy single-file <code>.cursorrules</code> works too &mdash; just drop the body content (without the frontmatter) into the root <code>.cursorrules</code> file.
            </>
          )}
        />
      </section>

      {/* ───────── Codex CLI ───────── */}
      <section id="codex" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">Codex CLI</h2>
        <ToolBlock
          id="codex-tool"
          name="Codex CLI"
          filePath="AGENTS.md (project root)"
          tagline={isKo
            ? "OpenAI Codex CLI 가 AGENTS.md 의 원래 정의 대상. 위의 AGENTS.md 섹션을 따랐다면 Codex 는 이미 커버됨 — 이 블록은 완전성을 위해."
            : "OpenAI's Codex CLI is the agent AGENTS.md was originally defined for. If you've already followed the AGENTS.md section above, Codex is already covered — this block is here for completeness."}
          snippet={isKo
            ? `# Project Agents Manifest

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

스펙, 결정, 이전 추론이 필요할 때 fetch.`
            : `# Project Agents Manifest

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

Fetch on demand for spec, decisions, prior reasoning.`}
        />
      </section>

      {/* ───────── Gemini CLI ───────── */}
      <section id="gemini" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">Gemini CLI</h2>
        <ToolBlock
          id="gemini-tool"
          name="Gemini CLI"
          filePath="GEMINI.md (project root)"
          tagline={isKo
            ? "Google Gemini CLI 가 GEMINI.md 를 session-instructions 파일로 읽음. 다른 도구와 같은 콘텐츠 모양."
            : "Google's Gemini CLI reads GEMINI.md as its session-instructions file. Same content shape as the others."}
          snippet={isKo
            ? `# Gemini context

프로젝트 메모리는 https://memory.wiki/b/<bundle-id> 에.
스펙, 결정, cross-doc 추론이 필요할 때 fetch.`
            : `# Gemini context

Project memory lives at https://memory.wiki/b/<bundle-id>.
Fetch on demand for spec, decisions, and cross-doc reasoning.`}
        />
      </section>

      {/* ───────── Windsurf ───────── */}
      <section id="windsurf" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">Windsurf</h2>
        <ToolBlock
          id="windsurf-tool"
          name="Windsurf"
          filePath=".windsurfrules (project root)"
          tagline={isKo
            ? "Windsurf 가 프로젝트 루트의 .windsurfrules 를 Cascade 에이전트용으로 읽음."
            : "Windsurf reads .windsurfrules at the project root for its Cascade agent."}
          snippet={isKo
            ? `Project context: https://memory.wiki/b/<bundle-id>

이 프로젝트의 스펙 / 결정 / 이전 추론이 필요할 때 그 URL 을 fetch.
번들의 그래프 분석이 포함된 깨끗한 마크다운 응답.`
            : `Project context: https://memory.wiki/b/<bundle-id>

When you need this project's spec / decisions / prior reasoning,
fetch that URL. It returns clean markdown with the bundle's graph
analysis included.`}
        />
      </section>

      {/* ───────── Aider ───────── */}
      <section id="aider" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">Aider</h2>
        <ToolBlock
          id="aider-tool"
          name="Aider"
          filePath="CONVENTIONS.md (project root)"
          tagline={isKo
            ? "Aider 의 터미널 우선 AI 페어 프로그래머가 CONVENTIONS.md 를 채팅 컨텍스트의 일부로 읽음 (aider --read CONVENTIONS.md 또는 .aider.conf.yml 의 read: 목록 사용)."
            : "Aider's terminal-first AI pair programmer reads CONVENTIONS.md as part of the chat context (add it via aider --read CONVENTIONS.md or list it under read: in .aider.conf.yml)."}
          snippet={isKo
            ? `# Project conventions

이 프로젝트의 외부 컨텍스트는:
https://memory.wiki/b/<bundle-id>

스펙, 결정, cross-doc 추론이 필요할 때 그 URL 을 fetch.`
            : `# Project conventions

External context for this project lives at:
https://memory.wiki/b/<bundle-id>

Fetch that URL when you need spec, decisions, or cross-doc reasoning.`}
        />
      </section>

      {/* ───────── GitHub Action sync (EN only — KO source omits this section) ───────── */}
      {!isKo && (
        <section id="github-action" className="pure-integrate-docs-section">
          <h2 className="pure-integrate-docs-section-title">
            GitHub Action sync — keep one memory.wiki doc in step with your repo
          </h2>
          <p className="pure-integrate-docs-body">
            Treat one memory.wiki doc as your repo&apos;s &ldquo;working knowledge URL&rdquo;. Every push to <code>main</code> that touches <code>CLAUDE.md</code>, <code>AGENTS.md</code>, or <code>docs/**.md</code> PATCHes the combined markdown to your memory.wiki doc. Paste the doc URL into Claude, Cursor, or Codex and they always see the latest state of your repo&apos;s docs.
          </p>
          <p className="pure-integrate-docs-body">
            One-time setup (under 5 minutes):
          </p>
          <ol className="pure-integrate-docs-ol">
            <li>
              Create the target doc on memory.wiki. The URL chip in the editor shows the id (the <code>&lt;id&gt;</code> in <code>memory.wiki/d/&lt;id&gt;</code>) — that&apos;s your <code>MDFY_DOC_ID</code>.
            </li>
            <li>
              On the same doc, open the <strong>Share</strong> modal (top-right of the editor). Scroll to the <em>Developer access</em> footer and click <strong>Copy edit token</strong>. That&apos;s your <code>MDFY_EDIT_TOKEN</code>. Treat it like a password — anyone with it can write to the doc.
            </li>
            <li>
              On GitHub: <em>Settings → Secrets and variables → Actions → New repository secret</em>. Add both <code>MDFY_DOC_ID</code> and <code>MDFY_EDIT_TOKEN</code>.
            </li>
            <li>
              Drop the workflow file below at <code>.github/workflows/sync-memorywiki.yml</code> and push. Run it once via <em>Actions → Sync repo docs → memory.wiki → Run workflow</em> to verify.
            </li>
          </ol>
          <p className="pure-integrate-docs-file-caption mono">
            .github/workflows/sync-memorywiki.yml
          </p>
          <PureCodeBlock
            lang="yaml"
            code={`name: Sync repo docs → memory.wiki

on:
  push:
    branches: [main]
    paths:
      - 'CLAUDE.md'
      - 'AGENTS.md'
      - 'docs/**.md'
      - '.github/workflows/sync-memorywiki.yml'
  workflow_dispatch: {}

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build the combined markdown
        id: build
        run: |
          set -euo pipefail
          OUT="$(mktemp)"
          {
            echo "# Repo working knowledge (synced from \${GITHUB_REPOSITORY}@\${GITHUB_SHA:0:7})"
            echo
            echo "> Auto-updated by .github/workflows/sync-memorywiki.yml on push to main."
            echo "> Source: https://github.com/\${GITHUB_REPOSITORY}/commit/\${GITHUB_SHA}"
            echo
            for f in CLAUDE.md AGENTS.md; do
              if [ -f "$f" ]; then
                echo; echo "---"; echo
                echo "## $f"; echo
                cat "$f"
              fi
            done
            if [ -d docs ]; then
              find docs -maxdepth 2 -name '*.md' -type f | LC_ALL=C sort | while read -r f; do
                echo; echo "---"; echo
                echo "## $f"; echo
                cat "$f"
              done
            fi
          } > "$OUT"
          echo "payload_path=$OUT" >> "$GITHUB_OUTPUT"

      - name: PATCH /api/docs/{id}
        env:
          MDFY_DOC_ID: \${{ secrets.MDFY_DOC_ID }}
          MDFY_EDIT_TOKEN: \${{ secrets.MDFY_EDIT_TOKEN }}
          PAYLOAD_PATH: \${{ steps.build.outputs.payload_path }}
        run: |
          set -euo pipefail
          BODY="$(jq -Rn \\
            --rawfile md "$PAYLOAD_PATH" \\
            --arg token "$MDFY_EDIT_TOKEN" \\
            --arg summary "ci: sync from \${GITHUB_SHA:0:7}" \\
            '{markdown: $md, editToken: $token, changeSummary: $summary}')"
          STATUS=$(curl -sS -o /tmp/resp.json -w '%{http_code}' \\
            -X PATCH "https://memory.wiki/api/docs/\${MDFY_DOC_ID}" \\
            -H 'Content-Type: application/json' \\
            --data "$BODY")
          echo "HTTP $STATUS"
          cat /tmp/resp.json
          [ "$STATUS" = "200" ]`}
          />
          <p className="pure-integrate-docs-body-faint">
            <strong>What you get.</strong> One URL like <code>memory.wiki/d/&lt;your-id&gt;</code> that&apos;s always your repo&apos;s current docs. Paste it into Claude Code, Cursor, or any AI tool — they fetch the latest state on every session. Bonus: it makes a clean &ldquo;we use our own product&rdquo; artifact you can link from a README.
          </p>
        </section>
      )}

      {/* ───────── Staleness ───────── */}
      <section id="staleness" className="pure-integrate-docs-section">
        <h2 className="pure-integrate-docs-section-title">
          {isKo ? "Stale 과 auto-analyze" : "Staleness + auto-analyze"}
        </h2>
        <p className="pure-integrate-docs-body">
          {isKo ? (
            <>
              문서 본문은 매 편집마다 auto-save &mdash; URL 응답은 별도 push 없이 항상 최신 마크다운을 반영. 분석 레이어 (문서의 <code>concept_index</code> / <code>concept_relations</code> 부록, 번들의 <code>graph_data</code>, hub 의 <code>concept_index</code>) 는 백그라운드 <code>doc_ontology</code> / <code>bundle_graph</code> 잡이 계산 후 캐시.
            </>
          ) : (
            <>
              Doc content is auto-saved on every edit — the URL response always reflects the latest markdown without any push step. The <em>analysis</em> layer (the doc&apos;s own <code>concept_index</code> / <code>concept_relations</code> appendix, bundle <code>graph_data</code>, and hub <code>concept_index</code>) is computed by background <code>doc_ontology</code> / <code>bundle_graph</code> jobs and cached.
            </>
          )}
        </p>
        <p className="pure-integrate-docs-body">
          {isKo ? (
            <>
              멤버 문서가 마지막 분석 run 이후 편집됐을 때 URL 응답이 표시: frontmatter 에 <code>analysis_stale: true</code> + 본문 상단 경고 블록쿼트. 받는 AI 도구가 분석을 적절히 가중치 부여. 문서 본문은 항상 최신; 합성된 레이어 (themes / insights / concepts) 만 지연 가능.
            </>
          ) : (
            <>
              When a member doc was edited after the last analysis run, the URL response flags it: <code>analysis_stale: true</code> in the frontmatter plus a warning blockquote at the top of the body. Receiving AI tools can weigh the analysis accordingly. The doc bodies themselves are always fresh; only the synthesised layer (themes / insights / concepts) may lag.
            </>
          )}
        </p>
        <p className="pure-integrate-docs-body">
          {isKo ? (
            <>
              Free 티어: 재분석 명시적 &mdash; 캔버스 열고 <strong>Re-analyze</strong> 클릭. Pro 티어 (베타 이후): <strong>auto-analyze</strong> 추가 &mdash; stale fetch 가 백그라운드 재생성을 트리거 → 다음 fetch 는 fresh, hands-free.
            </>
          ) : (
            <>
              Free tier: re-analyze is explicit — open the canvas and click <strong>Re-analyze</strong> when you&apos;re ready. Pro tier (after beta) adds <strong>auto-analyze</strong>: stale fetches trigger a background regeneration so the next fetch is fresh, hands-free.
            </>
          )}
        </p>
      </section>
    </PureDocsShell>
  );
}
