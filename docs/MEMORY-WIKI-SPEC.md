# memory.wiki — Product Specification

> **Internal spec.** Hand-off document for implementation planning. Defines what "true memory.wiki" means, what's required to honor that promise, and what is explicitly out of scope.
>
> **Author**: strategic conversation between founder + Claude (this session, mdcore1)
> **Audience**: implementation session (phase2) + future contributors
> **Status**: draft v0.1 — pending founder lock + scoping to launch window
> **Last updated**: 2026-05-14

---

## 0. TL;DR

`memory.wiki`는 **개인 지식 위키**이면서 동시에 **모든 AI에 deploy 가능한 메모리 레이어**다. 두 문이 하나의 hub에서 만난다.

핵심 약속 한 줄: **"You author. AI uses. The wiki maintains itself."**

이 약속을 정직하게 만들기 위해 현재 memory.wiki 대비 부족한 것은 — 한 문장으로 — **링크 그래프, 의미 기반 검색, LLM 자가 정리** 셋. 이 spec은 그 셋을 핵심으로 두고, 그 위에 신뢰/네트워크 효과 layer를 얹는다.

---

## 1. Vision

### 1.1 한 문장 정의

> **memory.wiki는 당신이 author하고, AI가 사용하고, LLM이 스스로 유지하는 개인 위키다.**

### 1.2 Two Doors

같은 product에 두 개의 entry mental model이 있다. 사용자가 어느 쪽으로 들어와도 같은 hub에 도달.

| 문 | 약속 | 핵심 행동 |
|---|---|---|
| **Memory door** | "AI가 나를 기억한다" | 1-click capture → URL → paste anywhere |
| **Wiki door** | "내 머릿속이 정리된다" | 자동 concept index, backlinks, search, LLM lint |

### 1.3 Brand Pillars

1. **You author. AI uses.** — AI가 추출하는 게 아니라 사용자가 직접 author/소유.
2. **One URL deploys everywhere.** — Cross-AI, cross-tool, cross-session.
3. **The wiki maintains itself.** — LLM이 정기적으로 정리 (orphan 찾기, 개념 통합, 모순 surface).
4. **Open spec, not platform lock-in.** — Bundle URL format은 표준, mdcore 엔진은 MIT.

### 1.4 What it is NOT (anti-patterns)

- ❌ 또 하나의 노트 앱 (Notion, Obsidian)
- ❌ AI-extracted memory (Mem.ai 모델 — 정반대)
- ❌ 기업용 위키 (Confluence)
- ❌ "마크다운 에디터 + 클라우드 저장"
- ❌ Login wall 뒤의 콘텐츠
- ❌ 마크다운을 사용자에게 숨김 (Notion 식)
- ❌ Vendor lock-in (export/spec 모두 open)

---

## 2. Product Architecture

### 2.1 4 Primitives

```
Hub                                 ← 사용자 namespace, 영속 ID
 ├── Docs                           ← 단일 마크다운 문서 (URL)
 │    ├── outbound [[links]]
 │    ├── backlinks (computed)
 │    ├── concepts (LLM-extracted)
 │    └── version history
 ├── Bundles                        ← 큐레이션된 doc 묶음 (deployable URL)
 │    ├── compact form (?compact=1)
 │    ├── semantic API (?q=...)
 │    └── citations
 └── Concept Index                  ← 자동 생성 위키 색인
      ├── concept node × N
      └── concept → docs map
```

### 2.2 URL Spec

다음 URL 패턴은 *spec*이다. 외부 LLM/도구가 이 패턴을 신뢰하고 통합할 수 있어야 함.

| URL | 역할 |
|---|---|
| `memory.wiki/{user}` | Hub home — public face |
| `memory.wiki/{user}/{slug}` | 단일 doc |
| `memory.wiki/{user}/b/{bundle}` | Bundle deploy URL |
| `memory.wiki/{user}/c/{concept}` | Concept page |
| `memory.wiki/{user}/llms.txt` | AI-readable hub index (Anthropic 권장 spec) |
| `memory.wiki/{user}/search?q=...` | Hub-wide full-text search |
| `memory.wiki/{user}?compact=1` | Token-efficient form |
| `memory.wiki/{user}?q=react&limit=5` | Semantic retrieval API |
| `memory.wiki/{user}/graph.json` | Hub의 link graph (machine-readable) |
| `memory.wiki/spec` | URL/Bundle 공식 spec 페이지 |

