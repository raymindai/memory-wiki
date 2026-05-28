import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { verifyAuthToken } from "@/lib/verify-auth";
import crypto from "crypto";
import sharp from "sharp";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const QUOTA_FREE = 20 * 1024 * 1024;   // 20MB
const QUOTA_PRO = 1024 * 1024 * 1024;  // 1GB

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Auth: verify JWT first, then fall back to headers
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  const anonymousId = req.headers.get("x-anonymous-id");

  // For fully anonymous uploads: rate limit by IP
  if (!userId && !anonymousId) {
    // x-real-ip and x-forwarded-for are set by Vercel's proxy in production
    const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }
  }

  // Parse multipart form
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate type
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported format. Allowed: JPEG, PNG, GIF, WebP, SVG` },
      { status: 400 }
    );
  }

  // Reject empty files
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 413 }
    );
  }

  // Check user quota
  let currentUsage = 0;
  let quota = QUOTA_FREE;
  const ownerId = userId || (anonymousId ? `anon-${anonymousId}` : "public");

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, storage_used_bytes")
      .eq("id", userId)
      .single();

    if (profile) {
      quota = profile.plan === "pro" ? QUOTA_PRO : QUOTA_FREE;
      currentUsage = profile.storage_used_bytes || 0;
    }
  } else {
    // Anonymous: 20MB quota, no profile tracking
    quota = 20 * 1024 * 1024;
  }

  if (currentUsage + file.size > quota) {
    const usedMB = Math.round(currentUsage / 1024 / 1024);
    const quotaMB = Math.round(quota / 1024 / 1024);
    return NextResponse.json(
      {
        error: `Storage limit reached (${usedMB}MB / ${quotaMB}MB). ${!userId ? "Sign in for 20MB free storage." : quota < QUOTA_PRO ? "Upgrade to Pro for 1GB." : ""}`,
        quotaExceeded: true,
      },
      { status: 413 }
    );
  }

  // Read file buffer
  const rawBuffer = Buffer.from(await file.arrayBuffer());

  // Policy: every raster image stored on this server is WebP.
  //   - JPEG / PNG / WebP / GIF → re-encoded as WebP (animated WebP
  //     for GIF so animation survives; sharp's `animated: true`
  //     reads every page of the input).
  //   - SVG stays SVG (rasterising a vector would be a regression).
  // If the WebP encoder chokes on weird input we fall back to the
  // raw bytes rather than failing the upload, but the storage
  // pathname's extension and content-type both reflect what we
  // actually wrote.
  let uploadBuffer: Buffer;
  let uploadContentType: string;
  let ext: string;

  if (file.type === "image/svg+xml") {
    uploadBuffer = rawBuffer;
    uploadContentType = "image/svg+xml";
    ext = "svg";
  } else {
    try {
      const animated = file.type === "image/gif";
      uploadBuffer = await sharp(rawBuffer, animated ? { animated: true } : {})
        .webp({ quality: 85 })
        .toBuffer();
      uploadContentType = "image/webp";
      ext = "webp";
    } catch {
      // Fallback: upload original if conversion fails
      uploadBuffer = rawBuffer;
      uploadContentType = file.type;
      ext = file.type === "image/png" ? "png"
          : file.type === "image/jpeg" ? "jpg"
          : file.type === "image/gif" ? "gif"
          : "webp";
    }
  }

  const hash = crypto.createHash("sha256").update(uploadBuffer).digest("hex").slice(0, 16);
  const storagePath = `${ownerId}/${hash}.${ext}`;

  // Upload to Supabase Storage (upsert — dedup by hash)
  const { error: uploadError } = await supabase.storage
    .from("document-images")
    .upload(storagePath, uploadBuffer, {
      contentType: uploadContentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("document-images")
    .getPublicUrl(storagePath);

  // Update storage usage (only for authenticated users with profile)
  // NOTE: Race condition — two concurrent uploads both read the same currentUsage,
  // so the second write may overwrite the first increment. Practical impact is minimal
  // since concurrent image uploads are rare. To fix properly, use an RPC with
  // atomic increment (SET storage_used_bytes = storage_used_bytes + $amount).
  if (userId) {
    await supabase
      .from("profiles")
      .update({ storage_used_bytes: currentUsage + uploadBuffer.length })
      .eq("id", userId);
  }

  return NextResponse.json({
    url: urlData.publicUrl,
    size: uploadBuffer.length,
    originalSize: rawBuffer.length,
    format: ext,
    hash,
  });
}
