import type { Metadata } from "next";
import Link from "next/link";
import ViewerHeader from "@/components/ViewerHeader";
import ViewerFooter from "@/components/ViewerFooter";

export const metadata: Metadata = {
  title: "MWBench — Memory.Wiki delivers your knowledge to any AI, verified",
  description:
    "Cross-AI eval for Memory.Wiki. A single URL paste into Claude / OpenAI / Gemini → 100% correct answers, including on content the AI has never seen during training. Methodology, results, and reproducible harness.",
  alternates: { canonical: "https://memory.wiki/mwbench" },
  openGraph: {
    title: "MWBench — Memory.Wiki cross-AI eval",
    description:
      "100% correct answers across Claude / OpenAI / Gemini, including on truly unseen content. Verified, productised, public.",
    url: "https://memory.wiki/mwbench",
    images: [{ url: "/api/og?title=MWBench", width: 1200, height: 630 }],
  },
};

export default function MWBenchPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <ViewerHeader title="MWBench" breadcrumb={<>memory.wiki/<span style={{ color: "var(--accent)" }}>mwbench</span></>} />

      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        {/* Hero */}
        <section className="mb-16">
          <h1
            className="text-display font-bold tracking-tight mb-6 leading-[1.05]"
            style={{ color: "var(--text-primary)" }}
          >
            One URL.<br />
            Every AI.<br />
            <span style={{ color: "var(--accent)" }}>100% verified.</span>
          </h1>
          <p
            className="text-body leading-relaxed max-w-2xl"
            style={{ color: "var(--text-secondary)" }}
          >
            Memory.Wiki delivers your knowledge to Claude, ChatGPT, and Gemini through a single URL. MWBench is the open eval that measures whether the wedge actually works — including on content the AI has never seen during training.
          </p>
        </section>

        {/* Headline numbers */}
        <section className="mb-16">
          <h2 className="text-h2 font-bold mb-6" style={{ color: "var(--text-primary)" }}>
            Headline result
          </h2>
          <div
            className="overflow-x-auto rounded-xl"
            style={{ border: "1px solid var(--border-dim)", background: "var(--surface)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Mode</th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
                    raymindai<br /><span className="font-normal text-caption" style={{ color: "var(--text-faint)" }}>familiar hub</span>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold" style={{ color: "var(--text-secondary)" }}>
                    mwbench-zorblax<br /><span className="font-normal text-caption" style={{ color: "var(--text-faint)" }}>synthetic, unseen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    Paste mode — full corpus<br />
                    <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                      AI receives every doc body in the prompt
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    Paste mode — compact
                    <br />
                    <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                      8–9× smaller payload (concept digest + skeleton)
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    Browse mode — AI fetches the URL
                    <br />
                    <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                      The real user scenario
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>98%</td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-dim)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    Adversarial refusal
                    <br />
                    <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                      AI correctly refuses when corpus lacks the answer
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                  <td className="text-right px-4 py-3 tabular-nums" style={{ color: "var(--text-faint)" }}>—</td>
                </tr>
                <tr>
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    Tool-use rate
                    <br />
                    <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                      Did the AI actually fetch the URL when handed one
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                  <td className="text-right px-4 py-3 tabular-nums font-medium" style={{ color: "var(--accent)" }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-caption" style={{ color: "var(--text-faint)" }}>
            Three runners — <code>claude-sonnet-4-6</code>, <code>gpt-5.5</code>, <code>gemini-3.5-flash</code>. Judge: quote-evidence, requires a literal corpus quote per claim.
          </p>
        </section>

        {/* The two axes */}
        <section className="mb-16">
          <h2 className="text-h2 font-bold mb-6" style={{ color: "var(--text-primary)" }}>
            Two independent axes
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div
              className="p-5 rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <div className="text-caption uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
                Axis 1
              </div>
              <h3 className="text-body font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Browse vs Paste
              </h3>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
                <strong>Paste</strong>: the bench tool fetches the URL itself and includes the body in the prompt. The AI reads what is in front of it. Internal sanity check.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <strong>Browse</strong>: the AI gets only the URL plus a <code>fetch_url</code> tool. It decides to fetch, follows links inside the hub, then answers. This is what happens when a user pastes a Memory.Wiki URL into Claude.ai or ChatGPT.
              </p>
            </div>
            <div
              className="p-5 rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <div className="text-caption uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
                Axis 2
              </div>
              <h3 className="text-body font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Familiar vs Unseen
              </h3>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
                <strong>Familiar</strong> (raymindai): a public hub that may have been crawled by AI training data. Some of the accuracy could be memorization.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <strong>Unseen</strong> (mwbench-zorblax): a synthetic hub seeded for this test. Every fact is fictional — ZorblaxCorp, CipherPlate v3.4.1, Talia Renford — none exist anywhere in AI training data. Only the URL fetch can produce correct answers.
              </p>
            </div>
          </div>
          <div
            className="mt-6 p-5 rounded-xl"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)" }}
          >
            <strong style={{ color: "var(--text-primary)" }}>Browse × Unseen</strong>{" "}
            <span style={{ color: "var(--text-secondary)" }}>
              is the only cell that fully isolates the wedge. AI must fetch (Browse), and memorization is impossible (Unseen). 100% across Claude / OpenAI / Gemini means the cross-AI URL delivery model genuinely works — not just on content the AI happened to memorize.
            </span>
          </div>
        </section>

        {/* Why no per-hub measurement */}
        <section className="mb-16">
          <div
            className="p-5 rounded-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            <h3 className="text-body font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              We don&apos;t bench every hub
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              The cross-AI wedge is proven at the <strong>system level</strong>, not per-hub. The unseen-hub result (100% on content the AIs have never seen) means every hub built on Memory.Wiki inherits the same property automatically. Re-running the bench on every customer hub would be repeating a proof we&apos;ve already given.
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--text-secondary)" }}>
              The harness, the data, and the deeper write-ups are below for anyone who wants to audit the claim or run it themselves.
            </p>
          </div>
        </section>

        {/* Methodology summary */}
        <section className="mb-16">
          <h2 className="text-h2 font-bold mb-6" style={{ color: "var(--text-primary)" }}>
            Methodology
          </h2>
          <div className="space-y-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>Three runners.</strong>{" "}
              Each query runs through <code>claude-sonnet-4-6</code> (1M context), <code>gpt-5.5</code>, and <code>gemini-3.5-flash</code>. Same prompt template, same tool spec for browse mode (<code>fetch_url</code>), independent API calls.
            </p>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>Quote-evidence judge.</strong>{" "}
              The judge model (<code>claude-sonnet-4-6</code>) is given the runner&apos;s full corpus and must produce a literal quote from that corpus for every substantive claim in the answer. Score = supported share of claims. No &ldquo;this sounds like hallucination&rdquo; guesswork — every percentage point is auditable.
            </p>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>Cross-doc synthesis is allowed.</strong>{" "}
              A claim is grounded if it appears anywhere in the runner&apos;s corpus, not just in the doc the query targets. Mirrors how real users ask multi-doc questions.
            </p>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>Adversarial subset.</strong>{" "}
              5 queries ask for facts that are NOT in the corpus (someone&apos;s home address, an unannounced acquisition, etc.). Empty answer is treated as implicit refusal. Catches the classic &ldquo;AI made something up rather than admitting it didn&apos;t know&rdquo; failure mode.
            </p>
            <p>
              <strong style={{ color: "var(--text-primary)" }}>Reproducible.</strong>{" "}
              Harness is at{" "}
              <a
                href="https://github.com/raymindai/mdcore/tree/main/eval"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--accent)" }}
              >
                github.com/raymindai/mdcore /eval
              </a>
              . Re-run any round with <code>node eval/run-bench.mjs</code> or <code>node eval/run-browse-bench.mjs</code>.
            </p>
          </div>
        </section>

        {/* Detailed methodology docs */}
        <section className="mb-16">
          <h2 className="text-h2 font-bold mb-6" style={{ color: "var(--text-primary)" }}>
            The full write-ups
          </h2>
          <div className="space-y-3">
            <a
              href="https://mdfy.app/gzuNdh_P"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-xl transition-colors hover:opacity-90"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                MWBench v1 — main write-up
              </div>
              <div className="text-caption" style={{ color: "var(--text-secondary)" }}>
                9 rounds, 8 production deploys, ~600 bench cells. Compact 33% → 100%, paste 100%, browse 90-100%, adversarial 100%, tool-use 100%.
              </div>
            </a>
            <a
              href="https://mdfy.app/D-TSWhl4"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-xl transition-colors hover:opacity-90"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Round 6-7 — browse mode honest measurement
              </div>
              <div className="text-caption" style={{ color: "var(--text-secondary)" }}>
                Real-world scenario: AI receives only a URL and a <code>fetch_url</code> tool. Discovers and fetches and answers, all without the corpus in the prompt.
              </div>
            </a>
            <a
              href="https://mdfy.app/yGk04Hee"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-xl transition-colors hover:opacity-90"
              style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
            >
              <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Bundle &amp; Doc URL enrichment
              </div>
              <div className="text-caption" style={{ color: "var(--text-secondary)" }}>
                How the three URL shapes (hub / bundle / doc) carry knowledge-graph signal at their own scope.
              </div>
            </a>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16">
          <div
            className="p-6 rounded-2xl"
            style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)" }}
          >
            <h3 className="text-h2 font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Try it yourself
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              Sign up at Memory.Wiki, capture five docs from any AI chat, and paste your hub URL into Claude.ai or ChatGPT. The AI will fetch, read, and answer — even on content it has never seen during training.
            </p>
            <Link
              href="/auth/signin"
              className="inline-block px-4 py-2 rounded-md text-sm font-semibold transition-opacity"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Start free →
            </Link>
          </div>
        </section>
      </main>

      <ViewerFooter />
    </div>
  );
}
