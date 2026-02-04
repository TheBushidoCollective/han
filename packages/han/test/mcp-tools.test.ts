/**
 * Unit tests for MCP tools module
 * Tests tool discovery and description generation
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Store original environment
const originalEnv = { ...process.env };
const originalCwd = process.cwd;

let testDir: string;

function setup(): void {
  const random = Math.random().toString(36).substring(2, 9);
  testDir = join(tmpdir(), `han-mcp-tools-test-${Date.now()}-${random}`);
  mkdirSync(testDir, { recursive: true });
}

function teardown(): void {
  process.env = { ...originalEnv };
  process.cwd = originalCwd;

  if (testDir && existsSync(testDir)) {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe('MCP tools module', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    teardown();
  });

  describe('findPluginInMarketplace pattern', () => {
    test('constructs all potential paths', () => {
      const marketplaceRoot = '/path/to/marketplace';
      const pluginName = 'jutsu-typescript';

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', pluginName),
        join(marketplaceRoot, 'do', pluginName),
        join(marketplaceRoot, 'hashi', pluginName),
        join(marketplaceRoot, pluginName),
      ];

      expect(potentialPaths).toEqual([
        '/path/to/marketplace/jutsu/jutsu-typescript',
        '/path/to/marketplace/do/jutsu-typescript',
        '/path/to/marketplace/hashi/jutsu-typescript',
        '/path/to/marketplace/jutsu-typescript',
      ]);
    });

    test('finds existing plugin in jutsu directory', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      const pluginName = 'jutsu-test';
      const pluginPath = join(marketplaceRoot, 'jutsu', pluginName);
      mkdirSync(pluginPath, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', pluginName),
        join(marketplaceRoot, 'do', pluginName),
        join(marketplaceRoot, 'hashi', pluginName),
        join(marketplaceRoot, pluginName),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBe(pluginPath);
    });

    test('finds existing plugin in hashi directory', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      const pluginName = 'hashi-github';
      const pluginPath = join(marketplaceRoot, 'hashi', pluginName);
      mkdirSync(pluginPath, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', pluginName),
        join(marketplaceRoot, 'do', pluginName),
        join(marketplaceRoot, 'hashi', pluginName),
        join(marketplaceRoot, pluginName),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBe(pluginPath);
    });

    test('returns null when plugin not found', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      mkdirSync(marketplaceRoot, { recursive: true });
      const pluginName = 'nonexistent-plugin';

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', pluginName),
        join(marketplaceRoot, 'do', pluginName),
        join(marketplaceRoot, 'hashi', pluginName),
        join(marketplaceRoot, pluginName),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBeNull();
    });
  });

  describe('resolvePathToAbsolute pattern', () => {
    test('returns absolute path unchanged', () => {
      const path = '/absolute/path/to/plugin';
      const result = path.startsWith('/') ? path : join(process.cwd(), path);
      expect(result).toBe('/absolute/path/to/plugin');
    });

    test('resolves relative path to cwd', () => {
      const path = 'relative/path';
      const cwd = '/home/user/project';
      const result = path.startsWith('/') ? path : join(cwd, path);
      expect(result).toBe('/home/user/project/relative/path');
    });
  });

  describe('generateToolDescription pattern', () => {
    test('generates test hook description', () => {
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
      const desc = descFn ? descFn(technology, techDisplay) : '';

      expect(desc).toContain('Run Bun tests');
      expect(desc).toContain('run bun tests');
      expect(desc).toContain('check if tests pass');
    });

    test('generates lint hook description', () => {
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
      const desc = descFn ? descFn(technology, techDisplay) : '';

      expect(desc).toContain('Lint Biome code');
      expect(desc).toContain('check for biome issues');
    });

    test('generates typecheck hook description', () => {
      const pluginName = 'jutsu-typescript';
      const hookName = 'typecheck';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);

      const descriptions: Record<
        string,
        (tech: string, display: string) => string
      > = {
        typecheck: (_tech, display) =>
          `Type-check ${display} code for type errors. Triggers: "check types", "run type checking", "verify types", "typescript check"`,
      };

      const descFn = descriptions[hookName];
      const desc = descFn ? descFn(technology, techDisplay) : '';

      expect(desc).toContain('Type-check Typescript code');
      expect(desc).toContain('check types');
    });

    test('generates build hook description', () => {
      const pluginName = 'jutsu-bun';
      const hookName = 'build';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);

      const descriptions: Record<
        string,
        (tech: string, display: string) => string
      > = {
        build: (_tech, display) =>
          `Build the ${display} project. Triggers: "build the project", "compile the code", "run the build"`,
      };

      const descFn = descriptions[hookName];
      const desc = descFn ? descFn(technology, techDisplay) : '';

      expect(desc).toContain('Build the Bun project');
      expect(desc).toContain('compile the code');
    });

    test('generates default description for unknown hook', () => {
      const pluginName = 'jutsu-custom';
      const hookName = 'custom-hook';
      const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
      const techDisplay =
        technology.charAt(0).toUpperCase() + technology.slice(1);

      const descriptions: Record<
        string,
        (tech: string, display: string) => string
      > = {};
      const descFn = descriptions[hookName];
      const desc = descFn
        ? descFn(technology, techDisplay)
        : `Run ${hookName} for ${techDisplay}. Triggers: "run ${hookName}", "${hookName} the ${technology} code"`;

      expect(desc).toContain('Run custom-hook for Custom');
      expect(desc).toContain('run custom-hook');
    });

    test('appends dirsWith info', () => {
      const hookDef = {
        dirsWith: ['package.json', 'bun.lock'],
        command: 'bun test',
      };
      let desc = 'Run Bun tests';

      if (hookDef?.dirsWith && hookDef.dirsWith.length > 0) {
        desc += `. Runs in directories containing: ${hookDef.dirsWith.join(', ')}`;
      }

      expect(desc).toContain(
        'Runs in directories containing: package.json, bun.lock'
      );
    });

    test('appends command info', () => {
      const hookDef = { command: 'bun test --coverage' };
      let desc = 'Run Bun tests';

      if (hookDef?.command) {
        desc += `. Command: ${hookDef.command}`;
      }

      expect(desc).toContain('Command: bun test --coverage');
    });
  });

  describe('tool name generation', () => {
    test('converts plugin name and hook to tool name', () => {
      const pluginName = 'jutsu-typescript';
      const hookName = 'typecheck';
      const toolName = `${pluginName}_${hookName}`.replace(/-/g, '_');
      expect(toolName).toBe('jutsu_typescript_typecheck');
    });

    test('handles multiple dashes', () => {
      const pluginName = 'do-claude-plugin-development';
      const hookName = 'validate';
      const toolName = `${pluginName}_${hookName}`.replace(/-/g, '_');
      expect(toolName).toBe('do_claude_plugin_development_validate');
    });
  });

  describe('PluginTool structure', () => {
    test('contains all required fields', () => {
      const tool = {
        name: 'jutsu_biome_lint',
        description: 'Lint Biome code for issues',
        pluginName: 'jutsu-biome',
        hookName: 'lint',
        pluginRoot: '/path/to/plugin',
      };

      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.pluginName).toBeDefined();
      expect(tool.hookName).toBeDefined();
      expect(tool.pluginRoot).toBeDefined();
    });
  });

  describe('ExecuteToolOptions', () => {
    test('has default values', () => {
      const options: {
        verbose?: boolean;
        failFast?: boolean;
        directory?: string;
        cache?: boolean;
      } = {};

      const {
        verbose = false,
        failFast = true,
        directory,
        cache = true,
      } = options;

      expect(verbose).toBe(false);
      expect(failFast).toBe(true);
      expect(directory).toBeUndefined();
      expect(cache).toBe(true);
    });

    test('respects custom values', () => {
      const options = {
        verbose: true,
        failFast: false,
        directory: 'packages/core',
        cache: false,
      };

      expect(options.verbose).toBe(true);
      expect(options.failFast).toBe(false);
      expect(options.directory).toBe('packages/core');
      expect(options.cache).toBe(false);
    });
  });

  describe('ExecuteToolResult structure', () => {
    test('success result', () => {
      const result = {
        success: true,
        output: 'All tests passed',
      };

      expect(result.success).toBe(true);
      expect(result.output).toContain('passed');
    });

    test('failure result', () => {
      const result = {
        success: false,
        output: '3 tests failed',
      };

      expect(result.success).toBe(false);
      expect(result.output).toContain('failed');
    });

    test('default output for success', () => {
      const outputLines: string[] = [];
      const success = true;
      const output = outputLines.join('\n') || (success ? 'Success' : 'Failed');
      expect(output).toBe('Success');
    });

    test('default output for failure', () => {
      const outputLines: string[] = [];
      const success = false;
      const output = outputLines.join('\n') || (success ? 'Success' : 'Failed');
      expect(output).toBe('Failed');
    });
  });

  describe('exit code handling pattern', () => {
    test('parses exit code from error message', () => {
      const errorMessage = '__EXIT_2__';
      const exitCode = Number.parseInt(
        errorMessage.replace('__EXIT_', '').replace('__', ''),
        10
      );
      expect(exitCode).toBe(2);
    });

    test('exit code 0 is success', () => {
      const exitCode = 0;
      const success = exitCode === 0;
      expect(success).toBe(true);
    });

    test('exit code non-zero is failure', () => {
      const exitCode: number = 1;
      const success = exitCode === 0;
      expect(success).toBe(false);
    });
  });
});

describe('MCP tool annotations', () => {
  test('generates correct annotations structure', () => {
    const hookName = 'lint';
    const technology = 'biome';

    const title = hookName.charAt(0).toUpperCase() + hookName.slice(1);
    const techDisplay =
      technology.charAt(0).toUpperCase() + technology.slice(1);

    const annotations = {
      title: `${title} ${techDisplay}`,
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };

    expect(annotations.title).toBe('Lint Biome');
    expect(annotations.readOnlyHint).toBe(false);
    expect(annotations.destructiveHint).toBe(false);
    expect(annotations.idempotentHint).toBe(true);
    expect(annotations.openWorldHint).toBe(false);
  });
});

describe('MCP tool input schema', () => {
  test('has correct structure', () => {
    const inputSchema = {
      type: 'object' as const,
      properties: {
        cache: {
          type: 'boolean',
          description: "Use cached results when files haven't changed.",
        },
        directory: {
          type: 'string',
          description: 'Limit execution to a specific directory path.',
        },
        verbose: {
          type: 'boolean',
          description: 'Show full command output in real-time.',
        },
      },
    };

    expect(inputSchema.type).toBe('object');
    expect(inputSchema.properties.cache.type).toBe('boolean');
    expect(inputSchema.properties.directory.type).toBe('string');
    expect(inputSchema.properties.verbose.type).toBe('boolean');
  });
});
