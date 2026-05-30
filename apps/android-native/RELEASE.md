# Memory.Wiki Android — Play Store release guide

Single-source instructions for shipping the Android companion app to
Play Store. Covers the local build, the Play Console submission, and
the founder-only secrets you have to back up.

---

## 1. Local signing setup (done once)

The release signing config reads from `release-keystore.properties`
(gitignored). The upload keystore lives at `app/upload-keystore.jks`
(also gitignored).

### Files on disk

```
apps/android-native/
├── release-keystore.properties        ← passwords (gitignored)
└── app/upload-keystore.jks            ← upload keystore (gitignored)
```

### What to back up RIGHT NOW

Both files are needed to publish updates. If you lose them, Play
App Signing can reset the upload key
(<https://support.google.com/googleplay/android-developer/answer/9842756>),
but it adds friction.

1. Drag `app/upload-keystore.jks` into 1Password as an attachment.
2. Paste the contents of `release-keystore.properties` into the same
   1Password entry.
3. Confirm both restore correctly on a different machine before
   trusting the backup.

### Upload cert fingerprints (for Google OAuth setup)

```
SHA-1   : E8:34:48:D7:EE:13:06:59:B7:9A:8A:9E:53:50:B2:A2:1D:63:5A:D6
SHA-256 : 36:5A:3C:2C:D0:34:8C:EC:AE:4C:75:4D:02:66:58:C1:71:A7:77:17:E7:36:A2:8C:CE:DA:B9:96:E1:6E:A7:DB
```

Add the SHA-1 to the Google OAuth web client for Google sign-in
support during testing. After the first Play upload, Google Play
will issue a **second** SHA-1 (their managed app signing key) — add
that one too so production builds work.

---

## 2. Build the AAB

```bash
cd apps/android-native
./gradlew :app:bundleRelease
```

Output:

```
app/build/outputs/bundle/release/app-release.aab
```

Currently 32 MB. Play Store enforces a 200 MB base AAB limit, so
we have headroom. Asset packs / dynamic delivery are not used.

---

## 3. Play Console: first-time setup

### 3.1 Account ($25 one-time)

<https://play.google.com/console/signup>

### 3.2 Create the app

- Name: **Memory.Wiki**
- Default language: English (US)
- App or game: App
- Free or paid: Free
- Declarations: confirm developer policies, US export laws.

### 3.3 Internal app testing (first track)

Always ship to **Internal testing** first, then promote to
Closed → Open → Production. Internal testing is the fastest path to
real-device verification of the signed AAB.

1. **Releases** → **Internal testing** → **Create new release**
2. Drop `app-release.aab` into the upload area
3. Play prompts you to opt into **Play App Signing** — accept
   (recommended). This is the path the keystore setup above assumes.
4. Release name: `0.1.0 (1)`
5. Release notes — short, e.g.:
   ```
   First internal build. Capture from any app, AI-organised hub
   in your pocket, paste one URL into any AI tool.
   ```
6. Review + roll out.

### 3.4 Add yourself + testers

**Testers** tab → Create email list → add your address. Internal
testing supports up to 100 testers without review.

---

## 4. Store listing (Production-track required)

For internal testing you only need the AAB. Before promoting to
production, fill these in:

### 4.1 App content

- **Privacy Policy URL** — host on memory.wiki:
  `https://memory.wiki/privacy` (already linked from Android settings)
- **Ads** — None
- **App access** — restricted features behind sign-in: yes
  (demo@memory.wiki / [password] available on request)
- **Content rating** — IARC questionnaire. Pick: Productivity / no
  ads / no UGC moderation needed for v1.
- **Target audience** — 13+
- **News app** — No
- **Data safety form** — see section 5

### 4.2 Main store listing

- **App name**: `Memory.Wiki`
- **Short description** (80 chars):
  `Capture anywhere. AI organises. Paste one URL into any AI.`
- **Full description** (4000 chars max):
  ```
  Memory.Wiki is the fastest way from a thought to a shared
  document. Capture text, URLs, photos, voice, or shared content
  from any Android app. AI organises everything by topic. Paste
  one URL — your hub — into Claude, ChatGPT, Gemini, or Cursor
  and that AI now has every memory you've ever saved.

  • Six capture modes: Write / URL / Photo / OCR / Voice / Files
  • Share from any app via the Android share sheet
  • Long-press the launcher icon: Capture / Ask / Search / Paste
  • Quick Settings tile for one-swipe capture
  • Home + lock-screen widget
  • Local + Supabase sync, works offline-first
  • Markdown reader with code highlighting, KaTeX, Mermaid
  • Cross-AI by design — one URL every AI can read
  ```
- **App icon** (512×512 PNG): use
  `assets/brand/mwlogoset v2/icon-1024.png` resized to 512×512.
- **Feature graphic** (1024×500 JPG/PNG): brand wordmark on
  ink-on-bone background (TODO — design or use a screenshot).
- **Screenshots** (min 2, max 8, per device type):
  - Phone: capture them via emulator at 1080×2400.
    ```bash
    adb -s emulator-5554 exec-out screencap -p > screen-1.png
    ```
  - Suggested screens: Start, Markdowns list (with STARRED),
    Capture, Document detail, Settings hub card, Help.

### 4.3 Categorisation

- App category: **Productivity**
- Tags: Personal organisation, Notes, AI

---

## 5. Data Safety declarations

Source-of-truth: what we actually collect (see `apps/web/`):

| Data type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- |
| Email | yes | no | required for account | Auth, account recovery |
| Personal name (display name) | yes (optional) | no | optional | Profile |
| Photos | yes | no | per capture | App functionality |
| Audio (voice capture) | processed on-device via Android speech | no | per capture | App functionality |
| App activity (saved docs) | yes | no | core function | App functionality |
| Device or other IDs | yes (auth user id) | no | required | Account |

Encryption in transit: **yes** (HTTPS to Supabase + Vercel).
Encryption at rest: **yes** (Supabase Postgres + Storage).
Data deletion request: in-app sign-out + email to hi@raymind.ai.

---

## 6. Pricing & distribution

- Countries: all where available
- Free
- Contains ads: No
- In-app purchases: No (TBD when Pro launches)

---

## 7. Subsequent releases

```bash
# In app/build.gradle.kts bump:
versionCode = 2              # MUST be greater than the last published
versionName = "0.1.1"        # human-readable

cd apps/android-native
./gradlew :app:bundleRelease

# Upload the new AAB to the same track in Play Console.
```

Play Console rejects re-uploads at the same versionCode.

---

## 8. Quick sanity check before each release

- [ ] `./gradlew :app:bundleRelease` succeeds locally
- [ ] AAB size under 200 MB
- [ ] versionCode incremented
- [ ] Tested on physical device (`bundletool` can extract APKs from AAB
      to install — `bundletool build-apks --bundle=app-release.aab
      --output=release.apks --mode=universal && bundletool install-apks
      --apks=release.apks`)
- [ ] Release notes drafted
- [ ] Privacy policy still hosted at `memory.wiki/privacy`
