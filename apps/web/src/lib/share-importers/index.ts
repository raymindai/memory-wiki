/**
 * Share-link importer router.
 *
 * Detects which AI provider a share URL belongs to and dispatches to the
 * provider-specific extractor. Provider modules are added one at a time:
 * ChatGPT in W1, Claude + Gemini in W2.
 */

import { extractChatGPTShare } from "./chatgpt";
import { ShareImportError, type ShareImportResult, type ShareProvider } from "./types";

export { ShareImportError } from "./types";
export type { ShareImportResult, ShareProvider } from "./types";

export function detectProvider(input: string): ShareProvider | null {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
  if (host === "claude.ai") return "claude";
  if (host === "g.co" || host === "gemini.google.com" || host.endsWith(".bard.google.com"))
    return "gemini";
  return null;
}

export async function importShare(rawUrl: string): Promise<ShareImportResult> {
  const provider = detectProvider(rawUrl);
  if (!provider) {
    throw new ShareImportError(
      "We don't recognize that URL. Paste a public share link from ChatGPT, Claude, or Gemini.",
      { status: 400 }
    );
  }
  switch (provider) {
    case "chatgpt":
      return extractChatGPTShare(rawUrl);
    case "claude":
      throw new ShareImportError(
        "Claude shares can't be fetched server-side — Cloudflare blocks it. Use the mdfy bookmarklet on the chat page instead: https://memory.wiki/bookmarklet",
        { status: 501 }
      );
    case "gemini":
      throw new ShareImportError(
        "Gemini share-link import isn't available yet. For now, use the mdfy bookmarklet on the chat page: https://memory.wiki/bookmarklet",
        { status: 501 }
      );
  }
}
