/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
"use client";

import { type Editor, Editor as TiptapEditor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Image as TiptapImage } from "@tiptap/extension-image";
import { Link as TiptapLink } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Markdown as TiptapMarkdown } from "tiptap-markdown";
import markdownItFootnote from "markdown-it-footnote";
import { remoteCursorsPlugin, remoteCursorsPluginKey, type TiptapRemoteCursor } from "@/components/tiptap-remote-cursors";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useState,
} from "react";
import { common, createLowlight } from "lowlight";
import katex from "katex";
// Table fix: custom tiptap-markdown extension that strips <thead>/<tbody> during parsing
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Minus,
  CheckSquare,
  Trash2,
  Sparkles,
  Loader2,
} from "lucide-react";

const lowlight = createLowlight(common);
// `common` registers `latex` but not `tex`. AI/MCP-generated docs frequently use
// ```tex which causes lowlight to throw `Unknown language: tex is not registered`
// during setContent. Alias common math typesetting names to `latex` so they
// highlight reasonably instead of crashing the editor on tab switch.
try {
  if (lowlight.registered("latex")) {
    if (!lowlight.registered("tex")) lowlight.registerAlias("latex", "tex");
    if (!lowlight.registered("bibtex")) lowlight.registerAlias("latex", "bibtex");
  }
} catch { /* ignore */ }

// ─── Custom CodeBlock NodeView: language label + copy button + mermaid render ───
const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return (props: any) => {
      try {
        return buildCodeBlockNodeView(props);
      } catch (err) {
        // If NodeView throws, fall back to a basic visible wrapper so the user
        // sees content + sees that something went wrong (instead of vanishing).
        // eslint-disable-next-line no-console
        console.error("[CustomCodeBlock NodeView] error:", err);
        const wrapper = document.createElement("div");
        wrapper.className = "tiptap-codeblock-wrapper";
        wrapper.setAttribute("data-error", String((err as Error).message || err));
        const errLine = document.createElement("div");
        errLine.style.cssText = "padding:8px 12px;font-size:11px;color:var(--text-primary);background:var(--border);border-bottom:1px solid var(--border-dim);";
        errLine.textContent = `Code block render error: ${(err as Error).message || err}`;
        wrapper.appendChild(errLine);
        const pre = document.createElement("pre");
        pre.style.cssText = "margin:0;padding:12px;background:var(--background);";
        const code = document.createElement("code");
        pre.appendChild(code);
        wrapper.appendChild(pre);
        return { dom: wrapper, contentDOM: code };
      }
    };
  },
});

