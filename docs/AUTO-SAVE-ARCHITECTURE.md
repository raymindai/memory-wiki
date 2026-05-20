# Auto-Save Document Architecture

> Last updated: 2026-04-01

## Overview

All documents are automatically saved to Supabase. No manual "save" step. Every document gets a permanent URL (`memory.wiki/{id}`) from the moment it's created.

## User Identity

| State | Identity | How |
|-------|----------|-----|
| Not logged in | `anonymous_id` | UUID in localStorage, created on first document |
| Logged in | `user_id` | Supabase Auth (Google/GitHub/Email) |
| Sign-up transition | Migration | `POST /api/user/migrate` moves anonymous docs to user account |

### Anonymous ID Lifecycle
1. User creates first document without login → `ensureAnonymousId()` generates UUID
2. UUID stored in localStorage as `mw-anon-id`
3. All documents created with this UUID in `documents.anonymous_id`
4. On sign-up → `/api/user/migrate` sets `user_id` and clears `anonymous_id`
5. `clearAnonymousId()` removes from localStorage

## Document Lifecycle

```
New Tab → POST /api/docs (is_draft: true) → cloudId assigned
    ↓
Typing → debounced PATCH /api/docs/{id} (action: "auto-save", 2.5s)
    ↓
Share → PATCH /api/docs/{id} (action: "publish") → is_draft: false
    ↓
Update → PATCH /api/docs/{id} (creates version history entry)
```

## Edit Modes

| Mode | Who can edit | When |
|------|-------------|------|
| `token` | edit_token holder + owner | Default for anonymous users |
| `account` | user_id owner only | Default for logged-in users |
| `public` | Anyone | User-configured |

## Permission Badges (Sidebar)

| Icon | Permission | Meaning |
|------|-----------|---------|
| 📄 (document) | `mine` | I own this document |
| 🔗 (network) | `editable` | Someone else's, I can edit (public mode) |
| 👁 (eye) | `readonly` | Someone else's, view only |

## API Endpoints

### Documents

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/docs` | Create document (supports `anonymousId`, `isDraft`) |
| `GET` | `/api/docs/{id}` | Get document (checks ownership via `x-user-id` or `x-anonymous-id`) |
| `PATCH` | `/api/docs/{id}` | Update document |
| `DELETE` | `/api/docs/{id}` | Delete document (supports `anonymousId` auth) |

### PATCH Actions

| Action | Purpose | Version History |
|--------|---------|----------------|
| `auto-save` | Debounced typing save | No |
| `publish` | Flip `is_draft` to false | No |
| `rotate-token` | New edit token | No |
| `change-edit-mode` | Change permission mode | No |
| (default) | Explicit update | Yes |

### User

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/user/documents` | List my documents (supports `x-anonymous-id`) |
| `POST` | `/api/user/visit` | Record document visit |
| `GET` | `/api/user/recent` | Get 30 most recent visited docs |
| `POST` | `/api/user/migrate` | Move anonymous docs to user account |

## Supabase Schema Changes

```sql
-- Documents table additions
ALTER TABLE documents ADD COLUMN anonymous_id text;
ALTER TABLE documents ADD COLUMN is_draft boolean DEFAULT false;
CREATE INDEX idx_documents_anonymous_id ON documents(anonymous_id);

-- Visit history table
CREATE TABLE visit_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id text REFERENCES documents(id) ON DELETE CASCADE,
  last_visited_at timestamptz DEFAULT now(),
  UNIQUE(user_id, document_id)
);
CREATE INDEX idx_visit_history_user ON visit_history(user_id, last_visited_at DESC);
```

## Client-Side Components

### `useAutoSave` Hook
- `createDocument(args)` — POST new document, returns `{ id, editToken }`
- `scheduleSave(args)` — debounced PATCH (2.5s), with inflight queue
- `cancel()` — cancel pending save
- State: `{ isSaving, lastSaved, error }`

### `anonymous-id.ts`
- `getAnonymousId()` — returns existing ID or empty string
- `ensureAnonymousId()` — returns existing ID or creates new one
- `clearAnonymousId()` — removes from localStorage

### MdEditor Integration
- `addTab()` → immediately creates server document, assigns cloudId
- `setMarkdown()` → triggers `autoSave.scheduleSave()` on every change
- URL bar shows `memory.wiki/{cloudId}`, click to copy, "Saving..." / "Saved" status
- Sidebar: permission badges on all document icons
- Recently Visited section for logged-in users
- Tab migration: existing localStorage tabs get cloudIds on first load (max 5)
- Auth migration: anonymous docs migrate to account on sign-in

## Sidebar Structure

```
My Documents
  📁 Folder
    📄 My Doc
    👁 Bookmarked (read-only)
    🔗 Shared (editable)
  📄 Root Doc

Recently Visited (logged-in only)
  👁 Someone's Doc
  🔗 Public Doc

Trash
  📄 Deleted Doc
```

## Security & Safety

### Draft Protection
- `is_draft: true` documents return 404 to non-owners on GET
- SSR viewer (`/d/[id]`) returns null (404 page) for drafts
- API GET checks owner by `x-user-id` or `x-anonymous-id` header
- Embed viewer uses API, so inherits the same protection

### Expiry Enforcement
- GET: returns 410 for expired docs
- PATCH (auto-save): returns 410 for expired docs
- PATCH (default update): returns 410 for expired docs

### Permission Model (auto-save)
- `owner`/`account` mode: only owner (user_id or anonymous_id) can save
- `token` mode: owner OR edit_token holder can save
- `public` mode: anyone can save

### Password-Protected Documents
- Viewer stores password in `sessionStorage` when user clicks Edit
- Editor reads from `sessionStorage` and sends via `x-document-password` header
- One-time use: cleared after reading

### Page Unload Safety
- `beforeunload` handler uses `navigator.sendBeacon` to flush pending auto-save
- Ensures last edit is saved even on refresh/close

### Orphan Document Cleanup
- `POST /api/cleanup` deletes anonymous drafts older than 7 days
- Protected by `CLEANUP_SECRET` env var
- Intended for cron (e.g., Vercel Cron daily)

## QA Fixes Applied

| Issue | Fix |
|-------|-----|
| `?from=` loading before auth resolves | Wait for `authLoading` to be false |
| Migration fires on every page load | Track sign-in transition via `prevUserRef` (undefined→"" vs ""→userId) |
| `getAnonymousId()` always creates ID | Split into `getAnonymousId()` (read) and `ensureAnonymousId()` (create) |
| Tab migration hits rate limit | Cap at 5 tabs per migration |
| Inflight save drops latest content | Queue pending save, retry after inflight completes |
| `recentDocs` fetch on every tab change | Only fetch once on auth ready |
| `lastSaved` lost on error | Preserve previous `lastSaved` on failure |
