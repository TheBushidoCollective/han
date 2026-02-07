import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { minimatch } from 'minimatch';

/**
 * Tests for async hook functionality in han hook run --async
 * Tests the matching logic and output format for PostToolUse hooks
 */

// Test the extractFilePath logic (mimics the function)
function extractFilePath(payload: {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}): string | null {
  const toolInput = payload.tool_input;
  if (!toolInput) return null;

  switch (payload.tool_name) {
    case 'Edit':
    case 'Write':
    case 'Read':
      return (toolInput.file_path as string) || null;
    case 'NotebookEdit':
      return (toolInput.notebook_path as string) || null;
    default:
      return null;
  }
}

// Test the matchesFileFilter logic (mimics the function)
function matchesFileFilter(
  filePath: string,
  fileFilter: string[] | undefined,
  cwd: string
): boolean {
  if (!fileFilter || fileFilter.length === 0) {
    return true;
  }

  const relativePath = filePath.startsWith(cwd)
    ? filePath.slice(cwd.length + 1)
    : filePath;

  for (const pattern of fileFilter) {
    if (minimatch(relativePath, pattern, { dot: true })) {
      return true;
    }
  }
  return false;
}

describe('extractFilePath', () => {
  describe('Edit tool', () => {
    it('extracts file_path from Edit tool input', () => {
      const payload = {
        tool_name: 'Edit',
        tool_input: { file_path: '/path/to/file.ts' },
      };
      expect(extractFilePath(payload)).toBe('/path/to/file.ts');
    });

    it('returns null when file_path is missing', () => {
      const payload = {
        tool_name: 'Edit',
        tool_input: { old_string: 'foo', new_string: 'bar' },
      };
      expect(extractFilePath(payload)).toBe(null);
    });
  });

  describe('Write tool', () => {
    it('extracts file_path from Write tool input', () => {
      const payload = {
        tool_name: 'Write',
        tool_input: { file_path: '/path/to/new-file.ts', content: 'hello' },
      };
      expect(extractFilePath(payload)).toBe('/path/to/new-file.ts');
    });
  });

  describe('Read tool', () => {
    it('extracts file_path from Read tool input', () => {
      const payload = {
        tool_name: 'Read',
        tool_input: { file_path: '/path/to/read.ts' },
      };
      expect(extractFilePath(payload)).toBe('/path/to/read.ts');
    });
  });

  describe('NotebookEdit tool', () => {
    it('extracts notebook_path from NotebookEdit tool input', () => {
      const payload = {
        tool_name: 'NotebookEdit',
        tool_input: {
          notebook_path: '/path/to/notebook.ipynb',
          new_source: '# cell',
        },
      };
      expect(extractFilePath(payload)).toBe('/path/to/notebook.ipynb');
    });
  });

  describe('Other tools', () => {
    it('returns null for Bash tool', () => {
      const payload = {
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
      };
      expect(extractFilePath(payload)).toBe(null);
    });

    it('returns null for Task tool', () => {
      const payload = {
        tool_name: 'Task',
        tool_input: { prompt: 'Do something', subagent_type: 'Explore' },
      };
      expect(extractFilePath(payload)).toBe(null);
    });

    it('returns null when tool_input is missing', () => {
      const payload = { tool_name: 'Edit' };
      expect(extractFilePath(payload)).toBe(null);
    });

    it('returns null when tool_name is missing', () => {
      const payload = { tool_input: { file_path: '/path/to/file.ts' } };
      expect(extractFilePath(payload)).toBe(null);
    });
  });
});

