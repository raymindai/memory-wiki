// Theme + accent option catalogues. Single source of truth so the
// editor toolbar's profile menu and the Settings surface stay in
// sync — each list previously lived inside MdEditor and was
// effectively private to it, so adding a settings UI required
// duplicating the arrays.
//
// The accent half (AccentColor type, ACCENT_COLORS catalogue,
// ACCENT_KEYS whitelist) is now GENERATED from
// design-tokens/accent-palette.json — see `_accent.generated.ts`.
// This file just re-exports so existing import sites
// (SettingsEmbed.tsx, MdEditor.tsx) keep working unchanged.
// ColorScheme + SCHEME_ACCENT_MAP still live here because schemes
// are a smaller, web-only catalog with its own metadata shape.

export {
  type AccentColor,
  type AccentGroup,
  type AccentColorOption,
  ACCENT_COLORS,
  ACCENT_KEYS,
} from "./_accent.generated";

import type { AccentColor } from "./_accent.generated";

export type ColorScheme =
  | "default"
  | "nord"
  | "dracula"
  | "solarized"
  | "monokai"
  | "onedark"
  | "paper"
  | "ocean";

export interface ColorSchemeOption {
  name: ColorScheme;
  label: string;
  /** Single preview swatch — the scheme's signature hue. */
  preview: string;
  /** Background tone the scheme uses in dark mode (for the dual swatch). */
  darkBg: string;
  /** Background tone the scheme uses in light mode (for the dual swatch). */
  lightBg: string;
  desc: string;
}

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  // Default scheme's natural accent is the ink token (dark: #fafafa,
  // light: #18181b — see _tokens.{dark,light}.generated.css). The lime
  // preview + "Warm zinc + lime" desc were a leftover from an earlier
  // build when the root --accent really was lime; they made the
  // Settings Key Color row claim "Default (Lime)" while the rendered
  // accent was actually monochrome. Zinc-500 reads on both bgs.
  { name: "default",   label: "Default",   preview: "#71717a", darkBg: "#18181b", lightBg: "#fafaf9", desc: "Warm zinc + ink" },
  { name: "nord",      label: "Nord",      preview: "#88c0d0", darkBg: "#2e3440", lightBg: "#eceff4", desc: "Arctic frost" },
  { name: "dracula",   label: "Dracula",   preview: "#bd93f9", darkBg: "#282a36", lightBg: "#f8f8f2", desc: "Dark purple" },
  { name: "solarized", label: "Solarized", preview: "#2aa198", darkBg: "#002b36", lightBg: "#fdf6e3", desc: "Warm teal" },
  { name: "monokai",   label: "Monokai",   preview: "#ffd866", darkBg: "#272822", lightBg: "#fafafa", desc: "Warm gold" },
  { name: "onedark",   label: "One Dark",  preview: "#61afef", darkBg: "#282c34", lightBg: "#fafafa", desc: "Cool blue" },
  { name: "paper",     label: "Paper",     preview: "#d4a373", darkBg: "#1c1917", lightBg: "#f5f1e8", desc: "Warm sepia" },
  { name: "ocean",     label: "Ocean",     preview: "#06b6d4", darkBg: "#0f172a", lightBg: "#f0f9ff", desc: "Deep sea" },
];

/** Each scheme's natural accent color — used when toggling a scheme
 *  to pick a sensible accent unless the user has already overridden it.
 *  Default → lime (matches CSS :root --accent and the "Default (Lime)"
 *  row label in Settings). */
export const SCHEME_ACCENT_MAP: Record<ColorScheme, AccentColor> = {
  default: "lime",
  nord: "teal",
  dracula: "purple",
  solarized: "teal",
  monokai: "yellow",
  onedark: "blue",
  paper: "orange",
  ocean: "teal",
};
