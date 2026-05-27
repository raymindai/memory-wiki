import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Noto_Sans, Noto_Sans_KR } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Cal Sans — self-hosted via next/font/local so mobile Safari
// (and every other client) gets the brand display face
// deterministically. The CDN @import we used before (jsdelivr →
// MarcoBiedermann/cal-sans) returned 502s on a hot CDN node and
// dropped users into the system font fallback. font-display:
// swap means we still paint something immediately even on a
// cold cache; the brand face arrives one repaint later.
const calSans = localFont({
  // The cal.com Cal Sans file ships a single non-variable weight.
  // Declaring the "400 700" range lets CSS requests for 500/600
  // (which the wordmark / headings ask for) resolve to this one
  // file instead of falling back to the system font.
  src: [{ path: "../fonts/CalSans-Regular.ttf", weight: "400 700", style: "normal" }],
  variable: "--font-cal-sans",
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Memory.Wiki — Stop re-explaining your context to every AI",
  description:
    "One URL, every AI. Capture from ChatGPT, Claude, Notion, GitHub, Obsidian — your knowledge becomes a citable URL that Claude, ChatGPT, Cursor, and Codex all fetch the same way. You set the direction; Memory.Wiki structures the URL.",
  keywords: [
    "personal knowledge hub",
    "AI memory",
    "AI context",
    "markdown wiki",
    "LLM wiki",
    "knowledge graph",
    "URL",
    "MCP",
    "Claude",
    "ChatGPT",
    "Cursor",
    "Codex",
    "knowledge management",
  ],
  authors: [{ name: "Memory.Wiki", url: "https://memory.wiki" }],
  metadataBase: new URL("https://memory.wiki"),
  openGraph: {
    title: "Memory.Wiki — Stop re-explaining your context to every AI",
    description:
      "One URL, every AI. Capture, bundle, deploy. The personal knowledge hub for the AI era.",
    url: "https://memory.wiki",
    siteName: "Memory.Wiki",
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Memory.Wiki — Stop re-explaining your context to every AI",
    description:
      "One URL, every AI. Your memory, deployable to Claude, ChatGPT, Cursor, Codex — same way.",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://memory.wiki",
    languages: {
      en: "https://memory.wiki",
      ko: "https://memory.wiki/ko",
    },
  },
  other: {
    "theme-color": "#09090b",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${notoSans.variable} ${notoSansKR.variable} ${calSans.variable}`}
      style={{ background: "#09090b" }}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Critical inline CSS for the pre-paint auth gate. Lives
            here (not in globals.css) so the rule is applied BEFORE
            body paints — globals.css loads asynchronously, leaving
            a 1-frame window where the body content would otherwise
            flash before the gate rule kicked in. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html[data-mw-auth-pending="1"]{background:#15151a !important}html[data-mw-auth-pending="1"][data-theme="light"]{background:#ffffff !important}html[data-mw-auth-pending="1"] body{background:#15151a !important;overflow:hidden !important;visibility:hidden !important}html[data-mw-auth-pending="1"][data-theme="light"] body{background:#ffffff !important}html[data-mw-auth-pending="1"] body>*:not(#mw-auth-pending-loader){display:none !important}html[data-mw-auth-pending="1"] #mw-auth-pending-loader{visibility:visible !important;position:fixed;inset:0;z-index:2147483647;display:flex !important;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#15151a}html[data-mw-auth-pending="1"][data-theme="light"] #mw-auth-pending-loader{background:#ffffff}#mw-auth-pending-loader{display:none}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mw-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.background='#faf9f7'}var a=localStorage.getItem('mw-accent');if(a&&a!=='lime'){document.documentElement.setAttribute('data-accent',a)}var s=localStorage.getItem('mw-scheme');if(s&&s!=='default'){document.documentElement.setAttribute('data-scheme',s)}if(localStorage.getItem('mw-was-logged-in')==='1'){document.documentElement.setAttribute('data-mw-auth-pending','1');setTimeout(function(){document.documentElement.removeAttribute('data-mw-auth-pending')},3500)}}catch(e){}`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Memory.Wiki",
          "url": "https://memory.wiki",
          "description": "Stop re-explaining your context to every AI. Put your knowledge in one URL Claude, ChatGPT, Cursor and Codex all read the same way. WYSIWYG editor, AI capture from chat surfaces, cross-platform sync, developer API. No login required.",
          "publisher": {
            "@type": "Organization",
            "name": "Raymind AI",
            "url": "https://raymind.ai"
          },
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://memory.wiki/?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        })}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Memory.Wiki",
          "applicationCategory": "Productivity",
          "operatingSystem": "Web, macOS, VS Code, Chrome",
          "url": "https://memory.wiki",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "description": "Cross-AI knowledge URLs. WYSIWYG editing, AI conversation capture, permanent shareable URLs that every AI reads as markdown."
        })}} />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-V3LTDKKHTS" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-V3LTDKKHTS');`,
          }}
        />
        <script src="https://cdn.jsdelivr.net/npm/mermaid@11.13.0/dist/mermaid.min.js" defer />
        <script
          dangerouslySetInnerHTML={{
            // In dev (or preview), aggressively unregister any previously-installed SW
            // and purge its caches — the SW uses cache-first for /_next/static/* which
            // makes new chunks invisible to the browser until the SW is removed.
            // In prod, register normally for offline support.
            __html: process.env.NODE_ENV === "production"
              ? `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}`
              : `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})});if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})})}}`,
          }}
        />
      </head>
      <body className="antialiased">
        {/* Pre-paint auth-flash gate. The inline head script sets
            data-mw-auth-pending on <html> SYNCHRONOUSLY (before
            React or first paint) whenever localStorage says the
            user has been logged in. CSS in globals.css then hides
            the rest of <body> and shows this loader, so returning
            owners never see the public viewer chrome flash. The
            DocumentViewer / BundleViewer ownership-check useEffect
            calls document.documentElement.removeAttribute(...) to
            lift the gate once auth resolves. */}
        <div id="mw-auth-pending-loader" aria-hidden>
          <img src="/brand/mwblob_morph.svg" alt="" className="mw-logo-darktheme" draggable={false} />
          <img src="/brand/mwblob_morph_dark.svg" alt="" className="mw-logo-lighttheme" draggable={false} />
          <span>Loading</span>
        </div>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
