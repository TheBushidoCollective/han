// Test setup - runs before all tests
import { afterAll, beforeAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetHanDataDir } from '../lib/config/claude-settings.ts';

// Capture real implementations of modules that other test files commonly
// mock via mock.module(). Bun shares mock.module() state across test files,
// so files that mock these modules need to restore the real impl in an
// afterAll to keep subsequent files from inheriting an incomplete stub.
// Captured here at preload (before any test file mocks anything) so the
// reference always points at the real exports.
export const realGrpcClient = await import('../lib/grpc/client.ts');

// Store the original value to restore after tests
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

// Create a temporary directory for CLAUDE_CONFIG_DIR
// This prevents tests from polluting the user's ~/.claude directory
const testConfigDir = mkdtempSync(join(tmpdir(), 'han-test-'));

// Native module has been replaced by Rust coordinator + gRPC.
// SKIP_NATIVE is always true now.
export const NATIVE_AVAILABLE = false;
if (!process.env.SKIP_NATIVE) {
  process.env.SKIP_NATIVE = 'true';
}

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