### 2.3 Data Model 핵심 필드

```typescript
// Hub
interface Hub {
  slug: string;              // memory.wiki/{slug}
  ownerId: string;
  displayName: string;
  bio: string;
  isPublic: boolean;         // /hubs 갤러리 노출 여부
  isVerified: boolean;       // blue-check
  conceptIndexUpdatedAt: Date;
  createdAt: Date;
}

// Doc
interface Doc {
  id: string;
  hubSlug: string;
  slug: string;
  title: string;
  markdown: string;
  outboundLinks: string[];   // [[wikilink]] resolved → target doc IDs
  conceptTags: string[];     // LLM-extracted concept slugs
  capturedFrom?: 'chrome' | 'paste' | 'import' | 'manual';
  capturedAt?: Date;
  visibility: 'public' | 'unlisted' | 'private';
  versionId: string;         // current head
}

// DocVersion
interface DocVersion {
  id: string;
  docId: string;
  markdown: string;
  authoredAt: Date;
  authoredBy: string | 'llm-lint';  // human vs LLM auto-edit
  diffSummary?: string;
}

// Bundle
interface Bundle {
  id: string;
  hubSlug: string;
  slug: string;
  title: string;
  description: string;
  docOrder: string[];         // doc IDs, ordered
  isDiscoverable: boolean;
  embeddings?: VectorIndex;   // for ?q= queries
}

// Concept (LLM-extracted)
interface Concept {
  id: string;
  hubSlug: string;
  slug: string;
  canonicalName: string;
  aliases: string[];          // "React" / "ReactJS" / "react.js"
  appearsInDocs: string[];    // doc IDs
  definition?: string;        // optional LLM-written gloss
  relatedConcepts: string[];
}

// Link (graph edge)
interface Link {
  fromDocId: string;
  toDocId: string;
  context: string;            // surrounding text snippet
  createdAt: Date;
}
```

### 2.4 Key User Journeys

#### Journey A: First Capture (Memory door)
1. 사용자가 ChatGPT/Claude/Cursor에서 답변 받음
2. Chrome extension 클릭 → conversation을 markdown으로 변환
3. memory.wiki에 자동 저장, doc URL 생성
4. URL을 다른 AI에 paste → context 즉시 사용

**Critical UX**: 가입 없이 가능. 30초 안에 완료. 첫 doc 생성 후 *"create your hub"* 부드럽게 prompt.

#### Journey B: Wiki Browse (Wiki door)
1. 사용자가 자기 hub 방문 (`memory.wiki/yourname`)
2. Concept Index 자동 노출 (예: React, Stoic philosophy, Korean tax law)
3. concept 클릭 → 관련 모든 docs + backlinks
4. 한 doc에서 [[다른 개념]] 클릭 → 자동 navigate
5. 검색창에서 *"React hook"* → 관련 chunks 즉시

**Critical UX**: Wikipedia처럼 느껴져야 함. 정보 architecture가 보여야 함.

#### Journey C: Deploy to AI
1. 사용자가 Cursor에 *"내 hub 컨텍스트로 작업해"* 요청
2. Cursor가 native로 `memory.wiki/yourname` 인지 (또는 사용자가 paste)
3. Cursor가 hub의 llms.txt 또는 ?compact=1 form fetch
4. AI가 hub 컨텍스트로 작업 진행

**Critical UX**: 사용자가 매번 paste 안 해도 작동. AI 도구의 *project context* 또는 *user memory* slot에 hub URL 등록.

#### Journey D: Self-Maintaining Wiki
1. 매일 밤 LLM lint 작업 자동 실행
2. Hub 검사: orphan docs, 중복 개념, 깨진 link, 모순 의견, stale 경고
3. 사용자에게 morning digest: *"3 orphans, 2 concept merges suggested, 1 contradiction"*
4. 사용자 승인/거부 또는 자동 적용
5. 모든 LLM 편집은 `authoredBy: 'llm-lint'` 표시

**Critical UX**: 사용자 통제 가능. 자동이지만 invasive 아님. opt-in/out.

---

## 3. Required Features

### 3.1 Tier 1 — 이름이 거짓말이 되지 않으려면 (Must)

