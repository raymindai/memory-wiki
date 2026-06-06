"use client";

/**
 * /install — fast-track install reference, one section per channel.
 *
 * Single 880px reading column. Each channel is a horizontal section:
 *   number + brand icon + title  ─────────  download CTA
 *                                  blurb
 *                                  PureCodeBlock (real install command)
 *                                  full-guide link
 *
 * /plugins is the deep walkthrough with feature grids; /install is the
 * "I just want the line, give it to me" reference. Channels without a
 * one-line install (Chrome, Desktop, Bookmarklet) skip the code block
 * entirely — the download button IS the action.
 */

import Link from "next/link";
import "./install.css";
import {
  PureCodeBlock,
  ProviderIcon,
  type ProviderBrand,
} from "@/components/pure";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";

const MCP_CONFIG_JSON = `{
  "mcpServers": {
    "memory-wiki": {
      "command": "npx",
      "args": ["-y", "memory-wiki-mcp"]
    }
  }
}`;

interface ChannelProps {
  id: string;
  num: string;
  brand: ProviderBrand;
  title: string;
  blurb: string;
  codeBlocks?: { code: string; lang: string }[];
  note?: string;
  download?: { label: string; href: string };
  guide: { label: string; href: string };
}

function Channel(c: ChannelProps) {
  return (
    <section className="pure-install-section" id={c.id}>
      <header className="pure-install-section-head">
        <div className="pure-install-section-meta">
          <span className="pure-install-section-num mono">{c.num}</span>
          <span className="pure-install-section-icon" aria-hidden>
            <ProviderIcon brand={c.brand} />
          </span>
          <h2 className="pure-install-section-title">{c.title}</h2>
        </div>
        {c.download && (
          <a href={c.download.href} className="pure-install-section-download">
            {c.download.label}
          </a>
        )}
      </header>
      <p className="pure-install-section-blurb">{c.blurb}</p>
      {c.codeBlocks && c.codeBlocks.length > 0 && (
        <div className="pure-install-section-code">
          {c.codeBlocks.map((b, i) => (
            <PureCodeBlock key={i} code={b.code} lang={b.lang} />
          ))}
        </div>
      )}
      {c.note && <p className="pure-install-section-note">{c.note}</p>}
      <Link href={c.guide.href} className="pure-install-section-guide mono">
        {c.guide.label} <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

export default function InstallPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const isKo = locale === "ko";
  const pluginsBase = isKo ? "/ko/plugins" : "/plugins";

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/install" : "/install"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={[
        { id: "cli",         label: "CLI" },
        { id: "mcp",         label: isKo ? "MCP 서버"        : "MCP server" },
        { id: "vscode",      label: isKo ? "VS Code 확장"    : "VS Code extension" },
        { id: "chrome",      label: isKo ? "Chrome 확장"     : "Chrome extension" },
        { id: "desktop",     label: isKo ? "Mac 데스크톱"    : "Mac desktop" },
        { id: "bookmarklet", label: isKo ? "북마클릿"        : "Bookmarklet" },
      ]}
    >
          <div className="pure-install-page">
            {/* Hero */}
            <section className="pure-install-hero">
              <div className="pure-install-eyebrow mono">{isKo ? "설치" : "Install"}</div>
              <h1 className="pure-install-h1">
                {isKo ? "도구 셋업." : "Set up your tools."}
              </h1>
              <p className="pure-install-lede">
                {isKo
                  ? "사용하는 채널만 고르세요. 채널당 한 줄. 설치 후, 허브 URL을 어떤 AI에든 paste하면 모든 곳에서 같은 컨텍스트."
                  : "Pick the channels you use. One line each. After install, paste your hub URL into any AI for the same context everywhere."}
              </p>
            </section>

            <div className="pure-install-stack">
              {/* 01 — CLI */}
              <Channel
                id="cli"
                num="01"
                brand="cli"
                title={isKo ? "CLI" : "CLI"}
                blurb={isKo
                  ? "터미널에서 마크다운 파일을 발행, 검색, 동기화. mw 명령어로 즉시 URL 생성."
                  : "Publish, search, and sync Markdown files from the terminal. The mw command turns any file into a URL."}
                codeBlocks={[
                  { code: "npm install -g memory-wiki-cli", lang: "bash" },
                  { code: "mw login", lang: "bash" },
                ]}
                download={{
                  label: "npm, v1.4.3",
                  href: "https://www.npmjs.com/package/memory-wiki-cli",
                }}
                guide={{
                  label: isKo ? "CLI 가이드" : "CLI guide",
                  href: isKo ? "/ko/docs/cli" : "/docs/cli",
                }}
              />

              {/* 02 — MCP */}
              <Channel
                id="mcp"
                num="02"
                brand="mcp"
                title={isKo ? "MCP 서버" : "MCP server"}
                blurb={isKo
                  ? "Claude Code, Cursor, Codex, Windsurf 등 MCP 호환 도구에 연결. 28개 툴 (read, write, search, append, version) 즉시 사용."
                  : "Plugs into Claude Code, Cursor, Codex, Windsurf, and any MCP-compatible tool. 29 tools (read, write, search, append, version, hub + bundle constellations) ready to use."}
                codeBlocks={[{ code: MCP_CONFIG_JSON, lang: "json" }]}
                note={isKo
                  ? "위 블록을 도구의 MCP config에 추가 (Claude Code는 ~/.claude/mcp.json, Cursor는 Settings → MCP)."
                  : "Add the block above to your tool’s MCP config (~/.claude/mcp.json for Claude Code, Settings → MCP for Cursor)."}
                download={{
                  label: "npm, memory-wiki-mcp v1.5.4",
                  href: "https://www.npmjs.com/package/memory-wiki-mcp",
                }}
                guide={{
                  label: isKo ? "MCP 셋업 가이드" : "MCP setup guide",
                  href: isKo ? "/ko/docs/mcp" : "/docs/mcp",
                }}
              />

              {/* 03 — VS Code */}
              <Channel
                id="vscode"
                num="03"
                brand="vscode"
                title={isKo ? "VS Code 확장" : "VS Code extension"}
                blurb={isKo
                  ? "사이드바에서 클라우드 문서 (public, shared, private, view-only) 둘러보고 별표, 양방향 sync, WYSIWYG 프리뷰. 한 번 발행하면 Claude, ChatGPT, Cursor가 같은 URL을 그대로 읽음."
                  : "Sidebar to your cloud docs (public, shared, private, view-only) with starring, two-way sync, and WYSIWYG preview. Publish once and Claude, ChatGPT, Cursor read the same URL."}
                codeBlocks={[
                  { code: "code --install-extension raymindai.memory-wiki-vscode", lang: "bash" },
                ]}
                download={{
                  label: "Marketplace, v1.4.26",
                  href: "https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode",
                }}
                guide={{
                  label: isKo ? "VS Code 가이드" : "VS Code guide",
                  href: pluginsBase + "#vscode",
                }}
              />

              {/* 04 — Chrome */}
              <Channel
                id="chrome"
                num="04"
                brand="chrome"
                title={isKo ? "Chrome 확장" : "Chrome extension"}
                blurb={isKo
                  ? "ChatGPT, Claude, Gemini 등 AI 채팅 페이지에서 한 번 클릭으로 대화 캡처 → 영구 URL."
                  : "One click on ChatGPT, Claude, Gemini — capture the conversation into a permanent URL."}
                note={isKo
                  ? "다운로드 후 chrome://extensions → 개발자 모드 켜기 → 압축해제된 확장 프로그램 로드."
                  : "After downloading, open chrome://extensions → enable Developer mode → Load unpacked."}
                download={{
                  label: isKo ? "다운로드 v2.2.2 · 50 KB" : "Download v2.2.2 · 50 KB",
                  href: "/downloads/mw-chrome-extension-v2.2.2.zip",
                }}
                guide={{
                  label: isKo ? "Chrome 가이드" : "Chrome guide",
                  href: pluginsBase + "#chrome",
                }}
              />

              {/* 05 — Desktop */}
              <Channel
                id="desktop"
                num="05"
                brand="mac"
                title={isKo ? "memory.wiki for Mac" : "memory.wiki for Mac"}
                blurb={isKo
                  ? "네이티브 사이드바, 폴더, 오프라인 편집. Apple Silicon + Developer ID 사인 + notarize."
                  : "Native sidebar, folders, offline edit. Apple Silicon + Developer ID signed + notarized."}
                note={isKo
                  ? "DMG 더블클릭 후 /Applications 폴더로 드래그하면 끝."
                  : "Double-click the DMG and drag the app into /Applications."}
                download={{
                  label: isKo ? "DMG 다운로드 v2.3.5" : "Download DMG v2.3.5",
                  href: "https://github.com/raymindai/memory-wiki/releases/latest",
                }}
                guide={{
                  label: isKo ? "데스크톱 가이드" : "Desktop guide",
                  href: pluginsBase + "#desktop",
                }}
              />

              {/* 06 — Bookmarklet */}
              <Channel
                id="bookmarklet"
                num="06"
                brand="terminal"
                title={isKo ? "북마클릿" : "Bookmarklet"}
                blurb={isKo
                  ? "설치 없음. 북마크 바에 버튼 하나 드래그하면 어떤 AI 채팅에서든 한 번 클릭으로 캡처."
                  : "No install. Drag one button to your bookmarks bar — one click captures any AI chat."}
                guide={{
                  label: isKo ? "북마클릿 페이지" : "Bookmarklet page",
                  href: isKo ? "/ko/bookmarklet" : "/bookmarklet",
                }}
              />
            </div>

            {/* Hub URL — the one-paste hint */}
            <section className="pure-install-hub">
              <h2 className="pure-install-hub-h2">
                {isKo ? "설치 후 사용법" : "After you install"}
              </h2>
              <p className="pure-install-hub-line">
                {isKo
                  ? "캡처한 모든 문서가 한 허브 URL에 모입니다. 그 URL을 어떤 AI에든 paste:"
                  : "Everything you capture lands on a single hub URL. Paste it into any AI:"}
              </p>
              <PureCodeBlock code="https://memory.wiki/@you" lang="text" />
              <p className="pure-install-hub-foot">
                {isKo ? (
                  <>흐름을 보고 싶으면{" "}
                  <Link href="/ko/how">동작 원리</Link>
                  {" "}/ 데이터를 보고 싶으면{" "}
                  <Link href="/ko/benchmark">벤치마크/Eval</Link>.</>
                ) : (
                  <>See the full flow in{" "}
                  <Link href="/how">how it works</Link>
                  {" "}/ see the data in the{" "}
                  <Link href="/benchmark">benchmark/eval</Link>.</>
                )}
              </p>
            </section>
          </div>
    </PureDocsShell>
  );
}
