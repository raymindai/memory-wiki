"use client";

/**
 * MCP Server docs — Pure design system. Wraps content in <PureDocsShell>
 * and uses <PureCodeBlock> for fenced code. Single component handles
 * English + Korean via the `locale` prop.
 */

import PureDocsShell from "@/components/PureDocsShell";
import { PureCodeBlock } from "@/components/pure";
import "./mcp-docs.css";

type Locale = "en" | "ko";

// ─── On-this-page TOC ──────────────────────────────────────────────────
const TOC_EN = [
  { id: "what-is-mcp",    label: "What is MCP" },
  { id: "claude-web",     label: "Claude Web (Hosted)" },
  { id: "installation",   label: "Local Installation" },
  { id: "claude-code",    label: "Claude Code Setup" },
  { id: "claude-desktop", label: "Claude Desktop Setup" },
  { id: "cursor",         label: "Cursor / Windsurf" },
  { id: "tools",          label: "All 25 Tools" },
  { id: "mw-create",      label: "mw_create" },
  { id: "mw-read",        label: "mw_read" },
  { id: "mw-update",      label: "mw_update" },
  { id: "mw-list",        label: "mw_list" },
  { id: "mw-publish",     label: "mw_publish" },
  { id: "mw-delete",      label: "mw_delete" },
  { id: "examples",       label: "Usage Examples" },
];
const TOC_KO = [
  { id: "what-is-mcp",    label: "MCP란" },
  { id: "claude-web",     label: "Claude Web (호스팅)" },
  { id: "installation",   label: "로컬 설치" },
  { id: "claude-code",    label: "Claude Code 설정" },
  { id: "claude-desktop", label: "Claude Desktop 설정" },
  { id: "cursor",         label: "Cursor / Windsurf" },
  { id: "tools",          label: "전체 25개 도구" },
  { id: "mw-create",      label: "mw_create" },
  { id: "mw-read",        label: "mw_read" },
  { id: "mw-update",      label: "mw_update" },
  { id: "mw-list",        label: "mw_list" },
  { id: "mw-publish",     label: "mw_publish" },
  { id: "mw-delete",      label: "mw_delete" },
  { id: "examples",       label: "사용 예시" },
];

// ─── Tool category groups (displayed in 25-tools matrix) ──────────────
const TOOL_GROUPS_EN = [
  { cat: "Core CRUD",        tools: ["mw_create", "mw_read", "mw_update", "mw_delete", "mw_list", "mw_search"] },
  { cat: "Append/Prepend",   tools: ["mw_append", "mw_prepend"] },
  { cat: "Sections",         tools: ["mw_outline", "mw_extract_section", "mw_replace_section"] },
  { cat: "Duplicate/Import", tools: ["mw_duplicate", "mw_import_url"] },
  { cat: "Sharing",          tools: ["mw_publish", "mw_set_allowed_emails", "mw_get_share_url"] },
  { cat: "Versions",         tools: ["mw_versions", "mw_restore_version", "mw_diff"] },
  { cat: "Stats/Folders",    tools: ["mw_stats", "mw_recent", "mw_folder_list", "mw_folder_create", "mw_move_to_folder"] },
  { cat: "Render",           tools: ["mw_render_preview"] },
];
const TOOL_GROUPS_KO = [
  { cat: "핵심 CRUD",        tools: ["mw_create", "mw_read", "mw_update", "mw_delete", "mw_list", "mw_search"] },
  { cat: "Append/Prepend",   tools: ["mw_append", "mw_prepend"] },
  { cat: "섹션",             tools: ["mw_outline", "mw_extract_section", "mw_replace_section"] },
  { cat: "복제/가져오기",     tools: ["mw_duplicate", "mw_import_url"] },
  { cat: "공유",             tools: ["mw_publish", "mw_set_password", "mw_set_expiry", "mw_set_allowed_emails", "mw_get_share_url"] },
  { cat: "버전",             tools: ["mw_versions", "mw_restore_version", "mw_diff"] },
  { cat: "통계/폴더",        tools: ["mw_stats", "mw_recent", "mw_folder_list", "mw_folder_create", "mw_move_to_folder"] },
];

