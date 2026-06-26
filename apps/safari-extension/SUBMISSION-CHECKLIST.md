# Safari Extension — App Store Submission Checklist

For Mac App Store + iOS App Store first submissions of the Safari Web Extension.

Bundle IDs (after `1c4ad5...` commit):

- macOS app: `wiki.memory.clipper.mac`
- macOS extension: `wiki.memory.clipper.mac.Extension`
- iOS app: `wiki.memory.clipper.ios`
- iOS extension: `wiki.memory.clipper.ios.Extension`

Team: `W7NL89YGSD`

---

## 1. Apple Developer Portal — register App IDs

https://developer.apple.com/account → Certificates, IDs & Profiles → Identifiers → `+`

Register all four IDs above as **App IDs (App)** with these capabilities:

- App Groups (if you want shared storage between app + extension — optional now)
- No other special capabilities needed for first ship

If Xcode automatic signing already registered them during the local archive runs, they will already appear in the list — skip the manual `+`.

## 2. App Store Connect — create app records

https://appstoreconnect.apple.com → My Apps → `+` → New App

Create **two** separate apps:

**Mac app**

- Platforms: macOS
- Name: `memory.wiki Clipper`
- Primary language: English
- Bundle ID: `wiki.memory.clipper.mac`
- SKU: `mw-clipper-mac-001`

**iOS app**

- Platforms: iOS
- Name: `memory.wiki Clipper`
- Primary language: English
- Bundle ID: `wiki.memory.clipper.ios`
- SKU: `mw-clipper-ios-001`

## 3. Listing metadata (paste into both apps)

> NOTE (2026-06-17): the original copy below was REJECTED under Guideline 1.1
> (Safety / Objectionable Content) — Apple read the broad "capture any page /
> AI conversations / social posts" framing as a service that could capture
> objectionable third-party content. Rewritten to a personal "save your own
> pages as links" utility. Apply to BOTH the iOS and Mac Clipper apps.

> NOTE (2026-06-26): Mac submission rejected again on 3 counts — all fixed in
> **build 1.0 (5)** (build 4 had the same fixes but a square macOS app icon; 5
> corrects the icon):
> (5.2.5) App Store **Name** must not contain "Mac"/"Safari" → "memory.wiki Web
> Clipper".
> (5 / China DST) removed ALL foreign-AI brand names (ChatGPT, GPT, Claude,
> Gemini, Cursor, Perplexity) — not just from keywords + description below, but
> from the **binary** too: the popup's post-capture "send this to" launcher was
> dropped and the options "on AI pages" copy is now generic. Keeps China
> available without re-rejection risk (the other AIs also lack a China license).
> (5.1.1(v)) account deletion lives at memory.wiki/settings — added an in-app
> "Delete account" link in BOTH the popup (Shared Resources popup-v25.html) and
> the extension settings page (options.html → "account" section); both deep-link
> to memory.wiki/settings?section=danger so the Danger tab opens directly. Demo
> it in the App Review Notes / screen recording (demo account self-heals via
> demo-signin if deleted).
> (icon, not a rejection count) the AppIcon mac slots held the full-bleed iOS
> square (opaque, 0 padding) — macOS does not mask, so the Dock showed ~90°
> corners. Regenerated the macOS slots as the Apple grid squircle (824/1024
> tile, ~10% padding, flat) via `scripts/build-app-icons.mjs`; iOS/universal
> stays full-bleed (Apple rejects iOS icons with alpha).
>
> Build .pkg: `apps/safari-extension/memory.wiki Clipper/build/export-appstore/memory.wiki Clipper.pkg`
> — upload via Transporter, then attach 1.0 (5) in App Store Connect.

**Subtitle (max 30 chars)**

```
Save pages as memory links
```

**Promotional text (max 170 chars)**

```
Save a page or a passage as a clean memory.wiki link, ready to revisit later or bring into your own AI workflow without copy-pasting.
```

**Description**

```
memory.wiki Clipper saves a web page, or a passage you select, as a clean, private memory.wiki link you can revisit later or bring into your AI assistant.

Reading something worth keeping? Save it in one tap and get a tidy memory.wiki link. Open it anytime, or paste it into your own AI assistant instead of copy-pasting text.

What it does:
- One tap saves the current page, or the passage you select, as a clean Markdown note at a short memory.wiki link.
- The link is copied to your clipboard, ready to revisit or share.
- Add a short note about why you saved it, before publishing.
- Sign in with your memory.wiki account to sync your saved pages across your devices.

Privacy:
- The extension does not track you and does not sell data.
- A page is sent to memory.wiki only when you tap save.
```

**Keywords (max 100 chars)**

```
markdown,ai,context,clipper,save page,save text,memory,knowledge,notes,ai assistant
```

**Support URL**: `https://memory.wiki/plugins#safari`**Marketing URL**: `https://memory.wiki`**Privacy Policy URL**: `https://memory.wiki/privacy`

