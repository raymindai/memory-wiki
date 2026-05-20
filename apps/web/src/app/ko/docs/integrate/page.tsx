import type { Metadata } from "next";
import { CodeBlock, InlineCode, SectionHeading, DocsNav, DocsSidebar, SiteFooter, mono } from "@/components/docs";

export const metadata: Metadata = {
  title: "AI 개발 도구와 연결 — memory.wiki",
  description:
    "Claude Code, Cursor, Codex, Gemini CLI, Windsurf, Aider 에 한 줄 추가해서 memory.wiki hub / bundle 을 모든 세션의 컨텍스트로 자동 로드. AGENTS.md / CLAUDE.md / .cursor/rules 한 곳에 URL 만 박으면 끝.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/integrate",
    languages: { en: "https://memory.wiki/docs/integrate" },
  },
  openGraph: {
    title: "AI 개발 도구와 memory.wiki 연결",
    description: "AGENTS.md / CLAUDE.md / .cursor/rules 에 한 줄 추가하면 모든 AI 도구가 당신의 hub / bundle 을 깨끗한 마크다운으로 읽습니다.",
    url: "https://memory.wiki/ko/docs/integrate",
    images: [{ url: "/api/og?title=AI%20개발%20도구와%20연결", width: 1200, height: 630 }],
  },
};

/* ─── Sidebar Items ─── */
const sidebarItems = [
  { id: "overview", label: "개요" },
  { id: "quickstart", label: "30초 셋업" },
  { id: "pick-url", label: "어떤 URL 을 쓸지" },
  { id: "permissions", label: "권한과 공유" },
  { id: "agents-md", label: "AGENTS.md — 여기부터" },
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex CLI" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "windsurf", label: "Windsurf" },
  { id: "aider", label: "Aider" },
  { id: "staleness", label: "Stale 와 auto-analyze" },
];

/* ─── Tool block ─── */
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
    <div
      id={id}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: 14,
        padding: "28px 24px",
        marginBottom: 20,
        scrollMarginTop: 80,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>{name}</h3>
        <code style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>{filePath}</code>
      </div>
      <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginTop: 0, marginBottom: 16, maxWidth: 640 }}>
        {tagline}
      </p>
      <CodeBlock lang="markdown">{snippet}</CodeBlock>
      {notes && (
        <p style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.7, marginTop: 12, marginBottom: 0, maxWidth: 640 }}>
          {notes}
        </p>
      )}
    </div>
  );
}

