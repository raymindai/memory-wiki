---
marp: true
theme: default
paginate: true
backgroundColor: '#0a0a0a'
color: '#f4f4f5'
title: 'mdfy — 사용자 / 제품 데모 덱'
style: |
  section { font-family: 'Pretendard', 'Inter', system-ui, sans-serif; padding: 64px 72px; letter-spacing: -0.01em; }
  section.lead { justify-content: center; text-align: left; }
  section.lead h1 { font-size: 64px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 24px; }
  section.lead h2 { font-size: 24px; font-weight: 500; color: #a1a1aa; margin-top: 0; border: none; }
  h1 { color: #fb923c; font-size: 40px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 24px; }
  h2 { color: #fafafa; font-size: 30px; font-weight: 700; letter-spacing: -0.015em; margin-top: 0; margin-bottom: 18px; }
  h3 { color: #fb923c; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 28px; margin-bottom: 10px; }
  p, li { font-size: 24px; line-height: 1.55; color: #e4e4e7; }
  strong { color: #fafafa; font-weight: 700; }
  em { color: #fb923c; font-style: normal; }
  code { background: #18181b; color: #fdba74; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-family: 'JetBrains Mono', monospace; }
  pre { background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 20px; font-size: 18px; line-height: 1.4; }
  pre code { background: none; color: #fdba74; padding: 0; }
  blockquote { border-left: 3px solid #fb923c; padding-left: 20px; color: #d4d4d8; font-style: italic; margin: 18px 0; }
  hr { border: none; border-top: 1px solid #27272a; margin: 28px 0; }
  ul { padding-left: 24px; }
  li { margin-bottom: 10px; }
  section::after { color: #52525b; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
  .accent { color: #fb923c; }
  .muted { color: #a1a1aa; }
  .faint { color: #71717a; }
---

<!-- _class: lead -->

# **mdfy**
## 모든 AI에 배포 가능한 당신의 기억층.

<br>

<span class="muted">ChatGPT, Claude, Cursor, Codex — 다 잊는다. mdfy는 안 잊는다.</span>

---

# 캡처 · 어디서든 가져온다

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;">

<div>

<h3>AI 대화에서</h3>

- ChatGPT, Claude, Gemini 공유 링크 붙여넣기
- Chrome 확장으로 원클릭 캡처
- Claude Code / Cursor 에서 MCP 호출

<h3>다른 곳에서</h3>

- GitHub repo의 `.md` 파일들
- Notion 페이지 / Obsidian vault (.zip)
- PDF, DOCX, 코드 파일, 어떤 URL

</div>

<div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px;">

<div class="faint" style="font-size:13px;font-family:monospace;letter-spacing:0.08em;text-transform:uppercase;">결과</div>

<p style="font-size:20px;color:#e4e4e7;margin-top:12px;">
모든 것이 <strong>영구 URL</strong>이 된다.
</p>

<p style="font-size:16px;color:#a1a1aa;margin-top:8px;font-family:monospace;">
memory.wiki/d/&lt;id&gt;
</p>

<p style="font-size:18px;color:#d4d4d8;margin-top:18px;">
사람도 읽고, AI도 읽는다. 같은 주소에서.
</p>

</div>

</div>

---

# 정리 · 당신이 안 그린 연결을 AI가 그린다

당신이 쓴 문서가 자동으로 **컨셉 인덱스**로 연결된다.

<br>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>당신이 하는 것</h3>

- 글을 쓴다
- 캡처를 정리한다
- 폴더로 묶는다

</div>

<div>

<h3>mdfy 가 하는 것</h3>

- 핵심 개념 자동 추출
- 문서 간 의미 연결 발견
- *"이 허브 내 관련 문서"* 자동 노출
- 위키링크 markup 없이도 작동

</div>

</div>

<br>

> *AI가 링크를 그린다. 당신은 글만 쓰면 된다.*

---

# 번들 · 주제별로 묶고 AI가 통합 분석한다

여러 문서를 하나의 주제로 묶으면 — 자동으로 **분석 결과**가 나온다.

<br>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>번들이 답하는 질문들</h3>

- 핵심 테마 4-5개
- 비-자명한 통찰
- 문서 간 연결
- 추천 읽기 순서
- 누락된 관점 (gaps)

</div>

<div>

<h3>매 번들 URL은</h3>

마크다운 + `graph_data` JSON을 함께 응답한다. 받는 AI가 이전 AI의 분석을 *공짜로* 상속받는다.

```
memory.wiki/b/<bundle-id>
memory.wiki/b/<id>?compact
memory.wiki/b/<id>?full=1
```

</div>

</div>

---

# 배포 · 한 줄로 모든 AI가 읽는다

`AGENTS.md` / `CLAUDE.md` / `.cursor/rules` 에 한 줄만 추가하면 — 다음 세션부터 AI가 당신의 허브를 컨텍스트로 로드한다.

<br>

```markdown
## Context
프로젝트 맥락은 여기: https://memory.wiki/hub/you

배경, 결정 기록, 진행 중인 작업이 다 들어 있음.
질문에 답할 때 이 URL을 컨텍스트로 사용해 줘.
```

<br>

| 도구 | 어디에 |
|---|---|
| Claude Code | `CLAUDE.md` (프로젝트 루트) |
| Cursor | `.cursor/rules/mdfy.mdc` |
| Codex CLI | `AGENTS.md` |
| Aider | `CONVENTIONS.md` |
| ChatGPT / 웹 AI | URL 직접 붙여넣기 |

---

# 시작하기

<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;">

<div>

<h3>지금 바로 (가입 없이)</h3>

1. **memory.wiki** 접속
2. AI 대화 URL 붙여넣거나 글 작성
3. 나오는 memory.wiki URL을 Claude / Cursor / ChatGPT 에 보내기
4. 끝.

</div>

<div>

<h3>둘러보기</h3>

- **데모 허브:** `memory.wiki/hub/demo`
- **샘플 번들:** `memory.wiki/b/<id>`
- **스펙:** `memory.wiki/spec`
- **통합 가이드:** `memory.wiki/docs/integrate`
- Chrome 확장 / MCP 서버 모두 무료

</div>

</div>

<br>

<span class="accent" style="font-size:28px;font-weight:700;">memory.wiki</span>
<span class="faint" style="font-size:16px;font-family:monospace;margin-left:16px;">hi@raymind.ai</span>
