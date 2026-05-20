# memory.wiki CLI

Publish Markdown from anywhere — terminal, scripts, CI/CD, tmux. Every output becomes a permanent, shareable URL.

Part of the [memory.wiki](https://memory.wiki) ecosystem.

## Install

```bash
npm install -g mdfy-cli
```

## Quick Start

```bash
# Publish a file → get a URL
memory.wiki publish README.md
# → https://memory.wiki/d/abc123 (copied to clipboard)

# Publish from pipe
echo "# Hello World" | memory.wiki publish

# Publish clipboard
pbpaste | memory.wiki publish

# Read a document in terminal
memory.wiki read abc123
```

## Commands

| Command | Description |
|---------|-------------|
| `memory.wiki publish <file>` | Publish a .md file and get a URL |
| `memory.wiki publish` | Publish from stdin (pipe) |
| `memory.wiki read <id>` | Read a document in the terminal with formatting |
| `memory.wiki capture [source]` | Capture terminal/AI output and publish |
| `memory.wiki update <id> <file>` | Update an existing document |
| `memory.wiki pull <id> [-o file]` | Download a document |
| `memory.wiki delete <id>` | Delete a document |
| `memory.wiki list` | List your documents |
| `memory.wiki open <id>` | Open document in browser |
| `memory.wiki login` | Authenticate with memory.wiki |
| `memory.wiki logout` | Clear stored credentials |
| `memory.wiki whoami` | Show current user |

### Short Aliases

| Short | Full |
|-------|------|
| `memory.wiki p` | `memory.wiki publish` |
| `memory.wiki up` | `memory.wiki update` |
| `memory.wiki ls` | `memory.wiki list` |
| `memory.wiki rm` | `memory.wiki delete` |
| `memory.wiki cat` | `memory.wiki read` |
| `memory.wiki c` | `memory.wiki capture` |

## Use Cases

### Pipe anything to a URL

```bash
# AI assistant output
claude "explain React hooks" | memory.wiki publish

# Git log
git log --oneline -20 | memory.wiki publish

# System info
system_profiler SPHardwareDataType | memory.wiki publish

# Man pages
man grep | memory.wiki publish

# Command output
curl -s https://api.example.com/status | memory.wiki publish
```

### Capture terminal sessions

```bash
# Auto-detect: tmux pane if in tmux, clipboard otherwise
memory.wiki capture

# Explicit sources
memory.wiki capture tmux        # Current tmux pane
memory.wiki capture clipboard   # System clipboard
memory.wiki capture last        # Pipe: some-cmd | memory.wiki capture last
```

AI conversations (Claude Code, ChatGPT CLI, Ollama) are auto-detected and formatted with User/Assistant roles.

### Read documents in terminal

```bash
# By ID
memory.wiki read abc123

# By URL
memory.wiki read https://memory.wiki/d/abc123

# Output includes: color-coded headings, bold, code, blockquotes, lists
```

### tmux integration

Add to `~/.tmux.conf`:

```bash
bind-key M run-shell "tmux capture-pane -p -S -1000 | memory.wiki publish"
```

Press `prefix + M` to publish the current pane.

### Shell aliases

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias mp="memory.wiki publish"
alias mpc="pbpaste | memory.wiki publish"
```

## Authentication

```bash
memory.wiki login     # Opens browser for OAuth → paste token
memory.wiki whoami    # Show current user
memory.wiki list      # List your published documents
memory.wiki logout    # Clear credentials
```

Credentials stored in `~/.memory.wiki/config.json`. Edit tokens in `~/.memory.wiki/tokens.json`.

## How It Works

1. `memory.wiki publish` sends Markdown to memory.wiki API
2. Returns a permanent short URL (`memory.wiki/d/...`)
3. URL is copied to clipboard (macOS)
4. Edit token is saved locally for future updates
5. Documents render with syntax highlighting, math (KaTeX), and Mermaid diagrams

## Other Channels

| Channel | Install |
|---------|---------|
| [Web Editor](https://memory.wiki) | Just open the URL |
| [Hosted MCP (Claude Web, Cursor, etc.)](https://memory.wiki/docs/mcp) | URL: `https://memory.wiki/api/mcp` |
| [Local MCP (Claude Desktop, Claude Code)](https://www.npmjs.com/package/mdfy-mcp) | `npx mdfy-mcp` |
| [VS Code Extension](https://memory.wiki/plugins) | Download from Plugins page |
| [Chrome Extension](https://memory.wiki/plugins) | Download from Plugins page |
| [Mac Desktop App](https://memory.wiki/plugins) | Download from Plugins page |
| [tmux Plugin](https://github.com/raymindai/mdcore/tree/main/apps/tmux) | Manual install |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MDFY_URL` | `https://memory.wiki` | API base URL |

## License

MIT
