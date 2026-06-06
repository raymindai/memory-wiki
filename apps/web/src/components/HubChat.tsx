"use client";

// Hub-scoped chat panel — twin of BundleChat, but with retrieval that
// spans the user's whole hub via the concept_index ontology. Streams
// plain text (the /api/hub/[slug]/chat backend writes Anthropic deltas
// directly to the response body, no SSE wrapper) and renders
// [doc:<id>] citation chips inline.

import { useState, useRef, useEffect, useCallback } from "react";
import { GitBranch, Sparkles, HelpCircle, Network, BookmarkPlus, Check } from "lucide-react";
import ChatMarkdown from "@/components/ChatMarkdown";
import { showToast } from "@/components/Toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface HubChatProps {
  slug: string;
  hubName?: string;
  conceptCount?: number;
  /** Accent + dim hex/rgba pair so the panel can colour itself
   *  distinctly from Doc / Bundle assistants. Defaults fall back to
   *  the global --accent. */
  accent?: string;
  accentDim?: string;
  /** Click handler for [doc:<id>] citation chips. Caller resolves the
   *  doc id (open as tab, navigate, etc.). */
  onCitationClick?: (docId: string) => void;
  /** Optional: parent's hook to refresh the sidebar tabs after a
   *  chat answer is saved as a new doc. Without this the new doc
   *  appears on the next manual refresh — still safe, just less
   *  immediate. */
  onDocCreated?: (docId: string) => void;
}

const QUICK_ACTIONS = [
  { label: "Map of my hub", icon: <Network width={11} height={11} />, question: "Give me a high-level map of the main concepts in this hub and how they connect." },
  { label: "What's important", icon: <Sparkles width={11} height={11} />, question: "Which concepts are most central across my docs? Why?" },
  { label: "Connections", icon: <GitBranch width={11} height={11} />, question: "What are the most surprising connections between docs in this hub?" },
  { label: "Gaps", icon: <HelpCircle width={11} height={11} />, question: "Based on my docs, what important questions am I NOT answering yet?" },
];

