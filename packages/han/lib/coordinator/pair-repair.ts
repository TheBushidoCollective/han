import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  COORDINATOR_SHA256,
  HAN_BUILD_KIND,
  HAN_VERSION,
} from '../build-info.generated.ts';
import { findCoordinatorBinary } from './binary.ts';
import { getCoordinatorDataDir } from './connection.ts';
import { CoordinatorSecurityError } from './errors.ts';

const MAX_DOWNLOAD_SIZE = 256 * 1024 * 1024; // 256 MiB
const SIX_HOURS_MS = 6 * 3600 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

interface RepairEligibility {
  eligible: boolean;
  targetDir?: string;
  reason?: string;
}

function isPidAlive(pid: number): boolean {
  if (pid <= 0 || !Number.isInteger(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function checkRepairEligibility(): RepairEligibility {
  if (process.platform === 'win32') {
    return {
      eligible: false,
      reason: 'Self-repair is not supported on Windows.',
    };
  }

  if (
    HAN_BUILD_KIND !== 'release' ||
    typeof COORDINATOR_SHA256 !== 'string' ||
    COORDINATOR_SHA256.length !== 64
  ) {
    return {
      eligible: false,
      reason: 'Self-repair is only available in release builds.',
    };
  }

  const home = process.env.HOME;
  if (!home) {
    return {
      eligible: false,
      reason: 'HOME environment variable is not set.',
    };
  }

  let realExec: string;
  try {
    realExec = realpathSync(process.execPath);
  } catch {
    return {
      eligible: false,
      reason: 'Could not resolve executable path.',
    };
  }

  let realHome: string;
  try {
    realHome = realpathSync(home);
  } catch {
    realHome = home;
  }

  const allowedBins = [
    resolve(realHome, '.local/bin'),
    resolve(realHome, '.claude/bin'),
  ];

  let targetDir: string | undefined;
  for (const bin of allowedBins) {
    const directPath = join(bin, 'han');
    if (realExec === directPath) {
      targetDir = bin;
      break;
    }

    const releasesDir = join(bin, '.han-releases');
    if (realExec.startsWith(`${releasesDir}/`)) {
      const parts = realExec.slice(releasesDir.length + 1).split('/');
      if (parts.length === 2 && parts[1] === 'han') {
        targetDir = dirname(realExec);
        break;
      }
    }
  }

  if (!targetDir) {
    return {
      eligible: false,
      reason:
        'Binary is not located in $HOME/.local/bin or $HOME/.claude/bin. Please reinstall using: curl -fsSL https://han.guru/install.sh | bash',
    };
  }

  try {
    const st = lstatSync(targetDir);
    if (!st.isDirectory() || st.isSymbolicLink()) {
      return {
        eligible: false,
        reason: 'Install directory is not a regular directory.',
      };
    }
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
      return {
        eligible: false,
        reason: 'Install directory is not owned by the current user.',
      };
    }
    if ((st.mode & 0o022) !== 0) {
      return {
        eligible: false,
        reason:
          'Install directory is group- or world-writable. Tighten permissions (chmod 0755) and try again.',
      };
    }
  } catch (err) {
    return {
      eligible: false,
      reason: `Could not verify install directory permissions: ${err}`,
    };
  }

  return { eligible: true, targetDir };
}

function getPlatformAsset(): string {
  const os = process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch;
  return `han-coordinator-${os}-${arch}`;
}

async function downloadWithRedirects(
  initialUrl: URL,
  maxBytes: number
): Promise<Uint8Array> {
  let currentUrl = initialUrl;
  for (let redirects = 0; redirects < 5; redirects++) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000), // 120s timeout
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const loc = response.headers.get('location');
      if (!loc) throw new Error('Missing location header on redirect');
      const nextUrl = new URL(loc, currentUrl);
      const isAllowedHost =
        nextUrl.hostname === 'github.com' ||
        nextUrl.hostname.endsWith('.github.com') ||
        nextUrl.hostname === 'githubusercontent.com' ||
        nextUrl.hostname.endsWith('.githubusercontent.com') ||
        (nextUrl.hostname === '127.0.0.1' &&
          initialUrl.hostname === '127.0.0.1');

      if (!isAllowedHost) {
        throw new CoordinatorSecurityError(
          `Unauthorized redirect domain: ${nextUrl.hostname}`
        );
      }
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing response body');

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > maxBytes) {
          throw new CoordinatorSecurityError(
            `Download exceeded size limit of ${maxBytes} bytes`
          );
        }
        chunks.push(value);
      }
    }

    const total = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      total.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return total;
  }
  throw new Error('Too many redirects');
}

