import type { Metadata } from "next";
import {
  CodeBlock,
  InlineCode,
  SectionHeading,
  SubLabel,
  DocsNav,
  DocsFooter,
  DocsSidebar,
  mono,
} from "@/components/docs";

export const metadata: Metadata = {
  title: "REST API 레퍼런스 — Memory.Wiki",
  description:
    "Memory.Wiki REST API 레퍼런스. HTTP를 통해 Markdown 문서를 생성, 조회, 수정, 삭제할 수 있습니다. curl, JavaScript, Python 예시 포함.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/api",
    languages: { en: "https://memory.wiki/docs/api" },
  },
  openGraph: {
    title: "REST API 레퍼런스 — Memory.Wiki",
    description: "REST API 레퍼런스. 엔드포인트, 매개변수, 예시.",
    url: "https://memory.wiki/ko/docs/api",
    images: [{ url: "/api/og?title=REST%20API", width: 1200, height: 630 }],
  },
};

/* ─── Page-specific Components ─── */

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, { fg: string; bg: string }> = {
    POST: { fg: "#3b82f6", bg: "#3b82f615" },
    GET: { fg: "#22c55e", bg: "#22c55e15" },
    PATCH: { fg: "#f59e0b", bg: "#f59e0b15" },
    DELETE: { fg: "#ef4444", bg: "#ef444415" },
    HEAD: { fg: "#a78bfa", bg: "#a78bfa15" },
  };
  const c = colors[method] || {
    fg: "var(--text-secondary)",
    bg: "var(--surface)",
  };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: mono,
        color: c.fg,
        background: c.bg,
        padding: "3px 10px",
        borderRadius: 6,
        letterSpacing: 0.5,
      }}
    >
      {method}
    </span>
  );
}

function ParamRow({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="param-row"
      style={{
        display: "grid",
        gridTemplateColumns: "160px 80px 1fr",
        gap: 12,
        alignItems: "baseline",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-dim)",
      }}
    >
      <code
        style={{
          fontSize: 13,
          fontFamily: mono,
          color: "var(--text-primary)",
          fontWeight: 600,
        }}
      >
        {name}
        {required && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#ef4444",
              marginLeft: 6,
              verticalAlign: "super",
            }}
          >
            REQUIRED
          </span>
        )}
      </code>
      <span
        style={{
          fontSize: 12,
          fontFamily: mono,
          color: "var(--text-faint)",
        }}
      >
        {type}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function EndpointBlock({
  id,
  method,
  path,
  description,
  children,
}: {
  id: string;
  method: string;
  path: string;
  description: string;
  children: React.ReactNode;
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <MethodBadge method={method} />
        <code
          style={{
            fontSize: 15,
            fontFamily: mono,
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          {path}
        </code>
      </div>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 24px",
          lineHeight: 1.7,
          maxWidth: 640,
        }}
      >
        {description}
      </p>
      {children}
    </div>
  );
}

/* ─── Sidebar Items ─── */
const sidebarItems = [
  { id: "overview", label: "개요" },
  { id: "post-docs", label: "POST /api/docs" },
  { id: "get-docs-id", label: "GET /api/docs/{id}" },
  { id: "patch-docs-id", label: "PATCH /api/docs/{id}" },
  { id: "head-docs-id", label: "HEAD /api/docs/{id}" },
  { id: "get-user-documents", label: "GET /api/user/documents" },
  { id: "post-upload", label: "POST /api/upload" },
  { id: "raw-and-llms", label: "Raw + /llms.txt" },
  { id: "bundle-url-anatomy", label: "Bundle URL 구조" },
  { id: "authentication", label: "인증" },
  { id: "rate-limits", label: "요청 제한" },
  { id: "errors", label: "에러" },
];

