/**
 * Tests for exported helper functions in mcp/tools.ts
 * These are pure functions that can be tested without side effects
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  findPluginInMarketplace,
  generateToolDescription,
  resolvePathToAbsolute,
} from '../lib/commands/mcp/tools.ts';
import type { PluginConfig } from '../lib/hooks/index.ts';

describe('mcp/tools.ts helper functions', () => {
  describe('resolvePathToAbsolute', () => {
    const originalCwd = process.cwd;

    afterEach(() => {
      process.cwd = originalCwd;
    });

    test('returns absolute path unchanged', () => {
      const result = resolvePathToAbsolute('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    test('resolves relative path against cwd', () => {
      process.cwd = () => '/home/user/project';
      const result = resolvePathToAbsolute('relative/path');
      expect(result).toBe('/home/user/project/relative/path');
    });

    test('resolves single filename', () => {
      process.cwd = () => '/tmp';
      const result = resolvePathToAbsolute('file.txt');
      expect(result).toBe('/tmp/file.txt');
    });

    test('resolves dot-prefixed relative path', () => {
      process.cwd = () => '/home/user';
      const result = resolvePathToAbsolute('./src/index.ts');
      // join() normalizes the path, removing the ./
      expect(result).toBe('/home/user/src/index.ts');
    });

    test('handles empty relative path', () => {
      process.cwd = () => '/project';
      const result = resolvePathToAbsolute('');
      expect(result).toBe('/project');
    });
  });

  describe('findPluginInMarketplace', () => {
    let testDir: string;

    beforeEach(() => {
      const random = Math.random().toString(36).substring(2, 9);
      testDir = join(tmpdir(), `han-find-plugin-test-${Date.now()}-${random}`);
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (testDir && existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    test('returns null when plugin not found', () => {
      const result = findPluginInMarketplace(testDir, 'nonexistent');
      expect(result).toBeNull();
    });

    test('finds plugin in jutsu directory', () => {
      const jutsuPath = join(testDir, 'jutsu', 'jutsu-typescript');
      mkdirSync(jutsuPath, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'jutsu-typescript');
      expect(result).toBe(jutsuPath);
    });

    test('finds plugin in do directory', () => {
      const doPath = join(testDir, 'do', 'do-accessibility');
      mkdirSync(doPath, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'do-accessibility');
      expect(result).toBe(doPath);
    });

    test('finds plugin in hashi directory', () => {
      const hashiPath = join(testDir, 'hashi', 'hashi-github');
      mkdirSync(hashiPath, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'hashi-github');
      expect(result).toBe(hashiPath);
    });

    test('finds plugin at root level', () => {
      const rootPath = join(testDir, 'core');
      mkdirSync(rootPath, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'core');
      expect(result).toBe(rootPath);
    });

    test('prefers jutsu over root', () => {
      // Create both jutsu and root paths
      const jutsuPath = join(testDir, 'jutsu', 'my-plugin');
      const rootPath = join(testDir, 'my-plugin');
      mkdirSync(jutsuPath, { recursive: true });
      mkdirSync(rootPath, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'my-plugin');
      expect(result).toBe(jutsuPath);
    });

    test('handles marketplace root that does not exist', () => {
      const result = findPluginInMarketplace(
        '/nonexistent/marketplace',
        'any-plugin'
      );
      expect(result).toBeNull();
    });
  });

  describe('generateToolDescription', () => {
    function createPluginConfig(
      hooks: Record<string, { command?: string; dirsWith?: string[] }>
    ): PluginConfig {
      return {
        name: 'test-plugin',
        hooks,
      } as PluginConfig;
    }

    test('generates test hook description', () => {
      const config = createPluginConfig({
        test: { command: 'npm test' },
      });
      const result = generateToolDescription('jutsu-bun', 'test', config);

      expect(result).toContain('Run');
      expect(result).toContain('tests');
      expect(result).toContain('Triggers:');
      expect(result).toContain('npm test');
    });

    test('generates lint hook description', () => {
      const config = createPluginConfig({
        lint: { command: 'npx biome check' },
      });
      const result = generateToolDescription('jutsu-biome', 'lint', config);

      expect(result).toContain('Lint');
      expect(result).toContain('issues');
      expect(result).toContain('npx biome check');
    });

    test('generates typecheck hook description', () => {
      const config = createPluginConfig({
        typecheck: { command: 'tsc' },
      });
      const result = generateToolDescription(
        'jutsu-typescript',
        'typecheck',
        config
      );

      expect(result).toContain('Type-check');
      expect(result).toContain('type errors');
    });

    test('generates format hook description', () => {
      const config = createPluginConfig({
        format: { command: 'prettier --check' },
      });
      const result = generateToolDescription(
        'jutsu-prettier',
        'format',
        config
      );

      expect(result).toContain('format');
      expect(result).toContain('Triggers:');
    });

    test('generates build hook description', () => {
      const config = createPluginConfig({
        build: { command: 'npm run build' },
      });
      const result = generateToolDescription('jutsu-bun', 'build', config);

      expect(result).toContain('Build');
      expect(result).toContain('project');
    });

    test('generates compile hook description', () => {
      const config = createPluginConfig({
        compile: { command: 'go build' },
      });
      const result = generateToolDescription('jutsu-go', 'compile', config);

      expect(result).toContain('Compile');
    });

    test('generates generic description for unknown hook', () => {
      const config = createPluginConfig({
        custom: { command: 'custom-command' },
      });
      const result = generateToolDescription('jutsu-custom', 'custom', config);

      expect(result).toContain('Run custom');
      expect(result).toContain('Triggers:');
    });

    test('includes dirsWith information when present', () => {
      const config = createPluginConfig({
        test: {
          command: 'npm test',
          dirsWith: ['package.json', 'bun.lock'],
        },
      });
      const result = generateToolDescription('jutsu-bun', 'test', config);

      expect(result).toContain('Runs in directories containing:');
      expect(result).toContain('package.json');
      expect(result).toContain('bun.lock');
    });

    test('strips jutsu- prefix for display name', () => {
      const config = createPluginConfig({
        test: { command: 'test' },
      });
      const result = generateToolDescription(
        'jutsu-typescript',
        'test',
        config
      );

      expect(result).toContain('Typescript');
      expect(result).not.toContain('jutsu-typescript');
    });

    test('strips do- prefix for display name', () => {
      const config = createPluginConfig({
        custom: { command: 'test' },
      });
      const result = generateToolDescription(
        'do-accessibility',
        'custom',
        config
      );

      expect(result).toContain('Accessibility');
    });

    test('strips hashi- prefix for display name', () => {
      const config = createPluginConfig({
        custom: { command: 'test' },
      });
      const result = generateToolDescription('hashi-github', 'custom', config);

      expect(result).toContain('Github');
    });

    test('capitalizes technology name', () => {
      const config = createPluginConfig({
        test: { command: 'test' },
      });
      const result = generateToolDescription('jutsu-bun', 'test', config);

      expect(result).toContain('Bun');
    });

    test('handles plugin with no command', () => {
      const config = createPluginConfig({
        test: {},
      });
      const result = generateToolDescription('jutsu-bun', 'test', config);

      // Should still generate a description
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain('Command:');
    });

    test('handles plugin with empty dirsWith', () => {
      const config = createPluginConfig({
        test: { command: 'test', dirsWith: [] },
      });
      const result = generateToolDescription('jutsu-bun', 'test', config);

      expect(result).not.toContain('Runs in directories containing:');
    });
  });
});
