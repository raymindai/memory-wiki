"use client";

import Link from "next/link";
import PureDocsShell from "@/components/PureDocsShell";
import { PureCodeBlock } from "@/components/pure";
import "./docs-home.css";

type Locale = "en" | "ko";

const COPY = {
  en: {
    eyebrow: "Developer docs",
    title: "Documentation.",
    intro: "The publishing API for developers. Create, manage, and share Markdown documents programmatically.",
    metaLabel: "Base URL",
    quickStartHeading: "Quick start",
    quickStart: [
      { tag: "curl",     title: "REST API",                    desc: "Create, read, update, and delete documents with HTTP requests.", href: "/docs/api" },
      { tag: "terminal", title: "CLI",                         desc: "Publish from the command line. Pipe stdin, capture tmux panes.", href: "/docs/cli" },
      { tag: "MCP",      title: "MCP Server",                  desc: "Hosted HTTP endpoint for Claude Web + npm package for Claude Desktop, Cursor, Windsurf.", href: "/docs/mcp" },
      { tag: "context",  title: "Integrate with AI dev tools", desc: "One line in AGENTS.md / CLAUDE.md / .cursor/rules and Claude Code, Cursor, Codex read your hub or bundle as context.", href: "/docs/integrate" },
    ],
    cardCta: "View docs",
    tryItHeading: "Try it",
    tryItBody: "Publish your first document in under 30 seconds. No authentication required.",
    exploreHeading: "Explore",
    explore: [
      { title: "Import surfaces",       desc: "Pull markdown from GitHub repos, Notion pages, Obsidian vaults, or any web URL into your hub.", href: "/docs/api#post-import-github" },
      { title: "Hub recall + reranker", desc: "Semantic + keyword search over a hub's public docs. Optional Haiku-based cross-encoder rerank.", href: "/docs/api#post-hub-recall" },
      { title: "Hub manifests",         desc: "Every public hub auto-publishes index.md, SCHEMA.md, log.md, and llms.txt — AI-discoverable.", href: "/docs/api#raw-and-llms" },
      { title: "Related docs",          desc: "Owner-only concept-overlap recommendation per doc. Surfaces cross-doc connections automatically.", href: "/docs/api#get-related" },
      { title: "Publish from AI",       desc: "Claude (MCP), ChatGPT (Custom GPT), Chrome Extension. Say \"publish this\" in any AI.", href: "https://chatgpt.com/g/g-69e2832dd74081919c09a9f8d03adc59-mdfy-publish-documents" },
      { title: "Integrations",          desc: "VS Code, Mac Desktop, Chrome Extension, CLI, MCP Server, and macOS QuickLook (bundled with Desktop).", href: "/plugins" },
      { title: "Authentication",        desc: "Edit tokens, user identity headers, OAuth bearer tokens.", href: "/docs/api#authentication" },
    ],
    llmsTxtPrefix: "For AI consumption, see",
  },
  ko: {
    eyebrow: "개발자 문서",
    title: "문서.",
    intro: "개발자를 위한 퍼블리싱 API. 마크다운 문서를 프로그래밍 방식으로 생성, 관리, 공유합니다.",
    metaLabel: "Base URL",
    quickStartHeading: "Quick start",
    quickStart: [
      { tag: "curl",     title: "REST API",                desc: "HTTP 요청으로 문서를 생성/조회/수정/삭제합니다.", href: "/ko/docs/api" },
      { tag: "terminal", title: "CLI",                     desc: "터미널에서 퍼블리시. stdin 파이프, tmux 패인 캡처.", href: "/ko/docs/cli" },
      { tag: "MCP",      title: "MCP 서버",                 desc: "Claude Web용 호스팅 HTTP + Claude Desktop / Cursor / Windsurf용 npm 패키지.", href: "/ko/docs/mcp" },
      { tag: "context",  title: "AI 개발 도구에 통합", desc: "AGENTS.md / CLAUDE.md / .cursor/rules 한 줄이면 Claude Code, Cursor, Codex가 당신의 hub나 bundle을 컨텍스트로 읽습니다.", href: "/ko/docs/integrate" },
    ],
    cardCta: "문서 보기",
    tryItHeading: "Try it",
    tryItBody: "30초 안에 첫 문서를 퍼블리시하세요. 인증 불필요.",
    exploreHeading: "Explore",
    explore: [
      { title: "임포트 surface",  desc: "GitHub 저장소, Notion 페이지, Obsidian vault, 또는 어떤 웹 URL이든 마크다운으로 hub에 가져옵니다.", href: "/ko/docs/api#post-import-github" },
      { title: "Hub recall + 리랭커", desc: "Hub의 공개 문서 대상 semantic + 키워드 검색. 선택적 Haiku 기반 cross-encoder rerank.", href: "/ko/docs/api#post-hub-recall" },
      { title: "Hub manifests",  desc: "모든 공개 hub가 index.md, SCHEMA.md, log.md, llms.txt를 자동 퍼블리시 — AI가 발견 가능.", href: "/ko/docs/api#raw-and-llms" },
      { title: "관련 문서",       desc: "문서당 owner-only concept-overlap 추천. 문서 간 연결을 자동으로 표면화.", href: "/ko/docs/api#get-related" },
      { title: "AI에서 퍼블리시", desc: "Claude (MCP), ChatGPT (Custom GPT), Chrome Extension. 어떤 AI에서든 \"이거 퍼블리시\" 한 마디로.", href: "https://chatgpt.com/g/g-69e2832dd74081919c09a9f8d03adc59-mdfy-publish-documents" },
      { title: "Integrations",   desc: "VS Code, Mac Desktop, Chrome Extension, CLI, MCP Server, macOS QuickLook (Desktop에 번들).", href: "/ko/plugins" },
      { title: "인증",            desc: "Edit token, user identity header, OAuth bearer token.", href: "/ko/docs/api#authentication" },
    ],
    llmsTxtPrefix: "AI 소비용은 다음 참조:",
  },
} as const;

