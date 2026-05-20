import { NextResponse } from "next/server";

// Permission-aware responses for /raw/* AI-fetch endpoints.
//
// AI clients (Claude, ChatGPT, Cursor, Codex, Aider) hit /raw/* expecting
// a markdown body. When access is denied we still return markdown, with:
//   - A frontmatter block so the AI can parse `mdfy_permission` and
//     `reason` programmatically.
//   - Headers (X-Mdfy-Permission, X-Mdfy-Required) so a smart client can
//     automate recovery without scraping the body.
//   - A short instructions block in markdown explaining what header /
//     auth the client should pass on retry.

export type PermissionReason =
  | "draft"
  | "deleted"
  | "not_found"
  | "expired"
  | "password_protected"
  | "email_restricted"
  | "service_unavailable";

const TITLE_BY_REASON: Record<PermissionReason, string> = {
  draft: "Private",
  deleted: "Removed",
  not_found: "Not found",
  expired: "Expired",
  password_protected: "Password protected",
  email_restricted: "Restricted to specific people",
  service_unavailable: "Service unavailable",
};

const STATUS_BY_REASON: Record<PermissionReason, number> = {
  draft: 404,
  deleted: 404,
  not_found: 404,
  expired: 410,
  password_protected: 401,
  email_restricted: 403,
  service_unavailable: 503,
};

function instructionsFor(reason: PermissionReason, canonicalUrl: string): string {
  switch (reason) {
    case "password_protected":
      return [
        "This document is password-protected. The raw markdown endpoint",
        "intentionally cannot accept passwords. To read it, open the URL",
        `directly in a browser: ${canonicalUrl}`,
      ].join("\n");
    case "email_restricted":
      return [
        "This resource is shared with specific people. To read it as an",
        "AI agent, retry with one of:",
        "",
        "  - `Authorization: Bearer <user_token>` if the user is signed in",
        "    at https://staging.memory.wiki and you have their token from",
        "    `~/.config/memory.wiki/token`.",
        "  - `X-User-Email: <user_email>` if you only have the user's email",
        "    on hand and they're already on the bundle's allow-list.",
      ].join("\n");
    case "expired":
      return [
        "This document had an expiry timestamp set by its author and the",
        "expiry has passed. There is no retry path; ask the user whether",
        "they still have a copy or want to republish.",
      ].join("\n");
    case "draft":
      return [
        `This resource at ${canonicalUrl} is still private. The author`,
        "has not published it yet. Ask them to publish, or sign in as the",
        "owner with `Authorization: Bearer <user_token>`.",
      ].join("\n");
    case "deleted":
    case "not_found":
      return [
        `No public resource at ${canonicalUrl}. The author may have moved`,
        "or unpublished it.",
      ].join("\n");
    case "service_unavailable":
      return "The Memory.Wiki backend is temporarily unavailable. Try again shortly.";
  }
}

interface PermissionResponseOptions {
  reason: PermissionReason;
  canonicalUrl: string;
  resourceKind: "doc" | "bundle";
  resourceId?: string;
}

export function permissionResponse(opts: PermissionResponseOptions): NextResponse {
  const { reason, canonicalUrl, resourceKind, resourceId } = opts;
  const status = STATUS_BY_REASON[reason];
  const title = TITLE_BY_REASON[reason];

  const frontmatter = [
    "---",
    "mdfy_error: 1",
    `mdfy_permission: ${reason}`,
    `kind: ${resourceKind}`,
    resourceId ? `id: ${resourceId}` : null,
    `url: ${canonicalUrl}`,
    'source: "Memory.Wiki"',
    "---",
    "",
  ].filter(Boolean).join("\n");

  const body = [
    frontmatter,
    `# ${title}`,
    "",
    instructionsFor(reason, canonicalUrl),
    "",
  ].join("\n");

  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Mdfy-Permission": reason,
      "X-Mdfy-Resource": resourceKind,
      "Link": `<${canonicalUrl}>; rel="canonical"`,
    },
  });
}
