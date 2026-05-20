// Server-side defense-in-depth against the welcome-overwrite race.
//
// Background: when the editor mounted while a cloud doc's body was
// still being fetched, Tiptap was seeded with the in-app welcome
// sample, autolinked it, fired onUpdate, and the autosave PATCHed
// the cloud doc with the sample body. We fixed the client (don't
// seed cloud tabs with SAMPLE_WELCOME, refuse autosave while the
// tab body is unhydrated) — this guard is the second layer that
// catches future client-side races before they corrupt data.
//
// Rule: the server REFUSES a save when the incoming markdown looks
// like a stock onboarding template AND the existing stored body is
// non-trivial AND meaningfully different from the template. Returns
// `false` (clean) or a reason string (refuse) so the caller can
// translate that into the right HTTP shape.
//
// Templates are identified by a stable opening signature. New
// templates can be added to `TEMPLATE_SIGNATURES` without changing
// callers.

const TEMPLATE_SIGNATURES = [
  // SAMPLE_WELCOME literal (no link) and its Tiptap-autolinked sibling.
  "# Welcome to memory.wiki\n\n> **The Markdown Hub.** Collect from anywhere",
  "# Welcome to [memory.wiki](http://memory.wiki)\n\n> **The Markdown Hub.** Collect from anywhere",
  "# Welcome to [memory.wiki](https://memory.wiki)\n\n> **The Markdown Hub.** Collect from anywhere",
];

const NORMALIZE_RE = /\s+/g;
function fingerprint(md: string, length = 80): string {
  return md.replace(NORMALIZE_RE, " ").trim().slice(0, length).toLowerCase();
}

const TEMPLATE_FINGERPRINTS = new Set(TEMPLATE_SIGNATURES.map((t) => fingerprint(t)));

/** True when the markdown opens with one of the known boilerplate templates. */
export function looksLikeTemplate(markdown: string | null | undefined): boolean {
  if (!markdown) return false;
  const fp = fingerprint(markdown);
  for (const tfp of TEMPLATE_FINGERPRINTS) {
    if (fp.startsWith(tfp)) return true;
  }
  return false;
}

export interface AntiTemplateInput {
  /** Body about to be written. */
  incomingMarkdown: string;
  /** Body currently stored on the row. */
  existingMarkdown: string | null | undefined;
}

export interface AntiTemplateRefusal {
  refuse: true;
  reason: "template_overwrite_blocked";
  message: string;
}
export interface AntiTemplateAllow {
  refuse: false;
}

/**
 * Decide whether to allow this write. The guard fires only when:
 *   1. the incoming body is a known template, AND
 *   2. the existing body is non-trivial (≥120 chars), AND
 *   3. the existing body is NOT itself a template (so re-saves of
 *      a doc that's still showing the template don't get blocked
 *      forever), AND
 *   4. the bodies are not byte-equal (so a no-op resave passes).
 *
 * If all four hold, the save is rejected. The doc keeps the
 * existing body and the client gets a clear error.
 */
export function evaluateAntiTemplateGuard(input: AntiTemplateInput): AntiTemplateRefusal | AntiTemplateAllow {
  const incoming = input.incomingMarkdown || "";
  const existing = input.existingMarkdown || "";
  if (!looksLikeTemplate(incoming)) return { refuse: false };
  if (existing.length < 120) return { refuse: false };
  if (looksLikeTemplate(existing)) return { refuse: false };
  if (incoming === existing) return { refuse: false };
  return {
    refuse: true,
    reason: "template_overwrite_blocked",
    message: "Refusing to overwrite real content with the welcome template. (anti-template guard fired)",
  };
}
