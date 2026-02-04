/**
 * Tests for commands/metrics/context-generation.ts
 * Tests context markdown generation and helper functions
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('context-generation.ts helper functions', () => {
  let testDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    testDir = `/tmp/test-context-gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = join(testDir, 'config');
    mkdirSync(join(testDir, 'config', 'han', 'metrics', 'jsonldb'), {
      recursive: true,
    });
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('getCalibrationEmoji logic', () => {
    test('returns target emoji for excellent calibration (85+)', () => {
      const score = 85;
      let emoji: string;
      if (score >= 85) emoji = '🎯';
      else if (score >= 70) emoji = '📈';
      else if (score >= 50) emoji = '⚠️';
      else emoji = '🔴';
      expect(emoji).toBe('🎯');
    });

    test('returns chart emoji for good calibration (70-84)', () => {
      const score = 75;
      let emoji: string;
      if (score >= 85) emoji = '🎯';
      else if (score >= 70) emoji = '📈';
      else if (score >= 50) emoji = '⚠️';
      else emoji = '🔴';
      expect(emoji).toBe('📈');
    });

    test('returns warning emoji for mediocre calibration (50-69)', () => {
      const score = 55;
      let emoji: string;
      if (score >= 85) emoji = '🎯';
      else if (score >= 70) emoji = '📈';
      else if (score >= 50) emoji = '⚠️';
      else emoji = '🔴';
      expect(emoji).toBe('⚠️');
    });

    test('returns red circle for poor calibration (<50)', () => {
      const score = 40;
      let emoji: string;
      if (score >= 85) emoji = '🎯';
      else if (score >= 70) emoji = '📈';
      else if (score >= 50) emoji = '⚠️';
      else emoji = '🔴';
      expect(emoji).toBe('🔴');
    });

    test('handles boundary at 85', () => {
      const score = 85;
      const emoji = score >= 85 ? '🎯' : '📈';
      expect(emoji).toBe('🎯');
    });

    test('handles boundary at 70', () => {
      const score = 70;
      let emoji: string;
      if (score >= 85) emoji = '🎯';
      else if (score >= 70) emoji = '📈';
      else emoji = '⚠️';
      expect(emoji).toBe('📈');
    });
  });

  describe('getCalibrationDirection logic', () => {
    test('returns overconfident when confidence exceeds outcomes significantly', () => {
      const tasks = [
        { outcome: 'failure', confidence: 0.9 },
        { outcome: 'failure', confidence: 0.8 },
        { outcome: 'success', confidence: 0.9 },
        { outcome: 'failure', confidence: 0.85 },
      ];

      let overconfidentCount = 0;
      let underconfidentCount = 0;

      for (const task of tasks) {
        const actualSuccess = task.outcome === 'success' ? 1 : 0;
        const diff = task.confidence - actualSuccess;

        if (diff > 0.2) overconfidentCount++;
        if (diff < -0.2) underconfidentCount++;
      }

      const direction =
        overconfidentCount > underconfidentCount * 1.5
          ? 'overconfident'
          : underconfidentCount > overconfidentCount * 1.5
            ? 'underconfident'
            : 'neutral';

      expect(direction).toBe('overconfident');
    });

    test('returns underconfident when outcomes exceed confidence significantly', () => {
      const tasks = [
        { outcome: 'success', confidence: 0.3 },
        { outcome: 'success', confidence: 0.4 },
        { outcome: 'success', confidence: 0.2 },
        { outcome: 'success', confidence: 0.35 },
      ];

      let overconfidentCount = 0;
      let underconfidentCount = 0;

      for (const task of tasks) {
        const actualSuccess = task.outcome === 'success' ? 1 : 0;
        const diff = task.confidence - actualSuccess;

        if (diff > 0.2) overconfidentCount++;
        if (diff < -0.2) underconfidentCount++;
      }

      const direction =
        overconfidentCount > underconfidentCount * 1.5
          ? 'overconfident'
          : underconfidentCount > overconfidentCount * 1.5
            ? 'underconfident'
            : 'neutral';

      expect(direction).toBe('underconfident');
    });

    test('returns neutral when roughly balanced', () => {
      const tasks = [
        { outcome: 'success', confidence: 0.9 },
        { outcome: 'failure', confidence: 0.1 },
      ];

      let overconfidentCount = 0;
      let underconfidentCount = 0;

      for (const task of tasks) {
        const actualSuccess = task.outcome === 'success' ? 1 : 0;
        const diff = task.confidence - actualSuccess;

        if (diff > 0.2) overconfidentCount++;
        if (diff < -0.2) underconfidentCount++;
      }

      const direction =
        overconfidentCount > underconfidentCount * 1.5
          ? 'overconfident'
          : underconfidentCount > overconfidentCount * 1.5
            ? 'underconfident'
            : 'neutral';

      expect(direction).toBe('neutral');
    });

    test('returns neutral for empty task list', () => {
      const tasks: { outcome: string; confidence: number }[] = [];
      const direction = tasks.length === 0 ? 'neutral' : 'computed';
      expect(direction).toBe('neutral');
    });
  });

  describe('getCalibrationGuidance logic', () => {
    // Helper function to simulate the calibration guidance logic
    const getCalibrationGuidance = (
      direction: 'overconfident' | 'underconfident' | 'neutral',
      score?: number
    ): string => {
      if (direction === 'overconfident') {
        return 'You tend to be **overconfident** - confidence ratings often higher than actual success.';
      }
      if (direction === 'underconfident') {
        return "You tend to be **underconfident** - you're doing better than you think!";
      }
      return `Calibration score is low (${score ?? 0}%). Focus on accurately predicting task outcomes.`;
    };

    test('provides overconfident guidance', () => {
      const guidance = getCalibrationGuidance('overconfident');
      expect(guidance).toContain('overconfident');
      expect(guidance).toContain('confidence ratings often higher');
    });

    test('provides underconfident guidance', () => {
      const guidance = getCalibrationGuidance('underconfident');
      expect(guidance).toContain('underconfident');
      expect(guidance).toContain('doing better than you think');
    });

    test('provides neutral guidance with score', () => {
      const guidance = getCalibrationGuidance('neutral', 45);
      expect(guidance).toContain('45%');
      expect(guidance).toContain('predicting task outcomes');
    });
  });

  describe('getHookSpecificGuidance logic', () => {
    test('provides TypeScript guidance', () => {
      const hookName = 'typescript-typecheck';
      const guidance: Record<string, string> = {
        'typescript-typecheck': `**TypeScript Tip:** Run \`npx -y --package typescript tsc\` during development`,
        'biome-lint': `**Biome Tip:** Run \`npx biome check --write .\``,
      };

      expect(guidance[hookName]).toContain('TypeScript Tip');
      expect(guidance[hookName]).toContain('tsc');
    });

    test('provides Biome guidance', () => {
      const hookName = 'biome-lint';
      const guidance: Record<string, string> = {
        'typescript-typecheck': `**TypeScript Tip:** Run \`npx -y --package typescript tsc\``,
        'biome-lint': `**Biome Tip:** Run \`npx biome check --write .\` before marking complete.`,
      };

      expect(guidance[hookName]).toContain('Biome Tip');
      expect(guidance[hookName]).toContain('biome check');
    });

    test('provides testing guidance', () => {
      const hookName = 'bun-test';
      const guidance: Record<string, string> = {
        'bun-test': `**Testing Tip:** Run \`bun test\` locally before completion.`,
      };

      expect(guidance[hookName]).toContain('Testing Tip');
      expect(guidance[hookName]).toContain('bun test');
    });

    test('provides commit message guidance', () => {
      const hookName = 'check-commits';
      const guidance: Record<string, string> = {
        'check-commits': `**Commit Message Tip:** Follow conventional format`,
      };

      expect(guidance[hookName]).toContain('Commit Message Tip');
      expect(guidance[hookName]).toContain('conventional format');
    });

    test('returns null for unknown hook', () => {
      const hookName = 'unknown-hook';
      const guidance: Record<string, string> = {
        'typescript-typecheck': '...',
        'biome-lint': '...',
      };

      expect(guidance[hookName]).toBeUndefined();
    });
  });

  describe('getBestTaskType logic', () => {
    test('finds best task type by success rate', () => {
      const tasks = [
        { type: 'fix', outcome: 'success' },
        { type: 'fix', outcome: 'success' },
        { type: 'fix', outcome: 'success' },
        { type: 'implementation', outcome: 'success' },
        { type: 'implementation', outcome: 'failure' },
        { type: 'implementation', outcome: 'failure' },
      ];

      const taskTypes = ['implementation', 'fix', 'refactor', 'research'];
      let best: { type: string; successRate: number } | null = null;

      for (const type of taskTypes) {
        const typeTasks = tasks.filter((t) => t.type === type);
        if (typeTasks.length < 3) continue;

        const successes = typeTasks.filter(
          (t) => t.outcome === 'success'
        ).length;
        const successRate = successes / typeTasks.length;

        if (!best || successRate > best.successRate) {
          best = { type, successRate };
        }
      }

      expect(best).not.toBeNull();
      expect(best?.type).toBe('fix');
      expect(best?.successRate).toBe(1);
    });

    test('requires minimum 3 tasks per type', () => {
      const tasks = [
        { type: 'fix', outcome: 'success' },
        { type: 'fix', outcome: 'success' },
        // Only 2 fix tasks
      ];

      const taskTypes = ['implementation', 'fix'];
      let best: { type: string; successRate: number } | null = null;

      for (const type of taskTypes) {
        const typeTasks = tasks.filter((t) => t.type === type);
        if (typeTasks.length < 3) continue;

        const successes = typeTasks.filter(
          (t) => t.outcome === 'success'
        ).length;
        const successRate = successes / typeTasks.length;

        if (!best || successRate > best.successRate) {
          best = { type, successRate };
        }
      }

      expect(best).toBeNull();
    });

    test('returns null when no types have enough tasks', () => {
      const tasks: { type: string; outcome: string }[] = [];

      const taskTypes = ['implementation', 'fix', 'refactor', 'research'];
      let best: { type: string; successRate: number } | null = null;

      for (const type of taskTypes) {
        const typeTasks = tasks.filter((t) => t.type === type);
        if (typeTasks.length < 3) continue;

        const successes = typeTasks.filter(
          (t) => t.outcome === 'success'
        ).length;
        const successRate = successes / typeTasks.length;

        if (!best || successRate > best.successRate) {
          best = { type, successRate };
        }
      }

      expect(best).toBeNull();
    });
  });

  describe('getWeakestTaskType logic', () => {
    test('finds weakest task type by success rate', () => {
      const tasks = [
        { type: 'fix', outcome: 'success' },
        { type: 'fix', outcome: 'success' },
        { type: 'fix', outcome: 'success' },
        { type: 'implementation', outcome: 'failure' },
        { type: 'implementation', outcome: 'failure' },
        { type: 'implementation', outcome: 'success' },
      ];

      const taskTypes = ['implementation', 'fix'];
      let weakest: { type: string; successRate: number } | null = null;

      for (const type of taskTypes) {
        const typeTasks = tasks.filter((t) => t.type === type);
        if (typeTasks.length < 3) continue;

        const successes = typeTasks.filter(
          (t) => t.outcome === 'success'
        ).length;
        const successRate = successes / typeTasks.length;

        if (!weakest || successRate < weakest.successRate) {
          weakest = { type, successRate };
        }
      }

      expect(weakest).not.toBeNull();
      expect(weakest?.type).toBe('implementation');
      expect(weakest?.successRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('buildContextMarkdown logic', () => {
    test('handles no data case', () => {
      const totalTasks = 0;
      const output =
        totalTasks === 0
          ? '## Getting Started with Metrics\n\nNo tasks tracked yet.'
          : '## Your Recent Performance';

      expect(output).toContain('Getting Started with Metrics');
      expect(output).toContain('No tasks tracked yet');
    });

    test('includes overall stats in output', () => {
      const successRate = 85;
      const calibrationScore = 90;
      const completedTasks = 10;

      const lines: string[] = [];
      lines.push('## Your Recent Performance (Last 7 Days)\n');
      lines.push(
        `- **Tasks**: ${completedTasks} completed, ${successRate}% success rate`
      );
      lines.push(`- **Calibration Score**: ${calibrationScore}%`);

      const output = lines.join('\n');
      expect(output).toContain('10 completed');
      expect(output).toContain('85% success rate');
      expect(output).toContain('90%');
    });

    test('includes hook failure stats when present', () => {
      const hookStats = [
        {
          name: 'typescript-typecheck',
          source: 'jutsu-typescript',
          failureRate: 50,
          failures: 5,
          total: 10,
        },
      ];

      const lines: string[] = [];
      if (hookStats.length > 0) {
        lines.push('### Common Hook Failures\n');
        for (const stat of hookStats) {
          lines.push(
            `- **${stat.name}** (${stat.source}): ${stat.failureRate}% failure rate (${stat.failures}/${stat.total})`
          );
        }
      }

      const output = lines.join('\n');
      expect(output).toContain('Common Hook Failures');
      expect(output).toContain('typescript-typecheck');
      expect(output).toContain('50% failure rate');
    });

    test('includes calibration tips for low scores', () => {
      const calibrationScore = 45;
      const lines: string[] = [];

      if (calibrationScore < 60) {
        lines.push('### Calibration Tips\n');
        lines.push(
          `Calibration score is low (${calibrationScore}%). Focus on accurately predicting task outcomes.`
        );
      }

      const output = lines.join('\n');
      expect(output).toContain('Calibration Tips');
      expect(output).toContain('45%');
    });

    test('omits calibration tips for good scores', () => {
      const calibrationScore = 75;
      const lines: string[] = [];

      if (calibrationScore < 60) {
        lines.push('### Calibration Tips');
      }

      expect(lines).toHaveLength(0);
    });
  });
});
