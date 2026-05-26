import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "project-decisions",
  kicker: "프로젝트 의사결정",
  title: "왜 X를 골랐는지, 한 곳에.",
  sub: "솔로 파운더와 소규모 팀을 위한 ADR 스타일 결정 기록. 미래의 자신 (또는 어떤 AI든) 이 \"왜 Y가 아니라 X였지?\" 물으면 추측이 아닌 근거를 받음.",
  pain: [
    "6개월 전에 DynamoDB 대신 Postgres를 골랐음. 오늘 바꿔야 하나 고민. 그때 따져본 trade-off를 복원할 수 없음.",
    "Slack 스레드는 부패함. \"그 결정\"은 이미 두 번 archive된 40-message 스레드에 살고 있음.",
    "Claude에게 새 옵션을 weigh해달라 하면, 당신이 이미 거부한 것과 그 이유를 전혀 모름.",
    "팀원 온보딩은 모든 과거 결정을 기억에서 다시 설명하는 것.",
  ],
  action: [
    {
      step: "결정을 짧은 문서로 작성",
      detail: "Context (알았던 것), Options (고려한 것), Decision (고른 것), Consequences (예상하는 것). 200-400단어. Memory.Wiki가 다음 concept refresh 후 intent를 \"decision\"으로 자동 태그.",
    },
    {
      step: "Input 인용",
      detail: "고객 인터뷰, 스파이크 브랜치, 비용 모델 스프레드시트, 생각하는 데 도움 준 AI 대화를 링크. 각 링크는 Memory.Wiki URL이 영구적이라 살아남음.",
    },
    {
      step: "영역별로 번들",
      detail: "모든 인프라 결정, 모든 가격 결정, 모든 채용 결정을 번들로. 허브 로그가 각 결정이 언제 만들어졌고 누가 편집했는지 보여줌.",
    },
    {
      step: "재방문 시 회수",
      detail: "\"왜 Postgres를 골랐지?\" → Hub Assistant가 당신 문서 + 그 input을 인용. AI가 일반론이 아니라 당신의 실제 추론으로 논함.",
    },
  ],
  result: [
    "모든 결정에 영구 URL. 재방문 필요 시 어떤 AI에든 paste.",
    "Concept index가 결정들을 같은 source material로 엮음 — 자기 사고의 패턴이 보임.",
    "팀원이 결정 로그를 읽음으로써 스스로 온보딩 — 당신에게 묻지 않음.",
    "결정을 뒤집어도 옛 문서는 남음 — 버전 히스토리가 뭐가 왜 바뀌었는지 보여줌.",
  ],
  example: {
    title: "예시: ADR-007 — \"DynamoDB 대신 Postgres\"",
    body: "Context: 고객 인터뷰 3건이 복잡한 join을 지적. Options: PG / Dynamo / Mongo, 비용 모델 스프레드시트 링크. Decision: PG. Consequences: \"1억 row에서 고통 시작; 그때 재방문.\" 6개월 후, 허브 recall이 1초 만에 찾음.",
  },
  related: [
    { slug: "meetings-and-interviews", label: "회의 + 인터뷰 로그" },
    { slug: "docs-as-kb", label: "지식 베이스로서의 문서" },
    { slug: "research-notes", label: "연구 노트" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} locale="ko" />; }
