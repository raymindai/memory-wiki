import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "cross-tool-handoff",
  kicker: "도구 간 핸드오프",
  title: "Cursor ↔ Claude, 공유 컨텍스트로.",
  sub: "흐름 도중에 AI 도구를 갈아타는 빌더를 위해. 허브 URL은 휴대 가능한 컨텍스트 — 같은 URL을 어느 도구에 paste해도 AI가 중단된 지점에서 이어받음.",
  pain: [
    "Cursor에서 30분 동안 context-priming한 후 기능을 시작. 사고가 막힘. Claude의 second opinion을 듣고 싶음.",
    "대화를 Claude에 paste. 컨텍스트의 절반은 사라짐 — Claude는 당신의 코드베이스, 디자인 결정, 고객 피드백을 모름.",
    "Claude를 20분 re-prime. 풀림. 다시 Cursor로 돌아가고 싶음. 거기서 priming 반복.",
    "AI 시간 대부분이 한 시간 전에 이미 설명한 것을 다시 설명하는 데 쓰임.",
  ],
  action: [
    {
      step: "프로젝트 허브 한 번만 구축",
      detail: "스펙, 최근 결정, 고객 피드백, 디자인 제약을 memory.wiki 문서로 캡처. 프로젝트 이름의 번들로 묶음. 그 번들은 영구 URL 보유.",
    },
    {
      step: "Priming할 때 번들 URL paste",
      detail: "Cursor: URL을 .cursorrules나 프로젝트 README에 드롭. Claude: 시스템 프롬프트나 첫 메시지에 paste. 두 AI 모두 같은 마크다운을 fetch.",
    },
    {
      step: "자유롭게 전환",
      detail: "Cursor에서 막혔으면 Claude에 물어봄 — 둘 다 같은 허브를 읽고 있음. 컨텍스트는 어느 채팅 스레드에 있었는지가 아니라 URL.",
    },
    {
      step: "허브를 현재 상태로 유지",
      detail: "새 결정이 나오면 memory.wiki에 저장 (Hub Chat의 Save-as-doc, 또는 에디터). 다음에 URL을 paste하면 두 AI 모두 업데이트된 상태를 봄. Re-priming 없음.",
    },
  ],
  result: [
    "셋업 비용이 \"모든 대화\"에서 \"프로젝트당 한 번\"으로 이동.",
    "AI 간 전환이 번역이 아니라 paste.",
    "팀원이 합류하면 같은 URL을 paste. AI 속도로 온보딩.",
    "컨텍스트가 도구 churn에서 살아남음 — Cursor → Claude → ChatGPT → 내년의 도구 — 마이그레이션 없이.",
  ],
  example: {
    title: "예시: Cursor + Claude 동시 사용으로 기능 출시",
    body: "번들 memory.wiki/b/feat-handoff — 스펙, ADR, 고객 quote 3개, 최근 테스트 실패. Cursor (.cursorrules) 와 Claude (시스템 프롬프트) 양쪽에 paste. 오후 동안 도구 4번 전환. Re-priming 0회.",
  },
  related: [
    { slug: "docs-as-kb", label: "지식 베이스로서의 문서" },
    { slug: "project-decisions", label: "프로젝트 의사결정" },
    { slug: "meetings-and-interviews", label: "회의 + 인터뷰 로그" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} locale="ko" />; }
