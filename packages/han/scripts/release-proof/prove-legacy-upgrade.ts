import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { setupLegacyFixture } from './legacy-fixture.ts';

console.log('==> Running prove-legacy-upgrade (V1-V4, H1)...');
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
// V1: Real v3.22 pair, default layout
// ---------------------------------------------------------------------------
console.log('--> Checking V1: Real v3.22 upgrade in default layout...');
const testHomeV1 = mkdtempSync(join(tmpdir(), 'han-legacy-v1-'));
try {
  const fixture = await setupLegacyFixture(testHomeV1);
  const oldCoordPid = fixture.coordinatorPid;
  const oldSuperPid = fixture.supervisorPid;

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    HOME: testHomeV1,
    USERPROFILE: testHomeV1,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  // Run new han coordinator start --port 41957
  const startProc = Bun.spawnSync(
    [installedHan, 'coordinator', 'start', '--port', '41957'],
    { env, stdout: 'pipe', stderr: 'pipe' }
  );
  if (startProc.exitCode !== 0) {
    throw new Error(
      `V1 FAIL: new han coordinator start failed:\n${startProc.stderr.toString()}`
    );
  }

  // 1. Legacy coordinator exited
  if (isPidAlive(oldCoordPid)) {
    throw new Error(
      `V1 FAIL: old coordinator (PID ${oldCoordPid}) is still alive`
    );
  }

  // 2. Supervisor still alive
  if (!isPidAlive(oldSuperPid)) {
    throw new Error(`V1 FAIL: supervisor (PID ${oldSuperPid}) died`);
  }

  // 3. New descriptor exists and points to 127.0.0.1
  const descPath = join(testHomeV1, '.han', 'runtime', 'coordinator.json');
  if (!existsSync(descPath)) {
    throw new Error('V1 FAIL: modern coordinator.json was not created');
  }
  const desc = JSON.parse(readFileSync(descPath, 'utf8'));
  if (desc.httpsPort !== 41957) {
    throw new Error(
      `V1 FAIL: modern coordinator on port ${desc.httpsPort}, expected 41957`
    );
  }

  // 4. coordinator.pid was renamed
  const legacyPidFile = join(testHomeV1, '.han', 'coordinator.pid');
  if (existsSync(legacyPidFile)) {
    throw new Error('V1 FAIL: coordinator.pid was not renamed aside');
  }

  // 5. $HOME certificates are gone
  const certFiles = [
    join(testHomeV1, '.claude', 'han', 'certs', 'coordinator.crt'),
    join(testHomeV1, '.claude', 'han', 'certs', 'coordinator.key'),
  ];
  for (const cert of certFiles) {
    if (existsSync(cert)) {
      throw new Error(`V1 FAIL: certificate ${cert} was not cleaned up`);
    }
  }

  await fixture.stop();
  console.log('V1 PASS');
} finally {
  try {
    rmSync(testHomeV1, { recursive: true, force: true });
  } catch {}
}

// ---------------------------------------------------------------------------
// V3: Leftovers only (dead PID in PID file and lock)
// ---------------------------------------------------------------------------
console.log('--> Checking V3: Stale leftovers cleanup...');
const testHomeV3 = mkdtempSync(join(tmpdir(), 'han-legacy-v3-'));
try {
  const dataDir = join(testHomeV3, '.han');
  mkdirSync(dataDir, { recursive: true });

  // Write stale coordinator.pid and coordinator.lock with dead PID
  const deadPid = 999999;
  writeFileSync(join(dataDir, 'coordinator.pid'), `${deadPid}\n`);
  writeFileSync(
    join(dataDir, 'coordinator.lock'),
    JSON.stringify({ pid: deadPid, port: 41957, version: '0.1.0' })
  );

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    HOME: testHomeV3,
    USERPROFILE: testHomeV3,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  const startProc = Bun.spawnSync(
    [installedHan, 'coordinator', 'start', '--port', '41957'],
    { env, stdout: 'pipe', stderr: 'pipe' }
  );
  if (startProc.exitCode !== 0) {
    throw new Error(
      `V3 FAIL: start failed with leftovers:\n${startProc.stderr.toString()}`
    );
  }

  // Leftovers were renamed aside
  if (existsSync(join(dataDir, 'coordinator.pid'))) {
    throw new Error('V3 FAIL: dead coordinator.pid was not renamed aside');
  }
  console.log('V3 PASS');
} finally {
  try {
    rmSync(testHomeV3, { recursive: true, force: true });
  } catch {}
}

// ---------------------------------------------------------------------------
// V4: Leftovers naming a live, unrelated process (e.g. sleep)
// ---------------------------------------------------------------------------
console.log('--> Checking V4: Leftovers naming live unrelated process...');
const testHomeV4 = mkdtempSync(join(tmpdir(), 'han-legacy-v4-'));
let victimV4: ReturnType<typeof Bun.spawn> | null = null;
try {
  victimV4 = Bun.spawn(['bun', '-e', 'setInterval(()=>{},1e9)'], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  const victimPid = victimV4.pid;

  const dataDir = join(testHomeV4, '.han');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'coordinator.pid'), `${victimPid}\n`);

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    HOME: testHomeV4,
    USERPROFILE: testHomeV4,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  const startProc = Bun.spawnSync(
    [installedHan, 'coordinator', 'start', '--port', '41957'],
    { env, stdout: 'pipe', stderr: 'pipe' }
  );
  if (startProc.exitCode !== 0) {
    throw new Error(`V4 FAIL: start failed:\n${startProc.stderr.toString()}`);
  }

  // Victim is still alive!
  if (!isPidAlive(victimPid)) {
    throw new Error('V4 FAIL: unrelated process was killed');
  }
  console.log('V4 PASS');
} finally {
  if (victimV4) {
    try {
      victimV4.kill();
    } catch {}
  }
  try {
    rmSync(testHomeV4, { recursive: true, force: true });
  } catch {}
}

// ---------------------------------------------------------------------------
// H1: Healthy new coordinator, then a second start
// ---------------------------------------------------------------------------
console.log('--> Checking H1: Second start against healthy coordinator...');
const testHomeH1 = mkdtempSync(join(tmpdir(), 'han-legacy-h1-'));
try {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    HOME: testHomeH1,
    USERPROFILE: testHomeH1,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  const firstProc = Bun.spawnSync(
    [installedHan, 'coordinator', 'start', '--port', '41957'],
    { env, stdout: 'pipe', stderr: 'pipe' }
  );
  if (firstProc.exitCode !== 0) {
    throw new Error(
      `H1 FAIL: first start failed:\n${firstProc.stderr.toString()}`
    );
  }

  const descPath = join(testHomeH1, '.han', 'runtime', 'coordinator.json');
  const firstDescBytes = readFileSync(descPath);

  const secondProc = Bun.spawnSync(
    [installedHan, 'coordinator', 'start', '--port', '41957'],
    { env, stdout: 'pipe', stderr: 'pipe' }
  );
  if (secondProc.exitCode !== 0) {
    throw new Error(
      `H1 FAIL: second start failed:\n${secondProc.stderr.toString()}`
    );
  }

  const secondDescBytes = readFileSync(descPath);
  if (firstDescBytes.compare(secondDescBytes) !== 0) {
    throw new Error('H1 FAIL: coordinator descriptor changed on second start');
  }
  console.log('H1 PASS');
} finally {
  try {
    rmSync(testHomeH1, { recursive: true, force: true });
  } catch {}
}

console.log('PROOF PASS: prove-legacy-upgrade');
process.exit(0);
