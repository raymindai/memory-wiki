/**
 * Manifesto page content — en + ko single source of truth.
 * Migrated from lib/i18n/manifesto.ts when /manifesto was ported to
 * the Pure design system.
 */

export type Locale = "en" | "ko";

export interface ManifestoSection {
  heading: string;
  paragraphs?: string[];           // HTML strings (rendered with dangerouslySetInnerHTML)
  list?: string[];                 // bullets, may contain HTML
  highlight?: string;              // pull-quote / blockquote
  afterHighlight?: string[];       // paragraphs after the highlight
  afterList?: string[];            // paragraphs after the list
}

export interface ManifestoContent {
  nav: { label: string; href: string }[];
  navCta: string;
  navCtaHref: string;
  hero: {
    readingTime: string;
    title: string;
    intro: string[];
  };
  sections: ManifestoSection[];
  beliefs: { eyebrow: string; title: string; lede: string; items: { title: string; body: string }[] };
  whyNow: { heading: string; paragraphs: string[] };
  roadmap: {
    heading: string;
    items: {
      phase: string;       // short tag, e.g. "Phase 1"
      title: string;       // short label, e.g. "Today" / "Next" / "Year 1"
      badge: "live" | "coming-soon" | "vision";
      badgeLabel: string;  // colored phase status, e.g. "LIVE"
      items: string;       // body text
    }[];
  };
  closing: { paragraphs: string[]; backLabel: string; backHref: string };
  footer: {
    columns: { title: string; links: { label: string; href: string }[] }[];
    bottomLeft: string;
    bottomRight: string;
    tagline: string;
    parent: { label: string; href: string };
  };
}

/* ─────────────────────────────────────────────────────────────
   ENGLISH
   ───────────────────────────────────────────────────────────── */

