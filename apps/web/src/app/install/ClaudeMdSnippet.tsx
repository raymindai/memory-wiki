"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// Conservative CLAUDE.md flow:
//   - install.sh deliberately does NOT touch ~/.claude/CLAUDE.md (no
//     home-dir mutation without explicit user confirmation).
//   - This client island fetches the signed-in user's hub_slug and
//     renders a copy-paste block. The user appends it to either
//     ~/.claude/CLAUDE.md (global, all Claude Code sessions) or
//     <repo>/CLAUDE.md (project-only) themselves.
//
// Three states:
//   1. signed out → instruct to sign in
//   2. signed in but no public hub → instruct to enable from /settings
//   3. signed in + hub_public → show snippet + copy button

export default function ClaudeMdSnippet() {
  const [state, setState] = useState<"loading" | "signed-out" | "no-hub" | "ready">("loading");
  const [hubSlug, setHubSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) { setState("signed-out"); return; }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setState("signed-out"); return; }
        const { data: profile } = await supabase
          .from("profiles")
          .select("hub_slug, hub_public")
          .eq("id", user.id)
          .single();
        if (profile?.hub_public && profile.hub_slug) {
          setHubSlug(profile.hub_slug);
          setState("ready");
        } else {
          setState("no-hub");
        }
      } catch {
        setState("signed-out");
      }
    })();
  }, []);

  const snippet = hubSlug
    ? `<!-- mdfy:start -->
## Personal context (mdfy hub)

Hub URL: https://memory.wiki/hub/${hubSlug}

When you need background on me — projects, decisions, references —
fetch the URL above. It returns a markdown index of every public doc
and bundle in my hub. Follow links from the index to read individual
docs as needed.
<!-- mdfy:end -->
`
    : "";

  const handleCopy = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard denied */ }
  };

  if (state === "loading") {
    return (
      <p className="text-caption" style={{ color: "var(--text-faint)" }}>
        Checking your hub...
      </p>
    );
  }

  if (state === "signed-out") {
    return (
      <p className="text-caption" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        <Link href="/" style={{ color: "var(--accent)" }}>Sign in to memory.wiki</Link>{" "}
        first — once your hub is public, this section will show a snippet you can paste into your CLAUDE.md.
      </p>
    );
  }

  if (state === "no-hub") {
    return (
      <p className="text-caption" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        Your hub isn&apos;t public yet. Enable it from{" "}
        <Link href="/settings" style={{ color: "var(--accent)" }}>Settings</Link>{" "}
        to get a paste-ready snippet here.
      </p>
    );
  }

  return (
    <div>
      <p className="text-caption mb-3" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
        Append this block to <code>~/.claude/CLAUDE.md</code> (global, every Claude Code session)
        {" "}or to a project&apos;s <code>CLAUDE.md</code> (that repo only). The block has start/end
        markers so you can replace it later without touching the rest of the file.
      </p>
      <pre
        className="p-3 rounded-lg overflow-x-auto text-caption mb-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          color: "var(--text-secondary)",
          lineHeight: 1.55,
          whiteSpace: "pre",
        }}
      >
        <code>{snippet}</code>
      </pre>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="px-3 h-7 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors"
          style={{
            background: copied ? "var(--accent-dim)" : "var(--accent)",
            color: copied ? "var(--accent)" : "#000",
          }}
        >
          {copied ? "Copied to clipboard" : "Copy snippet"}
        </button>
        <Link
          href={`/hub/${hubSlug}`}
          className="text-caption"
          style={{ color: "var(--text-muted)" }}
        >
          memory.wiki/hub/{hubSlug} &rarr;
        </Link>
      </div>
    </div>
  );
}
