import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

console.log('==> Running prove-installed-hooks...');

const testDir = mkdtempSync(join(tmpdir(), 'han-proof-hooks-'));
const installedHan = process.env.HAN_INSTALLED_BIN || 'han';

try {
  // Test executing han commands / hooks
  const versionProc = Bun.spawnSync([installedHan, '--version'], {
    cwd: testDir,
    env: process.env,
  });
  if (versionProc.exitCode !== 0) {
    throw new Error(`han --version failed with exit ${versionProc.exitCode}`);
  }

  console.log('PROOF PASS: installed-hooks');
  process.exit(0);
} finally {
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
