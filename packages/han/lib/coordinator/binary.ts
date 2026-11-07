import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

let COORDINATOR_SHA256: string | null = null;
try {
  const buildInfo = await import('../build-info.generated.ts');
  COORDINATOR_SHA256 =
    'COORDINATOR_SHA256' in buildInfo
      ? (buildInfo.COORDINATOR_SHA256 as string | null)
      : null;
} catch {}

const hashCache = new Map<string, string>();

function verifyCandidateHash(filePath: string): boolean {
  if (
    typeof COORDINATOR_SHA256 !== 'string' ||
    COORDINATOR_SHA256.length !== 64
  ) {
    return true; // Dev builds behave as today
  }
  try {
    const st = statSync(filePath);
    if (!st.isFile()) return false;
    const cacheKey = `${st.dev}:${st.ino}:${st.size}:${st.mtimeMs}`;
    let hash = hashCache.get(cacheKey);
    if (!hash) {
      const bytes = readFileSync(filePath);
      hash = createHash('sha256').update(bytes).digest('hex');
      hashCache.set(cacheKey, hash);
    }
    return hash === COORDINATOR_SHA256;
  } catch {
    return false;
  }
}

/** Locate the coordinator, preferring the installed sibling of the running executable. */
export function findCoordinatorBinary(): string | null {
  const home =
    process.env.HOME ||
    process.env.USERPROFILE ||
    (process.platform === 'win32' ? '' : '/tmp');
  const binaryName =
    process.platform === 'win32' ? 'han-coordinator.exe' : 'han-coordinator';
  try {
    const sibling = join(dirname(realpathSync(process.execPath)), binaryName);
    if (existsSync(sibling) && verifyCandidateHash(sibling)) return sibling;
  } catch {}
  const isRelease =
    typeof COORDINATOR_SHA256 === 'string' && COORDINATOR_SHA256.length === 64;
  // In release builds, Windows stays sibling-only, with the same hash check.
  if (isRelease && process.platform === 'win32') return null;

  const mainFile = process.argv[1] || '';
  if (
    (mainFile.endsWith('.ts') || mainFile.endsWith('.tsx')) &&
    (process.platform !== 'win32' || isAbsolute(import.meta.dir))
  ) {
    try {
      const moduleDir =
        process.platform === 'win32'
          ? realpathSync(import.meta.dir)
          : import.meta.dir;
      const pkgRoot = resolve(moduleDir, '..', '..', '..');
      for (const profile of ['release', 'debug']) {
        const localBin = join(pkgRoot, 'han-rs', 'target', profile, binaryName);
        if (existsSync(localBin) && verifyCandidateHash(localBin))
          return localBin;
      }
    } catch {}
  }
  const hanBin =
    process.platform !== 'win32' || isAbsolute(home)
      ? join(home, '.han', 'bin', binaryName)
      : '';
  if (existsSync(hanBin) && verifyCandidateHash(hanBin)) return hanBin;
  // Windows local-runtime requests carry privileged data. `where` searches the
  // working directory, and package resolution can also depend on the caller's
  // environment. Installed Windows packages put the native binary beside the
  // executable; do not fall back to either search mechanism there.
  if (process.platform === 'win32') return null;
  try {
    const pkgName = `@thebushidocollective/han-${process.platform}-${process.arch}`;
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const pkgPath = join(dirname(pkgJsonPath), binaryName);
    if (existsSync(pkgPath) && verifyCandidateHash(pkgPath)) return pkgPath;
  } catch {}
  try {
    const result = Bun.spawnSync(['which', binaryName], {
      stdout: 'pipe',
      stderr: 'ignore',
      env: process.env,
    });
    if (result.exitCode === 0) {
      const path = result.stdout.toString().trim();
      if (path && existsSync(path) && verifyCandidateHash(path)) return path;
    }
  } catch {}
  return null;
}
