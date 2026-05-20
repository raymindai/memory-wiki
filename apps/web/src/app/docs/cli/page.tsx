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
  title: "CLI Reference — Memory.Wiki",
  description:
    "Memory.Wiki CLI reference. Publish Markdown from the command line. Pipe stdin, capture tmux panes, manage documents with simple terminal commands.",
  alternates: {
    canonical: "https://memory.wiki/docs/cli",
    languages: { ko: "https://memory.wiki/ko/docs/cli" },
  },
  openGraph: {
    title: "CLI Reference — Memory.Wiki",
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
            <CodeBlock lang="bash">{`npm install -g memory-wiki-cli`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
              Requires Node.js 18+. After install, use the <InlineCode>{"Memory.Wiki"}</InlineCode> command.
            </p>
          </Card>

          {/* Commands Overview */}
          <SectionHeading id="commands">Commands</SectionHeading>
          <Card>
            <CommandRow cmd="mw publish <file>" desc="Publish a Markdown file or stdin to Memory.Wiki." />
            <CommandRow cmd="Memory.Wiki update <id> <file>" desc="Update an existing document with new content." />
            <CommandRow cmd="Memory.Wiki pull <id>" desc="Download a document's Markdown content." />
            <CommandRow cmd="Memory.Wiki delete <id>" desc="Soft-delete a document." />
            <CommandRow cmd="Memory.Wiki list" desc="List all your documents." />
            <CommandRow cmd="Memory.Wiki open <id>" desc="Open a document in the browser." />
            <CommandRow cmd="Memory.Wiki capture" desc="Capture the current tmux pane and publish." />
            <CommandRow cmd="Memory.Wiki login" desc="Authenticate with Memory.Wiki." />
            <CommandRow cmd="Memory.Wiki logout" desc="Clear stored credentials." />
            <CommandRow cmd="Memory.Wiki whoami" desc="Show current authenticated user." />
          </Card>

          {/* publish */}
          <SectionHeading id="publish">publish</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Publish a file or stdin. Returns the document URL.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# Publish a file
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
mw publish README.md --open`}</CodeBlock>
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
Memory.Wiki update abc123 README.md

# Update from stdin
echo "# Updated" | mw update abc123

# Update with version note
Memory.Wiki update abc123 README.md --message "Fixed typos"`}</CodeBlock>
          </Card>

          {/* pull */}
          <SectionHeading id="pull">pull</SectionHeading>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
            Download a document&apos;s Markdown content.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# Print to stdout
Memory.Wiki pull abc123

# Save to file
Memory.Wiki pull abc123 -o output.md`}</CodeBlock>
          </Card>

          {/* delete */}
          <SectionHeading id="delete">delete</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`Memory.Wiki delete abc123

# Skip confirmation
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
            Capture the current tmux pane output and publish it as a code block.
          </p>
          <Card>
            <CodeBlock lang="bash">{`# Capture current pane
Memory.Wiki capture

# Capture specific pane
Memory.Wiki capture -t %3

# Capture last N lines
Memory.Wiki capture --lines 50`}</CodeBlock>
          </Card>

          {/* Auth */}
          <SectionHeading id="auth-commands">Authentication</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Authenticate (opens browser for OAuth)
Memory.Wiki login

# Clear stored credentials
Memory.Wiki logout

# Show current user
Memory.Wiki whoami
# user@example.com (authenticated via OAuth)`}</CodeBlock>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 12, marginBottom: 0 }}>
              Authentication is optional. Without login, documents are created anonymously with edit tokens.
              Login enables <InlineCode>{"Memory.Wiki list"}</InlineCode> and account-based ownership.
            </p>
          </Card>

          {/* Pipe Examples */}
          <SectionHeading id="pipes">Pipe Examples</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Clipboard to Memory.Wiki
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
curl -s https://api.example.com/data | jq . | mw publish`}</CodeBlock>
          </Card>

          {/* tmux */}
          <SectionHeading id="tmux">tmux Integration</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Capture current pane
tmux capture-pane -p | mw publish

# Capture and share with one keybinding
# Add to ~/.tmux.conf:
bind-key M run-shell "tmux capture-pane -p | mw publish"

# Capture specific pane
tmux capture-pane -t %3 -p | mw publish

# Capture full scrollback
tmux capture-pane -p -S - | mw publish`}</CodeBlock>
          </Card>

          {/* Aliases */}
          <SectionHeading id="aliases">Shell Aliases</SectionHeading>
          <Card>
            <CodeBlock lang="bash">{`# Add to ~/.zshrc or ~/.bashrc

# Quick publish
alias mp="Memory.Wiki publish"

# Publish clipboard
alias mpc="pbpaste | mw publish"

# Publish and open
alias mpo="mw publish --open"

# Capture tmux
alias mtx="tmux capture-pane -p | mw publish"`}</CodeBlock>
          </Card>

          {/* Configuration */}
          <SectionHeading id="config">Configuration</SectionHeading>
          <Card>
            <SubLabel>Environment Variables</SubLabel>
            <CommandRow cmd="MDFY_URL" desc="Base URL for the API. Default: https://memory.wiki" />

            <SubLabel>Config File</SubLabel>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, marginBottom: 12, lineHeight: 1.7 }}>
              Credentials are stored in <InlineCode>{"~/.memory.wiki/config.json"}</InlineCode> after <InlineCode>{"Memory.Wiki login"}</InlineCode>.
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
