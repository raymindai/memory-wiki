"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CheckSquare, Scale, HelpCircle, Layers, ScrollText, Filter } from "lucide-react";
import ChatMarkdown from "@/components/ChatMarkdown";

/** Pull every [doc:N] citation in an assistant message and resolve to
 *  the actual document ids via the message's docMap. Used by the
 *  "Show on canvas" action: an answer that cites [doc:2][doc:4]
 *  becomes a 2-doc filter on the canvas. */
function citedDocIdsFor(msg: { content: string; docMap?: Record<number, { id: string; title: string }> }): string[] {
  if (!msg.docMap) return [];
  const matches = msg.content.matchAll(/\[doc:(\d+)\]/g);
  const ids = new Set<string>();
  for (const m of matches) {
    const num = parseInt(m[1], 10);
    const doc = msg.docMap[num];
    if (doc?.id) ids.add(doc.id);
  }
  return [...ids];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  docMap?: Record<number, { id: string; title: string }>;
}

interface BundleChatProps {
  bundleId: string;
  bundleTitle?: string;
  documentCount?: number;
  /** Accent + dim hex/rgba pair so the panel can colour itself
   *  distinctly from Doc / Hub assistants. Defaults fall back to the
   *  global --accent. */
  accent?: string;
  accentDim?: string;
  onCitationClick?: (docId: string) => void;
  /** Conversational-query → canvas filter bridge. Called when the
   *  user clicks "Show on canvas" on a chat message; the parent
   *  applies the doc-id set as a highlight on BundleCanvas. */
  onApplyFilter?: (docIds: string[]) => void;
  onClose?: () => void;
}

// Quick action prompts shown as a 2x2 grid (matches Document Assistant pattern).
// Icons use currentColor so the row inherits the Bundle theme colour at render.
const QUICK_ACTIONS = [
  { label: "Summarize", icon: <ScrollText width={11} height={11} />, question: "Give me a clear, structured summary of what this bundle contains as a whole." },
  { label: "Action items", icon: <CheckSquare width={11} height={11} />, question: "Extract all action items, tasks, or recommendations mentioned across the documents. Format as a checklist." },
  { label: "Tensions", icon: <Scale width={11} height={11} />, question: "What tensions, contradictions, or conflicting viewpoints exist between these documents?" },
  { label: "What's missing", icon: <HelpCircle width={11} height={11} />, question: "What important topics, perspectives, or information are missing from this bundle?" },
];