function buildCodeBlockNodeView({ node, HTMLAttributes, getPos, editor }: any) {
      const lang = (node.attrs.language || "").toLowerCase();
      const wrapper = document.createElement("div");
      wrapper.className = "tiptap-codeblock-wrapper";
      wrapper.setAttribute("data-language", lang);

      // Header: lang badge + copy button
      const header = document.createElement("div");
      header.className = "tiptap-codeblock-header";
      header.contentEditable = "false";

      const langLabel = document.createElement("span");
      langLabel.className = "tiptap-codeblock-lang";
      langLabel.textContent = lang || "text";

      const headerActions = document.createElement("div");
      headerActions.style.display = "flex";
      headerActions.style.alignItems = "center";
      headerActions.style.gap = "6px";

      // ─── ASCII detection: table vs tree vs diagram ───
      const BOX_CHARS = /[┌┐└┘│─├┤┬┴┼╌═║╔╗╚╝╠╣╦╩╬┊┈]/g;
      type AsciiKind = null | "table" | "tree" | "diagram";
      const detectAsciiKind = (text: string): AsciiKind => {
        if (lang === "mermaid") return null;
        const matches = text.match(BOX_CHARS);
        if (!matches || matches.length < 5) return null;
        const tableJoiners = (text.match(/[┬┴╦╩┼╬]/g) || []).length;
        const verticals = (text.match(/[│║]/g) || []).length;
        if (tableJoiners >= 2 && verticals >= 4) return "table";
        if (/[├└][─━]/.test(text)) return "tree";
        return "diagram";
      };

      // Convert an ASCII table (┌─┬─┐ │ │ ├─┼─┤ └─┴─┘) into a markdown table
      const asciiTableToMd = (text: string): string | null => {
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        // Keep only rows that contain a vertical bar (data rows)
        const dataRows = lines.filter((l) => /[│║]/.test(l) && !/^[\s┌┐└┘├┤┬┴┼─━═╦╩╠╣╔╗╚╝╬]+$/.test(l));
        if (dataRows.length < 1) return null;
        const splitRow = (l: string) =>
          l
            .split(/[│║]/)
            .slice(1, -1)
            .map((c) => c.trim());
        const cells = dataRows.map(splitRow);
        const cols = Math.max(...cells.map((r) => r.length));
        if (cols < 2) return null;
        const norm = cells.map((r) => {
          const padded = [...r];
          while (padded.length < cols) padded.push("");
          return padded;
        });
        const header = norm[0];
        const body = norm.slice(1);
        const sep = new Array(cols).fill("---");
        const fmt = (row: string[]) => "| " + row.map((c) => c || " ").join(" | ") + " |";
        return [fmt(header), fmt(sep), ...body.map(fmt)].join("\n");
      };

      // ─── Convert dropdown — user picks the target format ───
      // Wrapper exists so we can hide both button and menu together via display:none
      const convertWrap = document.createElement("div");
      convertWrap.style.display = "none";

      const convertBtn = document.createElement("button");
      convertBtn.className = "tiptap-codeblock-copy";
      convertBtn.type = "button";
      convertBtn.textContent = "Convert ▾";
      convertWrap.appendChild(convertBtn);

      // Menu is portaled to <body> with position:fixed so the wrapper's
      // overflow:hidden (for rounded corners) doesn't clip it.
      const menu = document.createElement("div");
      menu.style.cssText = `
        position: fixed; z-index: 99999;
        min-width: 200px; padding: 4px;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        display: none; flex-direction: column; gap: 1px;
      `;

      const updateConvertVisibility = () => {
        const txt = node.textContent || "";
        const kind = detectAsciiKind(txt);
        convertWrap.style.display = kind ? "" : "none";
      };
      updateConvertVisibility();

      // Replace this code block with a chunk of *markdown*. Markdown is parsed
      // through tiptap-markdown's md instance into HTML, then inserted. Without
      // this, raw markdown text would appear as plain characters because
      // Tiptap's insertContentAt does not parse markdown.
      const replaceBlock = (mdContent: string) => {
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos == null) return false;
        const nodeSize = node.nodeSize;
        let html = mdContent;
        try {
          const mdParser = (editor.storage as any).markdown?.parser;
          if (mdParser?.md?.render) html = mdParser.md.render(mdContent);
        } catch { /* fall back to raw string */ }
        editor
          .chain()
          .focus()
          .deleteRange({ from: pos, to: pos + nodeSize })
          .insertContentAt(pos, html)
          .run();
        return true;
      };

      // Conversion overlay — full-block opaque overlay with spinner during
      // AI conversion. Far more visible than a thin status strip.
      let overlayEl: HTMLDivElement | null = null;
      let converting = false;
      const setConverting = (on: boolean) => {
        converting = on;
        if (on) {
          convertBtn.setAttribute("disabled", "true");
          convertBtn.style.opacity = "0.5";
          convertBtn.style.cursor = "wait";
          copyBtn.setAttribute("disabled", "true");
          copyBtn.style.opacity = "0.5";
        } else {
          convertBtn.removeAttribute("disabled");
          convertBtn.style.opacity = "";
          convertBtn.style.cursor = "";
          copyBtn.removeAttribute("disabled");
          copyBtn.style.opacity = "";
        }
      };
      const showStatus = (text: string, kind: "info" | "error" | "loading" = "info") => {
        if (!overlayEl) {
          overlayEl = document.createElement("div");
          overlayEl.contentEditable = "false";
          overlayEl.style.cssText = `
            position: absolute; inset: 0; z-index: 50;
            display: flex; align-items: center; justify-content: center;
            flex-direction: column; gap: 12px;
            backdrop-filter: blur(2px);
            pointer-events: all;
          `;
          // Wrapper is position:relative (set via CSS). overlay covers it.
          wrapper.appendChild(overlayEl);
        }
        const isError = kind === "error";
        overlayEl.style.background = isError
          ? "rgba(251, 146, 60, 0.18)"
          : "rgba(0, 0, 0, 0.55)";
        overlayEl.innerHTML = "";
        if (kind === "loading") {
          const spin = document.createElement("div");
          spin.className = "tiptap-spinner-large";
          overlayEl.appendChild(spin);
        }
        const t = document.createElement("div");
        t.textContent = text;
        t.style.cssText = `
          font-family: var(--font-mono);
          font-size: 12px; font-weight: 600;
          color: ${isError ? "var(--text-primary)" : "var(--text-primary)"};
          text-align: center; padding: 0 16px;
          max-width: 90%;
        `;
        overlayEl.appendChild(t);
      };
      const clearStatus = () => {
        if (overlayEl?.parentNode) overlayEl.parentNode.removeChild(overlayEl);
        overlayEl = null;
      };

      const convertToTable = () => {
        const ascii = node.textContent || "";
        const md = asciiTableToMd(ascii);
        if (md && replaceBlock(md)) return;
        showStatus("Couldn't parse as a table — the content doesn't look like a grid.", "error");
        setTimeout(clearStatus, 2500);
      };

      const convertToList = () => {
        const ascii = node.textContent || "";
        const lines = ascii.split("\n");
        const md = lines
          .map((l) => {
            const m = l.match(/^([\s│├└─━┊┈]*)(.+?)$/);
            if (!m) return null;
            const prefix = m[1];
            const label = m[2].replace(/^[─━]+\s*/, "").trim();
            if (!label) return null;
            const depth = Math.max(0, Math.floor(prefix.replace(/[├└─━┊┈]/g, "").length / 2));
            return `${"  ".repeat(depth)}- ${label}`;
          })
          .filter(Boolean)
          .join("\n");
        if (md.trim() && replaceBlock(md)) return;
        showStatus("Couldn't parse as a list — no recognizable tree branches.", "error");
        setTimeout(clearStatus, 2500);
      };

      const convertToParagraph = () => {
        const ascii = node.textContent || "";
        const cleaned = ascii
          .split("\n")
          .map((l) => l.replace(BOX_CHARS, "").trim())
          .filter((l) => l.length > 0)
          .join("\n\n");
        if (cleaned && replaceBlock(cleaned)) return;
        showStatus("Nothing to extract.", "error");
        setTimeout(clearStatus, 2500);
      };

      const convertToMermaid = async () => {
        const ascii = node.textContent || "";
        if (!ascii.trim() || converting) return;
        setConverting(true);
        showStatus("Converting to Mermaid via AI…", "loading");
        try {
          const res = await fetch("/api/ascii-to-mermaid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ascii }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const mermaid = (data?.mermaid || "").trim();
          if (!mermaid) throw new Error("empty response");
          if (!replaceBlock("```mermaid\n" + mermaid + "\n```\n")) {
            throw new Error("couldn't insert");
          }
        } catch (err) {
          showStatus(`Mermaid conversion failed: ${(err as Error).message}`, "error");
          setTimeout(clearStatus, 3500);
        } finally {
          setConverting(false);
        }
      };

      const flashError = (msg: string) => {
        const orig = convertBtn.textContent;
        convertBtn.textContent = msg;
        setTimeout(() => { convertBtn.textContent = orig || "Convert ▾"; }, 1500);
      };

      const closeMenu = () => {
        menu.style.display = "none";
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        document.removeEventListener("mousedown", onDocClick);
        window.removeEventListener("resize", reposition);
        window.removeEventListener("scroll", reposition, true);
      };
      const reposition = () => {
        const r = convertBtn.getBoundingClientRect();
        const w = 200;
        menu.style.top = `${r.bottom + 4}px`;
        menu.style.left = `${Math.max(8, r.right - w)}px`;
      };
      const onDocClick = (e: MouseEvent) => {
        if (!menu.contains(e.target as Node) && !convertBtn.contains(e.target as Node)) closeMenu();
      };

      const addItem = (label: string, hint: string, fn: () => void | Promise<void>) => {
        const item = document.createElement("div");
        item.setAttribute("role", "button");
        item.style.cssText = `
          background: transparent; cursor: pointer;
          padding: 6px 10px; border-radius: 4px;
          color: var(--text-secondary); font-size: 11px;
          display: flex; flex-direction: column; gap: 1px;
          user-select: none;
        `;
        item.innerHTML = `<span style="font-weight:600;pointer-events:none">${label}</span><span style="color:var(--text-faint);font-size:10px;pointer-events:none">${hint}</span>`;
        item.addEventListener("mouseenter", () => { item.style.background = "var(--border)"; });
        item.addEventListener("mouseleave", () => { item.style.background = "transparent"; });
        let fired = false;
        const run = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (fired) return;
          fired = true;
          // eslint-disable-next-line no-console
          console.log("[Convert dropdown] item clicked:", label);
          closeMenu();
          // Show overlay immediately so user sees instant feedback
          showStatus(`Starting: ${label}…`, "loading");
          Promise.resolve().then(async () => {
            try {
              await fn();
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error(`[Convert: ${label}] failed:`, err);
              showStatus(`${label} failed: ${(err as Error).message || err}`, "error");
              setTimeout(clearStatus, 4000);
              setConverting(false);
            }
          });
        };
        item.addEventListener("mousedown", run);
        // Also bind click as a safety net in case mousedown is intercepted somewhere
        item.addEventListener("click", run);
        menu.appendChild(item);
      };

      const beautifyWithAI = async () => {
        const ascii = node.textContent || "";
        if (!ascii.trim() || converting) return;
        setConverting(true);
        showStatus("Beautifying with AI…", "loading");
        try {
          const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "beautify", markdown: ascii }),
          });
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
            throw new Error(msg);
          }
          const data = await res.json();
          const result = (data?.result || "").trim();
          if (!result) throw new Error("AI returned empty");
          if (!replaceBlock(result)) throw new Error("couldn't insert");
        } catch (err) {
          showStatus(`Beautify failed: ${(err as Error).message}`, "error");
          setTimeout(clearStatus, 3500);
        } finally {
          setConverting(false);
        }
      };

      addItem("Table", "Box-drawn grid → markdown table", convertToTable);
      addItem("List", "Tree branches → nested bullets", convertToList);
      addItem("Paragraph", "Strip box chars, keep text", convertToParagraph);
      const sep = document.createElement("div");
      sep.style.cssText = "height:1px;background:var(--border-dim);margin:3px 0;";
      menu.appendChild(sep);
      addItem("Render as Mermaid chart (AI)", "AI redraws this as a styled Mermaid diagram", beautifyWithAI);

      convertBtn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (converting) return;
        const opening = !menu.parentNode;
        if (opening) {
          document.body.appendChild(menu);
          menu.style.display = "flex";
          reposition();
          setTimeout(() => {
            document.addEventListener("mousedown", onDocClick);
            window.addEventListener("resize", reposition);
            window.addEventListener("scroll", reposition, true);
          }, 0);
        } else {
          closeMenu();
        }
      });

      const copyBtn = document.createElement("button");
      copyBtn.className = "tiptap-codeblock-copy";
      copyBtn.type = "button";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = node.textContent || "";
        navigator.clipboard?.writeText(code).then(() => {
          copyBtn.textContent = "Copied";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
        });
      });

      headerActions.appendChild(convertWrap);
      headerActions.appendChild(copyBtn);
      header.appendChild(langLabel);
      header.appendChild(headerActions);
      wrapper.appendChild(header);

      // Body: gutter (line numbers) + pre/code
      const body = document.createElement("div");
      body.className = "tiptap-codeblock-body";

      const gutter = document.createElement("div");
      gutter.className = "tiptap-codeblock-gutter";
      gutter.contentEditable = "false";

      const pre = document.createElement("pre");
      Object.entries(HTMLAttributes || {}).forEach(([k, v]) => pre.setAttribute(k, String(v)));
      const code = document.createElement("code");
      if (lang) code.className = `language-${lang}`;
      pre.appendChild(code);

      body.appendChild(gutter);
      body.appendChild(pre);
      wrapper.appendChild(body);

      const renderGutter = () => {
        const text = node.textContent || "";
        // Always show at least 1 line; count newlines + 1
        const lines = Math.max(1, text.split("\n").length);
        if (gutter.childElementCount === lines) return;
        // Rebuild only when count changes — minimal DOM work
        const frag = document.createDocumentFragment();
        for (let i = 1; i <= lines; i++) {
          const ln = document.createElement("span");
          ln.className = "tiptap-codeblock-lineno";
          ln.textContent = String(i);
          frag.appendChild(ln);
        }
        gutter.replaceChildren(frag);
      };
      renderGutter();

      let mermaidContainer: HTMLDivElement | null = null;
      let renderToken = 0;
      const ensureContainer = () => {
        if (!mermaidContainer) {
          mermaidContainer = document.createElement("div");
          mermaidContainer.className = "tiptap-mermaid-render";
          mermaidContainer.contentEditable = "false";
          wrapper.appendChild(mermaidContainer);
        }
      };
      const renderMermaid = () => {
        const src = (node.textContent || "").trim();
        if (!src) return;
        ensureContainer();
        const myToken = ++renderToken;
        const tryRender = (attempt = 0) => {
          const m = (window as any).mermaid;
          if (!m || typeof m.render !== "function") {
            if (attempt < 40) {
              if (mermaidContainer && attempt === 0) {
                mermaidContainer.innerHTML = `<div style="color:var(--text-faint);font-size:11px;padding:8px;">Loading diagram…</div>`;
              }
              setTimeout(() => tryRender(attempt + 1), 150);
            } else if (mermaidContainer) {
              mermaidContainer.innerHTML = `<div style="color:var(--text-primary);font-size:11px;padding:8px;">Mermaid failed to load</div>`;
            }
            return;
          }
          const id = `mmd-${Math.random().toString(36).slice(2, 8)}`;
          try {
            const result = m.render(id, src);
            // v10+ returns Promise; older may be sync
            Promise.resolve(result)
              .then((r: any) => {
                if (myToken !== renderToken) return; // stale
                const svg = typeof r === "string" ? r : r?.svg || "";
                if (mermaidContainer) mermaidContainer.innerHTML = svg;
              })
              .catch((err: unknown) => {
                if (myToken !== renderToken) return;
                if (mermaidContainer) mermaidContainer.innerHTML = `<div style="color:var(--text-primary);font-size:11px;padding:8px;white-space:pre-wrap;">Mermaid error: ${String((err as Error)?.message || err)}</div>`;
              });
          } catch (err) {
            if (mermaidContainer) mermaidContainer.innerHTML = `<div style="color:var(--text-primary);font-size:11px;padding:8px;white-space:pre-wrap;">Mermaid error: ${String((err as Error)?.message || err)}</div>`;
          }
        };
        tryRender();
      };

      if (lang === "mermaid") {
        body.style.display = "none";
        renderMermaid();
      }

      let mermaidUpdateTimer: ReturnType<typeof setTimeout> | undefined;
      return {
        dom: wrapper,
        contentDOM: code,
        // CRITICAL: Tell ProseMirror to ignore DOM mutations outside contentDOM.
        // Without this, every gutter / overlay / header change makes PM reparse
        // and destroy our NodeView state — which is why the conversion overlay
        // and line-number updates were vanishing instantly.
        ignoreMutation(mutation: any) {
          if (mutation.type === "selection") return false;
          if (!code.contains(mutation.target as Node)) return true;
          return false;
        },
        update(updatedNode: any) {
          if (updatedNode.type.name !== node.type.name) return false;
          const newLang = (updatedNode.attrs.language || "").toLowerCase();
          if (newLang !== lang) return false; // recreate node view on lang change
          node = updatedNode;
          if (newLang === "mermaid") {
            if (mermaidUpdateTimer) clearTimeout(mermaidUpdateTimer);
            mermaidUpdateTimer = setTimeout(renderMermaid, 400);
          } else {
            renderGutter();
            updateConvertVisibility();
          }
          return true;
        },
      };
}

