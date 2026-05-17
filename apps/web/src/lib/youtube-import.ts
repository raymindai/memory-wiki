// YouTube import — turn a youtube.com / youtu.be URL into a markdown
// document made of (a) oEmbed metadata (title, channel) and (b) the
// video's transcript, scraped from the watch page's captionTracks.
//
// No 3rd-party deps:
//   - oEmbed is a public no-auth GET
//   - transcript = fetch the watch page HTML, find captionTracks JSON,
//     fetch the first track's baseUrl (XML), parse <text> lines.
// Fragile (YouTube can rearrange page layout) but it's the same
// approach every open-source transcript library uses.

export interface YouTubeImportResult {
  title: string;
  channel: string;
  channelUrl: string | null;
  videoId: string;
  videoUrl: string;
  description: string | null;
  thumbnailUrl: string | null;
  transcript: string;
  transcriptAvailable: boolean;
  /** The assembled markdown ready to save as a draft doc. */
  markdown: string;
  host: "youtube.com";
}

export class YouTubeImportError extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}

const WATCH_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Match youtube.com/watch?v= / youtu.be/ / youtube.com/shorts/ /
 *  youtube.com/embed/ . Returns null when the URL isn't a YouTube
 *  video URL. */
export function extractYouTubeVideoId(rawUrl: string): string | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") {
      const v = u.searchParams.get("v");
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1] && /^[\w-]{11}$/.test(parts[1])) return parts[1];
    if (parts[0] === "embed" && parts[1] && /^[\w-]{11}$/.test(parts[1])) return parts[1];
  }
  return null;
}

export function isYouTubeUrl(rawUrl: string): boolean {
  return extractYouTubeVideoId(rawUrl) !== null;
}

export interface YouTubeImportProgress {
  onMetadata?: () => void;
  onTranscriptStart?: () => void;
  onDone?: () => void;
}

