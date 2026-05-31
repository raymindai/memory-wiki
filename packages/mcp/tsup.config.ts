import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  // .d.ts generation disabled: tsup's rollup-plugin-dts worker
  // OOM-crashes on this file's size + complex zod-inferred types
  // (Node 25 + tsup 8.5). MCP servers are runtime executables for
  // AI agents, not TS libraries consumed by other TS code, so the
  // declaration files aren't part of the publish contract. Flip
  // back on if/when we split tools across files and shrink each.
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
