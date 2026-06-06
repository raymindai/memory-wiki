import type { ProviderBrand } from "@/components/pure";

export type Locale = "en" | "ko";

export interface AboutContent {
  nav: { label: string; href: string }[];
  navCta: string;
  hero: {
    title: string[];                  // each entry = one line of <h1> (joined with <br/>)
    ledeLines: string[];              // each = one line of lede (joined with <br/>)
    primaryCta: string;
    secondaryCta: string;
    microcopy: string;                // friction-removal line under CTAs
    trustLabel: string;
  };
  surfacesGallery: { eyebrow: string };
  primitives: {
    num: string; eyebrow: string; title: string; lede: string;
    items: {
      tag: string;
      url: string;
      body: string;
      bullets: string[];
      badge: string;
    }[];
  };
  ecosystem: {
    num: string; eyebrow: string; title: string; lede: string;
    leftTitle: string;
    centerTitle: string;
    rightTitle: string;
    moreLabel: string;
    foot: string;
  };
  surfaces: {
    num: string; eyebrow: string; title: string; lede: string;
    items: {
      title: string;
      body: string;
      brand?: "claude" | "chatgpt" | "gemini" | "cursor" | "codex" | "copilot"
            | "chrome" | "vscode" | "mac" | "ios" | "android"
            | "cli" | "mcp" | "browser" | "terminal" | "finder";
      href?: string;
      hrefLabel?: string;
    }[];
  };
  framework: {
    num: string; eyebrow: string; title: string; lede: string;
    items: {
      label: string;       // short step label (e.g. "CAPTURE")
      headline: string;    // one-line benefit headline
      bullets: string[];   // concrete capabilities (3-4 lines)
    }[];
  };
  features: {
    num: string; eyebrow: string; title: string; lede: string;
    items: { title: string; body: string }[];
  };
  benchmark: {
    num: string; eyebrow: string; title: string; lede: string;
    columns: string[];
    rows: { feature: string; vals: string[] }[];
    footnote: string;
  };
  comparison: {
    num: string; eyebrow: string; title: string; lede: string;
    columns: string[];
    rows: { feature: string; vals: string[] }[];
    footnote: string;
  };
  roadmap: {
    num: string; eyebrow: string; title: string; lede: string;
    items: {
      tag: string;
      title: string;
      body: string;
      bullets: string[];
      badge: string;
    }[];
  };
  pricing: {
    num: string; eyebrow: string; title: string;
    tiers: {
      name: string;
      badge?: string;
      badgeColor?: "lime" | "info" | "orange" | "warn" | "ai" | "pink";
      sub: string;
      highlighted?: boolean;
      items: { text: string; faint?: boolean }[];
    }[];
  };
  howSummary: {
    eyebrow: string;
    line: string;
    bullets: string[];
    cta: string;
    ctaHref: string;
  };
  trust: {
    items: { label: string; body: string }[];
  };
  faq: {
    num: string; eyebrow: string; title: string; lede: string;
    items: { q: string; a: string }[];
  };
  emailSignup: {
    eyebrow: string;
    title: string;
    lede: string;
    placeholder: string;
    button: string;
    buttonSending: string;
    successMsg: string;
    errorMsg: string;
    privacyNote: string;
  };
  manifesto: {
    eyebrow: string;
    lede: string;
    cta: string;
  };
  cta: { eyebrow: string; heading: string; lede: string; button: string };
  footer: {
    columns: { title: string; links: { label: string; href: string }[] }[];
    bottomLeft: string;
    bottomRight: string;
    tagline: string;
    parent: { label: string; href: string };
  };
  surfacesInput: { name: string; brand: ProviderBrand; href?: string }[];
  surfacesOutput: { name: string; brand: ProviderBrand }[];
  trustChips: { label: string; brand: ProviderBrand }[];
  trustMore: { label: string; href: string };
}

/* ─────────────────────────────────────────────────────────────
   ENGLISH
   ───────────────────────────────────────────────────────────── */

