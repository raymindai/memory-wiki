"use client";

import { useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Folders & Files",
    emojis: ["📁", "📂", "🗂️", "🗃️", "🗄️", "📋", "📒", "📕", "📗", "📘", "📙", "📓", "📔", "📰", "📦", "💼"] },
  { label: "Symbols",
    emojis: ["⭐", "🔥", "✨", "💡", "🎯", "⚡", "🚀", "🎨", "🎓", "🏆", "❤️", "💚", "💙", "💜", "🟠", "🟢"] },
  { label: "Activities",
    emojis: ["📝", "🔧", "🔬", "🧪", "🧠", "🎮", "🎵", "🎬", "📷", "📊", "📈", "📉", "💰", "💳", "🏠", "🌍"] },
  { label: "Nature",
    emojis: ["🌟", "🌙", "☀️", "🌈", "🌳", "🌱", "🍀", "🌸", "🐱", "🐶", "🦊", "🦄", "🐝", "🦋", "🌊", "❄️"] },
];

export default function FolderEmojiPicker({
  currentEmoji,
  onSelect,
  onClose,
}: {
  currentEmoji?: string;
  onSelect: (emoji: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = search.trim().toLowerCase();
  const filteredGroups = q
    ? EMOJI_GROUPS.map(g => ({ ...g, emojis: g.emojis.filter(e => e.includes(q)) })).filter(g => g.emojis.length > 0)
    : EMOJI_GROUPS;

  return (
    <ModalShell open onClose={onClose} size="sm" title="Folder icon">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxHeight: "60vh" }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Filter emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md text-body outline-none"
          style={{
            padding: "var(--space-2) var(--space-3)",
            background: "var(--background)",
            border: "1px solid var(--border-dim)",
            color: "var(--text-primary)",
          }}
        />
        <div className="flex-1 min-h-0 overflow-auto">
          <button
            onClick={() => onSelect(null)}
            className="w-full text-left text-caption rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
            style={{
              padding: "var(--space-2) var(--space-2)",
              marginBottom: "var(--space-2)",
              color: currentEmoji ? "var(--text-secondary)" : "var(--text-primary)",
              border: `1px dashed ${currentEmoji ? "var(--border-dim)" : "var(--text-primary)"}`,
            }}
          >
            Use default folder icon
          </button>
          {filteredGroups.map(group => (
            <div key={group.label} style={{ marginBottom: "var(--space-3)" }}>
              <div className="text-caption uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>{group.label}</div>
              <div className="grid grid-cols-8 gap-1">
                {group.emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => onSelect(emoji)}
                    className="w-8 h-8 rounded text-[18px] leading-none flex items-center justify-center transition-colors hover:bg-[var(--border)]"
                    style={{
                      background: currentEmoji === emoji ? "var(--border)" : "transparent",
                      outline: currentEmoji === emoji ? "1px solid var(--text-primary)" : "none",
                    }}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <div className="text-caption text-center" style={{ padding: "var(--space-4) 0", color: "var(--text-faint)" }}>
              No matches.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