export async function importFromYouTube(
  rawUrl: string,
  progress: YouTubeImportProgress = {},
): Promise<YouTubeImportResult> {
  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId) throw new YouTubeImportError("Not a recognisable YouTube URL", 400);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Step 1 — oEmbed for metadata. Cheap, no auth, gives a clean title +
  // channel name. Falls back gracefully if oEmbed itself is blocked
  // (extracts from the watch page later).
  let title = "Untitled video";
  let channel = "YouTube";
  let channelUrl: string | null = null;
  let thumbnailUrl: string | null = null;
  try {
    const oRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, {
      headers: { "User-Agent": WATCH_UA },
    });
    if (oRes.ok) {
      const o = await oRes.json();
      if (typeof o.title === "string") title = o.title;
      if (typeof o.author_name === "string") channel = o.author_name;
      if (typeof o.author_url === "string") channelUrl = o.author_url;
      if (typeof o.thumbnail_url === "string") thumbnailUrl = o.thumbnail_url;
    }
  } catch { /* fall through — we'll backfill from watch page if missing */ }
  progress.onMetadata?.();

  // Step 2 — fetch the watch page (needed for transcript captionTracks
  // and for description backfill).
  progress.onTranscriptStart?.();
  let watchHtml = "";
  try {
    const wRes = await fetch(videoUrl, {
      headers: { "User-Agent": WATCH_UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (wRes.ok) watchHtml = await wRes.text();
  } catch { /* if this fails we just have metadata */ }

  // Backfill description from og:description (oEmbed doesn't include it).
  let description: string | null = null;
  if (watchHtml) {
    const m = watchHtml.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
              watchHtml.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
    if (m) description = decodeHtmlEntities(m[1]).trim() || null;
  }

  // Step 3 — extract the transcript.
  //
  // Path A (preferred, works in 2026): hit /youtubei/v1/player with the
  // ANDROID client. The web-page captionTracks baseUrl is signed but
  // YouTube's anti-scraping returns 200 with an empty body for those
  // signed URLs when the request doesn't come from a real browser
  // session (the bot-block they tightened in 2024). The ANDROID client
  // returns a NEW set of baseUrls in the same response that actually
  // serve content — same workaround the modern youtube-transcript libs
  // use. We then fetch with &fmt=json3 for clean JSON.
  //
  // Path B (fallback): the legacy watch-page scrape. Kept as a backup
  // for cases where the Android endpoint shape changes overnight.
  let transcript = "";
  let transcriptAvailable = false;
  try {
    transcript = await fetchTranscriptViaAndroidPlayer(videoId);
    transcriptAvailable = transcript.length > 0;
  } catch (err) {
    console.warn("youtube-import: android-player transcript fetch failed", err instanceof Error ? err.message : err);
  }
  if (!transcriptAvailable && watchHtml) {
    try {
      transcript = await fetchTranscript(watchHtml);
      transcriptAvailable = transcript.length > 0;
    } catch (err) {
      console.warn("youtube-import: legacy transcript fetch failed", err instanceof Error ? err.message : err);
    }
  }

  // Step 4 — assemble markdown.
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  const channelLink = channelUrl ? `[${channel}](${channelUrl})` : channel;
  lines.push(`${channelLink} / YouTube / [Watch on YouTube](${videoUrl})`);
  lines.push("");
  if (thumbnailUrl) {
    lines.push(`![${title}](${thumbnailUrl})`);
    lines.push("");
  }
  if (description) {
    lines.push("## Description");
    lines.push("");
    lines.push(description);
    lines.push("");
  }
  lines.push("## Transcript");
  lines.push("");
  if (transcriptAvailable) {
    lines.push(transcript);
  } else {
    // YouTube tightened access to the public timedtext endpoint in
    // 2024 — bot-like fetches get a 200 with an empty body. Until
    // we ship an innertube-emulating fetcher, fall back to a clear
    // pointer so the user knows it isn't a mdfy bug.
    lines.push("_Transcript not auto-fetched — YouTube restricts public access to caption data. Open the video's transcript panel on YouTube, copy, and paste below._");
  }
  lines.push("");

  progress.onDone?.();

  return {
    title,
    channel,
    channelUrl,
    videoId,
    videoUrl,
    description,
    thumbnailUrl,
    transcript,
    transcriptAvailable,
    markdown: lines.join("\n").trim() + "\n",
    host: "youtube.com",
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

const ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";
const ANDROID_CLIENT_NAME = "ANDROID";
const ANDROID_CLIENT_VERSION = "20.10.38";

/** Modern transcript path. POSTs the ANDROID client payload to
 *  /youtubei/v1/player and pulls captionTracks out of the response —
 *  those baseUrls actually serve content (unlike the bot-blocked
 *  watch-page ones). Picks the best track (English → original ASR →
 *  first available), fetches as json3, parses events to plain text. */
async function fetchTranscriptViaAndroidPlayer(videoId: string): Promise<string> {
  const body = {
    context: {
      client: {
        clientName: ANDROID_CLIENT_NAME,
        clientVersion: ANDROID_CLIENT_VERSION,
        androidSdkVersion: 30,
        userAgent: ANDROID_UA,
        hl: "en",
        gl: "US",
        platform: "MOBILE",
      },
    },
    videoId,
  };
  const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ANDROID_UA,
      "X-YouTube-Client-Name": "3",
      "X-YouTube-Client-Version": ANDROID_CLIENT_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return "";
  const j = await res.json().catch(() => null) as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string }> } } } | null;
  const tracks = j?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) return "";

  const pick =
    tracks.find((t) => t.languageCode === "en" && !t.kind) ||
    tracks.find((t) => t.languageCode === "en") ||
    tracks.find((t) => !t.kind) ||
    tracks[0];
  if (!pick?.baseUrl) return "";

  // YouTube ignores ?fmt=json3 from the Android-issued baseUrls in
  // 2026 and serves format-3 XML regardless — same response, different
  // structure from the legacy `<text>` blocks. Parse it directly:
  //
  //   <p t="80" d="4239"><s>안녕</s><s t="680"> 하세요</s></p>
  //                                      ^ next-segment offset (ignored)
  const tRes = await fetch(pick.baseUrl, { headers: { "User-Agent": ANDROID_UA } });
  if (!tRes.ok) return "";
  const xml = await tRes.text();
  if (!xml) return "";

  const lines = parseTimedtextXml(xml);
  if (lines.length === 0) return "";
  // Same paragraph grouping as the legacy path — readable prose
  // instead of 200 newline-separated fragments.
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 10) {
    chunks.push(lines.slice(i, i + 10).join(" "));
  }
  return chunks.join("\n\n");
}

