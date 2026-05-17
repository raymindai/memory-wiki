// Temporary diagnostic for the YouTube import path. Reports each
// step's result so we can tell whether the Android innertube fetch
// (or the legacy watch-page scrape) is being blocked from Vercel's
// IP range — separately from the rest of the import pipeline.
//
// GET /api/debug/youtube?id=cNlvrU-KcRg
//   → { videoId, androidPlayer: {...}, watchPage: {...}, transcript: {...} }
//
// Delete this route once we've confirmed the import works end-to-end.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[\w-]{11}$/.test(id)) {
    return NextResponse.json({ error: "id query param required (11-char video id)" }, { status: 400 });
  }

  const out: Record<string, unknown> = { videoId: id, t: new Date().toISOString() };

  // Step 1 — Android innertube player.
  try {
    const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": ANDROID_UA,
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": "20.10.38",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 30,
            userAgent: ANDROID_UA,
            hl: "en", gl: "US", platform: "MOBILE",
          },
        },
        videoId: id,
      }),
    });
    const playerJson = await playerRes.json().catch(() => null) as Record<string, unknown> | null;
    const tracks = (playerJson?.captions as { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string }> } } | undefined)
      ?.playerCaptionsTracklistRenderer?.captionTracks;
    out.androidPlayer = {
      status: playerRes.status,
      ok: playerRes.ok,
      hasCaptionsKey: !!playerJson?.captions,
      trackCount: tracks?.length || 0,
      tracks: (tracks || []).map((t) => ({
        languageCode: t.languageCode,
        kind: t.kind,
        baseUrlHead: t.baseUrl?.slice(0, 100),
      })),
      playabilityStatus: (playerJson?.playabilityStatus as { status?: string; reason?: string } | undefined)?.status,
      playabilityReason: (playerJson?.playabilityStatus as { status?: string; reason?: string } | undefined)?.reason,
    };

    // Step 2 — Fetch the transcript XML for the first track.
    if (tracks && tracks[0]?.baseUrl) {
      const xmlRes = await fetch(tracks[0].baseUrl, { headers: { "User-Agent": ANDROID_UA } });
      const xmlText = await xmlRes.text();
      const pCount = (xmlText.match(/<p\b/g) || []).length;
      const sCount = (xmlText.match(/<s\b/g) || []).length;
      const textCount = (xmlText.match(/<text\b/g) || []).length;
      out.transcript = {
        status: xmlRes.status,
        bytes: xmlText.length,
        pTagCount: pCount,
        sTagCount: sCount,
        legacyTextTagCount: textCount,
        head: xmlText.slice(0, 300),
      };
    } else {
      out.transcript = { skipped: "no track baseUrl" };
    }
  } catch (err) {
    out.androidPlayerError = err instanceof Error ? err.message : String(err);
  }

  // Step 3 — Legacy watch-page scrape, as cross-check.
  try {
    const wRes = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await wRes.text();
    out.watchPage = {
      status: wRes.status,
      bytes: html.length,
      hasCaptionTracksMarker: html.includes('"captionTracks":'),
    };
  } catch (err) {
    out.watchPageError = err instanceof Error ? err.message : String(err);
  }

  // Step 4 — IOS client. Different fingerprint than ANDROID; sometimes
  // bypasses the bot check when ANDROID is blocked.
  try {
    const iosRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
        "X-YouTube-Client-Name": "5",
        "X-YouTube-Client-Version": "19.45.4",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "IOS",
            clientVersion: "19.45.4",
            deviceModel: "iPhone16,2",
            userAgent: "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
            hl: "en", gl: "US", platform: "MOBILE",
          },
        },
        videoId: id,
      }),
    });
    const j = await iosRes.json().catch(() => null) as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string }> } }; playabilityStatus?: { status?: string; reason?: string } } | null;
    out.iosPlayer = {
      status: iosRes.status,
      trackCount: j?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0,
      playability: j?.playabilityStatus?.status,
      reason: j?.playabilityStatus?.reason,
    };
  } catch (err) {
    out.iosPlayerError = err instanceof Error ? err.message : String(err);
  }

  // Step 5 — TVHTML5 embedded client. Used by youtube-dl as a
  // last-resort bypass historically.
  try {
    const tvRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-YouTube-Client-Name": "85",
        "X-YouTube-Client-Version": "2.0",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            clientVersion: "2.0",
            hl: "en", gl: "US",
          },
          thirdParty: { embedUrl: `https://www.youtube.com/watch?v=${id}` },
        },
        videoId: id,
      }),
    });
    const j = await tvRes.json().catch(() => null) as { captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string }> } }; playabilityStatus?: { status?: string; reason?: string } } | null;
    out.tvEmbeddedPlayer = {
      status: tvRes.status,
      trackCount: j?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length || 0,
      playability: j?.playabilityStatus?.status,
      reason: j?.playabilityStatus?.reason,
    };
  } catch (err) {
    out.tvEmbeddedPlayerError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(out);
}