export default function BundleChat({ bundleId, bundleTitle, documentCount, accent, accentDim, onCitationClick, onApplyFilter }: BundleChatProps) {
  const themeAccent = accent || "var(--accent)";
  const themeAccentDim = accentDim || "var(--accent-dim)";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`mdfy-chat-${bundleId}`);
      if (saved) setMessages(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [bundleId]);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(`mdfy-chat-${bundleId}`, JSON.stringify(messages)); } catch { /* ignore */ }
    }
  }, [messages, bundleId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setError(null);

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message for streaming
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/bundles/${bundleId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        setError("Failed to start chat");
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let docMap: Record<number, { id: string; title: string }> | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) { setError(data.error); break; }
            if (data.text) {
              assistantContent += data.text;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantContent, docMap };
                return next;
              });
            }
            if (data.done && data.docMap) {
              docMap = data.docMap;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantContent, docMap };
                return next;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setError("Connection failed");
    } finally {
      setIsStreaming(false);
    }
  }, [bundleId, messages, isStreaming]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Kept for potential future textarea use; the input is now single-line.

  const clearChat = useCallback((skipConfirm = false) => {
    if (!skipConfirm && !confirm("Start a new chat? Current conversation will be cleared.")) return;
    setMessages([]);
    setError(null);
    setInput("");
    try { localStorage.removeItem(`mdfy-chat-${bundleId}`); } catch { /* ignore */ }
  }, [bundleId]);

  // Listen for the global "new chat" event fired by the panel header
  // so the user has a single always-visible "New chat" affordance.
  useEffect(() => {
    const handler = () => {
      if (messages.length === 0) return;
      clearChat();
    };
    window.addEventListener("mdfy-newchat-bundle", handler);
    return () => window.removeEventListener("mdfy-newchat-bundle", handler);
  }, [clearChat, messages.length]);

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/* Quick actions — 2x2 grid, mirrors Document Assistant style */}
      <div className="px-2 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <div className="grid grid-cols-2 gap-1">
          {QUICK_ACTIONS.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q.question)}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-caption transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-0"
              style={{ background: "var(--toggle-bg)", color: "var(--text-primary)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = themeAccentDim; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--toggle-bg)"; }}>
              <span className="shrink-0" style={{ color: themeAccent }}>{q.icon}</span>
              <span className="truncate">{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages / empty state */}
      <div className="flex-1 overflow-auto px-3 py-4 min-w-0">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: themeAccentDim }}>
              <Layers width={22} height={22} style={{ color: themeAccent }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{bundleTitle || "This bundle"}</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {documentCount
                ? `${documentCount} document${documentCount !== 1 ? "s" : ""} grouped together. Answers reason ACROSS them — tensions, gaps, summaries.`
                : "Ask anything about this bundle."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                onCitationClick={onCitationClick}
                onApplyFilter={onApplyFilter}
                isStreaming={isStreaming && i === messages.length - 1}
                accent={themeAccent}
                accentDim={themeAccentDim}
              />
            ))}
            {error && (
              <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input — visually matches Document Assistant input exactly:
          same wrapper padding, same inner box (toggle-bg + border-dim, rounded-lg,
          px-3 py-2, gap-1.5), same text-caption, same paper-plane Send icon. */}
      <form onSubmit={onSubmit} className="shrink-0 px-2 py-2" style={{ borderTop: "1px solid var(--border-dim)" }}>
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg min-w-0" style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e.nativeEvent as unknown as { isComposing?: boolean }).isComposing && input.trim() && !isStreaming) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Ask anything across this bundle…"
            maxLength={500}
            disabled={isStreaming}
            autoFocus
            className="flex-1 bg-transparent min-w-0"
            style={{ color: "var(--text-secondary)", border: "none", outline: "none", fontSize: "0.875rem" }}
          />
          {/* Inline reset removed — panel header now owns the "New chat" affordance. */}
          <button type="submit" disabled={!input.trim() || isStreaming}
            className="shrink-0 p-1.5 rounded-md transition-colors"
            style={{ background: input.trim() && !isStreaming ? themeAccent : "transparent", color: input.trim() && !isStreaming ? "#fff" : "var(--text-faint)" }}
            title="Send">
            {isStreaming ? (
              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin block" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2L2 8.5l5 2L9.5 16z"/><path d="M14 2L7 10.5"/></svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Message Bubble with citation rendering ───

function MessageBubble({ message, onCitationClick, onApplyFilter, isStreaming }: { message: Message; onCitationClick?: (docId: string) => void; onApplyFilter?: (docIds: string[]) => void; isStreaming?: boolean; accent: string; accentDim: string }) {
  // Chat bubbles use the global memory.wiki orange uniformly — per-mode colour
  // already lives in the panel header so you know which assistant is
  // active; the bubble itself doesn't need to repeat that signal.
  const chatAccent = "var(--accent)";
  const chatAccentDim = "var(--accent-dim)";

  const isUser = message.role === "user";

  if (isUser) {
    // User bubble — quiet dark surface (not loud orange) for legibility.
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] min-w-0 px-3 py-2 rounded-2xl rounded-tr-md leading-relaxed"
          style={{
            background: "var(--surface)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-dim)",
            fontSize: 13,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant: small rounded-square avatar + label above a quiet
  // bubble — no left stripe.
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 20, height: 20, borderRadius: 4, background: chatAccentDim }}
        >
          <Layers width={11} height={11} style={{ color: chatAccent }} />
        </div>
        <span
          className="font-bold uppercase tracking-wider"
          style={{ color: chatAccent, fontSize: 10, letterSpacing: "0.08em" }}
        >
          Bundle
        </span>
      </div>
      <div
        className="px-3 py-2 rounded-lg leading-relaxed min-w-0"
        style={{
          background: "var(--toggle-bg)",
          color: "var(--text-primary)",
          fontSize: 13,
          border: "1px solid var(--border-dim)",
        }}
      >
        <ChatMarkdown
          content={message.content}
          accent={chatAccent}
          accentDim={chatAccentDim}
          citationRegex={/\[doc:(\d+)\]/g}
          resolveCitation={(m) => {
            const num = parseInt(m[1]);
            const doc = message.docMap?.[num];
            return doc ? { label: String(num), docId: doc.id, title: doc.title } : null;
          }}
          onCitationClick={onCitationClick}
        />
        {isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style={{ background: chatAccent, verticalAlign: "middle" }} />}
      </div>
      {/* "Show on canvas" — surfaces once streaming finishes and the
          message has at least one [doc:N] citation. Clicks pass the
          deduplicated doc id set to the parent, which hands it to
          BundleCanvas as the highlight filter. */}
      {!isStreaming && onApplyFilter && (() => {
        const docIds = citedDocIdsFor(message);
        if (docIds.length === 0) return null;
        return (
          <button
            type="button"
            onClick={() => onApplyFilter(docIds)}
            className="self-start inline-flex items-center gap-1 px-2 py-1 rounded-md text-caption transition-colors hover:bg-[var(--toggle-bg)]"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)", fontWeight: 500 }}
            title={`Highlight ${docIds.length} doc${docIds.length === 1 ? "" : "s"} on the bundle canvas`}
          >
            <Filter width={11} height={11} style={{ color: chatAccent }} />
            <span>Show on canvas ({docIds.length})</span>
          </button>
        );
      })()}
    </div>
  );
}

