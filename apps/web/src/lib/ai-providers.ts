/**
 * Unified AI provider call with Anthropic → OpenAI → Gemini failover.
 *
 * Existing codebase has two patterns:
 *
 *   1. Single-provider (Gemini only) — used by /api/ai/route.ts
 *      (chat + polish/summary/format etc.). A Gemini outage or
 *      missing key kills every AI surface in the editor.
 *
 *   2. First-key-available three-provider chain — used by
 *      /define, /decompose, bundles/ai-generate, etc. Picks the
 *      first provider whose env var is set, but does NOT failover
 *      at runtime if that provider 500s.
 *
 * This helper is the resilient version of #2: tries each provider
 * with a key in priority order, catches 5xx/429/network errors,
 * and falls through to the next. Used by chat + the other
 * Gemini-only routes so a single-vendor outage doesn't break the
 * editor.
 *
 * Provider priority: Anthropic > OpenAI > Gemini. Anthropic is
 * the highest-quality default and the one the founder pays for
 * directly; OpenAI is the most-deployed fallback; Gemini is the
 * cheapest tail for free-tier resilience.
 */

export type ProviderName = "anthropic" | "openai" | "gemini";

export interface AICallOptions {
  /** Full prompt (system + user content concatenated). */
  prompt: string;
  /** 0.0 - 1.0. Default 0.3. */
  temperature?: number;
  /** Output token cap. Default 8192. */
  maxOutputTokens?: number;
  /** Use the smaller / cheaper model in each provider's lineup. */
  useLiteModel?: boolean;
  /** Override provider order. Default is anthropic → openai → gemini. */
  providerOrder?: ProviderName[];
  /** Override Gemini model (e.g. from site_config). Ignored for
   *  Anthropic / OpenAI; those use hardcoded sane defaults. */
  geminiModel?: string;
  /** Override Gemini lite model. */
  geminiLiteModel?: string;
}

export interface AICallSuccess {
  ok: true;
  text: string;
  provider: ProviderName;
  finishReason?: string;
}

export interface AICallFailure {
  ok: false;
  error: string;
  status: number;
  /** Set when every provider returned 429. UI uses this to show
   *  "rate-limited, try again in a minute" instead of a generic
   *  failure. */
  rateLimited?: boolean;
}

export type AICallResult = AICallSuccess | AICallFailure;

const ANTHROPIC_MODEL_PRIMARY = "claude-sonnet-4-20250514";
const ANTHROPIC_MODEL_LITE = "claude-haiku-4-5";
const OPENAI_MODEL_PRIMARY = "gpt-4o";
const OPENAI_MODEL_LITE = "gpt-4o-mini";
const GEMINI_MODEL_PRIMARY_DEFAULT = "gemini-3-flash-preview";
const GEMINI_MODEL_LITE_DEFAULT = "gemini-3.1-flash-lite";

export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  const order = opts.providerOrder ?? ["anthropic", "openai", "gemini"];
  const temperature = opts.temperature ?? 0.3;
  const maxOutputTokens = opts.maxOutputTokens ?? 8192;
  const lite = !!opts.useLiteModel;

  let lastError: { status: number; message: string } | null = null;
  let sawRateLimit = false;

  for (const provider of order) {
    const key = providerKey(provider);
    if (!key) continue;
    try {
      const result = await callProvider(provider, key, {
        prompt: opts.prompt,
        temperature,
        maxOutputTokens,
        lite,
        geminiModel: opts.geminiModel,
        geminiLiteModel: opts.geminiLiteModel,
      });
      if (result.ok) return result;
      // Non-OK: remember and try the next provider. 429s are
      // tracked separately so we can surface a rate-limit message
      // when every provider is throttled.
      if (result.status === 429) sawRateLimit = true;
      lastError = { status: result.status, message: result.error };
    } catch (err) {
      lastError = {
        status: 502,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (!lastError) {
    return { ok: false, error: "No AI provider configured", status: 503 };
  }
  return {
    ok: false,
    error: sawRateLimit
      ? "AI is rate-limited across all providers. Try again in a minute."
      : "AI service is temporarily unavailable.",
    status: sawRateLimit ? 429 : lastError.status,
    rateLimited: sawRateLimit,
  };
}

function providerKey(provider: ProviderName): string | null {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || null;
  if (provider === "openai") return process.env.OPENAI_API_KEY || null;
  if (provider === "gemini") return process.env.GEMINI_API_KEY || null;
  return null;
}

interface CallContext {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  lite: boolean;
  geminiModel?: string;
  geminiLiteModel?: string;
}

async function callProvider(
  provider: ProviderName,
  apiKey: string,
  ctx: CallContext,
): Promise<AICallResult> {
  if (provider === "anthropic") return callAnthropic(apiKey, ctx);
  if (provider === "openai") return callOpenAI(apiKey, ctx);
  return callGemini(apiKey, ctx);
}

async function callAnthropic(apiKey: string, ctx: CallContext): Promise<AICallResult> {
  const model = ctx.lite ? ANTHROPIC_MODEL_LITE : ANTHROPIC_MODEL_PRIMARY;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(ctx.maxOutputTokens, 8192),
      temperature: ctx.temperature,
      messages: [{ role: "user", content: ctx.prompt }],
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `Anthropic ${res.status}`, status: res.status };
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const stopReason = data.stop_reason;
  if (!text.trim()) {
    return { ok: false, error: "Empty Anthropic response", status: 500 };
  }
  return { ok: true, text, provider: "anthropic", finishReason: stopReason };
}

async function callOpenAI(apiKey: string, ctx: CallContext): Promise<AICallResult> {
  const model = ctx.lite ? OPENAI_MODEL_LITE : OPENAI_MODEL_PRIMARY;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: ctx.prompt }],
      temperature: ctx.temperature,
      max_tokens: Math.min(ctx.maxOutputTokens, 16384),
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `OpenAI ${res.status}`, status: res.status };
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const finishReason = data.choices?.[0]?.finish_reason;
  if (!text.trim()) {
    return { ok: false, error: "Empty OpenAI response", status: 500 };
  }
  return { ok: true, text, provider: "openai", finishReason };
}

async function callGemini(apiKey: string, ctx: CallContext): Promise<AICallResult> {
  const model = ctx.lite
    ? (ctx.geminiLiteModel || GEMINI_MODEL_LITE_DEFAULT)
    : (ctx.geminiModel || GEMINI_MODEL_PRIMARY_DEFAULT);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ctx.prompt }] }],
        generationConfig: {
          temperature: ctx.temperature,
          maxOutputTokens: ctx.maxOutputTokens,
        },
      }),
    }
  );
  if (!res.ok) {
    return { ok: false, error: `Gemini ${res.status}`, status: res.status };
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const finishReason = data.candidates?.[0]?.finishReason;
  if (!text.trim()) {
    return {
      ok: false,
      error: finishReason === "SAFETY" ? "Safety filter blocked output" : "Empty Gemini response",
      status: 500,
    };
  }
  return { ok: true, text, provider: "gemini", finishReason };
}
