// @ts-nocheck
// @mdcore/editor — Mermaid initializer (shared across channels).
//
// Source of truth: apps/web/src/components/TiptapLiveEditor.tsx
// L1612-1677. This helper exposes the same theme-aware init so
// Desktop and the VS Code webview can render Mermaid diagrams that
// look identical to memory.wiki — same colors, same fonts, same
// flowchart geometry, same `securityLevel: "loose"` so labels with
// HTML render correctly.
//
// Usage (UMD via the tiptap-config bundle):
//   <script src="vendor-editor/tiptap-config.umd.js"></script>
//   <script>
//     window.MemoryWikiMermaid.init();
//     // Optionally store the destroy handle for HMR / panel teardown:
//     // var stopMermaid = window.MemoryWikiMermaid.init();
//     // ... stopMermaid();
//   </script>
//
// Usage (ESM consumer like Next.js):
//   import { initMermaid } from "@mdcore/editor/mermaid-init";
//   useEffect(() => initMermaid(), []);
//
// Behavior:
//   - If window.mermaid is already loaded, initialize() immediately.
//   - Else inject <script src="...cdn.jsdelivr.net/npm/mermaid@10..."
//     async>, then initialize on load.
//   - Reads document.documentElement.getAttribute("data-theme") to
//     pick "dark" vs "default" theme variables.
//   - Sets up a MutationObserver on <html>'s data-theme attribute and
//     re-initializes on change so the diagrams retint when the user
//     toggles light/dark mode.
//   - Returns a destroy() function that disconnects the observer.
//
// What it does NOT do:
//   - Render fenced ```mermaid blocks. That is the NodeView's job
//     (see buildSimpleCodeBlockNodeView in tiptap-config.ts) — this
//     helper only loads the library + applies theme config.
//   - Bundle mermaid.min.js. We keep it CDN-loaded (or locally
//     vendored, like apps/desktop/renderer/lib/mermaid/mermaid.min.js)
//     because the library is ~1.5 MB minified — too heavy to inline
//     into the tiptap-config UMD that already weighs ~2 MB.

const MERMAID_CDN_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";

export interface InitMermaidOptions {
  /** Override the CDN URL (e.g. point at a vendored local copy). */
  scriptSrc?: string;
}

export interface MermaidHandle {
  /** Disconnect the MutationObserver. Idempotent. */
  destroy: () => void;
}

function pickTheme(): { dark: boolean } {
  if (typeof document === "undefined") return { dark: true };
  const attr = document.documentElement.getAttribute("data-theme");
  // Web treats anything not literally "light" as dark, matching
  // TiptapLiveEditor.tsx isDark(): attr !== "light".
  return { dark: attr !== "light" };
}

function applyConfig(): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (window as any).mermaid;
  if (!m || typeof m.initialize !== "function") return;
  const { dark } = pickTheme();
  m.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: dark ? "dark" : "default",
    // Mermaid renders to SVG and sets font-family as a presentation
    // attribute, so CSS var() doesn't resolve. Use a literal cascade
    // matching body font (Noto Sans + Pretendard for KR).
    fontFamily:
      "'Noto Sans', 'Pretendard Variable', 'Noto Sans KR', system-ui, sans-serif",
    fontSize: 14,
    flowchart: {
      padding: 16,
      nodeSpacing: 30,
      rankSpacing: 40,
      htmlLabels: true,
      curve: "basis",
    },
    themeVariables: dark
      ? {
          background: "transparent",
          primaryColor: "#222230",
          primaryTextColor: "#ededf0",
          primaryBorderColor: "#fb923c",
          lineColor: "#fb923c",
          secondaryColor: "#1a1a24",
          tertiaryColor: "#1a1a24",
          noteBkgColor: "#2a1f12",
          noteTextColor: "#fdba74",
          noteBorderColor: "#fb923c",
          edgeLabelBackground: "#1a1a24",
        }
      : {
          background: "transparent",
          primaryColor: "#ffffff",
          primaryTextColor: "#1a1a2e",
          primaryBorderColor: "#fb923c",
          lineColor: "#fb923c",
          secondaryColor: "#fff7ed",
          tertiaryColor: "#fff7ed",
          noteBkgColor: "#fff7ed",
          noteTextColor: "#9a3412",
          noteBorderColor: "#fb923c",
          edgeLabelBackground: "#ffffff",
        },
  });
}

/**
 * Initialize Mermaid on the current page with memory.wiki's theme
 * configuration. Safe to call multiple times.
 *
 * Returns a handle whose .destroy() disconnects the theme observer.
 * Calling .destroy() does NOT unload mermaid.min.js — that stays on
 * the page so subsequent renders are instant.
 */
export function initMermaid(opts: InitMermaidOptions = {}): MermaidHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { destroy: () => undefined };
  }

  const scriptSrc = opts.scriptSrc || MERMAID_CDN_URL;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).mermaid) {
    applyConfig();
  } else {
    // Avoid injecting the script tag twice on hot-reload / repeat
    // mounts. Match by src so a local vendor copy doesn't collide
    // with the CDN URL.
    const existing = document.head.querySelector<HTMLScriptElement>(
      `script[data-mw-mermaid="1"]`
    );
    if (existing) {
      existing.addEventListener("load", applyConfig, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = scriptSrc;
      script.async = true;
      script.setAttribute("data-mw-mermaid", "1");
      script.addEventListener("load", applyConfig);
      document.head.appendChild(script);
    }
  }

  // Theme observer — re-init when [data-theme] flips on <html>.
  const obs = new MutationObserver(() => applyConfig());
  try {
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  } catch {
    /* IE-era throw guard; modern browsers never reach here. */
  }

  let destroyed = false;
  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      try {
        obs.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
