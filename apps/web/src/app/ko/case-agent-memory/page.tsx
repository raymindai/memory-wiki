import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "agent-memory",
  kicker: "에이전트 영구 메모리",
  title: "어제 한 일을 기억하는 장기 에이전트.",
  sub: "자율 AI 에이전트를 만들거나 운영하는 사람을 위해. 기본은 매 런이 처음부터 — Memory.Wiki는 허브 URL을 에이전트의 런 간 메모리로 만들고, MCP 서버를 통해 읽기/쓰기 가능.",
  pain: [
    "에이전트 (Claude Code, Cursor agent, Aider, 커스텀 등) 가 한 시간 동안 돌아가서 12개 결정을 내리고 작업을 마칩니다. 다음 런은 처음부터.",
    "벤더 방식으로 메모리를 붙입니다 — Cursor rules 파일, OpenAI Memories, 에이전트별 JSON 상태. 각각 다른 포맷에 살고, 도구 간 공유 안 되고, 문서처럼 읽을 수도 없음.",
    "에이전트가 잘못된 결정을 하면 trail을 audit 못 함. 메모리가 불투명하거나 N개 store에 흩어져 있음.",
    "벡터 DB + 커스텀 retrieval 레이어를 붙이지 않고 이전 런에서 배우게 하고 싶음.",
  ],
  action: [
    {
      step: "에이전트에 Memory.Wiki 허브 부여",
      detail: "허브 생성 (memory.wiki/hub/<slug>). 허브 URL이 에이전트의 메모리 주소. 안에 있는 번들 URL이 프로젝트/태스크 타입별로 메모리를 스코프.",
    },
    {
      step: "MCP 서버 연결",
      detail: "`memory-wiki-mcp`를 에이전트의 MCP 설정 (Claude Code의 .mcp.json, Cursor의 설정 등) 에 떨어뜨림. 이제 에이전트는 자기 허브를 향한 26개 도구 — read, write, search, append, version — 를 가짐.",
    },
    {
      step: "런 전: 허브 URL을 컨텍스트로 pull",
      detail: "모든 에이전트 런의 첫 단계는 `Memory.Wiki pull <hub_url>` 또는 `Memory.Wiki search <task topic>`. 허브는 plain 마크다운으로 fetch됨 — 벡터 셋업 없음, 벤더 SDK 없음.",
    },
    {
      step: "런 후: 결정을 다시 write",
      detail: "에이전트가 끝나면 `Memory.Wiki capture` (또는 `mw_create` MCP 도구) 를 호출 — 구조화된 요약 (결정, 근거, 수정한 파일, follow-up) 과 함께. 다음 런이 이를 이전 모든 것과 함께 읽음.",
    },
  ],
  result: [
    "에이전트 메모리가 audit, 공유, 다른 에이전트에 핸드오프 가능한 URL — 벤더 blob이 아님.",
    "도구 간 호환: 같은 허브 URL이 Claude Code 에이전트, Cursor 에이전트, 커스텀 Aider 루프에 모두 작동. 전부 같은 메모리를 봄.",
    "기본 버전 관리: 모든 write가 스냅샷. 에이전트가 regression을 만들면 번들을 diff.",
    "Concept index가 런 간 겹치는 테마를 끌어냄 — \"에이전트가 Postgres를 고른 게 이번이 세 번째\"가 related 패널에 떠오름.",
  ],
  example: {
    title: "예시: 같은 repo에서 30번 돌아간 코딩 에이전트",
    body: "허브 memory.wiki/hub/acme-agent — 주요 리팩토링 (auth, billing, search) 별로 번들. 매 런은 번들 URL을 fetch하며 시작, 결정 문서를 append하며 종료. 30번 런 후 허브에는 47개 결정, \"rate-limit\"을 9개에서 엮은 concept index가 있고, 새 AI 세션이 누군가 re-prime하지 않아도 마지막 지점에서 정확히 이어받음.",
  },
  related: [
    { slug: "cross-tool-handoff", label: "도구 간 핸드오프" },
    { slug: "project-decisions", label: "프로젝트 의사결정" },
    { slug: "docs-as-kb", label: "지식 베이스로서의 문서" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} locale="ko" />; }
