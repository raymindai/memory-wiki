"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Lives inside the unified .vhub-deploy-urlcard. The visual split (URL
// on the left, Copy on the right) is provided by a left hairline on
// the button itself. On copy it flips to lime text + Check icon for ~1.5s.

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
      className={`hub-copy-btn${copied ? " is-copied" : ""}`}
      title="Copy URL"
      aria-label="Copy hub URL"
    >
      {copied ? (
        <>
          <Check size={13} strokeWidth={2.25} />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy size={13} strokeWidth={2} />
          <span>Copy URL</span>
        </>
      )}
    </button>
  );
}
