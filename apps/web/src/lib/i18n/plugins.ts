/* --- Plugins page translations --- */

export type PluginsTexts = ReturnType<typeof getPluginsTexts>;

export function getPluginsTexts(locale: "en" | "ko") {
  return texts[locale];
}

const texts = {
  en: {
    hero: {
      label: "Plugins & Extensions",
      h1_prefix: "Bring ",
      h1_accent: "Memory.Wiki",
      h1_suffix: " everywhere.",
      sub: "Six surfaces, one hub. Capture from any AI, edit anywhere, deploy the same URL to Claude, ChatGPT, Cursor, and Codex. Every plugin writes into the same hub \u2014 your AI memory stays portable across every tool.",
    },

    useCases: {
      heading: "What you can do",
      items: [
        {
          scenario: "Research across AIs",
          steps: "ChatGPT researches \u2192 Extension captures \u2192 memory.wiki/abc123 \u2192 Paste URL in Claude \u2192 Claude refines",
          why: "Move knowledge between AIs without copy-paste formatting nightmares. The document is the bridge.",
        },
        {
          scenario: "Capture \u2192 Publish \u2192 Share in 3 seconds",
          steps: "See a great AI response \u2192 Click Memory.Wiki button \u2192 Beautiful URL auto-generated \u2192 Send to anyone",
          why: "Recipient sees a polished document, not a raw chat screenshot. No app needed to view it.",
        },
        {
          scenario: "AI-readable document references",
          steps: "Publish to memory.wiki/abc123 \u2192 Tell any AI \"read memory.wiki/abc123\" \u2192 AI fetches and understands",
          why: "Memory.Wiki URLs work as context for any AI. Your documents become reusable knowledge across conversations.",
        },
        {
          scenario: "Preview any .md file in Finder",
          steps: "Select file \u2192 Press Space \u2192 Full rendering with code, math, diagrams \u2192 Click \"Open in Memory.Wiki\" to edit",
          why: "macOS QuickLook shows raw Markdown by default. Memory.Wiki QuickLook shows it beautifully rendered.",
        },
        {
          scenario: "Publish from your editor",
          steps: "Write in VS Code \u2192 Cmd+Shift+M preview \u2192 One command to publish \u2192 Share URL with team",
          why: "Never leave your editor. Write, preview, publish. The URL updates when you push changes.",
        },
        {
          scenario: "Build reports from multiple AI sessions",
          steps: "Capture ChatGPT analysis \u2192 Capture Claude code review \u2192 Capture Gemini summary \u2192 Combine in Memory.Wiki \u2192 Single URL",
          why: "Each AI has strengths. Combine outputs from multiple AIs into one professional document.",
        },
      ],
    },

    shortUrl: {
      heading: "Short URLs that AIs can read",
      desc: "Every Memory.Wiki document has a short URL. Share it with humans or paste it into any AI conversation. Claude, ChatGPT, and Gemini can all fetch and understand the content \u2014 your documents become reusable context across AI sessions and platforms.",
      note: "No login wall. No paywall. The URL works everywhere \u2014 browsers, AI chats, Slack, email, embeds.",
      exampleLabel: "Example",
      lines: [
        { speaker: "You:", text: "Read memory.wiki/abc123 and summarize the key points" },
        { speaker: "AI:", text: "Based on the document at memory.wiki/abc123, here are the key points..." },
        { speaker: "You:", text: "Now compare with memory.wiki/def456" },
      ],
    },

    chrome: {
      title: "Chrome Extension",
      subtitle: "Memory.Wiki \u2014 Publish AI Output",
      desc: "One-click capture from ChatGPT, Claude, and Gemini. Open any GitHub .md file in Memory.Wiki for beautiful rendering. Turn AI conversations into shareable documents. The captured URL works as context in other AI conversations.",
      ctaLabel: "Add to Chrome",
      features: [
        {
          title: "Platform Support",
          items: ["ChatGPT (chat.openai.com)", "Claude (claude.ai)", "Gemini (gemini.google.com)", "GitHub \u2014 any .md file"],
        },
        {
          title: "Capture Methods",
          items: ["Hover button \u2014 single AI response", "Popup \u2014 full conversation or selection", "GitHub \u2014 Open in Memory.Wiki button", "Right-click \u2014 any selected text"],
        },
        {
          title: "Smart Conversion",
          items: ["HTML \u2192 clean Markdown", "Code blocks preserved", "Tables, lists, headings", "User/Assistant formatting"],
        },
        {
          title: "Seamless Transfer",
          items: ["Small content \u2192 URL hash (instant)", "Large content \u2192 clipboard + toast", "Gzip compression (same as Memory.Wiki)", "Opens in Memory.Wiki editor"],
        },
      ],
      installHeading: "Install",
      installSteps: [
        "Download the extension package below",
        "Unzip the downloaded file",
        "Open chrome://extensions and enable Developer Mode (top right toggle)",
        "Click \"Load unpacked\" and select the unzipped folder",
        "Visit ChatGPT, Claude, or Gemini \u2014 the Memory.Wiki button appears",
      ],
      downloadLabel: "Download v2.0.0",
      downloadSize: "42 KB",
      guideLabel: "Quick Start Guide",
    },

    mcp: {
      title: "MCP Server",
      subtitle: "mdfy-mcp on npm",
      desc: "Connect any AI tool to Memory.Wiki. Create, read, update, and manage documents programmatically.",
      ctaLabel: "Add to Claude",
      terminal: {
        title: "Claude Code",
        lines: [
          { type: "prompt", label: "You: ", text: "Publish my meeting notes to Memory.Wiki" },
          { type: "output", label: "Claude: ", text: "I'll create the document now." },
          { type: "comment", text: '  mdfy_create({ markdown: "# Meeting Notes..." })' },
          { type: "success", text: "Document created:" },
          { type: "output", text: "  URL: ", url: "https://memory.wiki/abc123" },
          { type: "output", text: "  Status: publicly accessible" },
          { type: "prompt", label: "You: ", text: "Make it private" },
          { type: "comment", text: '  mdfy_publish({ id: "abc123", published: false })' },
          { type: "success", text: "Document is now private (draft)." },
        ],
      },
      features: [
        {
          title: "25 MCP Tools",
          items: [
            "6 core CRUD -- create, read, update, delete, list, search",
            "Append/prepend -- grow logs and journals",
            "Sections -- outline, extract, replace by heading",
            "Sharing -- password, expiry, email allowlist",
            "Versions -- history, restore, diff",
            "Folders, stats, recent, duplicate, import URL",
          ],
        },
        {
          title: "Compatibility",
          items: [
            "Claude Web (claude.ai) -- hosted HTTP MCP",
            "Claude Desktop / Claude Code -- stdio",
            "Cursor / Windsurf / Zed -- HTTP or stdio",
            "ChatGPT, Gemini, and any MCP client",
          ],
        },
        {
          title: "Developer Experience",
          items: ["Auto-managed edit tokens", "Zero config -- just npx mdfy-mcp", "JSON in, JSON out", "Full REST API fallback"],
        },
      ],
      installHeading: "Install",
      optionA: {
        label: "Option A \u2014 Claude Web / Cursor (hosted, no install)",
        desc: "Add this URL in your client\u2019s MCP / Connectors settings:",
      },
      optionB: {
        label: "Option B \u2014 Claude Desktop / Claude Code (local stdio)",
        desc_prefix: "Create",
        desc_file: ".mcp.json",
        desc_suffix: "in your project:",
      },
      footerLinks: {
        setupGuideLabel: "Setup Guide",
        npmLabel: "View on npm",
        guideLabel: "Quick Start Guide",
        apiRefLabel: "API Reference",
      },
    },

    vscode: {
      title: "VS Code Extension",
      subtitle: "Memory.Wiki \u2014 Markdown Publisher",
      desc: "WYSIWYG preview with Memory.Wiki rendering quality, cloud sync, and real-time collaboration. Edit directly in the rendered view, auto-push on save, and resolve conflicts with the built-in diff editor.",
      ctaLabel: "Install Extension",
      downloadVsixLabel: "Download .vsix",
      features: [
        {
          title: "WYSIWYG Preview",
          items: ["Cmd+Shift+M opens editable preview", "Click and type directly in rendered view", "Toolbar: bold, italic, headings, lists", "Dark/Light theme auto-detection"],
        },
        {
          title: "Cloud Sync",
          items: ["Auto-push on file save (2s debounce)", "Auto-pull when server changes detected", "Configurable polling interval (10-300s)", "Offline queue for failed pushes"],
        },
        {
          title: "Collaboration",
          items: ["Share URL \u2192 anyone can view/edit", "Server changes pull to local file", "Conflict detection \u2192 VS Code diff editor", "Three merge options: pull/push/diff"],
        },
        {
          title: "Editor Integration",
          items: [
            "Status bar: \u2713 synced / \u2191 pushing / \u2193 pulling",
            "OAuth login via browser redirect",
            ".mdfy.json sidecar for sync metadata",
            "Publish from command palette",
            "Sidebar with local/synced/cloud document bridge",
            "CodeMirror source view with GFM syntax highlighting",
            "View mode switcher (Live/Source)",
          ],
        },
      ],
      installHeading: "Install",
      installSteps: [
        "Download the .vsix file below",
        "Open VS Code, go to Extensions (Cmd+Shift+X)",
        "Click \u2022\u2022\u2022 menu > Install from VSIX... > select the downloaded file",
        "Open any .md file > Cmd+Shift+M to preview",
      ],
      guideLabel: "Quick Start Guide",
    },

    desktop: {
      title: "Memory.Wiki for Mac",
      subtitle: "Desktop app \u2014 Electron",
      desc: "Native macOS desktop app with full Memory.Wiki editing, local file support, and drag-and-drop import for PDF, Word, PowerPoint, Excel, and 10+ formats. Double-click any .md file to open it in Memory.Wiki.",
      ctaLabel: "Download for Mac",
      features: [
        {
          title: "Native File Integration",
          items: ["Double-click .md to open in Memory.Wiki", "Drag & drop any supported format", "Save back to local file (Cmd+Shift+S)", "Recent files dashboard"],
        },
        {
          title: "Multi-Format Import",
          items: ["Markdown, PDF, Word (.docx)", "PowerPoint (.pptx), Excel (.xlsx)", "HTML, CSV, JSON, XML, LaTeX", "RTF, reStructuredText, plain text"],
        },
        {
          title: "Full Memory.Wiki Editor",
          items: ["WYSIWYG + Source editing modes", "Cloud sync and sharing", "All rendering: code, math, diagrams", "Dark/Light theme"],
        },
        {
          title: "Desktop Experience",
          items: ["Native macOS title bar", "Single-instance with file handoff", "Keyboard shortcuts (Cmd+N/O/S)", "Offline fallback when disconnected"],
        },
      ],
      installHeading: "Install",
      installSteps: [
        "Download the DMG file below",
        "Open the DMG and drag Memory.Wiki to Applications",
        "Launch Memory.Wiki from Applications",
      ],
      downloadLabel: "Download for Mac",
      downloadSize: "97 MB (Apple Silicon)",
      appStoreLabel: "App Store (coming soon)",
      guideLabel: "Quick Start Guide",
    },

    cli: {
      title: "CLI Tool",
      subtitle: "Memory.Wiki \u2014 npm package",
      desc: "Publish Markdown from your terminal. Pipe from any command \u2014 tmux, AI assistants, git log, clipboard. Every output becomes a shareable URL.",
      installCmd: "npm install -g mdfy-cli",
      examples: [
        { cmd: "Memory.Wiki publish README.md", desc: "Publish a file and get a URL" },
        { cmd: 'echo "# Hello" | Memory.Wiki publish', desc: "Publish from stdin (pipe)" },
        { cmd: "tmux capture-pane -p | Memory.Wiki publish", desc: "Capture tmux pane" },
        { cmd: "pbpaste | Memory.Wiki publish", desc: "Publish clipboard contents" },
        { cmd: "Memory.Wiki pull abc123 -o doc.md", desc: "Download a document" },
        { cmd: "Memory.Wiki list", desc: "List your published documents" },
      ],
      guideLabel: "Quick Start Guide",
      npmLabel: "View on npm",
    },

    quicklook: {
      title: "macOS QuickLook",
      subtitle: "Preview .md files in Finder",
      desc: "Press Space on any .md file in Finder to see it beautifully rendered \u2014 GFM tables, syntax highlighting, math, and Mermaid diagrams. Click \u201cOpen in Memory.Wiki\u201d to edit in the desktop app or web editor. Bundled with Memory.Wiki for Mac; auto-installs to ~/Applications on first Desktop launch.",
      ctaLabel: "Get Memory.Wiki for Mac",
      features: [
        {
          title: "Full Rendering",
          items: ["GFM tables, task lists, footnotes", "190+ language syntax highlighting", "KaTeX math (inline + display)", "Mermaid diagrams"],
        },
        {
          title: "Offline Ready",
          items: ["Built-in Markdown renderer (no CDN needed)", "CDN enhancement when online", "Graceful fallback for all features", "Works in airplane mode"],
        },
        {
          title: "Native Integration",
          items: ["Matches macOS dark/light appearance", "\"Open in Memory.Wiki\" button (desktop app or web)", "Code copy buttons", "Theme toggle in preview"],
        },
        {
          title: "Zero Config",
          items: ["Install once, works system-wide", "All .md / .markdown files supported", "No background processes", "Lightweight QuickLook extension"],
        },
      ],
      installHeading: "Install",
      installSteps: [
        "Install Memory.Wiki for Mac (DMG link above) — QuickLook ships with it",
        "Open Memory.Wiki once — it copies MdfyQuickLook.app to ~/Applications automatically",
        "Go to System Settings > General > Login Items & Extensions > Quick Look, and enable Memory.Wiki",
        "Select any .md file in Finder and press Space",
      ],
      downloadLabel: "Get Memory.Wiki for Mac",
      downloadSize: "Bundled with Desktop DMG",
      includedLabel: "Included with Mac App",
      guideLabel: "Quick Start Guide",
    },

    roadmap: {
      heading: "On the Roadmap",
      items: [
        { name: "Obsidian Plugin", desc: "Publish Obsidian notes to Memory.Wiki with one command", status: "Planned" },
        { name: "Raycast Extension", desc: "Quick capture and publish from Raycast", status: "Planned" },
        { name: "Slack Bot", desc: "Share documents directly in Slack channels", status: "Planned" },
        { name: "Alfred Workflow", desc: "Capture clipboard and publish instantly", status: "Planned" },
        { name: "iOS / Android", desc: "Share sheet integration for mobile publishing", status: "Planned" },
      ],
    },

    cta: {
      text: "Want to build a plugin? The engine is open source.",
      githubLabel: "View on GitHub",
      editorLabel: "Open Editor",
    },
  },

  ko: {
    hero: {
      label: "Plugins & Extensions",
      h1_prefix: "",
      h1_accent: "Memory.Wiki",
      h1_suffix: "를 어디서든.",
      sub: "6개 surface, 하나의 허브. 어떤 AI에서든 캡처하고, 어디서든 편집하고, 같은 URL을 Claude·ChatGPT·Cursor·Codex에 deploy 하세요. 모든 플러그인이 같은 허브로 쌓이며 \u2014 AI 메모리가 도구를 갈아끼워도 그대로 유지됩니다.",
    },

    useCases: {
      heading: "이런 것들을 할 수 있습니다",
      items: [
        {
          scenario: "AI 간 리서치",
          steps: "ChatGPT 리서치 \u2192 Extension 캡처 \u2192 memory.wiki/abc123 \u2192 Claude에 URL 붙여넣기 \u2192 Claude가 다듬기",
          why: "복사-붙여넣기 포맷 깨짐 없이 AI 간 지식을 이동하세요. 문서가 다리 역할을 합니다.",
        },
        {
          scenario: "캡처 \u2192 퍼블리시 \u2192 공유까지 3초",
          steps: "좋은 AI 응답 발견 \u2192 Memory.Wiki 버튼 클릭 \u2192 깔끔한 URL 자동 생성 \u2192 누구에게든 전송",
          why: "받는 사람은 채팅 스크린샷이 아닌 깔끔한 문서를 봅니다. 보기 위해 앱이 필요 없습니다.",
        },
        {
          scenario: "AI가 읽을 수 있는 문서 참조",
          steps: "memory.wiki/abc123에 퍼블리시 \u2192 아무 AI에게 \"memory.wiki/abc123 읽어줘\" \u2192 AI가 가져와서 이해",
          why: "Memory.Wiki URL은 어떤 AI에서든 컨텍스트로 작동합니다. 문서가 대화 간 재사용 가능한 지식이 됩니다.",
        },
        {
          scenario: "Finder에서 .md 파일 미리보기",
          steps: "파일 선택 \u2192 Space 누르기 \u2192 코드, 수식, 다이어그램까지 완전 렌더링 \u2192 \"Open in Memory.Wiki\" 클릭으로 편집",
          why: "macOS QuickLook은 기본적으로 원시 Markdown을 보여줍니다. Memory.Wiki QuickLook은 아름답게 렌더링합니다.",
        },
        {
          scenario: "에디터에서 바로 퍼블리시",
          steps: "VS Code에서 작성 \u2192 Cmd+Shift+M 미리보기 \u2192 한 번의 명령으로 퍼블리시 \u2192 팀에 URL 공유",
          why: "에디터를 떠나지 마세요. 작성, 미리보기, 퍼블리시. 변경사항을 push하면 URL이 업데이트됩니다.",
        },
        {
          scenario: "여러 AI 세션에서 리포트 작성",
          steps: "ChatGPT 분석 캡처 \u2192 Claude 코드 리뷰 캡처 \u2192 Gemini 요약 캡처 \u2192 Memory.Wiki에서 합치기 \u2192 하나의 URL",
          why: "각 AI마다 강점이 있습니다. 여러 AI의 출력을 하나의 전문적인 문서로 합치세요.",
        },
      ],
    },

    shortUrl: {
      heading: "AI가 읽을 수 있는 짧은 URL",
      desc: "모든 Memory.Wiki 문서는 짧은 URL을 가집니다. 사람에게 공유하거나 AI 대화에 붙여넣으세요. Claude, ChatGPT, Gemini 모두 콘텐츠를 가져와 이해할 수 있습니다 \u2014 문서가 AI 세션과 플랫폼 간 재사용 가능한 컨텍스트가 됩니다.",
      note: "로그인 없음. 유료 결제 없음. URL은 어디서든 작동합니다 \u2014 브라우저, AI 채팅, Slack, 이메일, 임베드.",
      exampleLabel: "Example",
      lines: [
        { speaker: "You:", text: "memory.wiki/abc123을 읽고 핵심 포인트를 요약해줘" },
        { speaker: "AI:", text: "memory.wiki/abc123 문서를 기반으로, 핵심 포인트는..." },
        { speaker: "You:", text: "이제 memory.wiki/def456과 비교해줘" },
      ],
    },

    chrome: {
      title: "Chrome Extension",
      subtitle: "Memory.Wiki \u2014 AI 출력 퍼블리시",
      desc: "ChatGPT, Claude, Gemini에서 한 번의 클릭으로 캡처. GitHub의 모든 .md 파일을 Memory.Wiki에서 아름답게 렌더링. AI 대화를 공유 가능한 문서로 변환합니다. 캡처된 URL은 다른 AI 대화의 컨텍스트로 사용됩니다.",
      ctaLabel: "Add to Chrome",
      features: [
        {
          title: "플랫폼 지원",
          items: ["ChatGPT (chat.openai.com)", "Claude (claude.ai)", "Gemini (gemini.google.com)", "GitHub \u2014 모든 .md 파일"],
        },
        {
          title: "캡처 방식",
          items: ["호버 버튼 \u2014 단일 AI 응답", "팝업 \u2014 전체 대화 또는 선택 영역", "GitHub \u2014 Open in Memory.Wiki 버튼", "우클릭 \u2014 선택한 텍스트"],
        },
        {
          title: "스마트 변환",
          items: ["HTML \u2192 깔끔한 Markdown", "코드 블록 보존", "테이블, 리스트, 제목", "사용자/어시스턴트 포맷팅"],
        },
        {
          title: "매끄러운 전송",
          items: ["작은 콘텐츠 \u2192 URL hash (즉시)", "큰 콘텐츠 \u2192 클립보드 + 토스트", "Gzip 압축 (Memory.Wiki와 동일)", "Memory.Wiki 에디터에서 열기"],
        },
      ],
      installHeading: "설치",
      installSteps: [
        "아래에서 확장 프로그램 패키지를 다운로드하세요",
        "다운로드한 파일의 압축을 해제하세요",
        "chrome://extensions를 열고 개발자 모드를 활성화하세요 (우측 상단 토글)",
        "\"압축 해제된 확장 프로그램을 로드합니다\"를 클릭하고 압축 해제된 폴더를 선택하세요",
        "ChatGPT, Claude, 또는 Gemini를 방문하면 Memory.Wiki 버튼이 나타납니다",
      ],
      downloadLabel: "Download v2.0.0",
      downloadSize: "42 KB",
      guideLabel: "Quick Start Guide",
    },

    mcp: {
      title: "MCP Server",
      subtitle: "mdfy-mcp on npm",
      desc: "어떤 AI 도구든 Memory.Wiki에 연결하세요. 문서를 프로그래밍 방식으로 생성, 읽기, 수정, 관리합니다.",
      ctaLabel: "Add to Claude",
      terminal: {
        title: "Claude Code",
        lines: [
          { type: "prompt", label: "You: ", text: "내 회의 노트를 Memory.Wiki에 퍼블리시해줘" },
          { type: "output", label: "Claude: ", text: "지금 문서를 생성하겠습니다." },
          { type: "comment", text: '  mdfy_create({ markdown: "# Meeting Notes..." })' },
          { type: "success", text: "문서 생성 완료:" },
          { type: "output", text: "  URL: ", url: "https://memory.wiki/abc123" },
          { type: "output", text: "  Status: publicly accessible" },
          { type: "prompt", label: "You: ", text: "비공개로 바꿔줘" },
          { type: "comment", text: '  mdfy_publish({ id: "abc123", published: false })' },
          { type: "success", text: "문서가 비공개(draft)로 변경되었습니다." },
        ],
      },
      features: [
        {
          title: "25개 MCP 도구",
          items: [
            "6개 핵심 CRUD -- 생성, 읽기, 수정, 삭제, 목록, 검색",
            "Append/prepend -- 로그와 저널 추가",
            "섹션 -- 아웃라인, 추출, 제목별 교체",
            "공유 -- 비밀번호, 만료, 이메일 허용 목록",
            "버전 -- 히스토리, 복원, diff",
            "폴더, 통계, 최근 문서, 복제, URL 임포트",
          ],
        },
        {
          title: "호환성",
          items: [
            "Claude Web (claude.ai) -- 호스팅 HTTP MCP",
            "Claude Desktop / Claude Code -- stdio",
            "Cursor / Windsurf / Zed -- HTTP 또는 stdio",
            "ChatGPT, Gemini 및 모든 MCP 클라이언트",
          ],
        },
        {
          title: "개발자 경험",
          items: ["자동 관리되는 edit token", "설정 불필요 -- npx mdfy-mcp만 실행", "JSON 입력, JSON 출력", "전체 REST API 폴백"],
        },
      ],
      installHeading: "설치",
      optionA: {
        label: "옵션 A \u2014 Claude Web / Cursor (호스팅, 설치 불필요)",
        desc: "클라이언트의 MCP / Connectors 설정에 이 URL을 추가하세요:",
      },
      optionB: {
        label: "옵션 B \u2014 Claude Desktop / Claude Code (로컬 stdio)",
        desc_prefix: "프로젝트에",
        desc_file: ".mcp.json",
        desc_suffix: "파일을 생성하세요:",
      },
      footerLinks: {
        setupGuideLabel: "Setup Guide",
        npmLabel: "View on npm",
        guideLabel: "Quick Start Guide",
        apiRefLabel: "API Reference",
      },
    },

    vscode: {
      title: "VS Code Extension",
      subtitle: "Memory.Wiki \u2014 Markdown Publisher",
      desc: "Memory.Wiki 렌더링 품질의 WYSIWYG 미리보기, 클라우드 싱크, 실시간 협업. 렌더된 뷰에서 직접 편집하고, 저장 시 자동 push, 내장 diff 에디터로 충돌을 해결합니다.",
      ctaLabel: "Install Extension",
      downloadVsixLabel: "Download .vsix",
      features: [
        {
          title: "WYSIWYG 미리보기",
          items: ["Cmd+Shift+M으로 편집 가능한 미리보기 열기", "렌더된 뷰에서 직접 클릭하고 타이핑", "툴바: 볼드, 이탤릭, 제목, 리스트", "다크/라이트 테마 자동 감지"],
        },
        {
          title: "클라우드 싱크",
          items: ["파일 저장 시 자동 push (2초 디바운스)", "서버 변경 감지 시 자동 pull", "폴링 간격 설정 가능 (10-300초)", "실패한 push를 위한 오프라인 큐"],
        },
        {
          title: "협업",
          items: ["URL 공유 \u2192 누구나 보기/편집 가능", "서버 변경사항을 로컬 파일로 pull", "충돌 감지 \u2192 VS Code diff 에디터", "세 가지 병합 옵션: pull/push/diff"],
        },
        {
          title: "에디터 통합",
          items: [
            "상태 바: \u2713 synced / \u2191 pushing / \u2193 pulling",
            "브라우저 리디렉트를 통한 OAuth 로그인",
            ".mdfy.json 사이드카 파일로 싱크 메타데이터",
            "커맨드 팔레트에서 퍼블리시",
            "로컬/싱크/클라우드 문서 브릿지 사이드바",
            "GFM 구문 강조가 있는 CodeMirror 소스 뷰",
            "뷰 모드 전환기 (Live/Source)",
          ],
        },
      ],
      installHeading: "설치",
      installSteps: [
        "아래에서 .vsix 파일을 다운로드하세요",
        "VS Code를 열고, Extensions로 이동 (Cmd+Shift+X)",
        "\u2022\u2022\u2022 메뉴 > Install from VSIX... > 다운로드한 파일 선택",
        "아무 .md 파일을 열고 > Cmd+Shift+M으로 미리보기",
      ],
      guideLabel: "Quick Start Guide",
    },

    desktop: {
      title: "Memory.Wiki for Mac",
      subtitle: "Desktop app \u2014 Electron",
      desc: "Memory.Wiki의 모든 편집 기능을 갖춘 네이티브 macOS 데스크톱 앱. 로컬 파일 지원, PDF, Word, PowerPoint, Excel 등 10개 이상의 포맷을 드래그 앤 드롭으로 임포트. .md 파일을 더블클릭하면 Memory.Wiki에서 열립니다.",
      ctaLabel: "Download for Mac",
      features: [
        {
          title: "네이티브 파일 통합",
          items: [".md 더블클릭으로 Memory.Wiki에서 열기", "지원하는 모든 포맷 드래그 & 드롭", "로컬 파일로 저장 (Cmd+Shift+S)", "최근 파일 대시보드"],
        },
        {
          title: "다중 포맷 임포트",
          items: ["Markdown, PDF, Word (.docx)", "PowerPoint (.pptx), Excel (.xlsx)", "HTML, CSV, JSON, XML, LaTeX", "RTF, reStructuredText, 일반 텍스트"],
        },
        {
          title: "전체 Memory.Wiki 에디터",
          items: ["WYSIWYG + 소스 편집 모드", "클라우드 싱크 및 공유", "모든 렌더링: 코드, 수식, 다이어그램", "다크/라이트 테마"],
        },
        {
          title: "데스크톱 경험",
          items: ["네이티브 macOS 타이틀 바", "파일 핸드오프가 있는 싱글 인스턴스", "키보드 단축키 (Cmd+N/O/S)", "연결 해제 시 오프라인 폴백"],
        },
      ],
      installHeading: "설치",
      installSteps: [
        "아래에서 DMG 파일을 다운로드하세요",
        "DMG를 열고 Memory.Wiki를 Applications로 드래그하세요",
        "Applications에서 Memory.Wiki를 실행하세요",
      ],
      downloadLabel: "Download for Mac",
      downloadSize: "97 MB (Apple Silicon)",
      appStoreLabel: "App Store (coming soon)",
      guideLabel: "Quick Start Guide",
    },

    cli: {
      title: "CLI Tool",
      subtitle: "Memory.Wiki \u2014 npm package",
      desc: "터미널에서 Markdown을 퍼블리시하세요. tmux, AI 어시스턴트, git log, 클립보드 등 어떤 명령이든 파이프하세요. 모든 출력이 공유 가능한 URL이 됩니다.",
      installCmd: "npm install -g mdfy-cli",
      examples: [
        { cmd: "Memory.Wiki publish README.md", desc: "파일을 퍼블리시하고 URL 받기" },
        { cmd: 'echo "# Hello" | Memory.Wiki publish', desc: "stdin에서 퍼블리시 (파이프)" },
        { cmd: "tmux capture-pane -p | Memory.Wiki publish", desc: "tmux 패인 캡처" },
        { cmd: "pbpaste | Memory.Wiki publish", desc: "클립보드 내용 퍼블리시" },
        { cmd: "Memory.Wiki pull abc123 -o doc.md", desc: "문서 다운로드" },
        { cmd: "Memory.Wiki list", desc: "퍼블리시한 문서 목록 보기" },
      ],
      guideLabel: "Quick Start Guide",
      npmLabel: "View on npm",
    },

    quicklook: {
      title: "macOS QuickLook",
      subtitle: "Finder에서 .md 파일 미리보기",
      desc: "Finder에서 아무 .md 파일에 Space를 눌러 아름답게 렌더링된 결과를 보세요 \u2014 GFM 테이블, 구문 강조, 수식, Mermaid 다이어그램. \u201cOpen in Memory.Wiki\u201d를 클릭해 데스크톱 앱이나 웹 에디터에서 편집하세요.",
      ctaLabel: "Download QuickLook",
      features: [
        {
          title: "전체 렌더링",
          items: ["GFM 테이블, 작업 목록, 각주", "190개 이상 언어 구문 강조", "KaTeX 수식 (인라인 + 디스플레이)", "Mermaid 다이어그램"],
        },
        {
          title: "오프라인 지원",
          items: ["내장 Markdown 렌더러 (CDN 불필요)", "온라인 시 CDN으로 향상", "모든 기능의 우아한 폴백", "비행기 모드에서도 작동"],
        },
        {
          title: "네이티브 통합",
          items: ["macOS 다크/라이트 모드 자동 매칭", "\"Open in Memory.Wiki\" 버튼 (데스크톱 앱 또는 웹)", "코드 복사 버튼", "미리보기 내 테마 토글"],
        },
        {
          title: "설정 불필요",
          items: ["한 번 설치하면 시스템 전체에서 작동", "모든 .md / .markdown 파일 지원", "백그라운드 프로세스 없음", "경량 QuickLook 확장"],
        },
      ],
      installHeading: "설치",
      installSteps: [
        "Memory.Wiki for Mac (위 DMG 링크) 설치 — QuickLook이 함께 들어있음",
        "Memory.Wiki을 한 번 실행 — MdfyQuickLook.app을 ~/Applications에 자동 복사",
        "시스템 설정 > 일반 > 로그인 항목 및 확장 > Quick Look에서 Memory.Wiki를 활성화하세요",
        "Finder에서 아무 .md 파일을 선택하고 Space를 누르세요",
      ],
      downloadLabel: "Memory.Wiki for Mac 받기",
      downloadSize: "Desktop DMG에 번들",
      includedLabel: "Included with Mac App",
      guideLabel: "Quick Start Guide",
    },

    roadmap: {
      heading: "로드맵",
      items: [
        { name: "Obsidian Plugin", desc: "Obsidian 노트를 한 번의 명령으로 Memory.Wiki에 퍼블리시", status: "Planned" },
        { name: "Raycast Extension", desc: "Raycast에서 빠르게 캡처하고 퍼블리시", status: "Planned" },
        { name: "Slack Bot", desc: "Slack 채널에서 직접 문서 공유", status: "Planned" },
        { name: "Alfred Workflow", desc: "클립보드를 캡처해서 즉시 퍼블리시", status: "Planned" },
        { name: "iOS / Android", desc: "모바일 퍼블리싱을 위한 공유 시트 통합", status: "Planned" },
      ],
    },

    cta: {
      text: "플러그인을 만들고 싶으신가요? 엔진은 오픈소스입니다.",
      githubLabel: "View on GitHub",
      editorLabel: "Open Editor",
    },
  },
};
