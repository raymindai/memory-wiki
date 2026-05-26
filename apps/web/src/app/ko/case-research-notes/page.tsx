import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "research-notes",
  kicker: "연구 노트",
  title: "논문 + PDF를 하나의 인용 가능한 URL로.",
  sub: "기억하는 것보다 더 많이 읽는 사람을 위해 — 연구자, 파운더, 박사과정. Memory.Wiki는 PDF 더미를 어떤 AI든 인용할 수 있는 허브로 만듭니다.",
  pain: [
    "분기에 논문 30편을 읽음. 두 달째 되면 어느 논문에 필요한 주장이 있었는지 기억 못 함.",
    "AI 어시스턴트는 논문 하나씩 요약은 잘 함. 전체 스택을 가로질러 종합은 못 함.",
    "탭 닫는 순간 인용이 stale — 제목만으로는 미래의 자신에게 도움 안 됨.",
    "Notion / Obsidian은 동작하지만, 도구를 바꿀 때 Claude나 Cursor에 deploy되지 않음.",
  ],
  action: [
    {
      step: "각 PDF 드롭",
      detail: "Memory.Wiki가 텍스트를 추출하고, 선택적 AI \"정리\" 패스를 돌리고, 영구 URL에 저장. Source 페이지는 그대로 — section anchor로 re-quote 가능.",
    },
    {
      step: "Concept index가 빌드되게",
      detail: "백그라운드 Haiku 추출이 각 논문이 제기하는 개념을 기록. 논문 간 (≥2개) 개념은 오렌지 dot. 허브의 Related-in-your-hub 위젯이 못 본 겹침을 드러냄.",
    },
    {
      step: "질문별로 번들",
      detail: "한 열린 질문에 연관된 5-8개 논문을 번들로. 번들 Intent 설정 (\"Y가 일정할 때 왜 X가 발생하나?\"). 번들의 discoveries 패널이 논문 간 긴장을 드러냄.",
    },
    {
      step: "허브 URL 배포",
      detail: "memory.wiki/hub/<you>를 Claude, ChatGPT, Cursor에 paste. 인덱스 + 개념별 passage를 fetch하고 학습-데이터 환각이 아니라 실제 인용에서 답함.",
    },
  ],
  result: [
    "\"Smith 2023이 X에 대해 뭐라 했지?\" → AI가 인용과 함께 passage 인용.",
    "논문 간 긴장이 자동으로 드러남 — Compile a Brief하면 종합이 어느 논문이 어느 논문과 의견 다른지 명시.",
    "Cursor에서 Claude로 전환할 때 컨텍스트는 URL. Re-priming 0회.",
    "6개월 후, 미래의 자신이 허브 로그를 읽고 각 스레드를 왜 조사했는지 기억함.",
  ],
  example: {
    title: "예시: RAG retrieval 논문 12편 허브",
    body: "번들 이름 \"왜 hybrid retrieval이 vector-only를 이기는가.\" Concept index가 12개 중 7개에서 query-rewriting + reranker + sparse-dense fusion을 엮음. 허브 recall이 rerank 지연 trade-off에 대한 정확한 passage를 반환.",
  },
  related: [
    { slug: "book-course-notes", label: "책 + 강의 노트" },
    { slug: "project-decisions", label: "프로젝트 의사결정" },
    { slug: "docs-as-kb", label: "지식 베이스로서의 문서" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} locale="ko" />; }
