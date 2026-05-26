# memory-wiki-mcp

MCP server for [Memory.Wiki](https://memory.wiki) — let any AI tool create, read, update, and manage Markdown documents with permanent shareable URLs.

Works with **Claude Code**, **Claude Desktop**, **Cursor**, and any [Model Context Protocol](https://modelcontextprotocol.io/) compatible client.

> **Two ways to connect:**
>
> - **Hosted HTTP MCP** (recommended for Claude Web, Cursor, etc.) — no install. Just add `https://memory.wiki/api/mcp` in your client's MCP/Connectors settings. Exposes 25 tools.
> - **Local stdio MCP** (this npm package) — for Claude Desktop and Claude Code. Exposes 6 core tools. See setup below.

## Quick Start

### 1. Login (one-time)

```bash
npx memory-wiki-cli login
```

Opens your browser for OAuth. Credentials are stored locally in `~/.memory.wiki/`.

### 2. Add to your AI tool

**Claude Code / Cursor** — create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}
```

No API keys or environment variables needed. Authentication is handled via `Memory.Wiki login`.

## Tools

| Tool | Description | Auth |
|------|-------------|------|
| `mw_create` | Create a new document and get a shareable URL | Optional |
| `mw_read` | Fetch document content by ID or URL | No |
| `mw_update` | Update an existing document's content | Edit token (auto-managed) |
| `mw_list` | List all your documents with metadata | Yes |
| `mw_publish` | Toggle a document between public and private | Edit token (auto-managed) |
| `mw_delete` | Soft-delete or permanently delete a document | Edit token (auto-managed) |

## What You Can Do

```
You: "Create a document with my meeting notes"
AI:  mw_create → https://memory.wiki/abc123 (URL copied!)

You: "List my documents"
AI:  mw_list → 8 documents found

You: "Read the system design doc"
AI:  mw_read → (full markdown content)

You: "Update it with the new architecture section"
AI:  mw_update → Document updated

You: "Make it private"
AI:  mw_publish (published: false) → Now private

You: "Delete the draft"
AI:  mw_delete → Moved to trash
```

### Cross-AI Workflow

Memory.Wiki URLs work as context across AI conversations:

```
You (in Claude): "Summarize the research at memory.wiki/abc123"
AI:  mw_read → reads the document → provides summary

You (in ChatGPT): "Read memory.wiki/abc123 and suggest improvements"
ChatGPT: fetches the URL → gives feedback

You (in Claude): "Update memory.wiki/abc123 with the improvements"
AI:  mw_update → document updated, same URL
```

## How Authentication Works

The MCP server shares credentials with the `Memory.Wiki` CLI:

1. `Memory.Wiki login` opens your browser for Google/GitHub OAuth
2. JWT token is stored locally in `~/.memory.wiki/config.json`
3. Edit tokens for each document are stored in `~/.memory.wiki/tokens.json`
4. All API requests use `Authorization: Bearer` headers
5. Tokens auto-refresh when expired (clear error message if re-login needed)

No email spoofing possible — all requests are authenticated via JWT.

## Features

- **Permanent URLs** — every document gets a short URL (`memory.wiki/...`) that never expires
- **Auto-managed edit tokens** — create a doc, get edit access automatically
- **Public or private** — toggle visibility with `mw_publish`
- **Markdown rendering** — documents render with syntax highlighting, KaTeX math, Mermaid diagrams
- **Version history** — all edits are tracked
- **Zero config** — just `npx memory-wiki-mcp`, no API keys needed

## Other Channels

Memory.Wiki is available everywhere:

| Channel | Install |
|---------|---------|
| [Web Editor](https://memory.wiki) | Just open the URL |
| [CLI](https://www.npmjs.com/package/memory-wiki-cli) | `npm install -g memory-wiki-cli` |
| [VS Code Extension](https://memory.wiki/plugins) | Download .vsix from Plugins page |
| [Chrome Extension](https://memory.wiki/plugins) | Download from Plugins page |
| [Mac Desktop App](https://memory.wiki/plugins) | Download .dmg from Plugins page |

## Links

- Website: [Memory.Wiki](https://memory.wiki)
- Plugins: [memory.wiki/plugins](https://memory.wiki/plugins)
- API Docs: [memory.wiki/docs](https://memory.wiki/docs)
- GitHub: [github.com/raymindai/memory-wiki](https://github.com/raymindai/memory-wiki)

## License

MIT
