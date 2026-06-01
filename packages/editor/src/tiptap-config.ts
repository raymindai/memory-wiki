// Canonical TipTap editor configuration for memory.wiki.
//
// Web (apps/web/src/components/TiptapLiveEditor.tsx) is the source of
// truth. This module will export a `buildExtensions(opts)` factory so
// desktop (apps/desktop/renderer/editor.js) and vscode-extension
// (apps/vscode-extension/media/preview.js) can mount the same
// extension list without React.
//
// Extraction status: STUB. The next iteration of Phase A ports the
// extension array from TiptapLiveEditor.tsx L1234-L1271, plus the
// CustomCodeBlock NodeView (TiptapLiveEditor.tsx L64-~250) and the
// MathExtension (TiptapLiveEditor.tsx L656+) into vanilla TS that
// runs in any DOM (Next.js, Electron renderer, VSCode webview).

export interface BuildExtensionsOpts {
  /** Whether the editor is editable (false = viewer-only). */
  canEdit?: boolean;
  /** Placeholder text shown in empty paragraphs (e.g. "Start writing..."). */
  placeholder?: string;
  /**
   * Lowlight instance (created by consumer with the language set it
   * wants — web uses `common`, narrow channels may register fewer).
   */
  lowlight?: unknown;
  /**
   * Callback fired when a Mermaid code block is double-clicked. Web
   * uses this to open the canvas modal; desktop opens a popout.
   */
  onDoubleClickMermaid?: (code: string) => void;
  /**
   * If provided, mount a remote-cursors ProseMirror plugin that reads
   * cursor state from the given source. Pass `null` to disable.
   */
  remoteCursorsSource?: unknown;
}

/**
 * Returns the array of TipTap extensions that match web's editor.
 *
 * STUB until extraction is complete. Throws to surface the gap.
 */
export function buildExtensions(_opts: BuildExtensionsOpts = []): unknown[] {
  throw new Error(
    "[@mdcore/editor/tiptap-config] buildExtensions() not yet implemented. " +
    "Extraction from apps/web/src/components/TiptapLiveEditor.tsx is the next Phase A iteration."
  );
}
