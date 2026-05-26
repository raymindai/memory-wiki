"use client";

/**
 * BundleCreatorModal — modal for creating a new bundle from a
 * selection of existing docs. Includes an "Ask AI" prompt that the
 * /api/bundles/ai-generate endpoint expands into a title +
 * description + per-doc annotations.
 *
 * Extracted from MdEditor.tsx so the modal can live alongside other
 * editor modals without bloating the editor module further.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { suggestBundleTitle } from "@/lib/editor-helpers";

export default function BundleCreatorModal({
  allDocs,
  initiallySelected,
  authHeaders,
  onClose,
  onCreate,
}: {
  allDocs: Array<{ id: string; title: string; lastOpenedAt?: number }>;
  initiallySelected: Array<{ id: string; title: string }>;
  authHeaders: Record<string, string>;
  onClose: () => void;
  onCreate: (args: { title: string; description?: string; docIds: string[]; annotationByDocId?: Record<string, string> }) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initiallySelected.map(d => d.id));
  const [creating, setCreating] = useState(false);

  // Ask AI section — collapsed by default so the Documents picker
  // gets the panel's full attention. User clicks the header to open.
  const [showAskAI, setShowAskAI] = useState(false);

  // AI title suggester state — wired to /api/bundles/suggest-title.
  // Reads the selected docs' content and fills the title field.
  const [suggestingTitle, setSuggestingTitle] = useState(false);
  const [titleSuggestError, setTitleSuggestError] = useState<string | null>(null);

  // AI Bundle Generation state (Ask AI prompt → docs + title)
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState("");
  const [aiAnnotations, setAiAnnotations] = useState<Record<string, string>>({});
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  // Suggestions are user-revealed, not shown by default — the list
  // was crowding the Documents panel below and pushing the document
  // picker into a 2-3-row sliver.
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Title placeholder — heuristic from currently-selected docs, used
  // as the visible hint in the input. If the user clicks Create with
  // the field empty, this is what gets submitted.
  const selectedDocsForTitle = useMemo(() => {
    const idSet = new Set(selectedIds);
    return allDocs.filter((d) => idSet.has(d.id)).map((d) => ({ title: d.title }));
  }, [selectedIds, allDocs]);
  const titlePlaceholder = useMemo(() => {
    if (selectedDocsForTitle.length === 0) return "My Bundle";
    return suggestBundleTitle(selectedDocsForTitle);
  }, [selectedDocsForTitle]);

  const requestAITitle = useCallback(async () => {
    if (suggestingTitle) return;
    if (selectedIds.length === 0) {
      setTitleSuggestError("Pick at least one document first.");
      return;
    }
    setTitleSuggestError(null);
    setSuggestingTitle(true);
    try {
      const res = await fetch("/api/bundles/suggest-title", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ documentIds: selectedIds.slice(0, 25) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      if (typeof data?.title === "string" && data.title.trim()) {
        setTitle(data.title.trim());
      } else {
        throw new Error("Empty response from AI");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to suggest title";
      setTitleSuggestError(msg);
    } finally {
      setSuggestingTitle(false);
    }
  }, [authHeaders, selectedIds, suggestingTitle]);

  // Fetch suggestion prompts on mount — fire once, keep result for the
  // life of the modal. Empty list (cold hub / AI unavailable) hides
  // the chip row silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bundles/suggestions", { headers: authHeaders });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Array.isArray(data?.prompts)) setAiSuggestions(data.prompts);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [authHeaders]);

  const askAI = useCallback(async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || aiGenerating) return;
    setAiError(null);
    setAiGenerating(true);
    try {
      const res = await fetch("/api/bundles/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      const suggestion = data?.suggestion;
      if (!suggestion) throw new Error("Empty response");
      // Apply suggestion: fill title, replace selection with AI's picks (in
      // ranked order), surface annotations + description.
      if (suggestion.title) setTitle(suggestion.title);
      setAiDescription(suggestion.description || "");
      const picks: string[] = Array.isArray(suggestion.documents) ? suggestion.documents.map((d: { id: string }) => d.id) : [];
      setSelectedIds(picks);
      const ann: Record<string, string> = {};
      if (Array.isArray(suggestion.documents)) {
        for (const d of suggestion.documents as Array<{ id: string; annotation?: string }>) {
          if (d?.id && d.annotation) ann[d.id] = d.annotation;
        }
      }
      setAiAnnotations(ann);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  }, [aiPrompt, aiGenerating, authHeaders]);

  // Sort: selected first (preserving selection order), then unselected by recent
  const sortedDocs = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const selectedInOrder = selectedIds
      .map(id => allDocs.find(d => d.id === id))
      .filter((d): d is { id: string; title: string; lastOpenedAt?: number } => !!d);
    const rest = allDocs
      .filter(d => !selectedSet.has(d.id))
      .sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
    return [...selectedInOrder, ...rest];
  }, [allDocs, selectedIds]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedDocs;
    return sortedDocs.filter(d => d.title.toLowerCase().includes(q));
  }, [sortedDocs, search]);

  const toggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const move = (id: string, dir: -1 | 1) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  // 1+ docs is enough — a single-doc bundle is a valid v6 starting point
  // (user can grow it later with add-documents). Server-side
  // /api/bundles already accepts documentIds.length >= 1.
  const canCreate = selectedIds.length >= 1 && !creating;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-md mx-4 overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "min(80vh, 640px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Create Bundle</h3>
          <p className="text-caption mt-1" style={{ color: "var(--text-muted)" }}>Pick documents to bundle, or ask AI to suggest from your hub.</p>
        </div>
        {/* AI Bundle Generation strip — collapsed by default. Header
            row is a clickable toggle so the Documents picker gets the
            full panel by default; users who want AI to assemble a
            bundle from a prompt expand it on demand. */}
        <div className="shrink-0" style={{ borderBottom: "1px solid var(--border-dim)", background: showAskAI ? "color-mix(in srgb, var(--border) 25%, var(--surface))" : "var(--surface)" }}>
          <button
            type="button"
            onClick={() => setShowAskAI((s) => !s)}
            className="w-full flex items-center gap-2 px-5 py-3 transition-colors hover:bg-[var(--border)]"
            aria-expanded={showAskAI}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: 22, height: 22, borderRadius: 6, background: "var(--border)", color: "var(--text-primary)" }}
            >
              <Sparkles width={12} height={12} aria-hidden />
            </span>
            <span className="text-caption font-semibold" style={{ color: "var(--text-primary)" }}>Ask AI</span>
            <span className="text-caption" style={{ color: "var(--text-faint)" }}>— describe a topic, AI picks docs + title</span>
            <span style={{ flex: 1 }} />
            <ChevronDown
              width={12}
              height={12}
              style={{
                color: "var(--text-faint)",
                transform: showAskAI ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.15s",
              }}
            />
          </button>
        </div>
        {showAskAI && (
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)", background: "color-mix(in srgb, var(--border) 25%, var(--surface))" }}>
          <p className="text-caption leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
            Describe a topic and AI picks matching docs + writes a title from your hub.
          </p>
          {/* Combined input + submit button in a single rounded container —
              one visual element, like a chat composer. */}
          <div
            className="flex items-stretch rounded-lg overflow-hidden"
            style={{
              background: "var(--background)",
              border: `1px solid ${aiPrompt.trim() ? "var(--text-primary)" : "var(--border-dim)"}`,
              transition: "border-color 120ms",
            }}
          >
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !aiGenerating) askAI(); }}
              placeholder="e.g. notes on LLM memory architecture"
              className="flex-1 px-3 py-2 text-body outline-none bg-transparent"
              style={{ color: "var(--text-primary)" }}
              disabled={aiGenerating}
            />
            <button
              onClick={askAI}
              disabled={!aiPrompt.trim() || aiGenerating}
              className="flex items-center gap-1 px-3 text-caption font-semibold shrink-0 transition-colors"
              style={{
                background: !aiPrompt.trim() || aiGenerating ? "transparent" : "var(--text-primary)",
                color: !aiPrompt.trim() || aiGenerating ? "var(--text-faint)" : "#fff",
                cursor: !aiPrompt.trim() || aiGenerating ? "not-allowed" : "pointer",
                borderLeft: "1px solid var(--border-dim)",
              }}
            >
              {aiGenerating ? (
                <>
                  <Loader2 width={11} height={11} className="animate-spin" />
                  Thinking
                </>
              ) : (
                <>
                  <Sparkles width={11} height={11} />
                  Ask
                </>
              )}
            </button>
          </div>
          {aiError && (
            <p className="text-caption mt-2.5" style={{ color: "var(--color-danger)" }}>{aiError}</p>
          )}
          {aiDescription && !aiError && (
            <p className="text-caption mt-2.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{aiDescription}</p>
          )}
          {/* Suggestion list — collapsed by default. Renders the
              "Try" header as a small toggle; the list only expands
              when the user opts in. Default-hidden because the
              suggestions row was eating the Documents picker space
              below. */}
          {aiSuggestions.length > 0 && !aiGenerating && !aiDescription && (
            <div className="mt-3">
              <button
                onClick={() => setShowSuggestions(s => !s)}
                className="flex items-center gap-1 text-caption uppercase tracking-wider mb-1.5 transition-colors hover:text-[var(--text-secondary)]"
                style={{ color: "var(--text-faint)", fontSize: 10, letterSpacing: "0.06em", cursor: "pointer", background: "transparent", border: "none", padding: 0 }}
                aria-expanded={showSuggestions}
              >
                <ChevronDown
                  width={9}
                  height={9}
                  style={{ transform: showSuggestions ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}
                />
                Try {aiSuggestions.length > 0 && (
                  <span style={{ color: "var(--text-faint)", textTransform: "none", letterSpacing: 0 }}>
                    ({aiSuggestions.length} suggestion{aiSuggestions.length === 1 ? "" : "s"})
                  </span>
                )}
              </button>
              {showSuggestions && (
              <div className="flex flex-col gap-1">
                {aiSuggestions.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAiPrompt(p);
                      setTimeout(() => {
                        setAiPrompt(p);
                        (async () => {
                          if (aiGenerating) return;
                          setAiError(null);
                          setAiGenerating(true);
                          try {
                            const res = await fetch("/api/bundles/ai-generate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...authHeaders },
                              body: JSON.stringify({ prompt: p }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              throw new Error(err.error || `Request failed (${res.status})`);
                            }
                            const data = await res.json();
                            const suggestion = data?.suggestion;
                            if (!suggestion) throw new Error("Empty response");
                            if (suggestion.title) setTitle(suggestion.title);
                            setAiDescription(suggestion.description || "");
                            const picks: string[] = Array.isArray(suggestion.documents) ? suggestion.documents.map((d: { id: string }) => d.id) : [];
                            setSelectedIds(picks);
                            const ann: Record<string, string> = {};
                            if (Array.isArray(suggestion.documents)) {
                              for (const d of suggestion.documents as Array<{ id: string; annotation?: string }>) {
                                if (d?.id && d.annotation) ann[d.id] = d.annotation;
                              }
                            }
                            setAiAnnotations(ann);
                          } catch (err) {
                            setAiError(err instanceof Error ? err.message : "AI generation failed");
                          } finally {
                            setAiGenerating(false);
                          }
                        })();
                      }, 0);
                    }}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-caption transition-colors hover:bg-[var(--toggle-bg)] group/sug"
                    style={{ color: "var(--text-secondary)", border: "1px solid transparent" }}
                  >
                    <Sparkles width={10} height={10} className="shrink-0 transition-colors group-hover/sug:text-[var(--text-primary)]" style={{ color: "var(--micro-ai)" }} aria-hidden />
                    <span className="flex-1 truncate">{p}</span>
                    <span className="text-caption opacity-0 group-hover/sug:opacity-100 transition-opacity shrink-0" style={{ color: "var(--text-primary)", fontSize: 10 }}>
                      Use →
                    </span>
                  </button>
                ))}
              </div>
              )}
            </div>
          )}
        </div>
        )}
        <div className="px-5 py-4 shrink-0">
          <label className="text-caption font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Bundle Title</label>
          {/* Title field with an AI button on the right. Empty by
              default; placeholder shows a heuristic from selected
              docs (used as the submitted title if user creates
              without typing). AI button reads the selected docs'
              content and fills the field. */}
          <div
            className="flex items-stretch rounded-lg overflow-hidden"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titlePlaceholder}
              className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
              style={{ color: "var(--text-primary)" }}
              autoFocus
            />
            <button
              type="button"
              onClick={requestAITitle}
              disabled={suggestingTitle || selectedIds.length === 0}
              className="flex items-center gap-1 px-3 text-caption font-semibold shrink-0 transition-colors"
              style={{
                background: suggestingTitle ? "transparent" : "var(--border)",
                color: selectedIds.length === 0 ? "var(--text-faint)" : "var(--text-primary)",
                cursor: suggestingTitle || selectedIds.length === 0 ? "not-allowed" : "pointer",
                borderLeft: "1px solid var(--border-dim)",
              }}
              title={selectedIds.length === 0 ? "Pick a document first" : "Let AI suggest a title from the selected docs"}
            >
              {suggestingTitle ? (
                <>
                  <Loader2 width={11} height={11} className="animate-spin" />
                  <span>Thinking</span>
                </>
              ) : (
                <>
                  <Sparkles width={11} height={11} />
                  <span>AI</span>
                </>
              )}
            </button>
          </div>
          {titleSuggestError && (
            <p className="text-caption mt-1.5" style={{ color: "var(--color-danger)" }}>{titleSuggestError}</p>
          )}
        </div>
        <div className="px-5 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-caption font-medium" style={{ color: "var(--text-secondary)" }}>
              Documents <span style={{ color: "var(--text-faint)" }}>({selectedIds.length} selected)</span>
            </label>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-caption px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                style={{ color: "var(--text-faint)" }}
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full px-3 py-1.5 rounded-md text-body outline-none mb-2"
            style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--border-dim)" }}
          />
        </div>
        <div className="px-5 pb-4 flex-1 min-h-0 overflow-auto">
          {filteredDocs.length === 0 ? (
            <div className="text-caption text-center py-6" style={{ color: "var(--text-faint)" }}>
              {search ? "No documents match." : "No documents available. Save a doc to the cloud first."}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredDocs.map((doc) => {
                const order = selectedIds.indexOf(doc.id);
                const isSelected = order >= 0;
                return (
                  <div
                    key={doc.id}
                    onClick={() => toggle(doc.id)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-caption cursor-pointer transition-colors hover:bg-[var(--border)]"
                    style={{
                      background: isSelected ? "var(--border)" : "var(--background)",
                      color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                      border: `1px solid ${isSelected ? "var(--border)" : "var(--border-dim)"}`,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                      style={{
                        background: isSelected ? "var(--text-primary)" : "transparent",
                        border: `1px solid ${isSelected ? "var(--text-primary)" : "var(--border)"}`,
                      }}
                    >
                      {isSelected && <Check width={10} height={10} style={{ color: "#fff" }} />}
                    </div>
                    {isSelected && (
                      <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-primary)" }}>{order + 1}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{doc.title}</div>
                      {isSelected && aiAnnotations[doc.id] && (
                        <div className="text-caption truncate mt-0.5 inline-flex items-center gap-1" style={{ color: "var(--text-primary)", opacity: 0.85 }}>
                          <Sparkles width={10} height={10} className="shrink-0" aria-hidden /> {aiAnnotations[doc.id]}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="flex gap-0.5 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); move(doc.id, -1); }}
                          disabled={order === 0}
                          className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)] disabled:opacity-30"
                          style={{ color: "var(--text-faint)" }}
                          title="Move up"
                        >
                          <ChevronUp width={11} height={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); move(doc.id, 1); }}
                          disabled={order === selectedIds.length - 1}
                          className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)] disabled:opacity-30"
                          style={{ color: "var(--text-faint)" }}
                          title="Move down"
                        >
                          <ChevronDown width={11} height={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-5 py-3 flex justify-end gap-2 shrink-0" style={{ borderTop: "1px solid var(--border-dim)" }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-caption font-medium transition-colors hover:bg-[var(--toggle-bg)]"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!canCreate) return;
              setCreating(true);
              try {
                await onCreate({
                  title: title.trim() || titlePlaceholder || "Untitled Bundle",
                  description: aiDescription.trim() || undefined,
                  docIds: selectedIds,
                  annotationByDocId: Object.keys(aiAnnotations).length > 0 ? aiAnnotations : undefined,
                });
              } finally {
                setCreating(false);
              }
            }}
            disabled={!canCreate}
            className="px-4 py-1.5 rounded-md text-caption font-medium transition-opacity"
            style={{
              background: "var(--text-primary)",
              color: "#fff",
              opacity: canCreate ? 1 : 0.4,
              cursor: canCreate ? "pointer" : "not-allowed",
            }}
          >
            {creating ? "Creating..." : "Create Bundle"}
          </button>
        </div>
      </div>
    </div>
  );
}
