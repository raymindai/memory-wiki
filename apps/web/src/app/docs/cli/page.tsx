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
  title: "CLI Reference — memory.wiki",
  description:
    "memory.wiki CLI reference. Publish Markdown from the command line. Pipe stdin, capture tmux panes, manage documents with simple terminal commands.",
  alternates: {
    canonical: "https://memory.wiki/docs/cli",
    languages: { ko: "https://memory.wiki/ko/docs/cli" },
  },
  openGraph: {
    title: "CLI Reference — memory.wiki",
    description: "Publish Markdown from the command line. Pipe stdin, capture tmux, manage documents.",
    url: "https://memory.wiki/docs/cli",
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
  { id: "installation", label: "Installation" },
  { id: "commands", label: "Commands" },
  { id: "publish", label: "publish" },
  { id: "update", label: "update" },
  { id: "pull", label: "pull" },
  { id: "delete", label: "delete" },
  { id: "list", label: "list" },
  { id: "open", label: "open" },
  { id: "capture", label: "capture" },
  { id: "auth-commands", label: "Authentication" },
  { id: "pipes", label: "Pipe Examples" },
  { id: "tmux", label: "tmux Integration" },
  { id: "aliases", label: "Shell Aliases" },
  { id: "config", label: "Configuration" },
];

export default function CliDocsPage() {
  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav />

      <div className="docs-layout">
        <DocsSidebar
          items={sidebarItems}
          currentPath="/docs/cli"
        />

        {/* MAIN */}
        <main style={{ paddingTop: 40, paddingBottom: 80, minWidth: 0 }}>
          <p style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, fontFamily: mono }}>CLI</p>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-primary)", margin: "0 0 16px" }}>
            Command Line Interface
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 32, maxWidth: 640 }}>
            Publish Markdown from the terminal. Pipe stdin, capture tmux panes, manage documents.
          </p>

          {/* Installation */}
          <SectionHeading id="installation">Installation</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`npm install -g mdfy-cli`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
              Requires Node.js 18+. After install, use the <InlineCode>{"memory.wiki"}</InlineCode> command.
            </p>
          </Card>

          {/* Commands Overview */}
          <SectionHeading id="commands">Commands</SectionHeading>
          <Card>
            <CommandRow cmd="memory.wiki publish <file>" desc="Publish a Markdown file or stdin to memory.wiki." />
            <CommandRow cmd="memory.wiki update <id> <file>" desc="Update an existing document with new content." />
            <CommandRow cmd="memory.wiki pull <id>" desc="Download a document's Markdown content." />
            <CommandRow cmd="memory.wiki delete <id>" desc="Soft-delete a document." />
            <CommandRow cmd="memory.wiki list" desc="List all your documents." />
            <CommandRow cmd="memory.wiki open <id>" desc="Open a document in the browser." />
            <CommandRow cmd="memory.wiki capture" desc="Capture the current tmux pane and publish." />
            <CommandRow cmd="memory.wiki login" desc="Authenticate with memory.wiki." />
            <CommandRow cmd="memory.wiki logout" desc="Clear stored credentials." />
            <CommandRow cmd="memory.wiki whoami" desc="Show current authenticated user." />
          </Card>

          {/* publish */}
          <SectionHeading id="publish">publish</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Publish a file or stdin. Returns the document URL.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# Publish a file
memory.wiki publish README.md

# Publish from stdin
echo "# Hello World" | memory.wiki publish

# Publish as draft
memory.wiki publish README.md --draft

# Publish with title
memory.wiki publish README.md --title "My Document"

# Place in a specific folder
memory.wiki publish README.md --folder "folder-uuid"

# Open in browser after publishing
memory.wiki publish README.md --open`}</CodeBlock>
            <SubLabel>Options</SubLabel>
            <CommandRow cmd="--draft, -d" desc="Publish as draft (only visible to you)." />
            <CommandRow cmd="--title, -t" desc="Set document title." />
            <CommandRow cmd="--folder, -f" desc="Place document in a folder (folder UUID)." />
            <CommandRow cmd="--open, -o" desc="Open in browser after publishing." />
          </Card>

          {/* update */}
          <SectionHeading id="update">update</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Update an existing document. The edit token is stored automatically from the original publish.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# Update from file
memory.wiki update abc123 README.md

# Update from stdin
echo "# Updated" | memory.wiki update abc123

# Update with version note
memory.wiki update abc123 README.md --message "Fixed typos"`}</CodeBlock>
          </Card>

          {/* pull */}
          <SectionHeading id="pull">pull</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Download a document&apos;s Markdown content.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# Print to stdout