export default function HubChat({ slug, hubName, conceptCount, accent, accentDim, onCitationClick, onDocCreated }: HubChatProps) {
  const themeAccent = accent || "var(--text-primary)";
  const themeAccentDim = accentDim || "var(--border)";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist chat history per hub so reloading keeps the conversation.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`mw-hub-chat-${slug}`);
      if (saved) setMessages(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [slug]);
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(`mw-hub-chat-${slug}`, JSON.stringify(messages)); } catch { /* ignore */ }
    }
  }, [messages, slug]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isStreaming]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setError(null);
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/hub/${slug}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        setError(`Failed to start chat (${res.status})`);
        setIsStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: assistantContent };
          return next;
        });
      }
    } catch {
      setError("Connection failed");
    } finally {
      setIsStreaming(false);
    }
  }, [slug, messages, isStreaming]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = useCallback((skipConfirm = false) => {
    if (!skipConfirm && !confirm("Start a new chat? Current conversation will be cleared.")) return;
    setMessages([]);
    setError(null);
    setInput("");
    try { localStorage.removeItem(`mw-hub-chat-${slug}`); } catch { /* ignore */ }
  }, [slug]);

  // Per-message save state — a Set of indices already saved this
  // session so we can show the green check + disable the button
  // without polling the server.
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());

  const saveAsDoc = useCallback(async (assistantIndex: number) => {
    const assistant = messages[assistantIndex];
    if (!assistant || assistant.role !== "assistant" || !assistant.content.trim()) return;
    // The preceding user message — if any — gives us a real title.
    // Fall back to a generic label if the user kicked off via a
    // quick-action button and the array is empty before this point.
    const prev = messages[assistantIndex - 1];
    const userQ = prev && prev.role === "user" ? prev.content.trim() : "";
    const rawTitle = userQ ? userQ.replace(/[\r\n]+/g, " ") : "Hub Chat — saved answer";
    const title = rawTitle.length > 80 ? rawTitle.slice(0, 77) + "…" : rawTitle;
    const dateStr = new Date().toISOString().slice(0, 10);
    const body = [
      `# ${title}`,
      "",
      userQ ? `> **Asked:** ${userQ}` : `> _Saved Hub Chat answer._`,
      "",
      assistant.content.trim(),
      "",
      "---",
      `_Saved from Hub Chat on ${dateStr} · source: \`hub-chat:${slug}\`_`,
      "",
    ].join("\n");

    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: body,
          title,
          isDraft: true, // land as draft — owner reviews before publishing
          source: `hub-chat:${slug}`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        showToast(json.error || "Couldn't save this answer", "error");
        return;
      }
      setSavedIndices((prev) => { const next = new Set(prev); next.add(assistantIndex); return next; });
      showToast("Saved as draft — open from your sidebar", "success");
      onDocCreated?.(json.id);
    } catch {
      showToast("Couldn't save this answer", "error");
    }
  }, [messages, slug, onDocCreated]);

  // Listen for the global "new chat" event fired by the panel header
  // button so the user has a single, always-visible affordance.
  // Empty state is a no-op (no confirm dialog needed).
  useEffect(() => {
    const handler = () => {
      if (messages.length === 0) return;
      clearChat();
    };
    window.addEventListener("mw-newchat-hub", handler);
    return () => window.removeEventListener("mw-newchat-hub", handler);
  }, [clearChat, messages.length]);

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <div className="px-2 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <div className="grid grid-cols-2 gap-1">
          {QUICK_ACTIONS.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q.question)} disabled={isStreaming}
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

      <div className="flex-1 overflow-auto px-3 py-4 min-w-0">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: themeAccentDim }}>
              <Network width={22} height={22} style={{ color: themeAccent }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{hubName || "Hub Assistant"}</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {conceptCount && conceptCount > 0
                ? `${conceptCount} concepts indexed across your hub. Answers are grounded in your ontology with neighbor walks for cross-doc reasoning.`
                : "Run Analyze on a bundle to populate the ontology, then ask anything."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                onCitationClick={onCitationClick}
                isStreaming={isStreaming && i === messages.length - 1}
                accent={themeAccent}
                accentDim={themeAccentDim}
                onSaveAsDoc={msg.role === "assistant" && !(isStreaming && i === messages.length - 1) && msg.content.trim().length > 40
                  ? () => saveAsDoc(i)
                  : undefined}
                saved={savedIndices.has(i)}
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

      <form onSubmit={onSubmit} className="shrink-0 px-2 py-2" style={{ borderTop: "1px solid var(--border-dim)" }}>
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg min-w-0" style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e.nativeEvent as unknown as { isComposing?: boolean }).isComposing && input.trim() && !isStreaming) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Ask anything across your hub…"
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

function MessageBubble({ message, onCitationClick, isStreaming, onSaveAsDoc, saved }: { message: Message; onCitationClick?: (docId: string) => void; isStreaming?: boolean; accent: string; accentDim: string; onSaveAsDoc?: () => void; saved?: boolean }) {
  // Chat bubbles use the global memory.wiki orange uniformly — per-mode colour
  // already lives in the panel header so you know which assistant is
  // active; the bubble itself doesn't need to repeat that signal.
  const chatAccent = "var(--text-primary)";
  const chatAccentDim = "var(--border)";

  const isUser = message.role === "user";
  if (isUser) {
    // User bubble — quiet dark surface (not loud orange). Right
    // alignment + sharp top-right corner is enough to read as
    // "from me"; the orange glaze hurt legibility (orange + white).
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
  // Assistant: small rounded-square avatar + label above the bubble.
  // Bubble is a quiet container — no left stripe — so the message
  // reads as a chat bubble, not a callout.
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 20, height: 20, borderRadius: 4, background: chatAccentDim }}
        >
          <Network width={11} height={11} style={{ color: chatAccent }} />
        </div>
        <span
          className="font-bold uppercase tracking-wider"
          style={{ color: chatAccent, fontSize: 10, letterSpacing: "0.08em" }}
        >
          Hub
        </span>
      </div>
      <div
        className="px-3 py-2 rounded-lg leading-relaxed min-w-0"
        style={{
          background: "var(--toggle-bg)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-dim)",
          fontSize: 13,
        }}
      >
        <ChatMarkdown
          content={message.content}
          accent={chatAccent}
          accentDim={chatAccentDim}
          citationRegex={/\[doc:([\w-]+)\]/g}
          resolveCitation={(m) => ({ label: m[1], docId: m[1], title: `Open doc ${m[1]}` })}
          onCitationClick={onCitationClick}
        />
        {isStreaming && <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style={{ background: chatAccent, verticalAlign: "middle" }} />}
      </div>
      {/* Save-as-doc — turns a useful answer into a durable wiki page.
          Kept outside the bubble + minimal so it doesn't compete with
          the answer content; activates only when the message is long
          enough to be worth saving. */}
      {onSaveAsDoc && (
        <button
          onClick={onSaveAsDoc}
          disabled={saved}
          className="self-start flex items-center gap-1 px-1.5 py-0.5 rounded text-caption transition-colors hover:bg-[var(--menu-hover)] disabled:cursor-default"
          style={{ color: saved ? chatAccent : "var(--text-faint)", fontSize: 11 }}
          title={saved ? "Saved to your hub as a draft" : "Save this answer as a draft document in your hub"}
        >
          {saved ? <Check width={10} height={10} /> : <BookmarkPlus width={10} height={10} />}
          <span>{saved ? "Saved" : "Save as doc"}</span>
        </button>
      )}
    </div>
  );
}

