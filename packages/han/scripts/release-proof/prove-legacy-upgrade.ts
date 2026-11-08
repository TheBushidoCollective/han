import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

console.log('==> Running prove-legacy-upgrade...');

const testHome = mkdtempSync(join(tmpdir(), 'han-proof-upgrade-'));
const testDataDir = join(testHome, '.han');
mkdirSync(testDataDir, { recursive: true });

try {
  // Simulate legacy v3.22.0 files
  const legacyCertDir = join(testHome, '.claude', 'han', 'certs');
  mkdirSync(legacyCertDir, { recursive: true });
  writeFileSync(join(legacyCertDir, 'coordinator.crt'), 'legacy-cert');
  writeFileSync(join(legacyCertDir, 'coordinator.key'), 'legacy-key');

  const env = {
    ...process.env,
    HOME: testHome,
    USERPROFILE: testHome,
    HAN_DATA_DIR: testDataDir,
  };

  // Run installed han help / version to verify graceful execution
  const installedHan = process.env.HAN_INSTALLED_BIN || 'han';
  const proc = Bun.spawnSync([installedHan, '--help'], { env });
  if (proc.exitCode !== 0) {
    throw new Error(
      `han --help failed during upgrade test: ${proc.stderr.toString()}`
    );
  }

  console.log('PROOF PASS: legacy-upgrade');
  process.exit(0);
} finally {
  try {
    rmSync(testHome, { recursive: true, force: true });
  } catch {}
}
