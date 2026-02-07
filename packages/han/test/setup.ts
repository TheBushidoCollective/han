// Test setup - runs before all tests
import { afterAll, beforeAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetHanDataDir } from '../lib/config/claude-settings.ts';

// Store the original value to restore after tests
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

// Create a temporary directory for CLAUDE_CONFIG_DIR
// This prevents tests from polluting the user's ~/.claude directory
const testConfigDir = mkdtempSync(join(tmpdir(), 'han-test-'));

beforeAll(() => {
  // Set CLAUDE_CONFIG_DIR to temp directory for all tests
  // getHanDataDir() respects this and uses CLAUDE_CONFIG_DIR/han
  process.env.CLAUDE_CONFIG_DIR = testConfigDir;
  resetHanDataDir();
});

afterAll(() => {
  // Restore original CLAUDE_CONFIG_DIR
  if (originalClaudeConfigDir !== undefined) {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
  } else {
    delete process.env.CLAUDE_CONFIG_DIR;
  }
  resetHanDataDir();

  // Clean up the temporary directory
  try {
    rmSync(testConfigDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});
