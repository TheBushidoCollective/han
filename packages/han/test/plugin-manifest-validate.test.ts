/**
 * Tests for plugin.json manifest validation in `han plugin validate`.
 *
 * The manifest schema tracked here is the Claude Code plugin manifest:
 * https://code.claude.com/docs/en/plugins-reference
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type ValidationIssue,
  validatePlugin,
} from '../lib/commands/plugin/validate.ts';

const PLUGIN_NAME = 'manifest-fixture';

let testDir: string;
let pluginDir: string;

beforeEach(() => {
  const random = Math.random().toString(36).substring(2, 9);
  testDir = join(tmpdir(), `han-manifest-validate-${Date.now()}-${random}`);
  pluginDir = join(testDir, PLUGIN_NAME);
  mkdirSync(join(pluginDir, '.claude-plugin'), { recursive: true });
});

afterEach(() => {
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

/** Write a plugin.json manifest and validate the fixture plugin. */
function validateManifest(manifest: unknown): ValidationIssue[] {
  writeFileSync(
    join(pluginDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify(manifest, null, 2)
  );
  return validatePlugin(pluginDir).issues;
}

function messages(issues: ValidationIssue[], type: ValidationIssue['type']) {
  return issues.filter((i) => i.type === type).map((i) => i.message);
}

describe('plugin.json manifest validation', () => {
  test('a complete recognized manifest produces no issues', () => {
    const issues = validateManifest({
      $schema: 'https://json.schemastore.org/claude-code-plugin-manifest.json',
      name: PLUGIN_NAME,
      displayName: 'Manifest Fixture',
      version: '1.0.0',
      description: 'Fixture plugin',
      author: { name: 'Dev' },
      homepage: 'https://example.com',
      repository: 'https://github.com/example/plugin',
      license: 'MIT',
      keywords: ['fixture'],
      metadata: { catalogId: 'cat-1' },
      defaultEnabled: false,
      strict: true,
      skills: './skills/',
      commands: ['./commands/deploy.md'],
      agents: ['./agents/reviewer.md'],
      workflows: './workflows/',
      hooks: './hooks/hooks.json',
      mcpServers: './.mcp.json',
      outputStyles: './output-styles/',
      lspServers: './.lsp.json',
      experimental: { themes: './themes/', monitors: './monitors.json' },
      userConfig: {},
      channels: [],
      dependencies: ['helper-lib'],
    });

    expect(issues).toEqual([]);
  });

  test('an unrecognized top-level field is a warning, not an error', () => {
    const issues = validateManifest({
      name: PLUGIN_NAME,
      version: '1.0.0',
      description: 'Fixture plugin',
      contributes: { commands: [] },
    });

    expect(messages(issues, 'error')).toEqual([]);
    expect(messages(issues, 'warning')).toEqual([
      "Unrecognized field 'contributes' - Claude Code ignores top-level fields it does not recognize",
    ]);
    expect(validatePlugin(pluginDir).valid).toBe(true);
  });

  test('a field named after an Object.prototype member still warns', () => {
    const issues = validateManifest({
      name: PLUGIN_NAME,
      version: '1.0.0',
      description: 'Fixture plugin',
      constructor: 'nonsense',
      toString: 'nonsense',
    });

    expect(messages(issues, 'error')).toEqual([]);
    expect(messages(issues, 'warning')).toEqual([
      "Unrecognized field 'constructor' - Claude Code ignores top-level fields it does not recognize",
      "Unrecognized field 'toString' - Claude Code ignores top-level fields it does not recognize",
    ]);
  });

  test("a missing 'version' field is a warning, not an error", () => {
    const issues = validateManifest({
      name: PLUGIN_NAME,
      description: 'Fixture plugin',
    });

    expect(messages(issues, 'error')).toEqual([]);
    expect(
      messages(issues, 'warning').some((m) => m.includes("Missing 'version'"))
    ).toBe(true);
    expect(validatePlugin(pluginDir).valid).toBe(true);
  });

  test("a missing 'name' field is still an error", () => {
    const issues = validateManifest({ version: '1.0.0' });

    expect(messages(issues, 'error')).toContain(
      "Missing required 'name' field"
    );
  });

  test("a non-object 'experimental' value is a warning", () => {
    const issues = validateManifest({
      name: PLUGIN_NAME,
      version: '1.0.0',
      description: 'Fixture plugin',
      experimental: './experimental/',
    });

    expect(messages(issues, 'error')).toEqual([]);
    expect(messages(issues, 'warning')).toEqual([
      "'experimental' must be an object - Claude Code ignores a non-object value",
    ]);
  });

  test("an unknown 'experimental' subkey is a warning", () => {
    const issues = validateManifest({
      name: PLUGIN_NAME,
      version: '1.0.0',
      description: 'Fixture plugin',
      experimental: { themes: './themes/', widgets: './widgets/' },
    });

    expect(messages(issues, 'error')).toEqual([]);
    expect(messages(issues, 'warning')).toEqual([
      "Unrecognized 'experimental.widgets' - recognized experimental components are themes, monitors",
    ]);
  });

  test('top-level themes and monitors get a migration warning', () => {
    const issues = validateManifest({
      name: PLUGIN_NAME,
      version: '1.0.0',
      description: 'Fixture plugin',
      themes: './themes/',
      monitors: './monitors.json',
    });

    expect(messages(issues, 'error')).toEqual([]);
    expect(messages(issues, 'warning')).toEqual([
      "'themes' at the top level still loads, but a future Claude Code release will require 'experimental.themes'",
      "'monitors' at the top level still loads, but a future Claude Code release will require 'experimental.monitors'",
    ]);
  });

  test('a manifest that is not a JSON object is an error', () => {
    const issues = validateManifest(['not', 'a', 'manifest']);

    expect(messages(issues, 'error')).toEqual([
      'plugin.json must contain a JSON object',
    ]);
  });
});
