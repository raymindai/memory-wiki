# CLAUDE.md — memory.wiki Project Context

> 이 파일은 Claude Code CLI가 자동으로 읽는 프로젝트 컨텍스트 파일이다.
> 프로젝트에 대한 모든 핵심 정보를 담고 있다.

---

## Vision

**"The fastest way from thought to shared document."**

AI 출력물의 크로스플랫폼 퍼블리싱 레이어. Markdown은 엔진이지 인터페이스가 아니다.
사용자는 MD를 몰라도 된다. AI 회사가 구조적으로 복제 불가능한 포지션(크로스 AI 레이어).
핵심 해자: 바이럴 뱃지("Published with memory.wiki") + 크로스 AI + 렌더링 품질.
상세 전략 (v6): `docs/direction_v6_2026_05.md` 또는 memory의 `direction_v6_2026_05`.

## 팀

- 파운더 1명 (Hyunsang, [hi@raymind.ai](mailto:hi@raymind.ai)) + AI(Claude) 페어 프로그래밍
- 풀타임, 의사결정 즉시, 한 번에 하나만 제대로

## 도메인

- **memory.wiki** — 핵심 제품, 라이브, Vercel 자동 배포
- **memory.wiki.online** — memory.wiki로 리다이렉트 (보조)
- **mdcore.ai / mdcore.org / mdcore.md** — 과거 "Rust 엔진을 제품화" 전략의 잔재. 현재는
  파킹/리다이렉트 상태. 차후 일몰 예정 (memory.wiki으로 통합).

## GitHub

- **Repo**: `raymindai/memory-wiki` (이름은 역사적 — 향후 `raymindai/memory.wiki`로 rename 검토 중)
- **CI**: GitHub Actions (`.github/workflows/ci.yml` — build-web + e2e-test)
- **Deploy**: Vercel 자동 배포, push하면 memory.wiki에 반영

---

## 프로젝트 구조

```text
mdcore/
├── packages/
│   └── mcp/                 # memory-wiki-mcp — MCP server (npm 출시됨, v1.5.x)
├── apps/
│   ├── web/                 # Next.js 15 웹앱 (memory.wiki) — 메인 제품
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── globals.css
│   │   │   │   ├── page.tsx
│   │   │   │   ├── about/page.tsx
│   │   │   │   ├── api/docs/       # 문서 CRUD API
│   │   │   │   ├── api/og/         # OG 이미지 동적 생성
│   │   │   │   ├── d/[id]/         # 문서 뷰어 (TipTap canEdit=false)
│   │   │   │   ├── b/[id]/         # 번들 뷰어
│   │   │   │   ├── hub/[slug]/     # 허브 뷰어
│   │   │   │   ├── embed/[id]/     # iframe 임베드
│   │   │   │   ├── raw/            # AI/봇용 markdown 페이로드
│   │   │   │   └── auth/           # cli / desktop / mcp / vscode 인증
│   │   │   ├── components/
│   │   │   │   ├── MdEditor.tsx        # 메인 에디터
│   │   │   │   ├── TiptapLiveEditor.tsx # Live 탭 (markdown-it 기반)
│   │   │   │   ├── BundleEmbed.tsx     # 번들 에디터 표면
│   │   │   │   └── ... 외 다수
│   │   │   └── lib/
│   │   │       ├── render.ts       # markdown-it 통합 렌더러 (모든 비편집 뷰어 공유)
│   │   │       ├── share.ts
│   │   │       ├── supabase.ts
│   │   │       └── ...
│   │   └── package.json
│   ├── vscode-extension/    # memory-wiki-vscode — Marketplace 출시 (v1.4.5+)
│   ├── desktop/             # memory.wiki Desktop — DMG (v2.3.6+, Developer ID 사인+notarize)
│   ├── chrome-extension/    # memory.wiki Chrome — Web Store 출시 (v2.2.4)
│   ├── cli/                 # memory-wiki-cli — npm 출시 (v1.4.x)
│   └── quicklook/           # macOS QuickLook 플러그인
├── docs/
│   ├── ROADMAP.md
│   ├── MANIFESTO.md
│   └── ... 외 전략 노트들
├── .github/workflows/
│   └── ci.yml               # 단일 CI 파이프라인 (Node, WASM 없음)
├── vercel.json
└── package.json             # 워크스페이스 루트
```

