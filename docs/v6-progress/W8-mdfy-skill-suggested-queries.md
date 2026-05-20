# W8: /memory.wiki slash skill (Claude Code) + suggested queries panel

**Commit.** `369e7755`. *W8: /memory.wiki slash skill (Claude Code) + suggested queries panel*

W8 ships two pieces from the Graphify playbook. The slash skill
rides the same `/<tool>` convention that proved scaleable across
Claude Code, Cursor, Codex, and Aider (44.3k stars). The suggested
queries panel mirrors how `GRAPH_REPORT.md` ends with productive
next-step questions, but personalized to each user's hub.

## Suggested queries panel

### What ships

`lib/hub-suggested-queries.ts` feeds the user's 25 most recent doc
titles plus a source-distribution sketch into the LLM (Anthropic >
OpenAI > Gemini), asks for exactly 5 specific questions paired
with one-line rationales. Strict JSON output, defensive parser.

Surfaces:

- `GET /api/user/hub/suggested-queries`. Owner-only. Computed on
demand.
- `/raw/hub/<slug>/suggested-queries.md`. Public Karpathy-shaped
surface for AI fetchers. 5-minute cache. Public hubs only.
- `vercel.json` rewrite: `/hub/<slug>/suggested-queries.md` to the
raw route.

### Verified live on yc-demo (25 docs)

5 specific, hub-aware questions returned. Examples:

- "What are the key technical risks in my Project Acme timeline and
how should I mitigate them?" -> rationale: "Combines project
planning documents with technical architecture to identify
potential bottlenecks before launch."
- "What memory architecture trade-offs should I consider between
Letta, Mem0, and OpenAI's approach?" -> rationale: "Uses
comparative research to make informed technical decisions for AI
memory implementation."

Each question ties to a real cluster of docs in the hub. Each
rationale explains why the question is productive given the hub's
current state.

The markdown surface renders as a proper `/raw/` page with the
same content under `# Suggested queries` heading and
question-as-section-heading layout.

### Files

| Path | Role |
| --- | --- |
| apps/web/src/lib/hub-suggested-queries.ts | Provider-chained generator + markdown formatter |
| apps/web/src/app/api/user/hub/suggested-queries/route.ts | Owner JSON endpoint |
| apps/web/src/app/raw/hub/[slug]/suggested-queries.md/route.ts | Public markdown surface |
| vercel.json | Rewrite for the canonical user-facing URL |

## /memory.wiki slash skill for Claude Code

### What ships

`public/skills/memory.wiki/SKILL.md` is the actual Claude Code skill. It
defines three actions:

- `/memory.wiki capture <title>`. Saves the most recent assistant message
(or a user-selected range) to the user's memory.wiki hub as a public
doc. Returns the URL the user can paste into any other AI.
- `/memory.wiki bundle <topic>`. Calls the AI Bundle Generation
endpoint with the topic, returns suggested doc ids and lets
the user accept.
- `/memory.wiki hub`. Returns the user's hub URL.

`public/skills/memory.wiki/install.sh` is a one-line installer that
drops `SKILL.md` into `~/.claude/skills/memory.wiki/`. Idempotent. Curl
or wget fallback. Public, served as a static asset from
`/skills/memory.wiki/install.sh`.

`/install` page: a landing with the install one-liner, the action
list, the why-this-matters paragraph, and links to the served
files for transparency.

Anonymous-first capture path is preserved. The skill uses
`Authorization: Bearer <token>` if the user has signed in, but
falls back to anonymous capture (which the cookie path from W3a
groups under the user's `mdfy_anon` cookie) if they haven't. On
sign-in the existing `/api/user/migrate` flow claims everything.

### Verified

- `/skills/memory.wiki/SKILL.md` served (3526 bytes, HTTP 200).
- `/skills/memory.wiki/install.sh` served (1079 bytes, HTTP 200).
- `/install` page renders with all three action descriptions and
the install command.

### Files

| Path | Role |
| --- | --- |
| apps/web/public/skills/memory.wiki/SKILL.md | The Claude Code skill itself |
| apps/web/public/skills/memory.wiki/install.sh | One-line installer |
| apps/web/src/app/install/page.tsx | Landing page with install instructions |

## Test status

All previous regression suites still pass: `test:share` 56/56,
`test:bookmarklet` 30/30, `test:diff` 13/13.

## Deferred

- **Cursor / Codex / Aider versions** of the skill. The [SKILL.md](http://SKILL.md)
shape ports across with minor adjustments. W9 and W10 work.
- **Programmatic auth flow**. Right now the user grabs a token
from the web app and exports it. A `memory.wiki login` flow that opens
a browser tab and stores the token in `~/.config/memory.wiki/token`
is post-launch.
- **In-app suggested queries panel**. Backend is wired; the React
component on the hub page is a separate UI chunk.
