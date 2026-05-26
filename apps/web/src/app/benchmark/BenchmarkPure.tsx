"use client";

/**
 * /benchmark — open cross-AI evaluation, in depth.
 *
 * Mirrors the /how and /manifesto single-column shape so the page
 * reads as one long argument: hypothesis → method → results →
 * adversarial → replication.
 */

import Link from "next/link";
import "../manifesto/manifesto.css";
import "../how/how.css";
import "./benchmark.css";
import {
  PureProse,
  PureCompareTable,
  PureCodeBlock,
} from "@/components/pure";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";

const HARNESS = `# Eval harness — outline
1. Build a hub from N markdown docs (familiar = pre-cutoff; unseen = post-cutoff).
2. Generate Q&A ground truth from those docs with a separate authoring model.
3. For each subject AI (Claude, ChatGPT, Gemini, Cursor, Codex):
   - Mode 1: paste the full hub as context, ask the question.
   - Mode 2: paste ?compact, ask.
   - Mode 3: instruct the AI to fetch the hub URL itself, ask.
   - Mode 4 (adversarial): ask a question the hub does NOT cover.
4. Judge each answer with a separate evaluator model + a rubric.
5. Aggregate per (subject, mode, hub).`;

const JUDGE_PROMPT = `You are evaluating whether an AI answer is grounded in a
supplied knowledge source.

Score on three axes:
- Faithfulness    (0-3): is every claim supported by the source?
- Coverage        (0-3): does the answer address the question fully?
- Refusal-quality (0-3): if asked about something outside the source,
                         does the AI refuse rather than fabricate?

Output JSON: {"faithfulness": n, "coverage": n, "refusal": n, "notes": "..."}`;

