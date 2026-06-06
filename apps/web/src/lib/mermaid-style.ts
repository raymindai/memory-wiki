/**
 * Mermaid SVG restyler — mdcore engine
 * Applies consistent theme colors to Mermaid-generated SVGs.
 * Browser-only: requires DOMParser and XMLSerializer.
 */

const DARK = {
  nodeFill: "#1c1c24",
  nodeStroke: "#2e2e3a",
  clusterFill: "#16161e",
  clusterStroke: "#2e2e3a",
  labelBg: "#16161e",
  text: "#ededf0",
  textDim: "#b8b8c4",
  edge: "#454558",
  accent: "#fb923c",
};

const LIGHT = {
  nodeFill: "#ffffff",
  nodeStroke: "#e2e8f0",
  clusterFill: "#f8fafc",
  clusterStroke: "#e2e8f0",
  labelBg: "#ffffff",
  text: "#1e293b",
  textDim: "#64748b",
  edge: "#cbd5e1",
  accent: "#ea580c",
};

export function styleMermaidSvg(svgString: string, isDark: boolean): string {
  const p = isDark ? DARK : LIGHT;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return svgString;

  svg.style.background = "transparent";

  // Nodes: style last shape (visible one), hide shadow shapes
  svg.querySelectorAll(".node").forEach((node) => {
    const shapes = node.querySelectorAll("rect, circle, ellipse, polygon");
    if (shapes.length === 0) return;
    const last = shapes[shapes.length - 1];
    const fill = last.getAttribute("fill") || "";
    const accented = isAccent(fill);
    shapes.forEach((s, i) => {
      if (i < shapes.length - 1) {
        s.setAttribute("fill", "none");
        s.setAttribute("stroke", "none");
      } else {
        if (!accented) {
          s.setAttribute("fill", p.nodeFill);
          s.setAttribute("stroke", p.nodeStroke);
          s.setAttribute("stroke-width", "1");
        } else {
          s.setAttribute("stroke", "none");
        }
        if (s.tagName === "rect") {
          s.setAttribute("rx", "8");
          s.setAttribute("ry", "8");
        }
      }
    });
  });

  // Sequence actors
  svg.querySelectorAll("rect.actor").forEach((el) => {
    el.setAttribute("fill", p.nodeFill);
    el.setAttribute("stroke", p.nodeStroke);
    el.setAttribute("stroke-width", "1");
    el.setAttribute("rx", "6");
    el.setAttribute("ry", "6");
  });

  // Clusters
  svg.querySelectorAll(".cluster rect").forEach((el) => {
    el.setAttribute("fill", p.clusterFill);
    el.setAttribute("stroke", p.clusterStroke);
    el.setAttribute("stroke-width", "1");
    el.setAttribute("rx", "10");
    el.setAttribute("ry", "10");
  });

  // Edge paths
  svg
    .querySelectorAll(
      ".edgePaths path, .flowchart-link, .edge-pattern-solid"
    )
    .forEach((el) => {
      el.setAttribute("stroke", p.edge);
      el.setAttribute("stroke-width", "1.2");
    });

  // Sequence message lines
  svg.querySelectorAll(".messageLine0, .messageLine1").forEach((el) => {
    el.setAttribute("stroke", p.edge);
    el.setAttribute("stroke-width", "1.2");
  });

  // State transitions
  svg.querySelectorAll(".transition").forEach((el) => {
    el.setAttribute("stroke", p.edge);
    el.setAttribute("stroke-width", "1.2");
  });

  // Arrows (markers)
  svg.querySelectorAll("marker path, .arrowheadPath").forEach((el) => {
    el.setAttribute("fill", p.edge);
    el.setAttribute("stroke", p.edge);
  });

  // Edge labels
  svg.querySelectorAll(".edgeLabel rect").forEach((el) => {
    el.setAttribute("fill", p.labelBg);
    el.setAttribute("stroke", "none");
  });

  // Notes
  svg.querySelectorAll("rect.note, .note rect").forEach((el) => {
    el.setAttribute("fill", p.clusterFill);
    el.setAttribute("stroke", p.clusterStroke);
    el.setAttribute("stroke-width", "1");
    el.setAttribute("rx", "4");
    el.setAttribute("ry", "4");
  });

  // Activations (sequence)
  svg
    .querySelectorAll(".activation0, .activation1, .activation2")
    .forEach((el) => {
      el.setAttribute("fill", p.clusterFill);
      el.setAttribute("stroke", p.clusterStroke);
      el.setAttribute("stroke-width", "1");
    });

  // Actor lines
  svg.querySelectorAll(".actor-line, line.actor-line").forEach((el) => {
    el.setAttribute("stroke", p.edge);
    el.setAttribute("stroke-width", "1");
  });

  // Gantt tasks
  svg.querySelectorAll(".task").forEach((el) => {
    const cls = el.getAttribute("class") || "";
    if (/done/.test(cls)) {
      el.setAttribute("fill", p.accent);
      el.setAttribute("stroke", p.accent);
    } else if (/active/.test(cls)) {
      el.setAttribute(
        "fill",
        isDark ? "rgba(251,146,60,0.2)" : "rgba(234,88,12,0.12)"
      );
      el.setAttribute("stroke", p.accent);
    } else {
      el.setAttribute("fill", p.nodeFill);
      el.setAttribute("stroke", p.nodeStroke);
    }
    el.setAttribute("rx", "3");
    el.setAttribute("ry", "3");
  });

  // Pie
  svg.querySelectorAll(".pieCircle").forEach((el) => {
    el.setAttribute("stroke", isDark ? "#0e0e14" : "#ffffff");
    el.setAttribute("stroke-width", "2");
  });

  // ER diagrams
  svg.querySelectorAll(".er.entityBox").forEach((el) => {
    el.setAttribute("fill", p.nodeFill);
    el.setAttribute("stroke", p.nodeStroke);
    el.setAttribute("stroke-width", "1");
  });
  svg
    .querySelectorAll(".er.attributeBoxOdd, .er.attributeBoxEven")
    .forEach((el) => {
      el.setAttribute("fill", p.clusterFill);
      el.setAttribute("stroke", p.clusterStroke);
    });
  svg.querySelectorAll(".er.relationshipLine").forEach((el) => {
    el.setAttribute("stroke", p.edge);
    el.setAttribute("stroke-width", "1.2");
  });

  // All text: font + color
  svg.querySelectorAll("text").forEach((el) => {
    el.setAttribute("font-family", "system-ui,-apple-system,sans-serif");
    const isDim =
      !!el.closest(".edgeLabel") ||
      el.classList.contains("messageText") ||
      el.classList.contains("noteText") ||
      el.classList.contains("loopText") ||
      el.classList.contains("taskTextOutsideRight") ||
      !!el.closest(".er.relationshipLabel");
    el.setAttribute("fill", isDim ? p.textDim : p.text);
  });

  // foreignObject HTML labels
  svg
    .querySelectorAll(
      "foreignObject span, foreignObject div, foreignObject p"
    )
    .forEach((el) => {
      const h = el as HTMLElement;
      if (!h.style) return;
      h.style.fontFamily = "system-ui,-apple-system,sans-serif";
      h.style.color = p.text;
      h.style.backgroundColor = "transparent";
      h.style.background = "transparent";
    });

  // Marker defs
  svg.querySelectorAll("defs marker path").forEach((el) => {
    el.setAttribute("fill", p.edge);
    el.setAttribute("stroke", p.edge);
  });

  return new XMLSerializer().serializeToString(svg);
}

