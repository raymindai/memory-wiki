import CasePure, { type CaseData } from "@/components/CasePure";
import { caseMetadata } from "@/components/case-meta";

const data: CaseData = {
  slug: "book-course-notes",
  kicker: "책 + 강의 노트",
  title: "쌓이는 챕터 takeaway.",
  sub: "독자와 평생 학습자를 위해. 챕터별 노트가 허브가 되고, concept index가 조용히 개인 커리큘럼으로 엮어줍니다.",
  pain: [
    "책을 끝내고 takeaway 5개 쓰고 파일을 닫음. 6개월 후 inversion에 대한 그 말을 한 게 Munger였는지 Buffett이었는지 기억 못 함.",
    "온라인 강의가 노트를 Notion / Apple Notes / 반쯤 완성된 Obsidian 볼트에 흩뜨림. 그 중 아무것도 AI에 deploy되지 않음.",
    "각 챕터가 쓸 때는 고립된 느낌. 다른 책/강의와의 연결이 이미 기억하려 시도하는 시점이 되어서야 드러남.",
    "재독은 비쌈. 쌓이는 노트 없이는 매 재방문이 1페이지부터.",
  ],
  action: [
    {
      step: "챕터당 (또는 강의당) 문서 하나",
      detail: "Raw takeaway를 드롭. Memory.Wiki는 bullet 형태든 prose든 신경 안 씀. 제목이 챕터 — H1이고 주소.",
    },
    {
      step: "재발생 개념이 스스로 드러나게",
      detail: "Concept index가 자동 실행. 3-5 챕터 후, 챕터 간 개념 (inversion, second-order thinking 등) 이 사이드바 Concepts 리스트에서 오렌지 dot.",
    },
    {
      step: "책이 아니라 테마로 번들",
      detail: "\"리스크에 대한 mental model\"이 한 책에서 3개 챕터 + 다른 책에서 2개 + 강의 모듈을 끌어옴. 번들이 누군가 모아주길 바랐던 커리큘럼.",
    },
    {
      step: "허브에 무엇을 배웠는지 물음",
      detail: "\"inversion에 대해 뭘 읽었지?\" 허브 recall이 개념을 다룬 모든 챕터를 정확한 passage와 함께 반환. 자기 기억보다 나음.",
    },
  ],
  result: [
    "더 읽을수록 concept cluster가 떠오름 — 수동 cross-link 없이 위키가 쌓임.",
    "테마 번들에서 Brief를 컴파일하면 직접 써야 했을 종합을 얻음.",
    "연말 \"올해 뭘 배웠지?\"가 스스로 답함.",
    "새로 뭔가를 쓸 때 허브 URL을 Claude에 paste — 자신의 노트로 과거 자신과 논쟁함.",
  ],
  example: {
    title: "예시: 책 6권에서 40 챕터 → mental-models 허브",
    body: "Concept index가 \"inversion\"을 Charlie Munger / Annie Duke / Shane Parrish에 걸쳐 엮음. 번들 \"불확실성 하 결정\"이 8 챕터를 끌어옴. Brief로 Compile → 직접 쓰지 않아도 되는 600단어 종합.",
  },
  related: [
    { slug: "research-notes", label: "연구 노트" },
    { slug: "project-decisions", label: "프로젝트 의사결정" },
    { slug: "cross-tool-handoff", label: "도구 간 핸드오프" },
  ],
};

export const metadata = caseMetadata(data.slug, data.title, data.sub);
export default function Page() { return <CasePure data={data} locale="ko" />; }