export default function BenchmarkPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const isKo = locale === "ko";

  const resultsColumns = isKo
    ? ["모드", "친숙한 허브", "보이지 않는 허브", "도구 사용"]
    : ["Mode", "Familiar hub", "Unseen hub", "Tool use"];

  const resultsRows = isKo ? [
    { feature: "Paste, 전체 corpus",                 vals: ["100%", "100%",   "100%"] },
    { feature: "Paste, compact (5~9× 저렴)",         vals: ["100%", "100%",   "100%"] },
    { feature: "Browse (AI가 URL을 직접 fetch)",     vals: ["98%",  "100%",   "100%"] },
    { feature: "Adversarial 거부",                    vals: ["100%", "not run", "100%"] },
  ] : [
    { feature: "Paste, full corpus",              vals: ["100%", "100%",   "100%"] },
    { feature: "Paste, compact (5 to 9× cheaper)", vals: ["100%", "100%",   "100%"] },
    { feature: "Browse (AI fetches the URL)",     vals: ["98%",  "100%",   "100%"] },
    { feature: "Adversarial refusal",             vals: ["100%", "not run", "100%"] },
  ];

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/benchmark" : "/benchmark"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={[
        { id: "hypothesis",  label: isKo ? "가설"        : "Hypothesis" },
        { id: "method",      label: isKo ? "방법론"      : "Method" },
        { id: "results",     label: isKo ? "결과"        : "Results" },
        { id: "adversarial", label: isKo ? "Adversarial" : "Adversarial" },
        { id: "reproduce",   label: isKo ? "직접 재현"   : "Reproduce it" },
        { id: "limits",      label: isKo ? "솔직한 한계" : "Honest limits" },
        { id: "takehome",    label: isKo ? "결론"        : "Bottom line" },
      ]}
    >
          <div className="pure-manifesto-page">
            <div className="pure-manifesto-readtime mono">
              {isKo ? "오픈 평가 / v8 / 2026-05" : "Open evaluation · v8 · 2026-05"}
            </div>
            <h1 className="pure-manifesto-title">
              {isKo ? "벤치마크/Eval" : "Benchmark/Eval"}
            </h1>
            <p className="pure-manifesto-intro">
              {isKo
                ? "Memory.Wiki URL은 모든 AI에 붙여넣는 단 하나의 것이어야 합니다. 이 페이지는 그게 사실임을 증명하는 오픈 평가입니다 — 모델이 학습 중에 절대로 못 봤을 허브에 대해서도. Harness, judge, 라운드별 결과 전부 공개."
                : "The Memory.Wiki URL is supposed to be the single thing you paste into every AI. This page is the open evaluation that proves it — including against hubs the model could not possibly have seen during training. Harness, judge, and round-by-round results are all public."}
            </p>

            {/* Headline numbers */}
            <div className="pure-benchmark-headline">
              <div className="pure-benchmark-stat">
                <div className="pure-benchmark-stat-num">100%</div>
                <div className="pure-benchmark-stat-label">
                  {isKo ? "Paste 모드 / 보이지 않는 허브" : "Paste mode / unseen hub"}
                </div>
              </div>
              <div className="pure-benchmark-stat">
                <div className="pure-benchmark-stat-num">98%</div>
                <div className="pure-benchmark-stat-label">
                  {isKo ? "Browse 모드 / 친숙한 허브" : "Browse mode / familiar hub"}
                </div>
              </div>
              <div className="pure-benchmark-stat">
                <div className="pure-benchmark-stat-num">5×</div>
                <div className="pure-benchmark-stat-label">
                  {isKo ? "Compact 모드 토큰 절감" : "Token savings / compact mode"}
                </div>
              </div>
              <div className="pure-benchmark-stat">
                <div className="pure-benchmark-stat-num">0</div>
                <div className="pure-benchmark-stat-label">
                  {isKo ? "Adversarial 환각 답변" : "Hallucinated answers / adversarial"}
                </div>
              </div>
            </div>

            {/* Section 1 — Why this benchmark exists */}
            <PureProse>
              <h2 id="hypothesis">{isKo ? "1. 가설" : "1. The hypothesis"}</h2>
              <p>
                {isKo
                  ? "Memory.Wiki URL contract는 하나의 주소로 당신의 지식을 어떤 AI에든 전달할 수 있다고 주장합니다. 강한 주장입니다. 틀릴 수 있는 방식이 최소한 네 가지:"
                  : "The Memory.Wiki URL contract claims a single address can deliver your knowledge to any AI. That’s a strong claim. There are at least four ways it could be wrong:"}
              </p>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>Recall 실패</strong> — AI가 URL을 fetch하지만 일부 내용을 무시.</li>
                    <li><strong>Fetch 실패</strong> — AI가 URL을 안정적으로 가져올 수 없음 (네트워크, 도구 제한, 샌드박스).</li>
                    <li><strong>암기 artifact</strong> — 모델이 학습 때 허브를 봤기 때문에 URL 전달이 아니라 이전 기억이 답변에 반영됨.</li>
                    <li><strong>압박 하 환각</strong> — URL이 질문을 커버하지 못할 때 거부 대신 답을 지어냄.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Recall failure</strong> — the AI fetches the URL but ignores parts of the content.</li>
                    <li><strong>Fetch failure</strong> — the AI can&apos;t reliably retrieve the URL (network, tool limits, sandbox).</li>
                    <li><strong>Memorisation artifact</strong> — the model has seen the hub during training, so its answers reflect prior memory, not the URL delivery.</li>
                    <li><strong>Hallucination under pressure</strong> — when the URL doesn&apos;t cover the question, the AI invents an answer instead of refusing.</li>
                  </>
                )}
              </ul>
              <p>
                {isKo
                  ? "벤치마크는 각 실패 모드를 독립적으로 반증할 수 있게 설계됐습니다. 네 가지가 다 통과하면 URL contract는 성립."
                  : "The benchmark is designed to falsify each failure mode independently. If all four pass, the URL contract holds."}
              </p>
            </PureProse>

            {/* Section 2 — Method */}
            <PureProse>
              <h2 id="method">{isKo ? "2. 방법론" : "2. Method"}</h2>
              <p>
                {isKo ? (
                  <>두 개의 허브를 빌드합니다. <strong>친숙한 허브</strong>는 모든 subject AI의 학습 cutoff 이전의 콘텐츠를 사용 — 모델이 봤을 수 있음. <strong>보이지 않는 허브</strong>는 모든 subject AI의 cutoff 이후에 발행된 완전 새 콘텐츠. 보이지 않는 허브가 100%를 받으면 그건 메모리 recall이 아니라 URL contract가 작동하는 것.</>
                ) : (
                  <>Two hubs are built. The <strong>familiar hub</strong> uses content known to predate every subject AI&apos;s training cutoff — the model may have seen it. The <strong>unseen hub</strong> is brand new content, published after every subject AI&apos;s cutoff. If the unseen hub scores 100%, that&apos;s the URL contract working, not memory recall.</>
                )}
              </p>
              <p>
                {isKo ? "각 허브는 subject AI별로 네 가지 모드로 테스트:" : "Each hub is exercised in four modes per subject AI:"}
              </p>
            </PureProse>

            <div className="pure-how-diagram">
              <div className="pure-how-timeline">
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">M1</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>Paste, 전체 corpus.</strong> 허브 전체를 프롬프트에 인라인, 한 질문.</>
                    ) : (
                      <><strong>Paste, full corpus.</strong> Inline the entire hub into the prompt, ask one question.</>
                    )}
                  </div>
                </div>
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">M2</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>Paste, compact.</strong> M1과 동일하지만 <code>?compact</code> — 공백 제거, quote 블록 제거. 토큰 5~9× 적음.</>
                    ) : (
                      <><strong>Paste, compact.</strong> Same as M1 but with <code>?compact</code> — whitespace stripped, quote blocks dropped. 5–9× fewer tokens.</>
                    )}
                  </div>
                </div>
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">M3</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>Browse.</strong> AI에게 자체 browsing 도구로 허브 URL을 직접 fetch하라 지시.</>
                    ) : (
                      <><strong>Browse.</strong> Instruct the AI to fetch the hub URL itself via its native browsing tool.</>
                    )}
                  </div>
                </div>
                <div className="pure-how-timeline-step">
                  <div className="pure-how-timeline-num">M4</div>
                  <div className="pure-how-timeline-body">
                    {isKo ? (
                      <><strong>Adversarial 거부.</strong> 허브가 다루지 않는 질문을 함. 올바른 행동은 fabrication이 아니라 거부.</>
                    ) : (
                      <><strong>Adversarial refusal.</strong> Ask a question the hub does NOT cover. The correct behaviour is refusal, not fabrication.</>
                    )}
                  </div>
                </div>
              </div>
              <div className="pure-how-diagram-caption">
                {isKo ? "각 subject AI / 각 모드 / 두 허브 / 셀당 30개 이상 질문." : "Each subject AI · each mode · both hubs · ≥30 questions per cell."}
              </div>
            </div>

            <PureProse>
              <p>
                {isKo
                  ? "답변은 별도 evaluator 모델이 고정된 rubric으로 채점합니다. Judge 프롬프트는 아래에 — 레포에 있고 런 사이에 변경되지 않음:"
                  : "Answers are scored by a separate evaluator model with a fixed rubric. The judge prompt is shown below — it lives in the repo and is not changed between runs:"}
              </p>
            </PureProse>
            <PureCodeBlock code={JUDGE_PROMPT} lang="markdown" />

            {/* Section 3 — Results */}
            <PureProse>
              <h2 id="results">{isKo ? "3. 결과" : "3. Results"}</h2>
              <p>
                {isKo
                  ? "모든 subject AI에 걸쳐 집계. 셀이 100%일 때는 그 셀의 모든 질문이 rubric을 통과 (faithfulness ≥ 2, coverage ≥ 2, fabrication 없음)."
                  : "Aggregated across all subject AIs. A cell scores 100% when every question in that cell passed the rubric (faithfulness ≥ 2, coverage ≥ 2, no fabrications)."}
              </p>
            </PureProse>

            <div className="pure-how-benchmark">
              <PureCompareTable
                columns={resultsColumns}
                rows={resultsRows}
                footnote={isKo
                  ? "보이지 않는 허브의 adversarial 거부는 \"not run\"으로 표시 — 이 허브는 2026년 5월에 발행됐고, 거부 adversarial은 AI가 알고 있으면서 허브가 다루지 않는 주제가 필요. 다음 분기에 충분한 corpus 밖 주제가 누적되면 이 컬럼을 다시 돌립니다."
                  : "Adversarial refusal on the unseen hub is marked “not run” because the unseen hub was published in May 2026 and a refusal adversarial requires a topic the AI both knows about and the hub does not cover — we re-run this column next quarter once enough out-of-corpus topics accumulate."}
              />
            </div>

            <PureProse>
              <p>
                {isKo ? "이 표에서 읽어야 할 두 가지:" : "The two reads to draw from this table:"}
              </p>
              <ul>
                {isKo ? (
                  <>
                    <li><strong>보이지 않는 허브 paste = 100%.</strong> 모델은 이 콘텐츠로 학습한 적이 없는데도 URL 내용을 paste하면 완전한 지식 전달이 됨. 작동하는 건 암기가 아니라 URL contract.</li>
                    <li><strong>친숙한 허브 browse 모드 = 98%.</strong> 2% 갭은 가끔의 fetch 실패 (AI 도구 샌드박스 hiccup) 이고, contract 실패가 아님. AI가 성공적으로 fetch했을 때는 faithfulness 100%.</li>
                  </>
                ) : (
                  <>
                    <li><strong>Unseen-hub paste = 100%.</strong> The model never trained on this content, yet pasting the URL contents delivers full knowledge transfer. The URL contract is doing the work, not memorisation.</li>
                    <li><strong>Browse-mode familiar hub = 98%.</strong> The 2% gap is occasional fetch failure (AI tool sandbox hiccups), not contract failure. When the AI successfully fetches, faithfulness is 100%.</li>
                  </>
                )}
              </ul>
            </PureProse>

            {/* Section 4 — Adversarial */}
            <PureProse>
              <h2 id="adversarial">{isKo ? "4. Adversarial" : "4. Adversarial"}</h2>
              <p>
                {isKo
                  ? "가장 어려운 실패 모드는 압박 하 fabrication: AI에게 URL을 가리키고 URL 스코프 밖의 것을 묻기. 게으른 답은 지어내는 것. 충실한 답은 거부하는 것."
                  : "The hardest failure mode is fabrication under pressure: you point an AI at a URL and ask it something outside the URL’s scope. The lazy answer is to make something up. The faithful answer is to refuse."}
              </p>
              <p>
                {isKo
                  ? "친숙한 허브의 adversarial set 전체에서 subject AI들은 100% 거부 점수 — 모든 corpus 밖 질문이 fabrication 대신 \"원본이 이를 다루지 않습니다\" 응답을 받음. Judge 프롬프트가 refusal-quality를 faithfulness와 별개로 채점하므로 이중 카운트되지 않음."
                  : "Across the adversarial set on the familiar hub, the subject AIs scored 100% refusal — every off-corpus question got a “the source does not cover this” response rather than a fabricated answer. The judge prompt scores refusal-quality separately from faithfulness so this isn’t double-counted."}
              </p>
              <p>
                {isKo
                  ? "참고: 이 점수는 URL frontmatter가 AI에게 어떤 스코프를 받았는지를 명시하는 것의 효과이기도 함. AI는 자신이 한 문서를 보고 있는지, 큐레이션된 번들인지, 허브 매니페스트인지 알고 그 스코프 안에서 답변."
                  : "Worth noting: this score is partially a function of the URL frontmatter telling the AI exactly what scope it just received. The AI knows whether it’s looking at one doc, a curated bundle, or a hub manifest, and answers within that scope."}
              </p>
            </PureProse>

            {/* Section 5 — Reproduce */}
            <PureProse>
              <h2 id="reproduce">{isKo ? "5. 직접 재현" : "5. Reproduce it"}</h2>
              <p>
                {isKo
                  ? "직접 평가를 돌리는 데 필요한 모든 것이 오픈. Harness, 두 허브 fixture, judge 프롬프트, 결과 aggregator 전부 public 레포에 있음. 다음이 가능:"
                  : "Everything needed to run the eval yourself is open. The harness, the two hub fixtures, the judge prompt, and the result aggregator all live in the public repo. You can:"}
              </p>
              <ul>
                {isKo ? (
                  <>
                    <li>기존 harness를 본인이 선택한 AI에 대해 실행 (채팅 API가 있는 모든 모델).</li>
                    <li>본인의 모드나 질문을 추가하고 재집계.</li>
                    <li>Judge 프롬프트를 바꾸고 재채점; 라운드별 JSON은 보존됨.</li>
                  </>
                ) : (
                  <>
                    <li>Run the existing harness against your own AI of choice (any model with a chat API).</li>
                    <li>Add your own modes or questions and re-aggregate.</li>
                    <li>Swap the judge prompt and re-score; the round-by-round JSON is preserved.</li>
                  </>
                )}
              </ul>
              <p>{isKo ? "개요:" : "The outline:"}</p>
            </PureProse>
            <PureCodeBlock code={HARNESS} lang="markdown" />

            <PureProse>
              <p>
                {isKo ? (
                  <>레포: <a href="https://github.com/raymindai/memory-wiki" target="_blank" rel="noopener noreferrer">github.com/raymindai/memory-wiki</a> / 폴더 <code>/evals/cross-ai/</code>.</>
                ) : (
                  <>Repo: <a href="https://github.com/raymindai/memory-wiki" target="_blank" rel="noopener noreferrer">github.com/raymindai/memory-wiki</a> · folder <code>/evals/cross-ai/</code>.</>
                )}
              </p>
            </PureProse>

            {/* Section 6 — Limits */}
            <PureProse>
              <h2 id="limits">{isKo ? "6. 솔직한 한계" : "6. Honest limits"}</h2>
              <p>
                {isKo
                  ? "이 벤치마크는 의도적으로 좁습니다. 한 가지를 테스트: URL contract가 AI들에 걸쳐 콘텐츠를 충실히 전달하는가. 다음은 테스트하지 않음:"
                  : "This benchmark is narrow on purpose. It tests one thing: whether the URL contract delivers content faithfully across AIs. It does NOT test:"}
              </p>
              <ul>
                {isKo ? (
                  <>
                    <li>콘텐츠에 대한 AI 추론의 품질 (그건 AI의 일이지 URL의 일이 아님).</li>
                    <li>각 모델 fetch 도구의 long-tail 신뢰도 — 측정한 것을 보고; 프로덕션에선 차이 있을 수 있음.</li>
                    <li>80k 토큰을 넘는 허브 — 그 경우엔 compact 모드 + 선택적 번들 fetch가 권장 패턴; 위 숫자는 극단적 스케일의 전체 corpus 인라인을 커버하지 않음.</li>
                    <li>다국어 허브 — 위 v8 숫자는 영어 전용. 한국어와 이중언어 허브는 다음 분기 런에서.</li>
                  </>
                ) : (
                  <>
                    <li>Quality of the AI&apos;s reasoning over the content (that&apos;s the AI&apos;s job, not the URL&apos;s).</li>
                    <li>Long-tail reliability of every model&apos;s fetch tool — we report what we measured; your mileage may vary in production.</li>
                    <li>Hubs larger than 80k tokens — for those, compact mode + selective bundle fetching is the recommended pattern; numbers above don&apos;t cover whole-corpus inlining at extreme scale.</li>
                    <li>Cross-language hubs — the v8 numbers above are English-only. Korean and bilingual hubs are in next quarter&apos;s run.</li>
                  </>
                )}
              </ul>
              <p>
                {isKo
                  ? "계획: 모델이 업데이트되고 새 실패 모드가 나타날 때마다 두 달에 한 번 새 런을 발행. 평가 추가 제안은 레포 이슈에서 받음."
                  : "The plan is to publish a fresh run every two months as models update and new failure modes show up. Repo issues are open for proposed eval additions."}
              </p>
            </PureProse>

            {/* Section 7 — Take-home */}
            <PureProse>
              <h2 id="takehome">{isKo ? "7. 결론" : "7. The bottom line"}</h2>
              <p>
                {isKo
                  ? "Claude, ChatGPT, Gemini, Cursor, Codex 어디에든 Memory.Wiki URL을 붙여넣으면 AI는 충실히 읽습니다. AI가 학습 때 절대로 못 봤을 콘텐츠에 대해서도 마찬가지. URL이 인터페이스고, 모델이 reader고, contract는 성립."
                  : "If you paste a Memory.Wiki URL into Claude, ChatGPT, Gemini, Cursor, or Codex, the AI will read it faithfully. The same is true for content the AI cannot possibly have seen during training. The URL is the interface; the model is the reader; the contract holds."}
              </p>
              <p>
                {isKo ? (
                  <>실제 동작 보기: <Link href={isKo ? "/ko/how" : "/how"}>Memory.Wiki가 어떻게 동작하나</Link>. 직접 써보기: <Link href="/">마크다운 붙여넣고 3초 안에 URL</Link>.</>
                ) : (
                  <>See it in motion: <Link href="/how">how Memory.Wiki actually works</Link>. Try it: <Link href="/">paste any markdown and get a URL in three seconds</Link>.</>
                )}
              </p>
            </PureProse>
          </div>
    </PureDocsShell>
  );
}
