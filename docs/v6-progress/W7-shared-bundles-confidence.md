# W7: shared bundles MVP + confidence tags on synthesis

**Commit.** `ae0b33fd`. *W7: shared bundles MVP + confidence tags on synthesis*

W7 lays the foundation for the launch's biggest single exceed move
(community-mode hubs, building toward W11+W12 social bundles) plus
adds Graphify-style provenance markers on every wiki synthesis.

## Shared bundles MVP

### What was already there

The `bundles` table already has `allowed_emails` and
`allowed_editors` columns, and `/api/bundles` POST / PATCH already
accept them. Setting a list works. Reading respected drafts and
passwords but ignored the email allowlist.

### What W7 adds

Two endpoints now enforce the gate.

`/api/bundles/[id]` GET. When `allowed_emails` is non-empty, the
requester must be the owner OR have a verified JWT email / valid
`X-User-Email` header that matches the list. Otherwise the response
is 403 with `restricted: true` so the client can render a
"shared with specific people" state.

`/raw/bundle/[id]` GET. Same logic. Identity comes from the
`Authorization` JWT or the `X-User-Email` header. Without either,
the response is 403 with a hint that AI agents acting on behalf of
a person should pass the header.

### Verified end-to-end

Live on yc-demo's *memory.wiki Launch Pack* bundle
(`allowed_emails = ["yc@mdfy.app", "partner@ycombinator.com"]`):

| Path | Caller | Expected | Got |
|------|--------|----------|-----|
| `/api/bundles/ycb04eZM` | anonymous | 403 | 403 |
| `/api/bundles/ycb04eZM` | `X-User-Email: partner@ycombinator.com` | 200 | 200 |
| `/api/bundles/ycb04eZM` | `X-User-Email: random@example.com` | 403 | 403 |
| `/api/bundles/ycb04eZM` | owner JWT (`yc@mdfy.app`) | 200 | 200 |
| `/raw/bundle/ycb04eZM` | no email | 403 | 403 |
| `/raw/bundle/ycb04eZM` | allowed email | 200 | 200 |
| `/raw/bundle/ycb04eZM` | unauthorized email | 403 | 403 |

This is the capability Karpathy and Graphify both lack: the same
URL respects the same rules whether the reader is a human (gets
the rendered HTML) or an AI (gets the markdown payload via
`/raw/`).

### Files

| Path | Role |
|------|------|
| `apps/web/src/app/api/bundles/[id]/route.ts` | Email gate on JSON GET |
| `apps/web/src/app/raw/bundle/[id]/route.ts` | Email gate on AI fetcher path |

## Confidence tags

### What ships

`WIKI_PROMPT` (W4 synthesis) now requires every "Key claims" bullet
to start with `[EXTRACTED]`, `[INFERRED]`, or `[AMBIGUOUS]`:

- `[EXTRACTED]`: the docs say this directly. Quote or close
  paraphrase.
- `[INFERRED]`: the docs collectively imply this, but no single
  sentence states it.
- `[AMBIGUOUS]`: evidence is partial or split across docs.

Tags are constrained to the Key claims section. No spillover into
cross-references or provenance.

This is Graphify's confidence convention (`EXTRACTED` /
`INFERRED` / `AMBIGUOUS`) brought into memory.wiki synthesis output. Hub
readers and AI fetchers can skim a synthesis and immediately tell
which claims are direct vs derived vs unsettled.

### Verified end-to-end

Fresh wiki synthesis on a 2-doc test bundle (Mem0 / Letta memory
architectures):

- 4 `[EXTRACTED]` claims (direct quotes / paraphrases with
  `[doc-N]` citations)
- 1 `[INFERRED]` claim (logical implication across both docs)
- 1 `[AMBIGUOUS]` claim (evidence is partial)

Tags appeared only in Key claims. The Cross-references and Open
questions sections stayed clean.

### Files

| Path | Role |
|------|------|
| `apps/web/src/lib/synthesize.ts` | Updated WIKI_PROMPT |

## Test status

All previous regression suites still pass: `test:share` 56/56,
`test:bookmarklet` 30/30, `test:diff` 13/13.

## Deferred

- **UI for setting allowed_emails on bundle creation.** The
  BundleCreatorModal supports it but the UX is bare. Polish in W8 or
  W12.
- **Notification on share** ("user X added you to bundle Y"). Email
  / in-app. Post-launch.
- **Confidence tag UI rendering.** Currently raw markdown text. A
  pretty pill rendering on the doc viewer (green for EXTRACTED,
  yellow for INFERRED, red for AMBIGUOUS) is a follow-up. AI
  fetchers see them as plain bracketed text already.
- **Confidence tags in graph_data.** The bundle graph still has
  un-tagged insights / themes / claims. Aligning the graph
  extractor to also emit tags is a separate W8+ piece.
