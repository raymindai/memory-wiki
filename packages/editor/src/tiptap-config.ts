// @ts-nocheck
// Canonical TipTap configuration for memory.wiki — vanilla TS module
// that runs in any DOM environment (Next.js, Electron renderer, VS
// Code webview). Web (apps/web/src/components/TiptapLiveEditor.tsx)
// is the source of truth; this module lifts the engine-relevant
// pieces (extension list, MathExtension, simplified CustomCodeBlock)
// and removes React coupling.
//
// What is here:
//   - createMathExtension()       — KaTeX inline + display widgets via
//                                    ProseMirror decoration plugin
//   - createCodeBlockExtension()  — lang label + copy button +
//                                    optional double-click mermaid hook
//   - buildExtensions(opts)       — full extension array web mounts
//
// What is NOT here (intentional — channel-specific):
//   - SelectionToolbar (web's React component)
//   - AI conversion overlay (web's API-coupled NodeView feature)
//   - ASCII convert dropdown (web NodeView only for now)
//   - Remote-cursors plugin (collab — pass via opts.extraExtensions
//                            when the channel wires Yjs)
//
// Each channel mounts buildExtensions() then adds its own
// channel-specific extensions / toolbars on top.

import { Editor, Extension } from "@tiptap/core";
// Re-export Editor + Extension so UMD consumers (Desktop renderer,
// VSCode webview) can construct the editor without separately
// loading @tiptap/core. tsup's iife bundle attaches every named
// export onto the globalName object.
export { Editor, Extension };
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
import { common, createLowlight } from "lowlight";
import katex from "katex";

// Re-export the Mermaid initializer so the UMD build attaches it to
// the same globalName (MemoryWikiEditor) and the channel-side mount
// scripts can just call window.MemoryWikiEditor.initMermaid() right
// after the editor mounts. Web doesn't use this re-export — it
// imports from "@mdcore/editor/mermaid-init" directly.
export { initMermaid } from "./mermaid-init";
export type { InitMermaidOptions, MermaidHandle } from "./mermaid-init";

// ─── Lowlight (syntax highlighting registry) ───
// Web aliases `tex`/`bibtex` to `latex` so AI-generated code blocks
// that use those language names don't crash lowlight. Same here.
export function createLowlightInstance(): ReturnType<typeof createLowlight> {
  const lowlight = createLowlight(common);
  try {
    if (lowlight.registered("latex")) {
      if (!lowlight.registered("tex")) lowlight.registerAlias("latex", "tex");
      if (!lowlight.registered("bibtex")) lowlight.registerAlias("latex", "bibtex");
    }
  } catch { /* ignore — alias APIs occasionally change between lowlight versions */ }
  return lowlight;
}

// ─── KaTeX math plugin ───
// Matches web's createMathPlugin verbatim — decorates raw $...$ and
// $$...$$ text with KaTeX-rendered widget decorations so the editor
// shows live math while the markdown source stays untouched.
const MATH_FORCE_META = "mwMathForceRebuild";

function createMathPlugin(): Plugin {
  const key = new PluginKey("mw-math");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildDecorations = (doc: any): DecorationSet => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decos: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc.descendants((node: any, pos: number) => {
      if (!node.isText || !node.text) return;
      const text: string = node.text;
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
          widget.innerHTML = katex.renderToString(m[1].trim(), {
            displayMode: true,
            throwOnError: false,
            strict: false,
          });
        } catch {
          widget.textContent = m[0];
        }
        decos.push(Decoration.widget(to, widget, { side: 1, ignoreSelection: true } as never));
        decos.push(Decoration.inline(from, to, { class: "tiptap-math-source" }));
      }
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
          widget.innerHTML = katex.renderToString(m[1].trim(), {
            displayMode: false,
            throwOnError: false,
            strict: false,
          });
        } catch {
          widget.textContent = m[0];
        }
        decos.push(Decoration.widget(to, widget, { side: 1, ignoreSelection: true } as never));
        decos.push(Decoration.inline(from, to, { class: "tiptap-math-source" }));
      }
    });
    return DecorationSet.create(doc, decos);
  };
  return new Plugin({
    key,
    state: {
      init: (_, { doc }) => buildDecorations(doc),
      apply: (tr, old) => {
        if (tr.docChanged) return buildDecorations(tr.doc);
        if (tr.getMeta(MATH_FORCE_META)) return buildDecorations(tr.doc);
        return old;
      },
    },
    props: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      decorations(state: any) {
        return (this as any).getState(state);
      },
    },
  });
}

