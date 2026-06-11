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

**Subtitle (max 30 chars)**
```
Save any page as a memory URL
```

**Promotional text (max 170 chars)**
```
Capture any page, AI chat, or selection into a clean memory.wiki URL that ChatGPT, Claude, Gemini, and Cursor can read instantly.
```

**Description**
```
memory.wiki Clipper turns any page into a permanent memory.wiki URL that any AI can read.

Use it to feed pages to ChatGPT, Claude, Gemini, Perplexity, or Cursor without copy-pasting.

What you can capture:
- Any web page — readable text, headings, links
- A selected passage on the page
- AI conversations on supported providers
- Social posts, code repositories, news articles

What it does:
- One click captures the current page and publishes it to a short memory.wiki URL.
- The URL is copied to your clipboard as a context sentence ready to paste into any AI.
- Per-site intent suggestions — capture with an angle, not just the raw text.
- Optional AI transform applies the intent before publishing.

Sign in with your memory.wiki account to keep your captures synced across devices.

This extension does not track you or sell any data. Pages you capture are sent only to memory.wiki when you click capture.
```

**Keywords (max 100 chars)**
```
markdown,ai,context,clipper,save page,chatgpt,claude,gemini,perplexity,cursor,memory,knowledge
```

**Support URL**: `https://memory.wiki/plugins#safari`
**Marketing URL**: `https://memory.wiki`
**Privacy Policy URL**: `https://memory.wiki/privacy`

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

App Review consistently rejects Safari extension iOS apps where the
reviewer cannot figure out how to enable + test the extension. Paste
this verbatim into App Store Connect > App Review Information > Notes:

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

The Simulator cannot enable Safari Web Extensions reliably. Before
Archive + Upload, test on your iPhone or iPad:

1. In Xcode, select scheme "memory.wiki Clipper (iOS)" with your
   device as the destination (top bar dropdown).
2. Hit Run. Trust the developer cert on the device if prompted
   (Settings > General > VPN & Device Management).
3. Walk through steps 1-5 of the test plan above on your device.
4. Specifically verify:
   - The 3-step guide renders cleanly on your screen size.
   - "Open Settings" jumps to Settings.app.
   - The extension appears in Safari > Extensions.
   - Capture produces a memory.wiki URL and copies the AI sentence
     to the clipboard ("Use https://memory.wiki/abc123 as my context.").
   - Sign-in via memory.wiki/auth/safari completes and the popup
     shows the signed-in state on return.

If any of these break, fix before submission — App Review will hit
the same path.

## 4d. Privacy Manifest

Already wired via PrivacyInfo.xcprivacy in both the container app and
the .appex extension bundle (committed). Declares:

  - No tracking, no tracking domains.
  - Other user content / email / user ID — collected only when signed
    in, linked to the account, used solely for app functionality.
  - UserDefaults access (CA92.1) — chrome.storage.local caches sign-in
    state and recent captures.

No further action needed unless App Review reports ITMS-91056 (Apple
sometimes wants more granular categories). If that happens, paste the
specific ITMS code here and the manifest can be refined.

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
- This Safari extension is the first Apple submission of the extension itself
  (separate from the Desktop Electron app `wiki.memory.mac` which is already in MAS review)
