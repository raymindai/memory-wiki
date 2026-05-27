# Memory.Wiki — iOS Native

v8 W9 deliverable: native iOS app for Memory.Wiki. Capture from any
app via Share Extension, fast timeline, Widget on Home/Lock screen,
Spotlight indexing, offline-first sync. Companion to the web app
at https://memory.wiki.

## Getting started

Project files are generated from `project.yml` by
[XcodeGen](https://github.com/yonkim/XcodeGen) so the repo never
has to merge a hand-edited `.pbxproj`.

```bash
# one-time setup
brew install xcodegen

# regenerate the Xcode project after editing project.yml or
# adding/removing source files
cd apps/ios-native
xcodegen generate

# open in Xcode
open MemoryWiki.xcodeproj
```

Build + run from Xcode (⌘R). Simulator works without a paid
Developer account; on-device requires signing in with an Apple ID
under Xcode → Settings → Accounts.

CLI build (sanity check the spec compiles):

```bash
xcodebuild -project MemoryWiki.xcodeproj -scheme MemoryWiki \
  -destination 'generic/platform=iOS Simulator' -configuration Debug build
```

Deployment target is iOS 17 — covers ~95% of active iPhones and
unlocks `ContentUnavailableView`, observation framework, and the
newer SwiftUI APIs the codebase leans on.

## Layout

```
apps/ios-native/
├── project.yml             # XcodeGen spec (single source of truth)
├── MemoryWiki/             # main app target
│   ├── MemoryWikiApp.swift # @main entry
│   ├── Views/              # SwiftUI views
│   ├── Networking/         # APIClient + AuthManager
│   ├── Models/             # value types
│   ├── Info.plist
│   └── Assets.xcassets/
├── ShareExtension/         # Share Extension target (added W9 next)
└── MemoryWikiTests/        # XCTest target (added later)
```

## App identity

- Bundle ID: `wiki.memory.MemoryWiki`
- Share Extension: `wiki.memory.MemoryWiki.ShareExtension`
- App Group (data shared between app + extension): `group.wiki.memory.shared`
- Custom URL scheme: `memorywiki://`
- Universal Links: `https://memory.wiki/*` (configured in
  apple-app-site-association on the web app — added when we ship
  the production team-id)

## Networking

Talks to the existing Memory.Wiki web API. Auth: Supabase JWT
stored in Keychain after the browser sign-in round-trip; passed
to API calls as `Authorization: Bearer <token>` + `x-user-id`.

See `MemoryWiki/Networking/APIClient.swift`.
