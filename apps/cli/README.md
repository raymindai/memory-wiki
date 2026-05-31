# memory.wiki CLI

Publish Markdown from anywhere: terminal, scripts, CI/CD, tmux. Every output becomes a permanent, shareable URL that any AI can read.

Part of the [memory.wiki](https://memory.wiki) ecosystem.

## Install

```bash
npm install -g memory-wiki-cli
```

## Quick Start

```bash
# Publish a file and get a URL
mw publish README.md
# Output:
#   https://memory.wiki/abc123
#   Paste into any AI:  Use https://memory.wiki/abc123 as my context.
#   URL copied to clipboard

# Publish from pipe
echo "# Hello World" | mw publish

# Publish clipboard
pbpaste | mw publish

# Read a document in terminal
mw read abc123

# Get the canonical "for AI" sentence for any existing doc / hub / bundle
mw ai abc123
# Output: Use https://memory.wiki/abc123 as my context. (also copied on macOS)

mw ai @raymind
# Output: Use https://memory.wiki/@raymind as my context.
```

## Commands

| Command | Description |
|---------|-------------|
| `mw publish <file>` | Publish a .md file and get a URL |
| `mw publish` | Publish from stdin (pipe) |
| `mw read <id>` | Read a document in the terminal with formatting |
| `mw capture [source]` | Capture terminal/AI output and publish |
| `mw update <id> <file>` | Update an existing document |
| `mw pull <id> [-o file]` | Download a document |
| `mw delete <id>` | Delete a document |
| `mw list` | List your documents |
| `mw open <id>` | Open document in browser |
| `mw ai <id\|url\|@username>` | Print the canonical "for AI" paste sentence (copied to clipboard on macOS) |
| `mw login` | Authenticate with memory.wiki |
| `mw logout` | Clear stored credentials |
| `mw whoami` | Show current user |

### Short Aliases

| Short | Full |
|-------|------|
| `mw p` | `mw publish` |
| `mw up` | `mw update` |
| `mw ls` | `mw list` |
| `mw rm` | `mw delete` |
| `mw cat` | `mw read` |
| `mw c` | `mw capture` |

## Use Cases

### Pipe anything to a URL

```bash
# AI assistant output
claude "explain React hooks" | mw publish

# Git log
git log --oneline -20 | mw publish

# System info
system_profiler SPHardwareDataType | mw publish

# Man pages
man grep | mw publish

# Command output
curl -s https://api.example.com/status | mw publish
```

### Capture terminal sessions

```bash
# Auto-detect: tmux pane if in tmux, clipboard otherwise
mw capture

# Explicit sources
mw capture tmux        # Current tmux pane
mw capture clipboard   # System clipboard
mw capture last        # Pipe: some-cmd | mw capture last
```

AI conversations (Claude Code, ChatGPT CLI, Ollama) are auto-detected and formatted with User/Assistant roles.

### Read documents in terminal

```bash
# By ID
mw read abc123

# By URL
mw read https://memory.wiki/abc123

# Output includes: color-coded headings, bold, code, blockquotes, lists
```

### tmux integration

Add to `~/.tmux.conf`:

```bash
bind-key M run-shell "tmux capture-pane -p -S -1000 | mw publish"
```

Press `prefix + M` to publish the current pane.

### Shell aliases

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias mp="mw publish"
alias mpc="pbpaste | mw publish"
```

## Authentication

```bash
mw login     # Opens browser for OAuth, paste token
mw whoami    # Show current user
mw list      # List your published documents
mw logout    # Clear credentials
```

Credentials stored in `~/.memory.wiki/config.json`. Edit tokens in `~/.memory.wiki/tokens.json`.

## URL forms

| Form | Pattern | When |
| --- | --- | --- |
| Doc | `memory.wiki/<id>` | A single document. 12-char nanoid. |
| Bundle | `memory.wiki/b/<id>` | A bundle (curated set of docs). |
| Hub | `memory.wiki/@<username>` | Your full hub. Pulls every public doc + bundle. |
| Raw | `memory.wiki/<id>.md` | Markdown payload for AI fetchers. |

Every form fetches as clean markdown for any AI (Claude / ChatGPT / Gemini / Cursor) when called with the right Accept header. The CLI's `mw ai` command wraps any of these into the canonical "Use ... as my context." sentence so you can paste straight into any AI tool.

## How It Works

1. `mw publish` sends Markdown to memory.wiki's API.
2. Returns a permanent short URL (`memory.wiki/<id>`).
3. URL is copied to clipboard (macOS).
4. The "for AI" paste sentence is printed below the URL so you can copy it manually for chat-tool pastes.
5. Edit token is saved locally for future updates.
6. Documents render with syntax highlighting, math (KaTeX), and Mermaid diagrams.

## Other Channels

| Channel | Install |
|---------|---------|
| [Web Editor](https://memory.wiki) | Just open the URL |
| [Hosted MCP (Claude Web, Cursor, etc.)](https://memory.wiki/docs/mcp) | URL: `https://memory.wiki/api/mcp` |
| [Local MCP (Claude Desktop, Claude Code)](https://www.npmjs.com/package/memory-wiki-mcp) | `npx memory-wiki-mcp` |
| [VS Code Extension](https://memory.wiki/plugins) | Download from Plugins page |
| [Chrome Extension](https://memory.wiki/plugins) | Download from Plugins page |
| [Mac Desktop App](https://memory.wiki/plugins) | Download from Plugins page |
| [tmux Plugin](https://github.com/raymindai/memory-wiki/tree/main/apps/tmux) | Manual install |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_WIKI_URL` | `https://memory.wiki` | API base URL (canonical) |
| `MDFY_URL` | (same) | Deprecated alias, accepted for legacy shells |

## License

MIT
