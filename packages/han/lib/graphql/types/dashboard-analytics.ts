/**
 * Dashboard Analytics Helpers
 *
 * Pure utility functions for computing dashboard analytics.
 * These functions are side-effect free and directly testable.
 */

/**
 * Round a number to a given number of decimal places.
 */
export function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Parse token usage counts from a raw JSONL message JSON string.
 */
export function parseTokensFromRawJson(rawJson: string): {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
} {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const usage = parsed.usage as Record<string, unknown> | undefined;
    return {
      input: (usage?.input_tokens as number) ?? 0,
      output: (usage?.output_tokens as number) ?? 0,
      cacheRead: (usage?.cache_read_input_tokens as number) ?? 0,
      cacheCreation: (usage?.cache_creation_input_tokens as number) ?? 0,
    };
  } catch {
    return { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  }
}

/**
 * Compute sentiment trend from a list of session sentiment rows.
 * Returns 'positive', 'negative', or 'neutral'.
 */
export function computeSentimentTrend(
  sentiments: Array<{ score: number; session_id: string }>
): 'positive' | 'negative' | 'neutral' {
  if (sentiments.length === 0) return 'neutral';
  const avg =
    sentiments.reduce((sum, r) => sum + r.score, 0) / sentiments.length;
  if (avg > 0.2) return 'positive';
  if (avg < -0.2) return 'negative';
  return 'neutral';
}

/**
 * Classify a compaction event from raw JSONL.
 * Returns the compaction type string or 'unknown'.
 */
export function classifyCompactionType(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (
      parsed.type === 'system' &&
      parsed.subtype === 'context_window_compaction'
    ) {
      return 'context_window_compaction';
    }
    if (parsed.type === 'system' && parsed.subtype === 'compaction') {
      return 'compaction';
    }
    const subtype = parsed.subtype as string | undefined;
    if (subtype) return subtype;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get the start of the ISO week (Monday) for a given date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Monday = 1, Sunday = 0 (treat as day 7)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a week start date as a human-readable label like "Jan 6".
 */
export function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
