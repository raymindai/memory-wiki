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
  title: "CLI 레퍼런스 — Memory.Wiki",
  description:
    "Memory.Wiki CLI 레퍼런스. 커맨드 라인에서 Markdown을 게시합니다. stdin 파이프, tmux 캡처, 문서 관리를 간단한 터미널 명령어로 수행하세요.",
  alternates: {
    canonical: "https://memory.wiki/ko/docs/cli",
    languages: { en: "https://memory.wiki/docs/cli" },
  },
  openGraph: {
    title: "CLI 레퍼런스 — Memory.Wiki",
    description: "커맨드 라인에서 Markdown을 게시합니다. stdin 파이프, tmux 캡처, 문서 관리.",
    url: "https://memory.wiki/ko/docs/cli",
    images: [{ url: "/api/og?title=CLI", width: 1200, height: 630 }],
  },
};

function CommandRow({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div
      className="param-row"
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 16,
        alignItems: "baseline",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-dim)",
      }}
    >
      <code style={{ fontSize: 13, fontFamily: mono, color: "var(--accent)", fontWeight: 600 }}>{cmd}</code>
      <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</span>
    </div>
  );
}

const sidebarItems = [
  { id: "installation", label: "설치" },
  { id: "commands", label: "명령어" },
  { id: "publish", label: "publish" },
  { id: "update", label: "update" },
  { id: "pull", label: "pull" },
  { id: "delete", label: "delete" },
  { id: "list", label: "list" },
  { id: "open", label: "open" },
  { id: "capture", label: "capture" },
  { id: "auth-commands", label: "인증" },
  { id: "pipes", label: "파이프 예시" },
  { id: "tmux", label: "tmux 연동" },
  { id: "aliases", label: "Shell Aliases" },
  { id: "config", label: "설정" },
];

export default function CliDocsPageKo() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav lang="ko" />

      <div className="docs-layout">
        <DocsSidebar
          items={sidebarItems}
          currentPath="/ko/docs/cli"
        />

        {/* MAIN */}
        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          <p style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontFamily: mono }}>CLI</p>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 16px" }}>
            Command Line Interface
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32, maxWidth: 640 }}>
            터미널에서 Markdown을 게시합니다. stdin 파이프, tmux 캡처, 문서 관리를 지원합니다.
          </p>

          {/* 설치 */}
          <SectionHeading id="installation">설치</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`npm install -g mdfy-cli`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
              Node.js 18 이상이 필요합니다. 설치 후 <InlineCode>{"Memory.Wiki"}</InlineCode> 명령어를 사용할 수 있습니다.
            </p>
          </Card>

          {/* 명령어 개요 */}
          <SectionHeading id="commands">명령어</SectionHeading>
          <Card>
            <CommandRow cmd="mdfy publish <file>" desc="Markdown 파일 또는 stdin을 Memory.Wiki에 게시합니다." />
            <CommandRow cmd="Memory.Wiki update <id> <file>" desc="기존 문서를 새 내용으로 업데이트합니다." />
            <CommandRow cmd="Memory.Wiki pull <id>" desc="문서의 Markdown 내용을 다운로드합니다." />
            <CommandRow cmd="Memory.Wiki delete <id>" desc="문서를 소프트 삭제합니다." />
            <CommandRow cmd="Memory.Wiki list" desc="내 모든 문서를 조회합니다." />
            <CommandRow cmd="Memory.Wiki open <id>" desc="브라우저에서 문서를 엽니다." />
            <CommandRow cmd="Memory.Wiki capture" desc="현재 tmux 패널을 캡처하여 게시합니다." />
            <CommandRow cmd="Memory.Wiki login" desc="Memory.Wiki에 인증합니다." />
            <CommandRow cmd="Memory.Wiki logout" desc="저장된 인증 정보를 삭제합니다." />
            <CommandRow cmd="Memory.Wiki whoami" desc="현재 인증된 사용자를 표시합니다." />
          </Card>

          {/* publish */}
          <SectionHeading id="publish">publish</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            파일 또는 stdin을 게시합니다. 문서 URL을 반환합니다.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# 파일 게시
mdfy publish README.md

# stdin에서 게시
echo "# Hello World" | mdfy publish

# 임시 저장으로 게시
mdfy publish README.md --draft

# 제목 지정
mdfy publish README.md --title "My Document"

# 비밀번호 설정
mdfy publish README.md --password "secret"

# 만료 시간 설정
mdfy publish README.md --expires 7d`}</CodeBlock>
            <SubLabel>옵션</SubLabel>
            <CommandRow cmd="--draft, -d" desc="임시 저장으로 게시합니다 (본인만 볼 수 있음)." />
            <CommandRow cmd="--title, -t" desc="문서 제목을 설정합니다." />
            <CommandRow cmd="--password, -p" desc="문서를 비밀번호로 보호합니다." />
            <CommandRow cmd="--expires, -e" desc="만료 시간 설정: 1h, 1d, 7d, 30d." />
            <CommandRow cmd="--open, -o" desc="게시 후 브라우저에서 엽니다." />
          </Card>

          {/* update */}
          <SectionHeading id="update">update</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            기존 문서를 업데이트합니다. edit token은 최초 게시 시 자동으로 저장됩니다.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# 파일로 업데이트
Memory.Wiki update abc123 README.md

# stdin으로 업데이트
echo "# Updated" | mdfy update abc123

# 버전 노트와 함께 업데이트
Memory.Wiki update abc123 README.md --message "Fixed typos"`}</CodeBlock>
          </Card>

          {/* pull */}
          <SectionHeading id="pull">pull</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            문서의 Markdown 내용을 다운로드합니다.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# stdout으로 출력
