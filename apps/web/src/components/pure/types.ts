/**
 * Shared Pure design-system types and helpers.
 *
 * Every component file imports the types it needs from here. Keeps
 * cross-component contracts (color palette, theme, provider brand,
 * micro-color → CSS var helper) in a single canonical place.
 */

/** Theme mode driven by <PureShell>. */
export type PureTheme = "dark" | "light";

/** Micro-color palette — small accents only (bullets, status dots,
 *  step numbers, badges). Body/buttons/chips stay ink. */
export type PureMicroColor = "lime" | "info" | "orange" | "warn" | "ai" | "pink";

/** Resolve a PureMicroColor to its CSS custom-property reference. */
export const microVar = (c: PureMicroColor) => `var(--micro-${c})`;

/** Brand identifiers for ProviderIcon and provider chips. */
export type ProviderBrand =
  | "claude" | "chatgpt" | "gemini" | "cursor" | "codex" | "copilot"
  | "chrome" | "safari" | "vscode" | "mac" | "ios" | "android"
  | "cli" | "mcp" | "browser" | "terminal" | "finder";
