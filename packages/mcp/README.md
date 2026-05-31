# memory-wiki-mcp

MCP server for [memory.wiki](https://memory.wiki). Lets any AI tool create, read, update, search, and paste-anywhere your Markdown documents with permanent shareable URLs.

Works with **Claude Code**, **Claude Desktop**, **Cursor**, and any [Model Context Protocol](https://modelcontextprotocol.io/) compatible client.

> **Two ways to connect:**
>
> - **Hosted HTTP MCP** (recommended for Claude Web, Cursor, etc.). No install. Just add `https://memory.wiki/api/mcp` in your client's MCP / Connectors settings. Exposes the full tool set.
> - **Local stdio MCP** (this npm package). For Claude Desktop and Claude Code. See setup below.

## Quick Start

### 1. Login (one-time)

```bash
npx memory-wiki-cli login
```

Opens your browser for OAuth. Credentials are stored locally in `~/.memory.wiki/`.

### 2. Add to your AI tool

**Claude Code / Cursor**: create `.mcp.json` in your project root.

```json
{
  "mcpServers": {
    "memory.wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}
```

**Claude Desktop**: add to `claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "memory.wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}
```

No API keys or environment variables needed. Authentication is handled via `mw login` (run once before starting the MCP).

## Tools

29 tools, same surface on the local stdio (this package) and the hosted HTTP MCP (`memory.wiki/api/mcp`).

**Core CRUD**

| Tool | Description | Auth |
|------|-------------|------|
| `mw_create` | Create a new document and get a shareable URL | Optional |
| `mw_read` | Fetch document content by ID or URL | No |
| `mw_update` | Update an existing document's content | Edit token (auto-managed) |
| `mw_publish` | Toggle a document between public and private | Edit token (auto-managed) |
| `mw_delete` | Soft-delete or permanently delete a document | Edit token (auto-managed) |
| `mw_list` | List all your documents with metadata | Yes |

**Cross-AI handoff**

| Tool | Description | Auth |
|------|-------------|------|
| `mw_for_ai` | Return the canonical `Use https://memory.wiki/<id> as my context.` sentence for any id / URL / `@username` / `b/<id>`. Lets one AI hand a doc to another. | No |
| `mw_get_share_url` | Build a public viewer URL for a doc, bundle, or hub | No |

**Search + discovery**

| Tool | Description | Auth |
|------|-------------|------|
| `mw_search` | Full-text search across your documents | Yes |
| `mw_recent` | Recently visited documents | Yes |
| `mw_stats` | Per-document stats (views, last-edited, byte size) | Yes |
| `mw_hub_constellation` | Hub-wide knowledge graph (concepts + typed edges + doc clusters) | Yes |
| `mw_bundle_constellation` | Bundle-scoped knowledge graph | Yes |

**Content surgery (no full re-write)**

| Tool | Description | Auth |
|------|-------------|------|
| `mw_outline` | Parse and return heading structure | No |
| `mw_extract_section` | Pull one heading's section as markdown | No |
| `mw_replace_section` | Replace one heading's section | Edit token |
| `mw_append` | Append text to the end of a document | Edit token |
| `mw_prepend` | Prepend text to the top of a document | Edit token |
| `mw_duplicate` | Copy a document into a new draft | Yes |
| `mw_import_url` | Import any URL as a new memory.wiki document | Yes |
| `mw_render_preview` | Render markdown to HTML preview (no save) | No |

**Sharing + access**

| Tool | Description | Auth |
|------|-------------|------|
| `mw_set_allowed_emails` | Restrict access to a specific email list | Edit token |
| `mw_set_expiry` | Set or clear document expiry | Edit token |

**Versioning**

| Tool | Description | Auth |
|------|-------------|------|
| `mw_versions` | List version history | Yes |
| `mw_diff` | Diff between two versions | Yes |
| `mw_restore_version` | Restore a previous version | Edit token |

**Folders (workspace organisation)**

| Tool | Description | Auth |
|------|-------------|------|
| `mw_folder_list` | List your folders | Yes |
| `mw_folder_create` | Create a folder | Yes |
| `mw_move_to_folder` | Move a document into a folder | Yes |

## What You Can Do

```
You: "Create a document with my meeting notes"
AI:  mw_create  =>  https://memory.wiki/abc123 (URL copied)

You: "List my documents"
AI:  mw_list  =>  8 documents found

You: "Read the system design doc"
AI:  mw_read  =>  (full markdown content)

You: "Update it with the new architecture section"
AI:  mw_update  =>  Document updated

You: "Make it private"
AI:  mw_publish (published: false)  =>  Now private

You: "Delete the draft"
AI:  mw_delete  =>  Moved to trash
```

### Cross-AI Workflow

memory.wiki URLs work as context across AI conversations. Each URL is a single canonical link that fetches as clean markdown for any AI.

```
You (in Claude): "Summarize the research at memory.wiki/abc123"
AI:  mw_read fetches the document, summarises

You (in Claude Code): "Get me the for-AI paste for that doc so I can give it to Cursor"
AI:  mw_for_ai abc123 returns: Use https://memory.wiki/abc123 as my context.

You (paste that line into Cursor): Cursor now has the same context.

You (in Claude): "Update memory.wiki/abc123 with the improvements"
AI:  mw_update writes back to the same URL.
```

### URL forms

| Form | Pattern | When |
| --- | --- | --- |
| Doc | `memory.wiki/<id>` | Single document, 12-char nanoid |
| Bundle | `memory.wiki/b/<id>` | Curated set of docs |
| Hub | `memory.wiki/@<username>` | Full user hub (all public docs + bundles) |
| Raw | `memory.wiki/<id>.md` | Explicit markdown payload |

The `mw_for_ai` tool wraps any of these into the canonical "Use ... as my context." paste sentence so AI clients hand them off to each other without inventing their own phrasing.

## How Authentication Works

The MCP server shares credentials with the `mw` CLI:

1. `mw login` opens your browser for Google / GitHub OAuth
2. JWT token is stored locally in `~/.memory.wiki/config.json`
3. Edit tokens for each document are stored in `~/.memory.wiki/tokens.json`
4. All API requests use `Authorization: Bearer` headers
5. Tokens auto-refresh when expired (clear error message if re-login needed)

No email spoofing possible. All requests are authenticated via JWT.

## Features

- **Permanent URLs**. Every document gets a short URL (`memory.wiki/<id>`) that never expires.
- **Auto-managed edit tokens**. Create a doc, get edit access automatically.
- **Public or private**. Toggle visibility with `mw_publish`.
- **Markdown rendering**. Documents render with syntax highlighting, KaTeX math, Mermaid diagrams.
- **Version history**. All edits are tracked.
- **Zero config**. Just `npx memory-wiki-mcp`, no API keys needed.

## Other Channels

memory.wiki is available everywhere:

| Channel | Install |
|---------|---------|
| [Web Editor](https://memory.wiki) | Just open the URL |
| [CLI](https://www.npmjs.com/package/memory-wiki-cli) | `npm install -g memory-wiki-cli` |
| [VS Code Extension](https://memory.wiki/plugins) | Download .vsix from Plugins page |
| [Chrome Extension](https://memory.wiki/plugins) | Download from Plugins page |
| [Mac Desktop App](https://memory.wiki/plugins) | Download .dmg from Plugins page |

## Links

- Website: [memory.wiki](https://memory.wiki)
- Plugins: [memory.wiki/plugins](https://memory.wiki/plugins)
- API Docs: [memory.wiki/docs](https://memory.wiki/docs)
- GitHub: [github.com/raymindai/memory-wiki](https://github.com/raymindai/memory-wiki)

## License

MIT