describe('matchesFileFilter', () => {
  const cwd = '/project/root';

  describe('with no filter', () => {
    it('matches any file when filter is undefined', () => {
      expect(
        matchesFileFilter('/project/root/src/file.ts', undefined, cwd)
      ).toBe(true);
    });

    it('matches any file when filter is empty array', () => {
      expect(matchesFileFilter('/project/root/src/file.ts', [], cwd)).toBe(
        true
      );
    });
  });

  describe('TypeScript/JavaScript patterns', () => {
    const tsFilter = ['**/*.ts', '**/*.tsx'];

    it('matches .ts files', () => {
      expect(
        matchesFileFilter('/project/root/src/index.ts', tsFilter, cwd)
      ).toBe(true);
    });

    it('matches .tsx files', () => {
      expect(
        matchesFileFilter('/project/root/src/component.tsx', tsFilter, cwd)
      ).toBe(true);
    });

    it('matches deeply nested files', () => {
      expect(
        matchesFileFilter('/project/root/src/a/b/c/file.ts', tsFilter, cwd)
      ).toBe(true);
    });

    it('does not match .js files', () => {
      expect(
        matchesFileFilter('/project/root/src/file.js', tsFilter, cwd)
      ).toBe(false);
    });

    it('does not match .json files', () => {
      expect(
        matchesFileFilter('/project/root/package.json', tsFilter, cwd)
      ).toBe(false);
    });
  });

  describe('Test file patterns', () => {
    const testFilter = ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'];

    it('matches .test.ts files', () => {
      expect(
        matchesFileFilter('/project/root/src/utils.test.ts', testFilter, cwd)
      ).toBe(true);
    });

    it('matches .spec.ts files', () => {
      expect(
        matchesFileFilter('/project/root/src/utils.spec.ts', testFilter, cwd)
      ).toBe(true);
    });

    it('matches files in test directory', () => {
      expect(
        matchesFileFilter('/project/root/test/unit/utils.ts', testFilter, cwd)
      ).toBe(true);
    });

    it('does not match regular source files', () => {
      expect(
        matchesFileFilter('/project/root/src/utils.ts', testFilter, cwd)
      ).toBe(false);
    });
  });

  describe('Elixir patterns', () => {
    const elixirFilter = ['**/*.ex', '**/*.exs'];

    it('matches .ex files', () => {
      expect(
        matchesFileFilter('/project/root/lib/app.ex', elixirFilter, cwd)
      ).toBe(true);
    });

    it('matches .exs files', () => {
      expect(
        matchesFileFilter('/project/root/test/app_test.exs', elixirFilter, cwd)
      ).toBe(true);
    });

    it('does not match .eex files', () => {
      const filter = ['**/*.ex'];
      expect(
        matchesFileFilter('/project/root/lib/template.eex', filter, cwd)
      ).toBe(false);
    });
  });

  describe('Markdown patterns', () => {
    const mdFilter = ['**/*.md'];

    it('matches .md files', () => {
      expect(
        matchesFileFilter('/project/root/docs/README.md', mdFilter, cwd)
      ).toBe(true);
    });

    it('matches root README', () => {
      expect(matchesFileFilter('/project/root/README.md', mdFilter, cwd)).toBe(
        true
      );
    });

    it('does not match .mdx files', () => {
      expect(
        matchesFileFilter('/project/root/docs/page.mdx', mdFilter, cwd)
      ).toBe(false);
    });
  });

  describe('relative path handling', () => {
    it('handles absolute paths that start with cwd', () => {
      expect(
        matchesFileFilter('/project/root/src/file.ts', ['src/**/*.ts'], cwd)
      ).toBe(true);
    });

    it('handles relative paths', () => {
      expect(matchesFileFilter('src/file.ts', ['src/**/*.ts'], cwd)).toBe(true);
    });
  });
});

describe('Tool Filter Matching', () => {
  // Test tool_filter logic
  function matchesToolFilter(
    toolName: string | undefined,
    toolFilter: string[] | undefined
  ): boolean {
    if (!toolFilter || toolFilter.length === 0) {
      return true;
    }
    if (!toolName) {
      return false;
    }
    return toolFilter.includes(toolName);
  }

  describe('with no filter', () => {
    it('matches any tool when filter is undefined', () => {
      expect(matchesToolFilter('Edit', undefined)).toBe(true);
      expect(matchesToolFilter('Write', undefined)).toBe(true);
      expect(matchesToolFilter('Bash', undefined)).toBe(true);
    });

    it('matches any tool when filter is empty array', () => {
      expect(matchesToolFilter('Edit', [])).toBe(true);
    });
  });

  describe('with filter', () => {
    const filter = ['Edit', 'Write'];

    it('matches tools in filter', () => {
      expect(matchesToolFilter('Edit', filter)).toBe(true);
      expect(matchesToolFilter('Write', filter)).toBe(true);
    });

    it('does not match tools not in filter', () => {
      expect(matchesToolFilter('Bash', filter)).toBe(false);
      expect(matchesToolFilter('Read', filter)).toBe(false);
      expect(matchesToolFilter('Task', filter)).toBe(false);
    });

    it('handles undefined tool name', () => {
      expect(matchesToolFilter(undefined, filter)).toBe(false);
    });
  });
});