const FIRST_DOC = `curl -X POST https://memory.wiki/api/docs \\
  -H "Content-Type: application/json" \\
  -d '{"markdown": "# Hello World\\nPublished via API.", "isDraft": false}'

# Response:
# { "id": "abc123", "editToken": "tok_...", "created_at": "..." }
# View at: https://memory.wiki/abc123`;

export default function DocsHomePure({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <PureDocsShell
      locale={locale}
      currentPath={locale === "ko" ? "/ko/docs" : "/docs"}
      toc={[
        { id: "quick-start", label: t.quickStartHeading },
        { id: "try-it",      label: t.tryItHeading },
        { id: "explore",     label: t.exploreHeading },
      ]}
    >
      {/* Hero */}
      <div className="pure-docs-eyebrow mono">{t.eyebrow}</div>
      <h1 className="pure-docs-title">{t.title}</h1>
      <p className="pure-docs-intro">{t.intro}</p>
      <p className="pure-docs-meta mono">
        {t.metaLabel}: <code>https://memory.wiki</code>
      </p>

      {/* Quick start */}
      <section id="quick-start" className="pure-docs-section">
        <div className="pure-docs-section-eyebrow mono">{t.quickStartHeading}</div>
        <div className="pure-docs-card-grid">
          {t.quickStart.map((c, i) => (
            <Link key={c.title} href={c.href} className="pure-docs-card">
              <div className="pure-docs-card-tag mono">{c.tag}</div>
              <h3 className="pure-docs-card-title">{c.title}</h3>
              <p className="pure-docs-card-desc">{c.desc}</p>
              <span className="pure-docs-card-cta mono">{t.cardCta} <span aria-hidden>→</span></span>
              <span className="pure-docs-card-num mono" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Try it */}
      <section id="try-it" className="pure-docs-section">
        <div className="pure-docs-section-eyebrow mono">{t.tryItHeading}</div>
        <p className="pure-docs-body">{t.tryItBody}</p>
        <PureCodeBlock code={FIRST_DOC} lang="bash" />
      </section>

      {/* Explore */}
      <section id="explore" className="pure-docs-section">
        <div className="pure-docs-section-eyebrow mono">{t.exploreHeading}</div>
        <div className="pure-docs-explore-grid">
          {t.explore.map((c) => (
            <Link key={c.title} href={c.href} className="pure-docs-explore-card">
              <h3 className="pure-docs-explore-title">{c.title}</h3>
              <p className="pure-docs-explore-desc">{c.desc}</p>
            </Link>
          ))}
        </div>
        <p className="pure-docs-llmstxt mono">
          {t.llmsTxtPrefix}{" "}
          <Link href={locale === "ko" ? "/ko/docs/llms.txt" : "/docs/llms.txt"} className="pure-docs-llmstxt-link">
            /docs/llms.txt
          </Link>
        </p>
      </section>
    </PureDocsShell>
  );
}
