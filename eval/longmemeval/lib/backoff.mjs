// Exponential-backoff wrapper for eval harnesses that talk to the
// Anthropic API (directly or via Claude Code headless). Handles two
// failure modes seen in the 2026-06-10 v3 eval run:
//
//   1. Server-side TPM throttle ("Server is temporarily limiting
//      requests · Rate limited"). Recovered by waiting + retrying.
//   2. Transient 5xx or network blip. Same handling.
//
// Usage:
//   const result = await withBackoff(() => doOneAgentCall(prompt), {
//     maxAttempts: 6,
//     baseDelayMs: 2_000,
//     onRetry: (attempt, err, delay) => console.warn(...),
//   });
//
// Caller decides what counts as "retriable" by throwing an error with
// .retriable = true, or by returning a sentinel. Defaults below catch
// the two patterns named above by string match.

const DEFAULT_RETRIABLE_PATTERNS = [
  /rate limit/i,
  /temporarily limiting/i,
  /TPM/i,
  /429/,
  /503/,
  /504/,
  /ECONNRESET/,
  /ENOTFOUND/,
  /timeout/i,
];

export function isRetriable(errOrResult, patterns = DEFAULT_RETRIABLE_PATTERNS) {
  if (!errOrResult) return false;
  if (typeof errOrResult === "object" && errOrResult.retriable === true) return true;
  const msg =
    (errOrResult && errOrResult.message) ||
    (errOrResult && errOrResult.error) ||
    (typeof errOrResult === "string" ? errOrResult : "");
  if (!msg) return false;
  return patterns.some((p) => p.test(msg));
}

export async function withBackoff(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 6;
  const baseDelayMs = opts.baseDelayMs ?? 2_000;
  const maxDelayMs = opts.maxDelayMs ?? 60_000;
  const jitter = opts.jitter ?? 0.3;
  const onRetry = opts.onRetry || (() => {});
  const patterns = opts.retriablePatterns;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      // Sentinel string check — useful when fn() returns API-error text
      // instead of throwing.
      if (typeof result === "string" && isRetriable(result, patterns)) {
        if (attempt < maxAttempts) {
          const delay = nextDelay(attempt, baseDelayMs, maxDelayMs, jitter);
          onRetry(attempt, new Error(result.slice(0, 200)), delay);
          await sleep(delay);
          continue;
        }
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (!isRetriable(err, patterns) || attempt >= maxAttempts) throw err;
      const delay = nextDelay(attempt, baseDelayMs, maxDelayMs, jitter);
      onRetry(attempt, err, delay);
      await sleep(delay);
    }
  }
  throw lastErr || new Error("withBackoff: exhausted attempts");
}

function nextDelay(attempt, base, max, jitter) {
  const exp = base * Math.pow(2, attempt - 1);
  const j = exp * jitter * (Math.random() * 2 - 1);
  return Math.min(max, Math.max(0, Math.round(exp + j)));
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Simple token-budget pacer — call .reserve(estimatedTokens) before a
// call and it sleeps until budget allows. Useful when running many
// agents through a per-minute TPM cap.
export class TPMPacer {
  constructor({ tpm = 200_000, windowMs = 60_000 } = {}) {
    this.tpm = tpm;
    this.windowMs = windowMs;
    this.recent = []; // { t, tokens }
  }
  async reserve(estimatedTokens) {
    while (true) {
      const now = mono();
      this.recent = this.recent.filter((r) => now - r.t < this.windowMs);
      const used = this.recent.reduce((s, r) => s + r.tokens, 0);
      if (used + estimatedTokens <= this.tpm) {
        this.recent.push({ t: now, tokens: estimatedTokens });
        return;
      }
      const oldest = this.recent[0];
      const wait = Math.max(50, this.windowMs - (now - oldest.t));
      await sleep(wait);
    }
  }
}

function mono() {
  // process.hrtime.bigint gives nanoseconds; fall back to Date for older
  // node. We're inside a node runtime so process is fine.
  if (typeof process !== "undefined" && process.hrtime?.bigint) {
    return Number(process.hrtime.bigint() / 1_000_000n);
  }
  return Date.now();
}
