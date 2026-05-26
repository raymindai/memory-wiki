"use client";

/**
 * Small atomic UI primitives extracted from MdEditor.tsx so they
 * can be reused without pulling the whole editor module.
 *
 *   - InlineInput  → drop-in replacement for prompt() with a styled popup
 *   - TBtn         → toolbar button with an instant tooltip (and optional preview)
 */

import { useEffect, useRef, useState } from "react";

/* ───────── Inline Input Popup ───────── */
export function InlineInput({ label, defaultValue, onSubmit, onCancel, position }: {
  label: string; defaultValue?: string;
  onSubmit: (value: string) => void; onCancel: () => void;
  position?: { x: number; y: number };
}) {
  const [value, setValue] = useState(defaultValue || "");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  return (
    <div className="fixed inset-0 z-[9999]" onClick={onCancel}>
      <div
        className="absolute rounded-lg shadow-xl p-3 flex flex-col gap-2"
        style={{
          left: position?.x ?? "50%", top: position?.y ?? "50%",
          transform: position ? "translate(-50%, 0)" : "translate(-50%, -50%)",
          background: "var(--surface)", border: "1px solid var(--border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", minWidth: 280,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <label className="text-caption font-mono" style={{ color: "var(--text-muted)" }}>{label}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) { onSubmit(value.trim()); }
            if (e.key === "Escape") { onCancel(); }
          }}
          className="px-3 py-1.5 rounded-md text-sm outline-none"
          style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          placeholder={label}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1 text-caption rounded-md" style={{ color: "var(--text-muted)", background: "var(--toggle-bg)" }}>Cancel</button>
          <button onClick={() => value.trim() && onSubmit(value.trim())} className="px-3 py-1 text-caption rounded-md font-medium" style={{ background: "var(--text-primary)", color: "var(--background)" }}>OK</button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Toolbar Button (with instant tooltip + optional preview) ───────── */
export function TBtn({ tip, preview, active, onClick, children }: {
  tip: string; preview?: React.ReactNode; active?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <div className="relative group shrink-0">
      <button
        // Per the v8 color rule: ink dominates UI chrome. Accent is
        // reserved for true brand moments (CTAs, loaders, capture
        // signals), NOT generic hover/active states on toolbar
        // buttons. Earlier this row pulsed orange every hover.
        className={`w-7 h-7 flex items-center justify-center rounded transition-colors
          ${active
            ? "bg-[var(--border)] text-[var(--text-primary)]"
            : "hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
          }`}
        onClick={onClick}
      >
        {children}
      </button>
      <div
        className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 rounded-lg
          opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]
          ${preview ? "p-2.5 w-48" : "px-2 py-1 whitespace-nowrap"}`}
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
      >
        {preview ? (
          <>
            <div className="mb-1.5 text-caption" style={{ color: "var(--text-muted)" }}>{tip}</div>
            <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: 6 }}>{preview}</div>
          </>
        ) : (
          <span className="text-caption">{tip}</span>
        )}
      </div>
    </div>
  );
}