export async function repairCoordinator(): Promise<boolean> {
  if (process.env.HAN_COORDINATOR_REPAIR === 'off') {
    return false;
  }

  try {
    const eligibility = checkRepairEligibility();
    if (!eligibility.eligible || !eligibility.targetDir) {
      console.error(`[repair] ${eligibility.reason}`);
      return false;
    }

    const dataDir = getCoordinatorDataDir();
    const repairDir = join(dataDir, 'repair');
    if (!existsSync(repairDir)) {
      mkdirSync(repairDir, { recursive: true, mode: 0o700 });
    }

    const statePath = join(repairDir, 'repair-state.json');
    try {
      if (existsSync(statePath)) {
        const stateContent = JSON.parse(readFileSync(statePath, 'utf8'));
        if (
          stateContent &&
          typeof stateContent === 'object' &&
          stateContent.version === HAN_VERSION &&
          typeof stateContent.lastAttemptMs === 'number' &&
          Date.now() - stateContent.lastAttemptMs < SIX_HOURS_MS
        ) {
          return false;
        }
      }
    } catch {
      // ignore parse errors
    }

    const lockPath = join(repairDir, 'repair.lock');
    let lockFd: number | null = null;

    // Attempt to acquire lock, handling stale lock takeover
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        lockFd = openSync(
          lockPath,
          constants.O_CREAT |
            constants.O_EXCL |
            constants.O_WRONLY |
            (constants.O_NOFOLLOW || 0),
          0o600
        );
        const lockPayload = JSON.stringify({
          pid: process.pid,
          createdMs: Date.now(),
        });
        writeFileSync(lockFd, lockPayload);
        fsyncSync(lockFd);
        break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          // Check for stale lock
          try {
            const rawLock = readFileSync(lockPath, 'utf8');
            const parsed = JSON.parse(rawLock);
            const isStale =
              typeof parsed.createdMs === 'number' &&
              Date.now() - parsed.createdMs > FIFTEEN_MINUTES_MS;
            const isDead =
              typeof parsed.pid === 'number' && !isPidAlive(parsed.pid);
            if (isStale || isDead) {
              const staleRename = `${lockPath}.stale.${randomBytes(4).toString('hex')}`;
              try {
                renameSync(lockPath, staleRename);
                continue;
              } catch {
                // racing takeover
              }
            }
          } catch {
            // invalid lock file
          }
          return false; // Another repair in flight
        }
        return false;
      }
    }

    if (lockFd === null) {
      return false;
    }

    let tmpPath: string | null = null;

    try {
      // Record started attempt before downloading
      try {
        writeFileSync(
          statePath,
          JSON.stringify({
            version: HAN_VERSION,
            status: 'started',
            lastAttemptMs: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      const rawBase =
        process.env.HAN_RELEASE_DOWNLOAD_BASE ||
        'https://github.com/TheBushidoCollective/han/releases/download';
      const baseUrl = new URL(rawBase);
      const isAllowedBase =
        (baseUrl.protocol === 'https:' &&
          (baseUrl.hostname === 'github.com' ||
            baseUrl.hostname.endsWith('.github.com'))) ||
        (baseUrl.protocol === 'http:' && baseUrl.hostname === '127.0.0.1');

      if (!isAllowedBase) {
        throw new CoordinatorSecurityError(
          `Invalid download base URL: ${rawBase}. Only https://... or http://127.0.0.1:<port> allowed.`
        );
      }

      const assetName = getPlatformAsset();
      const versionTag = `v${HAN_VERSION.replace(/^v/, '')}`;
      const downloadUrl = new URL(
        `${baseUrl.pathname.replace(/\/$/, '')}/${versionTag}/${assetName}`,
        baseUrl
      );

      console.log(`[repair] Downloading coordinator from ${downloadUrl}...`);
      const bytes = await downloadWithRedirects(downloadUrl, MAX_DOWNLOAD_SIZE);

      const actualHash = createHash('sha256').update(bytes).digest('hex');
      if (actualHash !== COORDINATOR_SHA256) {
        try {
          writeFileSync(
            statePath,
            JSON.stringify({
              version: HAN_VERSION,
              status: 'hash-mismatch',
              lastAttemptMs: Date.now(),
            })
          );
        } catch {
          // ignore
        }
        throw new CoordinatorSecurityError(
          `Hash verification failed for downloaded coordinator: expected ${COORDINATOR_SHA256}, got ${actualHash}`
        );
      }

      const targetDir = eligibility.targetDir;
      const rand = randomBytes(6).toString('hex');
      tmpPath = join(targetDir, `.han-coordinator.${rand}.tmp`);
      const tmpFd = openSync(
        tmpPath,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          (constants.O_NOFOLLOW || 0),
        0o700
      );
      try {
        writeFileSync(tmpFd, bytes);
        fsyncSync(tmpFd);
      } finally {
        closeSync(tmpFd);
      }

      chmodSync(tmpPath, 0o755);
      const finalPath = join(targetDir, 'han-coordinator');
      renameSync(tmpPath, finalPath);
      tmpPath = null; // Successfully renamed

      // fsync target directory
      try {
        const dirFd = openSync(targetDir, constants.O_RDONLY);
        try {
          fsyncSync(dirFd);
        } finally {
          closeSync(dirFd);
        }
      } catch {
        // ignore dir fsync if unsupported
      }

      // Verify selector finds the new file
      const resolved = findCoordinatorBinary();
      if (resolved !== finalPath) {
        const asidePath = `${finalPath}.aside.${randomBytes(4).toString('hex')}`;
        try {
          renameSync(finalPath, asidePath);
        } catch {
          // ignore
        }
        try {
          writeFileSync(
            statePath,
            JSON.stringify({
              version: HAN_VERSION,
              status: 'post-verify-failed',
              lastAttemptMs: Date.now(),
            })
          );
        } catch {
          // ignore
        }
        return false;
      }

      console.log(`[repair] Repaired han-coordinator at ${finalPath}`);
      try {
        writeFileSync(
          statePath,
          JSON.stringify({
            version: HAN_VERSION,
            status: 'success',
            lastAttemptMs: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      return true;
    } catch (downloadErr) {
      console.error(`[repair] Download or verification failed: ${downloadErr}`);
      return false;
    } finally {
      if (tmpPath && existsSync(tmpPath)) {
        try {
          unlinkSync(tmpPath);
        } catch {
          // ignore
        }
      }
      if (lockFd !== null) {
        try {
          closeSync(lockFd);
        } catch {
          // ignore
        }
        try {
          const current = readFileSync(lockPath, 'utf8');
          if (JSON.parse(current).pid === process.pid) {
            unlinkSync(lockPath);
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error(`[repair] Unexpected error: ${err}`);
    return false;
  }
}
