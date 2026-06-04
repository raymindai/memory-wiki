/**
 * USD pricing per million tokens for every model the cost-first
 * cascade can land on. Values are from each provider's published
 * pricing page (cross-checked 2026-06). When a provider releases a
 * new model and the admin starts using it, add the row here BEFORE
 * the next deploy — otherwise estimateCostUsd() falls back to a
 * conservative default that's likely to under-bill.
 *
 * The shape is small + boring on purpose. Pricing changes occasionally
 * and we want one source of truth that the cost-recompute job (and
 * any future invoice line-item generator) can consult.
 */

export interface ModelPrice {
  /** USD per 1,000,000 input tokens. */
  input: number;
  /** USD per 1,000,000 output tokens. */
  output: number;
}

const PRICE_TABLE: Record<string, ModelPrice> = {
  // ─── OpenAI ───────────────────────────────────────────────
  // gpt-5-nano is the new floor — extremely cheap, used as the
  // cost-first cascade's first stop for short tasks.
  "gpt-5-nano":      { input: 0.05,  output: 0.40 },
  "gpt-5-mini":      { input: 0.25,  output: 2.00 },
  "gpt-4o-mini":     { input: 0.15,  output: 0.60 },
  "gpt-4o":          { input: 2.50,  output: 10.00 },
  "gpt-4.1":         { input: 2.00,  output: 8.00 },
  "gpt-4.1-mini":    { input: 0.40,  output: 1.60 },
  "gpt-4.1-nano":    { input: 0.10,  output: 0.40 },

  // ─── Anthropic ────────────────────────────────────────────
  // claude-haiku-4-5 is the cost-first cascade's anthropic stop.
  "claude-haiku-4-5":              { input: 0.25,  output: 1.25 },
  "claude-haiku-4-5-20251001":     { input: 0.25,  output: 1.25 },
  "claude-haiku-3-5":              { input: 0.80,  output: 4.00 },
  "claude-sonnet-4":               { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-20250514":      { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-5":             { input: 3.00,  output: 15.00 },
  "claude-opus-4":                 { input: 15.00, output: 75.00 },

  // ─── Google Gemini ────────────────────────────────────────
  "gemini-3.1-flash-lite":         { input: 0.075, output: 0.30 },
  "gemini-3-flash-preview":        { input: 0.10,  output: 0.40 },
  "gemini-2.5-flash":              { input: 0.075, output: 0.30 },
  "gemini-2.5-pro":                { input: 1.25,  output: 5.00 },
  "gemini-2.0-flash":              { input: 0.075, output: 0.30 },
};

// Conservative default when the model isn't in the table — assume
// gpt-4o-mini tier so we under-bill rather than over-bill. The
// pricing page should still be updated; this is a guardrail.
const DEFAULT_PRICE: ModelPrice = { input: 0.15, output: 0.60 };

/**
 * USD cost for one call. `inputTokens` + `outputTokens` come from
 * the provider's response (`usage` / `usageMetadata`). Returns a
 * non-negative number rounded to 6 decimals.
 */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICE_TABLE[model] || DEFAULT_PRICE;
  const usd = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Math.max(0, Math.round(usd * 1_000_000) / 1_000_000);
}

/** Whether the table has explicit pricing for this model name. Helps
 *  the admin UI flag fallback-priced calls. */
export function hasExplicitPricing(model: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRICE_TABLE, model);
}
