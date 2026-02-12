/**
 * Tests for dashboard analytics helper functions.
 *
 * These are pure functions that don't require database access,
 * so they can be tested directly without mocking.
 */

import { describe, expect, test } from 'bun:test';
import {
  classifyCompactionType,
  computeSentimentTrend,
  formatWeekLabel,
  getWeekStart,
  parseTokensFromRawJson,
  round,
} from '../lib/graphql/types/dashboard-analytics.ts';
import { calculateDefaultCost as calculateCost } from '../lib/pricing/model-pricing.ts';

describe('round', () => {
  test('rounds to 2 decimal places', () => {
    expect(round(Math.PI, 2)).toBe(3.14);
    expect(round(2.005, 2)).toBe(2.01);
    expect(round(1.1, 2)).toBe(1.1);
  });

  test('rounds to 0 decimal places', () => {
    expect(round(3.7, 0)).toBe(4);
    expect(round(3.2, 0)).toBe(3);
  });

  test('rounds to 4 decimal places', () => {
    expect(round(0.00025, 4)).toBe(0.0003);
    expect(round(1.23456789, 4)).toBe(1.2346);
  });

  test('handles zero', () => {
    expect(round(0, 2)).toBe(0);
  });

  test('handles negative numbers', () => {
    expect(round(-3.456, 2)).toBe(-3.46);
  });
});

describe('calculateCost', () => {
  test('calculates cost from token counts', () => {
    // 1M input = $3, 1M output = $15, 1M cached = $0.30
    const cost = calculateCost(1_000_000, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18.3, 1);
  });

  test('returns 0 for zero tokens', () => {
    expect(calculateCost(0, 0, 0)).toBe(0);
  });

  test('handles small token counts', () => {
    // 1000 input = $0.003, 1000 output = $0.015, 1000 cached = $0.0003
    const cost = calculateCost(1000, 1000, 1000);
    expect(cost).toBeCloseTo(0.0183, 3);
  });

  test('handles only input tokens', () => {
    const cost = calculateCost(500_000, 0, 0);
    expect(cost).toBeCloseTo(1.5, 1);
  });

  test('handles only output tokens', () => {
    const cost = calculateCost(0, 100_000, 0);
    expect(cost).toBeCloseTo(1.5, 1);
  });
});

describe('parseTokensFromRawJson', () => {
  test('returns zeros for null input', () => {
    const result = parseTokensFromRawJson(null);
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheReadTokens: 0,
    });
  });

  test('parses message.usage format', () => {
    const json = JSON.stringify({
      message: {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 200,
          cache_creation_input_tokens: 100,
        },
      },
    });
    const result = parseTokensFromRawJson(json);
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.cacheReadTokens).toBe(200);
    expect(result.cachedTokens).toBe(200); // prefers cache_read over cache_creation
  });

  test('parses direct usage format', () => {
    const json = JSON.stringify({
      usage: {
        input_tokens: 2000,
        output_tokens: 1000,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 300,
      },
    });
    const result = parseTokensFromRawJson(json);
    expect(result.inputTokens).toBe(2000);
    expect(result.outputTokens).toBe(1000);
    expect(result.cachedTokens).toBe(300); // falls back to cache_creation
    expect(result.cacheReadTokens).toBe(0);
  });

  test('returns zeros for missing usage', () => {
    const json = JSON.stringify({ type: 'human', content: 'hello' });
    const result = parseTokensFromRawJson(json);
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheReadTokens: 0,
    });
  });

  test('returns zeros for invalid JSON', () => {
    const result = parseTokensFromRawJson('not valid json');
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheReadTokens: 0,
    });
  });

  test('handles empty string', () => {
    const result = parseTokensFromRawJson('');
    expect(result).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      cacheReadTokens: 0,
    });
  });
});

