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

// Detect if native module is available
// This is used by tests to skip native-dependent functionality
const __dirname = dirname(fileURLToPath(import.meta.url));
const nativeModulePath = join(__dirname, "..", "native", "han-native.node");
export const NATIVE_AVAILABLE = existsSync(nativeModulePath);

// If native module is not available, set SKIP_NATIVE=true
// This ensures that subprocesses spawned by tests also skip native loading
if (!NATIVE_AVAILABLE && !process.env.SKIP_NATIVE) {
	process.env.SKIP_NATIVE = "true";
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
