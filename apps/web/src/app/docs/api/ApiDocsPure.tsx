"use client";

/**
 * /docs/api — REST API reference, migrated to the Pure design system.
 *
 * Body content is rendered 1:1 from the legacy page; only the chrome
 * (shell, code blocks, callouts) has been replaced with Pure
 * equivalents. The `locale` prop switches every label + paragraph
 * between English and Korean — code examples stay identical because
 * the HTTP payloads themselves don't translate.
 */

import PureDocsShell from "@/components/PureDocsShell";
import { PureCodeBlock } from "@/components/pure";
import "./api-docs.css";

type Locale = "en" | "ko";

/* ─── Small page-local primitives ─── */

function MethodBadge({ method }: { method: string }) {
  const cls = `pure-api-docs-method is-${method.toLowerCase()}`;
  return <span className={cls}>{method}</span>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="pure-api-docs-sublabel">{children}</div>;
}

function Param({
  name,
  type,
  required,
  requiredLabel,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  requiredLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pure-api-docs-param">
      <code className="pure-api-docs-param-name">
        {name}
        {required && (
          <span className="pure-api-docs-param-required">{requiredLabel}</span>
        )}
      </code>
      <span className="pure-api-docs-param-type">{type}</span>
      <span className="pure-api-docs-param-desc">{children}</span>
    </div>
  );
}

function Endpoint({
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
    <div id={id} className="pure-api-docs-endpoint">
      <div className="pure-api-docs-endpoint-head">
        <MethodBadge method={method} />
        <code className="pure-api-docs-endpoint-path">{path}</code>
      </div>
      <p className="pure-api-docs-endpoint-desc">{description}</p>
      {children}
    </div>
  );
}

/* ─── Locale strings ─── */

const STRINGS = {
  en: {
    eyebrow: "REST API",
    title: "API Reference",
    intro: "All endpoints accept and return JSON. Base URL: https://memory.wiki",
    meta: "Rate limit: 10 requests/min per IP. Max document size: 500KB.",
    required: "REQUIRED",
    parameters: "Parameters",
    queryParameters: "Query parameters",
    multipartFields: "Multipart fields",
    headers: "Headers",
    headersOptional: "Headers (optional)",
    response200: "Response 200",
    errorResponseFormat: "Error Response Format",
    reqCurl: "Request - curl",
    reqJs: "Request - JavaScript",
    reqPy: "Request - Python",
    reqCurlUpdate: "Request - curl (update content)",
    reqCurlDelete: "Request - curl (soft delete)",
    rawAndLlms: "Raw + /llms.txt",
    bundleUrlAnatomy: "Bundle URL anatomy",
    responseShape: "Response shape",
    twoOntologyLayers: "Two ontology layers",
    staleness: "Staleness model",
    authentication: "Authentication",
    rateLimits: "Rate Limits",
    errors: "Errors",
  },
  ko: {
    eyebrow: "REST API",
    title: "API 레퍼런스",
    intro: "모든 엔드포인트는 JSON을 주고받습니다. Base URL: https://memory.wiki",
    meta: "요청 제한: IP당 분당 10회. 최대 문서 크기: 500KB.",
    required: "REQUIRED",
    parameters: "매개변수",
    queryParameters: "쿼리 파라미터",
    multipartFields: "Multipart 필드",
    headers: "헤더",
    headersOptional: "헤더 (선택)",
    response200: "응답 200",
    errorResponseFormat: "에러 응답 형식",
    reqCurl: "Request - curl",
    reqJs: "Request - JavaScript",
    reqPy: "Request - Python",
    reqCurlUpdate: "Request - curl (내용 수정)",
    reqCurlDelete: "Request - curl (소프트 삭제)",
    rawAndLlms: "Raw + /llms.txt",
    bundleUrlAnatomy: "Bundle URL 구조",
    responseShape: "응답 형태",
    twoOntologyLayers: "두 개의 온톨로지 레이어",
    staleness: "Stale 판정",
    authentication: "인증",
    rateLimits: "요청 제한",
    errors: "에러",
  },
} as const;

/* ─── TOC entries ─── */

const TOC_EN = [
  { id: "overview", label: "Overview" },
  { id: "post-docs", label: "POST /api/docs" },
  { id: "get-docs-id", label: "GET /api/docs/{id}" },
  { id: "patch-docs-id", label: "PATCH /api/docs/{id}" },
  { id: "head-docs-id", label: "HEAD /api/docs/{id}" },
  { id: "get-related", label: "GET /api/docs/{id}/related" },
  { id: "get-user-documents", label: "GET /api/user/documents" },
  { id: "post-upload", label: "POST /api/upload" },
  { id: "post-import-github", label: "POST /api/import/github" },
  { id: "post-import-obsidian", label: "POST /api/import/obsidian" },
  { id: "post-import-notion", label: "POST /api/import/notion" },
  { id: "post-hub-recall", label: "POST /api/hub/{slug}/recall" },
  { id: "raw-and-llms", label: "Raw + /llms.txt" },
  { id: "bundle-url-anatomy", label: "Bundle URL anatomy" },
  { id: "authentication", label: "Authentication" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "errors", label: "Errors" },
];