---

## 기술 스택

### Renderer: markdown-it (모든 표면 공유)

- **markdown-it** + **markdown-it-footnote** — 마크다운 → HTML
- **highlight.js** — 코드 신택스 하이라이팅
- **KaTeX** — 수식 렌더링 (`$..$`, `$$..$$`)
- **Mermaid** — 다이어그램 (런타임 동적 import, 테마별 변수)

설정: `tiptap-markdown`과 동일 (thead/tbody 제거 + footnote). 에디터 Live 탭과 모든 뷰어가
같은 DOM 출력 → "여기선 다르게 보임" 부류 버그가 구조적으로 발생 불가.

### Web Framework: Next.js 15 (App Router)

- **TipTap** — 에디터 Live 탭 (ProseMirror 기반 WYSIWYG). 내부적으로 동일 markdown-it.
- **TailwindCSS** — 스타일링
- **Supabase** — Postgres + Auth + Realtime
- **Vercel** — 호스팅 + 자동 배포

### 렌더링 파이프라인 (모든 비편집 표면)

```text
사용자 입력 (Markdown)
  → render() in apps/web/src/lib/render.ts
    1. markdown-it.render(body)
    2. styleAsciiDiagrams()  — ASCII 박스 다이어그램 감지
    3. highlightCode()       — highlight.js
    4. processKatex()        — $..$, $$..$$ → KaTeX widget
    5. processImages()       — alt 텍스트 정렬 마커 + figure wrap
  → dangerouslySetInnerHTML
    → Mermaid: useEffect에서 mermaid.js 동적 렌더링
```

Live 탭(편집)은 TipTap이 같은 markdown-it 인스턴스로 ProseMirror 트리를 만들어
실시간 편집을 처리. 출력 DOM은 일치.

### markdown-it 출력 형식

- 코드 블록: `<pre><code class="language-X">...</code></pre>`
- 테이블: `<table>`만 (thead/tbody는 패치로 비활성, TipTap 호환)

`render.ts`의 후처리 regex는 이 형식에 맞춰져 있음.

---

## 패키지 + 앱

| 디렉토리 | 출시 채널 | 상태 |
| --- | --- | --- |
| `apps/web` | memory.wiki (Vercel) | 라이브 |
| `apps/vscode-extension` | VS Code Marketplace (memory-wiki-vscode) | v1.4.5 |
| `apps/desktop` | DMG 다운로드 | v2.3.6 (Developer ID 사인+notarize) |
| `apps/chrome-extension` | Chrome Web Store | v2.2.4 |
| `apps/cli` | npm (memory-wiki-cli) | v1.4.3 |
| `apps/quicklook` | macOS QuickLook 플러그인 | Desktop DMG에 번들 |
| `packages/mcp` | npm (memory-wiki-mcp) | v1.5.4 |

각 채널은 독립적으로 빌드/배포되지만 렌더 로직은 동일 `render.ts` (vendored copy).

---

## 현재 상태 (2026-05)

### 라이브 + 검증된 것

- memory.wiki 메인 (Next.js 15, Vercel)
- GFM 전체, KaTeX, Mermaid, 코드 하이라이팅
- 짧은 URL 공유 (`memory.wiki/{nanoid}`) + 권한 모델
- 다크/라이트 토글, 모바일 반응형, 드래그 앤 드롭
- 문서 / 번들 / 허브 (3-tier URL 아키텍처)
- AI 통합 (Gemini, OpenAI, Anthropic), AI 사이드 패널, 컨셉 인덱스
- 실시간 협업 (Yjs CRDT)
- Public viewer / Bundle viewer / Embed / Raw markdown
- VS Code ext, Desktop, Chrome ext, CLI, MCP 채널 전부 동작

### 직전 작업 (2026-05-16)

- **Rust→WASM 엔진 완전 일몰**: 모든 표면을 markdown-it으로 통일
  - Phase 1: 웹앱 WASM 제거 → `apps/web/src/lib/render.ts`
  - Phase 2: VS Code ext v1.4.0
  - Phase 3: Desktop v2.2.0 (사인+notarize)
  - Phase 4: `packages/engine` + 미출시 `@mdcore/*` 4개 일괄 삭제
  - Phase 5: 마케팅/문서 정리

---

## 개발 가이드

### 로컬 개발