export const manifestoEn: ManifestoContent = {
  nav: [
    { label: "About",     href: "/about" },
    { label: "Benchmark", href: "/about#benchmark" },
    { label: "Manifesto", href: "/manifesto" },
    { label: "Docs",      href: "/docs" },
  ],
  navCta: "Start your hub",
  navCtaHref: "/",
  hero: {
    readingTime: "12 min read",
    title: "Why I'm building Memory.Wiki",
    intro: [
      "I started Memory.Wiki as a side project in early 2026. I went full-time on it in April. Six months in, it's a memory layer that any AI can read — not just a publishing tool.",
      "This is why.",
    ],
  },
  sections: [
    {
      heading: "The state of AI memory today",
      paragraphs: [
        "Every day, millions of people pour their thinking into ChatGPT, Claude, Gemini, and Cursor. We ask hard questions. We get back genuinely useful answers — strategies, code, frameworks, insights that took experts decades to develop.",
        "Then we close the tab.",
        "That answer is gone. Not literally — it sits in some chat history we'll never search. But functionally gone. We can't find it. We can't reuse it. We can't build on it.",
        "The next day, we ask similar questions. We get similar answers. We close the tab again.",
        "This is happening at civilizational scale. Trillions of tokens of high-quality, AI-assisted thinking, evaporating into chat histories nobody returns to. The world's most expensive forgetting machine.",
        "The industry's response so far is what I call <strong>extracted memory</strong> — services like Mem0 and Letta that watch your conversations and extract facts the AI thinks are important. \"Sarah is vegetarian. Sarah lives in Seoul. Sarah is interested in LLM evaluation.\"",
        "Mem0 and Letta are excellent at what they do. They solve a real problem. But they answer a different question than the one I want to answer.",
        "They ask: <em>what should the AI remember about you?</em>",
        "I want to ask: <em>what do you want to remember?</em>",
        "These are not the same question. The first is about inference. The second is about authorship.",
      ],
    },
    {
      heading: "Why authorship matters",
      paragraphs: [
        "Memory is not just data. Memory is identity.",
        "What you remember shapes who you become. What an organization remembers shapes what it can do. This was true in the age of paper, true in the age of databases, and is more true in the age of AI than ever before.",
        "When you let an AI extract your memory, you let an AI define what mattered. You let an algorithm decide which thread of yesterday's thinking is worth carrying forward, which insight to compress into a fact, which piece of yourself to keep.",
        "That's a strange thing to outsource.",
        "Some people will outsource it gladly. The convenience is real. But for those of us who think carefully about what we want our future selves to know — for those of us who treat our knowledge as a craft, not a byproduct — there should be another option.",
        "That option is Memory.Wiki.",
      ],
    },
    {
      heading: "What Memory.Wiki is today",
      paragraphs: [
        "If you visited Memory.Wiki right now, you'd see what looks like a markdown publishing tool — and it is.",
        "You can capture markdown from anywhere: ChatGPT, Claude, Gemini (via Chrome extension), GitHub repos, Notion pages, Obsidian vaults, any web URL, your terminal (<code>cat README.md | mw publish</code>), VS Code, your Mac clipboard. You can edit it in a beautiful WYSIWYG editor — no syntax friction, no install required. You can share it with a permanent URL that anyone can read in the browser, that any AI can fetch as context.",
        "It's a publishing tool. It works. People can use it today.",
        "And it's grown past the publishing layer. Every saved doc folds into a personal hub that auto-publishes a wiki manifest (index.md, SCHEMA.md, log.md), maintains a concept index across your library, and exposes a recall API any AI can query. The role-split is the load-bearing idea: you set the direction, Memory.Wiki structures the URL, any AI reads it.",
        "Shipped so far:",
      ],
      list: [
        "A unified markdown render pipeline (markdown-it) shared across every surface",
        "A web editor with WYSIWYG",
        "A Chrome extension for any AI chat",
        "VS Code extension, Mac desktop app, CLI, MCP server",
        "Five import surfaces: GitHub, Notion, Obsidian, URL, files",
        "Hub manifests — index.md / SCHEMA.md / log.md / llms.txt per hub",
        "Hub recall API with optional Haiku-based reranker",
        "Concept index + Related-in-your-hub + Needs-review lint",
        "Auto-classified doc intent (note / definition / decision / etc.)",
      ],
      afterList: [
        "I shipped this fast because I had a clear primitive: the markdown URL. Every surface points to the same thing. Every surface composes with the others.",
      ],
    },
    {
      heading: "The bigger bet",
      paragraphs: [
        "The bigger bet is that <strong>markdown URLs are the right substrate for AI-era knowledge</strong>.",
        "Not as a publishing tool. As infrastructure.",
        "LLMs read and write markdown natively. It's the lingua franca they were trained on. When ChatGPT outputs structured information, it outputs markdown. When you paste context into Claude, you paste markdown. When agents communicate with each other, the natural format is markdown. This is not changing. It's compounding.",
        "Humans also read markdown natively. Plain text formatted lightly is how we've taken notes for centuries. It's how we'll keep taking them. No proprietary format will displace it.",
        "URLs are the simplest possible interface. Anyone can paste them. Any agent can fetch them. They cross every boundary — operating systems, applications, AIs, time zones, decades.",
        "Andrej Karpathy put it the cleanest: <em>\"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase.\"</em> He drew it for the Obsidian shape. We drew it for the URL shape. Same insight, different deploy target — local files vs. a public address every AI can fetch.",
        "If LLMs write markdown, humans read markdown, and URLs cross every boundary, then the natural primitive for AI-era knowledge is <strong>a markdown document at a URL</strong>.",
      ],
    },
    {
      heading: "What's coming next",
      paragraphs: [
        "The memory layer is now live. Hub URLs, recall API, concept index, and the wiki manifests all shipped. What's left is the part that turns Memory.Wiki from a tool people learn into one they reach for without thinking.",
      ],
      highlight:
        "You should be able to take what you've authored and deploy it as context to any AI, anywhere — without remembering how Memory.Wiki works.",
      afterHighlight: [
        "Deeper ingest: Bear, Apple Notes, Roam, Drive. Native ingestion from every place people already keep notes, with the same dedup contract that makes re-importing safe.",
        "Sharper recall: latency budgets on the cross-encoder rerank, a hybrid scoring that the user can dial without reading docs, and citations that visibly improve the answer instead of just appearing under it.",
        "Cleaner curation: today the Needs-review lint surfaces orphan docs and likely duplicates. Next: stale claims, contradiction detection, missing cross-references — the lint signals Karpathy gestured at for his wiki, applied to yours.",
        "Plus the mundane work that ships a real product: payment, custom domains, branding, a public hub directory worth pointing other people at.",
      ],
    },
  ],
  beliefs: {
    eyebrow: "The seven beliefs",
    title: "What the product rests on.",
    lede: "These aren't features. They're the convictions that decide which features get built and which don't.",
    items: [
      { title: "Markdown is the right primitive.",                       body: "Not Notion blocks. Not proprietary formats. Plain markdown — what LLMs speak natively, what humans can read without a viewer." },
      { title: "URLs are the right interface.",                          body: "Not SDKs. Not vendor APIs. A URL — pastable, fetchable, openable by any human, by any AI, on any platform." },
      { title: "Memory is something you author.",                        body: "Not something extracted from your conversations behind your back. You write it. You edit it. You decide what stays." },
      { title: "AI is a collaborator, not just a tool.",                 body: "Ask AI to bundle docs about a topic. Review what it picked. Edit annotations. Save. Human + AI building knowledge together — not AI building knowledge for you in a black box." },
      { title: "Knowledge has scopes — Document, Bundle, Hub.",          body: "Same URL primitive at three scales. A single answer is a Document URL. A themed collection is a Bundle URL. Your entire knowledge is a Hub URL." },
      { title: "Memory should be deployable.",                           body: "Storage isn't the goal. A memory you can't paste back into an AI as context isn't doing the work memory is supposed to do. Every URL fetches as clean markdown context." },
      { title: "Open by default.",                                       body: "The whole repo is open source. The Bundle Spec is published openly. Open formats are how durable infrastructure gets built." },
    ],
  },
  whyNow: {
    heading: "Why now",
    paragraphs: [
      "Through 2024 and 2025 the industry shipped closed AI memory — OpenAI Memory inside ChatGPT, Google's Memory Bank inside Gemini, Anthropic's context window inside Claude. Each one is trying to own your memory inside its own walls.",
      "Cross-AI memory is structurally impossible for any of them to build. OpenAI won't ship a memory layer that serves Claude. Anthropic won't ship one that serves ChatGPT. It has to come from outside.",
      "By 2027 either the closed systems will have entrenched, or an open standard will have taken hold. I'm betting on the second outcome. I'm betting that markdown URLs become to AI memory what HTTP became to documents.",
      "Memory.Wiki exists to make that outcome more likely.",
    ],
  },
  roadmap: {
    heading: "The roadmap",
    items: [
      { phase: "Phase 1", title: "Today",     badge: "live",         badgeLabel: "LIVE",         items: "Document / Bundle / Hub URLs, multi-surface capture (Web, Chrome, VS Code, Desktop, CLI, MCP), AI-built concept index, WYSIWYG editor, free during beta." },
      { phase: "Phase 2", title: "v8 launch", badge: "coming-soon",  badgeLabel: "AUG 2026",     items: "iOS Share Sheet, AI-generated bundles, embedded chat with hub context, Bundle Spec v1.0 RFC. The cross-AI delivery thesis goes public." },
      { phase: "Phase 3", title: "Year 1",    badge: "vision",       badgeLabel: "VISION",       items: "First LLM-platform partnership. Public hub sharing + following feed. Voice capture from mobile. Team workspaces." },
      { phase: "Phase 4", title: "Year 2-3",  badge: "vision",       badgeLabel: "VISION",       items: "Bundle marketplace. Enterprise self-host. Standard-setting consortium around the URL-as-API primitive." },
    ],
  },
  closing: {
    paragraphs: [
      "Memory.Wiki is built by Hyunsang at <a href=\"https://raymind.ai\" target=\"_blank\" rel=\"noopener noreferrer\">Raymind.AI</a>.",
      "The codebase is <a href=\"https://github.com/raymindai/memory-wiki\" target=\"_blank\" rel=\"noopener noreferrer\">open source on GitHub</a>.",
      "The Bundle spec will be published before Phase 2 ships.",
      "Reach me at <a href=\"mailto:hi@raymind.ai\">hi@raymind.ai</a>.",
    ],
    backLabel: "← Back to product",
    backHref: "/about",
  },
  footer: {
    columns: [
      { title: "Product",   links: [
        { label: "Workspace", href: "/" },
        { label: "Hubs",      href: "/hubs" },
        { label: "Spec",      href: "/spec" },
      ]},
      { title: "Surfaces",  links: [
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
        { label: "Benchmark", href: "/about#benchmark" },
        { label: "Manifesto", href: "/manifesto" },
        { label: "Docs",      href: "/docs" },
        { label: "GitHub",    href: "https://github.com/raymindai/memory-wiki" },
      ]},
      { title: "Legal",     links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms",   href: "/terms" },
      ]},
      { title: "Contact",   links: [
        { label: "hi@raymind.ai", href: "mailto:hi@raymind.ai" },
      ]},
    ],
    bottomLeft: "A product of Raymind.AI",
    bottomRight: "© 2026 Memory.Wiki. All rights reserved.",
    tagline: "Personal knowledge hub for the AI era.",
    parent: { label: "A product of Raymind.AI", href: "https://raymind.ai" },
  },
};

