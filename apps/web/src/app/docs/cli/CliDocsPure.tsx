"use client";

/**
 * CLI docs — Pure design system. Wraps content in <PureDocsShell> and uses
 * <PureCodeBlock> for fenced code. Single component handles English + Korean
 * via the `locale` prop.
 */

import PureDocsShell from "@/components/PureDocsShell";
import { PureCodeBlock } from "@/components/pure";
import "./cli-docs.css";

type Locale = "en" | "ko";

// ─── Sidebar / on-this-page TOC ────────────────────────────────────────
const TOC_EN = [
  { id: "installation",   label: "Installation" },
  { id: "commands",       label: "Commands" },
  { id: "publish",        label: "publish" },
  { id: "update",         label: "update" },
  { id: "pull",           label: "pull" },
  { id: "delete",         label: "delete" },
  { id: "list",           label: "list" },
  { id: "open",           label: "open" },
  { id: "capture",        label: "capture" },
  { id: "auth-commands",  label: "Authentication" },
  { id: "pipes",          label: "Pipe Examples" },
  { id: "tmux",           label: "tmux Integration" },
  { id: "aliases",        label: "Shell Aliases" },
  { id: "config",         label: "Configuration" },
];
const TOC_KO = [
  { id: "installation",   label: "설치" },
  { id: "commands",       label: "명령어" },
  { id: "publish",        label: "publish" },
  { id: "update",         label: "update" },
  { id: "pull",           label: "pull" },
  { id: "delete",         label: "delete" },
  { id: "list",           label: "list" },
  { id: "open",           label: "open" },
  { id: "capture",        label: "capture" },
  { id: "auth-commands",  label: "인증" },
  { id: "pipes",          label: "파이프 예시" },
  { id: "tmux",           label: "tmux 연동" },
  { id: "aliases",        label: "Shell Aliases" },
  { id: "config",         label: "설정" },
];

// ─── Command tables (key + description per locale) ─────────────────────
const COMMANDS_EN = [
  { cmd: "mw publish <file>",       desc: "Publish a Markdown file or stdin to memory.wiki." },
  { cmd: "mw update <id> <file>",   desc: "Update an existing document with new content." },
  { cmd: "mw pull <id>",            desc: "Download a document's Markdown content." },
  { cmd: "mw delete <id>",          desc: "Soft-delete a document." },
  { cmd: "mw list",                 desc: "List all your documents." },
  { cmd: "mw open <id>",            desc: "Open a document in the browser." },
  { cmd: "mw capture",              desc: "Capture the current tmux pane and publish." },
  { cmd: "mw login",                desc: "Authenticate with memory.wiki." },
  { cmd: "mw logout",               desc: "Clear stored credentials." },
  { cmd: "mw whoami",               desc: "Show current authenticated user." },
];
const COMMANDS_KO = [
  { cmd: "mw publish <file>",       desc: "Markdown 파일 또는 stdin을 memory.wiki에 게시합니다." },
  { cmd: "mw update <id> <file>",   desc: "기존 문서를 새 내용으로 업데이트합니다." },
  { cmd: "mw pull <id>",            desc: "문서의 Markdown 내용을 다운로드합니다." },
  { cmd: "mw delete <id>",          desc: "문서를 소프트 삭제합니다." },
  { cmd: "mw list",                 desc: "내 모든 문서를 조회합니다." },
  { cmd: "mw open <id>",            desc: "브라우저에서 문서를 엽니다." },
  { cmd: "mw capture",              desc: "현재 tmux 패널을 캡처하여 게시합니다." },
  { cmd: "mw login",                desc: "memory.wiki에 인증합니다." },
  { cmd: "mw logout",               desc: "저장된 인증 정보를 삭제합니다." },
  { cmd: "mw whoami",               desc: "현재 인증된 사용자를 표시합니다." },
];

const PUBLISH_OPTIONS_EN = [
  { cmd: "--draft, -d",  desc: "Publish as draft (only visible to you)." },
  { cmd: "--title, -t",  desc: "Set document title." },
  { cmd: "--folder, -f", desc: "Place document in a folder (folder UUID)." },
  { cmd: "--open, -o",   desc: "Open in browser after publishing." },
];
const PUBLISH_OPTIONS_KO = [
  { cmd: "--draft, -d",    desc: "임시 저장으로 게시합니다 (본인만 볼 수 있음)." },
  { cmd: "--title, -t",    desc: "문서 제목을 설정합니다." },
  { cmd: "--password, -p", desc: "문서를 비밀번호로 보호합니다." },
  { cmd: "--expires, -e",  desc: "만료 시간 설정: 1h, 1d, 7d, 30d." },
  { cmd: "--open, -o",     desc: "게시 후 브라우저에서 엽니다." },
];

