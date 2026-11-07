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
import { getCoordinatorDataDir } from './connection.ts';
import { CoordinatorSecurityError } from './errors.ts';

let HAN_VERSION = '0.0.0-dev';
let COORDINATOR_SHA256: string | null = null;
try {
  const buildInfo = await import('../build-info.generated.ts');
  if (buildInfo.HAN_VERSION) HAN_VERSION = buildInfo.HAN_VERSION;
  if ('COORDINATOR_SHA256' in buildInfo)
    COORDINATOR_SHA256 = buildInfo.COORDINATOR_SHA256 ?? null;
} catch {}

const MAX_DOWNLOAD_SIZE = 256 * 1024 * 1024; // 256 MiB
const SIX_HOURS_MS = 6 * 3600 * 1000;

interface RepairEligibility {
  eligible: boolean;
  targetDir?: string;
  reason?: string;
}

export function checkRepairEligibility(): RepairEligibility {
  if (process.platform === 'win32') {
    return {
      eligible: false,
      reason: 'Self-repair is not supported on Windows.',
    };
  }

  if (
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

  const allowedBins = [
    resolve(home, '.local/bin'),
    resolve(home, '.claude/bin'),
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
  const eligibility = checkRepairEligibility();
  if (!eligibility.eligible || !eligibility.targetDir) {
    console.error(`[repair] ${eligibility.reason}`);
    return false;
  }

  const dataDir = getCoordinatorDataDir();
  const runtimeDir = join(dataDir, 'runtime');
  if (!existsSync(runtimeDir)) {
    mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
  }

  const statePath = join(runtimeDir, 'repair-state.json');
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
  } catch {}

  const lockPath = join(runtimeDir, 'repair.lock');
  let lockFd: number;
  try {
    lockFd = openSync(
      lockPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        (constants.O_NOFOLLOW || 0),
      0o600
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      return false; // Another repair in flight
    }
    throw err;
  }

  try {
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
    const downloadUrl = new URL(
      `${baseUrl.pathname.replace(/\/$/, '')}/v${HAN_VERSION}/${assetName}`,
      baseUrl
    );

    console.log(`[repair] Downloading coordinator from ${downloadUrl}...`);
    const bytes = await downloadWithRedirects(downloadUrl, MAX_DOWNLOAD_SIZE);

    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== COORDINATOR_SHA256) {
      throw new CoordinatorSecurityError(
        `Hash verification failed for downloaded coordinator: expected ${COORDINATOR_SHA256}, got ${actualHash}`
      );
    }

    const targetDir = eligibility.targetDir;
    const rand = randomBytes(6).toString('hex');
    const tmpPath = join(targetDir, `.han-coordinator.${rand}.tmp`);
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
    console.log(`[repair] Repaired han-coordinator at ${finalPath}`);

    try {
      writeFileSync(
        statePath,
        JSON.stringify({
          version: HAN_VERSION,
          lastAttemptMs: Date.now(),
        })
      );
    } catch {}

    return true;
  } finally {
    closeSync(lockFd);
    try {
      unlinkSync(lockPath);
    } catch {}
  }
}
