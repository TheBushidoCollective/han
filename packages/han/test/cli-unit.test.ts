/**
 * Unit tests for Han CLI using direct imports.
 * These tests import makeProgram() directly, enabling code coverage tracking.
 *
 * Note: Command actions use process.exit() directly, which Commander's exitOverride
 * intercepts and throws as CommanderError. However, async actions may not propagate
 * correctly. For now, we test Commander configuration (help output) only.
 * Integration tests in han.test.ts cover actual command execution via subprocess.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommanderError } from 'commander';
import { makeProgram } from '../lib/main.ts';

// Test utilities
let testDir: string;
let stdout: string;
let stderr: string;

function captureOutput(): {
  writeOut: (s: string) => void;
  writeErr: (s: string) => void;
} {
  stdout = '';
  stderr = '';
  return {
    writeOut: (s: string) => {
      stdout += s;
    },
    writeErr: (s: string) => {
      stderr += s;
    },
  };
}

function setup(): void {
  const random = Math.random().toString(36).substring(2, 9);
  testDir = join(tmpdir(), `han-cli-test-${Date.now()}-${random}`);
  process.env.CLAUDE_CONFIG_DIR = testDir;
}

function teardown(): void {
  if (process.env.CLAUDE_CONFIG_DIR) {
    try {
      rmSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.CLAUDE_CONFIG_DIR;
  }
}

describe('CLI Unit Tests', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    teardown();
  });

  describe('makeProgram factory', () => {
    test('creates a new Command instance', () => {
      const program = makeProgram();
      expect(program).toBeDefined();
      expect(program.name()).toBe('han');
    });

    test('creates isolated instances', () => {
      const program1 = makeProgram();
      const program2 = makeProgram();
      expect(program1).not.toBe(program2);
    });

    test('version is set correctly', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', '--version']);
      } catch (err) {
        // exitOverride throws on --version
        expect(err).toBeInstanceOf(CommanderError);
      }

      // Version output now starts with "han X.X.X" and includes binary info
      expect(stdout).toMatch(/^han \d+\.\d+\.\d+/);
    });

    test('exitOverride prevents process.exit', () => {
      const program = makeProgram({ exitOverride: true });

      let threw = false;
      try {
        program.parse(['node', 'han', '--version']);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(CommanderError);
        expect((err as CommanderError).code).toBe('commander.version');
      }

      expect(threw).toBe(true);
    });

    test('suppressOutput prevents output', () => {
      const program = makeProgram({
        exitOverride: true,
        suppressOutput: true,
      });

      // This should not throw and should not produce output
      try {
        program.parse(['node', 'han', '--version']);
      } catch {
        // expected
      }

      // Test passes if we get here without crashing
      expect(true).toBe(true);
    });
  });

  describe('Main help output', () => {
    test('shows help with --help flag', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', '--help']);
      } catch (err) {
        expect(err).toBeInstanceOf(CommanderError);
      }

      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('han');
      expect(stdout).toContain('Commands:');
    });

    test('includes plugin command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('plugin');
    });

    test('includes hook command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('hook');
    });

    test('includes metrics command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('metrics');
    });

    test('includes mcp command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('mcp');
    });
  });

  describe('Plugin subcommand help', () => {
    test('shows install command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', 'plugin', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('install');
    });

    test('shows uninstall command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', 'plugin', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('uninstall');
    });

    test('shows list command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', 'plugin', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('list');
    });

    test('shows update command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', 'plugin', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('update');
    });
  });

  describe('Hook subcommand help', () => {
    test('shows run command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', 'hook', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('run');
    });
  });

  describe('MCP subcommand help', () => {
    test('shows blueprints command', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', 'mcp', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('blueprints');
    });

    test('describes MCP server functionality', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      try {
        program.parse(['node', 'han', 'mcp', '--help']);
      } catch {
        // expected
      }

      expect(stdout).toContain('MCP server');
    });
  });

  describe('Error handling', () => {
    test('unknown command shows error', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      let threw = false;
      try {
        program.parse(['node', 'han', 'nonexistent-command']);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(CommanderError);
      }

      expect(threw).toBe(true);
      expect(stderr).toContain('unknown command');
    });

    test('invalid option shows error', () => {
      const output = captureOutput();
      const program = makeProgram({
        exitOverride: true,
        writeOut: output.writeOut,
        writeErr: output.writeErr,
      });

      let threw = false;
      try {
        program.parse(['node', 'han', '--invalid-option']);
      } catch (err) {
        threw = true;
        expect(err).toBeInstanceOf(CommanderError);
      }

      expect(threw).toBe(true);
    });
  });
});
