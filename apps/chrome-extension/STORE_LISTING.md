# Chrome Web Store listing — memory.wiki Clipper

Canonical copy for the Web Store dashboard. Update here BEFORE editing the
dashboard so the repo version stays the source of truth.

## Extension name

memory.wiki Clipper

## Short description (132 chars max)

```
Save pages, AI chats, social posts, images to a memory.wiki URL any AI reads. Per-site capture suggestions, AI transforms.
```

(122 chars — also lives in manifest.json `description` so the two stay in sync.)

## Detailed description (16,000 chars max)

```
memory.wiki Clipper is the Chrome companion to memory.wiki on the web. Tell the extension what you want — it captures the page and writes it as a clean memory.wiki URL any AI tool can read.

The headline: Per-site Intent Capture

Open the popup on YouTube and the first chip is "Summarize from transcript." On arXiv: "Abstract + contributions." On Stack Overflow: "Accepted answer + code." On GitHub: "README in 5 bullets." 24+ sites have hand-tuned intent suggestions out of the box. Click a chip, capture, done — no typing.

For sites without a curated chip, type whatever you want ("action items as a checklist", "Cursor-ready reference", "rewrite for a teammate", "TL;DR in 2 sentences") and the extension runs that intent against the page before saving. Your prompt, your call.

What it captures

- Any web page (Readability extracts the article body, drops nav and ads).
- The current selection (highlight, click capture — only the selected text saves).
- AI chats end to end (ChatGPT, Claude, Gemini, Perplexity — user and assistant turns preserved with proper formatting).
- Per-message capture from inside AI chats (hover any message, click the inline "Save" button).
- Social posts (X, Threads, Reddit, Hacker News, Medium, Substack) with the post body, author, and embedded media intact.
- GitHub .md files (rendered as a memory.wiki URL with KaTeX, Mermaid, syntax-highlighted code).

What lands on memory.wiki

Every capture publishes as a clean Markdown document and gets a permanent memory.wiki URL like memory.wiki/abc123. That URL serves the same Markdown payload to every AI tool — Claude, ChatGPT, Cursor, Gemini, Perplexity, Codex — so pasting the URL into any model gives that model your captured context.

After every capture, the sentence "Use memory.wiki/abc123 as my context." is copied to your clipboard. Paste-into-next-AI is one keystroke.

What's new in 2.7

- Per-site Intent Capture (24+ curated sites).
- Chip rail wraps at the ends, no more dead clicks.
- X quote-tweet body leak fixed (captures the focal tweet, not the quoted one).
- Threads long-post body extraction fixed (falls back to og:description on permalinks).
- Add button no longer covers the pencil or more-menu icons on social sites.

Keyboard shortcuts

- Cmd+Shift+E (Ctrl+Shift+E on Windows) — capture the current page.
- Cmd+Shift+X — capture only the highlighted selection.

What this extension is NOT

It is a capture surface, not the full memory.wiki product. Editing existing documents, organising into bundles and hubs, the AI chat panel, account management, and sharing permissions all live on memory.wiki on the web. Use the extension to feed material in, then jump to memory.wiki to organise and share.

Account

No login required for one-off captures. Sign in (free during beta, sign up at memory.wiki) to attach captures to your account, search across them, and keep them in sync with the Mac, iOS, Android, VS Code, and CLI surfaces.

Privacy

No tracking. No third-party data sharing. No ads. Source on GitHub at github.com/raymindai/memory-wiki. The extension only contacts memory.wiki for publishing and the AI providers your captures route through (Claude or GPT for intent transforms) — see memory.wiki/privacy for the full policy.
```

## Category

Productivity

## Language

English (default)

## Other store fields

- Single purpose: capture web content as memory.wiki Markdown URLs.
- Privacy policy URL: https://memory.wiki/privacy
- Support email: hi@raymind.ai
- Website: https://memory.wiki