// ─── Individual tool entries (Core 6 detailed) ────────────────────────
type ToolParam = { name: string; type: string; required: boolean; desc: string };
type ToolEntry = { id: string; name: string; desc: string; params: ToolParam[]; example: string };

const TOOLS_EN: ToolEntry[] = [
  {
    id: "mw-create",
    name: "mw_create",
    desc: "Create a new document from Markdown content. Returns the document URL, ID, and edit token.",
    params: [
      { name: "markdown", type: "string",  required: true,  desc: "The Markdown content." },
      { name: "title",    type: "string",  required: false, desc: "Document title." },
      { name: "isDraft",  type: "boolean", required: false, desc: "Create as draft. Default: false." },
    ],
    example: `// In Claude Code:
"Publish this analysis as a document on memory.wiki"

// Claude calls mw_create:
{
  "markdown": "# Performance Analysis\\n...",
  "title": "Performance Analysis",
  "isDraft": false
}

// Returns:
{
  "url": "https://memory.wiki/abc123",
  "id": "abc123",
  "editToken": "tok_..."
}`,
  },
  {
    id: "mw-read",
    name: "mw_read",
    desc: "Fetch a document's content and metadata by ID.",
    params: [
      { name: "id", type: "string", required: true, desc: "Document ID." },
    ],
    example: `// "Read the document at memory.wiki/abc123"

// Claude calls mw_read:
{ "id": "abc123" }

// Returns full markdown content and metadata`,
  },
  {
    id: "mw-update",
    name: "mw_update",
    desc: "Update an existing document's content or title.",
    params: [
      { name: "id",            type: "string", required: true,  desc: "Document ID." },
      { name: "markdown",      type: "string", required: false, desc: "New Markdown content." },
      { name: "title",         type: "string", required: false, desc: "New title." },
      { name: "changeSummary", type: "string", required: false, desc: "Description of changes." },
    ],
    example: `// "Update the document with the revised version"

// Claude calls mw_update:
{
  "id": "abc123",
  "markdown": "# Revised Analysis\\n...",
  "changeSummary": "Added benchmarks section"
}`,
  },
  {
    id: "mw-list",
    name: "mw_list",
    desc: "List all documents owned by the authenticated user.",
    params: [],
    example: `// "Show me my published documents"

// Claude calls mw_list (no parameters)
// Returns array of documents with id, title, status`,
  },
  {
    id: "mw-publish",
    name: "mw_publish",
    desc: "Toggle a document between draft (private) and published (shared) state.",
    params: [
      { name: "id",      type: "string",  required: true, desc: "Document ID." },
      { name: "isDraft", type: "boolean", required: true, desc: "Set to true for draft, false for published." },
    ],
    example: `// "Make document abc123 public"

// Claude calls mw_publish:
{ "id": "abc123", "isDraft": false }`,
  },
  {
    id: "mw-delete",
    name: "mw_delete",
    desc: "Soft-delete a document. Can be restored by owner.",
    params: [
      { name: "id", type: "string", required: true, desc: "Document ID." },
    ],
    example: `// "Delete the old draft"

// Claude calls mw_delete:
{ "id": "abc123" }`,
  },
];

