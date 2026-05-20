# Web Store Listing — memory.wiki

## Extension Name

memory.wiki — One URL for your markdown, everywhere

## Short Description (132 chars max)

Capture AI conversations, import any file, edit in WYSIWYG, share with a permanent link. Same document, same URL, every surface.

## Detailed Description (16,000 chars max)

One URL for your markdown, everywhere.

Capture AI conversations, import any file, edit in WYSIWYG, share with a permanent link. Available on web, Mac, VS Code, CLI, Chrome extension, and MCP server — same document, same URL, every surface.

WHAT IT DOES

– Capture full conversations from ChatGPT, Claude, and Gemini
– Capture individual messages with per-message "memory.wiki this" buttons
– Capture selected text from any webpage
– Open GitHub .md files directly in memory.wiki for beautiful rendering
– Publish instantly and get a permanent URL (memory.wiki/abc123)

HOW IT WORKS

1. Chat with any AI assistant as usual
2. Click the memory.wiki button (floating or per-message)
3. Your conversation is published as a formatted document
4. Share the URL — anyone can view it, any AI can read it

SUPPORTED PLATFORMS

– ChatGPT (chatgpt.com)
– Claude (claude.ai)
– Gemini (gemini.google.com)
– GitHub (any .md file)

KEY FEATURES

Conversation Capture

- Full conversation with proper User/Assistant formatting
- Range selection: capture last 3, 5, or 10 exchanges
- Per-message mini buttons on hover
- Floating "memory.wiki All" button with quick access

Smart Formatting

- Code blocks with syntax highlighting preserved
- Mathematical equations (KaTeX/MathJax) preserved
- Mermaid diagrams preserved as source code
- Tables, lists, and all Markdown formatting intact

AI-Readable URLs

- Published documents are readable by Claude and ChatGPT
- Paste memory.wiki/abc123 into any AI conversation to share context
- Cross-AI knowledge sharing — capture from one AI, share with another

Publishing Options

- Permanent short URL (memory.wiki/abc123)
- No account required for basic publishing
- Logged-in users get documents saved to their account

GitHub Integration

- "Open in memory.wiki" button on any .md file
- Beautiful rendering with code highlighting, math, and diagrams
- Works on repository file views

PRIVACY

- No data is collected or stored by the extension itself
- Documents are published to memory.wiki servers only when you click publish
- No tracking, no analytics in the extension
- Open source: github.com/raymindai/mdcore

PERMISSIONS EXPLAINED

- activeTab: Access the current tab to extract content
- tabs: Detect which AI platform you're on
- contextMenus: Right-click "Publish selection to memory.wiki"
- storage: Save your preferences (floating button visibility)
- scripting: Inject capture functionality into AI pages
- cookies: Check memory.wiki login status for authenticated publishing

---

memory.wiki — One URL for your markdown, everywhere.

## Category

Productivity

## Language

English

## Single Purpose Description (required by Chrome policy)

Captures AI conversation content from ChatGPT, Claude, and Gemini, and publishes it as a formatted document on memory.wiki.

---

## Store Assets Needed

### Icon

- 128x128 PNG (already at icons/icon128.png)

### Screenshots (1280x800 or 640x400, min 1, max 5)

Screenshot 1 — "Capture from ChatGPT"
Show: ChatGPT page with floating memory.wiki button visible, conversation in background.
Caption: One-click capture from ChatGPT

Screenshot 2 — "Capture from Claude"
Show: Claude.ai page with per-message mini buttons visible on hover.
Caption: Per-message capture from Claude

Screenshot 3 — "Published Document"
Show: memory.wiki page with a beautifully rendered document (code blocks, headings, etc).
Caption: Beautiful, shareable documents

Screenshot 4 — "GitHub Integration"
Show: GitHub .md file page with "Open in memory.wiki" button visible.
Caption: Open GitHub Markdown in memory.wiki

Screenshot 5 — "Extension Popup"
Show: The popup UI with platform detection indicator and capture options.
Caption: Smart platform detection

### Promotional Tile (1280x800)

Hero image with memory.wiki branding + "One URL for your markdown, everywhere" tagline.

---

## Privacy Practices (Chrome Web Store Developer Dashboard)

### Single Purpose

Captures AI conversation content and publishes it as formatted documents on memory.wiki.

### Permission Justifications

activeTab: Required to read conversation content from the current AI chat page (ChatGPT, Claude, Gemini) when the user clicks the capture button.

tabs: Required to detect which AI platform the user is currently on, to show the correct platform indicator in the popup and apply platform-specific extraction logic.

contextMenus: Required to add a right-click menu option "Publish selection to memory.wiki" for capturing selected text on any page.

storage: Required to persist user preferences such as floating button visibility setting across browser sessions.

scripting: Required to inject the content capture script into AI platform pages to enable conversation extraction.

cookies: Required to check if the user is logged into memory.wiki, enabling authenticated publishing that saves documents to their account.

host_permissions (<all_urls>): Required for the context menu "Publish selection" feature to work on any webpage, and for the background service worker to make API calls to memory.wiki on behalf of the content script (CORS bypass).

### Data Usage Disclosure

- Personally identifiable information: No
- Health information: No
- Financial information: No
- Authentication information: No (cookies are read-only, not collected)
- Personal communications: No
- Location: No
- Web history: No
- User activity: No
- Website content: Yes — conversation content is sent to memory.wiki servers only when the user explicitly clicks publish

### Data Sale

We do not sell user data.

### Data Use Purposes

- Conversation content is sent to memory.wiki solely to create a shareable document at the user's explicit request.
