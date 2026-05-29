# memory.wiki Android

The Android companion app for [memory.wiki](https://memory.wiki). Feature parity with the iOS app (see `apps/ios-native/`) and the wiki guide at [memory.wiki/vfj8dNg_](https://memory.wiki/vfj8dNg_).

## Project layout

```
apps/android-native/
├── app/                 # main app module (Compose + Hilt)
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── kotlin/wiki/memory/memorywiki/
│       │   ├── MemoryWikiApp.kt
│       │   ├── MainActivity.kt
│       │   ├── AppRouter.kt
│       │   ├── auth/AuthManager.kt
│       │   ├── data/{ApiClient,DocCache,model/Models}.kt
│       │   ├── di/AppModule.kt
│       │   ├── share/ShareReceiverActivity.kt
│       │   ├── util/WebPEncoder.kt
│       │   └── ui/
│       │       ├── RootShell.kt
│       │       ├── theme/{Brand,BrandType,Theme}.kt
│       │       ├── shell/{BrandTabBar,BottomFadeStrip}.kt
│       │       ├── components/{Skeleton,ProcessingBanner}.kt
│       │       ├── markdown/MarkdownBody.kt
│       │       ├── auth/AuthScreen.kt
│       │       ├── start/StartScreen.kt
│       │       ├── markdowns/MarkdownsScreen.kt
│       │       ├── bundles/{BundlesScreen,BundleDetailScreen}.kt
│       │       ├── capture/CaptureScreen.kt
│       │       ├── document/DocumentDetailScreen.kt
│       │       ├── chat/ChatScreen.kt
│       │       └── settings/SettingsScreen.kt
│       └── res/{font,drawable,mipmap-*,values,xml,raw}/
├── widget/              # Glance App Widget module
│   └── src/main/kotlin/wiki/memory/memorywiki/widget/MemoryWikiWidget.kt
├── settings.gradle.kts
├── build.gradle.kts
└── gradle/
    ├── libs.versions.toml
    └── wrapper/gradle-wrapper.properties
```

## First-time setup

1. Install JDK 17 and Android Studio Ladybug or newer.
2. Copy `secrets.local.properties.example` → `secrets.local.properties` and fill in the same `NEXT_PUBLIC_*` values used by the web app (`apps/web/.env.local`).
3. Open `apps/android-native/` in Android Studio.
4. Run the `app` config on an Android 13+ emulator or device.

Bundle ID: `wiki.memory.MemoryWiki` (debug variant adds `.debug` suffix so dev + Play builds can co-exist).

## Build from CLI

```bash
cd apps/android-native
./gradlew :app:installDebug          # build + push to a connected device
./gradlew :app:bundleRelease         # AAB for Play Store upload
./gradlew :widget:assembleDebug      # widget module only
```

The first build will download the Gradle 8.10.2 distribution and Android Gradle Plugin 8.7. Subsequent builds are incremental.

## Feature parity with iOS

| iOS feature | Android implementation |
|---|---|
| Five tabs (Start / MDs / Bundles / Capture / Settings) | `RootShell.kt` + per-tab screens in `ui/` |
| Capture modes (Write / URL / Photo / OCR / Voice / Import) | `CaptureScreen.kt` (Write + URL wired, Photo/OCR/Voice ready for CameraX + ML Kit + SpeechRecognizer) |
| Markdown rendering (GFM tables, task lists, images, code) | Markwon-backed `MarkdownBody.kt` |
| Chat over hub / bundle / doc (Claude Haiku 4.5) | `ChatScreen.kt` + `ChatViewModel` streaming via Ktor `bodyAsChannel()` |
| `[doc:<id>]` citation chips | `DocCitationChip` composable in chat |
| Owner brand accent override on shared docs | `MemoryWikiTheme(ownerAccentOverride = …)` wraps DocumentDetail |
| Demo passwordless allowlist | `AuthManager.signInDemo` + `isDemoEmail` |
| Share Extension | `ShareReceiverActivity` (translucent activity, ACTION_SEND text + image) |
| Widget (Ask / Search / Paste / Capture) | `MemoryWikiWidget.kt` (Glance, Small/Medium/Large via `SizeMode.Responsive`) |
| Deep links (`memorywiki://...`, `https://memory.wiki/<id>`) | `AppRouter.kt` parses + emits events; `AndroidManifest` declares intent filters |
| WebP encoder ladder | `util/WebPEncoder.kt` (matches iOS soft 500KB / hard 3.5MB ceiling) |
| Skeleton + RefreshingPip + ProcessingBanner | `ui/components/` |
| Pull-to-refresh | Material 3 `PullToRefreshBox` on MDs / Bundles |
| Status bar normalization | `enableEdgeToEdge()` + `WindowCompat` in `MemoryWikiTheme` |

## What's intentionally not built yet

These are tracked for v0.2:

- KaTeX / Mermaid via lazy WebView (same gap as iOS)
- Footnotes (Markwon plugin add)
- Google Sign-In with Credential Manager (Apple/GitHub Custom Tabs OAuth are wired via Supabase; Google needs Firebase OAuth client + SHA-1, see Phase 4 in setup guide)
- In-app hub viewer (Hub tab equivalent of `/hub/<slug>`)
- Play Console listing + Data Safety form (see [memory.wiki/vfj8dNg_ §17](https://memory.wiki/vfj8dNg_))
- 30s background revalidate on MDs / Bundles (the StateFlow is wired; just needs a ticker)

## Brand assets

Fonts (OFL-licensed, mirrored from iOS):

- Cal Sans Regular → `res/font/cal_sans.ttf` (display)
- Noto Sans Regular / Medium / SemiBold → `res/font/noto_sans_*.ttf`
- JetBrains Mono Regular / Medium → `res/font/jetbrains_mono_*.ttf`

App icon generated from `apps/ios-native/.../icon-1024.png` at mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi. Adaptive icon foreground at 432px (108dp). Background = `brand_background` (#09090B). Monochrome themed icon uses the same foreground.

Brand SVGs (`mwblob_morph.svg`, `icon_inline_dark.svg`) live in `res/raw/` and load via `coil-svg` when needed (no XML vector conversion).

## Conventions

- Dark-only. We do NOT honour `isSystemInDarkTheme()`.
- No Material You dynamic color. Color scheme is built from `Brand` tokens.
- App label is `memory.wiki` (lowercase). TalkBack will pronounce "memory dot wiki" — same as iOS Siri behavior; iOS uses `CFBundleSpokenName` to work around it, no Android equivalent.
- No em-dash (`—`) or middle-dot (`·`) in user-visible strings. Use slash, comma, or space — same rule as the web product.
- Lime accent is reserved for public-status badges and tiny dots. Never the brand key color in chrome.

## Demo account

- Email: `demo@memory.wiki` (no password — UI hides the field for allowlisted emails)
- Calls `POST /api/auth/demo-signin` which mints a magic-link session
- Hub: [memory.wiki/@memorywiki-demo](https://memory.wiki/@memorywiki-demo)
