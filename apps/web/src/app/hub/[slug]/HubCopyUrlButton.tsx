"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function HubCopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* ignore */ }
      }}
      className="hub-copy-btn"
    >
      {copied ? (
        <>
          <Check size={13} strokeWidth={2} />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy size={13} strokeWidth={1.75} />
          <span>Copy URL</span>
        </>
      )}
    </button>
  );
}
