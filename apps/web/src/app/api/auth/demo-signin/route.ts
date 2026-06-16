import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Demo-only sign-in backdoor.
 *
 * POST /api/auth/demo-signin { email }
 *
 * Lets a small allowlist of demo accounts sign in instantly without
 * email delivery — useful for YC reviewers, recorded walkthroughs,
 * and anyone who needs to validate the v6 surface in under a minute.
 *
 * How it works (without leaking auth):
 *   1. Verify caller's email is in DEMO_EMAILS. Anything else → 403.
 *   2. Use the service-role admin client to generate a magic link.
 *      The response includes the email_otp that the magic link
 *      ordinarily emails to the user.
 *   3. Use the anon client to verifyOtp() server-side, exchanging the
 *      OTP for a fully-fledged Supabase session.
 *   4. Return access_token + refresh_token to the caller. The browser
 *      sets it via supabase.auth.setSession() and is logged in.
 *
 * Security: anyone who hits this endpoint can sign in as the demo
 * account. That's intentional — it's a public test account. NEVER
 * extend DEMO_EMAILS to a real user. Real accounts go through OAuth
 * or magic-link email like everyone else.
 */
const DEMO_EMAILS = new Set([
  "yc@mdfy.app",
  "demo@mdfy.app",
  "demo@memory.wiki",
]);

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !DEMO_EMAILS.has(email)) {
    return NextResponse.json({ error: "Not a demo account" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  // Step 1: admin generates a magiclink. Extract the email OTP that
  // would normally be delivered via email.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Ensure the demo user exists before generating a link. App Review
  // (Guideline 5.1.1(v)) may exercise the in-app "Delete Account" flow on
  // this account — without re-creation, the next sign-in (theirs or the
  // next reviewer's) would fail and the app would be rejected again.
  // createUser is idempotent for our purpose: an "already registered"
  // error is the normal case and is ignored; any real failure resurfaces
  // at generateLink below.
  await admin.auth.admin.createUser({ email, email_confirm: true });

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.email_otp) {
    return NextResponse.json({ error: linkErr?.message || "Failed to generate link" }, { status: 500 });
  }

  // Step 2: anon client redeems the OTP server-side, producing a session.
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessData, error: sessErr } = await anon.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "email",
  });
  if (sessErr || !sessData?.session) {
    return NextResponse.json({ error: sessErr?.message || "OTP exchange failed" }, { status: 500 });
  }

  return NextResponse.json({
    access_token: sessData.session.access_token,
    refresh_token: sessData.session.refresh_token,
    user: sessData.user,
  });
}
