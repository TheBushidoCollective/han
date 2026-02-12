/**
 * Per-model pricing for Claude API
 *
 * Single source of truth for all Claude model pricing.
 * Prices are per million tokens (MTok) in USD.
 *
 * @see https://platform.claude.com/docs/en/about-claude/pricing
 */

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

/**
 * Sonnet-class pricing used as fallback for unknown models.
 */
export const DEFAULT_PRICING: ModelPricing = {
  inputPerMTok: 3.0,
  outputPerMTok: 15.0,
  cacheReadPerMTok: 0.3,
  cacheWritePerMTok: 3.75,
};

/**
 * Pricing table keyed by model family pattern.
 * Order matters: first match wins in getPricingForModel().
 */
const MODEL_PRICING_TABLE: Array<{
  pattern: RegExp;
  pricing: ModelPricing;
}> = [
  {
    // Opus 4.5, 4.6 (e.g., claude-opus-4-5-20250929, claude-opus-4-6)
    pattern: /claude-opus-4-[56]/,
    pricing: {
      inputPerMTok: 5.0,
      outputPerMTok: 25.0,
      cacheReadPerMTok: 0.5,
      cacheWritePerMTok: 6.25,
    },
  },
  {
    // Opus 4, 4.1 (e.g., claude-opus-4-1-20250414)
    pattern: /claude-opus-4(?:-[01])?(?:-\d|$)/,
    pricing: {
      inputPerMTok: 15.0,
      outputPerMTok: 75.0,
      cacheReadPerMTok: 1.5,
      cacheWritePerMTok: 18.75,
    },
  },
  {
    // Sonnet 4, 4.5 (e.g., claude-sonnet-4-5-20250929, claude-sonnet-4-20250514)
    pattern: /claude-sonnet-4/,
    pricing: {
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
      cacheReadPerMTok: 0.3,
      cacheWritePerMTok: 3.75,
    },
  },
  {
    // Haiku 4.5 (e.g., claude-haiku-4-5-20251001)
    pattern: /claude-haiku-4-5/,
    pricing: {
      inputPerMTok: 1.0,
      outputPerMTok: 5.0,
      cacheReadPerMTok: 0.1,
      cacheWritePerMTok: 1.25,
    },
  },
  {
    // Haiku 3.5 (e.g., claude-3-5-haiku-20241022)
    pattern: /claude-3-5-haiku/,
    pricing: {
      inputPerMTok: 0.8,
      outputPerMTok: 4.0,
      cacheReadPerMTok: 0.08,
      cacheWritePerMTok: 1.0,
    },
  },
  {
    // Sonnet 3.5 (e.g., claude-3-5-sonnet-20241022)
    pattern: /claude-3-5-sonnet/,
    pricing: {
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
      cacheReadPerMTok: 0.3,
      cacheWritePerMTok: 3.75,
    },
  },
  {
    // Opus 3 (e.g., claude-3-opus-20240229)
    pattern: /claude-3-opus/,
    pricing: {
      inputPerMTok: 15.0,
      outputPerMTok: 75.0,
      cacheReadPerMTok: 1.5,
      cacheWritePerMTok: 18.75,
    },
  },
];

/**
 * Get pricing for a specific model ID.
 * Matches against known patterns; returns DEFAULT_PRICING for unknown models.
 */
export function getPricingForModel(modelId: string): ModelPricing {
  for (const entry of MODEL_PRICING_TABLE) {
    if (entry.pattern.test(modelId)) {
      return entry.pricing;
    }
  }
  return DEFAULT_PRICING;
}

/**
 * Token usage for a single model from stats-cache.json
 */
export interface ModelTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

/**
 * Calculate cost for a single model given its token usage.
 */
export function calculateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number
): number {
  const pricing = getPricingForModel(modelId);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheReadCost =
    (cacheReadTokens / 1_000_000) * pricing.cacheReadPerMTok;
  const cacheWriteCost =
    (cacheWriteTokens / 1_000_000) * pricing.cacheWritePerMTok;
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

/**
 * Calculate total cost across all models from a modelUsage map.
 * This is the shape from stats-cache.json's modelUsage field.
 */
export function calculateTotalCostFromModelUsage(
  modelUsage: Record<string, ModelTokenUsage>
): number {
  let total = 0;
  for (const [modelId, usage] of Object.entries(modelUsage)) {
    total += calculateModelCost(
      modelId,
      usage.inputTokens,
      usage.outputTokens,
      usage.cacheReadInputTokens,
      usage.cacheCreationInputTokens
    );
  }
  return total;
}

/**
 * Calculate cache savings across all models.
 * Savings = (inputPrice - cacheReadPrice) * cacheReadTokens for each model.
 */
export function calculateCacheSavings(
  modelUsage: Record<string, ModelTokenUsage>
): number {
  let savings = 0;
  for (const [modelId, usage] of Object.entries(modelUsage)) {
    const pricing = getPricingForModel(modelId);
    const savedPerMTok = pricing.inputPerMTok - pricing.cacheReadPerMTok;
    savings += (usage.cacheReadInputTokens / 1_000_000) * savedPerMTok;
  }
  return savings;
}

/**
 * Calculate cost using default (Sonnet-class) pricing.
 * Used for per-session and daily/weekly costs where per-model breakdown is unavailable.
 */
export function calculateDefaultCost(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * DEFAULT_PRICING.inputPerMTok;
  const outputCost = (outputTokens / 1_000_000) * DEFAULT_PRICING.outputPerMTok;
  const cacheCost =
    (cacheReadTokens / 1_000_000) * DEFAULT_PRICING.cacheReadPerMTok;
  return inputCost + outputCost + cacheCost;
}
