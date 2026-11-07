import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

console.log('==> Running prove-installer...');

const testHome = mkdtempSync(join(tmpdir(), 'han-proof-installer-'));
const testBin = join(testHome, '.local', 'bin');
const installerPath =
  process.env.HAN_PROOF_INSTALLER ||
  join(import.meta.dir, '../../../../website/public/install.sh');

try {
  // Test 1: Fresh install
  console.log('Testing fresh install...');
  const env = {
    ...process.env,
    HOME: testHome.replaceAll('\\', '/'),
    USERPROFILE: testHome.replaceAll('\\', '/'),
    HAN_INSTALL_DIR: testBin.replaceAll('\\', '/'),
  };

  const proc1 = Bun.spawnSync(['bash', installerPath], {
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (proc1.exitCode !== 0) {
    throw new Error(`Fresh install failed with exit code ${proc1.exitCode}`);
  }

  const binarySuffix = process.platform === 'win32' ? '.exe' : '';
  const installedHan = join(testBin, `han${binarySuffix}`);
  if (!existsSync(installedHan)) {
    throw new Error(`Installed binary not found at ${installedHan}`);
  }

  // Test 2: Verify binary runs
  const versionProc = Bun.spawnSync([installedHan, '--version'], { env });
  console.log(
    `Installed version output: ${versionProc.stdout.toString().trim()}`
  );

  // Test 3: Multiple installs prune to 2 pairs on POSIX
  if (process.platform !== 'win32') {
    console.log('Testing successive installs for pair pruning...');
    Bun.spawnSync(['bash', installerPath], { env });
    Bun.spawnSync(['bash', installerPath], { env });

    const releasesDir = join(testBin, '.han-releases');
    if (existsSync(releasesDir)) {
      const releases = readdirSync(releasesDir).filter((d) =>
        d.startsWith('.han-install.')
      );
      console.log(
        `Found ${releases.length} releases in .han-releases (expected <= 2)`
      );
      if (releases.length > 2) {
        throw new Error(
          `Expected at most 2 releases, found ${releases.length}`
        );
      }
    }
  }

  console.log('PROOF PASS: installer');
  process.exit(0);
} finally {
  try {
    rmSync(testHome, { recursive: true, force: true });
  } catch {}
}