#### Wiki primitives

**[F1] `[[wikilink]]` syntax + auto-resolve**
- 작성 시 `[[Doc Title]]` 입력 → 같은 hub의 doc으로 자동 link
- Resolver: title 정확 매칭 → 못 찾으면 fuzzy → 못 찾으면 *"create draft?"*
- Outbound links는 doc save 시 resolve & store
- 데이터: `Doc.outboundLinks: string[]` 채움
- UI: live preview에서 link 시각화 (orange underline 등)

**[F2] Backlinks panel**
- 모든 doc 하단에 "Referenced by" section
- 백엔드: link table (`Link[]`) → query by `toDocId`
- 캐싱 가능 (변경 시 invalidate)
- `memory.wiki/{user}/{slug}#backlinks` deep link

**[F3] Hub-wide full-text search**
- `memory.wiki/{user}/search?q=...`
- 인덱싱: Postgres full-text or 별도 search engine (Typesense / Meilisearch)
- 결과: snippet + highlight + doc link
- Public hub은 robots indexable, private hub은 owner only

**[F4] Concept Index (LLM-generated)** ⭐
- 매주 또는 doc count 임계점에 LLM 실행
- Hub 전체 markdown → 반복 등장 개념 추출 → concepts table 갱신
- Page: `memory.wiki/{user}/concepts` — 알파벳 또는 frequency 정렬
- Concept page: `memory.wiki/{user}/c/{slug}` — concept 정의 + 등장 docs + 관련 concept
- Concept aliases 자동 통합 ("React" / "ReactJS" / "react.js")

#### Memory primitives

**[F5] Semantic Retrieval API** ⭐
- `memory.wiki/{user}?q=react+hooks&limit=5`
- `memory.wiki/{user}/b/{bundle}?q=...&limit=5`
- 임베딩: Solar embeddings (Upstage) 또는 호환 모델 (Voyage, OpenAI ada-002)
- 응답: relevant chunks (markdown) + doc URLs + relevance scores
- Token budget 자동 관리 (limit, max_tokens)

**[F6] llms.txt for hub**
- `memory.wiki/{user}/llms.txt` Anthropic 권장 spec 따름
- Hub 전체의 markdown index (title + URL + brief description)
- Token-efficient (compact form)

**[F7] Compact form**
- `?compact=1` query param
- markdown에서 frontmatter 제거, 코드블록 안의 주석 제거, 이미지 제거 옵션
- AI deploy 시 token cost 30-50% 감소 목표

#### Foundations

**[F8] Public spec page**
- `memory.wiki/spec` — Bundle URL format, llms.txt 표준, retrieval API
- Reference implementations: TypeScript / Python
- MIT 라이선스 명시
- Partner certification 가이드

### 3.2 Tier 2 — Wiki/메모리의 깊이 (3개월 내)

**[F9] AI Wiki Lint** ⭐
- 정기 (nightly or on-demand) LLM 작업
- 검사 항목:
  - Orphan docs (어디서도 link 안 됨)
  - Duplicate concepts ("React.js" vs "ReactJS")
  - Contradictions ("3개월 전엔 X, 지금은 not X")
  - Broken [[wikilinks]]
  - Stale content (180일+ 미수정 + outdated technology)
- 결과: morning digest UI + 자동 적용 옵션
- 모든 변경 audit log

**[F10] Auto-build (passive capture intelligence)**
- Chrome extension이 capture만이 아니라 **분류·연결**
- Trigger: 사용자가 같은 주제 N회 capture → *"Create Bundle 'React Hooks'?"* prompt
- LLM 추출: capture된 conversation에서 핵심 concept 자동 태깅
- 사용자 승인 후 hub에 통합

**[F11] Version history UI**
- Doc 페이지에 `History` 탭
- Diff view (markdown level)
- Author 표시 (human vs llm-lint)
- Rollback 가능

**[F12] Doc graph view**
- Hub의 link graph 시각화 (D3.js / Cytoscape)
- Concept hubs vs leaf docs 구분
- Orphan 찾기 visual aid

**[F13] Bundle templates**
- *"Daily journal"*, *"Project decisions"*, *"Research papers"* 같은 템플릿
- 사용자가 빈 hub 시작할 때 가이드

### 3.3 Tier 3 — Trust + Network effects (6개월 내)