describe('computeSentimentTrend', () => {
  test('returns neutral for empty array', () => {
    expect(computeSentimentTrend([])).toBe('neutral');
  });

  test('returns neutral for single score', () => {
    expect(computeSentimentTrend([3])).toBe('neutral');
  });

  test('returns improving when second half is higher', () => {
    expect(computeSentimentTrend([1, 1, 3, 3])).toBe('improving');
  });

  test('returns declining when second half is lower', () => {
    expect(computeSentimentTrend([3, 3, 1, 1])).toBe('declining');
  });

  test('returns stable when difference is small', () => {
    expect(computeSentimentTrend([2, 2, 2.3, 2.3])).toBe('stable');
  });

  test('handles negative scores', () => {
    expect(computeSentimentTrend([-3, -3, 2, 2])).toBe('improving');
  });
});

describe('classifyCompactionType', () => {
  test('returns auto_compact for null', () => {
    expect(classifyCompactionType(null)).toBe('auto_compact');
  });

  test('detects auto_compact by type field', () => {
    const json = JSON.stringify({ type: 'auto_compact' });
    expect(classifyCompactionType(json)).toBe('auto_compact');
  });

  test('detects auto_compact by auto_compacted field', () => {
    const json = JSON.stringify({ auto_compacted: true });
    expect(classifyCompactionType(json)).toBe('auto_compact');
  });

  test('detects manual compact by type field', () => {
    const json = JSON.stringify({ type: 'compact' });
    expect(classifyCompactionType(json)).toBe('compact');
  });

  test('detects manual compact by is_compact field', () => {
    const json = JSON.stringify({ is_compact: true });
    expect(classifyCompactionType(json)).toBe('compact');
  });

  test('detects manual compact by isCompact field', () => {
    const json = JSON.stringify({ isCompact: true });
    expect(classifyCompactionType(json)).toBe('compact');
  });

  test('detects continuation from content', () => {
    const json = JSON.stringify({
      content: 'This session was continued from a previous conversation.',
    });
    expect(classifyCompactionType(json)).toBe('continuation');
  });

  test('detects continuation from nested content', () => {
    const json = JSON.stringify({
      message: {
        content:
          'continued from a previous conversation that ran out of context',
      },
    });
    expect(classifyCompactionType(json)).toBe('continuation');
  });

  test('falls back to auto_compact for unrecognized JSON', () => {
    const json = JSON.stringify({ summary: 'some summary text' });
    expect(classifyCompactionType(json)).toBe('auto_compact');
  });

  test('falls back to auto_compact for invalid JSON', () => {
    expect(classifyCompactionType('not json')).toBe('auto_compact');
  });
});

describe('getWeekStart', () => {
  test('returns Monday for a Monday', () => {
    // 2026-02-02 is a Monday
    expect(getWeekStart('2026-02-02')).toBe('2026-02-02');
  });

  test('returns previous Monday for a Wednesday', () => {
    // 2026-02-04 is a Wednesday
    expect(getWeekStart('2026-02-04')).toBe('2026-02-02');
  });

  test('returns previous Monday for a Sunday', () => {
    // 2026-02-08 is a Sunday
    expect(getWeekStart('2026-02-08')).toBe('2026-02-02');
  });

  test('returns previous Monday for a Saturday', () => {
    // 2026-02-07 is a Saturday
    expect(getWeekStart('2026-02-07')).toBe('2026-02-02');
  });

  test('handles month boundaries', () => {
    // 2026-02-01 is a Sunday, Monday is Jan 26
    expect(getWeekStart('2026-02-01')).toBe('2026-01-26');
  });

  test('handles year boundaries', () => {
    // 2026-01-01 is a Thursday, Monday is Dec 29
    expect(getWeekStart('2026-01-01')).toBe('2025-12-29');
  });
});

describe('formatWeekLabel', () => {
  test('formats same-month week', () => {
    expect(formatWeekLabel('2026-02-02')).toBe('Feb 2 - 8');
  });

  test('formats cross-month week', () => {
    expect(formatWeekLabel('2026-01-26')).toBe('Jan 26 - Feb 1');
  });

  test('formats year-end week', () => {
    expect(formatWeekLabel('2025-12-29')).toBe('Dec 29 - Jan 4');
  });
});
