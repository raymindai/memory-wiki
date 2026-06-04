/**
 * AI provider router with cost-first cascade + admin-configurable
 * defaults.
 *
 * Single entry point: `callAI(opts)`. Reads provider order + per-
 * provider primary/lite model from site_config (5-min cache), tries
 * each provider in order until one returns a non-empty text. Migrated
 * away from the previous quality-first (Anthropic → OpenAI → Gemini)
 * cascade so every AI surface — chat, polish, translate, format,
 * Chrome-ext intent transform, bundle graph, hub concept index —
 * hits the cheapest model first and only escalates on failure.
 *
 * site_config keys (all optional, defaults apply when missing):
 *   ai_provider_order          comma-separated, e.g. "openai,gemini,anthropic"
 *   ai_openai_primary          e.g. "gpt-4o-mini"
 *   ai_openai_lite             e.g. "gpt-5-nano"
 *   ai_gemini_primary          e.g. "gemini-3-flash-preview"
 *   ai_gemini_lite             e.g. "gemini-3.1-flash-lite"
 *   ai_anthropic_primary       e.g. "claude-haiku-4-5"
 *   ai_anthropic_lite          e.g. "claude-haiku-4-5"
 *
 * Backwards-compatible: the older `ai_model_primary` / `ai_model_lite`
 * keys (Gemini-only) are still honoured.
 */

import { getSupabaseClient } from "@/lib/supabase";

export type ProviderName = "anthropic" | "openai" | "gemini";

export interface AICallOptions {
  /** Full prompt (system + user content concatenated). */
  prompt: string;
  /** 0.0 - 1.0. Default 0.3. */
  temperature?: number;
  /** Output token cap. Default 8192. */
  maxOutputTokens?: number;
  /** Use the smaller / cheaper model in each provider's lineup.
   *  In the cost-first cascade both tiers default to inexpensive
   *  models — this still picks the cheapest of the two within each
   *  provider for very short outputs (summary / tldr / format). */
  useLiteModel?: boolean;
  /** Override provider order for this call. Otherwise reads site_config. */
  providerOrder?: ProviderName[];
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
  rateLimited?: boolean;
}

export type AICallResult = AICallSuccess | AICallFailure;

// ─── Defaults (cost-first cascade) ─────────────────────────────────
// Provider order: cheapest first. Anthropic last because Haiku is
// still pricier per token than nano / flash-lite for short replies.
const DEFAULT_ORDER: ProviderName[] = ["openai", "gemini", "anthropic"];

// Per-provider defaults. Primary = "slightly better cheap model"
// (used for polish / translate / chat). Lite = "cheapest" (used for
// summary / tldr / format / Chrome-ext intent transform).
const DEFAULTS = {
  openai:    { primary: "gpt-4o-mini",            lite: "gpt-5-nano" },
  gemini:    { primary: "gemini-3-flash-preview", lite: "gemini-3.1-flash-lite" },
  anthropic: { primary: "claude-haiku-4-5",       lite: "claude-haiku-4-5" },
} as const;

export interface AIConfig {
  order: ProviderName[];
  models: {
    openai:    { primary: string; lite: string };
    gemini:    { primary: string; lite: string };
    anthropic: { primary: string; lite: string };
  };
}

let cachedConfig: AIConfig | null = null;
let cachedAt = 0;
const CONFIG_TTL_MS = 5 * 60 * 1000;

/**
 * Read the unified AI config from site_config with a 5-min cache.
 * Returns the fully-resolved AIConfig (defaults filled in for any
 * missing key). Exported so the admin route can surface the current
 * effective values.
 */