**[F14] Native LLM 인식** ⭐
- 적어도 3개 LLM 도구가 memory.wiki URL을 native context로 인지
- Target: Cursor, Anthropic Claude (Skills), Codex CLI, Aider
- 통합 방식: spec 따른 fetch + llms.txt parse
- *"Recognized by"* 페이지에 logo 노출

**[F15] Verified profiles**
- 이메일 인증 + (옵션) 도메인 인증 → blue check
- AI가 trust signal로 사용 가능 ("이 hub은 진짜 그 사람")
- Public profile API (`/{user}/profile.json`) — 다른 도구가 read

**[F16] Inter-hub references**
- Bundle/Doc이 다른 사용자의 hub doc을 cite
- 자동 backlinks: "3 hubs reference this doc"
- 인기 docs는 trending에 노출

**[F17] Public hub directory + curation**
- `/hubs` 강화: featured, trending, recently active
- Founder pick / weekly curation
- Tag 기반 discovery (예: "AI prompting", "Korean tax")

**[F18] Bundle marketplace (fork-able)**
- 사용자 A의 bundle을 B가 fork → 자기 hub에 복제 + 수정
- GitHub 모델
- Attribution 자동 유지

---

## 4. Technical Specs

### 4.1 Core Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 App Router, Tiptap editor, Tailwind |
| Backend | Next.js API routes, Vercel Functions (Node.js / Fluid Compute) |
| Database | Supabase (Postgres) |
| Search | Postgres full-text initial → Meilisearch or Typesense at scale |
| Vector store | pgvector (in Supabase) — Upstage Solar embeddings |
| Markdown engine | markdown-it (shared across editor + every viewer) |
| AI | Upstage Solar (primary), Anthropic Claude (lint), Gemini (fallback) |
| Infra | Vercel (deploy), Cloudflare (DNS, CDN, redirects) |

### 4.2 Hub URL Resolution

```
1. memory.wiki → main marketing site
2. memory.wiki/{slug} where slug exists in hubs table → hub home
3. memory.wiki/{slug}/{path} → resolved per spec table
4. mori.wiki → 301 redirect to memory.wiki (short URL alias)
5. memory.wiki/d/{id} → backwards compat doc URL (current memory.wiki/{id})
```

### 4.3 Concept Extraction (LLM job)

```python
# pseudocode
def extract_concepts(hub_id):
    docs = fetch_hub_docs(hub_id, limit=200)
    bulk_md = "\n\n---\n\n".join(d.markdown for d in docs)

    prompt = """
    Extract distinct concepts from this user's wiki.
    For each concept: canonical name, aliases, brief definition (≤2 sentences),
    related concepts (other concepts in the wiki).
    Output JSON.
    """

    concepts_json = call_llm(prompt, bulk_md, model="solar-pro")
    upsert_concepts(hub_id, concepts_json)

    # Build concept → docs map
    for concept in concepts_json:
        for alias in [concept.canonical, *concept.aliases]:
            matching_docs = search_docs(hub_id, alias)
            link_concept_to_docs(concept.id, matching_docs)
```

Frequency: hub 변경 N개 누적 또는 weekly cron.

### 4.4 Semantic Retrieval Pipeline

```
Query: ?q=react+hooks&limit=5

1. Embed query: Solar embedding API
2. Vector search: pgvector cosine similarity, top 20 chunks
3. Re-rank: Solar reranker (optional) or BM25 hybrid
4. Return: top 5 chunks + parent doc URLs + scores
5. Cache: query → result (LRU, 24h TTL)
```

