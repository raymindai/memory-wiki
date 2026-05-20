import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, InlineCode, DocsNav, SiteFooter, mono } from "@/components/docs";

export const metadata: Metadata = {
  title: "문서 — Memory.Wiki",
  description:
    "Memory.Wiki 개발자 문서. REST API, CLI, JavaScript SDK, MCP 서버로 마크다운 문서를 프로그래밍 방식으로 생성, 관리, 공유하세요.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs",
    languages: { en: "https://memory.wiki/docs" },
  },
  openGraph: {
    title: "문서 — Memory.Wiki",
    description:
      "개발자 문서. REST API, CLI, SDK, MCP Server.",
    url: "https://memory.wiki/ko/docs",
    images: [{ url: "/api/og?title=Documentation", width: 1200, height: 630 }],
  },
};

/* ────────────────────────────────────────────────────────────
   Data
   ──────────────────────────────────────────────────────────── */

const quickStartCards = [
  {
    tag: "curl",
    title: "REST API",
    desc: "HTTP 요청으로 문서를 생성, 조회, 수정, 삭제합니다.",
    href: "/ko/docs/api",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    tag: "terminal",
    title: "CLI",
    desc: "커맨드 라인에서 퍼블리시. stdin 파이프, tmux 캡처 지원.",
    href: "/ko/docs/cli",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
  },
  {
    tag: "MCP",
    title: "MCP Server",
    desc: "Claude Web용 HTTP 엔드포인트 및 Claude Desktop, Cursor, Windsurf용 npm 패키지.",
    href: "/ko/docs/mcp",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    tag: "context",
    title: "AI 개발 도구와 연결",
    desc: "AGENTS.md / CLAUDE.md / .cursor/rules 에 한 줄. Claude Code, Cursor, Codex 가 당신의 hub 또는 bundle 을 컨텍스트로 읽음.",
    href: "/ko/docs/integrate",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
];

const exploreCards = [
  {
    title: "AI에서 퍼블리시",
    desc: "Claude (MCP), ChatGPT (Custom GPT), Chrome Extension. 어떤 AI에서든 \"이거 퍼블리시해줘\"라고 말하세요.",
    href: "https://chatgpt.com/g/g-69e2832dd74081919c09a9f8d03adc59-mdfy-publish-documents",
  },
  {
    title: "통합 도구",
    desc: "VS Code, Mac Desktop, Chrome Extension, CLI, MCP Server, macOS QuickLook (Desktop에 번들).",
    href: "/ko/plugins",
  },
  {
    title: "인증",
    desc: "Edit 토큰, 사용자 식별 헤더, OAuth Bearer 토큰.",
    href: "/ko/docs/api#authentication",
  },
];

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function DocsPageKo() {
  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <DocsNav lang="ko" />

      {/* ───────── HERO ───────── */}
      <section
        style={{
          position: "relative",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "100px 24px 80px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(251,146,60,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        <p
          style={{
            color: "var(--accent)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 20,
            fontFamily: mono,
          }}
        >
          개발자 문서
        </p>

        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            maxWidth: 720,
            margin: 0,
          }}
        >
          문서
        </h1>

        <p
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: "var(--text-tertiary)",
            maxWidth: 640,
            marginTop: 28,
          }}
        >
          개발자를 위한 퍼블리싱 API. 마크다운 문서를 프로그래밍 방식으로
          생성, 관리, 공유하세요.
        </p>

        <p
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            marginTop: 16,
            fontFamily: mono,
          }}
        >
          기본 URL: <InlineCode>{"https://memory.wiki"}</InlineCode>
        </p>
      </section>

      {/* ───────── DOCS HERO — API EXAMPLE ───────── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 60px" }}>
        <div className="terminal-mock">
          <div className="terminal-mock-bar">
            <span className="terminal-mock-dot red" />
            <span className="terminal-mock-dot yellow" />
            <span className="terminal-mock-dot green" />
            <span className="terminal-mock-title">Terminal</span>
          </div>
          <div className="terminal-mock-body">
            <span className="line comment">{"# Create a document"}</span>
            <span className="line"><span className="prompt">$ </span><span className="cmd">{"curl -X POST https://memory.wiki/api/docs \\"}</span></span>
            <span className="line"><span className="cmd">{"  -H 'Content-Type: application/json' \\"}</span></span>
            <span className="line"><span className="cmd">{"  -d '{\"markdown\": \"# Hello World\"}'"}</span></span>
            <span className="line-gap" />
            <span className="line"><span className="output">{`{`}</span></span>
            <span className="line"><span className="output">{"  \"id\": "}</span><span className="url">{`"abc123"`}</span><span className="output">,</span></span>
            <span className="line"><span className="output">{"  \"url\": "}</span><span className="url">{`"https://memory.wiki/abc123"`}</span><span className="output">,</span></span>
            <span className="line"><span className="output">{"  \"editToken\": \"eyJ...\""}</span></span>
            <span className="line"><span className="output">{`}`}</span></span>
          </div>
        </div>
      </section>

      {/* ───────── QUICK START ───────── */}
      <section
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 32,
            fontFamily: mono,
          }}
        >
          시작하기
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: 16,
          }}
        >
          {quickStartCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: 14,
                  padding: "28px 24px",
                  height: "100%",
                  transition: "border-color 0.15s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "var(--accent-dim)",
                    }}
                  >
                    {card.icon}
                  </span>
                  <div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: mono,
                        color: "var(--text-faint)",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {card.tag}
                    </span>
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        margin: 0,
                      }}
                    >
                      {card.title}
                    </p>
                  </div>
                </div>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {card.desc}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 16,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--accent)",
                    fontFamily: mono,
                  }}
                >
                  문서 보기 &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ───────── TRY IT ───────── */}
      <section
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 32,
            fontFamily: mono,
          }}
        >
          직접 해보기
        </h2>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-dim)",
            borderRadius: 14,
            padding: "28px 24px",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              marginTop: 0,
              marginBottom: 16,
              lineHeight: 1.7,
            }}
          >
            30초 안에 첫 문서를 퍼블리시하세요. 인증 필요 없음.
          </p>
          <CodeBlock lang="bash">{`curl -X POST https://memory.wiki/api/docs \\
  -H "Content-Type: application/json" \\
  -d '{"markdown": "# Hello World\\nPublished via API.", "isDraft": false}'

# Response:
# { "id": "abc123", "editToken": "tok_...", "created_at": "..." }
# View at: https://memory.wiki/abc123`}</CodeBlock>
        </div>
      </section>

      {/* ───────── EXPLORE ───────── */}
      <section
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 32,
            fontFamily: mono,
          }}
        >
          둘러보기
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: 16,
          }}
        >
          {exploreCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: 14,
                  padding: "24px",
                  height: "100%",
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginTop: 0,
                    marginBottom: 8,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {card.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--text-faint)",
            marginTop: 24,
            fontFamily: mono,
          }}
        >
          AI 활용 시{" "}
          <Link
            href="/docs/llms.txt"
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            /docs/llms.txt
          </Link>
          {" "}참조
        </p>
      </section>

      {/* ───────── FOOTER ───────── */}
      <SiteFooter lang="ko" />
    </div>
  );
}
