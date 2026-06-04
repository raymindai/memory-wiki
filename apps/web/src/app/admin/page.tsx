"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const ADMIN_EMAIL = "hi@raymind.ai";

interface Stats {
  totalDocs: number;
  totalUsers: number;
  totalViews: number;
  docsToday: number;
  docsThisWeek: number;
  activeUsers7d: number;
  storageUsedMB: number;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  docCount: number;
}

interface DocRow {
  id: string;
  title: string;
  user_email: string | null;
  is_draft: boolean;
  view_count: number;
  source: string | null;
  created_at: string;
  updated_at: string;
}

interface RecentActivity {
  type: string;
  title: string;
  email: string | null;
  time: string;
}

interface DailyStat {
  date: string;
  docs: number;
  users: number;
  views: number;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, number>>({});
  const [emailTemplates, setEmailTemplates] = useState<{ name: string; subject: string; html: string }[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<number>(0);
  const [tab, setTab] = useState<"overview" | "charts" | "users" | "documents" | "emails" | "activity" | "usage" | "settings">("overview");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  // AI settings — unified per-provider model table + provider order.
  // Defaults mirror lib/ai-providers.ts so the form renders sensibly
  // before /api/admin GET hydrates the real values.
  const [aiProviderOrder, setAiProviderOrder] = useState<string[]>(["openai", "gemini", "anthropic"]);
  const [aiOpenaiPrimary, setAiOpenaiPrimary]     = useState("gpt-4o-mini");
  const [aiOpenaiLite, setAiOpenaiLite]           = useState("gpt-5-nano");
  const [aiGeminiPrimary, setAiGeminiPrimary]     = useState("gemini-3-flash-preview");
  const [aiGeminiLite, setAiGeminiLite]           = useState("gemini-3.1-flash-lite");
  const [aiAnthropicPrimary, setAiAnthropicPrimary] = useState("claude-haiku-4-5");
  const [aiAnthropicLite, setAiAnthropicLite]     = useState("claude-haiku-4-5");
  const [savingModels, setSavingModels] = useState(false);
  const [modelSaveMsg, setModelSaveMsg] = useState("");
  // Hydrate the AI Settings inputs from server exactly once on first
  // load. The 30s background refresh must NOT overwrite them — that
  // would clobber whatever the admin is mid-typing.
  const aiHydratedRef = useRef(false);

  // Usage tab state — lazy-loaded on first tab visit so the admin
  // page's initial paint stays fast. ai_usage scans aren't huge but
  // we don't need them until the user clicks Usage.
  interface UsageData {
    windowDays: number;
    totals: { calls: number; inputTokens: number; outputTokens: number; costUsd: number; errors: number };
    topUsers: Array<{ id: string; email: string | null; isAnon: boolean; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
    actionRows: Array<{ action: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
    providerRows: Array<{ provider: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
    dailySeries: Array<{ date: string; calls: number; costUsd: number }>;
  }
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState("");

  // Auth check
  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    if (!sb) { setAuthed(false); return; }

    sb.auth.getSession().then(({ data }: { data: { session: { user: { email?: string } } | null } }) => {
      const userEmail = data.session?.user?.email?.toLowerCase();
      if (userEmail === ADMIN_EMAIL) {
        setAuthed(true);
        setEmail(userEmail);
      } else {
        setAuthed(false);
      }
    });
  }, []);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    // Only flip `loading` for the initial fetch — the 30s auto-refresh
    // calls this in silent mode so the page doesn't swap to the
    // "Loading..." placeholder twice a minute (the cause of the
    // periodic flicker that ate every render including AI settings
    // inputs mid-edit).
    if (!opts?.silent) setLoading(true);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: sessionData } = await sb!.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/admin", {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          "x-user-email": email,
        },
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setStats(data.stats);
      setUsers(data.users || []);
      setDocs(data.documents || []);
      setRecent(data.recent || []);
      setDailyStats(data.dailyStats || []);
      setSourceBreakdown(data.sourceBreakdown || {});
      setEmailTemplates(data.emailTemplates || []);
      if (data.aiProviders && !aiHydratedRef.current) {
        if (Array.isArray(data.aiProviders.order)) setAiProviderOrder(data.aiProviders.order);
        const m = data.aiProviders.models;
        if (m?.openai?.primary)     setAiOpenaiPrimary(m.openai.primary);
        if (m?.openai?.lite)        setAiOpenaiLite(m.openai.lite);
        if (m?.gemini?.primary)     setAiGeminiPrimary(m.gemini.primary);
        if (m?.gemini?.lite)        setAiGeminiLite(m.gemini.lite);
        if (m?.anthropic?.primary)  setAiAnthropicPrimary(m.anthropic.primary);
        if (m?.anthropic?.lite)     setAiAnthropicLite(m.anthropic.lite);
        aiHydratedRef.current = true;
      }
    } catch {
      setAuthed(false);
    }
    setLoading(false);
    setLastUpdated(Date.now());
  }, [email]);

  // Stable silent-refresh ref so the 30s interval doesn't tear down /
  // recreate every time fetchData's identity changes.
  const silentRefresh = useCallback(() => { fetchData({ silent: true }); }, [fetchData]);

  useEffect(() => {
    if (authed && email) fetchData();
  }, [authed, email, fetchData]);

  // Auto-refresh every 30 seconds — silent so the page doesn't
  // flicker through the "Loading..." placeholder on every tick.
  useEffect(() => {
    if (!authed || !email) return;
    const interval = setInterval(silentRefresh, 30000);
    return () => clearInterval(interval);
  }, [authed, email, silentRefresh]);

  // "Last updated X seconds ago" ticker
  useEffect(() => {
    if (lastUpdated === null) return;
    setSecondsAgo(0);
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  // Lazy-load usage data on first Usage tab visit (then refresh
  // whenever the tab is re-visited so the admin can see fresh data).
  useEffect(() => {
    if (tab !== "usage" || !authed) return;
    let cancelled = false;
    (async () => {
      setUsageLoading(true);
      setUsageError("");
      try {
        const sb = getSupabaseBrowserClient();
        const { data: sessionData } = await sb!.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch("/api/admin/usage", {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setUsage(data);
      } catch (e) {
        if (!cancelled) setUsageError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, authed]);

  if (authed === null) return <div style={page}><p style={{ color: "#71717a" }}>Checking access...</p></div>;
  if (authed === false) return (
    <div style={page}>
      <h1 style={{ color: "#ef4444", fontSize: 18, fontWeight: 700 }}>Access Denied</h1>
      <p style={{ color: "#71717a", marginTop: 8 }}>Admin access is restricted.</p>
    </div>
  );

  return (
    <div style={page}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fafafa", margin: 0 }}>
            <span style={{ color: "#fb923c" }}>Memory.Wiki</span> Admin
          </h1>
          <p style={{ fontSize: 12, color: "#52525b", marginTop: 4 }}>{email}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => fetchData()} style={btnStyle}>Refresh</button>
          {lastUpdated !== null && (
            <span style={{ fontSize: 11, color: "#52525b", alignSelf: "center" }}>
              Updated {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
            </span>
          )}
          <Link href="/" style={{ ...btnStyle, textDecoration: "none" }}>Back to Editor</Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid #27272a" }}>
        {(["overview", "charts", "users", "documents", "activity", "usage", "settings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: tab === t ? "#fb923c" : "#71717a",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid #fb923c" : "2px solid transparent",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: "#71717a" }}>Loading...</p> : (
        <>
          {/* Overview */}
          {tab === "overview" && stats && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
                {[
                  { label: "Total Documents", value: stats.totalDocs },
                  { label: "Total Users", value: stats.totalUsers },
                  { label: "Total Views", value: stats.totalViews.toLocaleString() },
                  { label: "Docs Today", value: stats.docsToday },
                  { label: "Docs This Week", value: stats.docsThisWeek },
                  { label: "Active Users (7d)", value: stats.activeUsers7d },
                  { label: "Storage Used", value: stats.storageUsedMB.toFixed(1) + " MB" },
                ].map(s => (
                  <div key={s.label} style={cardStyle}>
                    <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: "#fafafa", margin: 0 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          {tab === "charts" && (
            <div>
              <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 16px" }}>Documents per day</h3>
                <LineChart data={dailyStats.map(d => ({ label: d.date, value: d.docs }))} color="#fb923c" />
              </div>
              <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 16px" }}>Views per day</h3>
                <LineChart data={dailyStats.map(d => ({ label: d.date, value: d.views }))} color="#38bdf8" />
              </div>
              <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 16px" }}>Users per day</h3>
                <LineChart data={dailyStats.map(d => ({ label: d.date, value: d.users }))} color="#4ade80" />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 16px" }}>Documents by source</h3>
                <BarChart data={Object.entries(sourceBreakdown).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
              </div>
            </div>
          )}

          {/* Emails */}
          {tab === "emails" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {emailTemplates.map((t, i) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedEmail(i)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background: selectedEmail === i ? "#fb923c" : "#1c1c24",
                      color: selectedEmail === i ? "#0a0a0c" : "#a1a1aa",
                      border: selectedEmail === i ? "none" : "1px solid #27272a",
                      cursor: "pointer",
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {emailTemplates[selectedEmail] && (
                <div>
                  <div style={{ marginBottom: 12, padding: "10px 14px", background: "#1c1c24", borderRadius: 8, border: "1px solid #27272a" }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#52525b" }}>Subject</p>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#fafafa", fontWeight: 600 }}>{emailTemplates[selectedEmail].subject}</p>
                  </div>
                  <div style={{ border: "1px solid #27272a", borderRadius: 10, overflow: "hidden" }}>
                    <iframe
                      srcDoc={emailTemplates[selectedEmail].html}
                      style={{ width: "100%", height: 600, border: "none", background: "#09090b" }}
                      title={`Email preview: ${emailTemplates[selectedEmail].name}`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Users */}
          {tab === "users" && (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Docs</th>
                    <th style={thStyle}>Joined</th>
                    <th style={thStyle}>Last Sign In</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>{u.docCount}</td>
                      <td style={tdStyle}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={tdStyle}>{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "#52525b", marginTop: 8 }}>{users.length} users</p>
            </div>
          )}

          {/* Documents */}
          {tab === "documents" && (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Owner</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Views</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.id}>
                      <td style={tdStyle}>
                        <a href={`/${d.id}`} target="_blank" style={{ color: "#fb923c", textDecoration: "none" }}>
                          {d.title || "Untitled"}
                        </a>
                      </td>
                      <td style={tdStyle}>{d.user_email || "anonymous"}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: d.is_draft ? "rgba(251,146,60,0.1)" : "rgba(74,222,128,0.1)", color: d.is_draft ? "#fb923c" : "#4ade80" }}>
                          {d.is_draft ? "Private" : "Shared"}
                        </span>
                      </td>
                      <td style={tdStyle}>{d.view_count}</td>
                      <td style={tdStyle}>{d.source || "-"}</td>
                      <td style={tdStyle}>{new Date(d.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "#52525b", marginTop: 8 }}>{docs.length} documents</p>
            </div>
          )}

          {/* Activity */}
          {tab === "activity" && (
            <div>
              {recent.map((r, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #1c1c24", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#1c1c24", color: "#71717a", fontFamily: "monospace", flexShrink: 0 }}>{r.type}</span>
                  <span style={{ fontSize: 13, color: "#e4e4e7", flex: 1 }}>{r.title}</span>
                  <span style={{ fontSize: 11, color: "#52525b", flexShrink: 0 }}>{r.email || "anon"}</span>
                  <span style={{ fontSize: 11, color: "#3f3f46", flexShrink: 0 }}>{new Date(r.time).toLocaleString()}</span>
                </div>
              ))}
              {recent.length === 0 && <p style={{ color: "#52525b" }}>No recent activity</p>}
            </div>
          )}

          {/* Usage */}
          {tab === "usage" && (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fafafa", margin: 0 }}>
                  AI Usage <span style={{ fontWeight: 400, color: "#52525b", fontSize: 12 }}>last {usage?.windowDays ?? 30} days</span>
                </h3>
                {usageLoading && <span style={{ fontSize: 12, color: "#52525b" }}>Loading...</span>}
              </div>

              {usageError && (
                <div style={{ padding: 12, background: "#1c1c24", border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5", fontSize: 12, marginBottom: 16 }}>
                  Error: {usageError}
                </div>
              )}

              {usage && (
                <>
                  {/* Totals */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
                    <div style={cardStyle}>
                      <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Total Cost</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: "#fafafa", margin: 0 }}>${usage.totals.costUsd.toFixed(4)}</p>
                    </div>
                    <div style={cardStyle}>
                      <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Calls</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: "#fafafa", margin: 0 }}>{usage.totals.calls.toLocaleString()}</p>
                    </div>
                    <div style={cardStyle}>
                      <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Input Tokens</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: "#fafafa", margin: 0 }}>{usage.totals.inputTokens.toLocaleString()}</p>
                    </div>
                    <div style={cardStyle}>
                      <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Output Tokens</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: "#fafafa", margin: 0 }}>{usage.totals.outputTokens.toLocaleString()}</p>
                    </div>
                    <div style={cardStyle}>
                      <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Errors</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: usage.totals.errors > 0 ? "#fb923c" : "#fafafa", margin: 0 }}>{usage.totals.errors.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Daily cost chart */}
                  <div style={{ marginBottom: 40 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 16px" }}>Cost per day (USD)</h3>
                    <LineChart data={usage.dailySeries.map(d => ({ label: d.date, value: Number((d.costUsd * 10000).toFixed(0)) / 10000 }))} color="#fb923c" />
                    <p style={{ fontSize: 10, color: "#52525b", marginTop: 4 }}>Y-axis is USD. Hover shows the daily total.</p>
                  </div>

                  {/* Top users */}
                  <div style={{ marginBottom: 40 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 12px" }}>Top users by spend</h3>
                    <div style={{ background: "#0e0e10", border: "1px solid #27272a", borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#18181b", color: "#a1a1aa" }}>
                            <th style={thStyle}>User</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Calls</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Input</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Output</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Cost (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.topUsers.map((u) => (
                            <tr key={u.id} style={{ borderTop: "1px solid #27272a" }}>
                              <td style={tdStyle}>
                                {u.isAnon ? (
                                  <span style={{ color: "#52525b" }}>anon: {u.id.slice(0, 12)}...</span>
                                ) : (
                                  <span style={{ color: "#fafafa" }}>{u.email || u.id.slice(0, 8)}</span>
                                )}
                              </td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{u.calls.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#71717a" }}>{u.inputTokens.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#71717a" }}>{u.outputTokens.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#fb923c", fontWeight: 600 }}>${u.costUsd.toFixed(4)}</td>
                            </tr>
                          ))}
                          {usage.topUsers.length === 0 && (
                            <tr><td colSpan={5} style={{ ...tdStyle, color: "#52525b", textAlign: "center" }}>No usage yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Per-action breakdown */}
                  <div style={{ marginBottom: 40 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 12px" }}>By feature (action)</h3>
                    <div style={{ background: "#0e0e10", border: "1px solid #27272a", borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#18181b", color: "#a1a1aa" }}>
                            <th style={thStyle}>Action</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Calls</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Input</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Output</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Cost (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.actionRows.map((a) => (
                            <tr key={a.action} style={{ borderTop: "1px solid #27272a" }}>
                              <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", color: "#fafafa" }}>{a.action}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{a.calls.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#71717a" }}>{a.inputTokens.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#71717a" }}>{a.outputTokens.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#fb923c", fontWeight: 600 }}>${a.costUsd.toFixed(4)}</td>
                            </tr>
                          ))}
                          {usage.actionRows.length === 0 && (
                            <tr><td colSpan={5} style={{ ...tdStyle, color: "#52525b", textAlign: "center" }}>No usage yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Action catalog — static reference of every action
                      label the cascade can write. Helps the admin
                      decode the per-feature breakdown rows above.
                      Update this when a NEW callAI/streamText site is
                      added (see [[ai_usage_tracking_2026_06]]). */}
                  <div style={{ marginBottom: 40 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 4px" }}>Action catalog</h3>
                    <p style={{ fontSize: 11, color: "#52525b", margin: "0 0 12px" }}>What every action label above means. Grouped by surface.</p>
                    {ACTION_CATALOG.map((group) => (
                      <div key={group.surface} style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, color: "#a1a1aa", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{group.surface}</div>
                        <div style={{ background: "#0e0e10", border: "1px solid #27272a", borderRadius: 8, overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <tbody>
                              {group.actions.map((a) => (
                                <tr key={a.action} style={{ borderTop: "1px solid #27272a" }}>
                                  <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", color: "#fafafa", whiteSpace: "nowrap", width: 180 }}>{a.action}</td>
                                  <td style={{ ...tdStyle, color: "#a1a1aa" }}>{a.description}</td>
                                  <td style={{ ...tdStyle, color: "#52525b", whiteSpace: "nowrap", fontSize: 10, textAlign: "right" }}>{a.tier}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Per-provider breakdown */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fafafa", margin: "0 0 12px" }}>By provider</h3>
                    <div style={{ background: "#0e0e10", border: "1px solid #27272a", borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#18181b", color: "#a1a1aa" }}>
                            <th style={thStyle}>Provider</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Calls</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Input</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Output</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Cost (USD)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.providerRows.map((p) => (
                            <tr key={p.provider} style={{ borderTop: "1px solid #27272a" }}>
                              <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", color: "#fafafa" }}>{p.provider}</td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>{p.calls.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#71717a" }}>{p.inputTokens.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#71717a" }}>{p.outputTokens.toLocaleString()}</td>
                              <td style={{ ...tdStyle, textAlign: "right", color: "#fb923c", fontWeight: 600 }}>${p.costUsd.toFixed(4)}</td>
                            </tr>
                          ))}
                          {usage.providerRows.length === 0 && (
                            <tr><td colSpan={5} style={{ ...tdStyle, color: "#52525b", textAlign: "center" }}>No usage yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Settings */}
          {tab === "settings" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fafafa", margin: "0 0 8px" }}>AI Configuration</h3>
              <p style={{ fontSize: 12, color: "#52525b", marginBottom: 24 }}>
                Provider order (cheapest first by default) + per-provider primary / lite models.
                Every AI surface (editor chat, polish, translate, format, Chrome-ext intent transform,
                bundle graph, hub concepts) routes through the same cascade.
                <br/><br/>
                Save invalidates the in-memory config cache, so changes are live immediately.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 640 }}>
                {/* Provider order */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 6 }}>
                    Provider order
                    <span style={{ fontWeight: 400, color: "#52525b", marginLeft: 8 }}>tried in sequence until one returns text</span>
                  </label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {aiProviderOrder.map((p, i) => (
                      <div key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ padding: "6px 10px", borderRadius: 6, background: "#27272a", color: "#fafafa", fontSize: 12, fontFamily: "var(--font-mono)" }}>{i + 1}. {p}</span>
                        {i > 0 && (
                          <button
                            onClick={() => {
                              const next = [...aiProviderOrder];
                              [next[i - 1], next[i]] = [next[i], next[i - 1]];
                              setAiProviderOrder(next);
                            }}
                            style={{ fontSize: 11, padding: "2px 6px", background: "#18181b", color: "#a1a1aa", border: "1px solid #3f3f46", borderRadius: 4, cursor: "pointer" }}
                            title="Move up"
                          >↑</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: "#52525b", marginTop: 6 }}>
                    Default: openai → gemini → anthropic (cost-first cascade). Click ↑ to bubble a provider up.
                  </p>
                </div>

                {/* Per-provider models */}
                {([
                  { name: "openai",    label: "OpenAI",    primary: aiOpenaiPrimary,    setPrimary: setAiOpenaiPrimary,    lite: aiOpenaiLite,    setLite: setAiOpenaiLite,    hint: "e.g. gpt-4o-mini / gpt-5-nano" },
                  { name: "gemini",    label: "Gemini",    primary: aiGeminiPrimary,    setPrimary: setAiGeminiPrimary,    lite: aiGeminiLite,    setLite: setAiGeminiLite,    hint: "e.g. gemini-3-flash-preview / gemini-3.1-flash-lite" },
                  { name: "anthropic", label: "Anthropic", primary: aiAnthropicPrimary, setPrimary: setAiAnthropicPrimary, lite: aiAnthropicLite, setLite: setAiAnthropicLite, hint: "e.g. claude-sonnet-4 / claude-haiku-4-5" },
                ] as const).map((p) => (
                  <div key={p.name} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, border: "1px solid #27272a", borderRadius: 8, background: "#0e0e10" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fafafa" }}>{p.label}</div>
                    <p style={{ fontSize: 11, color: "#52525b", margin: 0 }}>{p.hint}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 4 }}>Primary <span style={{ color: "#52525b" }}>polish, translate, chat</span></label>
                        <input value={p.primary} onChange={(e) => p.setPrimary(e.target.value)}
                          style={{ width: "100%", padding: "6px 10px", background: "#18181b", color: "#fafafa", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 12, fontFamily: "var(--font-mono)" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 4 }}>Lite <span style={{ color: "#52525b" }}>summary, tldr, format, intent</span></label>
                        <input value={p.lite} onChange={(e) => p.setLite(e.target.value)}
                          style={{ width: "100%", padding: "6px 10px", background: "#18181b", color: "#fafafa", border: "1px solid #3f3f46", borderRadius: 6, fontSize: 12, fontFamily: "var(--font-mono)" }} />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Save */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={async () => {
                      setSavingModels(true);
                      setModelSaveMsg("");
                      try {
                        const sb = getSupabaseBrowserClient();
                        const { data: sessionData } = await sb!.auth.getSession();
                        const token = sessionData.session?.access_token;
                        const res = await fetch("/api/admin", {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                            "x-user-email": email,
                          },
                          body: JSON.stringify({
                            providerOrder: aiProviderOrder,
                            models: {
                              openai:    { primary: aiOpenaiPrimary,    lite: aiOpenaiLite },
                              gemini:    { primary: aiGeminiPrimary,    lite: aiGeminiLite },
                              anthropic: { primary: aiAnthropicPrimary, lite: aiAnthropicLite },
                            },
                          }),
                        });
                        if (!res.ok) {
                          const err = await res.json();
                          setModelSaveMsg(err.error || "Failed to save");
                        } else {
                          setModelSaveMsg("Saved successfully");
                        }
                      } catch {
                        setModelSaveMsg("Network error");
                      }
                      setSavingModels(false);
                    }}
                    disabled={savingModels}
                    style={{
                      ...btnStyle,
                      background: savingModels ? "#27272a" : "#fb923c",
                      color: savingModels ? "#71717a" : "#000",
                      border: "none",
                      cursor: savingModels ? "not-allowed" : "pointer",
                    }}
                  >
                    {savingModels ? "Saving..." : "Save AI Config"}
                  </button>
                  {modelSaveMsg && (
                    <span style={{ fontSize: 12, color: modelSaveMsg.includes("success") ? "#4ade80" : "#ef4444" }}>
                      {modelSaveMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── SVG Chart Components ───

interface ChartPoint {
  label: string;
  value: number;
}

function LineChart({ data, color = "#fb923c" }: { data: ChartPoint[]; color?: string }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) return <p style={{ color: "#52525b", fontSize: 13 }}>No data</p>;

  const width = 800;
  const height = 200;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const yTicks = 4;

  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padT + chartH - (d.value / maxVal) * chartH,
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

  // Area fill
  const areaPath = `M ${points[0].x},${padT + chartH} ` +
    points.map(p => `L ${p.x},${p.y}`).join(" ") +
    ` L ${points[points.length - 1].x},${padT + chartH} Z`;

  return (
    <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 10, padding: "16px 12px", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", minWidth: 500 }}>
        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = padT + (i / yTicks) * chartH;
          const val = Math.round(maxVal * (1 - i / yTicks));
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#27272a" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#52525b" fontSize={10}>{val}</text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaPath} fill={color} opacity={0.08} />

        {/* Line */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

        {/* X-axis labels (every 5 days) */}
        {data.map((d, i) => {
          if (i % 5 !== 0 && i !== data.length - 1) return null;
          const x = padL + (i / Math.max(data.length - 1, 1)) * chartW;
          return (
            <text key={i} x={x} y={height - 8} textAnchor="middle" fill="#52525b" fontSize={9}>
              {d.label.slice(5)}
            </text>
          );
        })}

        {/* Hover targets */}
        {points.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x - chartW / data.length / 2}
              y={padT}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: "crosshair" }}
            />
            {hoveredIndex === i && (
              <>
                <line x1={p.x} y1={padT} x2={p.x} y2={padT + chartH} stroke="#3f3f46" strokeWidth={1} strokeDasharray="4,4" />
                <circle cx={p.x} cy={p.y} r={4} fill={color} />
                <rect x={p.x - 36} y={p.y - 28} width={72} height={22} rx={4} fill="#27272a" />
                <text x={p.x} y={p.y - 14} textAnchor="middle" fill="#fafafa" fontSize={11} fontWeight={700}>
                  {data[i].value}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data }: { data: ChartPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) return <p style={{ color: "#52525b", fontSize: 13 }}>No data</p>;

  const width = 800;
  const height = 220;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 60;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(60, (chartW / data.length) * 0.6);
  const gap = (chartW - barWidth * data.length) / (data.length + 1);

  return (
    <div style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 10, padding: "16px 12px", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", minWidth: 400 }}>
        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = padT + (i / 4) * chartH;
          const val = Math.round(maxVal * (1 - i / 4));
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#27272a" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#52525b" fontSize={10}>{val}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barH = (d.value / maxVal) * chartH;
          const x = padL + gap + i * (barWidth + gap);
          const y = padT + chartH - barH;
          const isHovered = hoveredIndex === i;
          return (
            <g key={i}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: "pointer" }}
            >
              <rect x={x} y={y} width={barWidth} height={barH} rx={4} fill={isHovered ? "#fdba74" : "#fb923c"} opacity={isHovered ? 1 : 0.85} />
              <text x={x + barWidth / 2} y={padT + chartH + 16} textAnchor="middle" fill="#71717a" fontSize={10}>{d.label}</text>
              {isHovered && (
                <>
                  <rect x={x + barWidth / 2 - 24} y={y - 26} width={48} height={20} rx={4} fill="#27272a" />
                  <text x={x + barWidth / 2} y={y - 12} textAnchor="middle" fill="#fafafa" fontSize={11} fontWeight={700}>{d.value}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Action catalog ───
// Every action label that lib/ai-providers.ts can write to ai_usage,
// what feature triggers it, and which model tier it normally lands
// on. Keep in sync with the call-site wiring — when adding a new AI
// surface, add a row here too. Used by the Usage tab to decode the
// per-feature breakdown.

interface ActionDef { action: string; description: string; tier: "lite" | "primary" | "varies"; }
interface ActionGroup { surface: string; actions: ActionDef[]; }

const ACTION_CATALOG: ActionGroup[] = [
  {
    surface: "Editor — AI buttons (whole document)",
    actions: [
      { action: "polish",       description: "Polish the entire document (the editor's main AI button).", tier: "primary" },
      { action: "summary",      description: "Generate a short summary of the document.",                 tier: "lite" },
      { action: "tldr",         description: "TL;DR — the briefest one-paragraph distill.",                tier: "lite" },
      { action: "translate",    description: "Translate the document to the requested language.",         tier: "primary" },
      { action: "beautify",     description: "Beautify formatting (headings, spacing, lists, tables).",   tier: "primary" },
      { action: "compact",      description: "Compact / tighten the document (remove fluff).",            tier: "primary" },
      { action: "format",       description: "Format raw text into clean Markdown structure.",            tier: "lite" },
      { action: "chat",         description: "Editor chat (signed-in user asking the AI to edit).",        tier: "primary" },
      { action: "visitor_chat", description: "Visitor chat on a public doc (Q&A, no edits).",              tier: "lite" },
    ],
  },
  {
    surface: "Editor — selection toolbar",
    actions: [
      { action: "selection_polish",    description: "Polish the highlighted selection only.",                tier: "lite" },
      { action: "selection_shorten",   description: "Shorten the highlighted selection.",                    tier: "lite" },
      { action: "selection_expand",    description: "Expand the highlighted selection.",                     tier: "lite" },
      { action: "selection_rewrite",   description: "Rewrite the selection per the user's instruction.",     tier: "lite" },
      { action: "selection_translate", description: "Translate the selection to the requested language.",    tier: "lite" },
    ],
  },
  {
    surface: "Chat surfaces (streaming, RAG)",
    actions: [
      { action: "chat-doc",    description: "Long-form chat grounded in a single document.",                tier: "primary" },
      { action: "chat-bundle", description: "Chat grounded in a bundle (multi-doc, with [doc:N] citations).", tier: "primary" },
      { action: "chat-hub",    description: "Chat grounded in a user's entire hub (concept-bridged RAG).",   tier: "primary" },
    ],
  },
  {
    surface: "Bundles (the thinking surface)",
    actions: [
      { action: "bundle-graph",         description: "Generate the bundle's knowledge graph (nodes + edges).", tier: "primary" },
      { action: "bundle-tension",       description: "Resolve a contradiction / tension identified in a bundle.", tier: "primary" },
      { action: "bundle-generate",      description: "Auto-build a bundle for a query — pulls relevant docs.",   tier: "primary" },
      { action: "bundle-suggest-title", description: "Suggest a title for an unnamed bundle.",                   tier: "lite" },
      { action: "bundle-suggestions",   description: "Suggest related bundles the user might want to open.",     tier: "lite" },
      { action: "synthesize",           description: "Synthesize a bundle's docs into a single narrative.",      tier: "primary" },
    ],
  },
  {
    surface: "Doc auto-processing (runs on save)",
    actions: [
      { action: "doc-summary",   description: "Auto-generate the per-document summary (sidebar previews, OG).", tier: "lite" },
      { action: "doc-graph",     description: "Auto-extract the document's local AI graph (concepts + edges).", tier: "lite" },
      { action: "doc-ontology",  description: "Extract the doc's ontology into concept_index + relations.",     tier: "primary" },
      { action: "doc-decompose", description: "Decompose a doc into its parts (sections / claims / refs).",     tier: "primary" },
      { action: "organize-doc",  description: "Background organize job — clean structure, fix headings.",        tier: "lite" },
    ],
  },
  {
    surface: "Hub / Concept",
    actions: [
      { action: "hub-suggestions",        description: "Generate bundle suggestions for the user's hub.",        tier: "primary" },
      { action: "hub-suggested-queries",  description: "Suggest chat queries to seed hub conversations.",         tier: "lite" },
      { action: "concept-define",         description: "Generate the definition for a concept_index entry.",      tier: "lite" },
    ],
  },
  {
    surface: "Search / retrieval",
    actions: [
      { action: "rerank", description: "LLM reranker for vector recall hits before they hit the prompt.", tier: "lite" },
    ],
  },
  {
    surface: "Imports / external intake",
    actions: [
      { action: "import-mdfy", description: "Convert raw text (paste, file drop) → clean Markdown.",       tier: "lite" },
      { action: "llm-clean",   description: "Clean the markdown coming out of PDF extraction.",            tier: "lite" },
      { action: "transform",   description: "Chrome-extension intent transform (clip → tidy markdown).",   tier: "lite" },
    ],
  },
];

// ─── Styles ───

const page: React.CSSProperties = {
  background: "#09090b",
  color: "#fafafa",
  minHeight: "100vh",
  padding: "40px 32px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  maxWidth: 1100,
  margin: "0 auto",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  background: "#1c1c24",
  color: "#a1a1aa",
  border: "1px solid #27272a",
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  background: "#1c1c24",
  border: "1px solid #27272a",
  borderRadius: 10,
  padding: "16px 20px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: 11,
  color: "#52525b",
  borderBottom: "1px solid #27272a",
  textTransform: "uppercase",
  letterSpacing: 1,
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #1c1c24",
  color: "#a1a1aa",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  background: "#1c1c24",
  color: "#fafafa",
  border: "1px solid #27272a",
  borderRadius: 6,
  cursor: "pointer",
  outline: "none",
};
