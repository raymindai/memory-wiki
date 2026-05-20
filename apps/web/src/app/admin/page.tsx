"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [tab, setTab] = useState<"overview" | "charts" | "users" | "documents" | "emails" | "activity" | "settings">("overview");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  // AI model settings
  const [aiModelPrimary, setAiModelPrimary] = useState("gemini-3-flash-preview");
  const [aiModelLite, setAiModelLite] = useState("gemini-3.1-flash-lite");
  const [savingModels, setSavingModels] = useState(false);
  const [modelSaveMsg, setModelSaveMsg] = useState("");

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

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      if (data.aiModels) {
        setAiModelPrimary(data.aiModels.primary || "gemini-3-flash-preview");
        setAiModelLite(data.aiModels.lite || "gemini-3.1-flash-lite");
      }
    } catch {
      setAuthed(false);
    }
    setLoading(false);
    setLastUpdated(Date.now());
  }, [email]);

  useEffect(() => {
    if (authed && email) fetchData();
  }, [authed, email, fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!authed || !email) return;
    const interval = setInterval(() => { fetchData(); }, 30000);
    return () => clearInterval(interval);
  }, [authed, email, fetchData]);

  // "Last updated X seconds ago" ticker
  useEffect(() => {
    if (lastUpdated === null) return;
    setSecondsAgo(0);
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

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
          <button onClick={fetchData} style={btnStyle}>Refresh</button>
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
        {(["overview", "charts", "users", "documents", "activity", "settings"] as const).map(t => (
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

          {/* Settings */}
          {tab === "settings" && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fafafa", margin: "0 0 8px" }}>AI Model Configuration</h3>
              <p style={{ fontSize: 12, color: "#52525b", marginBottom: 24 }}>
                Configure which Gemini models are used for AI features. Changes take effect within 5 minutes.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 480 }}>
                {/* Primary model */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 6 }}>
                    Primary Model
                    <span style={{ fontWeight: 400, color: "#52525b", marginLeft: 8 }}>chat, polish, translate</span>
                  </label>
                  <select
                    value={aiModelPrimary}
                    onChange={e => setAiModelPrimary(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  </select>
                </div>

                {/* Lite model */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#a1a1aa", display: "block", marginBottom: 6 }}>
                    Lite Model
                    <span style={{ fontWeight: 400, color: "#52525b", marginLeft: 8 }}>summary, tldr</span>
                  </label>
                  <select
                    value={aiModelLite}
                    onChange={e => setAiModelLite(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  </select>
                </div>

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
                          body: JSON.stringify({ aiModelPrimary, aiModelLite }),
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
                    {savingModels ? "Saving..." : "Save Models"}
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