// ─── Code snippets ─────────────────────────────────────────────────────
const INSTALL_CODE = `npm install -g memory-wiki-cli`;

const PUBLISH_CODE_EN = `# Publish a file
mw publish README.md

# Publish from stdin
echo "# Hello World" | mw publish

# Publish as draft
mw publish README.md --draft

# Publish with title
mw publish README.md --title "My Document"

# Place in a specific folder
mw publish README.md --folder "folder-uuid"

# Open in browser after publishing
mw publish README.md --open`;

const PUBLISH_CODE_KO = `# 파일 게시
mw publish README.md

# stdin에서 게시
echo "# Hello World" | mw publish

# 임시 저장으로 게시
mw publish README.md --draft

# 제목 지정
mw publish README.md --title "My Document"

# 비밀번호 설정
mw publish README.md --password "secret"

# 만료 시간 설정
mw publish README.md --expires 7d`;

const UPDATE_CODE_EN = `# Update from file
mw update abc123 README.md

# Update from stdin
echo "# Updated" | mw update abc123

# Update with version note
mw update abc123 README.md --message "Fixed typos"`;

const UPDATE_CODE_KO = `# 파일로 업데이트
mw update abc123 README.md

# stdin으로 업데이트
echo "# Updated" | mw update abc123

# 버전 노트와 함께 업데이트
mw update abc123 README.md --message "Fixed typos"`;

const PULL_CODE_EN = `# Print to stdout
mw pull abc123

# Save to file
mw pull abc123 -o output.md`;

const PULL_CODE_KO = `# stdout으로 출력
mw pull abc123

# 파일로 저장
mw pull abc123 -o output.md

# 비밀번호 보호 문서 다운로드
mw pull abc123 --password "secret"`;

const DELETE_CODE = `mw delete abc123

# Skip confirmation
mw delete abc123 --yes`;

const LIST_CODE = `mw list

# Output:
#  ID       TITLE              UPDATED         STATUS
#  abc123   My Document        2 hours ago     published
#  def456   Draft Note         5 minutes ago   draft`;

const OPEN_CODE = `mw open abc123
# Opens https://memory.wiki/abc123 in your default browser`;

const CAPTURE_CODE_EN = `# Capture current pane
mw capture

# Capture specific pane
mw capture -t %3

# Capture last N lines
mw capture --lines 50`;

const CAPTURE_CODE_KO = `# 현재 패널 캡처
mw capture

# 특정 패널 캡처
mw capture -t %3

# 마지막 N줄 캡처
mw capture --lines 50`;

const AUTH_CODE_EN = `# Authenticate (opens browser for OAuth)
mw login

# Clear stored credentials
mw logout

# Show current user
mw whoami
# user@example.com (authenticated via OAuth)`;

const AUTH_CODE_KO = `# 인증 (브라우저에서 OAuth 진행)
mw login

# 저장된 인증 정보 삭제
mw logout

# 현재 사용자 확인
mw whoami
# user@example.com (authenticated via OAuth)`;

const PIPES_CODE_EN = `# Clipboard to memory.wiki
pbpaste | mw publish

# Command output
ls -la | mw publish

# Cat a file
cat report.md | mw publish

# Generate with AI, publish directly
claude "Write a guide to Rust" | mw publish

# Git diff
git diff | mw publish --title "Changes"

# Docker logs
docker logs my-app 2>&1 | mw publish

# Pipe through multiple commands
curl -s https://api.example.com/data | jq . | mw publish`;

const PIPES_CODE_KO = `# 클립보드를 memory.wiki로
pbpaste | mw publish

# 명령어 출력
ls -la | mw publish

# 파일 내용
cat report.md | mw publish

# AI로 생성 후 바로 게시
claude "Write a guide to Rust" | mw publish

# Git diff
git diff | mw publish --title "Changes"

# Docker 로그
docker logs my-app 2>&1 | mw publish

# 여러 명령어 파이프
curl -s https://api.example.com/data | jq . | mw publish`;

const TMUX_CODE_EN = `# Capture current pane
tmux capture-pane -p | mw publish

# Capture and share with one keybinding
# Add to ~/.tmux.conf:
bind-key M run-shell "tmux capture-pane -p | mw publish"

# Capture specific pane
tmux capture-pane -t %3 -p | mw publish

# Capture full scrollback
tmux capture-pane -p -S - | mw publish`;