const TOOLS_KO: ToolEntry[] = [
  {
    id: "mw-create",
    name: "mw_create",
    desc: "Markdown 내용으로 새 문서를 생성합니다. 문서 URL, ID, edit token을 반환합니다.",
    params: [
      { name: "markdown", type: "string",  required: true,  desc: "Markdown 내용." },
      { name: "title",    type: "string",  required: false, desc: "문서 제목." },
      { name: "isDraft",  type: "boolean", required: false, desc: "임시 저장으로 생성. 기본값: false." },
    ],
    example: `// Claude Code에서:
"이 분석 내용을 memory.wiki에 문서로 게시해줘"

// Claude가 mw_create를 호출:
{
  "markdown": "# Performance Analysis\\n...",
  "title": "Performance Analysis",
  "isDraft": false
}

// 반환값:
{
  "url": "https://memory.wiki/abc123",
  "id": "abc123",
  "editToken": "tok_..."
}`,
  },
  {
    id: "mw-read",
    name: "mw_read",
    desc: "ID로 문서의 내용과 메타데이터를 조회합니다.",
    params: [
      { name: "id", type: "string", required: true, desc: "문서 ID." },
    ],
    example: `// "memory.wiki/abc123 문서를 읽어줘"

// Claude가 mw_read를 호출:
{ "id": "abc123" }

// 전체 markdown 내용과 메타데이터를 반환`,
  },
  {
    id: "mw-update",
    name: "mw_update",
    desc: "기존 문서의 내용이나 제목을 수정합니다.",
    params: [
      { name: "id",            type: "string", required: true,  desc: "문서 ID." },
      { name: "markdown",      type: "string", required: false, desc: "새 Markdown 내용." },
      { name: "title",         type: "string", required: false, desc: "새 제목." },
      { name: "changeSummary", type: "string", required: false, desc: "변경 사항 설명." },
    ],
    example: `// "수정된 버전으로 문서를 업데이트해줘"

// Claude가 mw_update를 호출:
{
  "id": "abc123",
  "markdown": "# Revised Analysis\\n...",
  "changeSummary": "Added benchmarks section"
}`,
  },
  {
    id: "mw-list",
    name: "mw_list",
    desc: "인증된 사용자의 모든 문서를 조회합니다.",
    params: [],
    example: `// "내가 게시한 문서들을 보여줘"

// Claude가 mw_list를 호출 (매개변수 없음)
// id, title, status가 포함된 문서 배열을 반환`,
  },
  {
    id: "mw-publish",
    name: "mw_publish",
    desc: "문서를 임시 저장(비공개)과 게시(공개) 상태 간에 전환합니다.",
    params: [
      { name: "id",      type: "string",  required: true, desc: "문서 ID." },
      { name: "isDraft", type: "boolean", required: true, desc: "true이면 임시 저장, false이면 게시." },
    ],
    example: `// "abc123 문서를 공개해줘"

// Claude가 mw_publish를 호출:
{ "id": "abc123", "isDraft": false }`,
  },
  {
    id: "mw-delete",
    name: "mw_delete",
    desc: "문서를 소프트 삭제합니다. 소유자가 복원할 수 있습니다.",
    params: [
      { name: "id", type: "string", required: true, desc: "문서 ID." },
    ],
    example: `// "오래된 임시 저장을 삭제해줘"

// Claude가 mw_delete를 호출:
{ "id": "abc123" }`,
  },
];

// ─── Static code snippets ─────────────────────────────────────────────
const HOSTED_ENDPOINT = `https://memory.wiki/api/mcp`;
const INSTALL_CODE = `npm install -g memory-wiki-cli && mw login`;
const MCP_JSON_CODE = `{
  "mcpServers": {
    "memory.wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}`;
const CURSOR_JSON_CODE = `{
  "mcpServers": {
    "memory.wiki": {
      "url": "https://memory.wiki/api/mcp"
    }
  }
}`;

// ─── Usage example transcripts (verbatim from source) ────────────────
const EX1_EN = `You: "Write a blog post about WebAssembly and publish it on memory.wiki"

Claude: I'll write the blog post and publish it for you.

[Claude writes the content, then calls mw_create]

Done! Your blog post is live at https://memory.wiki/abc123`;
const EX2_EN = `You: "Update the document at memory.wiki/abc123 - add a section about benchmarks"

Claude: I'll read the current document and add the benchmarks section.

[Claude calls mw_read, then mw_update with new content]

Updated! The document now includes the benchmarks section.`;
const EX3_EN = `You: "Show me my recent documents and delete the old drafts"

Claude: Let me list your documents.

[Claude calls mw_list]

You have 5 documents:
1. "API Guide" (published) - updated 2h ago
2. "Draft notes" (draft) - updated 3d ago
3. "Old meeting notes" (draft) - updated 2w ago

Should I delete the old drafts (#2 and #3)?

You: "Yes"

[Claude calls mw_delete for each]

Done! Deleted 2 documents.`;

