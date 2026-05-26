import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALES = new Set(["en", "ko"]);

export async function POST(req: Request) {
  let body: { email?: unknown; locale?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale = typeof body.locale === "string" && LOCALES.has(body.locale) ? body.locale : "en";
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "about";

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  // Idempotent re-submit: the unique index on lower(email) makes a
  // duplicate insert a no-op from the caller's point of view.
  const { error } = await supabase
    .from("launch_waitlist")
    .upsert(
      { email, locale, source, user_agent: userAgent },
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
