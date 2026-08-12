/**
 * Plugin directory resolution against a marketplace manifest.
 *
 * Regression cover for plugins moving under `plugins/<category>/<name>`:
 * resolution used to probe a fixed `jutsu/`, `do/`, `hashi/`, root list, which
 * matched nothing once the tree was reorganized.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearPluginDirCache,
  findPluginInMarketplace,
} from '../lib/hooks/plugin-discovery.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('findPluginInMarketplace', () => {
  let root: string;

  beforeEach(() => {
    clearPluginDirCache();
    root = `/tmp/test-plugin-discovery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    mkdirSync(join(root, '.claude-plugin'), { recursive: true });
    mkdirSync(join(root, 'plugins', 'languages', 'typescript'), {
      recursive: true,
    });
    mkdirSync(join(root, 'plugins', 'services', 'github'), { recursive: true });
    mkdirSync(join(root, 'plugins', 'disciplines', 'frontend-development'), {
      recursive: true,
    });
    writeFileSync(
      join(root, '.claude-plugin', 'marketplace.json'),
      JSON.stringify({
        name: 'test-marketplace',
        owner: { name: 'Test' },
        plugins: [
          { name: 'typescript', source: './plugins/languages/typescript' },
          {
            name: 'jutsu-typescript',
            source: './plugins/languages/typescript',
          },
          { name: 'github', source: './plugins/services/github' },
          { name: 'hashi-github', source: './plugins/services/github' },
          {
            name: 'frontend-development',
            source: './plugins/disciplines/frontend-development',
          },
          { name: 'escaper', source: '../../../etc' },
          { name: 'ghost', source: './plugins/languages/does-not-exist' },
        ],
      })
    );
  });

  afterEach(() => {
    clearPluginDirCache();
    rmSync(root, { recursive: true, force: true });
  });

  test('resolves a plugin nested under its category directory', () => {
    expect(findPluginInMarketplace(root, 'typescript')).toBe(
      join(root, 'plugins', 'languages', 'typescript')
    );
    expect(findPluginInMarketplace(root, 'frontend-development')).toBe(
      join(root, 'plugins', 'disciplines', 'frontend-development')
    );
  });

  test('resolves legacy alias names to the same directory', () => {
    expect(findPluginInMarketplace(root, 'jutsu-typescript')).toBe(
      findPluginInMarketplace(root, 'typescript')
    );
    expect(findPluginInMarketplace(root, 'hashi-github')).toBe(
      findPluginInMarketplace(root, 'github')
    );
  });

  test('rejects a source that escapes the marketplace root', () => {
    expect(findPluginInMarketplace(root, 'escaper')).toBeNull();
  });

  test('returns null for an entry whose directory is missing', () => {
    expect(findPluginInMarketplace(root, 'ghost')).toBeNull();
  });

  test('returns null for an unknown plugin', () => {
    expect(findPluginInMarketplace(root, 'nonexistent-plugin')).toBeNull();
  });

  test('finds a plugin the manifest omits by scanning the tree', () => {
    mkdirSync(join(root, 'plugins', 'tools', 'unlisted'), { recursive: true });
    writeFileSync(
      join(root, 'plugins', 'tools', 'unlisted', 'han-plugin.yml'),
      'hooks: {}\n'
    );
    clearPluginDirCache();

    expect(findPluginInMarketplace(root, 'unlisted')).toBe(
      join(root, 'plugins', 'tools', 'unlisted')
    );
  });

  test('resolves every plugin the han marketplace publishes', () => {
    const manifest = require(
      join(packageRoot, '..', '..', '.claude-plugin', 'marketplace.json')
    ) as { plugins: Array<{ name: string }> };
    const repoRoot = join(packageRoot, '..', '..');

    const unresolved = manifest.plugins
      .map((p) => p.name)
      .filter((name) => findPluginInMarketplace(repoRoot, name) === null);

    expect(unresolved).toEqual([]);
  });
});

describe('han hook dispatch recursion guard', () => {
  test('a nested dispatch exits without re-running plugin hooks', () => {
    // plugins/core registers `han hook dispatch <Event>` as one of its own
    // hooks.json entries. Without the guard the dispatcher rediscovers that
    // entry and re-execs itself.
    const result = spawnSync(
      'bun',
      [
        'run',
        join(packageRoot, 'lib/main.ts'),
        'hook',
        'dispatch',
        'ConfigChange',
      ],
      {
        encoding: 'utf-8',
        timeout: 30000,
        cwd: packageRoot,
        env: { ...process.env, HAN_DISPATCH: '1' },
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
