import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { COORDINATOR_SHA256, HAN_BUILD_KIND } from '../build-info.generated.ts';

const hashCache = new Map<string, string>();

function isPinValid(pin: string | null): pin is string {
  return typeof pin === 'string' && /^[0-9a-f]{64}$/i.test(pin);
}

function verifyCandidate(filePath: string): boolean {
  if (HAN_BUILD_KIND !== 'release') {
    if (!isPinValid(COORDINATOR_SHA256)) return true;
  } else if (!isPinValid(COORDINATOR_SHA256)) {
    return false; // Release build with invalid pin accepts nothing
  }

  try {
    const st = statSync(filePath, { bigint: true });
    if (!st.isFile()) return false;

    if (HAN_BUILD_KIND === 'release' && process.platform !== 'win32') {
      const currentUid =
        typeof process.getuid === 'function' ? BigInt(process.getuid()) : null;
      if (currentUid !== null && st.uid !== currentUid && st.uid !== 0n) {
        return false;
      }
      const mode = Number(st.mode);
      if ((mode & 0o022) !== 0) {
        return false;
      }

      const dirPath = dirname(filePath);
      const dirSt = statSync(dirPath, { bigint: true });
      if (!dirSt.isDirectory()) return false;
      if (currentUid !== null && dirSt.uid !== currentUid && dirSt.uid !== 0n) {
        return false;
      }
      const dirMode = Number(dirSt.mode);
      if ((dirMode & 0o022) !== 0) {
        return false;
      }
    }

    if (!isPinValid(COORDINATOR_SHA256)) return true;

    const cacheKey = `${st.dev}:${st.ino}:${st.size}:${st.mtimeNs}:${st.ctimeNs}`;
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
  const isRelease = HAN_BUILD_KIND === 'release';
  if (isRelease && !isPinValid(COORDINATOR_SHA256)) {
    return null; // A release build with an invalid pin returns nothing at all
  }

  const home =
    process.env.HOME ||
    process.env.USERPROFILE ||
    (process.platform === 'win32' ? '' : '/tmp');
  const binaryName =
    process.platform === 'win32' ? 'han-coordinator.exe' : 'han-coordinator';
  const os = process.platform === 'darwin' ? 'darwin' : 'linux';
  const suffixedBinary =
    process.platform === 'win32'
      ? 'han-coordinator-windows-x64.exe'
      : `han-coordinator-${os}-${process.arch}`;

  try {
    const siblingDir = dirname(realpathSync(process.execPath));
    const sibling = join(siblingDir, binaryName);
    if (existsSync(sibling) && verifyCandidate(sibling)) return sibling;
    const suffixed = join(siblingDir, suffixedBinary);
    if (existsSync(suffixed) && verifyCandidate(suffixed)) return suffixed;
  } catch {}

  // In release builds, Windows stays sibling-only.
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
        if (existsSync(localBin) && verifyCandidate(localBin)) return localBin;
      }
    } catch {}
  }

  const hanBin =
    process.platform !== 'win32' || isAbsolute(home)
      ? join(home, '.han', 'bin', binaryName)
      : '';
  if (existsSync(hanBin) && verifyCandidate(hanBin)) return hanBin;

  if (process.platform === 'win32') return null;

  try {
    const pkgName = `@thebushidocollective/han-${process.platform}-${process.arch}`;
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const pkgPath = join(dirname(pkgJsonPath), binaryName);
    if (existsSync(pkgPath) && verifyCandidate(pkgPath)) return pkgPath;
  } catch {}

  try {
    const result = Bun.spawnSync(['which', binaryName], {
      stdout: 'pipe',
      stderr: 'ignore',
      env: process.env,
    });
    if (result.exitCode === 0) {
      const path = result.stdout.toString().trim();
      if (path && existsSync(path) && verifyCandidate(path)) return path;
    }
  } catch {}

  return null;
}
