---
name: Memory.Wiki
description: Capture, retrieve, edit, bundle, and deploy AI conversations and notes through the user's personal Memory.Wiki hub. Use when the user wants to save this conversation as a URL, search what they already saved, pull a prior doc as context, build a curated bundle, or paste their hub as context into another AI tool.
---

# Memory.Wiki

You are operating inside a coding-AI tool (Claude Code, Cursor, Codex,
etc.). The user has installed the Memory.Wiki skill so they can keep this
conversation's output in their personal knowledge hub on Memory.Wiki and
pull prior work back into the current session.

The thesis: every URL on Memory.Wiki is markdown that any AI can fetch.
The user's hub is a single URL that aggregates everything they've
captured, auto-organised by concept. So `/memory.wiki capture` and `/memory.wiki pull`
together let the user move context across AI tools without copy-paste.

## When to invoke this skill

Invoke when the user says any of:

- "save this," "capture this," "send this to Memory.Wiki" — call `Memory.Wiki capture`
- "update / edit / replace doc <id>" — call `Memory.Wiki update`
- "search my hub for X" / "what do I have on X" — call `Memory.Wiki search`
- "what are my recent docs" / "list my docs" — call `Memory.Wiki list`
- "pull doc <id>" / "load <id>" / "use memory.wiki/<id> as context" — call `Memory.Wiki pull`
- "find related" / "what's in my hub about this topic" — call `Memory.Wiki related`
- "bundle these docs" / "make a bundle on X" — call `Memory.Wiki bundle`
- "what's my hub URL" / "give me my hub" — call `Memory.Wiki hub`

If none apply, do not call anything.

## Authentication

The user signs in via the web app at `https://memory.wiki`. The skill
reads their access token from `~/.memory.wiki/config.json` (written by the
`Memory.Wiki login` CLI). If the file is missing or empty, instruct the user
to install the CLI from `https://memory.wiki/install` and run `Memory.Wiki login`.

Capture works anonymously too (without a token) — the doc is created
under a session cookie and the user can claim it later by signing in.
Retrieve-side actions (search, list, recent, related) require login.

## Actions

### `Memory.Wiki capture <title>`

Save the most recent assistant message (or a user-selected range) to
Memory.Wiki as a new public document.

1. Resolve the conversation segment. Default: the last assistant
   message. If the user specified a range, use that range.
2. POST to `https://memory.wiki/api/docs`:
   ```
   { "markdown": "<segment>", "title": "<title>", "isDraft": false,
     "source": "claude-code-skill" }
   ```
   Include `Authorization: Bearer <token>` if available.
3. Return the new URL `https://memory.wiki/<id>` to the user. Tell them
   they can paste it into any other AI as context.

### `Memory.Wiki update <id> [section]`

Edit an existing doc. Two modes:

- **Full replace**: replace the whole body. Useful when the user
  rewrites the doc inline.
  PATCH `https://memory.wiki/api/docs/<id>` with
  `{ "action": "auto-save", "markdown": "<new>", "editToken": "<token>" }`.
  Token is from `~/.memory.wiki/tokens.json` for this id.

- **Section replace**: when the user says "update the X section of doc
  <id>", first GET the doc, find the heading "X" (case-insensitive),
  replace just that section's body, then PATCH the whole doc back.

Always echo the URL after the update so the user can verify.

### `Memory.Wiki search <query>`

Full-text search across the user's hub.

1. GET `https://memory.wiki/api/search?q=<query>` with bearer token.
2. Return the top 5–10 hits formatted as:
   ```
   - **<title>** (memory.wiki/<id>) — <snippet>
   ```
3. Ask whether the user wants to pull any of them into the current
   session as context (call `Memory.Wiki pull <id>` if yes).

### `Memory.Wiki list`

Show the user's recent docs.

1. GET `https://memory.wiki/api/user/recent` with bearer token.
2. Return up to 20 entries, newest first, as a numbered list.
   Include the doc id so the user can reference them with other
   actions.

### `Memory.Wiki pull <id>`

Fetch a saved doc and use its content as context for the rest of the
current conversation.

1. GET `https://memory.wiki/<id>.md` (raw markdown form; no auth needed
   for public docs).
2. If the response is `404` or `410` (expired/restricted), tell the
   user the doc is private — they need to sign in or check sharing.
3. Otherwise insert the fetched markdown into the conversation as a
   system note: `Loaded memory.wiki/<id> ("<title>") as context.` Then
   answer the user's next question using the loaded content.

### `Memory.Wiki related`

Find docs in the user's hub that are conceptually related to the
current conversation topic.

1. Derive a short topic phrase from the recent assistant message (one
   or two of the most-mentioned concepts).
2. GET `https://memory.wiki/api/search?q=<phrase>` with bearer token.
3. Return matches the user might want to pull. Frame it as
   "Related docs in your hub: ..." and offer to pull any of them.

### `Memory.Wiki bundle <topic>`

Generate a bundle that groups docs the user already saved on a topic
into one URL with cross-doc analysis.

1. POST `https://memory.wiki/api/bundles/ai-generate` with
   `{ "intent": "<topic>" }` and the bearer token.
2. The endpoint returns suggested doc ids + annotations. Show them.
3. If the user accepts, POST `https://memory.wiki/api/bundles` with the
   doc ids.
4. Return `https://memory.wiki/b/<id>` — that single URL now carries the
   doc set + computed themes/insights when fetched.

### `Memory.Wiki hub`

Return the user's hub URL. They paste it into another AI for full
personal context.

1. GET `https://memory.wiki/api/user/profile` with bearer token.
2. If `hub_slug` is set and `hub_public` is true, return
   `https://memory.wiki/hub/<hub_slug>`.
3. Otherwise tell the user to enable their hub at
   `https://memory.wiki/settings`.

## Cross-tool flow (the wedge use case)

The typical pattern this skill enables:

1. User chats with Claude/ChatGPT/Gemini → output worth keeping.
2. `Memory.Wiki capture <title>` → saved as `memory.wiki/<id>`.
3. User opens a different AI tool (Cursor, Codex, etc.) on the same
   project, drops `memory.wiki/<id>` or `memory.wiki/hub/<slug>` into its
   context file or pastes into the chat → that tool sees the prior
   work without copy-paste.
4. Tomorrow's session uses `/memory.wiki pull <id>` or `/memory.wiki related` to
   resurface prior context.

The user does not have to think about Notion/Obsidian sync, vendor
SDKs, or extracted-memory feeds — every saved URL is plain markdown
fetchable by any AI.

## Tips for the model

- Always paste the resulting URL exactly. Don't reformat or shorten it.
- For `Memory.Wiki capture`, choose a title that captures the question or
  the conclusion, not "Conversation about X."
- For `Memory.Wiki update`, prefer section-level replace over full-body
  replace whenever the user's request fits one heading — it's safer
  and preserves the rest of the doc verbatim.
- `Memory.Wiki pull` returns markdown. Quote it back to the user when
  answering questions about it, citing the URL.

## Reference

- Web app: https://memory.wiki
- Example hub: https://memory.wiki/hub/demo
- Bundle Spec: https://memory.wiki/spec
- Install CLI: https://memory.wiki/install
