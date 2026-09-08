/**
 * Tests for log rotation in lib/commands/coordinator/daemon.ts.
 *
 * ~/.han/coordinator.log grew to 3.4MB / ~51k lines of the same repeated
 * spawn-storm block with no bound. rotateLogIfNeeded() caps it: called
 * before the log stream is opened, both from the background daemon spawn
 * path and from the foreground path.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetHanDataDir } from '../lib/config/claude-settings.ts';
import {
  getLogFilePath,
  LOG_ROTATE_THRESHOLD_BYTES,
  rotateLogIfNeeded,
} from '../lib/commands/coordinator/daemon.ts';

// Each test gets its own HAN_DATA_DIR (highest-priority override in
// getHanDataDir()) so rotation never touches the shared CLAUDE_CONFIG_DIR
// temp dir other test files also write into, and never touches a real
// ~/.han/coordinator.log.
let testDir: string;
let originalHanDataDir: string | undefined;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'han-daemon-log-test-'));
  originalHanDataDir = process.env.HAN_DATA_DIR;
  process.env.HAN_DATA_DIR = testDir;
  resetHanDataDir();
});

afterEach(() => {
  if (originalHanDataDir !== undefined) {
    process.env.HAN_DATA_DIR = originalHanDataDir;
  } else {
    delete process.env.HAN_DATA_DIR;
  }
  resetHanDataDir();
  rmSync(testDir, { recursive: true, force: true });
});

describe('rotateLogIfNeeded', () => {
  test('rotates a log file over the threshold to .1 and leaves a fresh path', () => {
    const logPath = getLogFilePath();
    writeFileSync(logPath, 'x'.repeat(LOG_ROTATE_THRESHOLD_BYTES + 1));

    rotateLogIfNeeded();

    expect(existsSync(logPath)).toBe(false);
    const rotatedPath = `${logPath}.1`;
    expect(existsSync(rotatedPath)).toBe(true);
    expect(statSync(rotatedPath).size).toBe(LOG_ROTATE_THRESHOLD_BYTES + 1);
  });

  test('leaves an under-threshold log file alone', () => {
    const logPath = getLogFilePath();
    writeFileSync(logPath, 'small log content');

    rotateLogIfNeeded();

    expect(existsSync(logPath)).toBe(true);
    expect(readFileSync(logPath, 'utf-8')).toBe('small log content');
    expect(existsSync(`${logPath}.1`)).toBe(false);
  });

  test('replaces an existing .1 rotation on repeated overflow', () => {
    const logPath = getLogFilePath();
    writeFileSync(`${logPath}.1`, 'old rotation');
    const overflowed = 'y'.repeat(LOG_ROTATE_THRESHOLD_BYTES + 1);
    writeFileSync(logPath, overflowed);

    rotateLogIfNeeded();

    expect(readFileSync(`${logPath}.1`, 'utf-8')).toBe(overflowed);
  });

  test('is a no-op, not an error, when no log file exists yet', () => {
    expect(() => rotateLogIfNeeded()).not.toThrow();
    expect(existsSync(getLogFilePath())).toBe(false);
  });
});