// ─── Math decoration plugin: render $...$ and $$...$$ as KaTeX widgets ───
// Meta key callers can use to force the math plugin to rebuild its
// decorations on a transaction that doesn't naturally docChange. The
// editor mounts with empty content, then setContent injects the real
// body — under React StrictMode (or any extra re-render before the
// markdown-it parser finishes patching) the apply call could miss
// the docChange that produced the math text. Dispatching a
// transaction with `forceMath: true` after mount guarantees one
// more build pass.
const MDFY_MATH_FORCE_META = "mwMathForceRebuild";
function createMathPlugin() {
  const key = new PluginKey("mw-math");
  const buildDecorations = (doc: any) => {
    const decos: any[] = [];
    doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      const text = node.text;
      // Display math $$...$$ first
      const displayRe = /\$\$([^$\n]+)\$\$/g;
      let m: RegExpExecArray | null;
      const consumed: Array<[number, number]> = [];
      while ((m = displayRe.exec(text))) {
        const from = pos + m.index;
        const to = from + m[0].length;
        consumed.push([m.index, m.index + m[0].length]);
        const widget = document.createElement("span");
        widget.className = "tiptap-math-display";
        widget.contentEditable = "false";
        try {
          widget.innerHTML = katex.renderToString(m[1].trim(), { displayMode: true, throwOnError: false, strict: false });
        } catch { widget.textContent = m[0]; }
        decos.push(Decoration.widget(to, widget, { side: 1, ignoreSelection: true }));
        decos.push(Decoration.inline(from, to, { class: "tiptap-math-source" }));
      }
      // Inline math $...$ — skip ranges already taken by display
      const inlineRe = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g;
      while ((m = inlineRe.exec(text))) {
        const start = m.index;
        const end = start + m[0].length;
        if (consumed.some(([a, b]) => start < b && end > a)) continue;
        const from = pos + start;
        const to = pos + end;
        const widget = document.createElement("span");
        widget.className = "tiptap-math-inline";
        widget.contentEditable = "false";
        try {
          widget.innerHTML = katex.renderToString(m[1].trim(), { displayMode: false, throwOnError: false, strict: false });
        } catch { widget.textContent = m[0]; }
        decos.push(Decoration.widget(to, widget, { side: 1, ignoreSelection: true }));
        decos.push(Decoration.inline(from, to, { class: "tiptap-math-source" }));
      }
    });
    return DecorationSet.create(doc, decos);
  };
  return new Plugin({
    key,
    state: {
      init: (_: any, { doc }: any) => buildDecorations(doc),
      apply: (tr: any, old: any) => {
        if (tr.docChanged) return buildDecorations(tr.doc);
        if (tr.getMeta(MDFY_MATH_FORCE_META)) return buildDecorations(tr.doc);
        return old;
      },
    },
    props: { decorations(state: any) { return this.getState(state); } },
  });
}