export const aboutEn: AboutContent = {
  nav: [
    { label: "About",     href: "/about" },
    { label: "Benchmark", href: "/benchmark" },
    { label: "Manifesto", href: "/manifesto" },
    { label: "Docs",      href: "/docs" },
  ],
  navCta: "Start your hub",
  hero: {
    title: ["Stop re-explaining your context", "to every AI."],
    ledeLines: [
      "No more pasting the same context into ten AIs.",
      "Capture once. Every AI reads your URL.",
    ],
    primaryCta: "Try it now",
    secondaryCta: "See the cross-AI verification",
    microcopy: "Free during beta. No install. No signup to try.",
    trustLabel: "Verified across",
  },
  surfacesGallery: { eyebrow: "Surfaces in action" },
  primitives: {
    num: "04",
    eyebrow: "Three URL primitives",
    title: "Document, Bundle, Hub.",
    lede: "Same primitive, three nested scopes. Each fetches as plain markdown for any AI, no SDK, no plugin, no MCP server required.",
    items: [
      { tag: "Document", url: "memory.wiki/<id>",   body: "One captured answer, paper, or transcript. One permanent URL. The atomic unit.",   bullets: ["Capture in three seconds from anywhere", "Citable, versioned, permanent", "Markdown payload to any AI"], badge: "Atomic" },
      { tag: "Bundle",   url: "memory.wiki/b/<id>", body: "A curated grouping of docs around a topic. One URL pulls the whole collection into any AI.", bullets: ["Manual select or AI generated", "Compact mode, 5 to 9 times cheaper", "Semantic recall by query"], badge: "Curated" },
      { tag: "Hub",      url: "memory.wiki/@<you>", body: "Your entire knowledge layer as a single URL. Paste it once, every AI reads it.",     bullets: ["Public face of your knowledge", "AI manifest at /llms.txt", "Compact digest, token budgeted"], badge: "Namespace" },
    ],
  },
  ecosystem: {
    num: "02",
    eyebrow: "One URL, every AI",
    title: "Write from any surface. Read from any context.",
    lede: "The hub URL is the single source. Capture surfaces write into it. Every AI reads it the same way, clean markdown, no auth, no rate limits.",
    leftTitle: "Write from",
    centerTitle: "One URL",
    rightTitle: "Read in",
    moreLabel: "+ more",
    foot: "Cross-AI by design. Permanent by policy.",
  },
  surfaces: {
    num: "03",
    eyebrow: "Nine surfaces",
    title: "Wherever you already work.",
    lede: "memory.wiki ships as native apps across every surface that matters. One account, one hub, every entry point.",
    items: [
      { title: "Web editor",        brand: "browser", href: "/",                  body: "WYSIWYG markdown at memory.wiki. Paste, drop a file, capture. URL in three seconds." },
      { title: "Chrome extension",  brand: "chrome",  href: "/plugins#chrome",    body: "One-click capture from ChatGPT, Claude, Gemini chat pages." },
      { title: "VS Code extension", brand: "vscode",  href: "/plugins#vscode",    body: "WYSIWYG preview, cloud sync, AI tools, Copy-as-context, sidebar." },
      { title: "memory.wiki for Mac", brand: "mac",   href: "/plugins#desktop",   body: "Native sidebar, folders, offline, signed and notarized DMG." },
      { title: "iOS native",        brand: "ios",     href: "/plugins#ios",       body: "Share Extension, camera capture with OCR, Spotlight, Widgets, background sync." },
      { title: "Android native",    brand: "android", href: "/plugins#android",   body: "Share intent, camera, Widgets, background sync, push." },
      { title: "CLI",               brand: "cli",     href: "/plugins#cli",       body: "memory-wiki-cli on npm. mw publish, mw capture, mw login, pipe-friendly." },
      { title: "MCP server",        brand: "mcp",     href: "/plugins#mcp",       body: "28 tools for Claude Code, Cursor, Windsurf, Codex. Save and recall by URL." },
      { title: "QuickLook",         brand: "finder",  href: "/plugins#quicklook", body: "Preview .md files in Finder with full markdown rendering, bundled in the Mac DMG." },
    ],
  },
  framework: {
    num: "01",
    eyebrow: "Capture → Organize → Use",
    title: "Three stages, one product.",
    lede: "Capture is the friend. Organize is the AI. Use is your right.",
    items: [
      {
        label: "Capture",
        headline: "Save what matters in three seconds.",
        bullets: [
          "One click from ChatGPT, Claude, Gemini chats",
          "Cursor, Codex, Aider — one install",
          "Drop PDF, DOCX, PPTX files",
          "Permanent URL the moment you save",
        ],
      },
      {
        label: "Organize",
        headline: "AI sorts everything in the background.",
        bullets: [
          "Auto tags, clusters, summaries",
          "Bundles related docs by topic",
          "Every change attributed",
          "Original markdown is never overwritten",
        ],
      },
      {
        label: "Use",
        headline: "Any AI reads your knowledge from one URL.",
        bullets: [
          "Paste hub URL into any chat",
          "Fetches the relevant slice as context",
          "Works across Claude, ChatGPT, Gemini, Cursor, Codex",
          "No SDK, no auth, no rate limits",
        ],
      },
    ],
  },
  features: {
    num: "05",
    eyebrow: "What's inside",
    title: "Editor, search, graph.",
    lede: "The substance behind the URL. Everything is markdown, everything is open.",
    items: [
      { title: "WYSIWYG editor",    body: "Click and type in the rendered preview, like a word processor. Markdown source stays clean." },
      { title: "KaTeX math",        body: "Inline and display equations rendered with LaTeX precision, ready to share." },
      { title: "Mermaid diagrams",  body: "Flowcharts, sequence diagrams, Gantt — straight from markdown code blocks." },
      { title: "Code highlighting", body: "190+ languages via highlight.js. Copy button on every block." },
      { title: "Hub-wide search",   body: "Hybrid BM25 + vector RRF. Question goes in, ranked markdown chunks come out for any AI." },
      { title: "Concept index",     body: "LLM-extracted concepts across your whole hub, recomputed in the background." },
      { title: "Backlinks graph",   body: "[[wikilinks]] resolve into a self-wiring graph of how your documents connect." },
      { title: "Version history",   body: "Every change is tracked and revertible. The URL stays the same; readers always see the latest." },
    ],
  },
  benchmark: {
    num: "06",
    eyebrow: "Cross-AI verification",
    title: "The URL contract, verified open.",
    lede: "An open evaluation proving a single URL delivers your knowledge to every AI, including content the AIs have never seen during training.",
    columns: ["Mode", "Familiar hub", "Unseen hub", "Tool use"],
    rows: [
      { feature: "Paste, full corpus",            vals: ["100%",    "100%",     "100%"] },
      { feature: "Paste, compact (5 to 9x cheaper)", vals: ["100%", "100%",     "100%"] },
      { feature: "Browse (AI fetches the URL)",   vals: ["98%",     "100%",     "100%"] },
      { feature: "Adversarial refusal",           vals: ["100%",    "not run",  "100%"] },
    ],
    footnote: "The unseen-hub column rules out memorisation: AIs cannot recall a hub they never saw during training, so 100% there means the URL delivery contract genuinely works. Full harness, judge, and round-by-round results are open.",
  },
  comparison: {
    num: "07",
    eyebrow: "Why this is different",
    title: "Not vendor memory. Not agent memory.",
    lede: "memory.wiki is the URL delivery layer. You author the content. Any AI fetches it. The two adjacent categories solve different problems.",
    columns: ["", "Vendor memory", "Agent memory store", "memory.wiki"],
    rows: [
      { feature: "First user",   vals: ["AI auto-extract",  "AI agent",          "Human"]                    },
      { feature: "Interface",    vals: ["Inside one tool",  "SDK or MCP server", "Public URL"]               },
      { feature: "Visibility",   vals: ["Black box",        "Black box",         "Human-readable markdown"]  },
      { feature: "Cross-vendor", vals: ["no",               "no",                "yes"]                      },
      { feature: "Sharing",      vals: ["no",               "personal or team",  "Public URL, anyone reads"] },
      { feature: "Ownership",    vals: ["Vendor",           "Backend service",   "You"]                      },
    ],
    footnote: "Vendor memory (ChatGPT memory, Claude projects) lives inside one tool. Agent memory (mem0, Letta, OpenAI Memory) is a backend store an agent recalls from. memory.wiki is the URL delivery layer that sits one level up, deployable to every AI.",
  },
  roadmap: {
    num: "08",
    eyebrow: "Roadmap",
    title: "Where memory.wiki is going.",
    lede: "The full surface is in private beta today. Public launch wave runs in late summer 2026 across nine surfaces simultaneously.",
    items: [
      { tag: "Shipped", title: "Today",  body: "Live across every capture and retrieval surface. The product runs end to end.", bullets: ["Doc, Bundle, Hub URL primitives", "Seven capture surfaces (Web, Chrome, VS Code, Mac, CLI, MCP, QuickLook)", "Hybrid BM25 plus vector recall", "Open cross-AI evaluation, reproducible"], badge: "Live now" },
      { tag: "Beta",    title: "Next",   body: "Landing during the v8 build window.", bullets: ["Mobile native (iOS, Android), Tier 1", "Dual-namespace bundles (My, AI)", "Attribution layer per entry", "First-paste magic flow"], badge: "Aug 2026" },
      { tag: "Beyond",  title: "Vision", body: "Post-launch arc, v9 and after.",     bullets: ["Bundle Spec RFC, open standard", "Team workspace and shared knowledge", "Deep partnership integrations", "Enterprise self-host"], badge: "Post-launch" },
    ],
  },
  pricing: {
    num: "09",
    eyebrow: "Pricing",
    title: "Free does almost everything. Pro unlocks privacy and scale.",
    tiers: [
      { name: "Free", badge: "Always", sub: "Unlimited public knowledge. All apps.", items: [
        { text: "Unlimited documents" },
        { text: "Public docs and a public hub" },
        { text: "All native apps (Web, Chrome, VS Code, Mac, iOS, Android, CLI, MCP)" },
        { text: "AI auto-organize (tags, clusters, summaries)" },
        { text: "Cross-AI reads (Claude, ChatGPT, Gemini, Cursor, Codex)" },
        { text: "Modest image storage" },
      ]},
      { name: "Pro", badge: "TBD", badgeColor: "lime", sub: "Privacy controls, custom domain, generous storage.", highlighted: true, items: [
        { text: "Everything in Free" },
        { text: "Private documents and private hub" },
        { text: "Per-doc and per-bundle permissions (allowed emails)" },
        { text: "Custom domain" },
        { text: "Generous image and file storage" },
        { text: "MCP server with full write access" },
        { text: "Custom GPT integration" },
      ]},
      { name: "Team", badge: "v9", badgeColor: "ai", sub: "Per-seat, shared workspaces.", items: [
        { text: "Everything in Pro" },
        { text: "Multi-tenant workspace" },
        { text: "Real-time collaboration on docs and bundles" },
        { text: "Role-based access" },
        { text: "SSO and SAML" },
        { text: "Per-seat billing" },
        { text: "Audit log" },
        { text: "Coming after PMF, 6 to 12 months", faint: true },
      ]},
    ],
  },
  howSummary: {
    eyebrow: "How it actually works",
    line: "A document → a bundle → a hub. URLs everywhere. Markdown the whole way.",
    bullets: [
      "Capture a chat → permanent URL, version 1, edit token returned.",
      "Pick N docs → a bundle URL with cached cross-doc analysis.",
      "Your hub at memory.wiki/@you auto-publishes an llms.txt manifest. Updates ripple through automatically.",
    ],
    cta: "Read the full walkthrough",
    ctaHref: "/how",
  },
  trust: {
    items: [
      { label: "Permanent",       body: "Your URLs never expire. Permanence is policy, not a feature flag." },
      { label: "Never trains AI", body: "Your content is not used to train any model. Public docs are public reading, not training data." },
      { label: "Export anytime",  body: "Everything is plain markdown. Bulk export with one CLI command, no lock-in." },
      { label: "Open standard",   body: "Bundle Spec ships as an open RFC. The format outlives the product." },
    ],
  },
  faq: {
    num: "10",
    eyebrow: "FAQ",
    title: "Common questions.",
    lede: "If the answer below doesn't cover it, write to hi@raymind.ai.",
    items: [
      {
        q: "How is this different from Notion, Obsidian, or Roam?",
        a: "Knowledge tools optimize for human reading and editing. memory.wiki optimizes for AI delivery: every URL fetches as clean markdown, with no auth and no rate limits, so any AI can ingest it. You can keep using Notion or Obsidian for authoring — memory.wiki is where the URL lives that you actually paste into ChatGPT, Claude, or Cursor.",
      },
      {
        q: "Will my content be used to train AI?",
        a: "No. Your documents are stored and served as-is. We do not train any model on your content, and the public-read endpoint is a delivery contract, not a training pipeline. The cross-AI evaluation uses a held-out unseen hub specifically to rule out training-data overlap.",
      },
      {
        q: "What happens to my docs if I cancel Pro?",
        a: "Existing docs stay live at their permanent URLs. You drop back to the free tier limits on new captures, but everything previously published keeps working. URLs are permanent regardless of plan.",
      },
      {
        q: "Can I export everything?",
        a: "Yes. `mw export` from the CLI pulls every document as a markdown file plus a JSON index of bundles and hub structure. No proprietary format, no rehydration step.",
      },
      {
        q: "Is it open source?",
        a: "The Bundle Spec is shipping as an open RFC so the data format outlives the product. The reference renderer (markdown-it pipeline) and the CLI client are MIT. The hosted hub and AI orchestration are proprietary.",
      },
      {
        q: "Does it work offline?",
        a: "The Mac, iOS, and Android apps work offline against a local cache and sync when reconnected. CLI works offline for read and stage operations; publish requires network. The web editor needs a connection.",
      },
      {
        q: "Who owns the data?",
        a: "You do. memory.wiki is a delivery layer, not an owner. You hold the markdown, the URLs, and the right to take them elsewhere. We do not relicense or resell your content.",
      },
    ],
  },
  emailSignup: {
    eyebrow: "Launch list",
    title: "Get one email when public launch ships.",
    lede: "memory.wiki opens to everyone in August 2026. One message, no spam, unsubscribe with one click.",
    placeholder: "your@email.com",
    button: "Notify me",
    buttonSending: "Sending…",
    successMsg: "You're on the list. We'll write when it ships.",
    errorMsg: "Something went wrong. Try again, or write to hi@raymind.ai.",
    privacyNote: "One email at launch. Nothing else.",
  },
  manifesto: {
    eyebrow: "The bigger picture",
    lede: "The thesis behind memory.wiki, the strategy chain that led to v8, and what comes after launch.",
    cta: "Read the manifesto",
  },
  cta: {
    eyebrow: "Ready",
    heading: "Start your hub.",
    lede: "Free during beta. No signup needed to try. Paste any markdown and you have a Document URL in three seconds.",
    button: "Start your hub",
  },
  footer: {
    columns: [
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
        { label: "About",     href: "/about" },
        { label: "Use cases", href: "/cases" },
        { label: "Benchmark", href: "/benchmark" },
        { label: "Manifesto", href: "/manifesto" },
        { label: "Docs",      href: "/docs" },
        { label: "GitHub",    href: "https://github.com/raymindai/memory-wiki" },
      ]},
      { title: "Legal", links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms",   href: "/terms" },
      ]},
      { title: "Contact", links: [
        { label: "hi@raymind.ai", href: "mailto:hi@raymind.ai" },
      ]},
    ],
    bottomLeft: "A product of Raymind.AI",
    bottomRight: "© 2026 memory.wiki. All rights reserved.",
    tagline: "Personal knowledge hub for the AI era.",
    parent: { label: "A product of Raymind.AI", href: "https://raymind.ai" },
  },
  surfacesInput: [
    { name: "Chrome",  brand: "chrome",  href: "/plugins#chrome"  },
    { name: "VS Code", brand: "vscode",  href: "/plugins#vscode"  },
    { name: "Cursor",  brand: "cursor",  href: "/plugins#mcp"     },
    { name: "Claude",  brand: "claude",  href: "/plugins#mcp"     },
    { name: "Mac App", brand: "mac",     href: "/plugins#desktop" },
    { name: "CLI",     brand: "cli",     href: "/plugins#cli"     },
    { name: "MCP",     brand: "mcp",     href: "/plugins#mcp"     },
  ],
  surfacesOutput: [
    { name: "Claude",  brand: "claude"  },
    { name: "ChatGPT", brand: "chatgpt" },
    { name: "Gemini",  brand: "gemini"  },
    { name: "Cursor",  brand: "cursor"  },
    { name: "Codex",   brand: "codex"   },
    { name: "Copilot", brand: "copilot" },
    { name: "VS Code", brand: "vscode"  },
    { name: "Browser", brand: "browser" },
  ],
  trustChips: [
    { label: "Claude",  brand: "claude"  },
    { label: "ChatGPT", brand: "chatgpt" },
    { label: "Gemini",  brand: "gemini"  },
    { label: "Cursor",  brand: "cursor"  },
    { label: "Codex",   brand: "codex"   },
  ],
  trustMore: { label: "+ more", href: "/benchmark" },
};

