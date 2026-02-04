/**
 * Tests for exported helper functions in shared.ts
 * These are pure functions that can be tested without file system side effects
 */
import { afterEach, describe, expect, test } from 'bun:test';

import {
  getSettingsFilename,
  parsePluginRecommendations,
} from '../lib/shared/index.ts';

describe('shared.ts helper functions', () => {
  describe('getSettingsFilename', () => {
    const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;

    afterEach(() => {
      if (originalConfigDir) {
        process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    });

    test('returns user settings path with default config dir', () => {
      delete process.env.CLAUDE_CONFIG_DIR;
      expect(getSettingsFilename('user')).toBe('~/.claude/settings.json');
    });

    test('returns user settings path with custom config dir', () => {
      process.env.CLAUDE_CONFIG_DIR = '/custom/config';
      expect(getSettingsFilename('user')).toBe('/custom/config/settings.json');
    });

    test('returns project settings path', () => {
      expect(getSettingsFilename('project')).toBe('.claude/settings.json');
    });

    test('returns local settings path', () => {
      expect(getSettingsFilename('local')).toBe('.claude/settings.local.json');
    });
  });

  describe('parsePluginRecommendations', () => {
    test('parses JSON array response', () => {
      const content =
        'Based on the analysis, I recommend: ["jutsu-typescript", "jutsu-biome"]';
      const result = parsePluginRecommendations(content);
      expect(result).toContain('jutsu-typescript');
      expect(result).toContain('jutsu-biome');
      expect(result).toContain('bushido'); // Always included
    });

    test('always includes bushido in JSON response', () => {
      const content = '["jutsu-bun"]';
      const result = parsePluginRecommendations(content);
      expect(result).toContain('jutsu-bun');
      expect(result).toContain('bushido');
    });

    test('deduplicates plugins in JSON response', () => {
      const content = '["jutsu-typescript", "jutsu-typescript", "bushido"]';
      const result = parsePluginRecommendations(content);
      const typescriptCount = result.filter(
        (p) => p === 'jutsu-typescript'
      ).length;
      const bushidoCount = result.filter((p) => p === 'bushido').length;
      expect(typescriptCount).toBe(1);
      expect(bushidoCount).toBe(1);
    });

    test('falls back to regex matching for non-JSON text', () => {
      const content =
        'I recommend installing jutsu-typescript for type checking and hashi-github for GitHub integration.';
      const result = parsePluginRecommendations(content);
      expect(result).toContain('jutsu-typescript');
      expect(result).toContain('hashi-github');
      expect(result).toContain('bushido');
    });

    test('matches do plugins via regex', () => {
      const content = 'You should use do-testing for better test coverage.';
      const result = parsePluginRecommendations(content);
      expect(result).toContain('do-testing');
      expect(result).toContain('bushido');
    });

    test('returns only bushido when no plugins found', () => {
      const content = 'I have no plugin recommendations for this project.';
      const result = parsePluginRecommendations(content);
      expect(result).toEqual(['bushido']);
    });

    test('handles empty string', () => {
      expect(parsePluginRecommendations('')).toEqual(['bushido']);
    });

    test('handles malformed JSON gracefully', () => {
      const content = '[broken json';
      const result = parsePluginRecommendations(content);
      // Should fall back to regex and return bushido
      expect(result).toContain('bushido');
    });

    test('handles JSON with non-string elements', () => {
      const content = '["jutsu-typescript", 123, null, "jutsu-biome"]';
      const result = parsePluginRecommendations(content);
      expect(result).toContain('jutsu-typescript');
      expect(result).toContain('jutsu-biome');
      expect(result).toContain('bushido');
      // Should filter out non-strings
      expect(result).not.toContain('123');
      expect(result).not.toContain(null);
    });

    test('matches bushido directly in content', () => {
      const content = 'You should definitely install bushido for principles.';
      const result = parsePluginRecommendations(content);
      expect(result).toContain('bushido');
    });

    test('handles multiple mentions of same plugin in text', () => {
      const content =
        'jutsu-typescript is great. Use jutsu-typescript for types.';
      const result = parsePluginRecommendations(content);
      const count = result.filter((p) => p === 'jutsu-typescript').length;
      expect(count).toBe(1);
    });

    test('matches plugin names with hyphens correctly', () => {
      const content =
        'Install jutsu-git-storytelling and hashi-playwright-mcp.';
      const result = parsePluginRecommendations(content);
      expect(result).toContain('jutsu-git-storytelling');
      expect(result).toContain('hashi-playwright-mcp');
    });

    test('handles JSON array with whitespace', () => {
      const content = `[
				"jutsu-typescript",
				"jutsu-biome"
			]`;
      const result = parsePluginRecommendations(content);
      expect(result).toContain('jutsu-typescript');
      expect(result).toContain('jutsu-biome');
      expect(result).toContain('bushido');
    });

    test('handles JSON embedded in markdown', () => {
      const content = `
## Recommendations

Here are my recommendations:

\`\`\`json
["jutsu-typescript", "hashi-github"]
\`\`\`

These will help your project.`;
      const result = parsePluginRecommendations(content);
      expect(result).toContain('jutsu-typescript');
      expect(result).toContain('hashi-github');
      expect(result).toContain('bushido');
    });
  });
});
