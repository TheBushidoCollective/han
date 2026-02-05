import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Tests to validate all plugin hooks.json files conform to the expected structure
 * for async PostToolUse hooks
 */

// Get the han repository root (packages/han/tests -> packages/han -> packages -> han repo root)
const repoRoot = join(dirname(import.meta.dir), '../..');

// Find all hooks.json files in plugin directories
function findPluginHooksFiles(): string[] {
  const pluginDirs = ['validation', 'languages', 'tools'];
  const hooksFiles: string[] = [];

  for (const dir of pluginDirs) {
    const dirPath = join(repoRoot, dir);
    if (!existsSync(dirPath)) continue;

    const plugins = readdirSync(dirPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const plugin of plugins) {
      const hooksPath = join(dirPath, plugin, '.claude-plugin', 'hooks.json');
      if (existsSync(hooksPath)) {
        hooksFiles.push(hooksPath);
      }
    }
  }

  return hooksFiles;
}

// Parse a hooks.json file
interface HookConfig {
  type: string;
  command: string;
}

interface HookEntry {
  matcher?: string;
  hooks: HookConfig[];
  async?: boolean;
}

interface HooksJson {
  hooks: {
    PostToolUse?: HookEntry[];
    [key: string]: unknown;
  };
}

function parseHooksJson(filePath: string): HooksJson {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

describe('Plugin hooks.json Files', () => {
  const hooksFiles = findPluginHooksFiles();

  it('finds multiple plugin hooks files', () => {
    expect(hooksFiles.length).toBeGreaterThan(10);
  });

  describe('Structure Validation', () => {
    for (const filePath of hooksFiles) {
      const relativePath = filePath.replace(`${repoRoot}/`, '');

      it(`${relativePath} has valid JSON structure`, () => {
        const hooks = parseHooksJson(filePath);
        expect(hooks).toBeDefined();
        expect(hooks.hooks).toBeDefined();
      });

      it(`${relativePath} has PostToolUse hooks`, () => {
        const hooks = parseHooksJson(filePath);
        expect(hooks.hooks.PostToolUse).toBeDefined();
        expect(Array.isArray(hooks.hooks.PostToolUse)).toBe(true);
        expect(hooks.hooks.PostToolUse?.length).toBeGreaterThan(0);
      });

      it(`${relativePath} has async: true on all PostToolUse hooks`, () => {
        const hooks = parseHooksJson(filePath);
        for (const entry of hooks.hooks.PostToolUse!) {
          expect(entry.async).toBe(true);
        }
      });

      it(`${relativePath} has matcher for file modification tools`, () => {
        const hooks = parseHooksJson(filePath);
        for (const entry of hooks.hooks.PostToolUse!) {
          expect(entry.matcher).toBeDefined();
          expect(entry.matcher).toMatch(/Edit|Write|NotebookEdit/);
        }
      });

      it(`${relativePath} uses npx command format`, () => {
        const hooks = parseHooksJson(filePath);
        for (const entry of hooks.hooks.PostToolUse!) {
          for (const hook of entry.hooks) {
            expect(hook.type).toBe('command');
            expect(hook.command).toMatch(/^npx -y @thebushidocollective\/han/);
          }
        }
      });

      it(`${relativePath} uses han hook run with --async flag`, () => {
        const hooks = parseHooksJson(filePath);
        for (const entry of hooks.hooks.PostToolUse!) {
          for (const hook of entry.hooks) {
            expect(hook.command).toMatch(/hook run .+ --async$/);
          }
        }
      });
    }
  });
});

describe('Command Format Validation', () => {
  const hooksFiles = findPluginHooksFiles();

  it('all commands follow the pattern: npx -y @thebushidocollective/han hook run <plugin> <hook> --async', () => {
    const pattern =
      /^npx -y @thebushidocollective\/han hook run (\w+) ([\w-]+) --async$/;

    for (const filePath of hooksFiles) {
      const hooks = parseHooksJson(filePath);
      for (const entry of hooks.hooks.PostToolUse || []) {
        for (const hook of entry.hooks) {
          const match = hook.command.match(pattern);
          expect(match).not.toBe(null);
          if (match) {
            const [, pluginName, hookName] = match;
            expect(pluginName).toBeTruthy();
            expect(hookName).toBeTruthy();
            // Async hooks should end with -async
            expect(hookName).toMatch(/-async$/);
          }
        }
      }
    }
  });
});

describe('Async Hook Naming Convention', () => {
  it('extracts plugin and hook names correctly', () => {
    const command =
      'npx -y @thebushidocollective/han hook run biome lint-async --async';
    const match = command.match(/hook run (\w+) ([\w-]+) --async$/);
    expect(match).not.toBe(null);
    expect(match?.[1]).toBe('biome');
    expect(match?.[2]).toBe('lint-async');
  });

  it('handles multi-word hook names', () => {
    const command =
      'npx -y @thebushidocollective/han hook run typescript typecheck-async --async';
    const match = command.match(/hook run (\w+) ([\w-]+) --async$/);
    expect(match).not.toBe(null);
    expect(match?.[1]).toBe('typescript');
    expect(match?.[2]).toBe('typecheck-async');
  });
});

describe('Matcher Patterns', () => {
  it('Edit|Write|NotebookEdit covers all file modification tools', () => {
    const matcher = 'Edit|Write|NotebookEdit';
    const tools = ['Edit', 'Write', 'NotebookEdit'];
    const regex = new RegExp(`^(${matcher})$`);

    for (const tool of tools) {
      expect(regex.test(tool)).toBe(true);
    }
  });

  it('matcher does not match non-file tools', () => {
    const matcher = 'Edit|Write|NotebookEdit';
    const nonFileTools = ['Bash', 'Task', 'Read', 'Grep', 'Glob'];
    const regex = new RegExp(`^(${matcher})$`);

    for (const tool of nonFileTools) {
      expect(regex.test(tool)).toBe(false);
    }
  });
});

describe('Plugin Coverage', () => {
  const expectedPlugins = {
    validation: [
      'biome',
      'eslint',
      'prettier',
      'clippy',
      'rubocop',
      'pylint',
      'shellcheck',
      'shfmt',
      'credo',
      'markdown',
    ],
    languages: ['typescript', 'go', 'rust', 'elixir'],
    tools: ['jest', 'vitest', 'pytest', 'mocha', 'playwright', 'rspec'],
  };

  for (const [category, plugins] of Object.entries(expectedPlugins)) {
    describe(`${category} plugins`, () => {
      for (const plugin of plugins) {
        it(`${plugin} has hooks.json with async PostToolUse`, () => {
          const hooksPath = join(
            repoRoot,
            category,
            plugin,
            '.claude-plugin',
            'hooks.json'
          );
          expect(existsSync(hooksPath)).toBe(true);

          const hooks = parseHooksJson(hooksPath);
          expect(hooks.hooks.PostToolUse).toBeDefined();
          expect(hooks.hooks.PostToolUse?.length).toBeGreaterThan(0);

          // All entries should have async: true
          for (const entry of hooks.hooks.PostToolUse!) {
            expect(entry.async).toBe(true);
          }
        });
      }
    });
  }
});

describe('Multi-Hook Plugins', () => {
  it('languages/go has format, build, and test async hooks', () => {
    const hooksPath = join(
      repoRoot,
      'languages',
      'go',
      '.claude-plugin',
      'hooks.json'
    );
    const hooks = parseHooksJson(hooksPath);

    const commands = hooks.hooks.PostToolUse?.flatMap((e) =>
      e.hooks.map((h) => h.command)
    );

    expect(commands.some((c) => c.includes('format-async'))).toBe(true);
    expect(commands.some((c) => c.includes('build-async'))).toBe(true);
    expect(commands.some((c) => c.includes('test-async'))).toBe(true);
  });

  it('languages/rust has format, build, and test async hooks', () => {
    const hooksPath = join(
      repoRoot,
      'languages',
      'rust',
      '.claude-plugin',
      'hooks.json'
    );
    const hooks = parseHooksJson(hooksPath);

    const commands = hooks.hooks.PostToolUse?.flatMap((e) =>
      e.hooks.map((h) => h.command)
    );

    expect(commands.some((c) => c.includes('format-async'))).toBe(true);
    expect(commands.some((c) => c.includes('build-async'))).toBe(true);
    expect(commands.some((c) => c.includes('test-async'))).toBe(true);
  });

  it('languages/elixir has format, compile, and test async hooks', () => {
    const hooksPath = join(
      repoRoot,
      'languages',
      'elixir',
      '.claude-plugin',
      'hooks.json'
    );
    const hooks = parseHooksJson(hooksPath);

    const commands = hooks.hooks.PostToolUse?.flatMap((e) =>
      e.hooks.map((h) => h.command)
    );

    expect(commands.some((c) => c.includes('format-async'))).toBe(true);
    expect(commands.some((c) => c.includes('compile-async'))).toBe(true);
    expect(commands.some((c) => c.includes('test-async'))).toBe(true);
  });
});
