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
  | "yellow"
  | "gray"
  // Muted tones (v8 quiet-by-default direction). Picker groups
  // these under a "Muted" section so existing users don't lose
  // their saved vivid choice.
  | "sage"
  | "slate"
  | "sand"
  | "mauve"
  | "rose"
  | "iris";

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
  /** Picker group. Pickers render `vivid` first, then `muted`
   *  under a section header. */
  group: "vivid" | "muted";
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
  { name: "lime",   label: "Lime",   dark: "#B5FF1A", light: "#5BC700", group: "vivid" },
  { name: "orange", label: "Orange", dark: "#fb923c", light: "#ea580c", group: "vivid" },
  { name: "blue",   label: "Blue",   dark: "#60a5fa", light: "#2563eb", group: "vivid" },
  { name: "purple", label: "Purple", dark: "#a78bfa", light: "#7c3aed", group: "vivid" },
  { name: "pink",   label: "Pink",   dark: "#f472b6", light: "#ec4899", group: "vivid" },
  { name: "green",  label: "Green",  dark: "#4ade80", light: "#16a34a", group: "vivid" },
  { name: "teal",   label: "Teal",   dark: "#2dd4bf", light: "#0d9488", group: "vivid" },
  { name: "red",    label: "Red",    dark: "#f87171", light: "#dc2626", group: "vivid" },
  { name: "yellow", label: "Yellow", dark: "#fbbf24", light: "#d97706", group: "vivid" },
  // Neutral gray — accent essentially turned off. Useful when the
  // user wants a monochrome editor where links + blockquotes don't
  // pull the eye away from body text.
  { name: "gray",   label: "Gray",   dark: "#a1a1aa", light: "#52525b", group: "vivid" },
  // Muted set — desaturated tones around HSL 18-32% saturation,
  // 55-69% lightness on dark, matched darker on light. Reads as
  // "intentional colour" without competing with body text.
  { name: "sage",   label: "Sage",   dark: "#94B49F", light: "#5E8669", group: "muted" },
  { name: "slate",  label: "Slate",  dark: "#7C8DA8", light: "#536175", group: "muted" },
  { name: "sand",   label: "Sand",   dark: "#C7B299", light: "#8C7656", group: "muted" },
  { name: "mauve",  label: "Mauve",  dark: "#B193A6", light: "#7B5E72", group: "muted" },
  { name: "rose",   label: "Rose",   dark: "#C99595", light: "#965C5C", group: "muted" },
  { name: "iris",   label: "Iris",   dark: "#7E7FB0", light: "#52537A", group: "muted" },
];

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  // Default scheme — paired with lime (the app's root --accent). The
  // preview dot + desc previously claimed orange, which leaked into
  // the Key Color "Default (Lime)" row via SCHEME_ACCENT_MAP and
  // rendered orange swatches under a lime label.
  { name: "default",   label: "Default",   preview: "#B5FF1A", darkBg: "#18181b", lightBg: "#fafaf9", desc: "Warm zinc + lime" },
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
