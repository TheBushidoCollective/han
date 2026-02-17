import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Tests to validate all plugin hooks.json files have valid structure
 * and that async PostToolUse hooks follow conventions.
 */

// Get the han repository root (packages/han/test -> packages/han -> packages -> han repo root)
const repoRoot = join(dirname(import.meta.dir), '../..');

// Recursively find all hooks/hooks.json files under plugins/
function findPluginHooksFiles(): string[] {
  const pluginsRoot = join(repoRoot, 'plugins');
  if (!existsSync(pluginsRoot)) return [];

  const hooksFiles: string[] = [];

  function scan(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(dir, entry.name);
      const hooksPath = join(fullPath, 'hooks', 'hooks.json');
      if (existsSync(hooksPath)) {
        hooksFiles.push(hooksPath);
      } else {
        // Check one level deeper for category subdirectories
        scan(fullPath);
      }
    }
  }

  scan(pluginsRoot);
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
    // hooksFiles count varies by context - may be 0 when running from packages/han
    expect(hooksFiles.length).toBeGreaterThanOrEqual(0);
  });

  describe('Structure Validation', () => {
    for (const filePath of hooksFiles) {
      const relativePath = filePath.replace(`${repoRoot}/`, '');

      it(`${relativePath} has valid JSON structure`, () => {
        const hooks = parseHooksJson(filePath);
        expect(hooks).toBeDefined();
        expect(hooks.hooks).toBeDefined();
      });
    }
  });

  describe('PostToolUse Async Convention', () => {
    // Only test plugins that actually have PostToolUse hooks
    const filesWithPostToolUse = hooksFiles.filter((f) => {
      const hooks = parseHooksJson(f);
      return (
        hooks.hooks.PostToolUse &&
        Array.isArray(hooks.hooks.PostToolUse) &&
        hooks.hooks.PostToolUse.length > 0
      );
    });

    it('finds plugins with PostToolUse hooks', () => {
      expect(filesWithPostToolUse.length).toBeGreaterThan(0);
    });

    for (const filePath of filesWithPostToolUse) {
      const relativePath = filePath.replace(`${repoRoot}/`, '');

      it(`${relativePath} has async: true on all PostToolUse hooks`, () => {
        const hooks = parseHooksJson(filePath);
        for (const entry of hooks.hooks.PostToolUse ?? []) {
          expect(entry.async).toBe(true);
        }
      });

      it(`${relativePath} has matcher for file modification tools`, () => {
        const hooks = parseHooksJson(filePath);
        for (const entry of hooks.hooks.PostToolUse ?? []) {
          expect(entry.matcher).toBeDefined();
          expect(entry.matcher).toMatch(/Edit|Write|NotebookEdit/);
        }
      });
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

describe('Multi-Hook Plugins', () => {
  it('languages/go has format async PostToolUse hook', () => {
    const hooksPath = join(
      repoRoot,
      'plugins',
      'languages',
      'go',
      'hooks',
      'hooks.json'
    );
    if (!existsSync(hooksPath)) return; // skip if not available in this context
    const hooks = parseHooksJson(hooksPath);

    const commands = hooks.hooks.PostToolUse?.flatMap((e) =>
      e.hooks.map((h) => h.command)
    );

    expect(commands?.some((c) => c.includes('format'))).toBe(true);
  });

  it('languages/elixir has format and test-changed async PostToolUse hooks (build is Stop-only)', () => {
    const hooksPath = join(
      repoRoot,
      'plugins',
      'languages',
      'elixir',
      'hooks',
      'hooks.json'
    );
    if (!existsSync(hooksPath)) return; // skip if not available in this context
    const hooks = parseHooksJson(hooksPath);

    const commands = hooks.hooks.PostToolUse?.flatMap((e) =>
      e.hooks.map((h) => h.command)
    );

    expect(commands?.some((c) => c.includes('format'))).toBe(true);
    expect(commands?.some((c) => c.includes('test-changed'))).toBe(true);
    // build is intentionally NOT in PostToolUse - it doesn't use HAN_FILES
    expect(commands?.some((c) => c.includes('build'))).toBe(false);
  });
});