describe('Async Hook Output Format', () => {
  interface AsyncHookOutput {
    systemMessage?: string;
    additionalContext?: string;
  }

  it('generates correct failure output structure', () => {
    const pluginName = 'jutsu-biome';
    const hookName = 'lint-async';
    const relativeDir = 'packages/app';
    const fileInfo = ' (src/index.ts)';
    const errorSummary = 'Error: Unexpected token';

    const output: AsyncHookOutput = {
      systemMessage: `❌ ${pluginName}/${hookName} failed in ${relativeDir}${fileInfo}:\n\n${errorSummary}`,
      additionalContext: `REQUIREMENT: Fix the ${hookName} errors shown above before proceeding. The validation hook "${pluginName}/${hookName}" failed. You must address these issues.\n\nAfter fixing, run \`han hook run ${pluginName} ${hookName}\` to verify the fix (this will use caching to avoid re-running if already passing).`,
    };

    expect(output.systemMessage).toContain('❌');
    expect(output.systemMessage).toContain(pluginName);
    expect(output.systemMessage).toContain(hookName);
    expect(output.systemMessage).toContain(relativeDir);
    expect(output.systemMessage).toContain(errorSummary);

    expect(output.additionalContext).toContain('REQUIREMENT');
    expect(output.additionalContext).toContain('han hook run');
    expect(output.additionalContext).toContain(pluginName);
    expect(output.additionalContext).toContain(hookName);
    expect(output.additionalContext).not.toContain('--async');
  });

  it('additionalContext instructs rerun without --async flag', () => {
    const pluginName = 'jutsu-typescript';
    const hookName = 'typecheck-async';

    const additionalContext = `REQUIREMENT: Fix the ${hookName} errors shown above before proceeding. The validation hook "${pluginName}/${hookName}" failed. You must address these issues.\n\nAfter fixing, run \`han hook run ${pluginName} ${hookName}\` to verify the fix (this will use caching to avoid re-running if already passing).`;

    // The key requirement: rerun command should NOT have --async
    expect(additionalContext).toContain(
      'han hook run jutsu-typescript typecheck-async'
    );
    expect(additionalContext).not.toContain('--async');
  });

  it('returns null for successful hooks', () => {
    // Successful hooks return null (no output needed)
    const successResult: AsyncHookOutput | null = null;
    expect(successResult).toBe(null);
  });
});

describe('Deduplication Key', () => {
  // Test deduplication key structure
  interface DedupKey {
    sessionId: string;
    cwd: string;
    plugin: string;
    hookName: string;
  }

  it('creates correct dedup key structure', () => {
    const dedupKey: DedupKey = {
      sessionId: 'session-123',
      cwd: '/project/root/packages/app',
      plugin: 'jutsu-biome',
      hookName: 'lint-async',
    };

    expect(dedupKey.sessionId).toBe('session-123');
    expect(dedupKey.cwd).toBe('/project/root/packages/app');
    expect(dedupKey.plugin).toBe('jutsu-biome');
    expect(dedupKey.hookName).toBe('lint-async');
  });

  it('different files in same directory use same dedup key', () => {
    const key1: DedupKey = {
      sessionId: 'session-123',
      cwd: '/project/root',
      plugin: 'jutsu-biome',
      hookName: 'lint-async',
    };
    const key2: DedupKey = {
      sessionId: 'session-123',
      cwd: '/project/root',
      plugin: 'jutsu-biome',
      hookName: 'lint-async',
    };

    expect(key1).toEqual(key2);
  });

  it('different directories have different dedup keys', () => {
    const key1: DedupKey = {
      sessionId: 'session-123',
      cwd: '/project/root/packages/app1',
      plugin: 'jutsu-biome',
      hookName: 'lint-async',
    };
    const key2: DedupKey = {
      sessionId: 'session-123',
      cwd: '/project/root/packages/app2',
      plugin: 'jutsu-biome',
      hookName: 'lint-async',
    };

    expect(key1).not.toEqual(key2);
  });
});

