"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Full-screen image viewer for the bundle/hub Media gallery. Dark
 * backdrop, ESC / arrow keys, click outside to close. Caller passes
 * the flat list of URLs + the index of the one to open; null index
 * means closed.
 */
export default function MediaLightbox({
  urls,
  index,
  onChange,
  onClose,
}: {
  urls: string[];
  index: number | null;
  onChange: (next: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft" && index > 0) onChange(index - 1);
      if (e.key === "ArrowRight" && index < urls.length - 1) onChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, urls.length, onChange, onClose]);

  if (index === null) return null;
  const url = urls[index];
  if (!url) return null;
  const hasPrev = index > 0;
  const hasNext = index < urls.length - 1;
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center cursor-pointer"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-lg transition-colors hover:bg-white/10"
        style={{ color: "#fff" }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        <X width={20} height={20} />
      </button>
      {hasPrev && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: "#fff" }}
          onClick={(e) => { e.stopPropagation(); onChange(index - 1); }}
          aria-label="Previous"
        >
          <ChevronLeft width={24} height={24} />
        </button>
      )}
      {hasNext && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: "#fff" }}
          onClick={(e) => { e.stopPropagation(); onChange(index + 1); }}
          aria-label="Next"
        >
          <ChevronRight width={24} height={24} />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] rounded-lg cursor-default"
        style={{ objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
      />
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md text-caption font-mono"
        style={{ background: "rgba(0,0,0,0.6)", color: "#ccc" }}
        onClick={(e) => e.stopPropagation()}
      >
        {index + 1} / {urls.length}
      </div>
    </div>
  );
}
