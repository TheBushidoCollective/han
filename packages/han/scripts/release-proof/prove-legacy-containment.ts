import type { Server, Subprocess } from 'bun';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

console.log('==> Running prove-legacy-containment...');

const testHome = mkdtempSync(join(tmpdir(), 'han-containment-'));
const testDataDir = join(testHome, '.han');
mkdirSync(testDataDir, { recursive: true });

function portOccupied(port: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const socket = connect({ host: '127.0.0.1', port });
  socket.setTimeout(1000);
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('error', () => resolve(false));
  socket.once('timeout', () => {
    socket.destroy();
    resolve(false);
  });
  return promise;
}

let victim: Subprocess | null = null;
let server: Server | null = null;

try {
  // 1. Spawn a victim process
  victim = Bun.spawn(['bun', '-e', 'setInterval(()=>{},1e9)'], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  const victimPid = victim.pid;
  if (!victimPid || victimPid <= 0) {
    throw new Error(`Failed to spawn valid victim process (PID: ${victimPid})`);
  }

  // 2. Start a TCP listener on 0.0.0.0:41957
  server = Bun.listen({
    hostname: '0.0.0.0',
    port: 41957,
    socket: {
      data() {
        // no-op
      },
      open() {
        // no-op
      },
      close() {
        // no-op
      },
      error() {
        // no-op
      },
    },
  });

  // Verify listener is active
  const isListening = await portOccupied(41957);
  if (!isListening) {
    throw new Error('Test listener failed to bind 0.0.0.0:41957');
  }

  // 3. Write legacy coordinator.lock and coordinator.pid naming victim PID
  writeFileSync(
    join(testDataDir, 'coordinator.lock'),
    JSON.stringify({
      pid: victimPid,
      port: 41957,
      httpsPort: 41957,
      grpcPort: 41958,
      version: '0.1.0',
    })
  );
  writeFileSync(join(testDataDir, 'coordinator.pid'), `${victimPid}\n`);

  // 4. Set environment
  const env: Record<string, string | undefined> = {
    ...process.env,
    HOME: testHome,
    USERPROFILE: testHome,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  // 5. Run han coordinator start --port 41957
  const hanBin = process.env.HAN_INSTALLED_BIN || 'han';
  console.log(`Executing: ${hanBin} coordinator start --port 41957`);
  const startProc = Bun.spawnSync(
    [hanBin, 'coordinator', 'start', '--port', '41957'],
    {
      env: env as Record<string, string>,
    }
  );

  const stdout = startProc.stdout ? startProc.stdout.toString() : '';
  const stderr = startProc.stderr ? startProc.stderr.toString() : '';
  const output = `${stdout}\n${stderr}`;

  // 6. Check victim liveness FIRST
  let victimAlive = false;
  try {
    process.kill(victimPid, 0);
    victimAlive = true;
  } catch {
    victimAlive = false;
  }

  if (!victimAlive) {
    console.error('PROOF FAIL: victim terminated');
    process.exit(1);
  }

  // 7. Check listener is still listening
  const stillListening = await portOccupied(41957);
  if (!stillListening) {
    console.error('PROOF FAIL: listener terminated or closed');
    process.exit(1);
  }

  // 8. Check han exit code and output
  if (startProc.exitCode === 0) {
    console.error(
      `PROOF FAIL: han coordinator start exited 0, expected error:\n${output}`
    );
    process.exit(1);
  }

  if (!output.includes('UPGRADE_REQUIRED')) {
    console.error(
      `PROOF FAIL: expected UPGRADE_REQUIRED in output, got:\n${output}`
    );
    process.exit(1);
  }

  console.log('PROOF PASS: legacy-containment');
  process.exit(0);
} finally {
  if (victim) {
    try {
      victim.kill();
    } catch {
      // ignore
    }
  }
  if (server) {
    try {
      server.stop(true);
    } catch {
      // ignore
    }
  }
  try {
    rmSync(testHome, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
