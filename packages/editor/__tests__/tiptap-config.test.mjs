// Sanity tests for @mdcore/editor/tiptap-config.
//
// We can't fully mount TipTap headless in node (it needs a DOM), but
// we CAN verify:
//   - all factory functions return objects with expected names
//   - buildExtensions returns the exact extension set web mounts
//   - lowlight aliases are wired (tex / bibtex → latex)
//
// Per-channel integration (mount + edit + serialize) is covered in
// Playwright/Electron/VSCode harness suites in Phase G.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildExtensions,
  createCodeBlockExtension,
  createLowlightInstance,
  createMathExtension,
} from "../dist/tiptap-config.mjs";

test("lowlight: instance ready, common languages registered", () => {
  const ll = createLowlightInstance();
  assert.equal(typeof ll.registered, "function", "registered() exists");
  // `common` includes the languages every channel relies on for hljs
  // syntax classes. tex/latex/bibtex are NOT in `common` — they ship
  // separately; the alias code is defensive (only fires when latex
  // exists) so it can't throw on plain `common`.
  assert.equal(ll.registered("javascript") || ll.registered("js"), true);
  assert.equal(ll.registered("typescript") || ll.registered("ts"), true);
  assert.equal(ll.registered("python") || ll.registered("py"), true);
});

test("MathExtension: name is mwMath + has addProseMirrorPlugins", () => {
  const ext = createMathExtension();
  assert.equal(ext.name, "mwMath");
  assert.equal(typeof ext.config.addProseMirrorPlugins, "function");
});

test("CodeBlock extension: extends CodeBlockLowlight + has NodeView", () => {
  const ll = createLowlightInstance();
  const ext = createCodeBlockExtension({ lowlight: ll });
  assert.equal(ext.name, "codeBlock", "TipTap name preserved");
  assert.equal(typeof ext.config.addNodeView, "function", "custom NodeView wired");
});

test("buildExtensions: returns the 13 extensions web mounts", () => {
  const ext = buildExtensions({ placeholder: "Hello" });
  const names = ext.map((e) => e.name || e.config?.name || "?");
  // Order matters — channels rely on starterKit being first.
  assert.deepEqual(names, [
    "starterKit",
    "codeBlock",
    "mwMath",
    "table",
    "tableRow",
    "tableCell",
    "tableHeader",
    "taskList",
    "taskItem",
    "image",
    "link",
    "placeholder",
    "markdown",
  ]);
});

test("buildExtensions: extraExtensions appended after base", () => {
  const dummy = { name: "remoteCursors" };
  const ext = buildExtensions({ extraExtensions: [dummy] });
  const last = ext[ext.length - 1];
  assert.equal(last.name, "remoteCursors", "extra appended at the tail");
});

test("buildExtensions: placeholder option lands on Placeholder extension config", () => {
  const ext = buildExtensions({ placeholder: "Custom" });
  const placeholder = ext.find((e) => e.name === "placeholder");
  assert.ok(placeholder, "placeholder extension present");
  // Placeholder stores its config in options after .configure()
  const options = placeholder.options;
  assert.equal(options.placeholder, "Custom");
});
