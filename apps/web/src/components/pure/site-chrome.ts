/**
 * Default nav links + footer columns for marketing/legal/utility pages
 * that don't need their own page-local content file. About / Manifesto
 * / Spec own their own copies so they can localize.
 */

import type { ComponentProps } from "react";
import type { PureNav, PureFooter } from "./index";

type NavLinks = NonNullable<ComponentProps<typeof PureNav>["links"]>;
type FooterColumns = NonNullable<ComponentProps<typeof PureFooter>["columns"]>;
type FooterParent = NonNullable<ComponentProps<typeof PureFooter>["parent"]>;

export const SITE_NAV_EN: NavLinks = [
  { label: "About",    href: "/about" },
  { label: "Plugins",  href: "/plugins" },
  { label: "Docs",     href: "/docs" },
];

export const SITE_NAV_MORE_EN: NavLinks = [
  { label: "How it works",   href: "/how" },
  { label: "Benchmark/Eval", href: "/benchmark" },
  { label: "Use cases",      href: "/cases" },
  { label: "Spec",           href: "/spec" },
  { label: "Install",        href: "/install" },
  { label: "Manifesto",      href: "/manifesto" },
];

export const SITE_NAV_KO: NavLinks = [
  { label: "소개",    href: "/ko/about" },
  { label: "플러그인", href: "/ko/plugins" },
  { label: "문서",     href: "/ko/docs" },
];

export const SITE_NAV_MORE_KO: NavLinks = [
  { label: "동작 원리",   href: "/ko/how" },
  { label: "벤치마크/Eval", href: "/ko/benchmark" },
  { label: "사용 사례",   href: "/ko/cases" },
  { label: "스펙",        href: "/ko/spec" },
  { label: "설치",        href: "/ko/install" },
  { label: "선언문",      href: "/ko/manifesto" },
];

export const SITE_NAV_MORE_LABEL_EN = "More";
export const SITE_NAV_MORE_LABEL_KO = "더보기";

export const SITE_NAV_CTA = { label: "Start your hub", href: "/" };
export const SITE_NAV_CTA_KO = { label: "허브 시작하기", href: "/" };

export const SITE_FOOTER_COLUMNS_EN: FooterColumns = [
  { title: "Product", links: [
    { label: "Workspace", href: "/" },
    { label: "Hubs",      href: "/hubs" },
    { label: "Spec",      href: "/spec" },
  ]},
  { title: "Surfaces", links: [
    { label: "Web editor", href: "/" },
    { label: "Chrome",     href: "/plugins#chrome" },
    { label: "VS Code",    href: "/plugins#vscode" },
    { label: "Mac App",    href: "/plugins#desktop" },
    { label: "CLI",        href: "/plugins#cli" },
    { label: "MCP",        href: "/plugins#mcp" },
  ]},
  { title: "Resources", links: [
    { label: "About",        href: "/about" },
    { label: "How it works", href: "/how" },
    { label: "Benchmark",    href: "/benchmark" },
    { label: "Use cases",    href: "/cases" },
    { label: "Manifesto",    href: "/manifesto" },
    { label: "Docs",         href: "/docs" },
    { label: "GitHub",       href: "https://github.com/raymindai/memory-wiki" },
  ]},
  { title: "Legal", links: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms",   href: "/terms" },
  ]},
  { title: "Contact", links: [
    { label: "hi@raymind.ai", href: "mailto:hi@raymind.ai" },
  ]},
];

export const SITE_FOOTER_BOTTOM_LEFT_EN = "A product of Raymind.AI";
export const SITE_FOOTER_BOTTOM_RIGHT = "© 2026 Memory.Wiki. All rights reserved.";
export const SITE_FOOTER_TAGLINE_EN = "Personal knowledge hub for the AI era.";
export const SITE_FOOTER_PARENT_EN: FooterParent = {
  label: "A product of Raymind.AI",
  href: "https://raymind.ai",
};
