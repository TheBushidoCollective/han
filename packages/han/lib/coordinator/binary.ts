import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Locate the coordinator, preferring the installed sibling of the running executable. */
export function findCoordinatorBinary(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const binaryName = process.platform === 'win32' ? 'han-coordinator.exe' : 'han-coordinator';
  try {
    const sibling = join(dirname(realpathSync(process.execPath)), binaryName);
    if (existsSync(sibling)) return sibling;
  } catch {}
  const mainFile = process.argv[1] || '';
  if (mainFile.endsWith('.ts') || mainFile.endsWith('.tsx')) {
    const pkgRoot = resolve(import.meta.dir, '..', '..', '..');
    for (const profile of ['release', 'debug']) {
      const localBin = join(pkgRoot, 'han-rs', 'target', profile, binaryName);
      if (existsSync(localBin)) return localBin;
    }
  }
  const hanBin = join(home, '.han', 'bin', binaryName);
  if (existsSync(hanBin)) return hanBin;
  try {
    const pkgName = `@thebushidocollective/han-${process.platform}-${process.arch}`;
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const pkgPath = join(dirname(pkgJsonPath), binaryName);
    if (existsSync(pkgPath)) return pkgPath;
  } catch {}
  try {
    const result = Bun.spawnSync([process.platform === 'win32' ? 'where' : 'which', binaryName], { stdout: 'pipe', stderr: 'ignore' });
    if (result.exitCode === 0) {
      const path = result.stdout.toString().trim();
      if (path && existsSync(path)) return path;
    }
  } catch {}
  return null;
}