const MathExtension = Extension.create({
  name: "mwMath",
  addProseMirrorPlugins() { return [createMathPlugin()]; },
});

// ─── Frontmatter ───
function extractFrontmatter(md: string): { frontmatter: string; body: string } {
  if (!md.startsWith("---")) return { frontmatter: "", body: md };
  const end = md.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: "", body: md };
  return { frontmatter: md.slice(0, end + 4), body: md.slice(end + 4).replace(/^\n/, "") };
}

function reattachFrontmatter(fm: string, body: string): string {
  return fm ? fm + "\n" + body : body;
}

// ─── Types ───
export interface TiptapLiveEditorProps {
  markdown: string;
  onChange: (md: string) => void;
  canEdit: boolean;
  narrowView: boolean;
  onPasteImage?: (file: File) => Promise<string | null>;
  onDoubleClickCode?: (lang: string, code: string) => void;
  onDoubleClickMath?: (tex: string, mode: "inline" | "display") => void;
  onDoubleClickMermaid?: (code: string) => void;
  /** Fires when the local caret moves. `pmPos` is the ProseMirror
   *  position of the selection head — both peers' PM docs are
   *  parsed from the same markdown so the value travels untouched. */
  onSelectionUpdate?: (pmPos: number) => void;
  /** Remote collaborators' carets to render as decorations. Updated
   *  by the parent whenever useCursorPresence's remoteCursors list
   *  changes. */
  remoteCursors?: TiptapRemoteCursor[];
}

export interface TiptapLiveEditorHandle {
  setMarkdown: (md: string) => void;
  getMarkdown: () => string;
  focus: () => void;
  getEditor: () => Editor | null;
}

// ─── Selection Toolbar ───
const AI_QUICK: { key: string; label: string; action: string }[] = [
  { key: "polish", label: "Polish", action: "selection_polish" },
  { key: "shorten", label: "Shorten", action: "selection_shorten" },
  { key: "expand", label: "Expand", action: "selection_expand" },
];
const AI_LANGS: [string, string][] = [
  ["English", "English"], ["한국어", "Korean"], ["日本語", "Japanese"], ["中文", "Chinese"],
  ["Español", "Spanish"], ["Français", "French"], ["Deutsch", "German"], ["Português", "Portuguese"],
];

