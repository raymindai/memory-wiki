# memory.wiki Desktop, Mac App Store resubmission

Everything needed to resubmit after the 2026-06 rejection: what was fixed,
the exact replies to paste into Resolution Center, the App Review
Information (passwordless demo), and the build + upload steps.

- App Store name: **memory.wiki Desktop** (set in App Store Connect)
- Bundle id: **wiki.memory.mac**
- Team: Hyunsang Cho (W7NL89YGSD)
- Marketing version: 2.7.5 (each MAS build gets a unique timestamp
  CFBundleVersion via afterPack.js, so a rejected build can be replaced
  without bumping the version string)

---

## 1. Rejection issues and how each is resolved

| # | Guideline | Issue | Resolution | Status |
| - | --------- | ----- | ---------- | ------ |
| 1 | 5.2.5 | App name contained "Mac" | App Store Connect name is now "memory.wiki Desktop". The bundle's display name is "memory.wiki" (no "Mac" anywhere user facing). | Done (ASC + productName) |
| 2 | 4.1(a) | Flagged as a copycat for referencing "memory.wiki" | memory.wiki is our own product and domain. Reply with ownership evidence (section 2). No code change required. | Reply ready |
| 3 | 4 (Design) | Sign-in used an external browser, and the main window could not be reopened | Sign-in now runs inside a dedicated in-app window. The main window is reopenable from the Window menu (Command-Shift-0). | Done (main.js, committed) |
| 4 | 5.1.1(v) | No in-app account deletion | App menu memory.wiki > "Delete Account…" runs a two-step confirm, then permanently deletes the auth user and all data. | Done (main.js + web endpoint, verified) |

Code references (all committed):
- In-app sign-in window: `main.js` `openAuthWindow()` (the `login` IPC opens
  `/auth/desktop` in-app, intercepts the `memorywiki://` callback, never
  hands off to an external browser).
- Reopenable window: `main.js` Window menu item "memory.wiki"
  (Command-Shift-0) calls `showMainWindow()`.
- Account deletion: `main.js` `promptDeleteAccount()` (app menu
  memory.wiki > "Delete Account…") calls `DELETE /api/user/delete`, which
  deletes the user's documents, folders, notifications, profile, and then
  the auth user itself (`auth.admin.deleteUser`). Verified in
  `apps/web/src/app/api/user/delete/route.ts`.

---

## 2. Reply to paste in Resolution Center, Guideline 4.1(a) ownership

> Hello, and thank you for the review.
>
> memory.wiki is our own product and our own registered domain. It is
> built and operated by Raymind AI (Hyunsang Cho), which is the same
> entity as this Apple Developer account (Hyunsang Cho, Team ID
> W7NL89YGSD). This app is the official first-party desktop client for
> memory.wiki. It is not a third-party or unofficial client and it does
> not impersonate any other party.
>
> We own the domain memory.wiki, the web application at
> https://memory.wiki, and the brand, name, icon, and visual assets used
> in the app. The app refers to "memory.wiki" because that is our own
> service: the desktop client signs the user in to their own memory.wiki
> account and syncs their own documents.
>
> We are glad to provide any proof of ownership you need. For example, we
> can show the domain registration record, or publish a verification
> string at a URL we control on https://memory.wiki. Please tell us which
> form is most useful and we will provide it right away.
>
> Thank you.

If the reviewer asks for proof, fastest options:
- Domain registrar record for memory.wiki showing the owner.
- A short verification file we control, for example
  `https://memory.wiki/apple-developer-merchantid-domain-association` or a
  one-off note page, linked back in the reply.

---

## 3. Reply to paste in Resolution Center, Guideline 4 and 5.1.1(v)

