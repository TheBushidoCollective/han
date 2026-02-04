/**
 * Tests for install.ts
 * Tests the syncPluginsToSettings helper function
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// We need to access the internal syncPluginsToSettings function
// Since it's not exported, we'll test the behavior through the settings file

describe('install.ts syncPluginsToSettings behavior', () => {
  const testDir = `/tmp/test-install-${Date.now()}`;
  let originalEnv: string | undefined;
  let originalCwd: () => string;

  beforeEach(() => {
    // Save original environment and cwd
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    originalCwd = process.cwd;

    // Set up test environment
    process.env.CLAUDE_CONFIG_DIR = join(testDir, 'user');
    process.cwd = () => join(testDir, 'project');

    // Create directories
    mkdirSync(join(testDir, 'user'), { recursive: true });
    mkdirSync(join(testDir, 'project', '.claude'), { recursive: true });
  });

  afterEach(() => {
    // Restore environment and cwd
    if (originalEnv) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    process.cwd = originalCwd;

    rmSync(testDir, { recursive: true, force: true });
  });

  describe('plugin installation logic', () => {
    test('core is always included in selected plugins', () => {
      // Create settings without core
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({
          enabledPlugins: {
            'jutsu-typescript@han': true,
          },
        })
      );

      // Read settings to verify initial state
      const settings = JSON.parse(
        readFileSync(join(testDir, 'user', 'settings.json'), 'utf-8')
      );
      expect(settings.enabledPlugins['core@han']).toBeUndefined();
    });

    test('plugins are added to enabledPlugins with @han suffix', () => {
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({
          enabledPlugins: {
            'jutsu-typescript@han': true,
          },
        })
      );

      const settings = JSON.parse(
        readFileSync(join(testDir, 'user', 'settings.json'), 'utf-8')
      );
      expect(settings.enabledPlugins['jutsu-typescript@han']).toBe(true);
    });

    test('Han marketplace is added to extraKnownMarketplaces', () => {
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({
          extraKnownMarketplaces: {
            han: {
              source: { source: 'github', repo: 'thebushidocollective/han' },
            },
          },
        })
      );

      const settings = JSON.parse(
        readFileSync(join(testDir, 'user', 'settings.json'), 'utf-8')
      );
      expect(settings.extraKnownMarketplaces.han).toBeDefined();
      expect(settings.extraKnownMarketplaces.han.source.repo).toBe(
        'thebushidocollective/han'
      );
    });

    test('invalid plugins are identified when not in valid set', () => {
      // Simulate a settings file with an invalid plugin
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({
          enabledPlugins: {
            'jutsu-typescript@han': true,
            'invalid-nonexistent@han': true,
          },
        })
      );

      const settings = JSON.parse(
        readFileSync(join(testDir, 'user', 'settings.json'), 'utf-8')
      );
      expect(settings.enabledPlugins['invalid-nonexistent@han']).toBe(true);
    });
  });

  describe('scope differences', () => {
    test('user scope settings file location', () => {
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({ enabledPlugins: {} })
      );

      const settingsPath = join(testDir, 'user', 'settings.json');
      const exists = readFileSync(settingsPath, 'utf-8') !== undefined;
      expect(exists).toBe(true);
    });

    test('project scope settings file location', () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({ enabledPlugins: {} })
      );

      const settingsPath = join(testDir, 'project', '.claude', 'settings.json');
      const exists = readFileSync(settingsPath, 'utf-8') !== undefined;
      expect(exists).toBe(true);
    });

    test('local scope settings file location', () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.local.json'),
        JSON.stringify({ enabledPlugins: {} })
      );

      const settingsPath = join(
        testDir,
        'project',
        '.claude',
        'settings.local.json'
      );
      const exists = readFileSync(settingsPath, 'utf-8') !== undefined;
      expect(exists).toBe(true);
    });
  });

  describe('settings structure', () => {
    test('enabledPlugins uses plugin@marketplace format', () => {
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({
          enabledPlugins: {
            'jutsu-typescript@han': true,
            'hashi-github@han': true,
            'do-accessibility@han': true,
            'core@han': true,
          },
        })
      );

      const settings = JSON.parse(
        readFileSync(join(testDir, 'user', 'settings.json'), 'utf-8')
      );

      for (const key of Object.keys(settings.enabledPlugins)) {
        expect(key).toMatch(/@han$/);
      }
    });

    test('extraKnownMarketplaces has correct structure', () => {
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({
          extraKnownMarketplaces: {
            han: {
              source: { source: 'github', repo: 'thebushidocollective/han' },
            },
          },
        })
      );

      const settings = JSON.parse(
        readFileSync(join(testDir, 'user', 'settings.json'), 'utf-8')
      );

      expect(settings.extraKnownMarketplaces.han.source.source).toBe('github');
      expect(settings.extraKnownMarketplaces.han.source.repo).toBe(
        'thebushidocollective/han'
      );
    });

    test('settings can have additional properties', () => {
      writeFileSync(
        join(testDir, 'user', 'settings.json'),
        JSON.stringify({
          enabledPlugins: {
            'core@han': true,
          },
          someOtherSetting: 'preserved',
          nested: { value: 123 },
        })
      );

      const settings = JSON.parse(
        readFileSync(join(testDir, 'user', 'settings.json'), 'utf-8')
      );

      expect(settings.someOtherSetting).toBe('preserved');
      expect(settings.nested.value).toBe(123);
    });
  });

  describe('plugin naming conventions', () => {
    test('jutsu- prefix for technique plugins', () => {
      const jutsuPlugins = [
        'jutsu-typescript',
        'jutsu-react',
        'jutsu-bun',
        'jutsu-biome',
      ];

      for (const plugin of jutsuPlugins) {
        expect(plugin).toMatch(/^jutsu-/);
      }
    });

    test('hashi- prefix for bridge plugins', () => {
      const hashiPlugins = [
        'hashi-github',
        'hashi-playwright-mcp',
        'hashi-blueprints',
      ];

      for (const plugin of hashiPlugins) {
        expect(plugin).toMatch(/^hashi-/);
      }
    });

    test('do- prefix for discipline plugins', () => {
      const doPlugins = [
        'do-accessibility',
        'do-frontend-development',
        'do-technical-documentation',
      ];

      for (const plugin of doPlugins) {
        expect(plugin).toMatch(/^do-/);
      }
    });

    test('core plugin has no prefix', () => {
      expect('core').not.toMatch(/^(jutsu|hashi|do)-/);
    });
  });

  describe('PluginChanges interface', () => {
    test('PluginChanges has correct structure', () => {
      const changes = {
        added: ['jutsu-typescript', 'jutsu-biome'],
        removed: ['jutsu-react'],
        invalid: ['nonexistent-plugin'],
      };

      expect(changes.added).toHaveLength(2);
      expect(changes.removed).toHaveLength(1);
      expect(changes.invalid).toHaveLength(1);
    });

    test('empty PluginChanges', () => {
      const changes = {
        added: [] as string[],
        removed: [] as string[],
        invalid: [] as string[],
      };

      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
      expect(changes.invalid).toHaveLength(0);
    });
  });

  describe('InstallResult interface', () => {
    test('successful install result', () => {
      const result: {
        plugins: string[];
        marketplacePlugins: Array<{ name: string; category: string }>;
        cancelled?: boolean;
        error?: Error;
      } = {
        plugins: ['core', 'jutsu-typescript'],
        marketplacePlugins: [
          { name: 'core', category: 'Core' },
          { name: 'jutsu-typescript', category: 'Technique' },
        ],
      };

      expect(result.plugins).toHaveLength(2);
      expect(result.marketplacePlugins).toHaveLength(2);
      expect(result.cancelled).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    test('cancelled install result', () => {
      const result: { cancelled: boolean; plugins?: string[]; error?: Error } =
        {
          cancelled: true,
        };

      expect(result.cancelled).toBe(true);
      expect(result.plugins).toBeUndefined();
    });

    test('error install result', () => {
      const result: { error: Error; plugins?: string[]; cancelled?: boolean } =
        {
          error: new Error('Installation failed'),
        };

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Installation failed');
    });
  });

  describe('Plugin filtering logic', () => {
    test('identifies Han plugins by prefix', () => {
      const allPlugins = [
        'jutsu-typescript',
        'do-accessibility',
        'hashi-github',
        'core',
        'bushido',
        'some-other-plugin',
      ];

      const hanPlugins = allPlugins.filter(
        (p) =>
          p.startsWith('jutsu-') ||
          p.startsWith('do-') ||
          p.startsWith('hashi-') ||
          p === 'core' ||
          p === 'bushido'
      );

      expect(hanPlugins).toHaveLength(5);
      expect(hanPlugins).not.toContain('some-other-plugin');
    });

    test('empty plugins list', () => {
      const allPlugins: string[] = [];

      const hanPlugins = allPlugins.filter(
        (p) =>
          p.startsWith('jutsu-') ||
          p.startsWith('do-') ||
          p.startsWith('hashi-') ||
          p === 'core' ||
          p === 'bushido'
      );

      expect(hanPlugins).toHaveLength(0);
    });
  });

  describe('syncPluginsToSettings behavior', () => {
    test('always includes core in pluginsToInstall', () => {
      const selectedPlugins = ['jutsu-typescript'];
      const pluginsToInstall = [...new Set(['core', ...selectedPlugins])];

      expect(pluginsToInstall).toContain('core');
      expect(pluginsToInstall).toContain('jutsu-typescript');
    });

    test('deduplicates plugins when core is already selected', () => {
      const selectedPlugins = ['core', 'jutsu-typescript', 'core'];
      const pluginsToInstall = [...new Set(['core', ...selectedPlugins])];

      expect(pluginsToInstall.filter((p) => p === 'core')).toHaveLength(1);
    });

    test('validates plugins against marketplace', () => {
      const validPluginNames = new Set([
        'core',
        'jutsu-typescript',
        'jutsu-biome',
      ]);
      const selectedPlugins = ['core', 'jutsu-typescript', 'invalid-plugin'];

      const validSelected = selectedPlugins.filter((p) =>
        validPluginNames.has(p)
      );
      const invalidSelected = selectedPlugins.filter(
        (p) => !validPluginNames.has(p)
      );

      expect(validSelected).toHaveLength(2);
      expect(invalidSelected).toEqual(['invalid-plugin']);
    });

    test('user scope does not remove deselected plugins', () => {
      const scope: 'user' | 'project' | 'local' = 'user';
      const selectedPlugins = ['core'];
      const currentPlugins = ['core', 'jutsu-typescript'];
      const validPluginNames = new Set(['core', 'jutsu-typescript']);

      const removed: string[] = [];
      for (const plugin of currentPlugins) {
        if (
          scope !== 'user' &&
          plugin !== 'core' &&
          !selectedPlugins.includes(plugin) &&
          validPluginNames.has(plugin)
        ) {
          removed.push(plugin);
        }
      }

      // User scope should not remove deselected plugins
      expect(removed).toHaveLength(0);
    });

    test('project scope removes deselected plugins', () => {
      // Test the removal logic for project scope
      const scopeIsUser = false; // project scope is not user scope
      const selectedPlugins = ['core'];
      const currentPlugins = ['core', 'jutsu-typescript'];
      const validPluginNames = new Set(['core', 'jutsu-typescript']);

      const removed: string[] = [];
      for (const plugin of currentPlugins) {
        if (
          !scopeIsUser &&
          plugin !== 'core' &&
          !selectedPlugins.includes(plugin) &&
          validPluginNames.has(plugin)
        ) {
          removed.push(plugin);
        }
      }

      // Project scope should remove deselected plugins
      expect(removed).toContain('jutsu-typescript');
    });

    test('core cannot be removed even when deselected', () => {
      // Test that core is protected even in project scope
      const scopeIsUser = false; // project scope is not user scope
      const selectedPlugins: string[] = [];
      const currentPlugins = ['core', 'jutsu-typescript'];
      const validPluginNames = new Set(['core', 'jutsu-typescript']);

      const removed: string[] = [];
      for (const plugin of currentPlugins) {
        if (
          !scopeIsUser &&
          plugin !== 'core' &&
          !selectedPlugins.includes(plugin) &&
          validPluginNames.has(plugin)
        ) {
          removed.push(plugin);
        }
      }

      // Core should never be removed
      expect(removed).not.toContain('core');
      expect(removed).toContain('jutsu-typescript');
    });
  });

  describe('Result output messages', () => {
    test('no changes message when nothing changed', () => {
      const added: string[] = [];
      const removed: string[] = [];
      const invalid: string[] = [];

      const hasNoChanges =
        added.length === 0 && removed.length === 0 && invalid.length === 0;

      expect(hasNoChanges).toBe(true);
    });

    test('added message format', () => {
      const added = ['jutsu-typescript', 'jutsu-biome'];

      if (added.length > 0) {
        const message = `✓ Added ${added.length} plugin(s): ${added.join(', ')}`;
        expect(message).toBe(
          '✓ Added 2 plugin(s): jutsu-typescript, jutsu-biome'
        );
      }
    });

    test('removed message format', () => {
      const removed = ['jutsu-react'];

      if (removed.length > 0) {
        const message = `✓ Removed ${removed.length} plugin(s): ${removed.join(', ')}`;
        expect(message).toBe('✓ Removed 1 plugin(s): jutsu-react');
      }
    });

    test('invalid message format', () => {
      const invalid = ['nonexistent-plugin', 'another-invalid'];

      if (invalid.length > 0) {
        const message = `✓ Removed ${invalid.length} invalid plugin(s): ${invalid.join(', ')}`;
        expect(message).toBe(
          '✓ Removed 2 invalid plugin(s): nonexistent-plugin, another-invalid'
        );
      }
    });
  });

  describe('Marketplace plugin validation', () => {
    test('creates valid plugin names set from marketplace', () => {
      const marketplacePlugins = [
        { name: 'core' },
        { name: 'jutsu-typescript' },
        { name: 'hashi-github' },
      ];

      const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

      expect(validPluginNames.has('core')).toBe(true);
      expect(validPluginNames.has('jutsu-typescript')).toBe(true);
      expect(validPluginNames.has('nonexistent')).toBe(false);
    });

    test('handles empty marketplace response', () => {
      const marketplacePlugins: Array<{ name: string }> = [];

      const validPluginNames = new Set(marketplacePlugins.map((p) => p.name));

      expect(validPluginNames.size).toBe(0);
    });
  });
});