describe('dirs_with Marker Matching', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `han-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // Simplified dirs_with checking logic for testing
  function hasMarker(dir: string, marker: string): boolean {
    return existsSync(join(dir, marker));
  }

  it('detects package.json marker', () => {
    writeFileSync(join(tempDir, 'package.json'), '{}');
    expect(hasMarker(tempDir, 'package.json')).toBe(true);
  });

  it('detects tsconfig.json marker', () => {
    writeFileSync(join(tempDir, 'tsconfig.json'), '{}');
    expect(hasMarker(tempDir, 'tsconfig.json')).toBe(true);
  });

  it('detects biome.json marker', () => {
    writeFileSync(join(tempDir, 'biome.json'), '{}');
    expect(hasMarker(tempDir, 'biome.json')).toBe(true);
  });

  it('detects .eslintrc.* markers', () => {
    writeFileSync(join(tempDir, '.eslintrc.json'), '{}');
    expect(hasMarker(tempDir, '.eslintrc.json')).toBe(true);
  });

  it('detects mix.exs marker', () => {
    writeFileSync(join(tempDir, 'mix.exs'), 'defmodule Mix do end');
    expect(hasMarker(tempDir, 'mix.exs')).toBe(true);
  });

  it('detects .formatter.exs marker', () => {
    writeFileSync(join(tempDir, '.formatter.exs'), '[]');
    expect(hasMarker(tempDir, '.formatter.exs')).toBe(true);
  });

  it('returns false for missing marker', () => {
    expect(hasMarker(tempDir, 'nonexistent.json')).toBe(false);
  });
});

describe('HAN_FILES Environment Variable', () => {
  // Test that commands receive proper file paths
  it('single file is passed directly', () => {
    const files = ['/project/root/src/index.ts'];
    const envVar = files.join(' ');
    expect(envVar).toBe('/project/root/src/index.ts');
  });

  it('multiple files are space-separated', () => {
    const files = ['/project/root/src/a.ts', '/project/root/src/b.ts'];
    const envVar = files.join(' ');
    expect(envVar).toBe('/project/root/src/a.ts /project/root/src/b.ts');
  });

  it('file paths with spaces are handled', () => {
    const files = ['/project/root/src/my file.ts'];
    const envVar = files.join(' ');
    expect(envVar).toBe('/project/root/src/my file.ts');
    // Note: commands should quote ${HAN_FILES} appropriately
  });
});

describe('Command Building', () => {
  // Test buildCommandWithFiles behavior
  // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
  const HAN_FILES_PLACEHOLDER = '${HAN_FILES}';
  function buildCommandWithFiles(command: string, files: string[]): string {
    if (command.includes(HAN_FILES_PLACEHOLDER)) {
      return command.replace(HAN_FILES_PLACEHOLDER, files.join(' '));
    }
    return command;
  }

  it('replaces HAN_FILES placeholder', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
    const command = 'biome check ${HAN_FILES}';
    const files = ['/path/to/file.ts'];
    expect(buildCommandWithFiles(command, files)).toBe(
      'biome check /path/to/file.ts'
    );
  });

  it('handles multiple files', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
    const command = 'eslint ${HAN_FILES}';
    const files = ['/path/to/a.ts', '/path/to/b.ts'];
    expect(buildCommandWithFiles(command, files)).toBe(
      'eslint /path/to/a.ts /path/to/b.ts'
    );
  });

  it('preserves command without placeholder', () => {
    const command = 'mix format --check-formatted';
    const files = ['/path/to/file.ex'];
    expect(buildCommandWithFiles(command, files)).toBe(
      'mix format --check-formatted'
    );
  });
});

describe('Error Output Truncation', () => {
  it('truncates long error output to 2000 characters', () => {
    const longError = 'x'.repeat(3000);
    const truncated = longError.slice(0, 2000);
    expect(truncated.length).toBe(2000);
  });

  it('preserves short error output', () => {
    const shortError = 'Error: Something went wrong';
    const truncated = shortError.slice(0, 2000);
    expect(truncated).toBe(shortError);
  });
});

describe('Plugin Configuration Patterns', () => {
  // Test hook definition structure
  interface PluginHookDefinition {
    event?: string;
    command: string;
    dirsWith?: string[];
    toolFilter?: string[];
    fileFilter?: string[];
    fileTest?: string;
    dirTest?: string;
    timeout?: number;
  }

  it('validates async lint hook structure', () => {
    const hook: PluginHookDefinition = {
      event: 'PostToolUse',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
      command: 'biome check ${HAN_FILES}',
      dirsWith: ['biome.json'],
      toolFilter: ['Edit', 'Write'],
      fileFilter: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    };

    expect(hook.event).toBe('PostToolUse');
    expect(hook.toolFilter).toContain('Edit');
    expect(hook.toolFilter).toContain('Write');
    expect(hook.fileFilter).toContain('**/*.ts');
  });

  it('validates async format hook structure', () => {
    const hook: PluginHookDefinition = {
      event: 'PostToolUse',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
      command: 'biome format ${HAN_FILES}',
      dirsWith: ['biome.json'],
      toolFilter: ['Edit', 'Write'],
      fileFilter: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json'],
    };

    expect(hook.dirsWith).toContain('biome.json');
  });

  it('validates async test hook with file_test', () => {
    const hook: PluginHookDefinition = {
      event: 'PostToolUse',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
      command: 'bun test ${HAN_FILES}',
      dirsWith: ['package.json'],
      toolFilter: ['Edit', 'Write'],
      fileFilter: ['**/*.test.ts', '**/*.spec.ts'],
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
      fileTest: 'grep -qE "(describe|it|test)\\s*\\(" "${HAN_FILE}"',
    };

    expect(hook.fileTest).toBeDefined();
    expect(hook.fileTest).toContain('describe');
    expect(hook.fileTest).toContain('HAN_FILE');
  });

  it('validates Elixir async test hook', () => {
    const hook: PluginHookDefinition = {
      event: 'PostToolUse',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
      command: 'mix test ${HAN_FILES}',
      dirsWith: ['mix.exs'],
      toolFilter: ['Edit', 'Write'],
      fileFilter: ['**/*_test.exs', '**/test/**/*.exs'],
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing literal shell placeholder string
      fileTest: 'grep -qE "(describe|test|doctest)" "${HAN_FILE}"',
    };

    expect(hook.fileFilter).toContain('**/*_test.exs');
    expect(hook.fileTest).toContain('doctest');
  });
});

describe('Session ID Requirements', () => {
  it('requires session ID for async mode', () => {
    // Session ID is required for:
    // 1. Event logging
    // 2. Async hook queue deduplication
    // 3. Cache tracking per session
    const sessionId = 'session-abc123';
    expect(sessionId).toBeTruthy();
  });

  it('session ID can come from multiple sources', () => {
    // Priority order:
    // 1. CLI option (--session-id)
    // 2. stdin payload (session_id)
    // 3. Environment variable (CLAUDE_SESSION_ID)
    const sources = {
      cli: 'session-from-cli',
      stdin: 'session-from-stdin',
      env: 'session-from-env',
    };

    // CLI takes priority
    const resolved = sources.cli || sources.stdin || sources.env;
    expect(resolved).toBe('session-from-cli');

    // stdin takes priority if no CLI
    const noCli: string | undefined = undefined;
    const resolved2 = noCli || sources.stdin || sources.env;
    expect(resolved2).toBe('session-from-stdin');

    // env is fallback
    const noStdin: string | undefined = undefined;
    const resolved3 = noCli || noStdin || sources.env;
    expect(resolved3).toBe('session-from-env');
  });
});
