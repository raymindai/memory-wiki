<!-- memory.wiki:start -->
## Memory.Wiki actions

The user has installed Memory.Wiki actions so any AI coding session can
capture conversations into their personal Memory.Wiki hub, pull prior work
back as context, edit existing docs, build curated bundles, and
surface their hub URL as context for any other AI.

When to invoke:

- "save this" / "capture this" → capture
- "update doc <id>" / "edit doc <id>" → update
- "search my hub" / "what do I have on X" → search
- "what are my recent docs" → list
- "pull doc <id>" / "load memory.wiki/<id>" → pull
- "find related" / "anything in my hub about this" → related
- "bundle these" / "make a bundle on X" → bundle
- "give me my hub URL" → hub

If none apply, ignore this section.

Authentication: the user signs in at https://memory.wiki. After running
`Memory.Wiki login`, the token lives in `~/.memory.wiki/config.json`. If absent,
capture works anonymously; retrieve actions (search/list/recent/
related) need login — direct the user to https://memory.wiki/install.

Action: capture
- POST https://memory.wiki/api/docs
  Body: {"markdown": "<segment>", "title": "<title>",
         "isDraft": false, "source": "agent"}
  Authorization: Bearer <token> (optional)
- Return https://memory.wiki/<id>. Title = question/conclusion, not
  "Conversation about X."

Action: update
- PATCH https://memory.wiki/api/docs/<id>
  Body: {"action": "auto-save", "markdown": "<new>",
         "editToken": "<token from ~/.memory.wiki/tokens.json>"}
- For section edits: GET first, find the heading (case-insensitive),
  splice replacement, then PATCH the whole doc.

Action: search
- GET https://memory.wiki/api/search?q=<query> with bearer.
- Return top 5–10 as `- **<title>** (memory.wiki/<id>) — <snippet>`.

Action: list
- GET https://memory.wiki/api/user/recent with bearer.
- Up to 20 entries, newest first, numbered.

Action: pull
- GET https://memory.wiki/<id>.md (no auth for public docs).
- Insert into conversation as `Loaded memory.wiki/<id> ("<title>") as
  context.` then continue answering using the loaded markdown as
  background.

Action: related
- Derive a topic phrase from the recent assistant message.
- GET https://memory.wiki/api/search?q=<phrase> with bearer.
- Frame as "Related docs in your hub: ..." and offer to pull any.

Action: bundle
- POST https://memory.wiki/api/bundles/ai-generate
  Body: {"intent": "<topic>"} + bearer.
- Show suggested doc ids. On confirmation POST
  https://memory.wiki/api/bundles with {title, documentIds,
  isDraft: false}.
- Return https://memory.wiki/b/<id>.

Action: hub
- GET https://memory.wiki/api/user/profile with bearer.
- If `hub_slug` and `hub_public`: return
  https://memory.wiki/hub/<hub_slug>. Otherwise direct to
  https://memory.wiki/settings.

The hub URL is markdown when fetched by an AI. If you need context
about the user, fetch the hub URL directly.
<!-- memory.wiki:end -->