function SelectionToolbar({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [aiMenu, setAiMenu] = useState<null | "root" | "translate">(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  // Cached preview of the saved selection — shown at the top of the
  // AI popup. The native browser selection highlight clears when the
  // popup input takes focus, so without this it looks like the
  // selection was lost.
  const [aiSnippetPreview, setAiSnippetPreview] = useState("");
  // Stash the range — Tiptap selection collapses to the input when
  // we focus the prompt field, but we still need the original
  // (from, to) to replace.
  const savedRangeRef = useRef<{ from: number; to: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const aiMenuRef = useRef<typeof aiMenu>(null);
  aiMenuRef.current = aiMenu;

  useEffect(() => {
    const update = () => {
      // Don't tear down the toolbar while an AI popup is open — the
      // prompt input takes focus and would otherwise collapse the
      // selection.
      if (aiMenuRef.current) return;
      const { from, to } = editor.state.selection;
      if (from === to || !editor.isFocused) {
        setPos(null);
        setShowLinkInput(false);
        return;
      }
      const domAtPos = editor.view.coordsAtPos(from);
      const domEnd = editor.view.coordsAtPos(to);
      const editorRect = editor.view.dom.closest(".overflow-auto")?.getBoundingClientRect();
      if (!editorRect) return;
      setPos({
        top: domAtPos.top - editorRect.top - 44,
        left: (domAtPos.left + domEnd.left) / 2 - editorRect.left,
      });
    };

    editor.on("selectionUpdate", update);
    editor.on("blur", () => {
      if (aiMenuRef.current) return;
      setPos(null); setShowLinkInput(false);
    });
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  const openAiMenu = useCallback(() => {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      savedRangeRef.current = { from, to };
      const snippet = editor.state.doc.textBetween(from, to, "\n").trim();
      setAiSnippetPreview(snippet);
    }
    setAiError(null);
    setAiMenu("root");
  }, [editor]);

  const closeAiMenu = useCallback(() => {
    setAiMenu(null);
    setAiError(null);
    setAiPrompt("");
    setAiSnippetPreview("");
    savedRangeRef.current = null;
  }, []);

  const replaceSelection = useCallback((mdResult: string) => {
    const range = savedRangeRef.current;
    if (!range) return false;
    let html: string = mdResult;
    try {
      const mdParser = (editor.storage as { markdown?: { parser?: { md?: { render?: (s: string) => string } } } }).markdown?.parser;
      if (mdParser?.md?.render) html = mdParser.md.render(mdResult);
    } catch { /* fall back to raw */ }
    // If the original selection was inline (single line, no leading
    // hashes / list markers), strip the wrapping <p> tag so we don't
    // accidentally split a paragraph mid-sentence.
    // Decide whether to unwrap markdown-it's outer <p>:
    //   - If the rendered HTML is a SINGLE top-level <p> with no other
    //     block siblings, peel it off so the result lives inside the
    //     existing paragraph instead of splitting it.
    //   - If there are multiple blocks (list, multi-paragraph, code,
    //     heading…) keep the HTML so structure survives.
    if (typeof document !== "undefined") {
      const tmp = document.createElement("div");
      tmp.innerHTML = html.trim();
      const children = Array.from(tmp.children);
      if (children.length === 1 && children[0].tagName === "P") {
        html = (children[0] as HTMLElement).innerHTML;
      }
    } else {
      // SSR fallback — same conservative regex as before.
      const oneP = /^\s*<p>([\s\S]*?)<\/p>\s*$/.exec(html);
      if (oneP) html = oneP[1];
    }
    editor
      .chain()
      .focus()
      .deleteRange({ from: range.from, to: range.to })
      .insertContentAt(range.from, html)
      .run();
    return true;
  }, [editor]);

  const runAi = useCallback(async (action: string, opts: { language?: string; instruction?: string } = {}, busyKey?: string) => {
    const range = savedRangeRef.current;
    if (!range) { setAiError("Selection lost — try again."); return; }
    const snippet = editor.state.doc.textBetween(range.from, range.to, "\n");
    if (!snippet.trim()) { setAiError("Empty selection."); return; }
    if (snippet.length > 8000) { setAiError("Selection too long (max 8k chars)."); return; }
    setAiBusy(busyKey || action);
    setAiError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, markdown: snippet, ...opts }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "AI failed" }));
        throw new Error(j.error || `AI failed (${res.status})`);
      }
      const j = await res.json();
      const out = (j.result || "").trim();
      if (!out) throw new Error("Empty AI result");
      const ok = replaceSelection(out);
      if (!ok) throw new Error("Could not insert result");
      closeAiMenu();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI failed");
    } finally {
      setAiBusy(null);
    }
  }, [editor, replaceSelection, closeAiMenu]);

  const applyLink = useCallback(() => {
    if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run();
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  if (!pos) return null;

  const btn = (active: boolean) => ({
    background: active ? "var(--border)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    border: "none",
    borderRadius: 4,
    padding: "4px 6px",
    cursor: "pointer" as const,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    transition: "background 0.1s",
  });

  return (
    <div
      ref={toolbarRef}
      className="absolute z-[9999] flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-xl"
      style={{
        top: Math.max(4, pos.top),
        left: Math.max(8, pos.left - 120),
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.preventDefault()} // prevent blur
    >
      {showLinkInput ? (
        <div className="flex items-center gap-1 px-1">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); } }}
            placeholder="https://..."
            className="text-caption px-2 py-1 rounded outline-none"
            style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--border)", width: 180 }}
            autoFocus
          />
          <button onClick={applyLink} style={{ fontSize: 10, padding: "3px 8px", background: "var(--text-primary)", color: "var(--background)", border: "none", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>OK</button>
        </div>
      ) : (
        <>
          <button onClick={() => editor.chain().focus().toggleBold().run()} style={btn(editor.isActive("bold"))} title="Bold (⌘B)"><Bold width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} style={btn(editor.isActive("italic"))} title="Italic (⌘I)"><Italic width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} style={btn(editor.isActive("strike"))} title="Strikethrough"><Strikethrough width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleCode().run()} style={btn(editor.isActive("code"))} title="Code"><Code width={14} height={14} /></button>
          <div style={{ width: 1, height: 16, background: "var(--border-dim)", margin: "0 2px" }} />
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} style={btn(editor.isActive("heading", { level: 1 }))} title="H1"><Heading1 width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={btn(editor.isActive("heading", { level: 2 }))} title="H2"><Heading2 width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} style={btn(editor.isActive("heading", { level: 3 }))} title="H3"><Heading3 width={14} height={14} /></button>
          <div style={{ width: 1, height: 16, background: "var(--border-dim)", margin: "0 2px" }} />
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={btn(editor.isActive("bulletList"))} title="Bullet list"><List width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btn(editor.isActive("orderedList"))} title="Ordered list"><ListOrdered width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleTaskList().run()} style={btn(editor.isActive("taskList"))} title="Task list"><CheckSquare width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().toggleBlockquote().run()} style={btn(editor.isActive("blockquote"))} title="Quote"><Quote width={14} height={14} /></button>
          <div style={{ width: 1, height: 16, background: "var(--border-dim)", margin: "0 2px" }} />
          <button onClick={() => { if (editor.isActive("link")) { editor.chain().focus().unsetLink().run(); } else { setShowLinkInput(true); setLinkUrl(editor.getAttributes("link").href || ""); } }} style={btn(editor.isActive("link"))} title="Link (⌘K)"><LinkIcon width={14} height={14} /></button>
          <button onClick={() => editor.chain().focus().setHorizontalRule().run()} style={btn(false)} title="Horizontal rule"><Minus width={14} height={14} /></button>
          <div style={{ width: 1, height: 16, background: "var(--border-dim)", margin: "0 2px" }} />
          <button onClick={() => editor.chain().focus().sinkListItem("listItem").run()} style={btn(false)} title="Indent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 6H11M21 12H11M21 18H11M3 8l4 4-4 4"/></svg>
          </button>
          <button onClick={() => editor.chain().focus().liftListItem("listItem").run()} style={btn(false)} title="Outdent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 6H11M21 12H11M21 18H11M7 8l-4 4 4 4"/></svg>
          </button>
          <button onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} style={btn(false)} title="Clear formatting">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
          </button>
          <div style={{ width: 1, height: 16, background: "var(--border-dim)", margin: "0 2px" }} />
          <button
            onClick={openAiMenu}
            style={btn(!!aiMenu)}
            title="AI on selection"
          >
            <Sparkles width={14} height={14} />
          </button>
        </>
      )}
      {aiMenu && (
        <div
          className="absolute mt-1 min-w-[260px] rounded-lg p-1.5 flex flex-col gap-1"
          style={{
            top: "100%",
            right: 4,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            zIndex: 10000,
          }}
        >
          {aiSnippetPreview && (
            <div
              className="px-2 py-1.5 rounded-md mb-1 flex items-start gap-1.5"
              style={{
                background: "var(--border)",
                border: "1px solid var(--border-dim)",
                fontSize: 11,
                lineHeight: 1.4,
                color: "var(--text-secondary)",
              }}
            >
              <span className="font-mono uppercase tracking-wider shrink-0" style={{ color: "var(--text-primary)", fontSize: 9, paddingTop: 1 }}>
                On
              </span>
              <span
                className="flex-1"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                }}
              >
                {aiSnippetPreview.length > 200 ? aiSnippetPreview.slice(0, 200) + "…" : aiSnippetPreview}
              </span>
            </div>
          )}
          {aiMenu === "root" && (
            <>
              <div
                className="flex items-center gap-1.5 px-1.5 py-1 rounded-md"
                style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}
              >
                <Sparkles size={12} style={{ color: "var(--micro-ai)" }} />
                <input
                  autoFocus
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Tell AI what to do with this…"
                  maxLength={500}
                  disabled={!!aiBusy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      const v = aiPrompt.trim();
                      if (v) runAi("selection_rewrite", { instruction: v });
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      closeAiMenu();
                    }
                  }}
                  className="flex-1 text-caption bg-transparent outline-none"
                  style={{ color: "var(--text-primary)", border: "none", fontSize: 13 }}
                />
                {aiBusy === "selection_rewrite" ? (
                  <Loader2 size={12} className="animate-spin" style={{ color: "var(--text-faint)" }} />
                ) : aiPrompt.trim() ? (
                  <button
                    onClick={() => {
                      const v = aiPrompt.trim();
                      if (v) runAi("selection_rewrite", { instruction: v });
                    }}
                    disabled={!!aiBusy}
                    className="shrink-0 px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "var(--text-primary)", color: "var(--background)", fontSize: 11, border: "none", cursor: "pointer" }}
                    title="Send (Enter)"
                  >
                    ↵
                  </button>
                ) : null}
              </div>
              <div className="text-caption px-1.5 pt-1" style={{ color: "var(--text-faint)", fontSize: 11 }}>
                Or pick a quick action
              </div>
              {AI_QUICK.map((q) => (
                <button
                  key={q.key}
                  disabled={!!aiBusy}
                  onClick={() => runAi(q.action)}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left"
                  style={{ color: "var(--text-secondary)", background: "transparent", border: "none", fontSize: 12, cursor: aiBusy ? "default" : "pointer" }}
                  onMouseEnter={(e) => { if (!aiBusy) (e.currentTarget as HTMLElement).style.background = "var(--menu-hover)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span>{q.label}</span>
                  {aiBusy === q.action && <Loader2 size={12} className="animate-spin" />}
                </button>
              ))}
              <button
                disabled={!!aiBusy}
                onClick={() => setAiMenu("translate")}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left"
                style={{ color: "var(--text-secondary)", background: "transparent", border: "none", fontSize: 12, cursor: aiBusy ? "default" : "pointer" }}
                onMouseEnter={(e) => { if (!aiBusy) (e.currentTarget as HTMLElement).style.background = "var(--menu-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span>Translate</span>
                <span style={{ color: "var(--text-faint)" }}>›</span>
              </button>
            </>
          )}
          {aiMenu === "translate" && (
            <>
              <button
                onClick={() => setAiMenu("root")}
                className="px-2.5 py-1 text-left rounded"
                style={{ color: "var(--text-faint)", background: "transparent", border: "none", fontSize: 11, cursor: "pointer" }}
              >
                ‹ Back
              </button>
              <div className="grid grid-cols-2 gap-0.5 mt-1">
                {AI_LANGS.map(([label, lang]) => {
                  const langKey = `translate:${lang}`;
                  return (
                    <button
                      key={lang}
                      disabled={!!aiBusy}
                      onClick={() => runAi("selection_translate", { language: lang }, langKey)}
                      className="px-2 py-1 rounded flex items-center justify-between gap-1"
                      style={{ color: "var(--text-secondary)", background: "transparent", border: "none", fontSize: 12, cursor: aiBusy ? "default" : "pointer" }}
                      onMouseEnter={(e) => { if (!aiBusy) (e.currentTarget as HTMLElement).style.background = "var(--menu-hover)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <span>{label}</span>
                      {aiBusy === langKey && <Loader2 size={10} className="animate-spin" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {aiError && (
            <div className="px-2.5 py-1" style={{ color: "#f87171", fontSize: 11 }}>
              {aiError}
            </div>
          )}
          <div
            className="border-t mt-1 pt-1 flex items-center justify-between"
            style={{ borderColor: "var(--border-dim)" }}
          >
            <span className="px-1.5" style={{ color: "var(--text-faint)", fontSize: 11 }}>
              Esc to close
            </span>
            <button
              onClick={closeAiMenu}
              className="px-2 py-0.5 rounded"
              style={{ color: "var(--text-faint)", background: "transparent", border: "none", fontSize: 11, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "var(--menu-hover)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Table Menu — floating toolbar shown when cursor is in a table cell ───
function TableMenu({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const update = () => {
      if (!editor.isActive("table") || !editor.isFocused) {
        setPos(null);
        return;
      }
      const { from } = editor.state.selection;
      const dap = editor.view.domAtPos(from);
      const node = dap.node as HTMLElement;
      const tableEl = (node.nodeType === 3 ? node.parentElement : node)?.closest("table");
      if (!tableEl) { setPos(null); return; }
      const tableRect = tableEl.getBoundingClientRect();
      const editorRect = editor.view.dom.closest(".overflow-auto")?.getBoundingClientRect();
      if (!editorRect) return;
      setPos({
        top: tableRect.top - editorRect.top - 36,
        left: tableRect.left - editorRect.left,
      });
    };

    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", () => setTimeout(() => { if (!editor.isFocused) setPos(null); }, 100));
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
    };
  }, [editor]);

  if (!pos) return null;

  const btnStyle = {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "none",
    borderRadius: 4,
    padding: "3px 8px",
    cursor: "pointer" as const,
    fontSize: 11,
    fontWeight: 500,
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 3,
    whiteSpace: "nowrap" as const,
  };
  const sep = <div style={{ width: 1, height: 14, background: "var(--border-dim)", margin: "0 1px" }} />;

  return (
    <div
      className="absolute z-[9998] flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-xl"
      style={{
        top: Math.max(4, pos.top),
        left: Math.max(8, pos.left),
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button onClick={() => editor.chain().focus().addRowBefore().run()} style={btnStyle} title="Insert row above">↑+ Row</button>
      <button onClick={() => editor.chain().focus().addRowAfter().run()} style={btnStyle} title="Insert row below">↓+ Row</button>
      {sep}
      <button onClick={() => editor.chain().focus().addColumnBefore().run()} style={btnStyle} title="Insert column left">←+ Col</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()} style={btnStyle} title="Insert column right">+→ Col</button>
      {sep}
      <button onClick={() => editor.chain().focus().deleteRow().run()} style={btnStyle} title="Delete row">− Row</button>
      <button onClick={() => editor.chain().focus().deleteColumn().run()} style={btnStyle} title="Delete column">− Col</button>
      {sep}
      <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} style={btnStyle} title="Toggle header row">Header</button>
      {sep}
      <button onClick={() => editor.chain().focus().deleteTable().run()} style={{ ...btnStyle, color: "var(--text-primary)" }} title="Delete table">
        <Trash2 width={12} height={12} />
      </button>
    </div>
  );
}

// ─── Mount guard — only render editor on client ───
const TiptapLiveEditor = forwardRef<TiptapLiveEditorHandle, TiptapLiveEditorProps>(
  function TiptapLiveEditor(props, ref) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (typeof window === "undefined" || !mounted) return null;
    return <TiptapLiveEditorInner {...props} ref={ref} />;
  }
);

// ─── Inner Component (client-only, safe to use useEditor) ───
const TiptapLiveEditorInner = forwardRef<TiptapLiveEditorHandle, TiptapLiveEditorProps>(
  function TiptapLiveEditorInner({ markdown, onChange, canEdit, narrowView, onPasteImage, onDoubleClickCode, onDoubleClickMath, onDoubleClickMermaid, onSelectionUpdate, remoteCursors }, ref) {
    const frontmatterRef = useRef("");
    const isSettingContent = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onPasteImageRef = useRef(onPasteImage);
    onPasteImageRef.current = onPasteImage;
    const onDblClickCodeRef = useRef(onDoubleClickCode);
    onDblClickCodeRef.current = onDoubleClickCode;
    const onDblClickMathRef = useRef(onDoubleClickMath);
    onDblClickMathRef.current = onDoubleClickMath;
    const onDblClickMermaidRef = useRef(onDoubleClickMermaid);
    onDblClickMermaidRef.current = onDoubleClickMermaid;
    const onSelectionUpdateRef = useRef(onSelectionUpdate);
    onSelectionUpdateRef.current = onSelectionUpdate;

    const { frontmatter: initialFm, body: initialBody } = extractFrontmatter(markdown);
    const initialBodyRef = useRef(initialBody);
    if (!frontmatterRef.current && initialFm) frontmatterRef.current = initialFm;

    const [editor, setEditor] = useState<Editor | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      const ed = new TiptapEditor({
        element: containerRef.current,
        extensions: [
          StarterKit.configure({
            codeBlock: false,
            link: false, // using separate TiptapLink with custom config
            heading: { levels: [1, 2, 3, 4, 5, 6] },
          }),
          CustomCodeBlock.configure({ lowlight, defaultLanguage: null }),
          MathExtension,
          Table.configure({
          resizable: false,
          HTMLAttributes: { class: "tiptap-table" },
        }),
          TableRow,
          TableCell,
          TableHeader,
          TaskList,
          TaskItem.configure({ nested: true }),
          TiptapImage.configure({ inline: false, allowBase64: true }),
          TiptapLink.configure({
            openOnClick: false,
            HTMLAttributes: { rel: "noopener noreferrer nofollow" },
          }),
          Placeholder.configure({ placeholder: "Start writing..." }),
          TiptapMarkdown.configure({
            html: true,
            transformPastedText: false,
            transformCopiedText: true,
          }),
          // Remote-cursor decorations live in their own ProseMirror
          // plugin so they share the editor's transaction lifecycle
          // (decorations re-map automatically across local edits).
          Extension.create({
            name: "mwRemoteCursors",
            addProseMirrorPlugins() { return [remoteCursorsPlugin()]; },
          }),
        ],
        content: "<p></p>",
        editable: canEdit,
        editorProps: {
          attributes: {
            class: `mdcore-rendered focus:outline-none ${narrowView ? "p-3 sm:p-6 mx-auto max-w-3xl" : "p-3 sm:p-6 max-w-none"}`,
            style: `cursor: ${canEdit ? "text" : "default"}; min-height: 100%;`,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handleDoubleClickOn: (view: any, pos: any, node: any) => {
            // Mermaid only opens the canvas modal. Other code blocks edit inline.
            if (node.type.name === "codeBlock" && (node.attrs.language || "").toLowerCase() === "mermaid") {
              const code = node.textContent || "";
              if (onDblClickMermaidRef.current) {
                onDblClickMermaidRef.current(code);
                return true;
              }
            }
            return false;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handleClick: (view: any, _pos: any, event: any) => {
            const a = (event.target as HTMLElement)?.closest?.("a") as HTMLAnchorElement | null;
            if (!a) return false;
            const href = a.getAttribute("href") || "";
            // Footnote ref/backref → scroll within editor instead of navigating
            if (href.startsWith("#") && (a.classList.contains("footnote-ref") || a.classList.contains("footnote-backref") || a.closest(".footnote-ref"))) {
              event.preventDefault();
              const id = href.slice(1);
              const target = view.dom.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
              if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
              return true;
            }
            return false;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handlePaste: (view: any, event: any) => {
            // Image paste
            const items = Array.from(event.clipboardData?.items || []) as DataTransferItem[];
            const imageItem = items.find((i: DataTransferItem) => i.type.startsWith("image/"));
            if (imageItem && onPasteImageRef.current) {
              event.preventDefault();
              const file = imageItem.getAsFile();
              if (!file) return true;
              onPasteImageRef.current(file).then((url) => {
                if (url) {
                  view.dispatch(view.state.tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({ src: url })
                  ));
                }
              });
              return true;
            }
            return false; // let tiptap handle text/HTML paste
          },
        },
        onUpdate: ({ editor: updatedEd }) => {
          if (isSettingContent.current) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bodyMd = (updatedEd.storage as any).markdown?.getMarkdown?.() || "";
          const fullMd = reattachFrontmatter(frontmatterRef.current, bodyMd);
          onChangeRef.current(fullMd);
        },
      });

      editorRef.current = ed;
      setEditor(ed);

      // Patch markdown-it: drop <thead>/<tbody> (break PM Table parsing) + add footnotes
      try {
        const mdParser = (ed.storage as any).markdown?.parser;
        if (mdParser?.md?.renderer?.rules) {
          const noop = () => "";
          mdParser.md.renderer.rules.thead_open = noop;
          mdParser.md.renderer.rules.thead_close = noop;
          mdParser.md.renderer.rules.tbody_open = noop;
          mdParser.md.renderer.rules.tbody_close = noop;
        }
        if (mdParser?.md) {
          mdParser.md.use(markdownItFootnote);
        }
      } catch { /* no parser yet */ }

      // Set initial content (now without <thead>/<tbody> thanks to patched renderer)
      if (initialBodyRef.current) {
        isSettingContent.current = true;
        ed.commands.setContent(initialBodyRef.current);
        isSettingContent.current = false;
      }
      // Force a math-decoration rebuild on the next frame. Covers the
      // race where init ran with the empty placeholder doc and any
      // intermediate transaction's apply missed the docChange (e.g.
      // StrictMode double-mount, parser patch ordering).
      requestAnimationFrame(() => {
        try {
          ed.view.dispatch(ed.view.state.tr.setMeta(MDFY_MATH_FORCE_META, true));
        } catch { /* editor may have been destroyed during HMR */ }
      });

      return () => { ed.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { if (editor) editor.setEditable(canEdit); }, [editor, canEdit]);

    // Local-caret broadcast — fires on every selection move (focus,
    // arrow keys, click, typing). The throttle lives in
    // useCursorPresence so we don't double-up here.
    useEffect(() => {
      if (!editor) return;
      const handler = () => {
        try {
          const cb = onSelectionUpdateRef.current;
          if (!cb) return;
          cb(editor.state.selection.head);
        } catch { /* ignore — editor may have been torn down */ }
      };
      editor.on("selectionUpdate", handler);
      editor.on("focus", handler);
      return () => {
        editor.off("selectionUpdate", handler);
        editor.off("focus", handler);
      };
    }, [editor]);

    // Push the remote-cursors list into the ProseMirror plugin state
    // via a setMeta transaction. Decorations rebuild whenever the
    // prop reference changes; ProseMirror handles position remapping
    // across intervening local edits.
    useEffect(() => {
      if (!editor) return;
      try {
        const tr = editor.view.state.tr.setMeta(remoteCursorsPluginKey, {
          cursors: (remoteCursors || []).filter((c) => Number.isFinite(c?.pmPos)),
        });
        editor.view.dispatch(tr);
      } catch { /* ignore — torn down */ }
    }, [editor, remoteCursors]);

    useEffect(() => {
      if (!editor) return;
      editor.setOptions({
        editorProps: {
          attributes: {
            class: `mdcore-rendered focus:outline-none ${narrowView ? "p-3 sm:p-6 mx-auto max-w-3xl" : "p-3 sm:p-6 max-w-none"}`,
            style: `cursor: ${canEdit ? "text" : "default"}; min-height: 100%;`,
          },
        },
      });
    }, [editor, narrowView, canEdit]);

    useImperativeHandle(ref, () => ({
      setMarkdown: (md: string) => {
        if (!editor) return;
        const { frontmatter: fm, body } = extractFrontmatter(md);
        frontmatterRef.current = fm;
        isSettingContent.current = true;
        // markdown-it renderer is patched (no <thead>/<tbody>)
        editor.commands.setContent(body || "<p></p>");
        isSettingContent.current = false;
        // Force a math rebuild on the frame after setContent — same
        // safety net as the initial mount path. The decoration
        // build that runs synchronously inside setContent uses the
        // post-transaction doc, but a follow-up paint with the
        // explicit meta is cheap insurance against any paint where
        // KaTeX widgets weren't yet wired in.
        requestAnimationFrame(() => {
          try {
            editor.view.dispatch(editor.view.state.tr.setMeta(MDFY_MATH_FORCE_META, true));
          } catch { /* editor may have been destroyed */ }
        });
      },
      getMarkdown: () => {
        if (!editor) return markdown;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyMd = (editor.storage as any).markdown?.getMarkdown?.() || "";
        return reattachFrontmatter(frontmatterRef.current, bodyMd);
      },
      focus: () => editor?.commands.focus(),
      getEditor: () => editor,
    }), [editor, markdown]);

    // Editor is mounted directly into containerRef via `element` option

    // ── Post-render: KaTeX math + Mermaid diagrams ──
    // Process the Tiptap DOM after every update to render math and mermaid
    const postProcessTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => {
      if (!editor) return;

      const processDOM = () => {
        // IMPORTANT: Do NOT modify ProseMirror-managed DOM directly.
        // Modifying text nodes (e.g. replacing with KaTeX) breaks ProseMirror's
        // internal state tracking, causing table cell editing and other
        // interactions to fail.
        // Math + Mermaid rendering should be done via custom NodeViews instead.
        // For now, skip DOM post-processing entirely.
        return;

        let dom: HTMLElement;
        try { dom = editor.view.dom; } catch { return; }
        if (!dom) return;

        // ── KaTeX: find $...$ and $$...$$ in text nodes ──
        // Process inline math: $...$
        // Process display math: $$...$$
        dom.querySelectorAll("p, li, blockquote, h1, h2, h3, h4, h5, h6").forEach((el) => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const textNodes: Text[] = [];
          let node: Text | null;
          while ((node = walker.nextNode() as Text | null)) {
            if (node.textContent?.includes("$")) textNodes.push(node);
          }
          for (const textNode of textNodes) {
            const text = textNode.textContent || "";
            // Skip if already processed (parent is .katex)
            if (textNode.parentElement?.classList.contains("katex") ||
                textNode.parentElement?.closest(".katex")) continue;

            // Display math: $$...$$
            const displayMatch = text.match(/\$\$([^$]+)\$\$/);
            if (displayMatch) {
              try {
                if (katex?.renderToString) {
                  const rendered = katex.renderToString(displayMatch[1].trim(), { displayMode: true, throwOnError: false, strict: false });
                  const wrapper = document.createElement("div");
                  wrapper.className = "katex-display";
                  wrapper.setAttribute("contenteditable", "false");
                  wrapper.innerHTML = rendered;
                  const before = text.slice(0, displayMatch.index!);
                  const after = text.slice(displayMatch.index! + displayMatch[0].length);
                  if (before) textNode.parentNode?.insertBefore(document.createTextNode(before), textNode);
                  textNode.parentNode?.insertBefore(wrapper, textNode);
                  if (after) textNode.parentNode?.insertBefore(document.createTextNode(after), textNode);
                  textNode.remove();
                }
              } catch { /* skip */ }
              continue;
            }

            // Inline math: $...$  (not $$)
            const inlineMatch = text.match(/(?<!\$)\$([^$\n]+)\$(?!\$)/);
            if (inlineMatch) {
              try {
                if (katex?.renderToString) {
                  const rendered = katex.renderToString(inlineMatch[1].trim(), { displayMode: false, throwOnError: false, strict: false });
                  const wrapper = document.createElement("span");
                  wrapper.className = "katex-inline";
                  wrapper.setAttribute("contenteditable", "false");
                  wrapper.innerHTML = rendered;
                  const before = text.slice(0, inlineMatch.index!);
                  const after = text.slice(inlineMatch.index! + inlineMatch[0].length);
                  if (before) textNode.parentNode?.insertBefore(document.createTextNode(before), textNode);
                  textNode.parentNode?.insertBefore(wrapper, textNode);
                  if (after) textNode.parentNode?.insertBefore(document.createTextNode(after), textNode);
                  textNode.remove();
                }
              } catch { /* skip */ }
            }
          }
        });

        // ── Mermaid: render code blocks with language "mermaid" ──
        dom.querySelectorAll('pre').forEach((pre) => {
          // CodeBlockLowlight uses data-language attribute
          const lang = pre.getAttribute("data-language") || pre.querySelector("code")?.className?.match(/language-(\w+)/)?.[1];
          if (lang !== "mermaid") return;
          // Skip if already rendered
          if (pre.querySelector(".mermaid-rendered")) return;
          if (pre.getAttribute("data-mermaid-processed")) return;
          pre.setAttribute("data-mermaid-processed", "1");

          const code = pre.textContent || "";
          if (!code.trim()) return;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mermaid = (window as any).mermaid;
          if (!mermaid) return;

          const mermaidId = `tiptap-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          mermaid.render(mermaidId, code).then(({ svg }: { svg: string }) => {
            const wrapper = document.createElement("div");
            wrapper.className = "mermaid-rendered";
            wrapper.setAttribute("contenteditable", "false");
            wrapper.innerHTML = svg;
            wrapper.style.cssText = "text-align:center;margin:0.5rem 0;";
            pre.style.display = "none";
            pre.parentNode?.insertBefore(wrapper, pre.nextSibling);
          }).catch(() => { /* mermaid parse error — leave as code block */ });
        });

        // ── Math double-click → edit modal ──
        dom.querySelectorAll(".katex-display, .katex-inline").forEach((el) => {
          if ((el as HTMLElement).dataset.mathClickBound) return;
          (el as HTMLElement).dataset.mathClickBound = "1";
          el.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Extract original LaTeX from the rendered element
            const annotation = el.querySelector("annotation");
            const tex = annotation?.textContent || el.textContent || "";
            const mode = el.classList.contains("katex-display") ? "display" : "inline";
            onDblClickMathRef.current?.(tex, mode as "inline" | "display");
          });
          (el as HTMLElement).style.cursor = "pointer";
        });

        // ── Image click → lightbox (MdEditor handles via previewRef) ──
        // Images in Tiptap are already clickable via Tiptap's Image extension
      };

      // Run on initial mount
      // Delay initial processDOM until editor is fully mounted
      setTimeout(processDOM, 500);

      // Run after every editor update (debounced)
      const handler = () => {
        if (postProcessTimerRef.current) clearTimeout(postProcessTimerRef.current);
        postProcessTimerRef.current = setTimeout(processDOM, 300);
      };
      editor.on("update", handler);

      return () => { editor.off("update", handler); };
    }, [editor]);

    // KaTeX CSS is imported globally via globals.css (@import "katex/dist/katex.min.css")

    // Load Mermaid JS if not already loaded + apply mdcore theme variables
    useEffect(() => {
      const isDark = () =>
        typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-theme") !== "light";

      const initMermaid = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = (window as any).mermaid;
        if (!m) return;
        const dark = isDark();
        m.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: dark ? "dark" : "default",
          // Mermaid renders to SVG and sets font-family as a presentation
          // attribute, so CSS var() doesn't resolve. Use a literal cascade
          // matching body font (Noto Sans + Pretendard for KR).
          fontFamily: "'Noto Sans', 'Pretendard Variable', 'Noto Sans KR', system-ui, sans-serif",
          fontSize: 14,
          flowchart: { padding: 16, nodeSpacing: 30, rankSpacing: 40, htmlLabels: true, curve: "basis" },
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
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).mermaid) {
        initMermaid();
      } else {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
        script.async = true;
        script.onload = initMermaid;
        document.head.appendChild(script);
      }

      // Re-initialize when theme toggles
      const obs = new MutationObserver(() => initMermaid());
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => obs.disconnect();
    }, []);

    return (
      <div className="flex-1 overflow-auto relative" style={{ background: "var(--canvas)" }}>
        {editor && canEdit && <SelectionToolbar editor={editor} />}
        {editor && canEdit && <TableMenu editor={editor} />}
        <div ref={containerRef} />
      </div>
    );
  }
);

export default TiptapLiveEditor;
