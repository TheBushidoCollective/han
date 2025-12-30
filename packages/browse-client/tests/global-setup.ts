/**
 * Global setup for Playwright tests
 *
 * Creates test data by running a Claude session in a temp directory.
 * This ensures tests that require sessions have data to work with.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Store temp dir path for cleanup
let tempConfigDir: string | null = null;

export default async function globalSetup() {
  // Create a temp directory for Claude config
  tempConfigDir = mkdtempSync(join(tmpdir(), 'han-test-'));
  const claudeDir = join(tempConfigDir, '.claude');
  mkdirSync(claudeDir, { recursive: true });

  console.log(`\n[global-setup] Using temp CLAUDE_HOME: ${tempConfigDir}`);

  // Set environment variable for the test process
  process.env.CLAUDE_HOME = tempConfigDir;
  process.env.HAN_TEST_CONFIG_DIR = tempConfigDir;

  // Check if claude command is available
  try {
    execSync('which claude', { stdio: 'ignore' });
  } catch {
    console.log(
      '[global-setup] Claude CLI not found - skipping session seed data'
    );
    return;
  }

  // Run a quick Claude session to generate some test data
  console.log('[global-setup] Creating test session data...');

  try {
    // Run a simple Claude command to create session data
    // Using -p for non-interactive mode and --no-confirm to skip confirmations
    const result = execSync(
      'claude -p "Write a hello world text file called hello.txt with the content Hello, World!" --no-confirm',
      {
        env: {
          ...process.env,
          CLAUDE_HOME: tempConfigDir,
          HOME: tempConfigDir,
        },
        timeout: 60000, // 60 second timeout
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    console.log('[global-setup] Test session created successfully');
    console.log(`${result.toString().substring(0, 200)}...`);
  } catch (error) {
    // Don't fail the setup if Claude command fails - tests should handle missing data
    console.log(
      '[global-setup] Could not create test session (tests will handle missing data):',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  console.log('[global-setup] Setup complete\n');
}

export function getTestConfigDir(): string | null {
  return tempConfigDir;
}
