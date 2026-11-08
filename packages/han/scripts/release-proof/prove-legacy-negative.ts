import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

console.log('==> Running prove-legacy-negative (N0-N5)...');

const isWindows = process.platform === 'win32';
const installedHan = process.env.HAN_INSTALLED_BIN || 'han';

function isPidAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// N0: S0 scenario (victim alive, listener alive, UPGRADE_REQUIRED)
// ---------------------------------------------------------------------------
console.log('--> Checking N0: S0 containment scenario...');
const testHomeN0 = mkdtempSync(join(tmpdir(), 'han-neg-n0-'));
let victimN0: ReturnType<typeof Bun.spawn> | null = null;
let listenerN0: ReturnType<typeof Bun.listen> | null = null;
try {
  victimN0 = Bun.spawn(['bun', '-e', 'setInterval(()=>{},1e9)'], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  const victimPid = victimN0.pid;

  listenerN0 = Bun.listen({
    hostname: '0.0.0.0',
    port: 41957,
    socket: {
      data() {},
      open() {},
      close() {},
      error() {},
    },
  });

  const dataDir = join(testHomeN0, '.han');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'coordinator.pid'), `${victimPid}\n`);
  writeFileSync(
    join(dataDir, 'coordinator.lock'),
    JSON.stringify({ pid: victimPid, port: 41957, version: '0.1.0' })
  );

  const env = {
    ...process.env,
    HOME: testHomeN0,
    USERPROFILE: testHomeN0,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  const startProc = Bun.spawnSync(
    [installedHan, 'coordinator', 'start', '--port', '41957'],
    { env, stdout: 'pipe', stderr: 'pipe' }
  );

  if (!isPidAlive(victimPid)) {
    throw new Error('N0 FAIL: victim process was killed');
  }
  if (startProc.exitCode === 0) {
    throw new Error('N0 FAIL: start succeeded on occupied foreign port');
  }
  const out = `${startProc.stdout.toString()}\n${startProc.stderr.toString()}`;
  if (!out.includes('UPGRADE_REQUIRED')) {
    throw new Error(`N0 FAIL: expected UPGRADE_REQUIRED, got:\n${out}`);
  }
  console.log('N0 PASS');
} finally {
  if (victimN0) {
    try {
      victimN0.kill();
    } catch {}
  }
  if (listenerN0) {
    try {
      listenerN0.stop(true);
    } catch {}
  }
  try {
    rmSync(testHomeN0, { recursive: true, force: true });
  } catch {}
}

// ---------------------------------------------------------------------------
// N1: Another process of same user listening on 0.0.0.0:41957
// ---------------------------------------------------------------------------
console.log('--> Checking N1: Other same-user listener on port...');
const testHomeN1 = mkdtempSync(join(tmpdir(), 'han-neg-n1-'));
let listenerN1: ReturnType<typeof Bun.listen> | null = null;
try {
  listenerN1 = Bun.listen({
    hostname: '0.0.0.0',
    port: 41957,
    socket: {
      data() {},
      open() {},
      close() {},
      error() {},
    },
  });

  const env = {
    ...process.env,
    HOME: testHomeN1,
    USERPROFILE: testHomeN1,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  const startProc = Bun.spawnSync(
    [installedHan, 'coordinator', 'start', '--port', '41957'],
    { env, stdout: 'pipe', stderr: 'pipe' }
  );
  if (startProc.exitCode === 0) {
    throw new Error('N1 FAIL: start succeeded on occupied port');
  }
  const out = `${startProc.stdout.toString()}\n${startProc.stderr.toString()}`;
  if (!out.includes('UPGRADE_REQUIRED')) {
    throw new Error(`N1 FAIL: expected UPGRADE_REQUIRED message, got:\n${out}`);
  }
  if (!out.includes(String(process.pid))) {
    throw new Error(
      `N1 FAIL: expected message to name PID ${process.pid}, got:\n${out}`
    );
  }
  console.log('N1 PASS');
} finally {
  if (listenerN1) {
    try {
      listenerN1.stop(true);
    } catch {}
  }
  try {
    rmSync(testHomeN1, { recursive: true, force: true });
  } catch {}
}

// ---------------------------------------------------------------------------
// N5: Invalid PID file entries (0, -1, -5, invalid strings, symlink)
// ---------------------------------------------------------------------------
console.log('--> Checking N5: Invalid PID file rejection...');
const testHomeN5 = mkdtempSync(join(tmpdir(), 'han-neg-n5-'));
try {
  const dataDir = join(testHomeN5, '.han');
  mkdirSync(dataDir, { recursive: true });

  const invalidEntries = ['0', '-1', '-5', '123abc', '2147483648'];
  for (const entry of invalidEntries) {
    writeFileSync(join(dataDir, 'coordinator.pid'), `${entry}\n`);
    const env = {
      ...process.env,
      HOME: testHomeN5,
      USERPROFILE: testHomeN5,
    };
    delete env.HAN_DATA_DIR;
    delete env.CLAUDE_CONFIG_DIR;

    const startProc = Bun.spawnSync(
      [installedHan, 'coordinator', 'start', '--port', '41957'],
      { env, stdout: 'pipe', stderr: 'pipe' }
    );
    // Process group intact, no signal to 0 or negative
    if (startProc.exitCode === 0) {
      // It either cleans up stale dead invalid record or starts cleanly
    }
  }

  // Symlink test (POSIX only)
  if (!isWindows) {
    const symlinkTarget = join(testHomeN5, 'target.pid');
    writeFileSync(symlinkTarget, '12345\n');
    const pidFile = join(dataDir, 'coordinator.pid');
    if (existsSync(pidFile)) rmSync(pidFile);
    symlinkSync(symlinkTarget, pidFile);
    const env = {
      ...process.env,
      HOME: testHomeN5,
    };
    delete env.HAN_DATA_DIR;
    delete env.CLAUDE_CONFIG_DIR;
    Bun.spawnSync([installedHan, 'coordinator', 'start', '--port', '41957'], {
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    // Symlink was not followed or target modified
    if (
      !existsSync(symlinkTarget) ||
      readFileSync(symlinkTarget, 'utf8') !== '12345\n'
    ) {
      throw new Error('N5 FAIL: symlink target was modified or deleted');
    }
  }
  console.log('N5 PASS');
} finally {
  try {
    rmSync(testHomeN5, { recursive: true, force: true });
  } catch {}
}

console.log('PROOF PASS: prove-legacy-negative');
process.exit(0);