Chunk strategy: doc → markdown sections (## level) or fixed-size (500 tokens).

### 4.5 Wiki Lint LLM Job

```python
# nightly cron
def lint_hub(hub_id):
    docs = fetch_hub_docs(hub_id)

    findings = []

    # Orphan detection
    for doc in docs:
        if not has_inbound_links(doc):
            findings.append(Orphan(doc))

    # Duplicate concepts
    concepts = fetch_concepts(hub_id)
    findings += find_duplicate_concepts(concepts)  # LLM call

    # Contradictions (sample, not exhaustive)
    findings += find_contradictions(docs)  # LLM call on sampled pairs

    # Stale
    findings += find_stale_docs(docs, threshold_days=180)

    save_findings(hub_id, findings)
    notify_user_if_significant(hub_id, findings)
```

### 4.6 AI Integration Patterns

#### Pattern A: URL paste (current)
사용자가 manually URL paste → AI fetches → context loaded.

#### Pattern B: llms.txt
LLM tool fetches `memory.wiki/{user}/llms.txt` → parses → uses as index → fetches relevant docs on demand.

#### Pattern C: MCP server
memory.wiki MCP server (already shipped) exposes hub as tool → AI agent calls `memory.search(q=...)` directly.

#### Pattern D: Native partner integration (target)
Cursor / Claude Skills 가 `memory.wiki/{user}` 를 인지 → 자동 fetch + cache + use.
- Cursor: `.cursorrules` 또는 project context에 hub URL 등록
- Claude Skills: official skill으로 등록
- OpenAI Apps SDK: ChatGPT app으로 등록

---

## 5. Success Criteria

### 5.1 Product Quality Metrics

| 영역 | Metric | Target |
|---|---|---|
| Capture speed | AI 대화 → URL deploy | < 30초 |
| Wiki coverage | Concept index가 hub 단어의 % 커버 | ≥ 80% |
| Backlinks accuracy | False-positive rate | ≤ 5% |
| Search relevance | Top result relevant | ≥ 85% |
| Semantic retrieval | Recall@5 | ≥ 80% |
| Wiki lint precision | Orphan detection precision | ≥ 90% |
| LLM lint user acceptance | 제안 중 사용자 승인 비율 | ≥ 60% |

### 5.2 Adoption Metrics (6개월)

| 영역 | Metric | Target |
|---|---|---|
| Hub creation | 활성 public hubs | 1,000+ |
| Hub depth | 평균 hubs의 doc count | 15+ |
| Bundle creation | hub당 평균 bundle | 3+ |
| Concept density | hub당 평균 concept | 20+ |
| Cross-AI usage | 사용자 평균 deploy 회수/주 | 5+ |
| Native LLM 통합 | 공식 통합한 도구 | 3+ |
| Enterprise PoC | 진행 중 PoC | 1+ (Upstage) |

### 5.3 Brand Metrics

| 영역 | 검증 |
|---|---|
| 이름 정직성 | 사용자가 *"위키네"* 라고 부름 (vs *"또 다른 노트앱"*) |
| 카테고리 ownership | "personal AI memory" 검색 시 top 5 |
| Open spec adoption | 외부 구현 (3rd party SDK / 통합) 1+ |
| HN 런칭 반응 | comment 100+, vote 300+ (median 기준 양호) |

---

## 6. Migration from memory.wiki

### 6.1 도메인

```
Primary brand:  memory.wiki
Short URL:      mori.wiki  (이미 확보)
Legacy:         memory.wiki   (1년 이상 redirect 유지)

mori.wiki/{anything}    → memory.wiki/{anything} (301)
memory.wiki/{anything}     → memory.wiki/{anything} (301)
```

### 6.2 Existing URL 호환

```
memory.wiki/{id}            → memory.wiki/d/{id}      (legacy doc URL)
memory.wiki/b/{id}          → memory.wiki/d/b/{id}
memory.wiki/hub/{slug}      → memory.wiki/{slug}      (hub home as primary path)
```

`/d/{id}` namespace로 anonymous doc은 유지 (login 없이 publish 가능 = brand promise).

### 6.3 코드베이스 변경 범위

대략적인 magnitude (실제 grep 필요):

| 영역 | 추정 변경량 |
|---|---|
| 텍스트 references ("memory.wiki", "memory.wiki") | 200+ 곳 |
| Branding assets (로고, OG 이미지, favicon) | 50+ 파일 |
| Welcome/onboarding 카피 | 5+ 컴포넌트 |
| Email templates | 3-5개 |
| 환경 변수 (NEXT_PUBLIC_SITE_URL 등) | 10+ |
| Documentation (.md files in /docs) | 10-20 파일 |
| External: Vercel domains, Supabase URL config, Stripe (if), 이메일 도메인 | 인프라 작업 |

별도 [migration plan doc] 작성 필요. *이 spec의 scope 밖.*

---

## 7. Out of Scope (이 spec에서 다루지 않음)

- 결제/구독 시스템 상세 (Pricing tier 내용은 별도 doc)
- 모바일 앱 (iOS/Android) — 현재 not planned
- 실시간 협업 편집 (Yjs 기반) — Tier 3+ 검토 항목
- AI 모델 자체 호스팅 — Upstage Solar 등 외부 의존
- Chrome extension 상세 spec — 별도 doc
- VS Code extension 상세 spec — 별도 doc
- Brand identity (logo, color, typography) 상세 — 별도 doc
- 마케팅 launch plan — 별도 doc

---

## 8. Implementation Priority for Launch

### 8.1 Pre-Launch (지금 ~ 6월 초 HN/PH)

**Must ship before rebrand:**
- [F1] [[wikilink]] + resolver
- [F2] Backlinks panel
- [F4] Concept Index v1 (LLM-generated, weekly job)
- [F8] Public spec page (memory.wiki/spec)

**Should ship:**
- [F3] Hub full-text search
- [F6] llms.txt for hub
- [F7] Compact form

**Rebrand timing**: 위 4개 (F1, F2, F4, F8) ship 직후 → memory.wiki 리브랜드 → HN/PH 런칭

### 8.2 Post-Launch (6월 ~ 8월, K-Tech 시작 전)

- [F5] Semantic Retrieval API (Upstage 협업 핵심)
- [F11] Version history UI
- [F12] Doc graph view
- [F15] Verified profiles

### 8.3 K-Tech 6개월 (8월 ~ 12월)

- [F5] Semantic Retrieval **deepening** (Solar production-grade)
- [F9] AI Wiki Lint (Solar agent로 구현 → Upstage demo deliverable)
- [F10] Auto-build intelligence
- [F14] Native LLM partner 통합 (목표 3개)

### 8.4 후속 (2027+)

- [F13] Bundle templates
- [F16] Inter-hub references
- [F17] Public directory + curation
- [F18] Bundle marketplace (fork)

---

## 9. Open Questions (추후 결정 필요)

1. **Concept extraction frequency**: weekly cron vs on-demand vs incremental? Cost trade-off.
2. **Wiki lint opt-in/out granularity**: hub level? feature level? finding level?
3. **Verified profile criteria**: 이메일만? 도메인까지? Twitter/GitHub 연동?
4. **Public hub default**: opt-in (현재) vs opt-out? brand promise와 trade-off.
5. **Bundle pricing tier**: large bundles는 Pro only? 정의 필요 (size/doc count).
6. **LLM lint authorship**: 모든 LLM 편집은 user approval 필요? auto-apply categories?
7. **Cross-hub references**: 모든 hub에서? friend graph 필요?
8. **Token budget per request**: free tier API rate limits 정의.

---

## 10. References

### Internal docs (이 repo)
- `CLAUDE.md` — project overview
- `docs/MDCORE-SPEC.md` — engine spec
- `docs/integrate/` — current integration docs

### Memory files (founder context)
- `direction_v6_2026_05.md` — v6 final positioning
- `mdfy_wiki_layer_2026_05.md` — two-door product spec
- `v6_12week_plan_state.md` — current sprint status
- `url_deployability_2026_05.md` — invariant (every URL deployable as markdown to any AI)

### External
- Anthropic [llms.txt spec](https://llmstxt.org/)
- Vannevar Bush, *As We May Think* (1945) — Memex original vision
- Karpathy, LLM Wiki concept (Twitter, 2024)
- Notion, Roam, Obsidian — wiki UX references (anti-pattern source for what NOT to copy)

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **Hub** | 한 사용자의 namespace. `memory.wiki/{slug}`. |
| **Doc** | 단일 markdown 문서, 영속 URL 보유. |
| **Bundle** | 큐레이션된 doc 묶음, 단일 URL로 deploy 가능. |
| **Concept** | LLM이 hub 전체에서 추출한 반복 개념. |
| **Concept Index** | hub의 모든 concept를 모은 자동 생성 페이지. |
| **Wiki Lint** | LLM이 hub를 검사하고 정리 제안. |
| **Compact form** | `?compact=1` — token-efficient version. |
| **Semantic Retrieval** | `?q=...&limit=N` — 임베딩 기반 chunk 검색. |
| **llms.txt** | Anthropic 권장 AI-readable hub index. |
| **Native partner integration** | LLM tool이 memory URL을 paste 없이 자동 인지. |

---

*— end of spec v0.1 —*
