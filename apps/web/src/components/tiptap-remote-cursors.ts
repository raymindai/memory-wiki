/**
 * Remote-cursor plugin for Tiptap (Live tab).
 *
 * Pairs with useCursorPresence — that hook delivers an array of
 * remote cursors carrying ProseMirror positions (`pmPos`). Both
 * peers' PM docs are constructed from the same markdown via the
 * same tiptap-markdown parser, so PM positions converge across
 * clients without needing y-prosemirror.
 *
 * The CM6 side (Source pane) uses (line, col) coordinates against
 * the markdown string. The two payload shapes ride the same Realtime
 * channel — broadcastCursor takes both — so a peer in Live can be
 * seen by peers in Source via shared markdown, and vice versa once
 * the offset bridge is wired (not required for in-Live↔in-Live).
 */
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface TiptapRemoteCursor {
  userId: string;
  pmPos: number;
  name: string;
  color: string;
}

export const remoteCursorsPluginKey = new PluginKey<DecorationSet>("mwRemoteCursors");

function buildCaret(cursor: TiptapRemoteCursor): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "mw-remote-caret";
  wrap.style.cssText = [
    "position: relative",
    "display: inline-block",
    "width: 0",
    "height: 1em",
    "vertical-align: text-bottom",
    "pointer-events: none",
    "user-select: none",
  ].join(";");

  const bar = document.createElement("span");
  bar.style.cssText = [
    "position: absolute",
    "left: -1px",
    "top: 0",
    "bottom: 0",
    "width: 2px",
    `background: ${cursor.color}`,
    "border-radius: 1px",
    "animation: mwRemoteCaretBlink 1100ms steps(2, end) infinite",
  ].join(";");

  const label = document.createElement("span");
  label.textContent = cursor.name || "guest";
  label.style.cssText = [
    "position: absolute",
    "left: -1px",
    "bottom: 100%",
    "transform: translateY(2px)",
    "padding: 1px 6px",
    `background: ${cursor.color}`,
    "color: #000",
    "font-size: 10px",
    "line-height: 1.4",
    "font-weight: 600",
    "white-space: nowrap",
    "border-radius: 4px 4px 4px 0",
    "opacity: 0.92",
  ].join(";");

  wrap.appendChild(bar);
  wrap.appendChild(label);
  return wrap;
}

export function remoteCursorsPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: remoteCursorsPluginKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, oldSet) {
        const meta = tr.getMeta(remoteCursorsPluginKey) as
          | { cursors: TiptapRemoteCursor[] }
          | undefined;
        if (meta) {
          const docSize = tr.doc.content.size;
          const decorations = meta.cursors
            .filter((c) => Number.isFinite(c.pmPos) && c.pmPos >= 0 && c.pmPos <= docSize)
            .map((c) => Decoration.widget(c.pmPos, () => buildCaret(c), { side: 1, key: c.userId }));
          return DecorationSet.create(tr.doc, decorations);
        }
        return oldSet.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

export function setRemoteCursors(view: { dispatch: (tr: unknown) => void; state: { tr: unknown } }, cursors: TiptapRemoteCursor[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tr = (view.state.tr as any).setMeta(remoteCursorsPluginKey, { cursors });
  view.dispatch(tr);
}