export default function IntegrateDocsPageKo() {
  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
      }}
    >
      <DocsNav lang="ko" />

      <div className="docs-layout">
        <DocsSidebar items={sidebarItems} currentPath="/ko/docs/integrate" />

        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          {/* ─── Overview ─── */}
          <div id="overview" style={{ scrollMarginTop: 80 }}>
            <p
              style={{
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 12,
                fontFamily: mono,
              }}
            >
              Integrate
            </p>
            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                margin: "0 0 16px",
                lineHeight: 1.2,
              }}
            >
              AI 도구는 세션 사이를 기억하지 못합니다. 한 줄로 해결합니다.
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 16,
                maxWidth: 680,
              }}
            >
              Claude Code, Cursor, Codex, 그 외 모든 에이전트가 이미 <InlineCode>{"CLAUDE.md"}</InlineCode> / <InlineCode>{"AGENTS.md"}</InlineCode> / <InlineCode>{".cursor/rules"}</InlineCode> 의 내용으로 부팅합니다. memory.wiki bundle 또는 hub 를 가리키는 한 줄만 추가하면, 다음 세션은 이전 결정, 노트, 분석이 *이미 로드된 상태로* 시작됩니다.
            </p>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 32,
                maxWidth: 680,
              }}
            >
              URL 응답은 번들의 pre-computed 그래프 (themes, insights, concept relations) 를 같은 페이로드에 담아 보냅니다 — 받는 AI 는 이전 AI 의 작업을 *무료로* 이어받습니다. API 키 없음, vendor lock-in 없음, 도구별 플러그인 없음.
            </p>
          </div>

          {/* ─── 30초 셋업 ─── */}
          <SectionHeading id="quickstart">30초 셋업</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            아래의 모든 도구에 같은 3 단계가 적용됩니다. 도구마다 *어떤 파일에 한 줄을 박는지* 만 다릅니다.
          </p>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 16,
            }}
          >
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8 }}>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>번들 URL 복사</strong> — 프로젝트용이면 번들, 개인 컨텍스트면 hub URL. Deploy 패널에서 카피.
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>AI 도구의 컨텍스트 파일 열기</strong> (대부분 <InlineCode>{"AGENTS.md"}</InlineCode> 로 충분, 도구별 파일명은 아래).
              </li>
              <li>
                <strong style={{ color: "var(--text-primary)" }}>한 줄 붙여넣기</strong>, 커밋, 끝.
              </li>
            </ol>
          </div>
          <CodeBlock lang="markdown">{`# 프로젝트 컨텍스트

Working bundle: https://memory.wiki/b/<bundle-id>

매 세션마다 다시 읽어 스펙, 결정, 이전 추론을 받아오세요.
번들은 자체 그래프(themes, insights, concept relations)를 함께 전달합니다.`}</CodeBlock>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginTop: 12,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            이게 통합의 전부입니다. 아래는 도구별로 약간씩 다른 *같은* 3 단계입니다.
          </p>

          {/* ─── 어떤 URL 을 쓸지 ─── */}
          <SectionHeading id="pick-url">어떤 URL 을 쓸지</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            memory.wiki 는 세 가지 URL 모양을 제공합니다. 프로젝트 스코프 도구 설정에는 거의 항상 bundle URL 이 맞습니다 — 캔버스 분석을 같이 가져가니까요.
          </p>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "200px 100px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>memory.wiki/&#123;docId&#125;</code>
              <span style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>단일 문서</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>한 스펙, 한 결정, 한 노트. 토큰 비용 최소.</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "200px 100px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>memory.wiki/b/&#123;bundleId&#125;</code>
              <span style={{ fontSize: 12, fontFamily: mono, color: "var(--accent)" }}>번들</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text-primary)" }}>AGENTS.md / .cursor/rules 추천 디폴트.</strong> 의도 단위로 묶인 3-20+ 문서, 캔버스 분석 (themes, insights, concept relations) 이 같은 응답에 포함.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "200px 100px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>memory.wiki/hub/&#123;you&#125;</code>
              <span style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>전체 hub</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>concept_index 가 포함된 개인 지식 그래프 전체. 사용 자제 — 넓은 컨텍스트는 토큰 비용이 커집니다.</span>
            </div>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            <InlineCode>{"?compact"}</InlineCode> 로 공백 정리, <InlineCode>{"?full=1"}</InlineCode> (번들 전용) 로 멤버 문서 본문 인라인, <InlineCode>{"?graph=0"}</InlineCode> (번들 전용) 로 분석 섹션 제거.
          </p>

          {/* ─── 권한과 공유 ─── */}
          <SectionHeading id="permissions">권한과 공유</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            raw-마크다운 엔드포인트는 viewer 의 게이팅을 그대로 따릅니다. 사람이 렌더된 페이지를 못 보면 AI 에이전트도 마크다운을 못 가져옵니다 — 아래 세 상태는 doc / bundle / hub 에 동일하게 적용됩니다.
          </p>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>Public</code>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                퍼블리시 완료, allowed_emails 없음. AI 가 익명으로 fetch — 헤더 불필요. 오픈소스 프로젝트의 번들을 모든 컨트리뷰터의 AI 도구가 읽길 원할 때 맞는 설정.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>Restricted</code>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                퍼블리시 완료 + <InlineCode>{"allowed_emails"}</InlineCode> 설정. fetcher 가 자기 신원 식별 필요: 오너 JWT 의 <InlineCode>{"Authorization: Bearer <token>"}</InlineCode>, 혹은 허용 주소 중 하나와 매치되는 <InlineCode>{"X-User-Email"}</InlineCode> 헤더. 아니면 403 / 404.
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12, alignItems: "baseline", padding: "10px 0" }}>
              <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>Private</code>
              <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                아직 퍼블리시 안 됨. 오너 JWT 만 fetch 가능. 나머지에는 404 — auth 모르는 AI 도구 포함. 도구 설정에 박기 전 *먼저 퍼블리시*.
              </span>
            </div>
          </div>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 16,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            실용 레시피
          </h3>
          <ul
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 24,
              paddingLeft: 20,
              maxWidth: 680,
            }}
          >
            <li>
              <strong style={{ color: "var(--text-primary)" }}>오픈소스 프로젝트</strong>: bundle public, <InlineCode>{"AGENTS.md"}</InlineCode> 에 붙임. 모든 컨트리뷰터의 AI 도구가 익명으로 fetch. 조율 불필요.
            </li>
            <li>
              <strong style={{ color: "var(--text-primary)" }}>내부 / 팀 프로젝트</strong>: <InlineCode>{"allowed_emails"}</InlineCode> 에 팀원. 각 팀원의 AI 도구가 <InlineCode>{"X-User-Email"}</InlineCode> 헤더를 보내야 함 — 대부분의 CLI 는 env 나 rc 파일로 헤더 템플릿 가능. 같은 list 가 rendered viewer 도 게이팅 → 비팀원은 두 surface 모두 404.
            </li>
            <li>
              <strong style={{ color: "var(--text-primary)" }}>혼자만의 사적 노트</strong>: hub URL 을 <InlineCode>{"~/.claude/CLAUDE.md"}</InlineCode> 에서 참조. hub 의 visibility 는 *항목별* 이지 hub 전체가 아님 — public 문서만 표면화, private 문서는 퍼블리시 전까지 숨김.
            </li>
          </ul>

          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            <strong style={{ color: "var(--text-muted)" }}>불변식</strong>: 모든 게이팅 결정은 서버 사이드 raw-fetch 라우트에서 일어남. rendered viewer 가 안 보여주는 콘텐츠가 URL 로 새는 일은 없음. 게이팅 변경 (예: <InlineCode>{"allowed_emails"}</InlineCode> 에서 이메일 제거) 은 *다음 fetch 부터* 적용 — 이미 로컬에 캐시된 마크다운은 그 한 번의 예외.
          </p>

          {/* ─── AGENTS.md — start here ─── */}
          <SectionHeading id="agents-md">AGENTS.md — 여기부터</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 12,
              maxWidth: 680,
            }}
          >
            한 파일만 관리하고 싶다면 이게 그 파일입니다. <InlineCode>{"AGENTS.md"}</InlineCode> 는 &ldquo;repo 루트의 에이전트 지시 파일&rdquo; 에 대한 오픈 cross-tool 컨벤션 — Codex CLI, Claude Code, Aider 가 모두 읽습니다. 여기에 bundle URL 만 박으면 대부분의 에이전트가 바로 픽업, 도구별 설정 불필요.
          </p>
          <ToolBlock
            id="agents-md-tool"
            name="AGENTS.md"
            filePath="AGENTS.md (project root)"
            tagline="한 파일로 Codex CLI, Claude Code, Aider, 그리고 컨벤션을 따르는 미래의 모든 에이전트 커버. 아래의 도구별 파일은 cross-tool 레이어에 들어가면 안 되는 nuance 만 위해 사용."
            snippet={`# Project agents

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

이 프로젝트의 스펙, 결정, cross-doc 추론이 필요할 때 이 URL 을 fetch.
번들의 pre-computed 그래프 (themes, insights, concept relations) 가
같은 응답에 포함 — 별도 인덱스 호출 불필요.`}
          />
          <p
            style={{
              fontSize: 13,
              color: "var(--text-faint)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            패턴: 도구별 override 는 각 도구의 파일 (<InlineCode>{".cursor/rules/"}</InlineCode>, <InlineCode>{"GEMINI.md"}</InlineCode>, <InlineCode>{".windsurfrules"}</InlineCode>) 에 두고, memory.wiki URL 만 <InlineCode>{"AGENTS.md"}</InlineCode> 에. URL 이 portable 한 부분, 도구별 nuance 는 도구별 위치.
          </p>

          {/* ─── Per-tool blocks ─── */}
          <SectionHeading id="claude-code">Claude Code</SectionHeading>
          <ToolBlock
            id="claude-code-tool"
            name="Claude Code"
            filePath="CLAUDE.md (project root) — and AGENTS.md"
            tagline="Claude Code 는 프로젝트 루트와 부모 디렉터리 모두에서 CLAUDE.md 를 auto-load 합니다 (AGENTS.md 도 함께). 둘 다 동작; CLAUDE.md 는 Claude 전용 override 의 적절한 위치."
            snippet={`## Project context (from memory.wiki)

Bundle: https://memory.wiki/b/<bundle-id>

이 번들이 프로젝트의 스펙, ADR, 결정 + pre-computed 그래프
(themes, insights, concept relations) 를 담음.
cross-doc 컨텍스트가 필요할 때마다 다시 읽음.`}
            notes={
              <>
                모든 프로젝트에 걸친 user-global 메모리에는 <InlineCode>{"~/.claude/CLAUDE.md"}</InlineCode> 와 hub URL 사용.
              </>
            }
          />

          <SectionHeading id="cursor">Cursor</SectionHeading>
          <ToolBlock
            id="cursor-tool"
            name="Cursor"
            filePath=".cursor/rules/mdfy.mdc"
            tagline="Cursor 의 신규 multi-rule 포맷. frontmatter 가 룰 적용 범위 스코프, body 가 memory.wiki URL 보관. 번들마다 한 파일로 깨끗하게 분리."
            snippet={`---
description: Project context from memory.wiki
alwaysApply: true
---

이 프로젝트 컨텍스트는 https://memory.wiki/b/<bundle-id> 에 있음.

스펙 / 결정 / 이전 추론이 필요할 때 그 URL 을 fetch.
응답은 번들의 그래프 분석 (themes, insights, gaps, connections) 이
기본으로 포함된 깨끗한 마크다운.`}
            notes={
              <>
                레거시 단일 파일 <InlineCode>{".cursorrules"}</InlineCode> 도 동작 — frontmatter 없이 body 내용만 루트의 <InlineCode>{".cursorrules"}</InlineCode> 에.
              </>
            }
          />

          <SectionHeading id="codex">Codex CLI</SectionHeading>
          <ToolBlock
            id="codex-tool"
            name="Codex CLI"
            filePath="AGENTS.md (project root)"
            tagline="OpenAI Codex CLI 가 AGENTS.md 의 원래 정의 대상. 위의 AGENTS.md 섹션을 따랐다면 Codex 는 이미 커버됨 — 이 블록은 완전성을 위해."
            snippet={`# Project Agents Manifest

## Working context

Bundle: https://memory.wiki/b/<bundle-id>

스펙, 결정, 이전 추론이 필요할 때 fetch.`}
          />

          <SectionHeading id="gemini">Gemini CLI</SectionHeading>
          <ToolBlock
            id="gemini-tool"
            name="Gemini CLI"
            filePath="GEMINI.md (project root)"
            tagline="Google Gemini CLI 가 GEMINI.md 를 session-instructions 파일로 읽음. 다른 도구와 같은 콘텐츠 모양."
            snippet={`# Gemini context

프로젝트 메모리는 https://memory.wiki/b/<bundle-id> 에.
스펙, 결정, cross-doc 추론이 필요할 때 fetch.`}
          />

          <SectionHeading id="windsurf">Windsurf</SectionHeading>
          <ToolBlock
            id="windsurf-tool"
            name="Windsurf"
            filePath=".windsurfrules (project root)"
            tagline="Windsurf 가 프로젝트 루트의 .windsurfrules 를 Cascade 에이전트용으로 읽음."
            snippet={`Project context: https://memory.wiki/b/<bundle-id>

이 프로젝트의 스펙 / 결정 / 이전 추론이 필요할 때 그 URL 을 fetch.
번들의 그래프 분석이 포함된 깨끗한 마크다운 응답.`}
          />

          <SectionHeading id="aider">Aider</SectionHeading>
          <ToolBlock
            id="aider-tool"
            name="Aider"
            filePath="CONVENTIONS.md (project root)"
            tagline="Aider 의 터미널 우선 AI 페어 프로그래머가 CONVENTIONS.md 를 채팅 컨텍스트의 일부로 읽음 (aider --read CONVENTIONS.md 또는 .aider.conf.yml 의 read: 목록 사용)."
            snippet={`# Project conventions

이 프로젝트의 외부 컨텍스트는:
https://memory.wiki/b/<bundle-id>

스펙, 결정, cross-doc 추론이 필요할 때 그 URL 을 fetch.`}
          />

          {/* ─── Staleness ─── */}
          <SectionHeading id="staleness">Stale 과 auto-analyze</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            문서 본문은 매 편집마다 auto-save — URL 응답은 별도 push 없이 *항상 최신* 마크다운을 반영. *분석* 레이어 (번들의 <InlineCode>{"graph_data"}</InlineCode>, hub 의 <InlineCode>{"concept_index"}</InlineCode>) 는 한 번 계산 후 캐시.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 680,
            }}
          >
            멤버 문서가 마지막 분석 run 이후 편집됐을 때 URL 응답이 표시: frontmatter 에 <InlineCode>{"analysis_stale: true"}</InlineCode> + 본문 상단 경고 블록쿼트. 받는 AI 도구가 분석을 적절히 가중치 부여. 문서 본문은 항상 최신; 합성된 레이어 (themes / insights / concepts) 만 지연 가능.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 32,
              maxWidth: 680,
            }}
          >
            Free 티어: 재분석 명시적 — 캔버스 열고 <strong>Re-analyze</strong> 클릭. Pro 티어 (베타 이후): <strong>auto-analyze</strong> 추가 — stale fetch 가 백그라운드 재생성을 트리거 → 다음 fetch 는 fresh, hands-free.
          </p>
        </main>
      </div>

      <SiteFooter lang="ko" />
    </div>
  );
}