```bash
cd apps/web
npm install
npm run dev    # → http://localhost:3000
```

### 빌드 & 배포

- `git push origin main` → GitHub Actions CI → Vercel 자동 배포 (memory.wiki)
- VS Code ext: `cd apps/vscode-extension && npx @vscode/vsce publish`
- Desktop DMG: `cd apps/desktop && npm run build:dmg`
  (사전 설치: Developer ID Application 인증서 + 환경변수 `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — keychain에 `mdfy-notarize`
  프로필로 저장됨)
- Chrome ext: 수동 zip + Web Store 업로드
- CLI / MCP: `npm publish` 워크스페이스별

### 코드 수정 시 주의사항

- **render.ts**: 모든 비편집 뷰어가 공유. 변경 시 web + vsce + desktop의 vendored copy를
  같이 갱신해야 함 (현재는 수동 복사 — 향후 워크스페이스 패키지화 검토).
- **MdEditor.tsx**: 하드코딩 색상 X, CSS 변수(`var(--xxx)`) 사용
- **globals.css**: `[data-theme="dark"]`와 `[data-theme="light"]` 양쪽 CSS 변수 유지
- **새 마크다운 기능 추가 시**: markdown-it 플러그인 추가 → `lib/render.ts`에 wire → 같은 인스턴스를
  TipTap 측 `tiptap-markdown` config에도 반영 (DOM 정합).

### 브랜드 + UI/UX 시스템 (필수 참조)

모든 시각/인터랙션/카피 결정 전에 **canonical 브랜드 시스템 문서**부터 확인:

- **Wiki (canonical)**: <https://memory.wiki/L2SHNVir>
- **Repo stub**: `BRAND.md` at project root

색상 토큰, 타이포그래피, 스페이싱, 라디우스, 모션, 보이스 룰
(no `·`/`—`/`→`/emoji), URL 아키텍처, Lucide 아이콘 사이즈, 탭바/BrandLoader/
auth 화면 스펙, 픽커/카드/시트 패턴, 햅틱, 접근성, anti-pattern,
새 채널 surface checklist 까지 전부 한 곳에 정리됨.

**새 패턴 추가 시: 위키 문서 먼저 업데이트 → 코드 ship.** 토큰 변경 시
`globals.css` (web) + `Brand.swift` (iOS) + `Brand.kt` (Android) 동시 업데이트.

---

## 핵심 원칙

1. **Markdown은 엔진이지 인터페이스가 아니다.** 사용자는 MD를 몰라도 된다.
2. **바이럴 루프가 먼저.** 뱃지 + 공유 = 무료 마케팅. 이것 없이 다른 것 만들지 않는다.
3. **크로스 AI = 구조적 해자.** AI 회사가 절대 복제 못하는 포지션.
4. **제품 1개, 해자 1개.** 확장은 순차적으로.
5. **Web-Native Document.** 문서는 파일이 아니라 URL이다.
6. **Zero friction.** 로그인 없이, 3초 안에 가치 전달.
7. **Build in public.** 1인+AI 팀 자체가 마케팅.

---

## 자주 겪는 문제

| 문제 | 원인 | 해결 |
| --- | --- | --- |
| Mermaid가 텍스트로 표시 | `useEffect`에서 mermaid.js가 늦게 로드되거나 `<pre lang="mermaid">` 형식 깨짐 | 콘솔에서 `window.mermaid` 확인, render.ts 출력 형식 점검 |
| KaTeX가 `$..$` 그대로 노출 | `processKatex()`가 `<pre>` 안만 스킵하므로 inline `<code>` 안의 math는 미처리 | 의도된 동작 (코드 안 수식은 드물고 위험성 큼). 정말 필요하면 \\$로 이스케이프 |
| Live 탭과 뷰어 출력 차이 | TipTap의 markdown-it 설정이 `lib/render.ts`와 어긋남 | thead/tbody nooped 여부 + footnote 플러그인 일치 확인 |
| Desktop 로그인 후 Electron welcome 뜸 | dev 모드 (`npm start`)는 `memory.wiki://` 프로토콜이 generic Electron에 등록됨 | production DMG 빌드 → /Applications 설치 후 실행 |
| Vercel 빌드 시 `npm ci` 실패 | package-lock.json 없음 또는 충돌 | `npm install` 사용 (`vercel.json` `installCommand` 참고) |
