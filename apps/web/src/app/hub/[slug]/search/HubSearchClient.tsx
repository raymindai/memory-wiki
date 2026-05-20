"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, FileText, Sparkles } from "lucide-react";

interface HubSearchResult {
  id: string;
  title: string;
  url: string;
  snippet?: string | null;
  distance?: number;
  updated_at?: string;
}

interface Props {
  slug: string;
  author: string;
  hubDescription: string | null;
  initialQuery: string;
}

/**
 * Hub-scoped search surface. Powered by the existing
 * /api/hub/[slug]/recall endpoint (hybrid semantic + BM25 with
 * Haiku rerank). UI is a search box + results list — the same
 * shape Wikipedia / Notion users expect, but the matching engine
 * is the AI-era one (concepts + embeddings, not full-text only).
 *
 * Public surface: anonymous visitors can search any public hub.
 * No headers required.
 */
export default function HubSearchClient({ slug, author, hubDescription, initialQuery }: Props) {
  const router = useRouter();
  const [input, setInput] = useState(initialQuery);
  const [results, setResults] = useState<HubSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/${slug}/recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, k: 10, level: "doc", rerank: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Search failed (${res.status})`);
        setResults([]);
        return;
      }
      const json = await res.json();
      setResults((json.results || []) as HubSearchResult[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Run search on mount when arriving with ?q=... so the page is
  // shareable (someone pastes the URL → results paint immediately).
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 2) {
      runSearch(initialQuery);
    }
  }, [initialQuery, runSearch]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    // Reflect the query in the URL so the page is shareable + the
    // browser back button works. Avoid blocking the input on the
    // navigation update.
    startTransition(() => {
      router.replace(trimmed ? `/hub/${slug}/search?q=${encodeURIComponent(trimmed)}` : `/hub/${slug}/search`);
    });
    runSearch(input);
  };

  return (
    <div className="min-h-screen mdcore-rendered" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href={`/hub/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={14} />
          {author}&apos;s hub
        </Link>

        <div className="flex items-center gap-2 text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
          <Search size={12} />
          <span>Search</span>
        </div>
        <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Search {author}&apos;s hub
        </h1>
        {hubDescription && (
          <p className="text-base leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            {hubDescription}
          </p>
        )}
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-faint)" }}>
          Hybrid retrieval — concept-aware semantic search combined with keyword fallback. Results re-ranked by relevance.
        </p>

        <form onSubmit={onSubmit} className="mb-8">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            <Search size={16} style={{ color: "var(--text-faint)" }} />
            <input
              type="search"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something about this hub..."
              maxLength={500}
              className="flex-1 bg-transparent text-base"
              style={{ color: "var(--text-primary)", border: "none", outline: "none" }}
            />
            <button
              type="submit"
              disabled={loading || input.trim().length < 2}
              className="px-3 py-1 rounded-md text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {error && (
          <div className="px-4 py-3 rounded-md mb-6 text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        {!loading && results !== null && results.length === 0 && !error && (
          <div className="text-center py-12">
            <Sparkles size={24} className="mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No matches for <strong style={{ color: "var(--text-primary)" }}>&ldquo;{input}&rdquo;</strong> in {author}&apos;s public docs.
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
              Try a broader phrase or a related concept.
            </p>
          </div>
        )}

        {results && results.length > 0 && (
          <section>
            <h2 className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              {results.length} result{results.length === 1 ? "" : "s"}
            </h2>
            <ul className="space-y-3">
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/${r.id}`}
                    className="block p-4 rounded-lg transition-colors hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <FileText size={13} style={{ color: "var(--text-faint)", flexShrink: 0, transform: "translateY(1px)" }} />
                      <h3 className="text-base font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                        {r.title || "Untitled"}
                      </h3>
                    </div>
                    {r.snippet && (
                      <p className="text-sm leading-relaxed line-clamp-3 mb-2" style={{ color: "var(--text-secondary)" }}>
                        {r.snippet}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-faint)" }}>
                      <code className="font-mono">/{r.id}</code>
                      {r.updated_at && (
                        <span>{new Date(r.updated_at).toISOString().slice(0, 10)}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs font-mono mt-12" style={{ color: "var(--text-faint)" }}>
          API:{" "}
          <code style={{ color: "var(--text-muted)" }}>
            POST https://memory.wiki/api/hub/{slug}/recall
          </code>
        </p>
      </div>
    </div>
  );
}