const EX1_KO = `You: "WebAssembly에 대한 블로그 글을 써서 memory.wiki에 게시해줘"

Claude: 블로그 글을 작성하고 게시하겠습니다.

[Claude가 내용을 작성한 후 mw_create를 호출]

완료! 블로그 글이 https://memory.wiki/abc123 에 게시되었습니다.`;
const EX2_KO = `You: "memory.wiki/abc123 문서에 벤치마크 섹션을 추가해줘"

Claude: 현재 문서를 읽고 벤치마크 섹션을 추가하겠습니다.

[Claude가 mw_read를 호출한 후 mw_update로 새 내용을 반영]

업데이트 완료! 문서에 벤치마크 섹션이 추가되었습니다.`;
const EX3_KO = `You: "내 최근 문서를 보여주고 오래된 임시 저장을 삭제해줘"

Claude: 문서 목록을 확인하겠습니다.

[Claude가 mw_list를 호출]

5개의 문서가 있습니다:
1. "API Guide" (게시됨) - 2시간 전 수정
2. "Draft notes" (임시 저장) - 3일 전 수정
3. "Old meeting notes" (임시 저장) - 2주 전 수정

오래된 임시 저장(#2, #3)을 삭제할까요?

You: "네"

[Claude가 각각에 대해 mw_delete를 호출]

완료! 2개의 문서가 삭제되었습니다.`;

// ─── Param row inside a tool callout ─────────────────────────────────
function ParamRow({ p, requiredLabel }: { p: ToolParam; requiredLabel: string }) {
  return (
    <div className="pure-mcp-docs-param-row">
      <code className="pure-mcp-docs-param-name mono">
        {p.name}
        {p.required && <span className="pure-mcp-docs-param-required mono">{requiredLabel}</span>}
      </code>
      <span className="pure-mcp-docs-param-type mono">{p.type}</span>
      <span className="pure-mcp-docs-param-desc">{p.desc}</span>
    </div>
  );
}