const TMUX_CODE_KO = `# 현재 패널 캡처
tmux capture-pane -p | mw publish

# 단축키로 캡처 및 공유
# ~/.tmux.conf에 추가:
bind-key M run-shell "tmux capture-pane -p | mw publish"

# 특정 패널 캡처
tmux capture-pane -t %3 -p | mw publish

# 전체 스크롤백 캡처
tmux capture-pane -p -S - | mw publish`;

const ALIASES_CODE_EN = `# Add to ~/.zshrc or ~/.bashrc

# Quick publish
alias mp="mw publish"

# Publish clipboard
alias mpc="pbpaste | mw publish"

# Publish and open
alias mpo="mw publish --open"

# Capture tmux
alias mtx="tmux capture-pane -p | mw publish"`;

const ALIASES_CODE_KO = `# ~/.zshrc 또는 ~/.bashrc에 추가

# 빠른 게시
alias mp="mw publish"

# 클립보드 게시
alias mpc="pbpaste | mw publish"

# 게시 후 브라우저 열기
alias mpo="mw publish --open"

# tmux 캡처
alias mtx="tmux capture-pane -p | mw publish"`;

const CONFIG_CODE = `// ~/.memory.wiki/config.json
{
  "apiUrl": "https://memory.wiki",
  "email": "user@example.com",
  "token": "..."
}`;

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="pure-cli-docs-cmd-row">
      <code className="pure-cli-docs-cmd-name mono">{cmd}</code>
      <span className="pure-cli-docs-cmd-desc">{desc}</span>
    </div>
  );
}

