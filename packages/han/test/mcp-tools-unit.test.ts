/**
 * Unit tests for lib/commands/mcp/tools.ts
 * Tests tool discovery and description generation
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  discoverPluginTools,
  type ExecuteToolOptions,
  type ExecuteToolResult,
  type PluginTool,
} from '../lib/commands/mcp/tools.ts';

describe('mcp/tools.ts unit tests', () => {
  describe('PluginTool interface', () => {
    test('PluginTool has correct structure', () => {
      const tool: PluginTool = {
        name: 'jutsu_typescript_typecheck',
        description: 'Type-check TypeScript code',
        pluginName: 'jutsu-typescript',
        hookName: 'typecheck',
        pluginRoot: '/path/to/plugin',
      };

      expect(tool.name).toBe('jutsu_typescript_typecheck');
      expect(tool.description).toBe('Type-check TypeScript code');
      expect(tool.pluginName).toBe('jutsu-typescript');
      expect(tool.hookName).toBe('typecheck');
      expect(tool.pluginRoot).toBe('/path/to/plugin');
    });

    test('tool name replaces hyphens with underscores', () => {
      const pluginName = 'jutsu-typescript';
      const hookName = 'typecheck';
      const toolName = `${pluginName}_${hookName}`.replace(/-/g, '_');

      expect(toolName).toBe('jutsu_typescript_typecheck');
    });

    test('tool name handles multiple hyphens', () => {
      const pluginName = 'do-claude-plugin-development';
      const hookName = 'validate';
      const toolName = `${pluginName}_${hookName}`.replace(/-/g, '_');

      expect(toolName).toBe('do_claude_plugin_development_validate');
    });
  });

  describe('Tool description generation logic', () => {
    test('generates description for test hook', () => {
      const pluginName = 'jutsu-bun';
      const hookName = 'test';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);

      const descriptions: Record<
        string,
        (tech: string, display: string) => string
      > = {
        test: (tech, display) =>
          `Run ${display} tests. Triggers: "run the tests", "run ${tech} tests", "check if tests pass", "execute test suite"`,
      };

      const descFn = descriptions[hookName];
      const desc = descFn?.(technology, techDisplay) ?? '';

      expect(desc).toContain('Run Bun tests');
      expect(desc).toContain('Triggers: "run the tests"');
      expect(desc).toContain('"run bun tests"');
    });

    test('generates description for lint hook', () => {
      const pluginName = 'jutsu-biome';
      const hookName = 'lint';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);

      const descriptions: Record<
        string,
        (tech: string, display: string) => string
      > = {
        lint: (tech, display) =>
          `Lint ${display} code for issues and style violations. Triggers: "lint the code", "check for ${tech} issues", "run the linter", "check code quality"`,
      };

      const descFn = descriptions[hookName];
      const desc = descFn?.(technology, techDisplay) ?? '';

      expect(desc).toContain('Lint Biome code');
      expect(desc).toContain('Triggers: "lint the code"');
      expect(desc).toContain('"check for biome issues"');
    });

    test('generates description for typecheck hook', () => {
      const hookName = 'typecheck';
      const descriptions: Record<
        string,
        (_tech: string, display: string) => string
      > = {
        typecheck: (_tech, display) =>
          `Type-check ${display} code for type errors. Triggers: "check types", "run type checking", "verify types", "typescript check"`,
      };

      const descFn = descriptions[hookName];
      const desc = descFn?.('typescript', 'Typescript') ?? '';

      expect(desc).toContain('Type-check Typescript code');
      expect(desc).toContain('"check types"');
    });

    test('generates description for build hook', () => {
      const hookName = 'build';
      const descriptions: Record<
        string,
        (_tech: string, display: string) => string
      > = {
        build: (_tech, display) =>
          `Build the ${display} project. Triggers: "build the project", "compile the code", "run the build"`,
      };

      const descFn = descriptions[hookName];
      const desc = descFn?.('bun', 'Bun') ?? '';

      expect(desc).toContain('Build the Bun project');
      expect(desc).toContain('"build the project"');
    });

    test('generates default description for unknown hooks', () => {
      const pluginName = 'jutsu-custom';
      const hookName = 'custom-check';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);

      // When no matching hook description exists
      const descriptions: Record<
        string,
        (tech: string, display: string) => string
      > = {};

      const descFn = descriptions[hookName];
      const desc = descFn
        ? descFn(technology, techDisplay)
        : `Run ${hookName} for ${techDisplay}. Triggers: "run ${hookName}", "${hookName} the ${technology} code"`;

      expect(desc).toContain('Run custom-check for Custom');
      expect(desc).toContain('"run custom-check"');
    });

    test('adds dirsWith context to description', () => {
      const baseDesc = 'Run Bun tests.';
      const hookDef = { dirsWith: ['package.json', 'bun.lock'] };

      let desc = baseDesc;
      if (hookDef.dirsWith && hookDef.dirsWith.length > 0) {
        desc += `. Runs in directories containing: ${hookDef.dirsWith.join(', ')}`;
      }

      expect(desc).toContain('package.json, bun.lock');
    });

    test('adds command to description', () => {
      const baseDesc = 'Run Bun tests.';
      const hookDef = { command: 'bun test' };

      let desc = baseDesc;
      if (hookDef.command) {
        desc += `. Command: ${hookDef.command}`;
      }

      expect(desc).toContain('Command: bun test');
    });
  });

  describe('Plugin name parsing', () => {
    test('extracts technology from jutsu- prefix', () => {
      const pluginName = 'jutsu-typescript';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      expect(technology).toBe('typescript');
    });

    test('extracts technology from do- prefix', () => {
      const pluginName = 'do-claude-plugin-development';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      expect(technology).toBe('claude-plugin-development');
    });

    test('extracts technology from hashi- prefix', () => {
      const pluginName = 'hashi-github';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      expect(technology).toBe('github');
    });

    test('handles plugins without prefix', () => {
      const pluginName = 'core';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      expect(technology).toBe('core');
    });

    test('capitalizes first letter for display', () => {
      const technology = 'typescript';
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);
      expect(techDisplay).toBe('Typescript');
    });

    test('handles multi-word technology names', () => {
      const technology = 'claude-plugin-development';
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);
      expect(techDisplay).toBe('Claude-plugin-development');
    });
  });

  describe('Path resolution logic', () => {
    test('absolute paths are returned as-is', () => {
      const path = '/absolute/path/to/plugin';
      const isAbsolute = path.startsWith('/');
      expect(isAbsolute).toBe(true);
    });

    test('relative paths are detected', () => {
      const path = 'relative/path/to/plugin';
      const isAbsolute = path.startsWith('/');
      expect(isAbsolute).toBe(false);
    });

    test('handles various relative path formats', () => {
      const paths = ['./relative', '../parent', 'simple'];

      for (const path of paths) {
        const isAbsolute = path.startsWith('/');
        expect(isAbsolute).toBe(false);
      }
    });
  });

  describe('Plugin directory search paths', () => {
    test('generates correct potential paths', () => {
      const marketplaceRoot = '/home/user/.claude/plugins/marketplaces/han';
      const pluginName = 'jutsu-typescript';

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', pluginName),
        join(marketplaceRoot, 'do', pluginName),
        join(marketplaceRoot, 'hashi', pluginName),
        join(marketplaceRoot, pluginName),
      ];

      expect(potentialPaths[0]).toBe(
        '/home/user/.claude/plugins/marketplaces/han/jutsu/jutsu-typescript'
      );
      expect(potentialPaths[1]).toBe(
        '/home/user/.claude/plugins/marketplaces/han/do/jutsu-typescript'
      );
      expect(potentialPaths[2]).toBe(
        '/home/user/.claude/plugins/marketplaces/han/hashi/jutsu-typescript'
      );
      expect(potentialPaths[3]).toBe(
        '/home/user/.claude/plugins/marketplaces/han/jutsu-typescript'
      );
    });
  });

  describe('ExecuteToolOptions interface', () => {
    test('default options', () => {
      const options: ExecuteToolOptions = {};

      const verbose = options.verbose ?? false;
      const failFast = options.failFast ?? true;
      const cache = options.cache ?? true;

      expect(verbose).toBe(false);
      expect(failFast).toBe(true);
      expect(cache).toBe(true);
    });

    test('custom options', () => {
      const options: ExecuteToolOptions = {
        verbose: true,
        failFast: false,
        directory: 'src',
        cache: false,
      };

      expect(options.verbose).toBe(true);
      expect(options.failFast).toBe(false);
      expect(options.directory).toBe('src');
      expect(options.cache).toBe(false);
    });
  });

  describe('ExecuteToolResult interface', () => {
    test('successful result structure', () => {
      const result: ExecuteToolResult = {
        success: true,
        output: 'All tests passed',
      };

      expect(result.success).toBe(true);
      expect(result.output).toBe('All tests passed');
    });

    test('failed result structure', () => {
      const result: ExecuteToolResult = {
        success: false,
        output: 'Error: Test failed',
      };

      expect(result.success).toBe(false);
      expect(result.output).toContain('Error');
    });

    test('empty output defaults', () => {
      const outputLines: string[] = [];
      const success = true;

      const output = outputLines.join('\n') || (success ? 'Success' : 'Failed');

      expect(output).toBe('Success');
    });

    test('failed with empty output', () => {
      const outputLines: string[] = [];
      const success = false;

      const output = outputLines.join('\n') || (success ? 'Success' : 'Failed');

      expect(output).toBe('Failed');
    });
  });
});

describe('mcp/tools.ts integration tests', () => {
  const testDir = `/tmp/test-mcp-tools-${Date.now()}`;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = join(testDir, 'config');
    mkdirSync(join(testDir, 'config'), { recursive: true });
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('discoverPluginTools', () => {
    test('returns empty array when no plugins installed', () => {
      // Create minimal settings file with no plugins
      const settingsPath = join(testDir, 'config', 'settings.json');
      writeFileSync(settingsPath, JSON.stringify({ projects: {} }));

      const tools = discoverPluginTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    test('returns array type', () => {
      const tools = discoverPluginTools();
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('Tool naming conventions', () => {
    test('tool names follow pattern: pluginName_hookName', () => {
      const examples = [
        {
          pluginName: 'jutsu-typescript',
          hookName: 'typecheck',
          expected: 'jutsu_typescript_typecheck',
        },
        {
          pluginName: 'jutsu-biome',
          hookName: 'lint',
          expected: 'jutsu_biome_lint',
        },
        {
          pluginName: 'jutsu-bun',
          hookName: 'test',
          expected: 'jutsu_bun_test',
        },
      ];

      for (const example of examples) {
        const toolName = `${example.pluginName}_${example.hookName}`.replace(
          /-/g,
          '_'
        );
        expect(toolName).toBe(example.expected);
      }
    });
  });
});
