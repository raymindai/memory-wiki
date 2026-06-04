import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getTemplatePreviews } from "@/lib/email";

const ADMIN_EMAIL = "hi@raymind.ai";

// ─── Helper: verify admin ───
async function verifyAdmin(req: NextRequest): Promise<{ supabase: ReturnType<typeof getSupabaseClient>; error?: NextResponse }> {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const email = verified?.email || req.headers.get("x-user-email");
  if (!email || email.toLowerCase() !== ADMIN_EMAIL) {
    return { supabase: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { supabase: null, error: NextResponse.json({ error: "Storage not configured" }, { status: 503 }) };
  }
  return { supabase };
}

export async function GET(req: NextRequest) {
  const { supabase: _sb, error } = await verifyAdmin(req);
  if (error || !_sb) return error!;
  const supabase = _sb;

  try {
    // Stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalDocs },
      { count: docsToday },
      { count: docsThisWeek },
      { data: viewData },
      { data: allDocs },
    ] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("documents").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", todayStart),
      supabase.from("documents").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", weekStart),
      supabase.from("documents").select("view_count").is("deleted_at", null),
      supabase.from("documents").select("id, title, user_id, is_draft, view_count, source, created_at, updated_at, deleted_at").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100),
    ]);

    const totalViews = (viewData || []).reduce((sum, d) => sum + (d.view_count || 0), 0);

    // Users from Supabase Auth
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 500 });
    const authUsers = authData?.users || [];

    // Count docs per user
    const userDocCounts: Record<string, number> = {};
    for (const doc of allDocs || []) {
      if (doc.user_id) {
        userDocCounts[doc.user_id] = (userDocCounts[doc.user_id] || 0) + 1;
      }
    }

    // Active users (signed in within 7 days)
    const activeUsers7d = authUsers.filter(u =>
      u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(weekStart)
    ).length;

    // Storage: estimate from document sizes
    const storageMB = (allDocs || []).reduce((sum, d) => sum + ((d.title?.length || 0) + 500) / 1024 / 1024, 0);

    // Users list
    const users = authUsers.map(u => ({
      id: u.id,
      email: u.email || "unknown",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      docCount: userDocCounts[u.id] || 0,
    })).sort((a, b) => b.docCount - a.docCount);

    // Documents list with owner email
    const userEmailMap: Record<string, string> = {};
    for (const u of authUsers) {
      if (u.email) userEmailMap[u.id] = u.email;
    }

    const documents = (allDocs || []).map(d => ({
      id: d.id,
      title: d.title || "Untitled",
      user_email: d.user_id ? (userEmailMap[d.user_id] || null) : null,
      is_draft: d.is_draft,
      view_count: d.view_count || 0,
      source: d.source,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    // Recent activity (last 50 documents by updated_at)
    const recent = (allDocs || []).slice(0, 50).map(d => ({
      type: d.source || "web",
      title: d.title || "Untitled",
      email: d.user_id ? (userEmailMap[d.user_id] || null) : null,
      time: d.updated_at,
    }));

    // ─── Daily Stats (last 30 days) ───
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all docs created in last 30 days (including deleted, for accurate history)
    const { data: recentDocs } = await supabase
      .from("documents")
      .select("created_at, view_count, source")
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Build day buckets
    const dailyStats: { date: string; docs: number; users: number; views: number }[] = [];
    const docsByDay: Record<string, number> = {};
    const viewsByDay: Record<string, number> = {};
    const sourceCount: Record<string, number> = {};

    for (const d of recentDocs || []) {
      const day = d.created_at?.slice(0, 10);
      if (day) {
        docsByDay[day] = (docsByDay[day] || 0) + 1;
        viewsByDay[day] = (viewsByDay[day] || 0) + (d.view_count || 0);
      }
      const src = d.source || "web";
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    }

    // Users by day
    const usersByDay: Record<string, number> = {};
    for (const u of authUsers) {
      if (u.created_at) {
        const day = u.created_at.slice(0, 10);
        if (new Date(day) >= thirtyDaysAgo) {
          usersByDay[day] = (usersByDay[day] || 0) + 1;
        }
      }
    }

    // Fill all 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      dailyStats.push({
        date: day,
        docs: docsByDay[day] || 0,
        users: usersByDay[day] || 0,
        views: viewsByDay[day] || 0,
      });
    }

    // Fetch unified AI config (provider order + per-provider models)
    // from the shared lib so admin always shows the resolved values
    // — exactly what callAI will use on the next request.
    const { getAIConfig } = await import("@/lib/ai-providers");
    const aiConfig = await getAIConfig();
    // Backwards-compat: keep `aiModels` on the response for any old
    // admin client still on the road. New clients should read
    // `aiProviders` instead.
    const aiModels = { primary: aiConfig.models.gemini.primary, lite: aiConfig.models.gemini.lite };

    return NextResponse.json({
      stats: {
        totalDocs: totalDocs || 0,
        totalUsers: authUsers.length,
        totalViews,
        docsToday: docsToday || 0,
        docsThisWeek: docsThisWeek || 0,
        activeUsers7d,
        storageUsedMB: storageMB,
      },
      users,
      documents,
      recent,
      dailyStats,
      sourceBreakdown: sourceCount,
      emailTemplates: getTemplatePreviews(),
      aiModels,
      aiProviders: {
        order: aiConfig.order,
        models: aiConfig.models,
      },
    });
  } catch (err) {
    console.error("Admin API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── PATCH: Update AI provider order + per-provider model settings ───
// Body shape (all fields optional — only sent keys get upserted):
//   {
//     providerOrder?: ProviderName[],          // e.g. ["openai","gemini","anthropic"]
//     models?: {
//       openai?:    { primary?: string, lite?: string },
//       gemini?:    { primary?: string, lite?: string },
//       anthropic?: { primary?: string, lite?: string },
//     },
//     // Legacy fields kept for the older admin client (Gemini only):
//     aiModelPrimary?: string,
//     aiModelLite?: string,
//   }
//
// On success the lib's getAIConfig cache is invalidated so the change
// is visible on the very next AI call (no 5-minute wait).
export async function PATCH(req: NextRequest) {
  const { supabase: _sb, error } = await verifyAdmin(req);
  if (error || !_sb) return error!;
  const supabase = _sb;

  try {
    const body = await req.json();
    const {
      providerOrder,
      models,
      aiModelPrimary, // legacy
      aiModelLite,    // legacy
    } = body as {
      providerOrder?: string[];
      models?: {
        openai?:    { primary?: string; lite?: string };
        gemini?:    { primary?: string; lite?: string };
        anthropic?: { primary?: string; lite?: string };
      };
      aiModelPrimary?: string;
      aiModelLite?: string;
    };

    const updates: { key: string; value: string; updated_at: string }[] = [];
    const now = new Date().toISOString();

    if (Array.isArray(providerOrder)) {
      const cleaned = providerOrder
        .map((s) => String(s).trim().toLowerCase())
        .filter((s) => s === "openai" || s === "gemini" || s === "anthropic");
      if (cleaned.length === 0) {
        return NextResponse.json({ error: "providerOrder must contain at least one of openai/gemini/anthropic" }, { status: 400 });
      }
      updates.push({ key: "ai_provider_order", value: cleaned.join(","), updated_at: now });
    }

    const pushModel = (key: string, value?: string) => {
      if (typeof value !== "string") return;
      const v = value.trim();
      if (!v) return;
      // Model names are free-form (Anthropic/OpenAI/Gemini release new
      // names monthly). Cap at 80 chars and disallow whitespace so a
      // typo can't bork the whole stack. Validation is intentionally
      // soft — the admin knows what they're typing.
      if (v.length > 80 || /\s/.test(v)) {
        throw new Error(`Invalid model name: "${v}"`);
      }
      updates.push({ key, value: v, updated_at: now });
    };

    try {
      if (models?.openai)    { pushModel("ai_openai_primary",    models.openai.primary);    pushModel("ai_openai_lite",    models.openai.lite); }
      if (models?.gemini)    { pushModel("ai_gemini_primary",    models.gemini.primary);    pushModel("ai_gemini_lite",    models.gemini.lite); }
      if (models?.anthropic) { pushModel("ai_anthropic_primary", models.anthropic.primary); pushModel("ai_anthropic_lite", models.anthropic.lite); }
      // Legacy compat — older admin client only knew Gemini.
      pushModel("ai_model_primary", aiModelPrimary);
      pushModel("ai_model_lite",    aiModelLite);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    for (const u of updates) {
      const { error: upsertErr } = await supabase.from("site_config").upsert(u, { onConflict: "key" });
      if (upsertErr) {
        console.error("Failed to update site_config:", upsertErr);
        return NextResponse.json({ error: "Failed to save" }, { status: 500 });
      }
    }

    // Invalidate the lib cache so the next /api/ai or transform call
    // re-reads from site_config immediately instead of waiting out the
    // 5-minute TTL.
    try {
      const { invalidateAIConfigCache } = await import("@/lib/ai-providers");
      invalidateAIConfigCache();
    } catch { /* lib not loaded yet — fine */ }

    return NextResponse.json({ ok: true, updated: updates.map(u => u.key) });
  } catch (err) {
    console.error("Admin PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