**Category**: Productivity (Primary) / Utilities (Secondary)

**Age Rating**: 4+

## 4. Screenshots — required sizes

**Mac (App Store)** — at least 1, up to 10

- 2880×1800 (Retina 16:10) or 1280×800 (non-Retina)

**iPhone 6.9" (iPhone 17 Pro Max)** — at least 1

- 1320×2868

**iPhone 6.7" (iPhone 15 Pro Max)** — at least 1

- 1290×2796

**iPad 13" (M-series iPad Pro)** — at least 1

- 2064×2752

Same 3-part overlay pattern as Chrome Web Store screenshots: pill / headline / sub-line.

## 4b. iOS-specific — App Review demo flow (REQUIRED)

App Review consistently rejects Safari extension iOS apps where the reviewer cannot figure out how to enable + test the extension. Paste this verbatim into App Store Connect &gt; App Review Information &gt; Notes:

```
TEST PLAN — memory.wiki Clipper for iOS

1. Install the app. The container app opens to an onboarding screen
   with a 3-step Enable guide and a button to open Settings.

2. Tap "Open Settings" (or go to Settings > Apps > Safari > Extensions
   manually). Toggle "memory.wiki Clipper" on. Tap "All Websites" and
   set to "Allow" so capture can run on any page.

3. Open Safari and navigate to any web page, for example
   https://en.wikipedia.org/wiki/Apple_Inc

4. Tap the "AA" button on the left side of the address bar. Tap the
   memory.wiki Clipper icon to open the extension popup.

5. Tap "Capture this page". The popup will show a memory.wiki URL
   like https://memory.wiki/abc123 within a few seconds. Tap the URL
   to open the captured document in a new tab — verify the page
   content is rendered as markdown.

Sign-in is OPTIONAL. Anonymous capture works without signing in.
To test signed-in: tap "Sign in to memory.wiki" in the container app
or in the extension popup, complete the web auth flow, then return
to the extension and capture again. The URL will be tied to your
account and appear in your /docs page.
```

## 4c. iOS-specific — test on a physical device before submission

The Simulator cannot enable Safari Web Extensions reliably. Before Archive + Upload, test on your iPhone or iPad:

1. In Xcode, select scheme "memory.wiki Clipper (iOS)" with your device as the destination (top bar dropdown).
2. Hit Run. Trust the developer cert on the device if prompted (Settings &gt; General &gt; VPN & Device Management).
3. Walk through steps 1-5 of the test plan above on your device.
4. Specifically verify:
   - The 3-step guide renders cleanly on your screen size.
   - "Open Settings" jumps to Settings.app.
   - The extension appears in Safari &gt; Extensions.
   - Capture produces a memory.wiki URL and copies the AI sentence to the clipboard ("Use https://memory.wiki/abc123 as my context.").
   - Sign-in via memory.wiki/auth/safari completes and the popup shows the signed-in state on return.

If any of these break, fix before submission — App Review will hit the same path.

## 4d. Privacy Manifest

Already wired via PrivacyInfo.xcprivacy in both the container app and the .appex extension bundle (committed). Declares:

- No tracking, no tracking domains.
- Other user content / email / user ID — collected only when signed in, linked to the account, used solely for app functionality.
- UserDefaults access (CA92.1) — chrome.storage.local caches sign-in state and recent captures.

No further action needed unless App Review reports ITMS-91056 (Apple sometimes wants more granular categories). If that happens, paste the specific ITMS code here and the manifest can be refined.

## 5. Privacy questionnaire (App Store Connect)

Apple asks "Data Used to Track You?" and "Data Linked to You?":

- **Tracking**: None
- **Data linked to you**: User content (page captures), User ID (if signed in)
- **Data not linked to you**: None
- **Data not collected**: Health, financial, location, contacts, browsing history outside captures, search history, identifiers other than the user account, diagnostics

## 6. Xcode → Archive → Distribute

In Xcode:

1. Select scheme `memory.wiki Clipper (macOS)`
2. Product → Archive
3. Organizer opens → Distribute App → App Store Connect → Upload
4. Xcode will create the distribution provisioning profile automatically
5. Repeat for `memory.wiki Clipper (iOS)` (need a generic iOS device or `Any iOS Device` selected, not the simulator)

The CLI export path errors out with "No profiles for X" because xcodebuild can't create new Distribution profiles — only the Xcode UI can. (This is a longstanding Apple limitation.)

## 7. After upload — finalize listing

Once the build is processed by App Store Connect (5–30 min):

- Attach the build to the app record
- Add screenshots
- Submit for review

---

## Cross-channel parity (already done)

- Chrome Web Store v2.7.4 — resubmitted with non-keyword-spam description
- VS Code Marketplace, npm CLI, npm MCP — independent
- This Safari extension is the first Apple submission of the extension itself (separate from the Desktop Electron app `wiki.memory.mac` which is already in MAS review)