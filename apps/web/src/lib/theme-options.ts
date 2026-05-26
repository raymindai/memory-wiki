// Theme + accent option catalogues. Single source of truth so the
// editor toolbar's profile menu and the Settings surface stay in
// sync — each list previously lived inside MdEditor and was
// effectively private to it, so adding a settings UI required
// duplicating the arrays.

export type AccentColor =
  | "lime"
  | "orange"
  | "blue"
  | "purple"
  | "pink"
  | "green"
  | "teal"
  | "red"
  | "yellow";

export type ColorScheme =
  | "default"
  | "nord"
  | "dracula"
  | "solarized"
  | "monokai"
  | "onedark"
  | "paper"
  | "ocean";

export interface AccentColorOption {
  name: AccentColor;
  label: string;
  /** Color used when the doc/app is in dark mode. */
  dark: string;
  /** Color used when the doc/app is in light mode. */
  light: string;
}

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

export const ACCENT_COLORS: AccentColorOption[] = [
  // Lime first — new app default (replaces orange as the accent that
  // drives editor links / blockquotes / task-list checks).
  { name: "lime",   label: "Lime",   dark: "#B5FF1A", light: "#5BC700" },
  { name: "orange", label: "Orange", dark: "#fb923c", light: "#ea580c" },
  { name: "blue",   label: "Blue",   dark: "#60a5fa", light: "#2563eb" },
  { name: "purple", label: "Purple", dark: "#a78bfa", light: "#7c3aed" },
  { name: "pink",   label: "Pink",   dark: "#f472b6", light: "#ec4899" },
  { name: "green",  label: "Green",  dark: "#4ade80", light: "#16a34a" },
  { name: "teal",   label: "Teal",   dark: "#2dd4bf", light: "#0d9488" },
  { name: "red",    label: "Red",    dark: "#f87171", light: "#dc2626" },
  { name: "yellow", label: "Yellow", dark: "#fbbf24", light: "#d97706" },
];

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  { name: "default",   label: "Default",   preview: "#fb923c", darkBg: "#18181b", lightBg: "#fafaf9", desc: "Warm zinc + orange" },
  { name: "nord",      label: "Nord",      preview: "#88c0d0", darkBg: "#2e3440", lightBg: "#eceff4", desc: "Arctic frost" },
  { name: "dracula",   label: "Dracula",   preview: "#bd93f9", darkBg: "#282a36", lightBg: "#f8f8f2", desc: "Dark purple" },
  { name: "solarized", label: "Solarized", preview: "#2aa198", darkBg: "#002b36", lightBg: "#fdf6e3", desc: "Warm teal" },
  { name: "monokai",   label: "Monokai",   preview: "#ffd866", darkBg: "#272822", lightBg: "#fafafa", desc: "Warm gold" },
  { name: "onedark",   label: "One Dark",  preview: "#61afef", darkBg: "#282c34", lightBg: "#fafafa", desc: "Cool blue" },
  { name: "paper",     label: "Paper",     preview: "#d4a373", darkBg: "#1c1917", lightBg: "#f5f1e8", desc: "Warm sepia" },
  { name: "ocean",     label: "Ocean",     preview: "#06b6d4", darkBg: "#0f172a", lightBg: "#f0f9ff", desc: "Deep sea" },
];

/** Each scheme's natural accent color — used when toggling a scheme
 *  to pick a sensible accent unless the user has already overridden it. */
export const SCHEME_ACCENT_MAP: Record<ColorScheme, AccentColor> = {
  default: "orange",
  nord: "teal",
  dracula: "purple",
  solarized: "teal",
  monokai: "yellow",
  onedark: "blue",
  paper: "orange",
  ocean: "teal",
};