function isAccent(fill: string): boolean {
  if (!fill) return false;
  const f = fill.toLowerCase();
  return (
    f.includes("fb923c") ||
    f.includes("f97316") ||
    f.includes("ea580c") ||
    f.includes("orange") ||
    (f.startsWith("rgb") && f.includes("251") && f.includes("146"))
  );
}

/** Mermaid initialization config matching memory.wiki rendering */
export function getMermaidConfig(isDark: boolean) {
  return {
    startOnLoad: false,
    securityLevel: "loose" as const,
    theme: isDark ? ("dark" as const) : ("default" as const),
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: 15,
    flowchart: {
      padding: 16,
      nodeSpacing: 30,
      rankSpacing: 40,
      htmlLabels: true,
      curve: "basis" as const,
    },
    sequence: {
      actorMargin: 60,
      messageMargin: 40,
      boxMargin: 8,
      noteMargin: 12,
      messageAlign: "center" as const,
    },
  };
}

/**
 * Render all mermaid code blocks inside a container element.
 * Browser-only. Requires mermaid.js to be loaded (window.mermaid or passed as argument).
 *
 * Usage:
 *   import { renderMermaidElements } from "@/lib/mermaid-style";
 *   await renderMermaidElements(document.getElementById("preview"), { isDark: true });
 */
export async function renderMermaidElements(
  container: HTMLElement,
  options: {
    isDark?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mermaid?: any; // mermaid module instance
  } = {}
): Promise<void> {
  const isDark = options.isDark ?? false;

  // Get mermaid instance
  const mermaid =
    options.mermaid ??
    (typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).mermaid : null);
  if (!mermaid) return;

  mermaid.initialize(getMermaidConfig(isDark));

  const pres = container.querySelectorAll('pre[lang="mermaid"]');
  const ts = Date.now();

  for (let idx = 0; idx < pres.length; idx++) {
    const pre = pres[idx] as HTMLElement;
    const code = (
      pre.querySelector("code")?.textContent ||
      pre.textContent ||
      ""
    ).trim();
    if (!code) continue;

    const id = `mermaid-${ts}-${idx}`;
    try {
      const { svg: rawSvg } = await mermaid.render(id, code);
      const svg = styleMermaidSvg(rawSvg, isDark);

      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-container";
      wrapper.setAttribute("data-mermaid-source", code);
      wrapper.innerHTML = svg;
      pre.replaceWith(wrapper);
    } catch {
      // Clean up mermaid error elements
      const errEl = document.getElementById(id);
      if (errEl) errEl.remove();
      document.getElementById("d" + id)?.remove();
    }
  }
}
