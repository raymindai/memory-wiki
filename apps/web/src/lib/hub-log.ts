import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * Append-only hub log. Mirrors Karpathy's `log.md` pattern: a
 * chronological record of every meaningful mutation in the hub. The
 * synthesis (W4), lint (W5c), and any future automation that wants
 * to know "what changed when" reads from here.
 *
 * Writes are best-effort: if the row insert fails, we log and move on.
 * The user-facing operation that triggered the entry should never
 * fail because logging failed.
 */

export type HubLogEvent =
  | "doc.created"
  | "doc.updated"
  | "doc.deleted"
  | "doc.imported"     // pdf, share-link, etc.
  | "bundle.created"
  | "bundle.deleted"
  | "synthesis.created"
  | "synthesis.updated"
  | "schema.updated";

export interface HubLogEntry {
  userId: string;
  event: HubLogEvent;
  targetType?: "document" | "bundle" | "hub" | "schema";
  targetId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

export async function appendHubLog(entry: HubLogEntry): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await appendHubLogWith(supabase, entry);
}

export async function appendHubLogWith(
  supabase: SupabaseClient,
  entry: HubLogEntry,
): Promise<void> {
  if (!entry.userId) return;
  try {
    const { error } = await supabase.from("hub_log").insert({
      user_id: entry.userId,
      event_type: entry.event,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      summary: entry.summary ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) {
      console.warn("hub_log append failed:", error.message);
    }
  } catch (err) {
    console.warn("hub_log append threw:", err);
  }
}

export interface HubLogRow {
  id: number;
  event_type: HubLogEvent;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function readHubLog(
  userId: string,
  limit = 200,
): Promise<HubLogRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("hub_log")
    .select("id, event_type, target_type, target_id, summary, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) {
    console.warn("hub_log read failed:", error.message);
    return [];
  }
  return (data || []) as HubLogRow[];
}

/**
 * Render the log as Karpathy-style append-only markdown. Caller pipes
 * this through /hub/<slug>/log.md so AI fetchers can pull it.
 */
export function formatHubLogMarkdown(rows: HubLogRow[]): string {
  if (rows.length === 0) {
    return "# Hub log\n\n_No activity yet._\n";
  }
  const lines: string[] = ["# Hub log", ""];
  for (const row of rows) {
    const ts = row.created_at;
    const tag = row.event_type;
    const summary = row.summary || row.target_id || "";
    const ref = row.target_id && row.target_type === "document"
      ? ` (memory.wiki/${row.target_id})`
      : row.target_id && row.target_type === "bundle"
        ? ` (memory.wiki/b/${row.target_id})`
        : "";
    lines.push(`- \`${ts}\` **${tag}** ${summary}${ref}`.trim());
  }
  lines.push("");
  return lines.join("\n");
}