memory.wiki pull abc123

# Save to file
memory.wiki pull abc123 -o output.md`}</CodeBlock>
          </Card>

          {/* delete */}
          <SectionHeading id="delete">delete</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`memory.wiki delete abc123

# Skip confirmation
memory.wiki delete abc123 --yes`}</CodeBlock>
          </Card>

          {/* list */}
          <SectionHeading id="list">list</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`memory.wiki list

# Output:
#  ID       TITLE              UPDATED         STATUS
#  abc123   My Document        2 hours ago     published
#  def456   Draft Note         5 minutes ago   draft`}</CodeBlock>
          </Card>

          {/* open */}
          <SectionHeading id="open">open</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`memory.wiki open abc123
# Opens https://memory.wiki/abc123 in your default browser`}</CodeBlock>
          </Card>

          {/* capture */}
          <SectionHeading id="capture">capture</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Capture the current tmux pane output and publish it as a code block.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# Capture current pane
memory.wiki capture

# Capture specific pane
memory.wiki capture -t %3

# Capture last N lines
memory.wiki capture --lines 50`}</CodeBlock>
          </Card>

          {/* Auth */}
          <SectionHeading id="auth-commands">Authentication</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Authenticate (opens browser for OAuth)
memory.wiki login

# Clear stored credentials
memory.wiki logout

# Show current user
memory.wiki whoami
# user@example.com (authenticated via OAuth)`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
              Authentication is optional. Without login, documents are created anonymously with edit tokens.
              Login enables <InlineCode>{"memory.wiki list"}</InlineCode> and account-based ownership.
            </p>
          </Card>

          {/* Pipe Examples */}
          <SectionHeading id="pipes">Pipe Examples</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Clipboard to memory.wiki
pbpaste | memory.wiki publish

# Command output
ls -la | memory.wiki publish

# Cat a file
cat report.md | memory.wiki publish

# Generate with AI, publish directly
claude "Write a guide to Rust" | memory.wiki publish

# Git diff
git diff | memory.wiki publish --title "Changes"

# Docker logs
docker logs my-app 2>&1 | memory.wiki publish

# Pipe through multiple commands
curl -s https://api.example.com/data | jq . | memory.wiki publish`}</CodeBlock>
          </Card>

          {/* tmux */}
          <SectionHeading id="tmux">tmux Integration</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Capture current pane
tmux capture-pane -p | memory.wiki publish

# Capture and share with one keybinding
# Add to ~/.tmux.conf:
bind-key M run-shell "tmux capture-pane -p | memory.wiki publish"

# Capture specific pane
tmux capture-pane -t %3 -p | memory.wiki publish

# Capture full scrollback
tmux capture-pane -p -S - | memory.wiki publish`}</CodeBlock>
          </Card>

          {/* Aliases */}
          <SectionHeading id="aliases">Shell Aliases</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Add to ~/.zshrc or ~/.bashrc

# Quick publish
alias mp="memory.wiki publish"

# Publish clipboard
alias mpc="pbpaste | memory.wiki publish"

# Publish and open
alias mpo="memory.wiki publish --open"

# Capture tmux
alias mtx="tmux capture-pane -p | memory.wiki publish"`}</CodeBlock>
          </Card>

          {/* Configuration */}
          <SectionHeading id="config">Configuration</SectionHeading>
          <Card>
            <SubLabel>Environment Variables</SubLabel>
            <CommandRow cmd="MDFY_URL" desc="Base URL for the API. Default: https://memory.wiki" />

            <SubLabel>Config File</SubLabel>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, marginBottom: 12, lineHeight: 1.7 }}>
              Credentials are stored in <InlineCode>{"~/.memory.wiki/config.json"}</InlineCode> after <InlineCode>{"memory.wiki login"}</InlineCode>.
              Edit tokens for published documents are stored in <InlineCode>{"~/.memory.wiki/tokens.json"}</InlineCode>.
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

      <DocsFooter breadcrumb="CLI" />
    </div>
  );
}
