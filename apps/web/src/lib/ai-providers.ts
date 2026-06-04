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
import { estimateCostUsd } from "@/lib/ai-pricing";

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
  /** Identity for usage tracking. Pass userId when the caller has a
   *  signed-in user; anonymousId when the caller is on the
   *  unsigned-in path (anon chrome-ext captures + their transforms).
   *  Either is enough — both null means the row is dropped (no
   *  identity, no billable). */
  userId?: string;
  anonymousId?: string;
  /** Action label for usage attribution. Free-form but stable —
   *  the admin Usage tab groups by this. Examples: "polish",
   *  "translate", "chat-doc", "chat-hub", "chat-bundle",
   *  "transform", "bundle-graph", "doc-ontology". */
  action?: string;
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
  const action = opts.action || "unknown";

  let lastError: { status: number; message: string } | null = null;
  let sawRateLimit = false;

  for (const provider of order) {
    const key = providerKey(provider);
    if (!key) continue;
    const model = lite ? config.models[provider].lite : config.models[provider].primary;
    const startedAt = Date.now();
    try {
      const { result, usage } = await callProvider(provider, key, model, {
        prompt: opts.prompt,
        temperature,
        maxOutputTokens,
      });
      const durationMs = Date.now() - startedAt;
      if (result.ok) {
        logUsage({
          userId: opts.userId,
          anonymousId: opts.anonymousId,
          action,
          provider,
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          status: "ok",
          tier: lite ? "lite" : "primary",
          durationMs,
        });
        return result;
      }
      if (result.status === 429) sawRateLimit = true;
      lastError = { status: result.status, message: result.error };
      // Per-failed-attempt log entries are noise (every cascade rung
      // would write a row when nothing is wrong with the user). Only
      // log the final outcome below.
    } catch (err) {
      lastError = {
        status: 502,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Final-failure log so the admin Usage tab can still surface
  // outages / quota exhaustion (cost: zero, status: error /
  // rate_limited).
  logUsage({
    userId: opts.userId,
    anonymousId: opts.anonymousId,
    action,
    provider: order[0] || "openai",
    model: "(none)",
    inputTokens: 0,
    outputTokens: 0,
    status: sawRateLimit ? "rate_limited" : (lastError ? "error" : "no_provider"),
    tier: lite ? "lite" : "primary",
  });

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

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface ProviderCallResult {
  result: AICallResult;
  usage: TokenUsage;
}

async function callProvider(
  provider: ProviderName,
  apiKey: string,
  model: string,
  ctx: CallContext,
): Promise<ProviderCallResult> {
  if (provider === "anthropic") return callAnthropic(apiKey, model, ctx);
  if (provider === "openai") return callOpenAI(apiKey, model, ctx);
  return callGemini(apiKey, model, ctx);
}

async function callAnthropic(apiKey: string, model: string, ctx: CallContext): Promise<ProviderCallResult> {
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
    return { result: { ok: false, error: `Anthropic ${res.status}`, status: res.status }, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const stopReason = data.stop_reason;
  const usage: TokenUsage = {
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
  if (!text.trim()) {
    return { result: { ok: false, error: "Empty Anthropic response", status: 500 }, usage };
  }
  return { result: { ok: true, text, provider: "anthropic", finishReason: stopReason }, usage };
}

async function callOpenAI(apiKey: string, model: string, ctx: CallContext): Promise<ProviderCallResult> {
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
    return { result: { ok: false, error: `OpenAI ${res.status}`, status: res.status }, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const finishReason = data.choices?.[0]?.finish_reason;
  const usage: TokenUsage = {
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
  if (!text.trim()) {
    return { result: { ok: false, error: "Empty OpenAI response", status: 500 }, usage };
  }
  return { result: { ok: true, text, provider: "openai", finishReason }, usage };
}

/**
 * Streaming variant of callAI. Same cascade + config resolution; the
 * returned ReadableStream emits plain text chunks (no SSE framing).
 *
 * Used by the editor chat, hub chat, and bundle chat routes — they
 * pipe the resulting stream straight back to the browser with
 * text/plain or text/event-stream framing of their choice. callers
 * that don't need streaming should use callAI.
 *
 * Provider behavior matrix:
 *   Anthropic — `stream: true` returns SSE; we read content_block_delta
 *   OpenAI    — `stream: true` returns SSE; we read choices[0].delta.content
 *   Gemini    — streamGenerateContent returns a JSON array streamed in
 *               chunks; we parse each candidates[0].content.parts[0].text
 *
 * Failover rule: a stream "succeeds" once the first chunk is emitted.
 * If a provider errors AFTER chunks start flowing we surface that
 * error inline rather than retry — a partial response is better than
 * a fresh start that wastes the user's reading time.
 */
export interface StreamTextResult {
  ok: boolean;
  /** Provider that actually served the stream (only when ok). */
  provider?: ProviderName;
  /** ReadableStream of plain text chunks. Closed when generation
   *  ends, errors mid-stream, or the upstream provider closes. */
  stream?: ReadableStream<string>;
  /** Failure reason — only when ok === false (every provider tried
   *  failed BEFORE any chunk could be emitted). */
  error?: string;
  status?: number;
}

export async function streamText(opts: AICallOptions): Promise<StreamTextResult> {
  const config = await getAIConfig();
  const order = opts.providerOrder ?? config.order;
  const temperature = opts.temperature ?? 0.3;
  const maxOutputTokens = opts.maxOutputTokens ?? 8192;
  const lite = !!opts.useLiteModel;
  const action = opts.action || "unknown";

  let lastError: { status: number; message: string } | null = null;

  for (const provider of order) {
    const key = providerKey(provider);
    if (!key) continue;
    const model = lite ? config.models[provider].lite : config.models[provider].primary;
    const startedAt = Date.now();
    // Each provider streams its own SSE event shape; the extractor
    // pair below pulls (text chunks, usage tokens) per event. Usage
    // accumulator lives here so we can log a single row when the
    // stream finishes, with the final reported counts.
    const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    try {
      const rawStream = await openProviderStream(provider, key, model, {
        prompt: opts.prompt,
        temperature,
        maxOutputTokens,
      }, usage);
      if (rawStream) {
        // Tee a thin wrapper so we can log usage when the consumer
        // finishes reading (or errors / cancels). The wrapper is
        // transparent — just forwards every chunk.
        const finalizedStream = new ReadableStream<string>({
          async start(controller) {
            const reader = rawStream.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
              controller.close();
              logUsage({
                userId: opts.userId,
                anonymousId: opts.anonymousId,
                action,
                provider,
                model,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                status: "ok",
                tier: lite ? "lite" : "primary",
                durationMs: Date.now() - startedAt,
              });
            } catch (err) {
              controller.error(err);
              // Stream errored mid-flight after some chunks landed.
              // Log what we got so the user is still billed for the
              // tokens the provider actually generated (partial).
              logUsage({
                userId: opts.userId,
                anonymousId: opts.anonymousId,
                action,
                provider,
                model,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                status: "error",
                tier: lite ? "lite" : "primary",
                durationMs: Date.now() - startedAt,
              });
            }
          },
          cancel() {
            // Consumer aborted (browser closed tab, etc.). Log the
            // partial usage so billing reflects work the provider did.
            logUsage({
              userId: opts.userId,
              anonymousId: opts.anonymousId,
              action,
              provider,
              model,
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              status: "ok",
              tier: lite ? "lite" : "primary",
              durationMs: Date.now() - startedAt,
            });
          },
        });
        return { ok: true, provider, stream: finalizedStream };
      }
    } catch (err) {
      lastError = {
        status: 502,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
  // Pre-stream failure (no provider responded) — log a zero-token
  // row so the admin can see the failure surface.
  logUsage({
    userId: opts.userId,
    anonymousId: opts.anonymousId,
    action,
    provider: order[0] || "openai",
    model: "(none)",
    inputTokens: 0,
    outputTokens: 0,
    status: lastError ? "error" : "no_provider",
    tier: lite ? "lite" : "primary",
  });
  return {
    ok: false,
    error: lastError?.message || "No AI provider available for streaming",
    status: lastError?.status ?? 503,
  };
}

async function openProviderStream(
  provider: ProviderName,
  apiKey: string,
  model: string,
  ctx: CallContext,
  usage: TokenUsage,
): Promise<ReadableStream<string> | null> {
  if (provider === "anthropic") return openAnthropicStream(apiKey, model, ctx, usage);
  if (provider === "openai")    return openOpenAIStream(apiKey, model, ctx, usage);
  return openGeminiStream(apiKey, model, ctx, usage);
}

async function openAnthropicStream(apiKey: string, model: string, ctx: CallContext, usage: TokenUsage): Promise<ReadableStream<string> | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(ctx.maxOutputTokens, 64000),
      temperature: ctx.temperature,
      stream: true,
      messages: [{ role: "user", content: ctx.prompt }],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Anthropic ${res.status}`);
  }
  return sseTextChunks(res.body, (data) => {
    // Anthropic SSE events we care about:
    //   message_start  → carries usage.input_tokens (one-time)
    //   content_block_delta { delta: { type:"text_delta", text } } → chunk
    //   message_delta  → cumulative usage.output_tokens; we overwrite
    const d = data as {
      type?: string;
      delta?: { type?: string; text?: string };
      message?: { usage?: { input_tokens?: number; output_tokens?: number } };
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (d?.type === "message_start" && d.message?.usage) {
      if (typeof d.message.usage.input_tokens === "number")  usage.inputTokens  = d.message.usage.input_tokens;
      if (typeof d.message.usage.output_tokens === "number") usage.outputTokens = d.message.usage.output_tokens;
    }
    if (d?.type === "message_delta" && d.usage) {
      if (typeof d.usage.output_tokens === "number") usage.outputTokens = d.usage.output_tokens;
    }
    if (d?.delta?.type === "text_delta" && typeof d.delta.text === "string") {
      return d.delta.text;
    }
    return "";
  });
}

async function openOpenAIStream(apiKey: string, model: string, ctx: CallContext, usage: TokenUsage): Promise<ReadableStream<string> | null> {
  const body: Record<string, unknown> = {
    model,
    stream: true,
    // Per OpenAI docs: opt-in to receive a final chunk with usage
    // tokens after [DONE]. Without this the cascade has no idea what
    // the call cost.
    stream_options: { include_usage: true },
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
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenAI ${res.status}`);
  }
  return sseTextChunks(res.body, (data) => {
    const d = data as {
      choices?: Array<{ delta?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    // include_usage=true emits a final chunk with empty choices[] +
    // populated usage. Capture before returning empty-text.
    if (d?.usage) {
      if (typeof d.usage.prompt_tokens === "number")     usage.inputTokens  = d.usage.prompt_tokens;
      if (typeof d.usage.completion_tokens === "number") usage.outputTokens = d.usage.completion_tokens;
    }
    const c = d?.choices?.[0]?.delta?.content;
    return typeof c === "string" ? c : "";
  });
}

async function openGeminiStream(apiKey: string, model: string, ctx: CallContext, usage: TokenUsage): Promise<ReadableStream<string> | null> {
  // Gemini streamGenerateContent returns a streamed JSON array. With
  // alt=sse it ships SSE-formatted lines that each carry one
  // GenerateContentResponse — same shape as the non-stream endpoint
  // but one candidate at a time. The FINAL event in the stream
  // carries usageMetadata.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: ctx.prompt }] }],
      generationConfig: {
        temperature: ctx.temperature,
        maxOutputTokens: ctx.maxOutputTokens,
      },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Gemini ${res.status}`);
  }
  return sseTextChunks(res.body, (data) => {
    const d = data as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    if (d?.usageMetadata) {
      if (typeof d.usageMetadata.promptTokenCount === "number")     usage.inputTokens  = d.usageMetadata.promptTokenCount;
      if (typeof d.usageMetadata.candidatesTokenCount === "number") usage.outputTokens = d.usageMetadata.candidatesTokenCount;
    }
    const parts = d?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return "";
    return parts.map((p) => p?.text || "").join("");
  });
}

/**
 * Parse an SSE byte stream into plain text chunks. extractText pulls
 * the per-event text from the parsed JSON. Skips comments / empty
 * lines / `data: [DONE]` markers. Stops on stream close.
 */
function sseTextChunks(
  body: ReadableStream<Uint8Array>,
  extractText: (data: unknown) => string,
): ReadableStream<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      let errored = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          // Normalize CRLF / CR to LF up-front. SSE spec allows any
          // line terminator (RFC 5234) and some providers / proxies
          // ship \r\n. The event-separator search below assumes \n\n
          // — without this, those streams would buffer forever.
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");
          // SSE events are separated by blank lines (\n\n). Each event
          // can have multiple `data:` fields that concatenate.
          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) >= 0) {
            const eventBlock = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            const dataLines: string[] = [];
            for (const line of eventBlock.split("\n")) {
              if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trim());
              }
            }
            if (dataLines.length === 0) continue;
            const payload = dataLines.join("\n");
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              const text = extractText(parsed);
              if (text) controller.enqueue(text);
            } catch { /* malformed event, skip */ }
          }
        }
      } catch (err) {
        errored = true;
        controller.error(err);
      }
      // close() is a no-op (and emits a warning in some runtimes)
      // once the controller is already errored. Skip in that case.
      if (!errored) controller.close();
    },
  });
}

async function callGemini(apiKey: string, model: string, ctx: CallContext): Promise<ProviderCallResult> {
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
    return { result: { ok: false, error: `Gemini ${res.status}`, status: res.status }, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const finishReason = data.candidates?.[0]?.finishReason;
  const usage: TokenUsage = {
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
  };
  if (!text.trim()) {
    return {
      result: {
        ok: false,
        error: finishReason === "SAFETY" ? "Safety filter blocked output" : "Empty Gemini response",
        status: finishReason === "SAFETY" ? 451 : 500,
      },
      usage,
    };
  }
  return { result: { ok: true, text, provider: "gemini", finishReason }, usage };
}

// ─── Usage logging ────────────────────────────────────────────────
//
// Every successful (or failed-but-attributable) AI call lands a row
// in ai_usage. Per-user totals + per-action breakdown power both the
// admin Usage tab today and the per-user invoice / quota system the
// product will need when Pro launches.
//
// Design notes:
//   - Fire-and-forget. A logging failure must NEVER surface to the
//     user — we already shipped the AI response (or an unrelated
//     failure) before this runs. So every error path swallows and
//     console.warns.
//   - Identity-gated. No userId AND no anonymousId means we cannot
//     bill anyone, so we drop the row rather than store an orphan.
//     (Public viewer-only AI calls, if any, fall here.)
//   - Cost is computed AT WRITE TIME via the pricing table — we want
//     the cost the user actually accrued, not the cost recomputed
//     from a future pricing change.
//   - Service-role client (lib/supabase.getSupabaseClient) bypasses
//     RLS for the insert, which is intentional: only the cost-first
//     cascade writes here, browsers can only read their own rows
//     via the user-scoped policy.

interface LogUsageArgs {
  userId?: string;
  anonymousId?: string;
  action: string;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  status: "ok" | "error" | "rate_limited" | "no_provider";
  tier: "lite" | "primary";
  durationMs?: number;
}

function logUsage(args: LogUsageArgs): void {
  // No identity → no row. We can't bill an anonymous-anonymous call
  // (typical for unauthenticated public viewer GETs that don't pass
  // through any caller-side anonymousId).
  if (!args.userId && !args.anonymousId) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const costUsd = estimateCostUsd(args.model, args.inputTokens, args.outputTokens);

  // Fire-and-forget — never await, never throw. The .then().catch()
  // chain is what lets us swallow errors without an unhandled-rejection
  // warning at runtime.
  supabase
    .from("ai_usage")
    .insert({
      user_id: args.userId ?? null,
      anonymous_id: args.anonymousId ?? null,
      action: args.action,
      provider: args.provider,
      model: args.model,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      cost_usd: costUsd,
      status: args.status,
      tier: args.tier,
      duration_ms: args.durationMs ?? null,
    })
    .then(({ error }) => {
      if (error) {
        console.warn("[ai-usage] insert failed:", error.message);
      }
    });
}
