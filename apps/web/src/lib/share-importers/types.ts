/**
 * Shared types for share-link importers.
 *
 * Each provider extractor turns a public AI conversation share URL
 * (ChatGPT, Claude, Gemini) into clean markdown that Memory.Wiki can save
 * as a Document.
 */

export type ShareProvider = "chatgpt" | "claude" | "gemini";

export interface ShareImportResult {
  /** Provider that produced the conversation. */
  provider: ShareProvider;
  /** Original share URL (canonicalized). */
  sourceUrl: string;
  /** Conversation rendered as mdfy-friendly markdown. */
  markdown: string;
  /** Best-effort title — page title, conversation title, or first message snippet. */
  title: string;
  /** Number of message turns extracted (informational, for UI). */
  turns: number;
}

export class ShareImportError extends Error {
  status: number;
  /** Human-readable reason safe to surface to a non-technical user. */
  userMessage: string;
  constructor(userMessage: string, opts?: { status?: number; cause?: unknown }) {
    super(userMessage, { cause: opts?.cause });
    this.userMessage = userMessage;
    this.status = opts?.status ?? 502;
  }
}
