"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

export default function EmbedPage() {
  const { id } = useParams<{ id: string }>();
  const [html, setHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/docs/${id}`);
        if (!res.ok) {
          if (res.status === 401) {
            try {
              const body = await res.json();
              if (body.passwordRequired) {
                setIsPasswordProtected(true);
                setIsLoading(false);
                return;
              }
            } catch { /* fall through to not found */ }
          }
          setHtml("<p>Document not found</p>");
          setIsLoading(false);
          return;
        }
        const doc = await res.json();
        const { render } = await import("@/lib/render");
        const result = render(doc.markdown);
        setHtml(result.html);
        setIsLoading(false);
      } catch {
        setHtml("<p>Failed to load</p>");
        setIsLoading(false);
      }
    })();
  }, [id]);

  // Mermaid rendering — match comrak output: <pre lang="mermaid"><code>...</code></pre>
  useEffect(() => {
    if (!previewRef.current || isLoading) return;
    const mermaidPres = previewRef.current.querySelectorAll('pre[lang="mermaid"]');
    if (mermaidPres.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mermaid = (window as any).mermaid;
    if (!mermaid) return;

    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 14,
      themeVariables: isDark ? {
        background: "transparent",
        primaryColor: "#222230",
        primaryTextColor: "#ededf0",
        primaryBorderColor: "#3a3a48",
        lineColor: "#50505e",
        secondaryColor: "#1a1a24",
        tertiaryColor: "#1a1a24",
      } : {
        background: "transparent",
        primaryColor: "#ffffff",
        primaryTextColor: "#1a1a2e",
        primaryBorderColor: "#e0e0e8",
        lineColor: "#b0b0c0",
        secondaryColor: "#f7f7fa",
        tertiaryColor: "#f7f7fa",
      },
    });

    (async () => {
      for (let i = 0; i < mermaidPres.length; i++) {
        const pre = mermaidPres[i];
        const codeEl = pre.querySelector("code");
        const code = (codeEl?.textContent || pre.textContent || "").trim();
        if (!code) continue;
        try {
          const { svg } = await mermaid.render(`mermaid-embed-${Date.now()}-${i}`, code);
          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-container";
          wrapper.innerHTML = `<div class="mermaid-rendered">${svg}</div>`;
          pre.replaceWith(wrapper);
        } catch { /* ignore render errors */ }
      }
    })();
  }, [html, isLoading]);

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <div ref={previewRef}>
        {isLoading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-faint)" }}>Loading...</div>
        ) : isPasswordProtected ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: "var(--foreground)" }}>
              This document is password-protected.
            </div>
            <a
              href={`https://memory.wiki/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline", fontSize: "0.95rem" }}
            >
              View it at memory.wiki/{id}
            </a>
          </div>
        ) : (
          <article
            className="mdcore-rendered p-4 sm:p-6"
            style={{ maxWidth: "none" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--border)",
          textAlign: "right",
          fontSize: "11px",
        }}
      >
        <a
          href={`https://memory.wiki/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          memory.wiki
        </a>
      </div>
    </div>
  );
}