/* ─── Page ─── */
export default function ApiDocsPageKo() {
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
        <DocsSidebar
          items={sidebarItems}
          currentPath="/ko/docs/api"
        />

        {/* MAIN CONTENT */}
        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          {/* 개요 */}
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
              REST API
            </p>
            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                margin: "0 0 16px",
              }}
            >
              API 레퍼런스
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 8,
                maxWidth: 640,
              }}
            >
              모든 엔드포인트는 JSON을 주고받습니다. Base URL:{" "}
              <InlineCode>{"https://memory.wiki"}</InlineCode>
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-faint)",
                lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              요청 제한: IP당 분당 10회. 최대 문서 크기: 500KB.
            </p>
          </div>

          {/* ─── POST /api/docs ─── */}
          <EndpointBlock
            id="post-docs"
            method="POST"
            path="/api/docs"
            description="새 문서를 생성합니다. 문서 ID, edit token, 생성 시각을 반환합니다."
          >
            <SubLabel>매개변수</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="markdown" type="string" required>
                문서의 Markdown 내용.
              </ParamRow>
              <ParamRow name="title" type="string">
                문서 제목. 미지정 시 첫 번째 헤딩에서 자동 추출.
              </ParamRow>
              <ParamRow name="isDraft" type="boolean">
                임시 저장 여부. 기본값: <InlineCode>{"false"}</InlineCode>. 임시 저장 문서는 소유자만 볼 수 있습니다.
              </ParamRow>
              <ParamRow name="source" type="string">
                소스 식별자: <InlineCode>{"api"}</InlineCode>, <InlineCode>{"web"}</InlineCode>, <InlineCode>{"vscode"}</InlineCode>, <InlineCode>{"mcp"}</InlineCode>, <InlineCode>{"cli"}</InlineCode>.
              </ParamRow>
              <ParamRow name="password" type="string">
                문서를 비밀번호로 보호합니다. 열람 시 비밀번호 입력이 필요합니다.
              </ParamRow>
              <ParamRow name="expiresIn" type="string">
                문서 만료 시간: <InlineCode>{"1h"}</InlineCode>, <InlineCode>{"1d"}</InlineCode>, <InlineCode>{"7d"}</InlineCode>, <InlineCode>{"30d"}</InlineCode>. 생략하면 영구 보존.
              </ParamRow>
              <ParamRow name="editMode" type="string">
                편집 권한: <InlineCode>{"token"}</InlineCode> (기본값, editToken 필요), <InlineCode>{"anyone"}</InlineCode>, <InlineCode>{"authenticated"}</InlineCode>.
              </ParamRow>
              <ParamRow name="folderId" type="string">
                문서를 특정 폴더에 저장합니다.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/docs \\
  -H "Content-Type: application/json" \\
  -d '{
    "markdown": "# Hello World\\nThis is my document.",
    "title": "My Document",
    "isDraft": false
  }'`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    markdown: "# Hello World\\nThis is my document.",
    title: "My Document",
    isDraft: false,
  }),
});
const data = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.post("https://memory.wiki/api/docs", json={
    "markdown": "# Hello World\\nThis is my document.",
    "title": "My Document",
    "isDraft": False,
})
data = res.json()`}</CodeBlock>

            <SubLabel>응답 200</SubLabel>
            <CodeBlock lang="json">{`{
  "id": "abc123",
  "editToken": "tok_aBcDeFgHiJkLmNoP",
  "created_at": "2026-04-15T00:00:00Z"
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── GET /api/docs/{id} ─── */}
          <EndpointBlock
            id="get-docs-id"
            method="GET"
            path="/api/docs/{id}"
            description="ID로 문서를 조회합니다. 임시 저장 문서는 소유자 인증이 필요합니다. 비밀번호 보호 문서는 x-document-password 헤더가 필요합니다."
          >
            <SubLabel>헤더 (선택)</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="x-user-id" type="string">
                소유권 확인용 사용자 UUID.
              </ParamRow>
              <ParamRow name="x-document-password" type="string">
                비밀번호 보호 문서용 비밀번호.
              </ParamRow>
              <ParamRow name="x-user-email" type="string">
                사용자 식별용 이메일.
              </ParamRow>
              <ParamRow name="Authorization" type="string">
                OAuth 인증 요청용 Bearer 토큰.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl https://memory.wiki/api/docs/abc123

