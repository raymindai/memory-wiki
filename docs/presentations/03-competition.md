---
marp: true
theme: default
paginate: true
backgroundColor: '#0a0a0a'
color: '#f4f4f5'
title: 'Memory.Wiki — 공모전 / 심사용 덱'
style: |
  section { font-family: 'Pretendard', 'Inter', system-ui, sans-serif; padding: 64px 72px; letter-spacing: -0.01em; }
  section.lead { justify-content: center; text-align: left; }
  section.lead h1 { font-size: 64px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 24px; }
  section.lead h2 { font-size: 24px; font-weight: 500; color: #a1a1aa; margin-top: 0; border: none; }
  h1 { color: #fb923c; font-size: 40px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 24px; }
  h2 { color: #fafafa; font-size: 30px; font-weight: 700; letter-spacing: -0.015em; margin-top: 0; margin-bottom: 18px; }
  h3 { color: #fb923c; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 28px; margin-bottom: 10px; }
  p, li { font-size: 22px; line-height: 1.5; color: #e4e4e7; }
  strong { color: #fafafa; font-weight: 700; }
  em { color: #fb923c; font-style: normal; }
  code { background: #18181b; color: #fdba74; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-family: 'JetBrains Mono', monospace; }
  pre { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 20px; font-size: 17px; line-height: 1.4; }
  pre code { background: none; color: #fdba74; padding: 0; }
  blockquote { border-left: 3px solid #fb923c; padding-left: 20px; color: #d4d4d8; font-style: italic; margin: 18px 0; }
  table { border-collapse: collapse; font-size: 19px; width: 100%; }
  th, td { padding: 10px 16px; text-align: left; border-bottom: 1px solid #27272a; }
  th { color: #fb923c; font-weight: 600; }
  hr { border: none; border-top: 1px solid #27272a; margin: 28px 0; }
  ul { padding-left: 24px; }
  li { margin-bottom: 8px; }
  section::after { color: #52525b; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
  .accent { color: #fb923c; }
  .muted { color: #a1a1aa; }
  .faint { color: #71717a; }
---

<!-- _class: lead -->

<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,146,60,0.12);color:#fb923c;font-size:13px;font-weight:600;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Memory.Wiki · 2026</span>

# **Memory.Wiki**
## 모든 AI에 배포 가능한 당신의 기억층.

<br>

<span class="faint">조현상 (Hyunsang Cho) · hi@raymind.ai</span>

---

# 문제

**AI 도구는 매 세션마다 당신을 잊는다.**

ChatGPT, Claude, Cursor, Codex, Gemini — 각자 자기만의 메모리 레이어를 만들지만, 모두 자기 벽 안에서만 작동한다.

사용자는 매번 같은 컨텍스트를 다시 설명한다. 매일 수조 토큰의 AI-기반 사고가 만들어지고, 다시 돌아가지 않는 채팅 기록 속에 잃어버려진다.

<h3>역사상 가장 비싼 망각 기계.</h3>

---

# 통찰

**LLM은 마크다운을 읽는다. URL은 모든 경계를 넘는다.**

당신의 기억이 **마크다운 URL** 이라면, 당신이 쓰는 모든 AI가 같은 방식으로 가져온다. 같은 fetch. 같은 파싱. 같은 컨텍스트.

기억은 어느 한 AI 안의 *기능*이 아니어야 한다. 모든 AI *위의 레이어*여야 한다.

> *"Obsidian이 IDE, LLM이 프로그래머, 위키가 코드베이스다."* — Karpathy

우리는 그 로컬-파일 모양을 URL 모양으로 다시 만들었다.

---

# 어떻게 작동하는가

```
   캡처              정리                  배포
   ────              ────                  ────
  Chat URL ─┐    ┌─ Concept Index ─┐    Claude
  PDF      ─┤    │                  ├─  Cursor
  GitHub   ─┼──→ │  번들 + 그래프   ├─→ Codex
  Notion   ─┤    │                  ├─  ChatGPT
  Paste    ─┘    └─  허브 @ /hub/you ┘   Gemini
```

허브 URL 응답은 **마크다운 + 인라인 graph_data JSON** — 테마, 인사이트, 컨셉 관계가 한 번의 fetch에 다 담긴다.

<span class="faint">데모: memory.wiki/hub/demo</span>

---

# 핵심 해자: 크로스 AI는 구조적으로 비-AI 회사만 만들 수 있다

**AI 회사는 크로스 AI 기억층을 만들 수 없다.**

그들의 매출은 *벽* 위에 서 있다. ChatGPT의 메모리가 ChatGPT 안에서만 작동하는 이유는, Cursor 안에서도 작동하게 만들면 사용자가 "ChatGPT의 메모리에 돈 낼 이유"를 잃기 때문이다.

"AI 위의 레이어"는 어느 한 AI 벤더의 벽에 매출이 의존하지 않는 플레이어에게만 구조적으로 열려 있다.

<br>

<span class="accent">→ 그게 우리의 자리.</span>

---

# 무엇이 가능한가

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>5분 안에 일어나는 일</h3>

- ChatGPT 대화 공유 URL을 붙여넣기 → 영구 URL
- GitHub repo의 `.md` 파일들 → 자동 임포트
- PDF / DOCX / 코드 파일 드롭 → 깨끗한 마크다운
- 비슷한 문서들이 자동으로 컨셉 인덱스로 묶임
- 그 URL을 Claude / Cursor / Codex 에 붙여넣기 → 매 세션이 이전 작업을 안 채로 시작

</div>

<div>

<h3>오늘 살아있는 것</h3>

- Memory.Wiki 운영중 (Vercel)
- 데모 허브: 50 문서 / 7 번들
- Chrome 확장 (스토어)
- MCP 서버 (npm)
- 공개 스펙 (memory.wiki/spec)
- 통합 가이드 (memory.wiki/docs/integrate)
- 엔진 MIT 오픈소스

</div>

</div>

---

# 기술 / 오픈 스펙

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>스택</h3>

- **markdown-it** 단일 렌더 파이프라인 (에디터 + 모든 뷰어)
- **Next.js 15** 웹앱 (Vercel)
- **Supabase** Postgres + pgvector + HNSW
- 하이브리드 검색 (BM25 + 벡터)
- Anthropic Haiku 리랭커

</div>

<div>

<h3>오픈된 것</h3>

- `/spec` — URL 계약, 번들 다이제스트
- `/llms.txt` 표준 — 모든 허브 자동 노출
- `@memory.wiki/engine` (MIT)
- `@memory.wiki/mcp-server` (오픈소스)
- Chrome 확장 (오픈소스)
- 통합 가이드 + GitHub Action 레시피

</div>

</div>

---

<!-- _class: lead -->

# 다음 단계

<br>

**2026년 8월 공개 런칭 (Show HN)**

- 무료 영구 — 캡처 / 허브 / 크로스 AI 배포
- Pro 티어 — 커스텀 도메인, 분석, 자동 분석 (가격 TBD)
- 두 번째 엔지니어 — PMF 시그널 확인 후

<br>

<span class="muted">**지금 바로 체험:** memory.wiki/hub/demo</span>

<span class="muted">**스펙:** memory.wiki/spec · **통합:** memory.wiki/docs/integrate</span>

<br>

<span class="faint">조현상 · hi@raymind.ai · github.com/raymindai/mdcore</span>
