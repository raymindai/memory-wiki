"use client";

/**
 * Inline "Ask AI about this doc" surface for the public viewer
 * (/d/[id]). Visitors who land on a long doc usually need to extract
 * one specific thing — a summary, the answer to a question, a
 * comparison. Without this they'd copy-paste the doc into their own
 * AI tool. Letting them ask in-place does two things:
 *
 *   1. Keeps them on memory.wiki long enough to notice the "Save this as
 *      your own doc" CTA at the bottom of the chat.
 *   2. Gives memory.wiki a real signal of what visitors do with each doc —
 *      useful for trending / recommendation later.
 *
 * Read-only — the chat answer never modifies the underlying doc.
 * That's the owner's job in the editor. We use the same /api/ai
 * endpoint as the editor (3-provider failover), but restrict the
 * action to "chat" with a prompt that nudges the model into
 * ANSWER mode (the same chat prompt the editor uses already
 * supports A/B/C intent classification — we ignore the EDIT path
 * here and treat any output as text-to-show).
 */

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";

interface Turn {
  role: "user" | "ai";
  text: string;
}

export default function VisitorAskAI({
  markdown,
  docTitle,
  docId,
}: {
  markdown: string;
  docTitle: string | null;
  docId: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest exchange in view as the AI streams in. We aren't
  // actually streaming yet (the /api/ai endpoint returns a single
  // JSON), but this still keeps the scroll glued to the bottom when
  // a long answer expands the panel.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  // Seed examples — three short questions tailored to "I'm reading
  // this doc, what would I actually ask?". Click to pre-fill the
  // input so the visitor doesn't have to think of a starter prompt.
  const seedQuestions = [
    "TL;DR in 3 bullets",
    "What's the main claim?",
    "Where does this disagree with itself?",
  ];

  async function send(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    setError(null);
    setBusy(true);
    setTurns((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // visitor_chat is a read-only path with its own prompt
          // (lib/ai-providers via /api/ai). It never returns the
          // document body and never uses ANSWER:/EDIT: prefixes.
          action: "visitor_chat",
          markdown,
          instruction: trimmed,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Request failed (${res.status})`);
        setBusy(false);
        return;
      }
      const data = await res.json();
      const answer: string = (data.result || "").trim();
      if (!answer) {
        setError("AI returned an empty answer.");
        setBusy(false);
        return;
      }
      setTurns((prev) => [...prev, { role: "ai", text: answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="max-w-3xl mx-auto px-6 mt-8 mb-4">
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:bg-[var(--toggle-bg)]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-dim)",
            color: "var(--text-secondary)",
          }}
        >
          <span className="flex items-center gap-2">
            <Sparkles width={14} height={14} style={{ color: "var(--micro-ai)" }} />
            <span className="text-body font-medium" style={{ color: "var(--text-primary)" }}>
              Ask AI about this doc
            </span>
          </span>
          <span className="text-caption" style={{ color: "var(--text-faint)" }}>
            Stay here — no copy-paste needed
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 mt-8 mb-4">
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--border-dim)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles width={14} height={14} style={{ color: "var(--micro-ai)" }} />
            <span className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>
              Ask AI
            </span>
            <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
              about &ldquo;{docTitle || "this doc"}&rdquo;
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded transition-colors hover:bg-[var(--menu-hover)]"
            style={{ color: "var(--text-faint)" }}
            aria-label="Close"
          >
            <X width={14} height={14} />
          </button>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="px-4 py-3 max-h-[420px] overflow-y-auto"
          style={{ minHeight: 120 }}
        >
          {turns.length === 0 && (
            <>
              <p className="text-body mb-3" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Ask anything about this document. Answers come from the doc itself, no internet search.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {seedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={busy}
                    className="text-caption px-2.5 py-1 rounded-full transition-colors hover:bg-[var(--border)]"
                    style={{
                      background: "var(--toggle-bg)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-dim)",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </>
          )}
          {turns.map((t, i) => (
            <div key={i} className="mb-3">
              {t.role === "user" ? (
                <div className="flex justify-end">
                  <div
                    className="inline-block max-w-[80%] px-3 py-1.5 rounded-lg text-body"
                    style={{
                      background: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {t.text}
                  </div>
                </div>
              ) : (
                <div
                  className="text-body whitespace-pre-wrap"
                  style={{ color: "var(--text-primary)", lineHeight: 1.55 }}
                >
                  {t.text}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-caption" style={{ color: "var(--text-faint)" }}>
              <Loader2 width={11} height={11} className="animate-spin" />
              Thinking…
            </div>
          )}
          {error && (
            <div
              className="text-caption px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderTop: "1px solid var(--border-dim)" }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this doc…"
            disabled={busy}
            className="flex-1 px-2 py-1.5 rounded text-body outline-none"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border-dim)",
              color: "var(--text-primary)",
              fontSize: "0.875rem",
            }}
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="p-1.5 rounded transition-colors"
            style={{
              background: input.trim() && !busy ? "var(--text-primary)" : "var(--toggle-bg)",
              color: input.trim() && !busy ? "#000" : "var(--text-faint)",
              cursor: input.trim() && !busy ? "pointer" : "not-allowed",
            }}
            aria-label="Send"
          >
            <Send width={13} height={13} />
          </button>
        </form>

        {/* Save-as-yours nudge — only after at least one round-trip so
            we don't pitch the funnel before delivering value. The link
            takes the visitor to root with a query that opens a fresh
            tab pre-loaded with this doc's markdown so they can keep
            editing in their own account. */}
        {turns.length > 0 && (
          <div
            className="px-4 py-2 text-caption flex items-center justify-between gap-3"
            style={{
              background: "var(--background)",
              borderTop: "1px solid var(--border-dim)",
              color: "var(--text-faint)",
            }}
          >
            <span>Want to keep this conversation as your own doc?</span>
            <a
              href={`/?fork=${encodeURIComponent(docId)}`}
              className="font-medium transition-colors"
              style={{ color: "var(--text-primary)" }}
            >
              Save in memory.wiki →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