export function createMathExtension(): Extension {
  return Extension.create({
    name: "mwMath",
    addProseMirrorPlugins() {
      return [createMathPlugin()];
    },
  });
}

// ─── CodeBlock with lang label + copy button + optional mermaid hook ───
// Simplified vs web's CustomCodeBlock — drops ASCII conversion menu
// and AI conversion overlay (those are web-only NodeView features
// that web continues to layer on top of this base). Channels that
// want them can extend further; channels that just want a code block
// that reads like web get this for free.
//
// Options:
//   lowlight             — required, pass createLowlightInstance()
//   defaultLanguage      — first-row default (null = "text")
//   onDoubleClickMermaid — fires when user double-clicks a fenced
//                          mermaid block; web opens a canvas modal,
//                          desktop opens a popout, etc.

export interface CreateCodeBlockOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lowlight: any;
  defaultLanguage?: string | null;
  onDoubleClickMermaid?: (code: string) => void;
}

export function createCodeBlockExtension(opts: CreateCodeBlockOpts): ReturnType<typeof CodeBlockLowlight.extend> {
  return CodeBlockLowlight.extend({
    addNodeView() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (props: any) => {
        try {
          return buildSimpleCodeBlockNodeView(props, opts);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[@mdcore/editor CustomCodeBlock] NodeView error:", err);
          // Fallback so the user sees content even if NodeView throws.
          const wrapper = document.createElement("div");
          wrapper.className = "tiptap-codeblock-wrapper";
          const pre = document.createElement("pre");
          const code = document.createElement("code");
          pre.appendChild(code);
          wrapper.appendChild(pre);
          return { dom: wrapper, contentDOM: code };
        }
      };
    },
  }).configure({
    lowlight: opts.lowlight,
    defaultLanguage: opts.defaultLanguage ?? null,
  });
}

// Polished CodeBlock NodeView — matches web's CustomCodeBlock
// (apps/web/src/components/TiptapLiveEditor.tsx L65-586) for header
// chrome + line-number gutter + inline Mermaid rendering + the
// ignoreMutation/update lifecycle that keeps decorations stable when
// ProseMirror diffs the doc.
//
// What's intentionally missing vs web:
//   - ASCII detect dropdown ("Convert ▾" → Table/List/Paragraph/Mermaid).
//     The Mermaid branch hits /api/ascii-to-mermaid which only resolves
//     on web; the others are pure-text transforms but the dropdown
//     UI is interlocked with the AI conversion overlay, so we ship
//     all-or-nothing and leave the TODO below.
//   - AI conversion overlay (spinner / status messages). Same coupling.
//
// TODO(@mdcore/editor): port ASCII conversion menu when
// /api/ascii-to-mermaid is reachable from non-web channels (probably
// via the auth-token path Desktop + VS Code already use for /api/ai).