const TOC_KO = [
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

/* ─── EN-only auth + error copy ─── */

const AUTH_CARDS_EN = [
  {
    title: "No auth required",
    desc: "POST /api/docs and GET /api/docs/{id} work without authentication. The returned editToken is your proof of ownership.",
  },
  {
    title: "Edit tokens",
    desc: "Every document gets an editToken at creation. Include it in PATCH requests to update or delete. MCP server and CLI manage tokens automatically.",
  },
  {
    title: "User identity",
    desc: "For user-scoped actions (list, ownership), provide x-user-id header, x-user-email header, or Authorization: Bearer JWT token.",
  },
  {
    title: "MCP / CLI auth",
    desc: "Both MCP server and CLI use JWT from memory.wiki login. Run: npm install -g memory-wiki-cli && memory.wiki login",
  },
];

const AUTH_CARDS_KO = [
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
    desc: "MCP 서버와 CLI 모두 memory.wiki login의 JWT를 사용합니다. 실행: npm install -g memory-wiki-cli && memory.wiki login",
  },
];

/* ─── Page ─── */

export default function ApiDocsPure({ locale = "en" }: { locale?: Locale }) {
  const t = STRINGS[locale];
  const toc = locale === "ko" ? TOC_KO : TOC_EN;
  const currentPath = locale === "ko" ? "/ko/docs/api" : "/docs/api";

  return (
    <PureDocsShell currentPath={currentPath} locale={locale} toc={toc}>
      {/* ─── Overview ─── */}
      <div id="overview" style={{ scrollMarginTop: 96 }}>
        <div className="pure-api-docs-eyebrow mono">{t.eyebrow}</div>
        <h1 className="pure-api-docs-title">{t.title}</h1>
        <p className="pure-api-docs-intro">
          {locale === "ko" ? "모든 엔드포인트는 JSON을 주고받습니다. Base URL: " : "All endpoints accept and return JSON. Base URL: "}
          <code>https://memory.wiki</code>
        </p>
        <p className="pure-api-docs-meta mono">{t.meta}</p>
      </div>

      {/* ─── POST /api/docs ─── */}
      <Endpoint
        id="post-docs"
        method="POST"
        path="/api/docs"
        description={locale === "ko"
          ? "새 문서를 생성합니다. 문서 ID, edit token, 생성 시각을 반환합니다."
          : "Create a new document. Returns document ID, edit token, and creation timestamp."}
      >
        <SubLabel>{t.parameters}</SubLabel>
        <div className="pure-api-docs-params">
          <Param name="markdown" type="string" required requiredLabel={t.required}>
            {locale === "ko" ? "문서의 Markdown 내용." : "The Markdown content of the document."}
          </Param>
          <Param name="title" type="string" requiredLabel={t.required}>
            {locale === "ko"
              ? "문서 제목. 미지정 시 첫 번째 헤딩에서 자동 추출."
              : "Document title. If not provided, extracted from the first heading."}
          </Param>
          <Param name="isDraft" type="boolean" requiredLabel={t.required}>
            {locale === "ko" ? (
              <>임시 저장 여부. 기본값: <code>false</code>. 임시 저장 문서는 소유자만 볼 수 있습니다.</>
            ) : (
              <>Draft status. Default: <code>false</code>. Draft documents are only visible to the owner.</>
            )}
          </Param>
          {locale === "en" ? (
            <>
              <Param name="source" type="string" requiredLabel={t.required}>
                Source identifier: <code>api</code>, <code>web</code>, <code>vscode</code>, <code>mcp</code>, <code>cli</code>, or <code>github:&lt;owner&gt;/&lt;repo&gt;</code> for GitHub imports.
              </Param>
              <Param name="editMode" type="string" requiredLabel={t.required}>
                Who can edit: <code>owner</code> (default for signed-in users), <code>token</code> (anyone with editToken), <code>view</code> (read-only for everyone but the owner).
              </Param>
              <Param name="folderId" type="string" requiredLabel={t.required}>
                Place the document in a specific folder.
              </Param>
            </>
          ) : (
            <>
              <Param name="source" type="string" requiredLabel={t.required}>
                소스 식별자: <code>api</code>, <code>web</code>, <code>vscode</code>, <code>mcp</code>, <code>cli</code>.
              </Param>
              <Param name="password" type="string" requiredLabel={t.required}>
                문서를 비밀번호로 보호합니다. 열람 시 비밀번호 입력이 필요합니다.
              </Param>
              <Param name="expiresIn" type="string" requiredLabel={t.required}>
                문서 만료 시간: <code>1h</code>, <code>1d</code>, <code>7d</code>, <code>30d</code>. 생략하면 영구 보존.
              </Param>
              <Param name="editMode" type="string" requiredLabel={t.required}>
                편집 권한: <code>token</code> (기본값, editToken 필요), <code>anyone</code>, <code>authenticated</code>.
              </Param>
              <Param name="folderId" type="string" requiredLabel={t.required}>
                문서를 특정 폴더에 저장합니다.
              </Param>
            </>
          )}
        </div>

        <SubLabel>{t.reqCurl}</SubLabel>
        <PureCodeBlock lang="bash" code={`curl -X POST https://memory.wiki/api/docs \\
  -H "Content-Type: application/json" \\
  -d '{
    "markdown": "# Hello World\\nThis is my document.",
    "title": "My Document",
    "isDraft": false
  }'`} />

        <SubLabel>{t.reqJs}</SubLabel>
        <PureCodeBlock lang="javascript" code={`const res = await fetch("https://memory.wiki/api/docs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    markdown: "# Hello World\\nThis is my document.",
    title: "My Document",
    isDraft: false,
  }),
});
const data = await res.json();`} />

        <SubLabel>{t.reqPy}</SubLabel>
        <PureCodeBlock lang="python" code={`import requests

res = requests.post("https://memory.wiki/api/docs", json={
    "markdown": "# Hello World\\nThis is my document.",
    "title": "My Document",
    "isDraft": False,
})
data = res.json()`} />

        <SubLabel>{t.response200}</SubLabel>
        <PureCodeBlock lang="json" code={`{
  "id": "abc123",
  "editToken": "tok_aBcDeFgHiJkLmNoP",
  "created_at": "2026-04-15T00:00:00Z"
}`} />
      </Endpoint>

      {/* ─── GET /api/docs/{id} ─── */}
      <Endpoint
        id="get-docs-id"
        method="GET"
        path="/api/docs/{id}"
        description={locale === "ko"
          ? "ID로 문서를 조회합니다. 임시 저장 문서는 소유자 인증이 필요합니다. 비밀번호 보호 문서는 x-document-password 헤더가 필요합니다."
          : "Read a document by ID. Draft documents and email-restricted shares require owner or invitee authentication."}
      >
        <SubLabel>{t.headersOptional}</SubLabel>
        <div className="pure-api-docs-params">
          <Param name="x-user-id" type="string" requiredLabel={t.required}>
            {locale === "ko" ? "소유권 확인용 사용자 UUID." : "User UUID for ownership verification."}
          </Param>
          {locale === "ko" && (
            <Param name="x-document-password" type="string" requiredLabel={t.required}>
              비밀번호 보호 문서용 비밀번호.
            </Param>
          )}
          <Param name="x-user-email" type="string" requiredLabel={t.required}>
            {locale === "ko"
              ? "사용자 식별용 이메일."
              : "User email for identification (matches against the doc's allowed_emails / allowed_editors)."}
          </Param>
          <Param name="Authorization" type="string" requiredLabel={t.required}>
            {locale === "ko"
              ? "OAuth 인증 요청용 Bearer 토큰."
              : "Bearer token for OAuth-authenticated requests."}
          </Param>
        </div>

        <SubLabel>{t.reqCurl}</SubLabel>
        <PureCodeBlock lang="bash" code={locale === "ko"
          ? `curl https://memory.wiki/api/docs/abc123

# With password:
curl https://memory.wiki/api/docs/abc123 \\
  -H "x-document-password: mysecret"`
          : `curl https://memory.wiki/api/docs/abc123`} />

        <SubLabel>{t.reqJs}</SubLabel>
        <PureCodeBlock lang="javascript" code={`const res = await fetch("https://memory.wiki/api/docs/abc123");
const doc = await res.json();`} />

        <SubLabel>{t.reqPy}</SubLabel>
        <PureCodeBlock lang="python" code={`import requests

res = requests.get("https://memory.wiki/api/docs/abc123")
doc = res.json()`} />

        <SubLabel>{t.response200}</SubLabel>
        <PureCodeBlock lang="json" code={locale === "ko"
          ? `{
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
}`
          : `{
  "id": "abc123",
  "title": "My Document",
  "markdown": "# Hello World\\nThis is my document.",
  "created_at": "2026-04-15T00:00:00Z",
  "updated_at": "2026-04-15T01:00:00Z",
  "view_count": 42,
  "is_draft": false,
  "editMode": "owner",
  "isOwner": true,
  "editToken": "tok_..."
}`} />
      </Endpoint>

      {/* ─── PATCH /api/docs/{id} ─── */}
      <Endpoint
        id="patch-docs-id"
        method="PATCH"
        path="/api/docs/{id}"
        description={locale === "ko"
          ? "문서를 수정합니다. edit token 또는 소유자 인증이 필요합니다. 내용 수정, 소프트 삭제, 토큰 갱신, 편집 모드 변경 등 여러 작업을 지원합니다."
          : "Update a document. Requires edit token or owner authentication. Supports multiple actions: update content, soft-delete, rotate-token, change-edit-mode."}
      >
        <SubLabel>{t.parameters}</SubLabel>
        <div className="pure-api-docs-params">
          <Param name="editToken" type="string" required requiredLabel={t.required}>
            {locale === "ko"
              ? "생성 시 반환된 edit token (token 모드에서 필수)."
              : "The edit token returned at creation (required for token mode)."}
          </Param>
          <Param name="markdown" type="string" requiredLabel={t.required}>
            {locale === "ko" ? "새 Markdown 내용." : "New Markdown content."}
          </Param>
          <Param name="title" type="string" requiredLabel={t.required}>
            {locale === "ko" ? "새 문서 제목." : "New document title."}
          </Param>
          <Param name="isDraft" type="boolean" requiredLabel={t.required}>
            {locale === "ko"
              ? "임시 저장과 게시 상태를 전환합니다."
              : "Toggle between draft and published state."}
          </Param>
          <Param name="action" type="string" requiredLabel={t.required}>
            {locale === "ko" ? (
              <>특수 작업: <code>soft-delete</code>, <code>rotate-token</code>.</>
            ) : (
              <>Special action: <code>soft-delete</code>, <code>rotate-token</code>.</>
            )}
          </Param>
          <Param name="changeSummary" type="string" requiredLabel={t.required}>
            {locale === "ko"
              ? "변경 사항을 설명하는 버전 노트."
              : "Version note describing the change."}
          </Param>
          <Param name="editMode" type="string" requiredLabel={t.required}>
            {locale === "ko" ? (
              <>편집 모드 변경: <code>token</code>, <code>anyone</code>, <code>authenticated</code>.</>
            ) : (
              <>Change edit mode: <code>owner</code>, <code>token</code>, or <code>view</code>.</>
            )}
          </Param>
        </div>

        <SubLabel>{t.reqCurlUpdate}</SubLabel>
        <PureCodeBlock lang="bash" code={`curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{
    "editToken": "tok_aBcDeFgH",
    "markdown": "# Updated Content",
    "changeSummary": "Fixed typos"
  }'`} />

        <SubLabel>{t.reqCurlDelete}</SubLabel>
        <PureCodeBlock lang="bash" code={`curl -X PATCH https://memory.wiki/api/docs/abc123 \\
  -H "Content-Type: application/json" \\
  -d '{
    "editToken": "tok_aBcDeFgH",
    "action": "soft-delete"
  }'`} />

        <SubLabel>{t.reqJs}</SubLabel>
        <PureCodeBlock lang="javascript" code={`const res = await fetch("https://memory.wiki/api/docs/abc123", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    editToken: "tok_aBcDeFgH",
    markdown: "# Updated Content",
  }),
});`} />

        <SubLabel>{t.reqPy}</SubLabel>
        <PureCodeBlock lang="python" code={`import requests

res = requests.patch("https://memory.wiki/api/docs/abc123", json={
    "editToken": "tok_aBcDeFgH",
    "markdown": "# Updated Content",
})`} />

        <SubLabel>{t.response200}</SubLabel>
        <PureCodeBlock lang="json" code={`{
  "success": true,
  "id": "abc123",
  "updated_at": "2026-04-15T02:00:00Z"
}`} />
      </Endpoint>

      {/* ─── HEAD /api/docs/{id} ─── */}
      <Endpoint
        id="head-docs-id"
        method="HEAD"
        path="/api/docs/{id}"
        description={locale === "ko"
          ? "문서의 마지막 수정 시각을 확인합니다. x-updated-at 응답 헤더를 반환합니다. 전체 내용을 다운로드하지 않고 동기화 폴링에 유용합니다."
          : "Check when a document was last updated. Returns x-updated-at response header. Useful for sync polling without downloading full content."}
      >
        <SubLabel>{t.reqCurl}</SubLabel>
        <PureCodeBlock lang="bash" code={`curl -I https://memory.wiki/api/docs/abc123

# Response headers:
# x-updated-at: 2026-04-15T01:00:00Z
# x-content-length: 1234`} />

        <SubLabel>{t.reqJs}</SubLabel>
        <PureCodeBlock lang="javascript" code={`const res = await fetch("https://memory.wiki/api/docs/abc123", {
  method: "HEAD",
});
const updatedAt = res.headers.get("x-updated-at");`} />

        <SubLabel>{t.reqPy}</SubLabel>
        <PureCodeBlock lang="python" code={`import requests

res = requests.head("https://memory.wiki/api/docs/abc123")
updated_at = res.headers["x-updated-at"]`} />
      </Endpoint>

      {/* ─── GET /api/docs/{id}/related (EN only) ─── */}
      {locale === "en" && (
        <Endpoint
          id="get-related"
          method="GET"
          path="/api/docs/{id}/related"
          description="Return up to N other docs from the caller's hub that share concepts with this doc. Owner-only — overlap leaks titles otherwise."
        >
          <SubLabel>{t.queryParameters}</SubLabel>
          <div className="pure-api-docs-params">
            <Param name="limit" type="number" requiredLabel={t.required}>
              Max results to return. Default 5, capped at 20.
            </Param>
          </div>

          <SubLabel>{t.reqCurl}</SubLabel>
          <PureCodeBlock lang="bash" code={`curl https://memory.wiki/api/docs/abc123/related?limit=5 \\
  -H "Authorization: Bearer $JWT"`} />

          <SubLabel>{t.response200}</SubLabel>
          <PureCodeBlock lang="json" code={`{
  "id": "abc123",
  "related": [
    {
      "id": "def456",
      "title": "Related doc",
      "sharedConcepts": ["AI memory", "knowledge hub"],
      "overlap": 2,
      "isDraft": false,
      "isRestricted": false,
      "sharedWithCount": 0,
      "updated_at": "2026-04-15T01:00:00Z"
    }
  ]
}`} />
        </Endpoint>
      )}

      {/* ─── GET /api/user/documents ─── */}
      <Endpoint
        id="get-user-documents"
        method="GET"
        path="/api/user/documents"
        description={locale === "ko"
          ? "사용자가 소유한 모든 문서를 조회합니다. 헤더를 통한 사용자 식별이 필요합니다."
          : "List all documents owned by a user. Requires user identification via header."}
      >
        <SubLabel>{t.headers}</SubLabel>
        <div className="pure-api-docs-params">
          <Param name="x-user-id" type="string" required requiredLabel={t.required}>
            {locale === "ko" ? (
              <>사용자 UUID. 또는 <code>x-user-email</code> 또는 <code>Authorization: Bearer</code>를 사용할 수 있습니다.</>
            ) : (
              <>User UUID. Alternatively use <code>x-user-email</code> or <code>Authorization: Bearer</code>.</>
            )}
          </Param>
        </div>

        <SubLabel>{t.reqCurl}</SubLabel>
        <PureCodeBlock lang="bash" code={`curl https://memory.wiki/api/user/documents \\
  -H "x-user-id: user-uuid-here"`} />

        <SubLabel>{t.reqJs}</SubLabel>
        <PureCodeBlock lang="javascript" code={`const res = await fetch("https://memory.wiki/api/user/documents", {
  headers: { "x-user-id": "user-uuid-here" },
});
const { documents } = await res.json();`} />

        <SubLabel>{t.reqPy}</SubLabel>
        <PureCodeBlock lang="python" code={`import requests

res = requests.get("https://memory.wiki/api/user/documents",
    headers={"x-user-id": "user-uuid-here"})
documents = res.json()["documents"]`} />

        <SubLabel>{t.response200}</SubLabel>
        <PureCodeBlock lang="json" code={`{
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
}`} />
      </Endpoint>

      {/* ─── POST /api/upload ─── */}
      <Endpoint
        id="post-upload"
        method="POST"
        path="/api/upload"
        description={locale === "ko"
          ? "이미지 파일을 업로드합니다. 공개 URL을 반환합니다. file 필드가 포함된 multipart form-data를 사용합니다."
          : "Upload an image file. Returns a public URL. Accepts multipart form-data with a file field."}
      >
        <SubLabel>{t.reqCurl}</SubLabel>
        <PureCodeBlock lang="bash" code={`curl -X POST https://memory.wiki/api/upload \\
  -F "file=@screenshot.png"`} />

        <SubLabel>{t.reqJs}</SubLabel>
        <PureCodeBlock lang="javascript" code={`const form = new FormData();
form.append("file", fileBlob, "screenshot.png");

const res = await fetch("https://memory.wiki/api/upload", {
  method: "POST",
  body: form,
});
const { url } = await res.json();`} />

        <SubLabel>{t.reqPy}</SubLabel>
        <PureCodeBlock lang="python" code={`import requests

with open("screenshot.png", "rb") as f:
    res = requests.post("https://memory.wiki/api/upload",
        files={"file": f})
url = res.json()["url"]`} />

        <SubLabel>{t.response200}</SubLabel>
        <PureCodeBlock lang="json" code={`{
  "url": "https://storage.memory.wiki/uploads/screenshot.png"
}`} />
      </Endpoint>

      {/* ─── EN-only import + recall endpoints ─── */}
      {locale === "en" && (
        <>
          <Endpoint
            id="post-import-github"
            method="POST"
            path="/api/import/github"
            description="Import every .md file from a GitHub repo, folder, or single file. Caps: 80 files, 200KB per file. Creates one doc per file plus a bundle that groups them."
          >
            <SubLabel>{t.parameters}</SubLabel>
            <div className="pure-api-docs-params">
              <Param name="url" type="string" required requiredLabel={t.required}>
                GitHub URL — repo home, /tree/branch/path, /blob/branch/path, or raw.githubusercontent.com link.
              </Param>
            </div>

            <SubLabel>{t.reqCurl}</SubLabel>
            <PureCodeBlock lang="bash" code={`curl -X POST https://memory.wiki/api/import/github \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT" \\
  -d '{ "url": "https://github.com/owner/repo/tree/main/docs" }'`} />

            <SubLabel>{t.response200}</SubLabel>
            <PureCodeBlock lang="json" code={`{
  "imported": 12,
  "skipped": 0,
  "deduplicated": 2,
  "failed": 0,
  "docs": [
    {
      "id": "abc123",
      "title": "README",
      "path": "README.md",
      "sourceUrl": "https://github.com/owner/repo/blob/main/README.md"
    }
  ]
}`} />
          </Endpoint>

          <Endpoint
            id="post-import-obsidian"
            method="POST"
            path="/api/import/obsidian"
            description="Import every .md file from an Obsidian vault uploaded as a .zip (multipart/form-data, file field). Caps: 10MB zipped, 80 files, 200KB per file. Skips dot-prefixed folders (.obsidian, .git, …) and macOS resource forks."
          >
            <SubLabel>{t.multipartFields}</SubLabel>
            <div className="pure-api-docs-params">
              <Param name="file" type="file" required requiredLabel={t.required}>
                A .zip containing your vault. The file name (minus extension) is recorded as the vault label.
              </Param>
            </div>

            <SubLabel>{t.reqCurl}</SubLabel>
            <PureCodeBlock lang="bash" code={`curl -X POST https://memory.wiki/api/import/obsidian \\
  -H "Authorization: Bearer $JWT" \\
  -F "file=@MyVault.zip"`} />

            <SubLabel>{t.response200}</SubLabel>
            <PureCodeBlock lang="json" code={`{
  "imported": 12,
  "skipped": 0,
  "deduplicated": 2,
  "failed": 0,
  "docs": [
    {
      "id": "abc123",
      "title": "Daily Note",
      "path": "notes/Daily Note.md"
    }
  ]
}`} />
          </Endpoint>

          <Endpoint
            id="post-import-notion"
            method="POST"
            path="/api/import/notion"
            description="Import a single Notion page using the caller's internal integration token. v1 — no OAuth; the user pastes the token per call. Same dedup contract as docs/PDF/GitHub/Obsidian so re-calling is idempotent."
          >
            <SubLabel>{t.parameters}</SubLabel>
            <div className="pure-api-docs-params">
              <Param name="token" type="string" required requiredLabel={t.required}>
                Notion internal integration token (<code>secret_…</code> or <code>ntn_…</code>). The integration must have access to the page.
              </Param>
              <Param name="pageUrl" type="string" requiredLabel={t.required}>
                Notion page URL — anything from <code>notion.so/…</code> with a UUID in it.
              </Param>
              <Param name="pageId" type="string" requiredLabel={t.required}>
                Alternative to pageUrl. Hyphenated UUID or bare 32-char id.
              </Param>
            </div>

            <SubLabel>{t.reqCurl}</SubLabel>
            <PureCodeBlock lang="bash" code={`curl -X POST https://memory.wiki/api/import/notion \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT" \\
  -d '{
    "token": "secret_xxx",
    "pageUrl": "https://www.notion.so/My-Page-abcdef0123456789abcdef0123456789"
  }'`} />

            <SubLabel>{t.response200}</SubLabel>
            <PureCodeBlock lang="json" code={`{
  "imported": 1,
  "deduplicated": 0,
  "failed": 0,
  "docs": [
    {
      "id": "abc123",
      "title": "My Page",
      "notionPageId": "abcdef01-2345-6789-abcd-ef0123456789",
      "pageUrl": "https://www.notion.so/My-Page-abcdef0123456789abcdef0123456789"
    }
  ]
}`} />
          </Endpoint>

          <Endpoint
            id="post-hub-recall"
            method="POST"
            path="/api/hub/{slug}/recall"
            description="Hybrid retrieval over the public docs in a hub. Combines vector + keyword search; pass rerank: true to reorder candidates with a Haiku-based cross-encoder for higher precision."
          >
            <SubLabel>{t.parameters}</SubLabel>
            <div className="pure-api-docs-params">
              <Param name="query" type="string" required requiredLabel={t.required}>
                The natural-language question or search phrase.
              </Param>
              <Param name="k" type="number" requiredLabel={t.required}>
                Number of results to return. Default 8.
              </Param>
              <Param name="rerank" type="boolean" requiredLabel={t.required}>
                When true, fetch <code>k * 4</code> candidates first then rerank with Anthropic Haiku. Slower but more precise.
              </Param>
            </div>

            <SubLabel>{t.reqCurl}</SubLabel>
            <PureCodeBlock lang="bash" code={`curl -X POST https://memory.wiki/api/hub/your-slug/recall \\
  -H "Content-Type: application/json" \\
  -d '{ "query": "how do bundles work?", "k": 6, "rerank": true }'`} />

            <SubLabel>{t.response200}</SubLabel>
            <PureCodeBlock lang="json" code={`{
  "matches": [
    {
      "doc_id": "abc123",
      "title": "Bundles overview",
      "passage": "A bundle groups related docs into…",
      "score": 0.84
    }
  ],
  "meta": { "reranked": true }
}`} />
          </Endpoint>
        </>
      )}

      {/* ─── Raw + /llms.txt ─── */}
      <section id="raw-and-llms" className="pure-api-docs-section">
        <h2 className="pure-api-docs-section-title">{t.rawAndLlms}</h2>
        <p className="pure-api-docs-body">
          {locale === "ko" ? (
            <>모든 공개 memory.wiki URL 은 AI 에이전트용 클린 마크다운 변형을 함께 제공합니다.{" "}
            <code>?compact</code> 또는 <code>?digest</code> 을 붙이면 토큰을 줄일 수 있습니다 — 답변은 동일하고, 비용만 줄어듭니다.</>
          ) : (
            <>Every public memory.wiki URL also exposes a clean-markdown variant for AI agents.
            Append <code>?compact</code> or <code>?digest</code> to cut tokens — the answer is the same; the bill is smaller.</>
          )}
        </p>
        <div className="pure-api-docs-callout">
          <div className="pure-api-docs-params">
            <Param name="/raw/{id}" type="GET" requiredLabel={t.required}>
              {locale === "ko" ? "단일 문서의 순수 마크다운." : "Plain markdown for a single document."}
            </Param>
            <Param name="/raw/b/{bundleId}" type="GET" requiredLabel={t.required}>
              {locale === "ko" ? (
                <>번들 다이제스트: 프론트매터 + 캔버스 분석(테마, 인사이트, 컨셉 서브그래프) + 멤버 문서의 번호 매겨진 링크 리스트.
                <code>?full=1</code> 로 모든 문서 본문을 인라인, <code>?graph=0</code> 으로 분석을 제외할 수 있습니다.
                아래 <a href="#bundle-url-anatomy">Bundle URL 구조</a> 참고.</>
              ) : (
                <>Bundle digest: frontmatter + the canvas analysis (themes, insights, concept sub-graph) + a numbered link list of member docs.
                Add <code>?full=1</code> to inline every doc body, <code>?graph=0</code> to drop the analysis.
                See <a href="#bundle-url-anatomy">Bundle URL anatomy</a> below.</>
              )}
            </Param>
            <Param name="/raw/hub/{slug}" type="GET" requiredLabel={t.required}>
              {locale === "ko" ? (
                <>허브 전체 마크다운. <code>?digest=1</code> 은 컨셉 클러스터링된 요약을 반환합니다.</>
              ) : (
                <>Whole-hub markdown. <code>?digest=1</code> returns a concept-clustered summary.</>
              )}
            </Param>
            <Param name="/raw/hub/{slug}/c/{concept}" type="GET" requiredLabel={t.required}>
              {locale === "ko"
                ? "허브 내 모든 문서를 가로지르는 컨셉별 패시지 페이지."
                : "Per-concept passage page across all docs in the hub."}
            </Param>
            <Param name="/hub/{slug}/llms.txt" type="GET" requiredLabel={t.required}>
              {locale === "ko"
                ? "에이전트가 먼저 가져가서 무엇이 있는지 파악할 수 있는 매니페스트."
                : "Manifest the agent can fetch first to understand what's available."}
            </Param>
            <Param name="/hub/{slug}/llms-full.txt" type="GET" requiredLabel={t.required}>
              {locale === "ko" ? (
                <>허브 전체를 압축한 번들 (기본 80k 토큰, <code>?cap=</code> 로 조정).</>
              ) : (
                <>Dense whole-hub bundle (default 80k tokens, override with <code>?cap=</code>).</>
              )}
            </Param>
          </div>
        </div>
      </section>

      {/* ─── Bundle URL anatomy ─── */}
      <section id="bundle-url-anatomy" className="pure-api-docs-section">
        <h2 className="pure-api-docs-section-title">{t.bundleUrlAnatomy}</h2>
        <p className="pure-api-docs-body">
          {locale === "ko" ? (
            <>번들 URL (<code>memory.wiki/b/&#123;id&#125;</code>) 을 Claude, ChatGPT, Cursor 에 붙여넣으면 문서 목록 이상이 반환됩니다.
            기본 응답은 캔버스의 크로스 도큐먼트 분석 — 테마, 인사이트, 갭, 핵심 takeaway, 주목할 연결, 컨셉 서브그래프 — 까지 포함하는 다이제스트입니다.
            그래서 다음 AI 는 이전 AI 의 분석을 다시 만드는 대신 그대로 이어받을 수 있습니다.</>
          ) : (
            <>Pasting a bundle URL (<code>memory.wiki/b/&#123;id&#125;</code>) into Claude, ChatGPT, or Cursor returns more than a doc list.
            The default response is a digest that also carries the canvas&apos;s cross-document analysis — themes,
            insights, gaps, takeaways, notable connections, and a concept sub-graph — so the consuming AI inherits the prior AI&apos;s work
            instead of redoing it.</>
          )}
        </p>
        <p className="pure-api-docs-body">
          {locale === "ko"
            ? "벡터 임베딩은 서버에만 남습니다 (숫자 배열이라 LLM 이 쓸 수 없음). 와이어로 나가는 것은 분석이 이미 만들어둔 텍스트 결과물뿐입니다."
            : "Vector embeddings stay server-side (they're numeric and unusable to an LLM). What ships over the wire is the textual output the analysis already produced."}
        </p>

        <h3 className="pure-api-docs-subhead">{t.responseShape}</h3>
        <PureCodeBlock lang="markdown" code={locale === "ko"
          ? `---
mw_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>   # 캔버스가 실행된 적이 있을 때만
analysis_stale: true           # 분석 이후 멤버 문서가 수정된 경우에만
source: "memory.wiki"
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
2. [Doc 2 title](https://memory.wiki/<docId>) — annotation`
          : `---
mw_bundle: 1
id: <bundleId>
title: "..."
url: https://memory.wiki/b/<id>
document_count: N
updated: <ISO>
analysis_generated_at: <ISO>   # present when the canvas has run
analysis_stale: true           # only when a member doc was edited after that run
source: "memory.wiki"
---

# <Bundle title>
> <description>
**Intent:** <intent>

> ⚠ _Analysis may be stale — re-run the canvas to refresh._   (stale only)

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
- **doc A title** ↔ **doc B title** — <relationship>

## Concepts (this bundle)
- **concept label** (from **doc title**)

## Concept relations
- **conceptA** ↔ **conceptB** — <edge label>

1. [Doc 1 title](https://memory.wiki/<docId>) — annotation
2. [Doc 2 title](https://memory.wiki/<docId>) — annotation`} />

        <h3 className="pure-api-docs-subhead">{t.queryParameters}</h3>
        <div className="pure-api-docs-callout">
          <div className="pure-api-docs-params">
            <Param name="full" type="boolean" requiredLabel={t.required}>
              {locale === "ko" ? (
                <><code>?full=1</code> 는 멤버 문서 본문 전체를 doc 리스트 섹션 뒤에 인라인으로 붙입니다.
                생략하면(기본) 링크 리스트만 반환되고, AI 가 필요한 시점에 링크를 따라갑니다.</>
              ) : (
                <><code>?full=1</code> inlines every member doc&apos;s full markdown body after the doc-list section.
                Default (omitted) returns the link list only — the AI follows links on demand.</>
              )}
            </Param>
            <Param name="graph" type="boolean" requiredLabel={t.required}>
              {locale === "ko" ? (
                <><code>?graph=0</code> (또는 <code>false</code> / <code>off</code>) 는 캔버스 분석 섹션을 제거하고 기존의 doc 리스트만 있는 다이제스트를 반환합니다.
                분석이 무겁거나 호출자가 인벤토리만 필요할 때 사용합니다.</>
              ) : (
                <><code>?graph=0</code> (also <code>false</code> / <code>off</code>) drops the canvas-analysis sections and returns the legacy doc-list-only digest. Useful when the analysis is heavy or the caller only needs the inventory.</>
              )}
            </Param>
            <Param name="compact" type="boolean" requiredLabel={t.required}>
              {locale === "ko" ? (
                <><code>?compact</code> 는 페이로드 전체에서 중복 공백을 제거하고 긴 인용 블록을 잘라냅니다.
                <code>full</code>, <code>graph</code> 와 조합 가능합니다.</>
              ) : (
                <><code>?compact</code> strips redundant whitespace and trims long quoted blocks across the whole payload.
                Combines with <code>full</code> and <code>graph</code>.</>
              )}
            </Param>
          </div>
        </div>

        <h3 className="pure-api-docs-subhead">{t.twoOntologyLayers}</h3>
        <p className="pure-api-docs-body">
          {locale === "ko"
            ? "memory.wiki 는 두 개의 서로 다른 온톨로지 레이어를 제공하며, 각각 별도의 URL 에 실립니다:"
            : "memory.wiki ships two distinct ontology layers, and each lives on its own URL:"}
        </p>
        <ul className="pure-api-docs-list">
          {locale === "ko" ? (
            <>
              <li>
                <strong>concept_index</strong> — 허브 전체. 컨셉 라벨 + 그 컨셉이 등장하는 문서들.
                이미 <code>/raw/hub/&#123;slug&#125;</code> 에 포함됩니다.
              </li>
              <li>
                <strong>ai_graph</strong> — 번들 스코프. 캔버스가 생성한 테마, 인사이트, 갭, 연결, 컨셉 서브그래프.
                이번 릴리스부터 <code>/raw/b/&#123;id&#125;</code> 에 포함됩니다.
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>concept_index</strong> — hub-wide. Concept labels + the docs each appears in.
                Already embedded in <code>/raw/hub/&#123;slug&#125;</code>.
              </li>
              <li>
                <strong>ai_graph</strong> — bundle-scoped. Themes, insights, gaps, connections, and a
                concept sub-graph produced by the canvas. Embedded in <code>/raw/b/&#123;id&#125;</code> as of this release.
              </li>
            </>
          )}
        </ul>

        <h3 className="pure-api-docs-subhead">{t.staleness}</h3>
        <p className="pure-api-docs-body">
          {locale === "ko" ? (
            <>캔버스 분석은 스냅샷입니다. 멤버 문서 중 어느 것의 <code>updated_at</code> 이 <code>graph_generated_at</code> 보다 나중이면,
            응답은 프론트매터에 <code>analysis_stale: true</code> 를 박고 본문 맨 위에 경고 블록쿼트를 한 줄 붙여 다음 AI 가 분석을 어느 정도 가중치로 받아들일지 판단할 수 있게 합니다.</>
          ) : (
            <>The canvas analysis is a snapshot. If any member doc&apos;s <code>updated_at</code> is later than
            {" "}<code>graph_generated_at</code>, the response sets <code>analysis_stale: true</code> in frontmatter and prepends a
            warning blockquote so the consuming AI can weight the analysis appropriately.</>
          )}
        </p>
      </section>

      {/* ─── Authentication ─── */}
      <section id="authentication" className="pure-api-docs-section">
        <h2 className="pure-api-docs-section-title">{t.authentication}</h2>
        <p className="pure-api-docs-body">
          {locale === "ko"
            ? "memory.wiki는 점진적 인증 방식을 사용합니다. 기본 작업은 인증이 필요 없습니다. 고급 기능은 edit token 또는 사용자 식별 정보를 사용합니다."
            : "memory.wiki uses progressive authentication. Basic operations require no auth. Advanced features use edit tokens or user identity."}
        </p>

        <div className="pure-api-docs-auth-grid">
          {(locale === "ko" ? AUTH_CARDS_KO : AUTH_CARDS_EN).map((item) => (
            <div key={item.title} className="pure-api-docs-auth-card">
              <h3 className="pure-api-docs-auth-card-title">{item.title}</h3>
              <p className="pure-api-docs-auth-card-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Rate Limits ─── */}
      <section id="rate-limits" className="pure-api-docs-section">
        <h2 className="pure-api-docs-section-title">{t.rateLimits}</h2>
        <div className="pure-api-docs-callout">
          <p>
            {locale === "ko" ? (
              <>모든 엔드포인트는 <strong>IP당 분당 10회</strong>로 요청이 제한됩니다.
              제한 초과 시 <code>429 Too Many Requests</code>를 반환합니다.
              응답에 포함된 <code>Retry-After</code> 헤더로 대기 시간(초)을 확인할 수 있습니다.
              최대 문서 크기는 <strong>500KB</strong>입니다.</>
            ) : (
              <>All endpoints are rate-limited to <strong>10 requests per minute per IP</strong>.
              Exceeding the limit returns <code>429 Too Many Requests</code>.
              The response includes <code>Retry-After</code> header indicating seconds to wait.
              Maximum document size is <strong>500KB</strong>.</>
            )}
          </p>
        </div>
      </section>

      {/* ─── Errors ─── */}
      <section id="errors" className="pure-api-docs-section">
        <h2 className="pure-api-docs-section-title">{t.errors}</h2>
        <div className="pure-api-docs-callout">
          <div className="pure-api-docs-params">
            {locale === "ko" ? (
              <>
                <Param name="400" type="error" requiredLabel={t.required}>Bad Request. 필수 필드 누락 또는 잘못된 매개변수.</Param>
                <Param name="401" type="error" requiredLabel={t.required}>Unauthorized. 유효하지 않거나 누락된 edit token / 인증 정보.</Param>
                <Param name="403" type="error" requiredLabel={t.required}>Forbidden. 비밀번호가 필요하거나 비밀번호가 틀림.</Param>
                <Param name="404" type="error" requiredLabel={t.required}>Not Found. 문서가 존재하지 않거나 삭제됨.</Param>
                <Param name="410" type="error" requiredLabel={t.required}>Gone. 문서가 만료됨.</Param>
                <Param name="429" type="error" requiredLabel={t.required}>Too Many Requests. 요청 제한 초과.</Param>
                <Param name="500" type="error" requiredLabel={t.required}>Internal Server Error. 다시 시도하거나 지원팀에 문의해 주세요.</Param>
              </>
            ) : (
              <>
                <Param name="400" type="error" requiredLabel={t.required}>Bad Request. Missing required fields or invalid parameters.</Param>
                <Param name="401" type="error" requiredLabel={t.required}>Unauthorized. Invalid or missing edit token / credentials.</Param>
                <Param name="403" type="error" requiredLabel={t.required}>Forbidden. Insufficient permissions for this resource.</Param>
                <Param name="404" type="error" requiredLabel={t.required}>Not Found. Document does not exist or has been deleted.</Param>
                <Param name="409" type="error" requiredLabel={t.required}>Conflict. Anti-template guard refused the write (would overwrite real content with boilerplate).</Param>
                <Param name="429" type="error" requiredLabel={t.required}>Too Many Requests. Rate limit exceeded.</Param>
                <Param name="500" type="error" requiredLabel={t.required}>Internal Server Error. Please retry or contact support.</Param>
              </>
            )}
          </div>
          <div style={{ marginTop: 14 }}>
            <SubLabel>{t.errorResponseFormat}</SubLabel>
            <PureCodeBlock lang="json" code={`{
  "error": "Document not found",
  "status": 404
}`} />
          </div>
        </div>
      </section>

    </PureDocsShell>
  );
}
