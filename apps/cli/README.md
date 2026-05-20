# Memory.Wiki CLI

Publish Markdown from anywhere — terminal, scripts, CI/CD, tmux. Every output becomes a permanent, shareable URL.

Part of the [Memory.Wiki](https://memory.wiki) ecosystem.

## Install

```bash
npm install -g memory-wiki-cli
```

## Quick Start

```bash
# Publish a file → get a URL
Memory.Wiki publish README.md
# → https://memory.wiki/d/abc123 (copied to clipboard)

# Publish from pipe
echo "# Hello World" | Memory.Wiki publish

# Publish clipboard
pbpaste | Memory.Wiki publish

# Read a document in terminal
Memory.Wiki read abc123
```

## Commands

| Command | Description |
|---------|-------------|
| `Memory.Wiki publish <file>` | Publish a .md file and get a URL |
| `Memory.Wiki publish` | Publish from stdin (pipe) |
| `Memory.Wiki read <id>` | Read a document in the terminal with formatting |
| `Memory.Wiki capture [source]` | Capture terminal/AI output and publish |
| `Memory.Wiki update <id> <file>` | Update an existing document |
| `Memory.Wiki pull <id> [-o file]` | Download a document |
| `Memory.Wiki delete <id>` | Delete a document |
| `Memory.Wiki list` | List your documents |
| `Memory.Wiki open <id>` | Open document in browser |
| `Memory.Wiki login` | Authenticate with Memory.Wiki |
| `Memory.Wiki logout` | Clear stored credentials |
| `Memory.Wiki whoami` | Show current user |

### Short Aliases

| Short | Full |
|-------|------|
| `Memory.Wiki p` | `Memory.Wiki publish` |
| `Memory.Wiki up` | `Memory.Wiki update` |
| `Memory.Wiki ls` | `Memory.Wiki list` |
| `Memory.Wiki rm` | `Memory.Wiki delete` |
| `Memory.Wiki cat` | `Memory.Wiki read` |
| `Memory.Wiki c` | `Memory.Wiki capture` |

## Use Cases

### Pipe anything to a URL

```bash
# AI assistant output
claude "explain React hooks" | Memory.Wiki publish

# Git log
git log --oneline -20 | Memory.Wiki publish

# System info
system_profiler SPHardwareDataType | Memory.Wiki publish

# Man pages
man grep | Memory.Wiki publish

# Command output
curl -s https://api.example.com/status | Memory.Wiki publish
```

### Capture terminal sessions

```bash
# Auto-detect: tmux pane if in tmux, clipboard otherwise
Memory.Wiki capture

# Explicit sources
Memory.Wiki capture tmux        # Current tmux pane
Memory.Wiki capture clipboard   # System clipboard
Memory.Wiki capture last        # Pipe: some-cmd | Memory.Wiki capture last
```

AI conversations (Claude Code, ChatGPT CLI, Ollama) are auto-detected and formatted with User/Assistant roles.

### Read documents in terminal

```bash
# By ID
Memory.Wiki read abc123

# By URL
Memory.Wiki read https://memory.wiki/d/abc123

# Output includes: color-coded headings, bold, code, blockquotes, lists
```

### tmux integration

Add to `~/.tmux.conf`:

```bash
bind-key M run-shell "tmux capture-pane -p -S -1000 | Memory.Wiki publish"
```

Press `prefix + M` to publish the current pane.

### Shell aliases

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias mp="Memory.Wiki publish"
alias mpc="pbpaste | Memory.Wiki publish"
```

## Authentication

```bash
Memory.Wiki login     # Opens browser for OAuth → paste token
Memory.Wiki whoami    # Show current user
Memory.Wiki list      # List your published documents
Memory.Wiki logout    # Clear credentials
```

Credentials stored in `~/.memory.wiki/config.json`. Edit tokens in `~/.memory.wiki/tokens.json`.

## How It Works

1. `Memory.Wiki publish` sends Markdown to Memory.Wiki API
2. Returns a permanent short URL (`memory.wiki/d/...`)
3. URL is copied to clipboard (macOS)
4. Edit token is saved locally for future updates
5. Documents render with syntax highlighting, math (KaTeX), and Mermaid diagrams

## Other Channels

| Channel | Install |
|---------|---------|
| [Web Editor](https://memory.wiki) | Just open the URL |
| [Hosted MCP (Claude Web, Cursor, etc.)](https://memory.wiki/docs/mcp) | URL: `https://memory.wiki/api/mcp` |
| [Local MCP (Claude Desktop, Claude Code)](https://www.npmjs.com/package/memory-wiki-mcp) | `npx memory-wiki-mcp` |
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