Memory.Wiki pull abc123

# 파일로 저장
Memory.Wiki pull abc123 -o output.md

# 비밀번호 보호 문서 다운로드
Memory.Wiki pull abc123 --password "secret"`}</CodeBlock>
          </Card>

          {/* delete */}
          <SectionHeading id="delete">delete</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`Memory.Wiki delete abc123

# 확인 건너뛰기
Memory.Wiki delete abc123 --yes`}</CodeBlock>
          </Card>

          {/* list */}
          <SectionHeading id="list">list</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`Memory.Wiki list

# Output:
#  ID       TITLE              UPDATED         STATUS
#  abc123   My Document        2 hours ago     published
#  def456   Draft Note         5 minutes ago   draft`}</CodeBlock>
          </Card>

          {/* open */}
          <SectionHeading id="open">open</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`Memory.Wiki open abc123
# Opens https://memory.wiki/abc123 in your default browser`}</CodeBlock>
          </Card>

          {/* capture */}
          <SectionHeading id="capture">capture</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            현재 tmux 패널의 출력을 캡처하여 코드 블록으로 게시합니다.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# 현재 패널 캡처
Memory.Wiki capture

# 특정 패널 캡처
Memory.Wiki capture -t %3

# 마지막 N줄 캡처
Memory.Wiki capture --lines 50`}</CodeBlock>
          </Card>

          {/* 인증 */}
          <SectionHeading id="auth-commands">인증</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# 인증 (브라우저에서 OAuth 진행)
Memory.Wiki login

# 저장된 인증 정보 삭제
Memory.Wiki logout

# 현재 사용자 확인
Memory.Wiki whoami
# user@example.com (authenticated via OAuth)`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
              인증은 선택 사항입니다. 로그인 없이도 문서는 edit token 기반의 익명 문서로 생성됩니다.
              로그인하면 <InlineCode>{"Memory.Wiki list"}</InlineCode>와 계정 기반 소유권을 사용할 수 있습니다.
            </p>
          </Card>

          {/* 파이프 예시 */}
          <SectionHeading id="pipes">파이프 예시</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# 클립보드를 Memory.Wiki로
pbpaste | mdfy publish

# 명령어 출력
ls -la | mdfy publish

# 파일 내용
cat report.md | mdfy publish

# AI로 생성 후 바로 게시
claude "Write a guide to Rust" | mdfy publish

# Git diff
git diff | mdfy publish --title "Changes"

# Docker 로그
docker logs my-app 2>&1 | mdfy publish

# 여러 명령어 파이프
curl -s https://api.example.com/data | jq . | mdfy publish`}</CodeBlock>
          </Card>

          {/* tmux */}
          <SectionHeading id="tmux">tmux 연동</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# 현재 패널 캡처
tmux capture-pane -p | mdfy publish

# 단축키로 캡처 및 공유
# ~/.tmux.conf에 추가:
bind-key M run-shell "tmux capture-pane -p | mdfy publish"

# 특정 패널 캡처
tmux capture-pane -t %3 -p | mdfy publish

# 전체 스크롤백 캡처
tmux capture-pane -p -S - | mdfy publish`}</CodeBlock>
          </Card>

          {/* Aliases */}
          <SectionHeading id="aliases">Shell Aliases</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# ~/.zshrc 또는 ~/.bashrc에 추가

# 빠른 게시
alias mp="Memory.Wiki publish"

# 클립보드 게시
alias mpc="pbpaste | mdfy publish"

# 게시 후 브라우저 열기
alias mpo="mdfy publish --open"

# tmux 캡처
alias mtx="tmux capture-pane -p | mdfy publish"`}</CodeBlock>
          </Card>

          {/* 설정 */}
          <SectionHeading id="config">설정</SectionHeading>
          <Card>
            <SubLabel>환경 변수</SubLabel>
            <CommandRow cmd="MDFY_URL" desc="API Base URL. 기본값: https://memory.wiki" />

            <SubLabel>설정 파일</SubLabel>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, marginBottom: 12, lineHeight: 1.7 }}>
              인증 정보는 <InlineCode>{"Memory.Wiki login"}</InlineCode> 후 <InlineCode>{"~/.memory.wiki/config.json"}</InlineCode>에 저장됩니다.
              게시된 문서의 edit token은 <InlineCode>{"~/.memory.wiki/tokens.json"}</InlineCode>에 저장됩니다.
            </p>
            <CodeBlock lang="json">{`// ~/.memory.wiki/config.json
{
  "apiUrl": "https://memory.wiki",
  "email": "user@example.com",
  "token": "..."
}`}</CodeBlock>
          </Card>
        </main>
      </div>

      <DocsFooter breadcrumb="CLI" lang="ko" />
    </div>
  );
}
