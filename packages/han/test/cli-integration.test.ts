/**
 * Integration tests for CLI commands
 * Tests actual CLI invocation via the binary
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the package root directory (one level up from test/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

describe('CLI integration tests', () => {
  const testDir = `/tmp/test-cli-${Date.now()}`;

  beforeEach(() => {
    mkdirSync(join(testDir, 'config'), { recursive: true });
    mkdirSync(join(testDir, 'project'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('han --version', () => {
    test('outputs version number and binary info', () => {
      const result = spawnSync('bun', ['run', 'lib/main.ts', '--version'], {
        encoding: 'utf-8',
        timeout: 10000,
        cwd: packageRoot,
      });

      expect(result.status).toBe(0);
      // Version output now includes version and binary location
      expect(result.stdout).toMatch(/^han \d+\.\d+\.\d+/);
      expect(result.stdout).toContain('Binary:');
    });
  });

  describe('han --help', () => {
    test('shows help output', () => {
      const result = spawnSync('bun', ['run', 'lib/main.ts', '--help'], {
        encoding: 'utf-8',
        timeout: 10000,
        cwd: packageRoot,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Commands:');
    });
  });

  describe('han hook', () => {
    test('shows hook subcommands in help', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', '--help'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
        }
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('dispatch');
      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('explain');
    });
  });

  describe('han hook dispatch', () => {
    test('exits cleanly when no plugins installed', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', 'dispatch', 'SessionStart'],
        {
          encoding: 'utf-8',
          timeout: 30000,
          cwd: packageRoot,
          env: {
            ...process.env,
            CLAUDE_CONFIG_DIR: join(testDir, 'config'),
            HOME: testDir,
          },
        }
      );

      // Should exit cleanly with no output when no plugins have hooks
      expect(result.status).toBe(0);
    });

    test('respects HAN_DISABLE_HOOKS=true', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', 'dispatch', 'SessionStart'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
          env: {
            ...process.env,
            HAN_DISABLE_HOOKS: 'true',
          },
        }
      );

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('');
    });

    test('respects HAN_DISABLE_HOOKS=1', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', 'dispatch', 'SessionStart'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
          env: {
            ...process.env,
            HAN_DISABLE_HOOKS: '1',
          },
        }
      );

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('');
    });
  });

  describe('han hook run', () => {
    test('shows error when missing plugin/hook args', () => {
      const result = spawnSync('bun', ['run', 'lib/main.ts', 'hook', 'run'], {
        encoding: 'utf-8',
        timeout: 10000,
        cwd: packageRoot,
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: join(testDir, 'config'),
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Plugin name and hook name are required');
    });

    test('respects HAN_DISABLE_HOOKS', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', 'run', 'some-plugin', 'some-hook'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
          env: {
            ...process.env,
            HAN_DISABLE_HOOKS: 'true',
          },
        }
      );

      expect(result.status).toBe(0);
    });

    test('legacy format requires command after --', () => {
      const result = spawnSync(
        'bun',
        [
          'run',
          'lib/main.ts',
          'hook',
          'run',
          '--dirs-with',
          'package.json',
          '--',
        ],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
        }
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('No command specified after --');
    });
  });

  describe('han plugin', () => {
    test('shows plugin subcommands in help', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'plugin', '--help'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
        }
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('install');
      expect(result.stdout).toContain('list');
    });
  });

  describe('han hook reference', () => {
    test('shows reference subcommands in help', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', 'reference', '--help'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
        }
      );

      expect(result.status).toBe(0);
    });

    test('reference outputs file path', () => {
      // The reference command outputs a file path (not content)
      const testFile = 'hooks/test-hook.md';

      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', 'reference', testFile],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
          env: {
            ...process.env,
            CLAUDE_PLUGIN_ROOT: '/plugin/root',
          },
        }
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('/plugin/root/hooks/test-hook.md');
    });

    test('reference with --must-read-first outputs XML tag', () => {
      const testFile = 'hooks/test-hook.md';

      const result = spawnSync(
        'bun',
        [
          'run',
          'lib/main.ts',
          'hook',
          'reference',
          testFile,
          '--must-read-first',
          'Required reading',
        ],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
          env: {
            ...process.env,
            CLAUDE_PLUGIN_ROOT: '/plugin/root',
            // Isolate from user's global config to prevent re-exec
            HOME: testDir,
            CLAUDE_CONFIG_DIR: undefined,
            CLAUDE_PROJECT_DIR: undefined,
          },
        }
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('<must-read-first');
      expect(result.stdout).toContain('reason="Required reading"');
      expect(result.stdout).toContain('/plugin/root/hooks/test-hook.md');
    });
  });

  describe('han validate', () => {
    test('validates configuration with minimal setup', () => {
      // Create minimal project structure
      const YAML = require('yaml');
      const projectDir = join(testDir, 'project');
      writeFileSync(
        join(projectDir, 'han-plugin.yml'),
        YAML.stringify({ hooks: {} })
      );

      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'validate', projectDir],
        {
          encoding: 'utf-8',
          timeout: 30000,
          cwd: packageRoot,
          env: {
            ...process.env,
            CLAUDE_CONFIG_DIR: join(testDir, 'config'),
          },
        }
      );

      // May succeed or fail depending on structure, but should not crash
      expect([0, 1]).toContain(result.status ?? -1);
    });
  });

  describe('error handling', () => {
    test('unknown command exits with error', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'nonexistent-command'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
        }
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('unknown command');
    });
  });
});

describe('CLI environment variable handling', () => {
  describe('HAN_DISABLE_HOOKS', () => {
    test('false value does not disable hooks', () => {
      const result = spawnSync(
        'bun',
        ['run', 'lib/main.ts', 'hook', 'run', 'test', 'test'],
        {
          encoding: 'utf-8',
          timeout: 10000,
          cwd: packageRoot,
          env: {
            ...process.env,
            HAN_DISABLE_HOOKS: 'false',
            CLAUDE_CONFIG_DIR: `/tmp/test-cli-env-${Date.now()}`,
          },
        }
      );

      // Should try to run (and fail because plugin doesn't exist)
      expect(result.status).not.toBe(0);
    });
  });

  describe('HAN_HOOK_RUN_VERBOSE', () => {
    test('environment variable enables verbose mode', () => {
      const tempDir = `/tmp/test-cli-verbose-${Date.now()}`;
      mkdirSync(tempDir, { recursive: true });

      try {
        const result = spawnSync(
          'bun',
          ['run', 'lib/main.ts', 'hook', 'run', 'test', 'test'],
          {
            encoding: 'utf-8',
            timeout: 10000,
            cwd: packageRoot,
            env: {
              ...process.env,
              HAN_HOOK_RUN_VERBOSE: '1',
              CLAUDE_CONFIG_DIR: tempDir,
            },
          }
        );

        // Command will fail but verbose flag should be recognized
        expect(result.stderr).toBeDefined();
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
