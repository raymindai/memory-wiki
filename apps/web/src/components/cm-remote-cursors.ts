/**
 * CodeMirror 6 extension that renders remote collaborators'
 * cursors as colored carets with a name flag. Paired with
 * useCursorPresence — the caller passes the current cursor list
 * in via the setRemoteCursorsEffect StateEffect (we don't try to
 * subscribe to a React state from inside CM6 directly).
 *
 * Implementation: each remote cursor becomes a single CM6
 * Decoration.widget at the (line, col) mapped offset. The widget
 * is a small DOM element with a 2px-wide colored bar and a
 * floating name label above it. CSS animation fades the label
 * after 2 seconds of idle so it doesn't permanently obscure the
 * line under the cursor (Google Docs does the same).
 */

import { StateField, StateEffect, type Extension } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";

export interface RemoteCursorMark {
  userId: string;
  line: number;     // 0-indexed
  col: number;      // 0-indexed
  name: string;
  color: string;
}

export const setRemoteCursorsEffect = StateEffect.define<RemoteCursorMark[]>();

class CursorWidget extends WidgetType {
  constructor(
    private readonly userId: string,
    private readonly name: string,
    private readonly color: string,
  ) { super(); }

  // CM6 reuses widget DOM when eq() returns true — keeps the
  // label's fade animation from restarting on every keystroke.
  eq(other: WidgetType): boolean {
    return other instanceof CursorWidget
      && other.userId === this.userId
      && other.name === this.name
      && other.color === this.color;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-remote-cursor";
    wrap.style.position = "relative";
    wrap.style.display = "inline-block";
    wrap.style.width = "0";
    wrap.style.height = "1em";
    wrap.style.verticalAlign = "text-bottom";
    wrap.style.pointerEvents = "none";

    const bar = document.createElement("span");
    bar.style.position = "absolute";
    bar.style.top = "0";
    bar.style.bottom = "0";
    bar.style.left = "-1px";
    bar.style.width = "2px";
    bar.style.background = this.color;
    bar.style.borderRadius = "1px";
    wrap.appendChild(bar);

    const label = document.createElement("span");
    label.textContent = this.name || "Someone";
    label.style.position = "absolute";
    label.style.left = "0";
    label.style.top = "-1.4em";
    label.style.padding = "1px 5px";
    label.style.fontSize = "10px";
    label.style.fontFamily = "ui-monospace, monospace";
    label.style.lineHeight = "1.2";
    label.style.background = this.color;
    label.style.color = "#000";
    label.style.borderRadius = "3px";
    label.style.whiteSpace = "nowrap";
    label.style.fontWeight = "600";
    label.style.letterSpacing = "0.02em";
    // Fade out the name flag after a couple seconds so it doesn't
    // permanently obscure the line beneath the cursor.
    label.style.animation = "cm-remote-cursor-fade 2.8s ease-in-out forwards";
    wrap.appendChild(label);

    // Inject the keyframes once per page. Cheap idempotent guard.
    if (typeof document !== "undefined" && !document.getElementById("cm-remote-cursor-style")) {
      const style = document.createElement("style");
      style.id = "cm-remote-cursor-style";
      style.textContent = `@keyframes cm-remote-cursor-fade {
        0% { opacity: 1; }
        70% { opacity: 1; }
        100% { opacity: 0; }
      }
      .cm-remote-cursor:hover > span:last-child { opacity: 1 !important; animation: none; }`;
      document.head.appendChild(style);
    }
    return wrap;
  }

  ignoreEvent(): boolean { return true; }
}


export function remoteCursorsExtension(): Extension {
  const field = StateField.define<{ cursors: RemoteCursorMark[]; decorations: DecorationSet }>({
    create: () => ({ cursors: [], decorations: Decoration.none }),
    update: (value, tr) => {
      // Was a new cursor list pushed in via the effect?
      let cursorsNext: RemoteCursorMark[] | null = null;
      for (const e of tr.effects) {
        if (e.is(setRemoteCursorsEffect)) cursorsNext = e.value;
      }
      if (cursorsNext !== null) {
        const doc = tr.state.doc;
        const ranges = cursorsNext.map((c) => {
          const lineNum = Math.max(1, Math.min(c.line + 1, doc.lines));
          const lineInfo = doc.line(lineNum);
          const offset = lineInfo.from + Math.max(0, Math.min(c.col, lineInfo.length));
          return Decoration.widget({
            widget: new CursorWidget(c.userId, c.name, c.color),
            side: 1,
          }).range(offset);
        });
        ranges.sort((a, b) => a.from - b.from);
        return { cursors: cursorsNext, decorations: Decoration.set(ranges, true) };
      }
      if (tr.docChanged) {
        // Doc edited locally; keep cursors stable by mapping their
        // decoration positions through the change set instead of
        // recomputing from (line, col) — which would race the
        // local change against a stale remote position.
        return { cursors: value.cursors, decorations: value.decorations.map(tr.changes) };
      }
      return value;
    },
    provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
  });
  return [field];
}

/** Push the current cursor list into a live editor. */
export function applyRemoteCursors(view: EditorView | null, cursors: RemoteCursorMark[]): void {
  if (!view) return;
  view.dispatch({ effects: setRemoteCursorsEffect.of(cursors) });
}
