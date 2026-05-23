// Shared types for the MWBench eval. Node ESM, no compile step.

/**
 * @typedef {Object} Query
 * @property {string} id
 * @property {string} q                  user question
 * @property {string} expected_doc       hub doc id whose body contains the answer
 * @property {string[]} expected_keywords  short phrases that should appear in any correct answer
 * @property {"single-doc"|"cross-doc"|"backlink"|"synthesis"} category
 */

/**
 * @typedef {Object} RunResult
 * @property {string} runner             "claude" | "openai" | "gemini"
 * @property {string} query_id
 * @property {string} answer
 * @property {number} tokens_in
 * @property {number} tokens_out
 * @property {number} latency_ms
 * @property {string|null} error
 */

/**
 * @typedef {Object} JudgeResult
 * @property {string} query_id
 * @property {string} runner
 * @property {boolean} accurate          LLM judge said yes
 * @property {number} keyword_hits       how many expected_keywords found in answer
 * @property {number} keyword_total
 * @property {string} reason             judge's brief reason
 */

/**
 * @typedef {Object} BenchResult
 * @property {string} corpus_url
 * @property {string} corpus_hash        sha256 of inlined context (so re-runs on same corpus are comparable)
 * @property {string} started_at
 * @property {string} finished_at
 * @property {Query[]} queries
 * @property {RunResult[]} runs
 * @property {JudgeResult[]} judgments
 */

export const RUNNER_NAMES = /** @type {const} */ (["claude", "openai", "gemini"]);