export default function CliDocsPure({ locale = "en" }: { locale?: Locale }) {
  const ko = locale === "ko";
  const toc = ko ? TOC_KO : TOC_EN;
  const commands = ko ? COMMANDS_KO : COMMANDS_EN;
  const publishOptions = ko ? PUBLISH_OPTIONS_KO : PUBLISH_OPTIONS_EN;
  const currentPath = ko ? "/ko/docs/cli" : "/docs/cli";

  return (
    <PureDocsShell currentPath={currentPath} locale={locale} toc={toc}>
      {/* ─── Hero ────────────────────────────────────────────── */}
      <div className="pure-cli-docs-eyebrow mono">CLI</div>
      <h1 className="pure-cli-docs-title">Command Line Interface</h1>
      <p className="pure-cli-docs-intro">
        {ko
          ? "터미널에서 Markdown을 게시합니다. stdin 파이프, tmux 캡처, 문서 관리를 지원합니다."
          : "Publish Markdown from the terminal. Pipe stdin, capture tmux panes, manage documents."}
      </p>

      {/* ─── Installation ────────────────────────────────────── */}
      <section id="installation" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">{ko ? "설치" : "Installation"}</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={INSTALL_CODE} lang="bash" />
          <p className="pure-cli-docs-callout-note">
            {ko ? (
              <>Node.js 18 이상이 필요합니다. 설치 후 <code>mw</code> 명령어를 사용할 수 있습니다.</>
            ) : (
              <>Requires Node.js 18+. After install, use the <code>mw</code> command.</>
            )}
          </p>
        </div>
      </section>

      {/* ─── Commands ────────────────────────────────────────── */}
      <section id="commands" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">{ko ? "명령어" : "Commands"}</h2>
        <div className="pure-prose-callout">
          {commands.map((c) => <CommandRow key={c.cmd} cmd={c.cmd} desc={c.desc} />)}
        </div>
      </section>

      {/* ─── publish ─────────────────────────────────────────── */}
      <section id="publish" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">publish</h2>
        <p className="pure-cli-docs-body">
          {ko ? "파일 또는 stdin을 게시합니다. 문서 URL을 반환합니다." : "Publish a file or stdin. Returns the document URL."}
        </p>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? PUBLISH_CODE_KO : PUBLISH_CODE_EN} lang="bash" />
          <div className="mono pure-cli-docs-sublabel">{ko ? "옵션" : "OPTIONS"}</div>
          {publishOptions.map((o) => <CommandRow key={o.cmd} cmd={o.cmd} desc={o.desc} />)}
        </div>
      </section>

      {/* ─── update ──────────────────────────────────────────── */}
      <section id="update" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">update</h2>
        <p className="pure-cli-docs-body">
          {ko
            ? "기존 문서를 업데이트합니다. edit token은 최초 게시 시 자동으로 저장됩니다."
            : "Update an existing document. The edit token is stored automatically from the original publish."}
        </p>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? UPDATE_CODE_KO : UPDATE_CODE_EN} lang="bash" />
        </div>
      </section>

      {/* ─── pull ────────────────────────────────────────────── */}
      <section id="pull" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">pull</h2>
        <p className="pure-cli-docs-body">
          {ko ? "문서의 Markdown 내용을 다운로드합니다." : "Download a document's Markdown content."}
        </p>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? PULL_CODE_KO : PULL_CODE_EN} lang="bash" />
        </div>
      </section>

      {/* ─── delete ──────────────────────────────────────────── */}
      <section id="delete" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">delete</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={DELETE_CODE} lang="bash" />
        </div>
      </section>

      {/* ─── list ────────────────────────────────────────────── */}
      <section id="list" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">list</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={LIST_CODE} lang="bash" />
        </div>
      </section>

      {/* ─── open ────────────────────────────────────────────── */}
      <section id="open" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">open</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={OPEN_CODE} lang="bash" />
        </div>
      </section>

      {/* ─── capture ─────────────────────────────────────────── */}
      <section id="capture" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">capture</h2>
        <p className="pure-cli-docs-body">
          {ko
            ? "현재 tmux 패널의 출력을 캡처하여 코드 블록으로 게시합니다."
            : "Capture the current tmux pane output and publish it as a code block."}
        </p>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? CAPTURE_CODE_KO : CAPTURE_CODE_EN} lang="bash" />
        </div>
      </section>

      {/* ─── Authentication ──────────────────────────────────── */}
      <section id="auth-commands" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">{ko ? "인증" : "Authentication"}</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? AUTH_CODE_KO : AUTH_CODE_EN} lang="bash" />
          <p className="pure-cli-docs-callout-note">
            {ko ? (
              <>
                인증은 선택 사항입니다. 로그인 없이도 문서는 edit token 기반의 익명 문서로 생성됩니다.
                로그인하면 <code>mw list</code>와 계정 기반 소유권을 사용할 수 있습니다.
              </>
            ) : (
              <>
                Authentication is optional. Without login, documents are created anonymously with edit tokens.
                Login enables <code>mw list</code> and account-based ownership.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ─── Pipe Examples ───────────────────────────────────── */}
      <section id="pipes" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">{ko ? "파이프 예시" : "Pipe Examples"}</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? PIPES_CODE_KO : PIPES_CODE_EN} lang="bash" />
        </div>
      </section>

      {/* ─── tmux Integration ────────────────────────────────── */}
      <section id="tmux" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">{ko ? "tmux 연동" : "tmux Integration"}</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? TMUX_CODE_KO : TMUX_CODE_EN} lang="bash" />
        </div>
      </section>

      {/* ─── Shell Aliases ───────────────────────────────────── */}
      <section id="aliases" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">Shell Aliases</h2>
        <div className="pure-prose-callout">
          <PureCodeBlock code={ko ? ALIASES_CODE_KO : ALIASES_CODE_EN} lang="bash" />
        </div>
      </section>

      {/* ─── Configuration ───────────────────────────────────── */}
      <section id="config" className="pure-cli-docs-section">
        <h2 className="pure-cli-docs-section-title">{ko ? "설정" : "Configuration"}</h2>
        <div className="pure-prose-callout">
          <div className="mono pure-cli-docs-sublabel">{ko ? "환경 변수" : "ENVIRONMENT VARIABLES"}</div>
          <CommandRow
            cmd="MDFY_URL"
            desc={ko ? "API Base URL. 기본값: https://memory.wiki" : "Base URL for the API. Default: https://memory.wiki"}
          />

          <div className="mono pure-cli-docs-sublabel">{ko ? "설정 파일" : "CONFIG FILE"}</div>
          <p className="pure-cli-docs-callout-note">
            {ko ? (
              <>
                인증 정보는 <code>mw login</code> 후 <code>~/.memory.wiki/config.json</code>에 저장됩니다.
                게시된 문서의 edit token은 <code>~/.memory.wiki/tokens.json</code>에 저장됩니다.
              </>
            ) : (
              <>
                Credentials are stored in <code>~/.memory.wiki/config.json</code> after <code>mw login</code>.
                Edit tokens for published documents are stored in <code>~/.memory.wiki/tokens.json</code>.
              </>
            )}
          </p>
          <PureCodeBlock code={CONFIG_CODE} lang="json" />
        </div>
      </section>
    </PureDocsShell>
  );
}
