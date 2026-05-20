import type { Metadata } from "next";
import {
  CodeBlock,
  InlineCode,
  Card,
  SectionHeading,
  SubLabel,
  DocsNav,
  DocsFooter,
  DocsSidebar,
  mono,
} from "@/components/docs";

export const metadata: Metadata = {
  title: "MCP Server 레퍼런스 — memory.wiki",
  description:
    "memory.wiki MCP (Model Context Protocol) 서버. Claude, Cursor, Windsurf 등 AI 도구에서 25개 도구로 문서를 직접 생성하고 관리할 수 있습니다.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/mcp",
    languages: { en: "https://memory.wiki/docs/mcp" },
  },
  openGraph: {
    title: "MCP Server 레퍼런스 — memory.wiki",
    description: "AI 도구에서 memory.wiki 문서를 게시하고 관리합니다. 25개 도구 지원.",
    url: "https://memory.wiki/ko/docs/mcp",
    images: [{ url: "/api/og?title=MCP%20Server", width: 1200, height: 630 }],
  },
};

function ParamRow({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
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
      <code style={{ fontSize: 13, fontFamily: mono, color: "var(--text-primary)", fontWeight: 600 }}>
        {name}
        {required && <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", marginLeft: 6, verticalAlign: "super" }}>REQUIRED</span>}
      </code>
      <span style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)" }}>{type}</span>
      <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

const sidebarItems = [
  { id: "what-is-mcp", label: "MCP란" },
  { id: "claude-web", label: "Claude Web (호스팅)" },
  { id: "installation", label: "로컬 설치" },
  { id: "claude-code", label: "Claude Code 설정" },
  { id: "claude-desktop", label: "Claude Desktop 설정" },
  { id: "cursor", label: "Cursor / Windsurf" },
  { id: "tools", label: "전체 25개 도구" },
  { id: "mdfy-create", label: "mdfy_create" },
  { id: "mdfy-read", label: "mdfy_read" },
  { id: "mdfy-update", label: "mdfy_update" },
  { id: "mdfy-list", label: "mdfy_list" },
  { id: "mdfy-publish", label: "mdfy_publish" },
  { id: "mdfy-delete", label: "mdfy_delete" },
  { id: "examples", label: "사용 예시" },
];

const tools = [
  {
    id: "mdfy-create",
    name: "mdfy_create",
    desc: "Markdown 내용으로 새 문서를 생성합니다. 문서 URL, ID, edit token을 반환합니다.",
    params: [
      { name: "markdown", type: "string", required: true, desc: "Markdown 내용." },
      { name: "title", type: "string", required: false, desc: "문서 제목." },
      { name: "isDraft", type: "boolean", required: false, desc: "임시 저장으로 생성. 기본값: false." },
    ],
    example: `// Claude Code에서:
"이 분석 내용을 memory.wiki에 문서로 게시해줘"

// Claude가 mdfy_create를 호출:
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
    id: "mdfy-read",
    name: "mdfy_read",
    desc: "ID로 문서의 내용과 메타데이터를 조회합니다.",
    params: [
      { name: "id", type: "string", required: true, desc: "문서 ID." },
    ],
    example: `// "memory.wiki/abc123 문서를 읽어줘"

// Claude가 mdfy_read를 호출:
{ "id": "abc123" }

// 전체 markdown 내용과 메타데이터를 반환`,
  },
  {
    id: "mdfy-update",
    name: "mdfy_update",
    desc: "기존 문서의 내용이나 제목을 수정합니다.",
    params: [
      { name: "id", type: "string", required: true, desc: "문서 ID." },
      { name: "markdown", type: "string", required: false, desc: "새 Markdown 내용." },
      { name: "title", type: "string", required: false, desc: "새 제목." },
      { name: "changeSummary", type: "string", required: false, desc: "변경 사항 설명." },
    ],
    example: `// "수정된 버전으로 문서를 업데이트해줘"

// Claude가 mdfy_update를 호출:
{
  "id": "abc123",
  "markdown": "# Revised Analysis\\n...",
  "changeSummary": "Added benchmarks section"
}`,
  },
  {
    id: "mdfy-list",
    name: "mdfy_list",
    desc: "인증된 사용자의 모든 문서를 조회합니다.",
    params: [],
    example: `// "내가 게시한 문서들을 보여줘"

// Claude가 mdfy_list를 호출 (매개변수 없음)
// id, title, status가 포함된 문서 배열을 반환`,
  },
  {
    id: "mdfy-publish",
    name: "mdfy_publish",
    desc: "문서를 임시 저장(비공개)과 게시(공개) 상태 간에 전환합니다.",
    params: [
      { name: "id", type: "string", required: true, desc: "문서 ID." },
      { name: "isDraft", type: "boolean", required: true, desc: "true이면 임시 저장, false이면 게시." },
    ],
    example: `// "abc123 문서를 공개해줘"

// Claude가 mdfy_publish를 호출:
{ "id": "abc123", "isDraft": false }`,
  },
  {
    id: "mdfy-delete",
    name: "mdfy_delete",
    desc: "문서를 소프트 삭제합니다. 소유자가 복원할 수 있습니다.",
    params: [
      { name: "id", type: "string", required: true, desc: "문서 ID." },
    ],
    example: `// "오래된 임시 저장을 삭제해줘"

// Claude가 mdfy_delete를 호출:
{ "id": "abc123" }`,
  },
];

export default function McpDocsPageKo() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav lang="ko" />

      <div className="docs-layout">
        <DocsSidebar
          items={sidebarItems}
          currentPath="/ko/docs/mcp"
        />

        {/* MAIN */}
        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          <p style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontFamily: mono }}>MCP</p>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 16px" }}>
            MCP Server
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32, maxWidth: 640 }}>
            Claude, Cursor, Windsurf 및 기타 AI 도구에서 memory.wiki 문서를 직접 생성하고 관리할 수 있습니다.
          </p>

          {/* Memory Layer 소개 */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--accent-dim)", borderRadius: 14, padding: "28px 24px", marginBottom: 40 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>
              AI 에이전트를 위한 MCP-native memory layer.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.7 }}>
              오늘 mdfy URL을 컨텍스트로 읽고, Phase 2에서 MCP를 통해 메모리를 기록합니다.
            </p>
            <div className="about-grid-2" style={{ gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", margin: "0 0 8px" }}>
                  오늘 <span className="live-badge">Live</span>
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  <li style={{ padding: "3px 0" }}>mdfy URL을 AI 컨텍스트로 읽기</li>
                  <li style={{ padding: "3px 0" }}>25개 MCP 도구를 통한 문서 CRUD</li>
                  <li style={{ padding: "3px 0" }}>자동 소스 감지</li>
                </ul>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", margin: "0 0 8px" }}>
                  출시 예정 <span className="coming-soon-badge">Q2 2026</span>
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13, color: "var(--text-faint)" }}>
                  <li style={{ padding: "3px 0" }}>메모리 쓰기 접근</li>
                  <li style={{ padding: "3px 0" }}>번들 배포</li>
                  <li style={{ padding: "3px 0" }}>멀티 에이전트 메모리 공유</li>
                  <li style={{ padding: "3px 0" }}>실시간 번들 동기화</li>
                </ul>
              </div>
            </div>
          </div>

          {/* MCP란 */}
          <SectionHeading id="what-is-mcp">MCP란</SectionHeading>
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.8, margin: 0 }}>
              <strong style={{ color: "var(--text-primary)" }}>Model Context Protocol (MCP)</strong>은 AI 어시스턴트가
              외부 도구 및 서비스와 상호작용할 수 있게 하는 개방형 표준입니다. mdfy MCP 서버는
              7개 카테고리에 걸쳐 25개 도구를 제공합니다 -- 핵심 CRUD, append/prepend, 섹션 편집, 공유 설정,
              버전 이력, 폴더, 통계. <InlineCode>{"https://memory.wiki/api/mcp"}</InlineCode>의 호스팅 엔드포인트는
              모든 MCP 호환 클라이언트(Claude Web, Cursor 등)에서 사용할 수 있습니다.
            </p>
          </Card>

          {/* Claude Web -- 호스팅 */}
          <SectionHeading id="claude-web">Claude Web (호스팅 MCP)</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            호스팅 MCP 엔드포인트를 통해 <strong style={{ color: "var(--text-primary)" }}>claude.ai</strong>에서 바로 memory.wiki를 사용할 수 있습니다 -- 로컬 설치가 필요 없습니다.
          </p>
          <Card>
            <SubLabel>엔드포인트 URL</SubLabel>
            <CodeBlock>{`https://memory.wiki/api/mcp`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 16, marginBottom: 8, lineHeight: 1.7 }}>
              Claude.ai에서 <strong style={{ color: "var(--text-muted)" }}>Settings &rarr; Integrations / Connectors</strong> &rarr; Add custom MCP server &rarr; 위 URL을 붙여넣기 합니다.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0, lineHeight: 1.7 }}>
              같은 호스팅 엔드포인트가 원격 HTTP MCP를 지원하는 모든 MCP 호환 클라이언트(Cursor, ChatGPT, Gemini 등)에서 동작합니다.
            </p>
          </Card>

          {/* 로컬 설치 */}
          <SectionHeading id="installation">로컬 설치</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            로컬 stdio 기반 클라이언트(Claude Desktop, Claude Code, Cursor stdio 모드)의 경우, npm 패키지를 설치합니다:
          </p>
          <Card>
            <CodeBlock lang="bash">{`npm install -g mdfy-cli && mdfy login`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0, lineHeight: 1.7 }}>
              MCP 서버는 <InlineCode>{"mdfy login"}</InlineCode>의 JWT 인증을 사용합니다. 환경 변수 설정이 필요 없습니다.
            </p>
          </Card>

          {/* Claude Code */}
          <SectionHeading id="claude-code">Claude Code 설정</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            프로젝트 루트의 <InlineCode>{".mcp.json"}</InlineCode>에 추가합니다:
          </p>
          <Card>
            <CodeBlock lang="json">{`{
  "mcpServers": {
    "mdfy": {
      "command": "npx",
      "args": ["mdfy-mcp"]
    }
  }
}`}</CodeBlock>
          </Card>

          {/* Claude Desktop */}
          <SectionHeading id="claude-desktop">Claude Desktop 설정</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            <InlineCode>{"claude_desktop_config.json"}</InlineCode>에 추가합니다:
          </p>
          <Card>
            <SubLabel>macOS</SubLabel>
            <p style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)", margin: "0 0 12px" }}>
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </p>
            <SubLabel>Windows</SubLabel>
            <p style={{ fontSize: 12, fontFamily: mono, color: "var(--text-faint)", margin: "0 0 12px" }}>
              %APPDATA%\Claude\claude_desktop_config.json
            </p>
            <CodeBlock lang="json">{`{
  "mcpServers": {
    "mdfy": {
      "command": "npx",
      "args": ["mdfy-mcp"]
    }
  }
}`}</CodeBlock>
          </Card>

          {/* Cursor / Windsurf */}
          <SectionHeading id="cursor">Cursor / Windsurf</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Cursor와 Windsurf 모두 MCP를 지원합니다. 호스팅 HTTP 엔드포인트 또는 npm 패키지를 사용합니다.
          </p>
          <Card>
            <SubLabel>Cursor -- Settings &rarr; MCP &rarr; Add new global MCP server</SubLabel>
            <CodeBlock lang="json">{`{
  "mcpServers": {
    "mdfy": {
      "url": "https://memory.wiki/api/mcp"
    }
  }
}`}</CodeBlock>
          </Card>

          {/* 도구 */}
          <SectionHeading id="tools">전체 25개 도구</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            호스팅 MCP는 7개 카테고리에 걸쳐 25개 도구를 제공합니다.
            인증은 사용자의 memory.wiki 세션을 통해 이루어집니다 (API 키 불필요).
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 8, marginBottom: 24 }}>
            {[
              { cat: "핵심 CRUD", tools: ["mdfy_create", "mdfy_read", "mdfy_update", "mdfy_delete", "mdfy_list", "mdfy_search"] },
              { cat: "Append/Prepend", tools: ["mdfy_append", "mdfy_prepend"] },
              { cat: "섹션", tools: ["mdfy_outline", "mdfy_extract_section", "mdfy_replace_section"] },
              { cat: "복제/가져오기", tools: ["mdfy_duplicate", "mdfy_import_url"] },
              { cat: "공유", tools: ["mdfy_publish", "mdfy_set_password", "mdfy_set_expiry", "mdfy_set_allowed_emails", "mdfy_get_share_url"] },
              { cat: "버전", tools: ["mdfy_versions", "mdfy_restore_version", "mdfy_diff"] },
              { cat: "통계/폴더", tools: ["mdfy_stats", "mdfy_recent", "mdfy_folder_list", "mdfy_folder_create", "mdfy_move_to_folder"] },
            ].map((g) => (
              <div key={g.cat} style={{ background: "var(--surface)", padding: "12px 14px", borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{g.cat}</div>
                {g.tools.map((t) => (
                  <code key={t} style={{ display: "block", fontSize: 12, fontFamily: mono, color: "var(--accent)", padding: "2px 0" }}>{t}</code>
                ))}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-faint)", lineHeight: 1.7, marginBottom: 24 }}>
            아래에 핵심 6개 도구의 상세 매개변수를 설명합니다. 나머지 19개도 같은 패턴을 따르며, 호출 시 AI가 도구 설명에서 인자를 자동 완성합니다.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              gap: 12,
              marginBottom: 32,
            }}
          >
            {tools.map((tool) => (
              <a
                key={tool.name}
                href={`#${tool.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background: "var(--surface)",
                    borderRadius: 10,
                    padding: "16px 18px",
                    height: "100%",
                  }}
                >
                  <code style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: "var(--accent)" }}>{tool.name}</code>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>{tool.desc}</p>
                </div>
              </a>
            ))}
          </div>

          {/* 개별 도구 */}
          {tools.map((tool) => (
            <div key={tool.id} id={tool.id} style={{ scrollMarginTop: 80, marginBottom: 32 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                <code style={{ fontFamily: mono, color: "var(--accent)" }}>{tool.name}</code>
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>{tool.desc}</p>
              <Card>
                {tool.params.length > 0 && (
                  <>
                    <SubLabel>매개변수</SubLabel>
                    <div style={{ marginBottom: 16 }}>
                      {tool.params.map((p) => (
                        <ParamRow key={p.name} name={p.name} type={p.type} required={p.required}>
                          {p.desc}
                        </ParamRow>
                      ))}
                    </div>
                  </>
                )}
                <SubLabel>예시</SubLabel>
                <CodeBlock>{tool.example}</CodeBlock>
              </Card>
            </div>
          ))}

          {/* 사용 예시 */}
          <SectionHeading id="examples">사용 예시</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <SubLabel>문서 게시</SubLabel>
              <CodeBlock>{`You: "WebAssembly에 대한 블로그 글을 써서 memory.wiki에 게시해줘"

Claude: 블로그 글을 작성하고 게시하겠습니다.

[Claude가 내용을 작성한 후 mdfy_create를 호출]

완료! 블로그 글이 https://memory.wiki/abc123 에 게시되었습니다.`}</CodeBlock>
            </Card>

            <Card>
              <SubLabel>수정 반영</SubLabel>
              <CodeBlock>{`You: "memory.wiki/abc123 문서에 벤치마크 섹션을 추가해줘"

Claude: 현재 문서를 읽고 벤치마크 섹션을 추가하겠습니다.

[Claude가 mdfy_read를 호출한 후 mdfy_update로 새 내용을 반영]

업데이트 완료! 문서에 벤치마크 섹션이 추가되었습니다.`}</CodeBlock>
            </Card>

            <Card>
              <SubLabel>문서 관리</SubLabel>
              <CodeBlock>{`You: "내 최근 문서를 보여주고 오래된 임시 저장을 삭제해줘"

Claude: 문서 목록을 확인하겠습니다.

[Claude가 mdfy_list를 호출]

5개의 문서가 있습니다:
1. "API Guide" (게시됨) - 2시간 전 수정
2. "Draft notes" (임시 저장) - 3일 전 수정
3. "Old meeting notes" (임시 저장) - 2주 전 수정

오래된 임시 저장(#2, #3)을 삭제할까요?

You: "네"

[Claude가 각각에 대해 mdfy_delete를 호출]

완료! 2개의 문서가 삭제되었습니다.`}</CodeBlock>
            </Card>
          </div>
        </main>
      </div>

      <DocsFooter breadcrumb="MCP Server" lang="ko" />
    </div>
  );
}
