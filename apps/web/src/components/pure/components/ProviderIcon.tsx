"use client";

import "../styles/components/provider-icon.css";
import type { ProviderBrand } from "../types";

/** Small inline brand mark for AI providers — recognizable simplified
 *  silhouette in brand color. Sized 14px to sit beside chip text. */
export function ProviderIcon({ brand }: { brand: ProviderBrand }) {
  switch (brand) {
    case "claude":
      // Anthropic asterisk in burnt-orange
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <path d="M8 1v14M2 8h12M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="#DA7756" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "chatgpt":
      // Official ChatGPT logo (Wikimedia Commons SVG path)
      return (
        <svg width="14" height="14" viewBox="0 0 320 320" aria-hidden style={{ flexShrink: 0 }}>
          <path
            fill="#10A37F"
            d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z"
          />
        </svg>
      );
    case "gemini":
      // Google Gemini official 4-point star (Wikimedia 2025 icon)
      return (
        <svg width="14" height="14" viewBox="0 0 65 65" aria-hidden style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="pi-gemini" x1="18.4" y1="43.4" x2="52.2" y2="15" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4893FC"/>
              <stop offset=".27" stopColor="#4893FC"/>
              <stop offset=".777" stopColor="#969DFF"/>
              <stop offset="1" stopColor="#BD99FE"/>
            </linearGradient>
          </defs>
          <path
            fill="url(#pi-gemini)"
            d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z"
          />
        </svg>
      );
    case "cursor":
      // Cursor official cube (25D variant from cursor-brand-assets)
      return (
        <svg width="14" height="14" viewBox="0 0 466.73 533.32" aria-hidden style={{ flexShrink: 0 }}>
          <path fill="#72716d" d="M233.37 266.66l231.16 133.46c-1.42 2.46-3.48 4.56-6.03 6.03L242.43 530.89c-5.61 3.24-12.53 3.24-18.14 0L8.24 406.15c-2.55-1.47-4.61-3.57-6.03-6.03l231.16-133.46z"/>
          <path fill="#55544f" d="M233.37 0v266.66L2.21 400.12c-1.42-2.46-2.21-5.3-2.21-8.24V141.44c0-5.89 3.14-11.32 8.24-14.27L224.29 2.43c2.81-1.62 5.94-2.43 9.07-2.43h.01z"/>
          <path fill="#43413c" d="M464.52 133.2c-1.42-2.46-3.48-4.56-6.03-6.03L242.43 2.43c-2.8-1.62-5.93-2.43-9.06-2.43v266.66l231.16 133.46c1.42-2.46 2.21-5.3 2.21-8.24V141.44c0-2.95-.78-5.77-2.21-8.24h-.01z"/>
          <path fill="#d6d5d2" d="M448.35 142.54c1.31 2.26 1.49 5.16 0 7.74l-209.83 363.42c-1.41 2.46-5.16 1.45-5.16-1.38v-239.48c0-1.91-.51-3.75-1.44-5.36l216.42-124.95h.01z"/>
          <path fill="#fff" d="M448.35 142.54l-216.42 124.95c-.92-1.6-2.26-2.96-3.92-3.92L20.62 143.83c-2.46-1.41-1.45-5.16 1.38-5.16h419.65c2.98 0 5.4 1.61 6.7 3.87z"/>
        </svg>
      );
    case "codex":
      // OpenAI Codex — official cleaner mark (from codex-color0.svg)
      return (
        <svg width="14" height="14" viewBox="0 0 9 9" aria-hidden style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="pi-codex" x1="4.5" y1="0" x2="4.5" y2="9" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#B1A7FF"/>
              <stop offset=".5" stopColor="#7A9DFF"/>
              <stop offset="1" stopColor="#3941FF"/>
            </linearGradient>
          </defs>
          <path
            fill="url(#pi-codex)"
            d="M3.03.17C3.39.02,3.79-.03,4.17.02c.5.06.95.27,1.34.64,0,0,.01,0,.02.01,0,0,.01,0,.02,0,.51-.13,1.05-.08,1.52.14h.02s.06.04.06.04c.5.25.89.68,1.09,1.2.1.26.16.52.16.8,0,.21-.02.41-.07.61,0,.02,0,.04.02.06.3.3.49.66.59,1.09.14.71,0,1.36-.44,1.93l-.07.08c-.29.33-.67.57-1.1.69-.02,0-.03.02-.04.04-.1.28-.19.51-.37.75-.45.59-1.11.92-1.86.92-.59,0-1.12-.22-1.58-.65-.01-.01-.03-.02-.05-.01-.19.06-.39.07-.6.07-.34,0-.67-.08-.97-.23-.32-.16-.59-.39-.81-.67-.08-.1-.15-.2-.21-.31-.08-.15-.14-.32-.18-.48-.1-.38-.1-.77,0-1.15,0,0,0-.02,0-.03,0,0,0-.02-.01-.02-.23-.23-.41-.52-.52-.83-.07-.19-.12-.39-.13-.6-.02-.27,0-.54.07-.8.17-.56.49-.99.97-1.31.11-.07.21-.13.3-.16.11-.04.21-.08.32-.11.02,0,.03-.02.03-.03.08-.29.22-.57.41-.81.24-.31.56-.55.92-.69ZM4.77,5.45c-.18,0-.31.16-.3.34,0,.16.14.29.3.3h1.82c.18,0,.33-.12.34-.3s-.12-.33-.3-.34c-.01,0-.02,0-.04,0h-1.82ZM2.73,3.12c-.09-.15-.29-.2-.44-.1-.14.09-.19.27-.11.42l.64,1.11-.63,1.07c-.09.15-.04.35.11.44.15.09.35.04.44-.11l.73-1.23c.06-.1.06-.22,0-.32l-.73-1.27Z"
          />
        </svg>
      );
    case "copilot":
      // Microsoft Copilot — fluid gradient mark (simplified from official)
      return (
        <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="pi-copilot" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#00B7FF"/>
              <stop offset="0.5" stopColor="#7B4FE0"/>
              <stop offset="1" stopColor="#F35BD7"/>
            </linearGradient>
          </defs>
          <path d="M29.5 4H13.5C8.9 4 6.1 10.1 4.3 16.1c-2.2 7.2-5 16.8 3.2 16.8h6.9c2.1 0 3.9-1.4 4.5-3.4 1.2-4.2 3.3-11.6 5-17.2.8-2.8 1.5-5.3 2.6-6.8C27 4.7 28.1 4 29.5 4z" fill="url(#pi-copilot)"/>
          <path d="M18.5 44h16c4.6 0 7.3-6.1 9.2-12.1 2.2-7.2 5-16.8-3.2-16.8h-6.9c-2.1 0-3.9 1.4-4.5 3.4-1.2 4.2-3.3 11.6-5 17.2-.8 2.8-1.5 5.3-2.6 6.8-.6.9-1.6 1.5-3 1.5z" fill="url(#pi-copilot)" opacity="0.85"/>
        </svg>
      );
    case "chrome":
      // Google Chrome — official 4-color logo (Wikimedia)
      return (
        <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="pi-chrome-a" x1="3.22" y1="15" x2="44.78" y2="15" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#d93025"/><stop offset="1" stopColor="#ea4335"/></linearGradient>
            <linearGradient id="pi-chrome-b" x1="20.72" y1="47.68" x2="41.50" y2="11.68" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fcc934"/><stop offset="1" stopColor="#fbbc04"/></linearGradient>
            <linearGradient id="pi-chrome-c" x1="26.60" y1="46.50" x2="5.82" y2="10.51" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#1e8e3e"/><stop offset="1" stopColor="#34a853"/></linearGradient>
          </defs>
          <circle cx="24" cy="24" r="12" fill="#fff"/>
          <path d="M24 12h20.78a23.99 23.99 0 0 0-41.56 0L13.61 30A12 12 0 0 1 24 12z" fill="url(#pi-chrome-a)"/>
          <circle cx="24" cy="24" r="9.5" fill="#1a73e8"/>
          <path d="M34.39 30L24 48A23.99 23.99 0 0 0 44.78 12H24a12 12 0 0 1 10.39 18z" fill="url(#pi-chrome-b)"/>
          <path d="M13.61 30L3.22 12A23.99 23.99 0 0 0 24 48l10.39-18a11.99 11.99 0 0 1-20.78 0z" fill="url(#pi-chrome-c)"/>
        </svg>
      );
    case "safari":
      // Apple Safari — official compass with red needle (simplified)
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="pi-safari-bg" x1="8" y1="0" x2="8" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#23B0FB"/>
              <stop offset="1" stopColor="#1066D7"/>
            </linearGradient>
          </defs>
          <circle cx="8" cy="8" r="7" fill="url(#pi-safari-bg)"/>
          <circle cx="8" cy="8" r="5.5" fill="#fff"/>
          <path d="M8 3l1.4 4.6L8 8 6.6 7.4z" fill="#E94B3C"/>
          <path d="M8 13l-1.4-4.6L8 8l1.4.4z" fill="#B8B8B8"/>
          <circle cx="8" cy="8" r="0.7" fill="#333"/>
        </svg>
      );
    case "vscode":
      // VS Code — official blue fold mark (Wikimedia, simplified mask)
      return (
        <svg width="14" height="14" viewBox="0 0 100 100" aria-hidden style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="pi-vsc" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#0065A9"/>
              <stop offset="1" stopColor="#007ACC"/>
            </linearGradient>
            <clipPath id="pi-vsc-clip"><path d="M70.91 99.32a5 5 0 0 0 4.96-.19l20.59-9.91A5 5 0 0 0 100 84.59V16.41a5 5 0 0 0-3.54-4.63L75.87.87a5 5 0 0 0-5.69 1.21L29.36 38.04 12.19 25.01a3 3 0 0 0-3.83.24L1.36 30.25a3 3 0 0 0 0 6.17l14.89 13.58L1.36 63.58a3 3 0 0 0 0 6.17l5.51 5.01a3 3 0 0 0 3.83.24l17.17-13.03 40.81 35.96a5 5 0 0 0 2.23 1.39zM75.02 27.30L45.11 50l29.91 22.70V27.30z"/></clipPath>
          </defs>
          <g clipPath="url(#pi-vsc-clip)">
            <rect width="100" height="100" fill="url(#pi-vsc)"/>
            <path d="M75 0v100l-46-37L7 80 0 70l18-20L0 30l7-10 22 17 46-37z" fill="rgba(255,255,255,0.25)"/>
          </g>
        </svg>
      );
    case "mac":
      // Apple silhouette
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <path d="M11.6 8.3c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.7.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.2 2.6 2.2 1 0 1.5-.7 2.8-.7 1.4 0 1.8.7 2.9.7 1.2 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4 0 0-2.3-.9-2.5-3.7zM9.6 2.6c.6-.7 1-1.7.9-2.6-.8 0-1.7.5-2.3 1.2-.5.6-1 1.6-.9 2.6.9.1 1.8-.5 2.3-1.2z" fill="currentColor"/>
        </svg>
      );
    case "cli":
    case "terminal":
      // Terminal — ">_" prompt
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M4 6l2.2 1.8L4 9.6M8 10h4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "mcp":
      // MCP — link / connector
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <path d="M5.5 10.5l5-5M3 8a3 3 0 0 1 3-3h1M13 8a3 3 0 0 1-3 3H9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
      );
    case "browser":
      // Globe with meridian
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3"/>
          <ellipse cx="8" cy="8" rx="2.5" ry="6" fill="none" stroke="currentColor" strokeWidth="1.3"/>
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
      );
    case "finder":
      // Finder face — split square
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3"/>
          <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.3" opacity="0.5"/>
        </svg>
      );
    case "ios":
      // iPhone silhouette — neutral mark, currentColor
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <rect x="4" y="1.5" width="8" height="13" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3"/>
          <line x1="7" y1="3" x2="9" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <circle cx="8" cy="12.5" r="0.6" fill="currentColor"/>
        </svg>
      );
    case "android":
      // Android bugdroid head — official green
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0 }}>
          <path
            fill="#3DDC84"
            d="M3.5 7.5C3.22 7.5 3 7.72 3 8v3.5c0 .28.22.5.5.5s.5-.22.5-.5V8c0-.28-.22-.5-.5-.5zM12.5 7.5c-.28 0-.5.22-.5.5v3.5c0 .28.22.5.5.5s.5-.22.5-.5V8c0-.28-.22-.5-.5-.5zM4.5 7v5c0 .28.22.5.5.5h.5v2c0 .28.22.5.5.5s.5-.22.5-.5v-2h1v2c0 .28.22.5.5.5s.5-.22.5-.5v-2h1v2c0 .28.22.5.5.5s.5-.22.5-.5v-2H11c.28 0 .5-.22.5-.5V7h-7zM10.4 3.3l.6-1c.07-.12.03-.27-.09-.34-.12-.07-.27-.03-.34.09l-.61 1.02C9.5 2.85 8.78 2.7 8 2.7s-1.5.15-1.96.37l-.61-1.02c-.07-.12-.22-.16-.34-.09-.12.07-.16.22-.09.34l.6 1A3.4 3.4 0 004.5 6.4h7a3.4 3.4 0 00-1.1-3.1zM6.5 5.2a.3.3 0 110-.6.3.3 0 010 .6zm3 0a.3.3 0 110-.6.3.3 0 010 .6z"
          />
        </svg>
      );
  }
}
