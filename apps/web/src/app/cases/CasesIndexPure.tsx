"use client";

import Link from "next/link";
import "../manifesto/manifesto.css";
import "./cases-index.css";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";

const CASES_EN = [
  { slug: "agent-memory",           kicker: "Agent persistent memory", title: "Long-running agents that remember what they did yesterday.",        sub: "For people building or operating autonomous AI agents. Every run starts fresh by default — Memory.Wiki turns the hub URL into the agent's cross-run memory." },
  { slug: "cross-tool-handoff",     kicker: "Cross-tool handoff",      title: "Cursor ↔ Claude on shared context.",                                  sub: "For builders who switch AI tools mid-flow. The hub URL is portable context — paste it into either tool and the AI picks up where you left off." },
  { slug: "project-decisions",      kicker: "Project decisions",       title: "Why you chose X, in one place.",                                      sub: "ADR-style decision records for solo founders and small teams. Future-you (or any AI) can ask \"why X over Y?\" and get the rationale, not a guess." },
  { slug: "docs-as-kb",             kicker: "Docs as a KB",            title: "Your team's docs, AI-readable.",                                      sub: "For small engineering / product teams. Turn scattered docs into a hub URL Claude, Cursor, and ChatGPT can fetch the same way — no custom RAG pipeline." },
  { slug: "research-notes",         kicker: "Research notes",          title: "Papers + PDFs into one cited URL.",                                   sub: "For people who read more than they remember — researchers, founders, doctoral students. Memory.Wiki turns a pile of PDFs into a hub any AI can quote back." },
  { slug: "meetings-and-interviews",kicker: "Meeting + interview log", title: "Transcripts your AI can quote back.",                                 sub: "For founders running customer development, PMs synthesizing user research, anyone who lives in 1:1s. Capture once, query forever." },
  { slug: "book-course-notes",      kicker: "Book + course notes",     title: "Chapter takeaways that compound.",                                    sub: "For readers and lifelong learners. Per-chapter notes become a hub the concept index quietly weaves into a personal curriculum." },
];

const CASES_KO = [
  { slug: "agent-memory",           kicker: "에이전트 영구 메모리",  title: "어제 한 일을 기억하는 장기 에이전트.",                            sub: "자율 AI 에이전트를 만들거나 운영하는 사람을 위해. 기본은 매 런이 처음부터 — Memory.Wiki는 허브 URL을 에이전트의 런 간 메모리로 만듭니다." },
  { slug: "cross-tool-handoff",     kicker: "도구 간 핸드오프",       title: "Cursor ↔ Claude, 공유 컨텍스트로.",                                sub: "흐름 도중에 AI 도구를 갈아타는 빌더를 위해. 허브 URL은 휴대 가능한 컨텍스트 — 어느 도구에 paste해도 AI가 중단된 지점에서 이어받음." },
  { slug: "project-decisions",      kicker: "프로젝트 의사결정",      title: "왜 X를 골랐는지, 한 곳에.",                                        sub: "솔로 파운더와 소규모 팀을 위한 ADR 스타일 결정 기록. 미래의 자신 (또는 어떤 AI든) 이 \"왜 Y가 아니라 X였지?\" 물으면 추측이 아닌 근거를 받음." },
  { slug: "docs-as-kb",             kicker: "지식 베이스로서의 문서", title: "팀의 문서를 AI 읽기 가능하게.",                                    sub: "소규모 엔지니어링/프로덕트 팀을 위해. 흩어진 문서를 Claude, Cursor, ChatGPT가 같은 방식으로 fetch할 수 있는 허브 URL로 — 커스텀 RAG 파이프라인 불필요." },
  { slug: "research-notes",         kicker: "연구 노트",              title: "논문 + PDF를 하나의 인용 가능한 URL로.",                          sub: "기억하는 것보다 더 많이 읽는 사람을 위해 — 연구자, 파운더, 박사과정. Memory.Wiki는 PDF 더미를 어떤 AI든 인용할 수 있는 허브로 만듭니다." },
  { slug: "meetings-and-interviews",kicker: "회의 + 인터뷰 로그",     title: "AI가 인용할 수 있는 전사록.",                                      sub: "고객 개발을 돌리는 파운더, 사용자 리서치를 종합하는 PM, 1:1에 사는 모든 이를 위해. 한 번 캡처, 영원히 query." },
  { slug: "book-course-notes",      kicker: "책 + 강의 노트",         title: "쌓이는 챕터 takeaway.",                                            sub: "독자와 평생 학습자를 위해. 챕터별 노트가 허브가 되고, concept index가 조용히 개인 커리큘럼으로 엮어줍니다." },
];

export default function CasesIndexPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const isKo = locale === "ko";
  const cases = isKo ? CASES_KO : CASES_EN;

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/cases" : "/cases"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={cases.map((c) => ({ id: `case-${c.slug}`, label: c.kicker }))}
      tocHeading={isKo ? "케이스" : "Cases"}
    >
      <div className="pure-manifesto-page">
        <div className="pure-manifesto-readtime mono">
          {isKo ? "URL이 띠는 일곱 가지 모양" : "Seven shapes the URL takes"}
        </div>
        <h1 className="pure-manifesto-title">{isKo ? "사용 사례." : "Use cases."}</h1>
        <p className="pure-manifesto-intro">
          {isKo
            ? "같은 primitive — 어떤 AI든 context로 fetch할 수 있는 허브 URL — 가 당신이 실제로 보내는 한 주에 맞춰 휘어집니다. 자신과 가장 가까운 걸 고르세요."
            : "The same primitive — a hub URL that any AI can fetch as context — bends to whatever week you’re actually living. Pick the one closest to yours."}
        </p>

        <div className="pure-cases-grid">
          {cases.map((c, i) => (
            <Link
              key={c.slug}
              id={`case-${c.slug}`}
              href={isKo ? `/ko/case-${c.slug}` : `/case-${c.slug}`}
              className="pure-cases-card"
            >
              <div className="pure-cases-num mono">{String(i + 1).padStart(2, "0")}</div>
              <div className="pure-cases-kicker mono">{c.kicker}</div>
              <h2 className="pure-cases-title">{c.title}</h2>
              <p className="pure-cases-sub">{c.sub}</p>
              <div className="pure-cases-link mono">
                {isKo ? "케이스 읽기" : "Read case"} <span aria-hidden>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PureDocsShell>
  );
}
