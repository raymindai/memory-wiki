import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "meetings-and-interviews",
  kicker: "회의 + 인터뷰 로그",
  title: "AI가 인용할 수 있는 전사록.",
  sub: "고객 개발을 돌리는 파운더, 사용자 리서치를 종합하는 PM, 1:1에 사는 모든 이를 위해. 한 번 캡처, 영원히 query.",
  pain: [
    "Notion에 고객 인터뷰 30건. AI가 각각 요약했지만 인터뷰 간 패턴은 머릿속에 갇혀 있음.",
    "회의 전사록이 쌓임. \"Q2에 Sarah가 가격에 대해 뭐라 했지?\" → 20분 스크롤.",
    "Action item은 한 곳에, 결정은 다른 곳에, raw 전사록은 또 다른 곳에 — 종합 요청 시 Claude에 deploy되는 건 아무것도 없음.",
    "6개월 후, 왜 피벗했는지 추적 못 함. 팀을 돌린 대화가 묻혀 있음.",
  ],
  action: [
    {
      step: "전사록 캡처",
      detail: "Otter / Fireflies / Granola에서 paste, 또는 그것을 담고 있는 Notion 페이지에서 import. Memory.Wiki가 화자를 정규화하고 영구 URL에 저장.",
    },
    {
      step: "Intent 태깅",
      detail: "각 문서를 note / decision / question으로 표시. Doc intent는 다음 concept refresh 후 자동 분류; 에디터 LIVE 바의 chip으로 override 가능.",
    },
    {
      step: "프로젝트별로 번들",
      detail: "한 프로젝트의 모든 고객 인터뷰를 번들로. Discoveries 실행 — AI가 긴장 (\"고객 A는 X를 더 원함; 고객 B는 X를 덜 원함\") 과 갭을 자동으로 드러냄.",
    },
    {
      step: "인터뷰 간 회수",
      detail: "Hub Assistant를 열고 \"고객들이 가격에 대해 뭐라 했지?\" 물음. 허브 recall이 가격을 언급하는 모든 인터뷰를 hit하고 화자 + 라인을 직접 인용.",
    },
  ],
  result: [
    "\"왜 피벗했지?\" → AI가 결정을 밀어붙인 세 인터뷰를 인용.",
    "Action item이 intent=decision 태그를 받음; 사이드바 필터가 이번 분기 팀의 모든 결정을 보여줌.",
    "번들에서 컴파일된 종합 문서가 source를 기억함 — 새 인터뷰 추가 후 Recompile하면 업데이트된 종합.",
    "새 채용자에게 허브 URL을 보내면 오후 안에 고객 풍경을 따라잡음.",
  ],
  example: {
    title: "예시: 고객 인터뷰 14건 → 하나의 가격 메모",
    body: "번들 Intent: \"새 페르소나에 대한 가격 티어 결정.\" Discoveries 후: 긴장 3개 드러남 (\"파워 유저는 사용량 기반; 팀은 정액; 처음 사용자는 무료\"). Memo로 Compile → 각 고객을 quote로 인용한 1페이지 종합.",
  },
  related: [
    { slug: "project-decisions", label: "프로젝트 의사결정" },
    { slug: "docs-as-kb", label: "지식 베이스로서의 문서" },
    { slug: "cross-tool-handoff", label: "도구 간 핸드오프" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} locale="ko" />; }