# With password:
curl https://memory.wiki/api/docs/abc123 \\
  -H "x-document-password: mysecret"`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs/abc123");
const doc = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.get("https://memory.wiki/api/docs/abc123")
doc = res.json()`}</CodeBlock>

            <SubLabel>응답 200</SubLabel>
            <CodeBlock lang="json">{`{
  "id": "abc123",
  "title": "My Document",
  "markdown": "# Hello World\\nThis is my document.",
  "created_at": "2026-04-15T00:00:00Z",
  "updated_at": "2026-04-15T01:00:00Z",
  "view_count": 42,
  "is_draft": false,
  "editMode": "token",
  "isOwner": true,
  "editToken": "tok_...",
  "hasPassword": false
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── PATCH /api/docs/{id} ─── */}
          <EndpointBlock
            id="patch-docs-id"
            method="PATCH"
            path="/api/docs/{id}"
            description="문서를 수정합니다. edit token 또는 소유자 인증이 필요합니다. 내용 수정, 소프트 삭제, 토큰 갱신, 편집 모드 변경 등 여러 작업을 지원합니다."
          >
            <SubLabel>매개변수</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="editToken" type="string" required>
                생성 시 반환된 edit token (token 모드에서 필수).
              </ParamRow>
              <ParamRow name="markdown" type="string">
                새 Markdown 내용.
              </ParamRow>
              <ParamRow name="title" type="string">
                새 문서 제목.
              </ParamRow>
              <ParamRow name="isDraft" type="boolean">
                임시 저장과 게시 상태를 전환합니다.
              </ParamRow>
              <ParamRow name="action" type="string">
                특수 작업: <InlineCode>{"soft-delete"}</InlineCode>, <InlineCode>{"rotate-token"}</InlineCode>.
              </ParamRow>
              <ParamRow name="changeSummary" type="string">
                변경 사항을 설명하는 버전 노트.
              </ParamRow>
              <ParamRow name="editMode" type="string">
                편집 모드 변경: <InlineCode>{"token"}</InlineCode>, <InlineCode>{"anyone"}</InlineCode>, <InlineCode>{"authenticated"}</InlineCode>.
              </ParamRow>
            </div>

            <SubLabel>Request - curl (내용 수정)</SubLabel>
            <CodeBlock lang="bash">{`curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{
    "editToken": "tok_aBcDeFgH",
    "markdown": "# Updated Content",
    "changeSummary": "Fixed typos"
  }'`}</CodeBlock>

            <SubLabel>Request - curl (소프트 삭제)</SubLabel>
            <CodeBlock lang="bash">{`curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{
    "editToken": "tok_aBcDeFgH",
    "action": "soft-delete"
  }'`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs/abc123", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    editToken: "tok_aBcDeFgH",
    markdown: "# Updated Content",
  }),
});`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.patch("https://memory.wiki/api/docs/abc123", json={
    "editToken": "tok_aBcDeFgH",
    "markdown": "# Updated Content",
})`}</CodeBlock>

            <SubLabel>응답 200</SubLabel>
            <CodeBlock lang="json">{`{
  "success": true,
  "id": "abc123",
  "updated_at": "2026-04-15T02:00:00Z"
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── HEAD /api/docs/{id} ─── */}
          <EndpointBlock
            id="head-docs-id"
            method="HEAD"
            path="/api/docs/{id}"
            description="문서의 마지막 수정 시각을 확인합니다. x-updated-at 응답 헤더를 반환합니다. 전체 내용을 다운로드하지 않고 동기화 폴링에 유용합니다."
          >
            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -I https://memory.wiki/api/docs/abc123

# Response headers:
# x-updated-at: 2026-04-15T01:00:00Z
# x-content-length: 1234`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/docs/abc123", {
  method: "HEAD",
});
const updatedAt = res.headers.get("x-updated-at");`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.head("https://memory.wiki/api/docs/abc123")
updated_at = res.headers["x-updated-at"]`}</CodeBlock>
          </EndpointBlock>

          {/* ─── GET /api/user/documents ─── */}
          <EndpointBlock
            id="get-user-documents"
            method="GET"
            path="/api/user/documents"
            description="사용자가 소유한 모든 문서를 조회합니다. 헤더를 통한 사용자 식별이 필요합니다."
          >
            <SubLabel>헤더</SubLabel>
            <div style={{ marginBottom: 24 }}>
              <ParamRow name="x-user-id" type="string" required>
                사용자 UUID. 또는 <InlineCode>{"x-user-email"}</InlineCode> 또는 <InlineCode>{"Authorization: Bearer"}</InlineCode>를 사용할 수 있습니다.
              </ParamRow>
            </div>

            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl https://memory.wiki/api/user/documents \\
  -H "x-user-id: user-uuid-here"`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const res = await fetch("https://memory.wiki/api/user/documents", {
  headers: { "x-user-id": "user-uuid-here" },
});
const { documents } = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

res = requests.get("https://memory.wiki/api/user/documents",
    headers={"x-user-id": "user-uuid-here"})
documents = res.json()["documents"]`}</CodeBlock>

            <SubLabel>응답 200</SubLabel>
            <CodeBlock lang="json">{`{
  "documents": [
    {
      "id": "abc123",
      "title": "My Document",
      "created_at": "2026-04-15T00:00:00Z",
      "updated_at": "2026-04-15T01:00:00Z",
      "is_draft": false,
      "view_count": 42
    }
  ]
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── POST /api/upload ─── */}
          <EndpointBlock
            id="post-upload"
            method="POST"
            path="/api/upload"
            description="이미지 파일을 업로드합니다. 공개 URL을 반환합니다. file 필드가 포함된 multipart form-data를 사용합니다."
          >
            <SubLabel>Request - curl</SubLabel>
            <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/upload \\
  -F "file=@screenshot.png"`}</CodeBlock>

            <SubLabel>Request - JavaScript</SubLabel>
            <CodeBlock lang="javascript">{`const form = new FormData();
form.append("file", fileBlob, "screenshot.png");

const res = await fetch("https://memory.wiki/api/upload", {
  method: "POST",
  body: form,
});
const { url } = await res.json();`}</CodeBlock>

            <SubLabel>Request - Python</SubLabel>
            <CodeBlock lang="python">{`import requests

with open("screenshot.png", "rb") as f:
    res = requests.post("https://memory.wiki/api/upload",
        files={"file": f})
url = res.json()["url"]`}</CodeBlock>

            <SubLabel>응답 200</SubLabel>
            <CodeBlock lang="json">{`{
  "url": "https://storage.memory.wiki/uploads/screenshot.png"
}`}</CodeBlock>
          </EndpointBlock>

          {/* ─── Raw + /llms.txt ─── */}
          <SectionHeading id="raw-and-llms">Raw + /llms.txt</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            모든 공개 Memory.Wiki URL 은 AI 에이전트용 클린 마크다운 변형을 함께 제공합니다.
            <InlineCode>{"?compact"}</InlineCode> 또는 <InlineCode>{"?digest"}</InlineCode> 을 붙이면 토큰을 줄일 수 있습니다 — 답변은 동일하고, 비용만 줄어듭니다.
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
            <ParamRow name="/raw/{id}" type="GET">
              단일 문서의 순수 마크다운.
            </ParamRow>
            <ParamRow name="/raw/b/{bundleId}" type="GET">
              번들 다이제스트: 프론트매터 + 캔버스 분석(테마, 인사이트, 컨셉 서브그래프) + 멤버 문서의 번호 매겨진 링크 리스트.
              <InlineCode>{"?full=1"}</InlineCode> 로 모든 문서 본문을 인라인, <InlineCode>{"?graph=0"}</InlineCode> 으로 분석을 제외할 수 있습니다.
              아래 <a href="#bundle-url-anatomy" style={{ color: "var(--accent)" }}>Bundle URL 구조</a> 참고.
            </ParamRow>
            <ParamRow name="/raw/hub/{slug}" type="GET">
              허브 전체 마크다운. <InlineCode>{"?digest=1"}</InlineCode> 은 컨셉 클러스터링된 요약을 반환합니다.
            </ParamRow>
            <ParamRow name="/raw/hub/{slug}/c/{concept}" type="GET">
              허브 내 모든 문서를 가로지르는 컨셉별 패시지 페이지.
            </ParamRow>
            <ParamRow name="/hub/{slug}/llms.txt" type="GET">
              에이전트가 먼저 가져가서 무엇이 있는지 파악할 수 있는 매니페스트.
            </ParamRow>
            <ParamRow name="/hub/{slug}/llms-full.txt" type="GET">
              허브 전체를 압축한 번들 (기본 80k 토큰, <InlineCode>{"?cap="}</InlineCode> 로 조정).
            </ParamRow>
          </div>

          {/* ─── Bundle URL 구조 ─── */}
          <SectionHeading id="bundle-url-anatomy">Bundle URL 구조</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            번들 URL (<InlineCode>memory.wiki/b/&#123;id&#125;</InlineCode>) 을 Claude, ChatGPT, Cursor 에 붙여넣으면 문서 목록 이상이 반환됩니다.
            기본 응답은 캔버스의 크로스 도큐먼트 분석 — 테마, 인사이트, 갭, 핵심 takeaway, 주목할 연결, 컨셉 서브그래프 — 까지 포함하는 다이제스트입니다.
            그래서 다음 AI 는 이전 AI 의 분석을 다시 만드는 대신 그대로 이어받을 수 있습니다.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 16,
              maxWidth: 640,
            }}
          >
            벡터 임베딩은 서버에만 남습니다 (숫자 배열이라 LLM 이 쓸 수 없음). 와이어로 나가는 것은 분석이 이미 만들어둔 텍스트 결과물뿐입니다.
          </p>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            응답 형태
          </h3>
          <CodeBlock lang="markdown">{`---
mdfy_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>   # 캔버스가 실행된 적이 있을 때만
analysis_stale: true           # 분석 이후 멤버 문서가 수정된 경우에만
source: "Memory.Wiki"
---

# <Bundle title>
> <description>
**Intent:** <intent>

> ⚠ _Analysis may be stale — 캔버스를 다시 실행해 새로고침하세요._   (stale 일 때만)

## Summary
<캔버스 요약>

## Themes
- ...

## Cross-document insights
- ...

## Key takeaways
- ...

## Open questions / gaps
- ...

## Notable connections
- **doc A 제목** ↔ **doc B 제목** — <relationship>

## Concepts (this bundle)
- **concept label** (from **doc title**)

## Concept relations
- **conceptA** ↔ **conceptB** — <edge label>

1. [Doc 1 title](https://memory.wiki/<docId>) — annotation
2. [Doc 2 title](https://memory.wiki/<docId>) — annotation`}</CodeBlock>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            쿼리 파라미터
          </h3>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "16px 24px",
              marginBottom: 24,
            }}
          >
            <ParamRow name="full" type="boolean">
              <InlineCode>{"?full=1"}</InlineCode> 는 멤버 문서 본문 전체를 doc 리스트 섹션 뒤에 인라인으로 붙입니다.
              생략하면(기본) 링크 리스트만 반환되고, AI 가 필요한 시점에 링크를 따라갑니다.
            </ParamRow>
            <ParamRow name="graph" type="boolean">
              <InlineCode>{"?graph=0"}</InlineCode> (또는 <InlineCode>false</InlineCode> / <InlineCode>off</InlineCode>) 는 캔버스 분석 섹션을 제거하고 기존의 doc 리스트만 있는 다이제스트를 반환합니다.
              분석이 무겁거나 호출자가 인벤토리만 필요할 때 사용합니다.
            </ParamRow>
            <ParamRow name="compact" type="boolean">
              <InlineCode>{"?compact"}</InlineCode> 는 페이로드 전체에서 중복 공백을 제거하고 긴 인용 블록을 잘라냅니다.
              <InlineCode>full</InlineCode>, <InlineCode>graph</InlineCode> 와 조합 가능합니다.
            </ParamRow>
          </div>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            두 개의 온톨로지 레이어
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 12,
              maxWidth: 640,
            }}
          >
            Memory.Wiki 는 두 개의 서로 다른 온톨로지 레이어를 제공하며, 각각 별도의 URL 에 실립니다:
          </p>
          <ul
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.8,
              marginBottom: 16,
              paddingLeft: 20,
              maxWidth: 640,
            }}
          >
            <li>
              <strong style={{ color: "var(--text-primary)" }}>concept_index</strong> — 허브 전체. 컨셉 라벨 + 그 컨셉이 등장하는 문서들.
              이미 <InlineCode>/raw/hub/&#123;slug&#125;</InlineCode> 에 포함됩니다.
            </li>
            <li>
              <strong style={{ color: "var(--text-primary)" }}>ai_graph</strong> — 번들 스코프. 캔버스가 생성한 테마, 인사이트, 갭, 연결, 컨셉 서브그래프.
              이번 릴리스부터 <InlineCode>/raw/b/&#123;id&#125;</InlineCode> 에 포함됩니다.
            </li>
          </ul>

          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginTop: 24,
              marginBottom: 10,
              letterSpacing: -0.1,
            }}
          >
            Stale 판정
          </h3>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 24,
              maxWidth: 640,
            }}
          >
            캔버스 분석은 스냅샷입니다. 멤버 문서 중 어느 것의 <InlineCode>updated_at</InlineCode> 이 <InlineCode>graph_generated_at</InlineCode> 보다 나중이면,
            응답은 프론트매터에 <InlineCode>analysis_stale: true</InlineCode> 를 박고 본문 맨 위에 경고 블록쿼트를 한 줄 붙여 다음 AI 가 분석을 어느 정도 가중치로 받아들일지 판단할 수 있게 합니다.
          </p>

          {/* ─── 인증 ─── */}
          <SectionHeading id="authentication">인증</SectionHeading>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 24,
              maxWidth: 640,
            }}
          >
            Memory.Wiki는 점진적 인증 방식을 사용합니다. 기본 작업은 인증이 필요 없습니다.
            고급 기능은 edit token 또는 사용자 식별 정보를 사용합니다.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {[
              {
                title: "인증 불필요",
                desc: "POST /api/docs와 GET /api/docs/{id}는 인증 없이 동작합니다. 반환된 editToken이 소유권 증명이 됩니다.",
              },
              {
                title: "Edit token",
                desc: "모든 문서는 생성 시 editToken을 받습니다. PATCH 요청 시 이 토큰을 포함하여 수정하거나 삭제합니다. MCP 서버와 CLI는 토큰을 자동으로 관리합니다.",
              },
              {
                title: "사용자 식별",
                desc: "사용자 범위 작업(목록 조회, 소유권 확인)에는 x-user-id 헤더, x-user-email 헤더, 또는 Authorization: Bearer JWT 토큰을 제공합니다.",
              },
              {
                title: "MCP / CLI 인증",
                desc: "MCP 서버와 CLI 모두 Memory.Wiki login의 JWT를 사용합니다. 실행: npm install -g mdfy-cli && Memory.Wiki login",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: 14,
                  padding: "24px",
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginTop: 0,
                    marginBottom: 10,
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* ─── 요청 제한 ─── */}
          <SectionHeading id="rate-limits">요청 제한</SectionHeading>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "24px",
              marginBottom: 24,
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              모든 엔드포인트는 <strong>IP당 분당 10회</strong>로 요청이 제한됩니다.
              제한 초과 시 <InlineCode>{"429 Too Many Requests"}</InlineCode>를 반환합니다.
              응답에 포함된 <InlineCode>{"Retry-After"}</InlineCode> 헤더로 대기 시간(초)을 확인할 수 있습니다.
              최대 문서 크기는 <strong>500KB</strong>입니다.
            </p>
          </div>

          {/* ─── 에러 ─── */}
          <SectionHeading id="errors">에러</SectionHeading>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: 14,
              padding: "24px",
              marginBottom: 24,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <ParamRow name="400" type="error">Bad Request. 필수 필드 누락 또는 잘못된 매개변수.</ParamRow>
              <ParamRow name="401" type="error">Unauthorized. 유효하지 않거나 누락된 edit token / 인증 정보.</ParamRow>
              <ParamRow name="403" type="error">Forbidden. 비밀번호가 필요하거나 비밀번호가 틀림.</ParamRow>
              <ParamRow name="404" type="error">Not Found. 문서가 존재하지 않거나 삭제됨.</ParamRow>
              <ParamRow name="410" type="error">Gone. 문서가 만료됨.</ParamRow>
              <ParamRow name="429" type="error">Too Many Requests. 요청 제한 초과.</ParamRow>
              <ParamRow name="500" type="error">Internal Server Error. 다시 시도하거나 지원팀에 문의해 주세요.</ParamRow>
            </div>
            <SubLabel>에러 응답 형식</SubLabel>
            <CodeBlock lang="json">{`{
  "error": "Document not found",
  "status": 404
}`}</CodeBlock>
          </div>
        </main>
      </div>

      <DocsFooter breadcrumb="REST API" lang="ko" />
    </div>
  );
}