function buildSimpleCodeBlockNodeView(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { node, HTMLAttributes }: { node: any; HTMLAttributes?: Record<string, unknown> },
  opts: CreateCodeBlockOpts
): {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ignoreMutation: (mutation: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (updatedNode: any) => boolean;
} {
  // `node` is captured per NodeView and refreshed in update() below
  // so the inner handlers (copyBtn, gutter rebuild, mermaid render)
  // always see the latest textContent without us having to reach
  // back through editor.state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentNode: any = node;
  const lang = String(currentNode.attrs.language || "").toLowerCase();

  const wrapper = document.createElement("div");
  wrapper.className = "tiptap-codeblock-wrapper";
  wrapper.setAttribute("data-language", lang);

  // ─── Header: lang label + copy button ───
  const header = document.createElement("div");
  header.className = "tiptap-codeblock-header";
  header.contentEditable = "false";

  const langLabel = document.createElement("span");
  langLabel.className = "tiptap-codeblock-lang";
  langLabel.textContent = lang || "text";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "tiptap-codeblock-copy";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = currentNode.textContent || "";
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          copyBtn.textContent = "Copied";
          setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
        },
        () => {
          copyBtn.textContent = "Copy failed";
          setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
        }
      );
    }
  });

  header.appendChild(langLabel);
  header.appendChild(copyBtn);
  wrapper.appendChild(header);

  // ─── Body: gutter + <pre><code> ───
  const body = document.createElement("div");
  body.className = "tiptap-codeblock-body";

  const gutter = document.createElement("div");
  gutter.className = "tiptap-codeblock-gutter";
  gutter.contentEditable = "false";

  const pre = document.createElement("pre");
  if (HTMLAttributes && typeof HTMLAttributes === "object") {
    for (const [k, v] of Object.entries(HTMLAttributes)) {
      try {
        pre.setAttribute(k, String(v));
      } catch {
        /* invalid attr name from upstream — skip */
      }
    }
  }
  const code = document.createElement("code");
  if (lang) code.className = `language-${lang}`;
  pre.appendChild(code);

  body.appendChild(gutter);
  body.appendChild(pre);
  wrapper.appendChild(body);

  // Rebuild the gutter only when the line count changes — the most
  // common edit (typing inside a line) doesn't touch it.
  const renderGutter = (): void => {
    const text = currentNode.textContent || "";
    const lines = Math.max(1, text.split("\n").length);
    if (gutter.childElementCount === lines) return;
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

  // ─── Mermaid inline render ───
  // Mounts a sibling .tiptap-mermaid-render container under the
  // wrapper and polls for window.mermaid (loaded by the channel
  // either via vendor-editor/mermaid.min.js or via initMermaid()
  // injecting the CDN). 40 attempts × 150 ms = 6 s timeout.
  //
  // Token-tracking pattern (renderToken / myToken): if the user
  // edits the mermaid source while a previous render is still in
  // flight, only the latest render writes to the DOM. Without
  // this, a slow first render could overwrite a fresh one and the
  // diagram would appear stale.
  let mermaidContainer: HTMLDivElement | null = null;
  let renderToken = 0;
  const ensureMermaidContainer = (): void => {
    if (!mermaidContainer) {
      mermaidContainer = document.createElement("div");
      mermaidContainer.className = "tiptap-mermaid-render";
      mermaidContainer.contentEditable = "false";
      wrapper.appendChild(mermaidContainer);
    }
  };
  const renderMermaid = (): void => {
    const src = (currentNode.textContent || "").trim();
    if (!src) return;
    ensureMermaidContainer();
    const myToken = ++renderToken;
    const tryRender = (attempt = 0): void => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        Promise.resolve(result)
          .then((r: unknown) => {
            if (myToken !== renderToken) return; // stale render — drop
            const svg =
              typeof r === "string"
                ? r
                : (r as { svg?: string } | null)?.svg || "";
            if (mermaidContainer) mermaidContainer.innerHTML = svg;
          })
          .catch((err: unknown) => {
            if (myToken !== renderToken) return;
            if (mermaidContainer)
              mermaidContainer.innerHTML = `<div style="color:var(--text-primary);font-size:11px;padding:8px;white-space:pre-wrap;">Mermaid error: ${String(
                (err as Error)?.message || err
              )}</div>`;
          });
      } catch (err) {
        if (mermaidContainer)
          mermaidContainer.innerHTML = `<div style="color:var(--text-primary);font-size:11px;padding:8px;white-space:pre-wrap;">Mermaid error: ${String(
            (err as Error)?.message || err
          )}</div>`;
      }
    };
    tryRender();
  };

  if (lang === "mermaid") {
    // Hide the editable <pre> body while rendering the SVG —
    // double-click is the way back into the source (channel hook
    // below opens a canvas modal / popout / temp editor).
    body.style.display = "none";
    renderMermaid();
  }

  // Mermaid double-click → channel hook. Web opens a canvas modal,
  // Desktop a popout, VS Code a temp editor with onDidSave wiring.
  if (lang === "mermaid" && opts.onDoubleClickMermaid) {
    wrapper.addEventListener("dblclick", () => {
      const text = currentNode.textContent || "";
      if (text) opts.onDoubleClickMermaid?.(text);
    });
  }

  // ─── NodeView lifecycle ───
  // ignoreMutation tells ProseMirror to NOT reparse our wrapper when
  // we mutate the gutter / header / mermaid container — those are
  // contentEditable=false satellites, not part of the document. Web
  // hit this exact bug pre-2026-04: every gutter rebuild caused PM
  // to reparse + destroy + re-mount the NodeView, which made the
  // line numbers visibly flicker.
  //
  // update() returns false when the node TYPE changes (forces a
  // fresh NodeView), returns false on lang change (re-mount so the
  // mermaid branch flips correctly), otherwise refreshes our
  // captured `currentNode` reference, re-renders the gutter, and
  // debounce-rebuilds the mermaid SVG so typing inside the fenced
  // block doesn't spam mermaid.render().
  let mermaidUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    dom: wrapper,
    contentDOM: code,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ignoreMutation(mutation: any): boolean {
      if (mutation?.type === "selection") return false;
      // Any mutation outside contentDOM (our `code` element) is ours
      // — gutter rebuild, header copy state, mermaid svg swap.
      if (!code.contains(mutation?.target as Node)) return true;
      return false;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(updatedNode: any): boolean {
      if (updatedNode.type.name !== currentNode.type.name) return false;
      const newLang = String(updatedNode.attrs.language || "").toLowerCase();
      if (newLang !== lang) return false; // re-mount on language change
      currentNode = updatedNode;
      if (newLang === "mermaid") {
        if (mermaidUpdateTimer) clearTimeout(mermaidUpdateTimer);
        mermaidUpdateTimer = setTimeout(renderMermaid, 400);
      } else {
        renderGutter();
      }
      return true;
    },
  };
}