/** Parse a YouTube timedtext XML payload into ordered caption lines.
 *  Handles both formats served in 2026:
 *
 *    Legacy: <text start="0" dur="3">Hello</text>
 *    Format 3: <p t="80" d="4239"><s>Hello</s><s t="680"> world</s></p>
 *
 *  Returns one trimmed line per caption frame, empties dropped. */
function parseTimedtextXml(xml: string): string[] {
  const lines: string[] = [];
  // Format-3 paragraphs — each <p>…</p> is one caption line, with
  // <s>…</s> as word/phrase segments concatenated end-to-end.
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(xml)) !== null) {
    const inner = pm[1];
    if (!inner) continue;
    const segments: string[] = [];
    const sRe = /<s\b[^>]*>([\s\S]*?)<\/s>/g;
    let sm: RegExpExecArray | null;
    while ((sm = sRe.exec(inner)) !== null) segments.push(sm[1]);
    const raw = segments.length > 0 ? segments.join("") : inner.replace(/<[^>]+>/g, "");
    const text = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
  }
  if (lines.length > 0) return lines;
  // Legacy <text> fallback.
  const textRe = /<text\b[^>]*>([\s\S]*?)<\/text>/g;
  let tm: RegExpExecArray | null;
  while ((tm = textRe.exec(xml)) !== null) {
    const text = decodeHtmlEntities(tm[1]).replace(/\s+/g, " ").trim();
    if (text) lines.push(text);
  }
  return lines;
}

async function fetchTranscript(watchHtml: string): Promise<string> {
  const rawTracks = extractCaptionTracksJson(watchHtml);
  if (!rawTracks) return "";
  let tracks: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>;
  try {
    tracks = JSON.parse(rawTracks);
  } catch {
    return "";
  }
  if (!Array.isArray(tracks) || tracks.length === 0) return "";

  // Prefer auto-generated original-language track; otherwise first
  // English; otherwise first available.
  const pick = tracks.find((t) => t.languageCode === "en") ||
               tracks.find((t) => !t.kind) ||
               tracks[0];
  if (!pick?.baseUrl) return "";

  // The baseUrl in captionTracks is escaped (& for &). JSON.parse
  // already unescaped it, but normalise just in case.
  const xmlUrl = pick.baseUrl.replace(/\\u0026/g, "&");
  const xmlRes = await fetch(xmlUrl, { headers: { "User-Agent": WATCH_UA } });
  if (!xmlRes.ok) return "";
  const xml = await xmlRes.text();

  // <text start="0.0" dur="3.5">Hello world</text>
  const lines: string[] = [];
  const re = /<text[^>]*>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const decoded = decodeHtmlEntities(m[1]).replace(/\s+/g, " ").trim();
    if (decoded) lines.push(decoded);
  }
  // Group into paragraphs of ~10 lines so the transcript reads as
  // prose, not as 200 single-line entries.
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 10) {
    chunks.push(lines.slice(i, i + 10).join(" "));
  }
  return chunks.join("\n\n");
}

// Pull the `"captionTracks":[ … ]` array out of the watch-page HTML.
// Needs to be bracket-balanced because each track is an object with
// nested {name:{simpleText:…}} so a naive [^\]]+ regex stops at the
// first inner ] and parses garbage. Skips bytes inside JSON strings
// to avoid being fooled by stray brackets in URL parameters.
function extractCaptionTracksJson(html: string): string | null {
  const marker = '"captionTracks":';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  let i = start + marker.length;
  while (i < html.length && html[i] !== "[") i++;
  if (i >= html.length) return null;
  const openIdx = i;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return html.slice(openIdx, i + 1);
    }
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
