import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "docs-as-kb",
  kicker: "지식 베이스로서의 문서",
  title: "팀의 문서를 AI 읽기 가능하게.",
  sub: "소규모 엔지니어링/프로덕트 팀을 위해. 흩어진 문서를 Claude, Cursor, ChatGPT가 같은 방식으로 fetch할 수 있는 허브 URL로 — 커스텀 RAG 파이프라인 없음.",
  pain: [
    "팀 문서가 4곳에 살고 있음: Notion, GitHub README, Confluence, 반쯤 완성된 Google Docs. 그 중 아무것도 AI 읽기 가능하지 않음.",
    "새 개발자가 AI에게 \"우리 auth가 어떻게 동작해?\" 물으면 지어냄. 유료 Copilot Workspace로도 코드베이스의 구체를 모름.",
    "문서 위에 커스텀 RAG를 만드는 데 일주일. 영원히 유지보수.",
    "온보딩 문서 → \"이 페이지 → 그리고 이 페이지 → 그리고 이 옛 위키 → 지금 틀린 거 → Sarah에게 물어봐.\"",
  ],
  action: [
    {
      step: "중요한 문서 import",
      detail: ".md 파일이 있는 GitHub repo (URL 하나, memory.wiki가 모든 .md를 walk). Notion 페이지 (URL + 통합 토큰 paste). Obsidian 볼트 (.zip 드롭). URL 페이지 (어떤 공개 docs 페이지든). 컴퓨터에서 파일 드래그앤드롭.",
    },
    {
      step: "허브 public으로",
      detail: "설정 → Hub public 토글. memory.wiki가 index.md / SCHEMA.md / log.md / llms.txt를 허브 루트에 자동 발행 — 모든 AI 에이전트가 선호하는 프로토콜.",
    },
    {
      step: "하나의 URL 공유",
      detail: "memory.wiki/hub/<your-team>. CLAUDE.md, .cursorrules, .codex-agents — 팀의 AI가 컨텍스트를 로드하는 곳 어디든에 넣음. 각 AI가 같은 방식으로 fetch하고 ingest.",
    },
    {
      step: "lint이 drift를 드러내게",
      detail: "Needs Review가 orphan 문서 (다른 문서에서 링크되지 않음) 와 가능한 중복을 강조. 한 번 클릭으로 해결. 문서-차르 없이 KB가 일관됨.",
    },
  ],
  result: [
    "\"우리 auth가 어떻게 동작해?\" — 팀의 모든 AI가 실제 문서에서 답함, 원본 URL 인용 포함.",
    "신입은 첫날 허브 URL을 읽고 둘째날부터 생산적.",
    "문서 업데이트가 즉시 전파됨. AI는 매 호출마다 새 마크다운을 fetch — 재빌드 없음.",
    "유지보수할 커스텀 RAG 없음. 토큰 비용이 가시화 (허브 헤더의 token-economy 뱃지) 되고 튜닝 가능 (?compact, ?digest).",
  ],
  example: {
    title: "예시: memory.wiki/hub/acme의 28개 문서 엔지니어링 KB",
    body: "GitHub (README 12개) + Notion (아키텍처 문서 9개) + URL ingest (벤더 문서 7개) 에서 import. Public 허브, hub recall + reranker on. CLAUDE.md가 허브 URL을 가리킴. 새 개발자가 같은 URL을 Cursor에 paste.",
  },
  related: [
    { slug: "cross-tool-handoff", label: "도구 간 핸드오프" },
    { slug: "project-decisions", label: "프로젝트 의사결정" },
    { slug: "meetings-and-interviews", label: "회의 + 인터뷰 로그" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} locale="ko" />; }
