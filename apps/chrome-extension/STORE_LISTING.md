# web store listing — memory.wiki

## extension name

memory.wiki: capture any page or AI chat as a markdown URL

## short description (132 chars max)

clip any web page or AI conversation (ChatGPT, Claude, Gemini) to a clean
markdown URL on memory.wiki. one URL, every surface.

## detailed description (16,000 chars max)

one URL for your markdown, everywhere.

clip any web page or AI conversation, edit in WYSIWYG, share with a permanent
link. available on web, Mac, VS Code, CLI, chrome extension, and MCP server
(same document, same URL, every surface).

what it does

- capture full conversations from ChatGPT, Claude, and Gemini
- capture individual messages with per-message "memory.wiki this" buttons
- capture any web page (Readability-clean markdown, code blocks preserved)
- capture only the highlighted selection from any page
- open GitHub .md files directly in memory.wiki for beautiful rendering
- keyboard shortcuts (Cmd+Shift+E to capture page, Cmd+Shift+X for selection)
- publish instantly and get a permanent URL (memory.wiki/abc123)
- every successful capture copies "Use memory.wiki/<id> as my context." to
  the clipboard so you can paste straight into your next AI session

how it works

1. chat with any AI, or browse any web page
2. press Cmd+Shift+E or click the extension popup
3. your content is published as a formatted markdown document
4. paste the AI-paste sentence into the next AI to share the context

supported surfaces

- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- GitHub (any .md file)
- any other web page (via Mozilla Readability)

key features

conversation capture

- full conversation with proper user / assistant formatting
- range selection: capture last 3, 5, or 10 exchanges
- per-message mini buttons on hover
- optional floating "memory.wiki all" dock (toggle in settings)

general web capture

- Mozilla Readability extracts the article body, drops nav / footer / ads
- code blocks with language detection, tables, lists, math intact
- selection-only capture for pull-quotes and snippets

smart formatting

- code blocks with syntax highlighting preserved
- mathematical equations (KaTeX / MathJax) preserved
- mermaid diagrams preserved as source code
- tables, lists, and all markdown formatting intact

AI-readable URLs

- published documents are readable by Claude, ChatGPT, Gemini, Cursor
- the "Use memory.wiki/<id> as my context." sentence is dropped on your
  clipboard after every capture so paste-into-next-AI is one keystroke
- cross-AI knowledge sharing: capture from one AI, paste into another

publishing options

- permanent short URL (memory.wiki/abc123)
- no account required for basic publishing
- signed-in users get documents saved to their account and searchable

GitHub integration

- "open in memory.wiki" button on any .md file
- beautiful rendering with code highlighting, math, and diagrams
- works on repository file views

privacy

- no data is collected or stored by the extension itself
- content is published to memory.wiki servers only when you click publish
- no tracking, no analytics in the extension
- open source: github.com/raymindai/memory-wiki

permissions explained

- activeTab: read the current tab's content when you click capture
- tabs: detect which AI platform / general page you're on
- contextMenus: right-click "send selection / page to memory.wiki"
- storage: persist preferences (floating button visibility)
- scripting: inject capture functionality into pages on demand
- cookies: read memory.wiki login state for authenticated publishing
- notifications: brief toast after keyboard-shortcut captures
- offscreen: copy the AI-paste sentence to the clipboard from the service
  worker after a keyboard-shortcut capture

---

memory.wiki: one URL for your markdown, everywhere.

## category

productivity

## language

english

## single purpose description (required by chrome policy)

captures content from any web page or AI conversation (ChatGPT, Claude,
Gemini) and publishes it as a formatted markdown document on memory.wiki.

---

## store assets needed

### icon

- 128x128 PNG (already at icons/icon128.png)

### screenshots (1280x800 or 640x400, min 1, max 5)

screenshot 1 — capture from any web page
show: an article page (blog or MDN) with the popup open, capture button
visible.
caption: capture any page as clean markdown

screenshot 2 — capture from ChatGPT
show: ChatGPT page with floating memory.wiki button visible, conversation
in background.
caption: one-click capture from ChatGPT

screenshot 3 — capture from Claude
show: claude.ai page with per-message mini buttons visible on hover.
caption: per-message capture from Claude

screenshot 4 — published document
show: memory.wiki page with a beautifully rendered document (code blocks,
headings).
caption: beautiful, shareable documents

screenshot 5 — extension popup
show: the popup UI with the account chip + platform detection + capture
options.
caption: signed-in account chip and keyboard shortcuts visible

### promotional tile (1280x800)

hero image with memory.wiki branding + "one URL for your markdown,
everywhere" tagline.

---

## privacy practices (chrome web store developer dashboard)

### single purpose

captures content from any web page or AI conversation and publishes it as a
formatted markdown document on memory.wiki.

### permission justifications

activeTab: required to read content from the current page when the user
clicks capture (AI conversation extraction or general page extraction via
Mozilla Readability).

tabs: required to detect which AI platform / general page the user is on,
to show the correct platform indicator in the popup and route capture
requests to the right content script.

contextMenus: required to add right-click menu options for sending
selection or whole-page content to memory.wiki.

storage: required to persist user preferences such as floating button
visibility setting across browser sessions.

scripting: required to inject the content capture script into pages on
demand (used as a fallback when the manifest content_scripts haven't
landed yet).

cookies: required to check if the user is signed into memory.wiki,
enabling authenticated publishing that saves documents to their account.

notifications: required for a brief confirmation toast after captures
triggered by keyboard shortcuts (which happen outside the popup UI).

offscreen: required to copy the "Use memory.wiki/<id> as my context."
sentence to the clipboard from the service worker after a keyboard-shortcut
capture (service workers can't touch the clipboard directly).

host_permissions (<all_urls>): required for the general web clipper to
work on any page, for the context menu to work on any page, and for the
background service worker to make API calls to memory.wiki on behalf of
content scripts (CORS bypass).

### data usage disclosure

- personally identifiable information: no
- health information: no
- financial information: no
- authentication information: no (cookies are read-only, not collected)
- personal communications: no
- location: no
- web history: no
- user activity: no
- website content: yes — content is sent to memory.wiki servers only when
  the user explicitly clicks publish (popup, context menu, or keyboard
  shortcut)

### data sale

we do not sell user data.

### data use purposes

- captured content is sent to memory.wiki solely to create a shareable
  document at the user's explicit request.