// ─── Extension array ─── matches TiptapLiveEditor.tsx L1234-L1271
// without the React-coupled remoteCursorsPlugin (that one is opt-in
// via opts.extraExtensions because only collab-enabled channels need
// it, and the cursor source differs per channel).

export interface BuildExtensionsOpts {
  /** Placeholder text shown in empty paragraphs. */
  placeholder?: string;
  /** Mermaid double-click handler (open canvas modal in web, popout in desktop). */
  onDoubleClickMermaid?: (code: string) => void;
  /**
   * Extra TipTap extensions to append after the base set. Use for
   * channel-specific features like remote cursors, collaborative
   * caret tracking, slash menus, etc.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraExtensions?: any[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildExtensions(opts: BuildExtensionsOpts = {}): any[] {
  const lowlight = createLowlightInstance();
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight variant
      link: false, // replaced by TiptapLink with custom config
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    createCodeBlockExtension({
      lowlight,
      defaultLanguage: null,
      onDoubleClickMermaid: opts.onDoubleClickMermaid,
    }),
    createMathExtension(),
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
    Placeholder.configure({ placeholder: opts.placeholder ?? "Start writing..." }),
    TiptapMarkdown.configure({
      html: true,
      transformPastedText: false,
      transformCopiedText: true,
    }),
    ...(opts.extraExtensions ?? []),
  ];
}