/* ─────────────────────────────────────────────────────────────
   KOREAN
   ───────────────────────────────────────────────────────────── */

export const aboutKo: AboutContent = {
  nav: [
    { label: "소개",     href: "/ko/about" },
    { label: "벤치마크", href: "/benchmark" },
    { label: "선언문",   href: "/ko/manifesto" },
    { label: "문서",     href: "/ko/docs" },
  ],
  navCta: "허브 시작하기",
  hero: {
    title: ["AI 마다 같은 맥락을", "다시 설명하지 마세요."],
    ledeLines: [
      "열 개의 AI에 같은 컨텍스트를 붙여넣을 필요 없습니다.",
      "한 번 캡처하면, 모든 AI가 당신의 URL을 읽습니다.",
    ],
    primaryCta: "지금 시도하기",
    secondaryCta: "크로스 AI 검증 보기",
    microcopy: "베타 동안 무료. 설치 불필요. 가입 없이 체험.",
    trustLabel: "검증된 AI",
  },
  surfacesGallery: { eyebrow: "실제 표면들" },
  primitives: {
    num: "04",
    eyebrow: "세 가지 URL 기본 단위",
    title: "Document, Bundle, Hub.",
    lede: "같은 원리, 세 가지 스코프. 각각 plain markdown으로 어떤 AI에도 전달됩니다. SDK도, 플러그인도, MCP 서버도 필요 없습니다.",
    items: [
      { tag: "Document", url: "memory.wiki/<id>",   body: "포착된 한 개의 답변, 논문, 대화 기록. 영구 URL 하나. 가장 작은 단위.", bullets: ["3초 만에 어디서든 캡처", "인용 가능, 버전 관리, 영구 보존", "모든 AI에 markdown으로 전달"], badge: "원자" },
      { tag: "Bundle",   url: "memory.wiki/b/<id>", body: "특정 주제로 큐레이션된 문서 묶음. URL 하나로 컬렉션 전체를 AI에 전달.", bullets: ["수동 선택 또는 AI 생성", "Compact 모드, 5~9배 저렴", "쿼리 기반 semantic 검색"], badge: "큐레이션" },
      { tag: "Hub",      url: "memory.wiki/@<you>", body: "당신의 모든 지식을 단일 URL로. 한 번 붙여넣으면 모든 AI가 읽습니다.", bullets: ["당신 지식의 공개 얼굴", "/llms.txt AI 매니페스트", "토큰 예산 맞춘 compact digest"], badge: "네임스페이스" },
    ],
  },
  ecosystem: {
    num: "02",
    eyebrow: "URL 하나, 모든 AI",
    title: "어디서든 쓰고, 어떤 컨텍스트에서든 읽으세요.",
    lede: "허브 URL이 단일 소스. 캡처 표면들이 거기에 쓰고, 모든 AI가 같은 방식으로 — clean markdown, 인증 없음, 속도 제한 없음 — 읽습니다.",
    leftTitle: "쓰는 곳",
    centerTitle: "단일 URL",
    rightTitle: "읽는 곳",
    moreLabel: "+ 더보기",
    foot: "구조적 cross-AI. 정책적 영구 보존.",
  },
  surfaces: {
    num: "03",
    eyebrow: "9개 표면",
    title: "당신이 이미 작업하는 곳에서.",
    lede: "memory.wiki는 의미 있는 모든 표면에 네이티브 앱으로 출시됩니다. 한 계정, 한 허브, 모든 진입점.",
    items: [
      { title: "웹 에디터",         brand: "browser", href: "/",                  hrefLabel: "열기", body: "memory.wiki의 WYSIWYG 마크다운. 붙여넣기, 파일 드롭, 캡처. URL 3초." },
      { title: "Chrome 확장",       brand: "chrome",  href: "/ko/plugins#chrome",    hrefLabel: "열기", body: "ChatGPT, Claude, Gemini 채팅 페이지에서 원클릭 캡처." },
      { title: "VS Code 확장",      brand: "vscode",  href: "/ko/plugins#vscode",    hrefLabel: "열기", body: "WYSIWYG 프리뷰, 클라우드 동기화, AI 도구, Copy-as-context, 사이드바." },
      { title: "memory.wiki for Mac", brand: "mac",   href: "/ko/plugins#desktop",   hrefLabel: "열기", body: "네이티브 사이드바, 폴더, 오프라인. Apple 서명 + notarize DMG." },
      { title: "iOS 네이티브",      brand: "ios",     href: "/ko/plugins#ios",       hrefLabel: "열기", body: "Share Extension, OCR 카메라, Spotlight, 위젯, 백그라운드 동기화." },
      { title: "Android 네이티브",  brand: "android", href: "/ko/plugins#android",   hrefLabel: "열기", body: "Share intent, 카메라, 위젯, 백그라운드 동기화, 푸시." },
      { title: "CLI",               brand: "cli",     href: "/ko/plugins#cli",       hrefLabel: "열기", body: "memory-wiki-cli (npm). mw publish, mw capture, mw login. 파이프 친화적." },
      { title: "MCP 서버",          brand: "mcp",     href: "/ko/plugins#mcp",       hrefLabel: "열기", body: "Claude Code, Cursor, Windsurf, Codex용 28개 도구. URL로 저장하고 불러오기." },
      { title: "QuickLook",         brand: "finder",  href: "/ko/plugins#quicklook", hrefLabel: "열기", body: ".md 파일을 Finder에서 풀 마크다운 렌더링으로 프리뷰. Mac DMG에 번들." },
    ],
  },
  framework: {
    num: "01",
    eyebrow: "Capture → Organize → Use",
    title: "세 단계, 한 제품.",
    lede: "캡처는 당신의 친구. 정리는 AI. 사용은 당신의 권리.",
    items: [
      {
        label: "Capture",
        headline: "중요한 걸 3초 만에 저장.",
        bullets: [
          "ChatGPT / Claude / Gemini 채팅에서 원클릭",
          "Cursor / Codex / Aider — 한 번 설치",
          "PDF / DOCX / PPTX 파일 드롭",
          "저장 즉시 영구 URL",
        ],
      },
      {
        label: "Organize",
        headline: "AI가 백그라운드에서 모두 정리.",
        bullets: [
          "자동 태그, 클러스터, 요약",
          "주제별 관련 문서 묶음",
          "모든 변경에 출처 표시",
          "원본 마크다운은 절대 덮어쓰지 않음",
        ],
      },
      {
        label: "Use",
        headline: "URL 하나로 어떤 AI든 당신 지식을 읽음.",
        bullets: [
          "어떤 채팅에든 hub URL 붙여넣기",
          "관련 조각을 컨텍스트로 fetch",
          "Claude / ChatGPT / Gemini / Cursor / Codex 호환",
          "SDK, 인증, 속도 제한 없음",
        ],
      },
    ],
  },
  features: {
    num: "05",
    eyebrow: "안에 들어있는 것",
    title: "에디터, 검색, 그래프.",
    lede: "URL 뒤의 실체. 모든 게 markdown, 모든 게 오픈.",
    items: [
      { title: "WYSIWYG 에디터",  body: "렌더링된 프리뷰에서 바로 클릭하고 타이핑. 워드프로세서처럼. 마크다운 소스는 깨끗하게 유지." },
      { title: "KaTeX 수식",      body: "인라인과 디스플레이 수식을 LaTeX 정밀도로 렌더링." },
      { title: "Mermaid 다이어그램", body: "플로우차트, 시퀀스, Gantt — 마크다운 코드 블록에서 바로." },
      { title: "코드 하이라이팅", body: "highlight.js로 190+ 언어. 모든 블록에 복사 버튼." },
      { title: "허브 전체 검색",  body: "BM25 + 벡터 RRF 하이브리드. 질문을 넣으면 모든 AI를 위한 마크다운 청크가 순위대로." },
      { title: "Concept 인덱스",  body: "허브 전체에서 LLM이 추출한 개념. 백그라운드에서 재계산." },
      { title: "Backlinks 그래프", body: "[[wikilinks]]가 문서 간 연결의 자동 그래프로 해석." },
      { title: "버전 히스토리",   body: "모든 변경이 추적되고 되돌릴 수 있음. URL은 그대로, 독자는 항상 최신 버전." },
    ],
  },
  benchmark: {
    num: "06",
    eyebrow: "Cross-AI 검증",
    title: "URL 계약, 공개적으로 검증됨.",
    lede: "단일 URL이 모든 AI에 당신의 지식을 전달함을 — 학습에서 본 적 없는 콘텐츠 포함 — 증명하는 공개 평가.",
    columns: ["모드", "친숙한 허브", "미본 허브", "도구 사용"],
    rows: [
      { feature: "전체 corpus 붙여넣기",        vals: ["100%", "100%", "100%"] },
      { feature: "Compact 붙여넣기 (5~9배 저렴)", vals: ["100%", "100%", "100%"] },
      { feature: "Browse (AI가 URL fetch)",      vals: ["98%",  "100%", "100%"] },
      { feature: "Adversarial 거부",             vals: ["100%", "미수행", "100%"] },
    ],
    footnote: "미본 허브 열이 암기 가능성을 배제합니다: AI는 학습 중 본 적 없는 허브를 기억할 수 없으므로, 100%는 URL 전달 계약이 실제로 동작함을 의미합니다. 전체 harness, judge, 라운드별 결과 모두 공개.",
  },
  comparison: {
    num: "07",
    eyebrow: "왜 다른가",
    title: "벤더 메모리도, 에이전트 메모리도 아닙니다.",
    lede: "memory.wiki는 URL 전달 계층. 당신이 콘텐츠를 author하고, 어떤 AI든 그걸 가져갑니다. 인접한 두 카테고리는 다른 문제를 풉니다.",
    columns: ["", "벤더 메모리", "에이전트 메모리 저장소", "memory.wiki"],
    rows: [
      { feature: "첫 사용자",      vals: ["AI 자동 추출",    "AI 에이전트",      "사람"]                    },
      { feature: "인터페이스",     vals: ["한 도구 안",      "SDK 또는 MCP",     "공개 URL"]                },
      { feature: "가시성",         vals: ["블랙박스",        "블랙박스",         "사람이 읽는 마크다운"]    },
      { feature: "Cross-vendor",   vals: ["no",              "no",               "yes"]                     },
      { feature: "공유",           vals: ["no",              "개인 또는 팀",     "공개 URL, 누구나 읽음"]   },
      { feature: "소유권",         vals: ["벤더",            "백엔드 서비스",    "당신"]                    },
    ],
    footnote: "벤더 메모리(ChatGPT memory, Claude projects)는 한 도구 안에 갇혀 있고, 에이전트 메모리(mem0, Letta, OpenAI Memory)는 에이전트가 기억을 가져오는 백엔드 저장소입니다. memory.wiki는 그 위 한 단계 위에 있는 URL 전달 계층이며, 모든 AI에 deploy 가능합니다.",
  },
  roadmap: {
    num: "08",
    eyebrow: "로드맵",
    title: "memory.wiki가 향하는 곳.",
    lede: "현재 모든 표면이 private 베타. 9개 표면 동시 출시 wave는 2026년 늦여름.",
    items: [
      { tag: "Shipped", title: "오늘",  body: "모든 캡처/조회 표면에 라이브. 제품이 end-to-end 동작.",  bullets: ["Doc, Bundle, Hub URL 기본 단위", "7개 캡처 표면 (Web, Chrome, VS Code, Mac, CLI, MCP, QuickLook)", "BM25 + 벡터 하이브리드 recall", "Cross-AI 공개 평가, 재현 가능"], badge: "지금 라이브" },
      { tag: "Beta",    title: "다음",  body: "v8 빌드 윈도 동안 출시.",                                  bullets: ["모바일 네이티브 (iOS, Android), Tier 1", "이중 네임스페이스 번들 (My, AI)", "엔트리별 출처 레이어", "First-paste magic 플로우"],   badge: "2026.08" },
      { tag: "Beyond",  title: "비전",  body: "출시 후 arc, v9 이후.",                                    bullets: ["Bundle Spec RFC, 오픈 표준", "팀 워크스페이스와 공유 지식", "Deep partnership 통합", "엔터프라이즈 self-host"],     badge: "출시 후" },
    ],
  },
  pricing: {
    num: "09",
    eyebrow: "가격",
    title: "Free로 거의 다 됩니다. Pro는 프라이버시와 스토리지.",
    tiers: [
      { name: "Free", badge: "Always", sub: "공개 지식 무제한. 모든 앱 지원.", items: [
        { text: "무제한 문서" },
        { text: "공개 문서, 공개 허브" },
        { text: "모든 네이티브 앱 (Web, Chrome, VS Code, Mac, iOS, Android, CLI, MCP)" },
        { text: "AI 자동 정리 (태그, 클러스터, 요약)" },
        { text: "Cross-AI 읽기 (Claude, ChatGPT, Gemini, Cursor, Codex)" },
        { text: "기본 이미지 스토리지" },
      ]},
      { name: "Pro", badge: "TBD", badgeColor: "lime", sub: "권한 설정, 커스텀 도메인, 넉넉한 스토리지.", highlighted: true, items: [
        { text: "Free의 모든 기능" },
        { text: "비공개 문서, 비공개 허브" },
        { text: "문서/번들별 권한 설정 (허용 이메일)" },
        { text: "커스텀 도메인" },
        { text: "넉넉한 이미지/파일 스토리지" },
        { text: "쓰기 권한 포함 MCP 서버" },
        { text: "Custom GPT 통합" },
      ]},
      { name: "Team", badge: "v9", badgeColor: "ai", sub: "Per-seat, 공유 워크스페이스.", items: [
        { text: "Pro의 모든 기능" },
        { text: "멀티-테넌트 워크스페이스" },
        { text: "문서/번들 실시간 협업" },
        { text: "역할 기반 접근" },
        { text: "SSO와 SAML" },
        { text: "Per-seat 청구" },
        { text: "감사 로그" },
        { text: "PMF 이후 6~12개월 내", faint: true },
      ]},
    ],
  },
  howSummary: {
    eyebrow: "실제로 어떻게 동작하나",
    line: "문서 → 번들 → 허브. 어디든 URL. 처음부터 끝까지 markdown.",
    bullets: [
      "채팅 캡처 → 영구 URL, 버전 1, edit token 반환.",
      "N개 문서 선택 → cross-doc 분석이 캐시된 번들 URL.",
      "memory.wiki/@you 허브가 llms.txt 매니페스트를 자동 발행. 업데이트는 자동 전파.",
    ],
    cta: "전체 walkthrough 읽기",
    ctaHref: "/how",
  },
  trust: {
    items: [
      { label: "영구 보존",       body: "URL은 만료되지 않습니다. 영구 보존은 기능 토글이 아니라 정책입니다." },
      { label: "AI 학습 사용 안 함", body: "당신의 콘텐츠는 어떤 모델의 학습에도 사용되지 않습니다. 공개 문서는 읽기용이지, 학습 데이터가 아닙니다." },
      { label: "언제든 export",   body: "모든 것이 plain markdown. CLI 한 줄로 일괄 추출. 락인 없음." },
      { label: "오픈 표준",       body: "Bundle Spec은 공개 RFC로 출시됩니다. 포맷이 제품보다 오래 갑니다." },
    ],
  },
  faq: {
    num: "10",
    eyebrow: "FAQ",
    title: "자주 묻는 질문.",
    lede: "여기서 답을 못 찾으셨다면 hi@raymind.ai 로 연락 주세요.",
    items: [
      {
        q: "Notion, Obsidian, Roam과는 어떻게 다른가요?",
        a: "지식 도구들은 사람의 읽기와 편집을 최적화합니다. memory.wiki는 AI 전달을 최적화합니다. 모든 URL이 clean markdown으로, 인증과 속도 제한 없이 fetch되어 어떤 AI든 바로 ingest할 수 있습니다. 저작은 Notion이나 Obsidian에서 계속하시고, memory.wiki는 ChatGPT, Claude, Cursor에 실제로 붙여 넣는 URL이 사는 곳입니다.",
      },
      {
        q: "제 콘텐츠가 AI 학습에 사용되나요?",
        a: "아니요. 문서는 있는 그대로 저장되고 제공됩니다. 어떤 모델 학습에도 사용하지 않으며, 공개 read 엔드포인트는 전달 계약이지 학습 파이프라인이 아닙니다. Cross-AI 평가도 학습 데이터 겹침을 배제하기 위해 학습에서 본 적 없는 unseen 허브를 사용합니다.",
      },
      {
        q: "Pro를 해지하면 제 문서는 어떻게 되나요?",
        a: "기존 문서는 영구 URL에 그대로 남습니다. 새 캡처는 무료 한도로 돌아가지만, 이전에 발행한 모든 것은 계속 작동합니다. URL은 플랜과 무관하게 영구입니다.",
      },
      {
        q: "모든 걸 export 할 수 있나요?",
        a: "예. CLI의 `mw export`로 모든 문서를 markdown 파일과 번들/허브 구조 JSON 인덱스로 한 번에 받습니다. 독자 포맷도, 복원 단계도 없습니다.",
      },
      {
        q: "오픈소스인가요?",
        a: "Bundle Spec은 공개 RFC로 출시되어 데이터 포맷이 제품보다 오래 갑니다. 레퍼런스 렌더러(markdown-it 파이프라인)와 CLI 클라이언트는 MIT 라이선스입니다. 호스팅된 허브와 AI 오케스트레이션은 비공개입니다.",
      },
      {
        q: "오프라인에서 동작하나요?",
        a: "Mac, iOS, Android 앱은 로컬 캐시로 오프라인 동작하고, 연결되면 동기화됩니다. CLI는 read와 stage가 오프라인 가능하며 publish는 네트워크가 필요합니다. 웹 에디터는 연결이 필요합니다.",
      },
      {
        q: "데이터 소유권은 누구에게 있나요?",
        a: "당신입니다. memory.wiki는 전달 계층이지 소유자가 아닙니다. markdown, URL, 다른 곳으로 옮길 권리 모두 당신이 가집니다. 콘텐츠를 재라이선싱하거나 재판매하지 않습니다.",
      },
    ],
  },
  emailSignup: {
    eyebrow: "출시 알림",
    title: "공개 출시 때 이메일 한 통.",
    lede: "memory.wiki는 2026년 8월에 모든 사용자에게 공개됩니다. 메일 한 통, 스팸 없음, 한 번 클릭으로 해지.",
    placeholder: "your@email.com",
    button: "알림 받기",
    buttonSending: "보내는 중…",
    successMsg: "등록되었습니다. 출시 때 알려드릴게요.",
    errorMsg: "문제가 생겼습니다. 다시 시도하거나 hi@raymind.ai 로 연락주세요.",
    privacyNote: "출시 때 한 통, 그 외엔 없음.",
  },
  manifesto: {
    eyebrow: "더 큰 그림",
    lede: "memory.wiki 뒤의 thesis, v8로 이어진 전략 체인, 출시 후의 방향.",
    cta: "선언문 읽기",
  },
  cta: {
    eyebrow: "준비됨",
    heading: "허브를 시작하세요.",
    lede: "베타 동안 무료. 가입 없이 시도 가능. 마크다운을 붙여넣으면 3초 만에 Document URL.",
    button: "허브 시작하기",
  },
  footer: {
    columns: [
      { title: "제품",       links: [
        { label: "워크스페이스", href: "/" },
        { label: "허브",         href: "/hubs" },
        { label: "Spec",         href: "/ko/spec" },
      ]},
      { title: "표면",       links: [
        { label: "웹 에디터", href: "/" },
        { label: "Chrome",   href: "/ko/plugins#chrome" },
        { label: "VS Code",  href: "/ko/plugins#vscode" },
        { label: "Mac App",  href: "/ko/plugins#desktop" },
        { label: "CLI",      href: "/ko/plugins#cli" },
        { label: "MCP",      href: "/ko/plugins#mcp" },
      ]},
      { title: "리소스",     links: [
        { label: "소개",     href: "/ko/about" },
        { label: "사용 사례", href: "/cases" },
        { label: "벤치마크", href: "/benchmark" },
        { label: "선언문",   href: "/ko/manifesto" },
        { label: "문서",     href: "/ko/docs" },
        { label: "GitHub",   href: "https://github.com/raymindai/memory-wiki" },
      ]},
      { title: "법적 고지",  links: [
        { label: "개인정보처리방침", href: "/privacy" },
        { label: "이용 약관",        href: "/terms" },
      ]},
      { title: "연락처",     links: [
        { label: "hi@raymind.ai", href: "mailto:hi@raymind.ai" },
      ]},
    ],
    bottomLeft: "Raymind.AI 가 만든 제품",
    bottomRight: "© 2026 memory.wiki. All rights reserved.",
    tagline: "AI 시대의 개인 지식 허브.",
    parent: { label: "Raymind.AI 가 만든 제품", href: "https://raymind.ai" },
  },
  surfacesInput: [
    { name: "Chrome",  brand: "chrome",  href: "/ko/plugins#chrome"  },
    { name: "VS Code", brand: "vscode",  href: "/ko/plugins#vscode"  },
    { name: "Cursor",  brand: "cursor",  href: "/ko/plugins#mcp"     },
    { name: "Claude",  brand: "claude",  href: "/ko/plugins#mcp"     },
    { name: "Mac App", brand: "mac",     href: "/ko/plugins#desktop" },
    { name: "CLI",     brand: "cli",     href: "/ko/plugins#cli"     },
    { name: "MCP",     brand: "mcp",     href: "/ko/plugins#mcp"     },
  ],
  surfacesOutput: [
    { name: "Claude",  brand: "claude"  },
    { name: "ChatGPT", brand: "chatgpt" },
    { name: "Gemini",  brand: "gemini"  },
    { name: "Cursor",  brand: "cursor"  },
    { name: "Codex",   brand: "codex"   },
    { name: "Copilot", brand: "copilot" },
    { name: "VS Code", brand: "vscode"  },
    { name: "Browser", brand: "browser" },
  ],
  trustChips: [
    { label: "Claude",  brand: "claude"  },
    { label: "ChatGPT", brand: "chatgpt" },
    { label: "Gemini",  brand: "gemini"  },
    { label: "Cursor",  brand: "cursor"  },
    { label: "Codex",   brand: "codex"   },
  ],
  trustMore: { label: "+ more", href: "/benchmark" },
};

export function getAboutContent(locale: Locale): AboutContent {
  return locale === "ko" ? aboutKo : aboutEn;
}