/* ─────────────────────────────────────────────────────────────
   KOREAN
   ───────────────────────────────────────────────────────────── */

export const manifestoKo: ManifestoContent = {
  nav: [
    { label: "소개",     href: "/ko/about" },
    { label: "벤치마크", href: "/ko/about#benchmark" },
    { label: "선언문",   href: "/ko/manifesto" },
    { label: "문서",     href: "/ko/docs" },
  ],
  navCta: "허브 시작하기",
  navCtaHref: "/",
  hero: {
    readingTime: "12분",
    title: "내가 Memory.Wiki를 만드는 이유",
    intro: [
      "2026년 초 사이드프로젝트로 Memory.Wiki를 시작했습니다. 4월에 풀타임으로 전환했고, 6개월 차 — 이제 단순 퍼블리싱 도구가 아니라 어떤 AI든 읽을 수 있는 memory layer가 됐습니다.",
      "이게 그 이유입니다.",
    ],
  },
  sections: [
    {
      heading: "오늘날 AI memory의 현실",
      paragraphs: [
        "우리는 매일 AI와 대화합니다. ChatGPT, Claude, Gemini — 각각 다른 앱에서, 다른 포맷으로, 다른 방식으로. 좋은 답변을 받으면 복사해서 노트 앱에 붙여넣습니다. Google Docs에 옮기기도 하고, 슬랙에 공유하기도 합니다.",
        "그런데 돌아보면 — 그 지식은 어디에 있나요? 세 개의 AI 앱, 다섯 개의 노트 앱, 수십 개의 브라우저 탭에 흩어져 있습니다. 찾을 수 없고, 재사용할 수 없고, 공유할 수 없습니다.",
        "AI가 만든 지식은 만들어지는 순간 흩어집니다. 구조도 없고, 주소도 없고, 주인도 없습니다.",
      ],
    },
    {
      heading: "Authorship이 중요한 이유",
      paragraphs: [
        "AI는 텍스트를 생성합니다. 하지만 그 텍스트를 \"문서\"로 만드는 건 사람입니다. 구조를 잡고, 맥락을 더하고, 필요 없는 부분을 잘라내고, 자기 목소리를 입힙니다.",
        "이 과정이 authorship입니다. AI 출력물의 단순 추출이 아니라, 사람의 판단과 편집이 들어간 \"저작\"입니다.",
        "Memory.Wiki는 이 authorship을 지원하는 도구입니다. AI가 만든 원재료를 당신의 문서로 바꾸는 곳. 그리고 그 문서에 영구적인 URL을 부여하는 곳.",
      ],
    },
    {
      heading: "Memory.Wiki가 지금 무엇인가",
      paragraphs: [
        "Memory.Wiki는 마크다운 허브입니다. 어디서든 캡처하고, AI 도구로 편집하고, 영구 URL로 퍼블리시합니다.",
      ],
      list: [
        "<strong>캡처</strong> — Chrome Extension, VS Code, Mac App, CLI, 붙여넣기. 어떤 AI에서든, 어떤 에디터에서든, 원클릭으로.",
        "<strong>편집</strong> — WYSIWYG 편집, AI 도구 (요약, 번역, 다듬기), 버전 히스토리, 태그 & 폴더.",
        "<strong>퍼블리시</strong> — 영구 URL, 공개/비공개 설정, 비밀번호 보호, QR 코드, iframe 임베드.",
      ],
      afterList: [
        "markdown-it이 브라우저에서 직접 파싱합니다. KaTeX 수식, Mermaid 다이어그램, 190+ 언어 구문 강조가 포함됩니다. 로그인 없이 3초 안에 가치를 전달합니다.",
      ],
    },
    {
      heading: "더 큰 베팅",
      paragraphs: [
        "Memory.Wiki는 마크다운 도구로 시작하지만, 궁극적으로는 AI 시대의 memory layer를 만들려고 합니다.",
        "모든 AI 대화, 모든 메모, 모든 문서가 하나의 주소를 갖고, 하나의 장소에서 관리되고, 어떤 AI에든 컨텍스트로 전달될 수 있는 세계. 마크다운 URL이 AI 시대 지식의 substrate가 되는 세계.",
        "이건 단순한 에디터 만들기가 아닙니다. AI와 사람 사이의 인터페이스를 재정의하는 일입니다.",
      ],
    },
    {
      heading: "다음에 올 것",
      paragraphs: [],
      list: [
        "<strong>Bundle as context</strong> — 여러 문서를 하나의 번들로 묶어 AI에게 전달. \"이 프로젝트의 모든 문서를 읽어\"가 가능해집니다.",
        "<strong>MCP Server & REST API</strong> — 어떤 AI 에이전트든 Memory.Wiki 문서를 읽고, 쓰고, 업데이트할 수 있습니다.",
        "<strong>Hub 기반 knowledge memory</strong> — 컨셉 인덱스, Related-in-your-hub, Needs-review lint으로 개인 위키가 자라납니다.",
      ],
    },
  ],
  beliefs: {
    eyebrow: "일곱 가지 belief",
    title: "제품이 서있는 기둥.",
    lede: "이건 기능이 아닙니다. 어떤 기능을 만들고 어떤 걸 안 만들지 결정하는 신념입니다.",
    items: [
      { title: "마크다운이 올바른 primitive다.",                body: "Notion 블록도, 독점 포맷도 아닙니다. 그냥 마크다운 — LLM이 native로 말하고, 사람이 뷰어 없이 읽을 수 있는 형식." },
      { title: "URL이 올바른 인터페이스다.",                    body: "SDK도, 벤더 API도 아닙니다. URL — 누구든, 어떤 AI든, 어디서든 paste하고 fetch하고 열 수 있습니다." },
      { title: "메모리는 당신이 작성하는 것이다.",              body: "대화 뒤에서 자동 추출되는 것이 아닙니다. 당신이 씁니다. 편집합니다. 무엇을 남길지 결정합니다." },
      { title: "AI는 도구가 아니라 collaborator다.",            body: "AI에게 주제 관련 docs를 묶어 달라고 요청하세요. 결과 검토. annotation 편집. 저장. Human + AI가 함께 지식을 만듭니다 — AI 혼자 블랙박스에서 만드는 게 아닙니다." },
      { title: "지식은 스코프가 있다 — Document, Bundle, Hub.", body: "같은 URL primitive, 세 가지 스케일. 한 답변은 Document URL. 주제별 컬렉션은 Bundle URL. 전체 지식은 Hub URL." },
      { title: "메모리는 deployable해야 한다.",                 body: "저장이 목적이 아닙니다. AI에 컨텍스트로 다시 paste 못하는 메모리는 메모리 역할을 못합니다. 모든 URL이 깨끗한 markdown 컨텍스트로 fetch됩니다." },
      { title: "Open by default.",                              body: "Memory.Wiki는 오픈소스. Bundle Spec은 공개 표준. Open format이 durable한 인프라를 만드는 방식입니다." },
    ],
  },
  whyNow: {
    heading: "왜 지금인가",
    paragraphs: [
      "2024~2025년, 업계는 닫힌 AI 메모리를 출시했습니다 — ChatGPT 안의 OpenAI Memory, Gemini 안의 Google Memory Bank, Claude의 컨텍스트 윈도우. 각자 자기 벽 안에서 당신의 메모리를 차지하려 합니다.",
      "Cross-AI 메모리는 어느 한 회사가 구조적으로 만들 수 없습니다. OpenAI는 Claude를 위한 memory layer를 출시하지 않습니다. Anthropic은 ChatGPT를 위한 걸 출시하지 않습니다. 외부에서 와야 합니다.",
      "2027년이면 닫힌 시스템이 굳거나, 열린 표준이 자리를 잡거나 둘 중 하나입니다. 저는 후자에 베팅합니다. HTTP가 문서의 열린 표준이 된 것처럼, 마크다운 URL이 AI 메모리의 열린 표준이 된다는 베팅.",
      "Memory.Wiki는 그 결과를 더 가능하게 만들기 위해 존재합니다.",
    ],
  },
  roadmap: {
    heading: "로드맵",
    items: [
      { phase: "Phase 1", title: "오늘",        badge: "live",         badgeLabel: "LIVE",       items: "Document / Bundle / Hub URL, multi-surface capture (Web, Chrome, VS Code, Desktop, CLI, MCP), AI 컨셉 인덱스, WYSIWYG 에디터. 베타 기간 무료." },
      { phase: "Phase 2", title: "v8 런치",     badge: "coming-soon",  badgeLabel: "2026.08",    items: "iOS Share Sheet, AI 자동 번들 생성, Hub 컨텍스트가 들어간 embedded chat, Bundle Spec v1.0 RFC. Cross-AI delivery 테제가 공식적으로 데뷰합니다." },
      { phase: "Phase 3", title: "Year 1",      badge: "vision",       badgeLabel: "VISION",     items: "첫 LLM 플랫폼 파트너십. 공개 Hub sharing + following feed. 모바일 voice capture. Team workspaces." },
      { phase: "Phase 4", title: "Year 2-3",    badge: "vision",       badgeLabel: "VISION",     items: "Bundle 마켓플레이스. 엔터프라이즈 self-host. URL-as-API primitive 표준화 컨소시엄." },
    ],
  },
  closing: {
    paragraphs: [
      "Memory.Wiki는 <a href=\"https://raymind.ai\" target=\"_blank\" rel=\"noopener noreferrer\">Raymind.AI</a>의 Hyunsang이 만듭니다.",
      "코드베이스는 <a href=\"https://github.com/raymindai/memory-wiki\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub에 오픈소스</a>로 공개되어 있습니다.",
      "Bundle spec은 Phase 2 출시 전에 공개됩니다.",
      "<a href=\"mailto:hi@raymind.ai\">hi@raymind.ai</a>로 연락 주세요.",
    ],
    backLabel: "← 제품으로 돌아가기",
    backHref: "/ko/about",
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
        { label: "벤치마크", href: "/ko/about#benchmark" },
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
    bottomRight: "© 2026 Memory.Wiki. All rights reserved.",
    tagline: "AI 시대의 개인 지식 허브.",
    parent: { label: "Raymind.AI 가 만든 제품", href: "https://raymind.ai" },
  },
};

export function getManifestoContent(locale: Locale): ManifestoContent {
  return locale === "ko" ? manifestoKo : manifestoEn;
}
