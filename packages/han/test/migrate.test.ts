/**
 * Tests for plugin name migration
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getSettingsFilePaths,
  isOldPluginName,
  migratePluginNames,
  migrateSettingsFile,
  migrateYamlConfigFile,
} from '../lib/migrate.ts';

// Use a temp directory for tests
const TEST_DIR = join(import.meta.dir, '.test-migrate-temp');
const TEST_HOME = join(TEST_DIR, 'home');
const TEST_PROJECT = join(TEST_DIR, 'project');

// Save and restore original env
let originalHome: string | undefined;
let originalConfigDir: string | undefined;

beforeEach(() => {
  // Create test directories
  mkdirSync(join(TEST_HOME, '.claude'), { recursive: true });
  mkdirSync(join(TEST_PROJECT, '.claude'), { recursive: true });

  // Override env vars for test isolation
  originalHome = process.env.HOME;
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
  process.env.HOME = TEST_HOME;
  process.env.CLAUDE_CONFIG_DIR = join(TEST_HOME, '.claude');
});

afterEach(() => {
  // Restore original env
  process.env.HOME = originalHome;
  process.env.CLAUDE_CONFIG_DIR = originalConfigDir;

  // Clean up test directory
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('isOldPluginName', () => {
  test('should identify old jutsu plugin names', () => {
    expect(isOldPluginName('jutsu-typescript')).toBe(true);
    expect(isOldPluginName('jutsu-python')).toBe(true);
    expect(isOldPluginName('jutsu-react')).toBe(true);
  });

  test('should identify old do plugin names', () => {
    expect(isOldPluginName('do-frontend-development')).toBe(true);
    expect(isOldPluginName('do-backend-development')).toBe(true);
    expect(isOldPluginName('do-architecture')).toBe(true);
  });

  test('should identify old hashi plugin names', () => {
    expect(isOldPluginName('hashi-github')).toBe(true);
    expect(isOldPluginName('hashi-gitlab')).toBe(true);
    expect(isOldPluginName('hashi-blueprints')).toBe(true);
  });

  test('should return false for short names', () => {
    expect(isOldPluginName('typescript')).toBe(false);
    expect(isOldPluginName('react')).toBe(false);
    expect(isOldPluginName('github')).toBe(false);
  });

  test('should return false for unknown names', () => {
    expect(isOldPluginName('unknown-plugin')).toBe(false);
    expect(isOldPluginName('my-custom-plugin')).toBe(false);
  });

  test('should be case-insensitive', () => {
    expect(isOldPluginName('JUTSU-TYPESCRIPT')).toBe(true);
    expect(isOldPluginName('Jutsu-TypeScript')).toBe(true);
  });
});

describe('migrateSettingsFile', () => {
  test('should migrate old plugin names in enabledPlugins', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      enabledPlugins: {
        'jutsu-typescript@han': true,
        'jutsu-react@han': true,
        'bushido@han': true,
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const result = migrateSettingsFile(settingsPath);

    expect(result.modified).toBe(true);
    expect(result.migratedPlugins).toHaveLength(2);
    expect(result.migratedPlugins).toContainEqual({
      oldName: 'jutsu-typescript@han',
      newName: 'typescript@han',
    });
    expect(result.migratedPlugins).toContainEqual({
      oldName: 'jutsu-react@han',
      newName: 'react@han',
    });

    // Verify file was updated
    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.enabledPlugins['typescript@han']).toBe(true);
    expect(updated.enabledPlugins['react@han']).toBe(true);
    expect(updated.enabledPlugins['bushido@han']).toBe(true);
    expect(updated.enabledPlugins['jutsu-typescript@han']).toBeUndefined();
  });

  test('should migrate reserved-name plugins to their new names', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      enabledPlugins: {
        'claude-agent-sdk@han': true,
        'claude-plugin-development@han': true,
        'jutsu-claude-agent-sdk@han': true,
        'do-claude-plugin-development@han': true,
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const result = migrateSettingsFile(settingsPath);

    expect(result.modified).toBe(true);
    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.enabledPlugins['agent-sdk@han']).toBe(true);
    expect(updated.enabledPlugins['plugin-authoring@han']).toBe(true);
    expect(updated.enabledPlugins['claude-agent-sdk@han']).toBeUndefined();
    expect(
      updated.enabledPlugins['claude-plugin-development@han']
    ).toBeUndefined();
    expect(
      updated.enabledPlugins['jutsu-claude-agent-sdk@han']
    ).toBeUndefined();
    expect(
      updated.enabledPlugins['do-claude-plugin-development@han']
    ).toBeUndefined();
  });

  test('preserves conflicting enabled states regardless of key order', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    for (const entries of [
      [
        ['claude-agent-sdk@han', false],
        ['agent-sdk@han', true],
      ],
      [
        ['agent-sdk@han', true],
        ['claude-agent-sdk@han', false],
      ],
      [
        ['CLAUDE-AGENT-SDK@han', false],
        ['jutsu-claude-agent-sdk@han', true],
      ],
    ] as Array<Array<[string, boolean]>>) {
      const enabledPlugins = Object.fromEntries(entries);
      writeFileSync(settingsPath, JSON.stringify({ enabledPlugins }));
      const result = migrateSettingsFile(settingsPath);
      expect(result.modified).toBe(false);
      expect(result.error).toContain('Conflicting settings for agent-sdk@han');
      expect(
        JSON.parse(readFileSync(settingsPath, 'utf-8')).enabledPlugins
      ).toEqual(enabledPlugins);
      expect(migrateSettingsFile(settingsPath).modified).toBe(false);
    }
  });

  test('migrates matching disabled aliases and leaves canonical disabled', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    writeFileSync(
      settingsPath,
      JSON.stringify({
        enabledPlugins: {
          'CLAUDE-AGENT-SDK@han': false,
          'jutsu-claude-agent-sdk@han': false,
          'agent-sdk@han': false,
        },
      })
    );
    expect(migrateSettingsFile(settingsPath).modified).toBe(true);
    expect(
      JSON.parse(readFileSync(settingsPath, 'utf-8')).enabledPlugins
    ).toEqual({
      'agent-sdk@han': false,
    });
    expect(migrateSettingsFile(settingsPath).modified).toBe(false);
  });

  test('migrates reserved names in all settings scopes and permissions', () => {
    const paths = [
      join(TEST_HOME, '.claude', 'settings.json'),
      join(TEST_PROJECT, '.claude', 'settings.json'),
      join(TEST_PROJECT, '.claude', 'settings.local.json'),
    ];
    for (const path of paths) {
      writeFileSync(
        path,
        JSON.stringify({
          enabledPlugins: { 'claude-plugin-development@han': false },
          permissions: {
            allow: ['claude-agent-sdk@han'],
            deny: ['do-claude-plugin-development@han'],
          },
        })
      );
    }
    expect(
      migratePluginNames(TEST_PROJECT).filter((result) => result.modified)
    ).toHaveLength(3);
    for (const path of paths) {
      const settings = JSON.parse(readFileSync(path, 'utf-8'));
      expect(settings.enabledPlugins).toEqual({
        'plugin-authoring@han': false,
      });
      expect(settings.permissions).toEqual({
        allow: ['agent-sdk@han'],
        deny: ['plugin-authoring@han'],
      });
    }
    expect(
      migratePluginNames(TEST_PROJECT).every((result) => !result.modified)
    ).toBe(true);
  });

  test('should migrate old plugin names in permissions.allow', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      permissions: {
        allow: [
          'jutsu-typescript@han',
          'do-frontend-development@han',
          'some-other-tool',
        ],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const result = migrateSettingsFile(settingsPath);

    expect(result.modified).toBe(true);
    expect(result.migratedPlugins).toHaveLength(2);

    // Verify file was updated
    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.permissions.allow).toContain('typescript@han');
    // do-frontend-development maps to disciplines/frontend-development, so short name is "frontend-development"
    expect(updated.permissions.allow).toContain('frontend-development@han');
    expect(updated.permissions.allow).toContain('some-other-tool');
    expect(updated.permissions.allow).not.toContain('jutsu-typescript@han');
  });

  test('should migrate old plugin names in permissions.deny', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      permissions: {
        deny: ['hashi-github@han', 'jutsu-python@han'],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const result = migrateSettingsFile(settingsPath);

    expect(result.modified).toBe(true);

    // Verify file was updated
    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.permissions.deny).toContain('github@han');
    expect(updated.permissions.deny).toContain('python@han');
  });

  test('should not modify file if no migration needed', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      enabledPlugins: {
        'typescript@han': true,
        'react@han': true,
      },
      permissions: {
        allow: ['python@han'],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const result = migrateSettingsFile(settingsPath);

    expect(result.modified).toBe(false);
    expect(result.migratedPlugins).toHaveLength(0);
  });

  test('preserves colliding YAML mappings and migrates non-colliding keys', () => {
    for (const [filename, prefix] of [
      ['han.yml', 'plugins:\n'],
      ['han-config.yml', ''],
    ]) {
      const path = join(TEST_PROJECT, filename);
      const indent = prefix ? '  ' : '';
      const content = `${prefix}${indent}claude-agent-sdk:\n${indent}  enabled: false\n${indent}agent-sdk:\n${indent}  enabled: true\n${indent}claude-plugin-development:\n${indent}  enabled: false\n`;
      writeFileSync(path, content);
      const result = migrateYamlConfigFile(path);
      expect(result.modified).toBe(true);
      expect(result.error).toContain('Conflicting YAML keys for agent-sdk');
      const migrated = readFileSync(path, 'utf-8');
      expect(migrated).toContain('claude-agent-sdk:');
      expect(migrated).toContain('agent-sdk:');
      expect(migrated).toContain('plugin-authoring:');
      expect(migrated).toContain('enabled: false');
      expect(migrateYamlConfigFile(path).modified).toBe(false);
      expect(readFileSync(path, 'utf-8')).toBe(migrated);
    }
  });

  test('preserves two YAML aliases targeting the same plugin', () => {
    const path = join(TEST_PROJECT, 'han.yml');
    const content =
      'plugins:\n  CLAUDE-AGENT-SDK:\n    enabled: false\n  jutsu-claude-agent-sdk:\n    enabled: true\n';
    writeFileSync(path, content);
    const result = migrateYamlConfigFile(path);
    expect(result.modified).toBe(false);
    expect(result.error).toContain('Conflicting YAML keys for agent-sdk');
    expect(readFileSync(path, 'utf-8')).toBe(content);
  });

  test('should return empty result for non-existent file', () => {
    const result = migrateSettingsFile('/non/existent/path.json');

    expect(result.modified).toBe(false);
    expect(result.migratedPlugins).toHaveLength(0);
  });

  test('should preserve other settings fields', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      enabledPlugins: {
        'jutsu-typescript@han': true,
      },
      mcpServers: {
        myServer: { command: 'node', args: ['server.js'] },
      },
      extraKnownMarketplaces: {
        han: { source: { source: 'github', repo: 'test/repo' } },
      },
      customField: 'value',
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    migrateSettingsFile(settingsPath);

    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.mcpServers).toEqual(settings.mcpServers);
    expect(updated.extraKnownMarketplaces).toEqual(
      settings.extraKnownMarketplaces
    );
    expect(updated.customField).toBe('value');
  });
});

describe('migratePluginNames (idempotency)', () => {
  test('should be idempotent - running twice produces same result', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      enabledPlugins: {
        'jutsu-typescript@han': true,
        'jutsu-react@han': true,
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // First migration
    const firstResults = migratePluginNames();
    expect(firstResults.some((r) => r.modified)).toBe(true);

    // Read the state after first migration
    const afterFirst = readFileSync(settingsPath, 'utf-8');

    // Second migration
    const secondResults = migratePluginNames();
    expect(secondResults.every((r) => !r.modified)).toBe(true);
    expect(secondResults.every((r) => r.migratedPlugins.length === 0)).toBe(
      true
    );

    // Verify file wasn't changed
    const afterSecond = readFileSync(settingsPath, 'utf-8');
    expect(afterSecond).toBe(afterFirst);
  });

  test('should handle mixed old and new names', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    const settings = {
      enabledPlugins: {
        'jutsu-typescript@han': true,
        'react@han': true, // Already migrated
        'bushido@han': true, // Never had a prefix
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const results = migratePluginNames();
    const migrated = results.flatMap((r) => r.migratedPlugins);

    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toEqual({
      oldName: 'jutsu-typescript@han',
      newName: 'typescript@han',
    });

    const updated = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(updated.enabledPlugins).toEqual({
      'typescript@han': true,
      'react@han': true,
      'bushido@han': true,
    });
  });
});

describe('getSettingsFilePaths', () => {
  test('should include user settings path', () => {
    const paths = getSettingsFilePaths();
    const userPath = join(TEST_HOME, '.claude', 'settings.json');
    expect(paths).toContain(userPath);
  });

  test('should include project settings paths when project path provided', () => {
    const paths = getSettingsFilePaths(TEST_PROJECT);
    expect(paths).toContain(join(TEST_PROJECT, '.claude', 'settings.json'));
    expect(paths).toContain(
      join(TEST_PROJECT, '.claude', 'settings.local.json')
    );
  });

  test('should only include user settings when no project path', () => {
    const paths = getSettingsFilePaths();
    expect(paths).toHaveLength(1);
  });
});

describe('migration integration', () => {
  test('should migrate all settings files at once', () => {
    // Create user settings with old names
    const userSettingsPath = join(TEST_HOME, '.claude', 'settings.json');
    writeFileSync(
      userSettingsPath,
      JSON.stringify({
        enabledPlugins: {
          'jutsu-typescript@han': true,
        },
      })
    );

    // Create project settings with old names
    const projectSettingsPath = join(TEST_PROJECT, '.claude', 'settings.json');
    writeFileSync(
      projectSettingsPath,
      JSON.stringify({
        enabledPlugins: {
          'do-frontend-development@han': true,
        },
      })
    );

    // Migrate all
    const results = migratePluginNames(TEST_PROJECT);

    // Both files should be migrated
    const modifiedResults = results.filter((r) => r.modified);
    expect(modifiedResults).toHaveLength(2);

    // Verify user settings
    const userUpdated = JSON.parse(readFileSync(userSettingsPath, 'utf-8'));
    expect(userUpdated.enabledPlugins['typescript@han']).toBe(true);

    // Verify project settings
    // do-frontend-development maps to disciplines/frontend-development, so short name is "frontend-development"
    const projectUpdated = JSON.parse(
      readFileSync(projectSettingsPath, 'utf-8')
    );
    expect(projectUpdated.enabledPlugins['frontend-development@han']).toBe(
      true
    );
  });

  test('should handle empty settings files gracefully', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    writeFileSync(settingsPath, '{}');

    const results = migratePluginNames();

    expect(results[0].modified).toBe(false);
    expect(results[0].error).toBeUndefined();
  });

  test('should handle invalid JSON gracefully', () => {
    const settingsPath = join(TEST_HOME, '.claude', 'settings.json');
    writeFileSync(settingsPath, 'not valid json');

    const results = migratePluginNames();

    // Should not throw, just return empty result
    expect(results[0].modified).toBe(false);
  });
});