> Hello, and thank you for the review.
>
> This build addresses each point:
>
> 1. Sign-in (Guideline 4): sign-in no longer opens an external browser.
>    The app presents sign-in inside a dedicated in-app window and returns
>    to the main window automatically after authentication.
>
> 2. Reopenable main window (Guideline 4): the main window can always be
>    reopened from the menu bar at Window > "memory.wiki"
>    (Command-Shift-0), including after it has been closed.
>
> 3. Account deletion (Guideline 5.1.1(v)): account deletion is available
>    in the app at the menu bar, memory.wiki > "Delete Account…". It shows
>    a two-step confirmation and then permanently deletes the account and
>    all associated data (documents, folders, profile, and the
>    authentication record). No website visit or support request is
>    required.
>
> A passwordless demo account and step-by-step sign-in instructions are in
> App Review Information. Please let us know if anything else is needed.
>
> Thank you.

---

## 4. App Review Information (App Store Connect)

Fill the "App Review Information" section of the version with this.

**Sign-in required:** Yes.

**Demo account (passwordless):**
- User name: `demo@memory.wiki`
- Password: (leave blank, see notes; this account signs in without a
  password or email access)

**Notes:**

> Sign-in is passwordless for this demo account, no email inbox needed:
>
> 1. Launch memory.wiki Desktop.
> 2. Click "Sign In" in the app. An in-app sign-in window opens.
> 3. Click "Continue with Email".
> 4. Enter: demo@memory.wiki
> 5. Click "Send sign-in link". This allowlisted demo account signs in
>    immediately and skips the email step, so no inbox access is required.
>
> You are now signed in and can create, edit, and sync documents.
>
> To verify in-app account deletion (Guideline 5.1.1(v)):
> menu bar memory.wiki > "Delete Account…", then confirm twice. The demo
> account is automatically re-created the next time you sign in with
> demo@memory.wiki, so this is safe to run.
>
> To verify the reopenable window (Guideline 4): close the main window,
> then choose Window > "memory.wiki" (Command-Shift-0) to bring it back.

---

## 5. Build and upload (run on the founder's Mac, needs Apple ID 2FA)

### Prerequisites
- Signing identities in the login keychain:
  - `Apple Distribution: Hyunsang Cho (W7NL89YGSD)`
  - `3rd Party Mac Developer Installer: Hyunsang Cho (W7NL89YGSD)`
- `build/embedded.provisionprofile` present: the Mac App Store
  provisioning profile for `wiki.memory.mac`, downloaded from the Apple
  Developer portal. (This file is gitignored because it is account and
  certificate specific; keep it locally, regenerate when it expires.)
- QuickLook host built once (afterPack embeds its .appex):
  ```bash
  cd apps/quicklook/MemoryWikiQuickLook
  xcodebuild -scheme MemoryWikiQuickLook -configuration Release -derivedDataPath build/derived
  ```

### Build the signed .pkg
```bash
cd apps/desktop
npm run build:mas:pkg
```
Output: `dist/memory.wiki-2.7.5.pkg`. The script prints the bundle id and
version at the end. Confirm:
- Bundle id is `wiki.memory.mac`
- The afterPack log shows the QL extension id `wiki.memory.mac.qlextension`
  (derived automatically from the host appId)

### Upload
Either drag the .pkg into Transporter.app, or:
```bash
xcrun altool --upload-app -f dist/memory.wiki-2.7.5.pkg -t macos \
  -u "$APPLE_ID" -p "$APPLE_APP_SPECIFIC_PASSWORD"
```

### Resubmit in App Store Connect
1. Wait for the build to finish processing (about 10 to 30 minutes).
2. Attach the build to the version.
3. Paste the App Review Information from section 4.
4. Reply to the reviewer in Resolution Center with sections 2 and 3.
5. Submit for review.

---

## 6. Why the build is now deterministic (appId)

The two channels need different bundle ids and used to require a manual
edit before each build. That is removed:

- DMG (Developer ID, notarized): `wiki.memory.desktop`, via
  `npm run build:dmg`.
- MAS (App Store): `wiki.memory.mac`, via `npm run build:mas` and
  `npm run build:mas:pkg`.

The appId is set per channel with `-c.appId=...` in the package.json
scripts, so neither channel depends on the default in the build block (the
default is `wiki.memory.desktop`, the safer of the two). `afterPack.js`
derives the QuickLook extension child id from the actual host appId, so a
channel switch can never ship a mismatched (and therefore rejected)
extension. Do not hardcode the appId in `afterPack.js` again.