export default function McpDocsPure({ locale = "en" }: { locale?: Locale }) {
  const ko = locale === "ko";
  const toc = ko ? TOC_KO : TOC_EN;
  const toolGroups = ko ? TOOL_GROUPS_KO : TOOL_GROUPS_EN;
  const tools = ko ? TOOLS_KO : TOOLS_EN;
  const currentPath = ko ? "/ko/docs/mcp" : "/docs/mcp";

  return (
    <PureDocsShell currentPath={currentPath} locale={locale} toc={toc}>
      {/* ─── Hero ────────────────────────────────────────────── */}
      <div className="pure-mcp-docs-eyebrow mono">MCP</div>
      <h1 className="pure-mcp-docs-title">MCP Server</h1>
      <p className="pure-mcp-docs-intro">
        {ko
          ? "Claude, Cursor, Windsurf 및 기타 AI 도구에서 memory.wiki 문서를 직접 생성하고 관리할 수 있습니다."
          : "Let Claude, Cursor, Windsurf, and other AI tools create and manage documents on memory.wiki directly."}
      </p>

      {/* ─── Memory layer intro card ─────────────────────────── */}
      <div className="pure-mcp-docs-memory-card">
        <p className="pure-mcp-docs-memory-headline">
          {ko ? "AI 에이전트를 위한 MCP-native memory layer." : "The MCP-native memory layer for AI agents."}
        </p>
        <p className="pure-mcp-docs-memory-lede">
          {ko
            ? "오늘 memory.wiki URL을 컨텍스트로 읽고, Phase 2에서 MCP를 통해 메모리를 기록합니다."
            : "Read memory.wiki URLs as context today. Write memory back via MCP in Phase 2."}
        </p>
        <div className="pure-mcp-docs-memory-grid">
          <div>
            <div className="pure-mcp-docs-memory-status mono">
              {ko ? "오늘" : "Today"} <span className="pure-mcp-docs-memory-badge is-live">Live</span>
            </div>
            <ul className="pure-mcp-docs-memory-list">
              <li>{ko ? "memory.wiki URL을 AI 컨텍스트로 읽기" : "Read memory.wiki URLs as AI context"}</li>
              <li>{ko ? "25개 MCP 도구를 통한 문서 CRUD" : "Document CRUD via 25 MCP tools"}</li>
              <li>{ko ? "자동 소스 감지" : "Auto-source detection"}</li>
            </ul>
          </div>
          <div>
            <div className="pure-mcp-docs-memory-status mono">
              {ko ? "출시 예정" : "Coming"} <span className="pure-mcp-docs-memory-badge is-soon">Q2 2026</span>
            </div>
            <ul className="pure-mcp-docs-memory-list is-faint">
              <li>{ko ? "메모리 쓰기 접근" : "Memory write access"}</li>
              <li>{ko ? "번들 배포" : "Bundle deploy"}</li>
              <li>{ko ? "멀티 에이전트 메모리 공유" : "Multi-agent memory sharing"}</li>
              <li>{ko ? "실시간 번들 동기화" : "Real-time bundle sync"}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── What is MCP ─────────────────────────────────────── */}
      <section id="what-is-mcp" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">{ko ? "MCP란" : "What is MCP"}</h2>
        <div className="pure-prose-callout">
          <p className="pure-mcp-docs-callout-body">
            {ko ? (
              <>
                <strong>Model Context Protocol (MCP)</strong>은 AI 어시스턴트가 외부 도구 및 서비스와 상호작용할 수 있게
                하는 개방형 표준입니다. memory.wiki MCP 서버는 7개 카테고리에 걸쳐 25개 도구를 제공합니다 — 핵심 CRUD,
                append/prepend, 섹션 편집, 공유 설정, 버전 이력, 폴더, 통계. <code>https://memory.wiki/api/mcp</code>의
                호스팅 엔드포인트는 모든 MCP 호환 클라이언트(Claude Web, Cursor 등)에서 사용할 수 있습니다.
              </>
            ) : (
              <>
                The <strong>Model Context Protocol (MCP)</strong> is an open standard that lets AI assistants interact
                with external tools and services. The memory.wiki MCP server exposes 25 tools across 7 categories — core
                CRUD, append/prepend, section editing, sharing controls, version history, folders, and stats. The hosted
                endpoint at <code>https://memory.wiki/api/mcp</code> works with any MCP-compatible client (Claude Web,
                Cursor, etc.).
              </>
            )}
          </p>
        </div>
      </section>

      {/* ─── Claude Web (Hosted MCP) ─────────────────────────── */}
      <section id="claude-web" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">{ko ? "Claude Web (호스팅 MCP)" : "Claude Web (Hosted MCP)"}</h2>
        <p className="pure-mcp-docs-body">
          {ko ? (
            <>호스팅 MCP 엔드포인트를 통해 <strong>claude.ai</strong>에서 바로 memory.wiki를 사용할 수 있습니다 — 로컬 설치가 필요 없습니다.</>
          ) : (
            <>Use memory.wiki directly in <strong>claude.ai</strong> via our hosted MCP endpoint — no local install required.</>
          )}
        </p>
        <div className="pure-prose-callout">
          <div className="mono pure-mcp-docs-sublabel">{ko ? "엔드포인트 URL" : "ENDPOINT URL"}</div>
          <PureCodeBlock code={HOSTED_ENDPOINT} lang="http" />
          <p className="pure-mcp-docs-callout-note">
            {ko ? (
              <>
                Claude.ai에서 <strong>Settings → Integrations / Connectors</strong> → Add custom MCP server → 위 URL을
                붙여넣기 합니다.
              </>
            ) : (
              <>
                In Claude.ai → <strong>Settings → Integrations / Connectors</strong> → Add custom MCP server → paste the
                URL above.
              </>
            )}
          </p>
          <p className="pure-mcp-docs-callout-note">
            {ko
              ? "같은 호스팅 엔드포인트가 원격 HTTP MCP를 지원하는 모든 MCP 호환 클라이언트(Cursor, ChatGPT, Gemini 등)에서 동작합니다."
              : "Same hosted endpoint works for any MCP-compatible client that supports remote HTTP MCP (Cursor, ChatGPT, Gemini, etc.)."}
          </p>
        </div>
      </section>

      {/* ─── Local Installation ──────────────────────────────── */}
      <section id="installation" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">{ko ? "로컬 설치" : "Local Installation"}</h2>
        <p className="pure-mcp-docs-body">
          {ko
            ? "로컬 stdio 기반 클라이언트(Claude Desktop, Claude Code, Cursor stdio 모드)의 경우, npm 패키지를 설치합니다:"
            : "For local stdio-based clients (Claude Desktop, Claude Code, Cursor stdio mode), install the npm package:"}
        </p>
        <div className="pure-prose-callout">
          <PureCodeBlock code={INSTALL_CODE} lang="bash" />
          <p className="pure-mcp-docs-callout-note">
            {ko ? (
              <>MCP 서버는 <code>mw login</code>의 JWT 인증을 사용합니다. 환경 변수 설정이 필요 없습니다.</>
            ) : (
              <>The MCP server uses JWT authentication from <code>mw login</code>. No environment variables needed.</>
            )}
          </p>
        </div>
      </section>

      {/* ─── Claude Code Setup ───────────────────────────────── */}
      <section id="claude-code" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">{ko ? "Claude Code 설정" : "Claude Code Setup"}</h2>
        <p className="pure-mcp-docs-body">
          {ko ? (
            <>프로젝트 루트의 <code>.mcp.json</code>에 추가합니다:</>
          ) : (
            <>Add to <code>.mcp.json</code> in your project root:</>
          )}
        </p>
        <div className="pure-prose-callout">
          <PureCodeBlock code={MCP_JSON_CODE} lang="json" />
        </div>
      </section>

      {/* ─── Claude Desktop Setup ────────────────────────────── */}
      <section id="claude-desktop" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">{ko ? "Claude Desktop 설정" : "Claude Desktop Setup"}</h2>
        <p className="pure-mcp-docs-body">
          {ko ? (
            <><code>claude_desktop_config.json</code>에 추가합니다:</>
          ) : (
            <>Add to <code>claude_desktop_config.json</code>:</>
          )}
        </p>
        <div className="pure-prose-callout">
          <div className="mono pure-mcp-docs-sublabel">macOS</div>
          <p className="pure-mcp-docs-path mono">~/Library/Application Support/Claude/claude_desktop_config.json</p>
          <div className="mono pure-mcp-docs-sublabel">Windows</div>
          <p className="pure-mcp-docs-path mono">%APPDATA%\Claude\claude_desktop_config.json</p>
          <PureCodeBlock code={MCP_JSON_CODE} lang="json" />
        </div>
      </section>

      {/* ─── Cursor / Windsurf ───────────────────────────────── */}
      <section id="cursor" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">Cursor / Windsurf</h2>
        <p className="pure-mcp-docs-body">
          {ko
            ? "Cursor와 Windsurf 모두 MCP를 지원합니다. 호스팅 HTTP 엔드포인트 또는 npm 패키지를 사용합니다."
            : "Cursor and Windsurf both support MCP. Use the hosted HTTP endpoint or the npm package."}
        </p>
        <div className="pure-prose-callout">
          <div className="mono pure-mcp-docs-sublabel">
            {ko ? "Cursor — Settings → MCP → Add new global MCP server" : "Cursor — Settings → MCP → Add new global MCP server"}
          </div>
          <PureCodeBlock code={CURSOR_JSON_CODE} lang="json" />
        </div>
      </section>

      {/* ─── All 25 Tools ────────────────────────────────────── */}
      <section id="tools" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">{ko ? "전체 25개 도구" : "All 25 Tools"}</h2>
        <p className="pure-mcp-docs-body">
          {ko
            ? "호스팅 MCP는 7개 카테고리에 걸쳐 25개 도구를 제공합니다. 인증은 사용자의 memory.wiki 세션을 통해 이루어집니다 (API 키 불필요)."
            : "The hosted MCP exposes 25 tools across 8 categories. Auth happens via the user's memory.wiki session (no API keys)."}
        </p>

        <div className="pure-mcp-docs-tool-groups">
          {toolGroups.map((g) => (
            <div key={g.cat} className="pure-mcp-docs-tool-group">
              <div className="mono pure-mcp-docs-tool-group-title">{g.cat}</div>
              {g.tools.map((t) => (
                <code key={t} className="pure-mcp-docs-tool-group-tool mono">{t}</code>
              ))}
            </div>
          ))}
        </div>

        <p className="pure-mcp-docs-tools-note">
          {ko
            ? "아래에 핵심 6개 도구의 상세 매개변수를 설명합니다. 나머지 19개도 같은 패턴을 따르며, 호출 시 AI가 도구 설명에서 인자를 자동 완성합니다."
            : "Detailed parameters for the 6 core tools below. The other 19 follow the same pattern — the AI will autocomplete arguments from the tool descriptions when called."}
        </p>

        <div className="pure-mcp-docs-tool-cards">
          {tools.map((tool) => (
            <a key={tool.name} href={`#${tool.id}`} className="pure-mcp-docs-tool-card">
              <code className="pure-mcp-docs-tool-card-name mono">{tool.name}</code>
              <p className="pure-mcp-docs-tool-card-desc">{tool.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* ─── Individual Tools ────────────────────────────────── */}
      {tools.map((tool) => (
        <section key={tool.id} id={tool.id} className="pure-mcp-docs-section pure-mcp-docs-tool-section">
          <h3 className="pure-mcp-docs-tool-h3">
            <code className="mono">{tool.name}</code>
          </h3>
          <p className="pure-mcp-docs-body">{tool.desc}</p>
          <div className="pure-prose-callout">
            {tool.params.length > 0 && (
              <>
                <div className="mono pure-mcp-docs-sublabel">{ko ? "매개변수" : "PARAMETERS"}</div>
                <div className="pure-mcp-docs-param-table">
                  {tool.params.map((p) => (
                    <ParamRow key={p.name} p={p} requiredLabel={ko ? "필수" : "REQUIRED"} />
                  ))}
                </div>
              </>
            )}
            <div className="mono pure-mcp-docs-sublabel">{ko ? "예시" : "EXAMPLE"}</div>
            <PureCodeBlock code={tool.example} lang="javascript" />
          </div>
        </section>
      ))}

      {/* ─── Usage Examples ──────────────────────────────────── */}
      <section id="examples" className="pure-mcp-docs-section">
        <h2 className="pure-mcp-docs-section-title">{ko ? "사용 예시" : "Usage Examples"}</h2>
        <div className="pure-mcp-docs-examples">
          <div className="pure-prose-callout">
            <div className="mono pure-mcp-docs-sublabel">{ko ? "문서 게시" : "PUBLISH A DOCUMENT"}</div>
            <PureCodeBlock code={ko ? EX1_KO : EX1_EN} lang="markdown" />
          </div>
          <div className="pure-prose-callout">
            <div className="mono pure-mcp-docs-sublabel">{ko ? "수정 반영" : "UPDATE WITH REVISIONS"}</div>
            <PureCodeBlock code={ko ? EX2_KO : EX2_EN} lang="markdown" />
          </div>
          <div className="pure-prose-callout">
            <div className="mono pure-mcp-docs-sublabel">{ko ? "문서 관리" : "MANAGE DOCUMENTS"}</div>
            <PureCodeBlock code={ko ? EX3_KO : EX3_EN} lang="markdown" />
          </div>
        </div>
      </section>
    </PureDocsShell>
  );
}
