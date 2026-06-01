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

function buildSimpleCodeBlockNodeView(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { node }: { node: any },
  opts: CreateCodeBlockOpts
): { dom: HTMLElement; contentDOM: HTMLElement } {
  const lang = String(node.attrs.language || "").toLowerCase();
  const wrapper = document.createElement("div");
  wrapper.className = "tiptap-codeblock-wrapper";
  wrapper.setAttribute("data-language", lang);

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
  copyBtn.addEventListener("click", () => {
    const text = node.textContent || "";
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          copyBtn.textContent = "Copied";
          setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
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

  const pre = document.createElement("pre");
  pre.className = "tiptap-codeblock-pre";
  const code = document.createElement("code");
  code.className = lang ? `language-${lang}` : "";
  pre.appendChild(code);

  wrapper.appendChild(header);
  wrapper.appendChild(pre);

  // Mermaid double-click → channel hook (open canvas modal etc.)
  if (lang === "mermaid" && opts.onDoubleClickMermaid) {
    wrapper.addEventListener("dblclick", () => {
      const text = node.textContent || "";
      if (text) opts.onDoubleClickMermaid?.(text);
    });
  }

  return { dom: wrapper, contentDOM: code };
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