export async function getAIConfig(): Promise<AIConfig> {
  if (cachedConfig && Date.now() - cachedAt < CONFIG_TTL_MS) {
    return cachedConfig;
  }
  const config: AIConfig = {
    order: [...DEFAULT_ORDER],
    models: {
      openai:    { ...DEFAULTS.openai },
      gemini:    { ...DEFAULTS.gemini },
      anthropic: { ...DEFAULTS.anthropic },
    },
  };
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      cachedConfig = config;
      cachedAt = Date.now();
      return config;
    }
    const { data: rows } = await supabase
      .from("site_config")
      .select("key, value")
      .in("key", [
        "ai_provider_order",
        "ai_openai_primary", "ai_openai_lite",
        "ai_gemini_primary", "ai_gemini_lite",
        "ai_anthropic_primary", "ai_anthropic_lite",
        // Backwards-compat: older keys that meant "Gemini override".
        "ai_model_primary", "ai_model_lite",
      ]);
    const m: Record<string, string> = {};
    for (const r of rows || []) m[r.key] = r.value;

    if (m.ai_provider_order) {
      const parsed = m.ai_provider_order
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is ProviderName => s === "openai" || s === "gemini" || s === "anthropic");
      if (parsed.length > 0) config.order = parsed;
    }
    if (m.ai_openai_primary)    config.models.openai.primary    = m.ai_openai_primary;
    if (m.ai_openai_lite)       config.models.openai.lite       = m.ai_openai_lite;
    if (m.ai_gemini_primary)    config.models.gemini.primary    = m.ai_gemini_primary;
    if (m.ai_gemini_lite)       config.models.gemini.lite       = m.ai_gemini_lite;
    if (m.ai_anthropic_primary) config.models.anthropic.primary = m.ai_anthropic_primary;
    if (m.ai_anthropic_lite)    config.models.anthropic.lite    = m.ai_anthropic_lite;
    // Legacy fallbacks
    if (m.ai_model_primary && !m.ai_gemini_primary) config.models.gemini.primary = m.ai_model_primary;
    if (m.ai_model_lite    && !m.ai_gemini_lite)    config.models.gemini.lite    = m.ai_model_lite;
  } catch {
    /* table missing or query failed — defaults stand */
  }
  cachedConfig = config;
  cachedAt = Date.now();
  return config;
}

/** Drop the cached config so the next call re-reads site_config.
 *  Admin PATCH hits this after a successful write. */
export function invalidateAIConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  const config = await getAIConfig();
  const order = opts.providerOrder ?? config.order;
  const temperature = opts.temperature ?? 0.3;
  const maxOutputTokens = opts.maxOutputTokens ?? 8192;
  const lite = !!opts.useLiteModel;

  let lastError: { status: number; message: string } | null = null;
  let sawRateLimit = false;

  for (const provider of order) {
    const key = providerKey(provider);
    if (!key) continue;
    const model = lite ? config.models[provider].lite : config.models[provider].primary;
    try {
      const result = await callProvider(provider, key, model, {
        prompt: opts.prompt,
        temperature,
        maxOutputTokens,
      });
      if (result.ok) return result;
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
  // Accept either env name — Google docs use GOOGLE_API_KEY, older code
  // uses GEMINI_API_KEY. Either works.
  if (provider === "gemini") return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  return null;
}

interface CallContext {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}

async function callProvider(
  provider: ProviderName,
  apiKey: string,
  model: string,
  ctx: CallContext,
): Promise<AICallResult> {
  if (provider === "anthropic") return callAnthropic(apiKey, model, ctx);
  if (provider === "openai") return callOpenAI(apiKey, model, ctx);
  return callGemini(apiKey, model, ctx);
}

async function callAnthropic(apiKey: string, model: string, ctx: CallContext): Promise<AICallResult> {
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

async function callOpenAI(apiKey: string, model: string, ctx: CallContext): Promise<AICallResult> {
  // gpt-5-nano routes through the same chat-completions endpoint but
  // doesn't accept `temperature` tuning — strip it for that model.
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: ctx.prompt }],
  };
  if (/^gpt-5-/.test(model)) {
    body.max_completion_tokens = Math.min(ctx.maxOutputTokens, 16384);
  } else {
    body.temperature = ctx.temperature;
    body.max_tokens = Math.min(ctx.maxOutputTokens, 16384);
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
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

async function callGemini(apiKey: string, model: string, ctx: CallContext): Promise<AICallResult> {
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
      status: finishReason === "SAFETY" ? 451 : 500,
    };
  }
  return { ok: true, text, provider: "gemini", finishReason };
}
