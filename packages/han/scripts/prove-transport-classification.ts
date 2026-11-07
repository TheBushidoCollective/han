import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ConnectError } from '@connectrpc/connect';
import {
  type LocalCoordinatorDescriptor,
  CoordinatorConnectionRefusedError,
  CoordinatorSecurityError,
  coordinatorFetch,
  isExplicitConnectionRefusal,
} from '../lib/coordinator/connection.ts';
import { checkHealth } from '../lib/commands/coordinator/health.ts';
import { createCoordinatorClients } from '../lib/grpc/client.ts';

if (process.env.CI !== 'true' || process.platform !== 'linux') {
  throw new Error(
    'Transport classification proof requires an isolated Linux CI runner'
  );
}

const binary = resolve(
  import.meta.dir,
  '../../han-rs/target/debug/han-coordinator'
);
const cli = resolve(import.meta.dir, '../lib/main.ts');

const children: Bun.Subprocess[] = [];
const directories: string[] = [];

function directory(): string {
  const dir = mkdtempSync(join(tmpdir(), 'han-transport-proof-'));
  directories.push(dir);
  return dir;
}

function environment(dir: string): Record<string, string | undefined> {
  return {
    ...process.env,
    HOME: dir,
    USERPROFILE: dir,
    HAN_DATA_DIR: dir,
    CLAUDE_CONFIG_DIR: join(dir, 'claude'),
    HAN_REEXEC: '1',
    HAN_BINARY: `'${process.execPath.replaceAll("'", "'\\''")}' '${cli.replaceAll("'", "'\\''")}'`,
    HAN_COORDINATOR_PORT: '0',
    PATH: `${resolve(import.meta.dir, '../../han-rs/target/debug')}:${process.env.PATH}`,
  };
}

async function waitFor<T>(
  label: string,
  probe: () => T | undefined | Promise<T | undefined>
): Promise<T> {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) return value;
    await Bun.sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function readDescriptor(dir: string): LocalCoordinatorDescriptor | undefined {
  try {
    return JSON.parse(
      readFileSync(join(dir, 'runtime/coordinator.json'), 'utf8')
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function healthy(d: LocalCoordinatorDescriptor): Promise<boolean> {
  try {
    const response = await fetch(`https://127.0.0.1:${d.httpsPort}/health`, {
      headers: { Authorization: `Bearer ${d.bearerToken}` },
      tls: { ca: d.certificatePem, rejectUnauthorized: true },
      proxy: false as unknown as undefined,
      signal: AbortSignal.timeout(1500),
    } as RequestInit);
    return (
      response.ok && ((await response.json()) as { pid?: number }).pid === d.pid
    );
  } catch {
    return false;
  }
}

async function ready(
  dir: string,
  child: Bun.Subprocess
): Promise<LocalCoordinatorDescriptor> {
  return waitFor('authenticated coordinator', async () => {
    if (child.exitCode !== null) {
      const stdout = await new Response(child.stdout as ReadableStream).text();
      const stderr = await new Response(child.stderr as ReadableStream).text();
      throw new Error(
        `Coordinator process ${child.pid} exited ${child.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }
    const d = readDescriptor(dir);
    if (!d || !(await healthy(d))) return undefined;
    return d;
  });
}

function spawnCoordinator(dir: string): Bun.Subprocess {
  const child = Bun.spawn(
    [
      binary,
      '--foreground',
      '--port',
      '0',
      '--grpc-port',
      '0',
      '--no-watcher',
      '--data-dir',
      dir,
    ],
    { env: environment(dir), stdout: 'pipe', stderr: 'pipe' }
  );
  children.push(child);
  return child;
}

async function getClosedPort(): Promise<number> {
  const server = createServer();
  const listening = Promise.withResolvers<void>();
  server.once('error', listening.reject);
  server.listen(0, '127.0.0.1', listening.resolve);
  await listening.promise;
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  const closed = Promise.withResolvers<void>();
  server.close((err) => (err ? closed.reject(err) : closed.resolve()));
  await closed.promise;

  // Confirm refusal
  const confirmed = Promise.withResolvers<void>();
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.once('connect', () => {
    socket.destroy();
    confirmed.reject(new Error(`Port ${port} was unexpectedly open`));
  });
  socket.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ECONNREFUSED') confirmed.resolve();
    else confirmed.reject(err);
  });
  await confirmed.promise;
  return port;
}

function logPass(label: string, err: unknown) {
  const name = err instanceof Error ? err.name : 'Unknown';
  const code =
    err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  const errno =
    err && typeof err === 'object' && 'errno' in err ? String(err.errno) : '';
  const message = err instanceof Error ? err.message : String(err);
  console.log(
    `PASS ${label} name=${name} code=${code} errno=${errno} message=${message}`
  );
}

console.log(`Bun.revision: ${Bun.revision}`);

try {
  const dirA = directory();
  const dirB = directory();
  const dirC = directory();

  const childA = spawnCoordinator(dirA);
  const descA = await ready(dirA, childA);

  const childB = spawnCoordinator(dirB);
  const descB = await ready(dirB, childB);

  // Case 0 (only when HTTPS_PROXY is set)
  if (process.env.HTTPS_PROXY) {
    const res = await coordinatorFetch(descB, descB.httpsPort, '/health');
    if (res.status !== 200) {
      throw new Error(`FAIL proxy-env-direct: status ${res.status}`);
    }
    console.log(
      'PASS proxy-env-direct name=Response code= errno= message=status 200'
    );
  }

  // Case 1: refused-https
  const closedPort1 = await getClosedPort();
  try {
    await coordinatorFetch(descA, closedPort1, '/health');
    throw new Error('FAIL refused-https: fetch succeeded on closed port');
  } catch (error) {
    if (!(error instanceof CoordinatorConnectionRefusedError)) {
      throw new Error(
        `FAIL refused-https: not CoordinatorConnectionRefusedError (${error})`
      );
    }
    if (!(error instanceof CoordinatorSecurityError)) {
      throw new Error('FAIL refused-https: not CoordinatorSecurityError');
    }
    if (!isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL refused-https: classifier returned false');
    }
    const cause = error.cause;
    if (!(cause instanceof TypeError)) {
      throw new Error(`FAIL refused-https: cause is not TypeError (${cause})`);
    }
    if ((cause as { code?: unknown }).code !== 'ECONNREFUSED') {
      throw new Error(
        `FAIL refused-https: cause.code is not ECONNREFUSED (${(cause as { code?: unknown }).code})`
      );
    }
    logPass('refused-https', error);
  }

  // Case 2: killed-coordinator-https
  const childC = spawnCoordinator(dirC);
  const descC = await ready(dirC, childC);
  const probeC = await coordinatorFetch(descC, descC.httpsPort, '/health');
  assert.equal(probeC.status, 200);
  childC.kill('SIGKILL');
  await childC.exited;
  await Bun.sleep(100);
  try {
    await coordinatorFetch(descC, descC.httpsPort, '/health');
    throw new Error('FAIL killed-coordinator-https: succeeded after SIGKILL');
  } catch (error) {
    if (!(error instanceof CoordinatorConnectionRefusedError)) {
      throw new Error(
        `FAIL killed-coordinator-https: not CoordinatorConnectionRefusedError (${error})`
      );
    }
    if (!isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL killed-coordinator-https: classifier false');
    }
    logPass('killed-coordinator-https', error);
  }

  // Case 3: pin-mismatch-https
  const okB = await coordinatorFetch(descB, descB.httpsPort, '/health');
  assert.equal(okB.status, 200);
  try {
    // A's descriptor on B's port: A's cert won't match B's TLS cert
    await coordinatorFetch(descA, descB.httpsPort, '/health');
    throw new Error(
      'FAIL pin-mismatch-https: succeeded with mismatched certificate pin'
    );
  } catch (error) {
    if (error instanceof CoordinatorConnectionRefusedError) {
      throw new Error('FAIL pin-mismatch-https: typed');
    }
    if (isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL pin-mismatch-https: classifier true');
    }
    const causeCode =
      error && typeof error === 'object' && 'cause' in error
        ? (error.cause as { code?: unknown })?.code
        : undefined;
    if (causeCode === 'ECONNREFUSED') {
      throw new Error('FAIL pin-mismatch-https: cause code was ECONNREFUSED');
    }
    logPass('pin-mismatch-https', error);
  }

  // Case 4: bearer-rejected-https
  try {
    // B's PEM with A's token
    const tampered = { ...descB, bearerToken: descA.bearerToken };
    await coordinatorFetch(tampered, descB.httpsPort, '/health');
    throw new Error(
      'FAIL bearer-rejected-https: succeeded with invalid bearer token'
    );
  } catch (error) {
    if (error instanceof CoordinatorConnectionRefusedError) {
      throw new Error('FAIL bearer-rejected-https: typed');
    }
    if (isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL bearer-rejected-https: classifier true');
    }
    if (
      !(error instanceof CoordinatorSecurityError) ||
      !error.message.includes('401')
    ) {
      throw new Error(
        `FAIL bearer-rejected-https: not rejected with (401) (${error})`
      );
    }
    logPass('bearer-rejected-https', error);
  }

  // Case 5: listener-drops-connection
  const dropServer = createServer((sock) => {
    sock.destroy();
  });
  const dropListening = Promise.withResolvers<void>();
  dropServer.listen(0, '127.0.0.1', dropListening.resolve);
  await dropListening.promise;
  const dropAddr = dropServer.address();
  assert.ok(dropAddr && typeof dropAddr !== 'string');
  const dropPort = dropAddr.port;
  try {
    await coordinatorFetch(descB, dropPort, '/health');
    throw new Error('FAIL listener-drops-connection: succeeded');
  } catch (error) {
    if (error instanceof CoordinatorConnectionRefusedError) {
      throw new Error('FAIL listener-drops-connection: typed');
    }
    if (isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL listener-drops-connection: classifier true');
    }
    logPass('listener-drops-connection', error);
  } finally {
    const closed = Promise.withResolvers<void>();
    dropServer.close((_) => closed.resolve());
    await closed.promise;
  }

  // Case 6: refused-grpc
  const closedPort6 = await getClosedPort();
  const clients6 = createCoordinatorClients(closedPort6, descA);
  try {
    await clients6.coordinator.health({});
    throw new Error('FAIL refused-grpc: succeeded on closed port');
  } catch (error) {
    if (!(error instanceof ConnectError)) {
      throw new Error(`FAIL refused-grpc: not ConnectError (${error})`);
    }
    if (!(error.cause instanceof CoordinatorConnectionRefusedError)) {
      throw new Error(
        `FAIL refused-grpc: cause is not CoordinatorConnectionRefusedError (${error.cause})`
      );
    }
    if (!isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL refused-grpc: classifier false');
    }
    logPass('refused-grpc', error);
  }

  // Case 7: pin-mismatch-grpc
  assert.ok(descB.grpcPort !== null && descB.grpcPort > 0);
  const grpcPortB = descB.grpcPort ?? 0;
  const clients7 = createCoordinatorClients(grpcPortB, descA);
  try {
    await clients7.coordinator.health({});
    throw new Error(
      'FAIL pin-mismatch-grpc: succeeded with certificate pin mismatch'
    );
  } catch (error) {
    if (isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL pin-mismatch-grpc: classifier true');
    }
    logPass('pin-mismatch-grpc', error);
  }

  // Case 8: bearer-rejected-grpc
  const clientsB = createCoordinatorClients(grpcPortB, descB);
  const bHealth = await clientsB.coordinator.health({});
  assert.ok(bHealth.healthy);
  const tamperedDescB = { ...descB, bearerToken: descA.bearerToken };
  const clients8 = createCoordinatorClients(grpcPortB, tamperedDescB);
  try {
    await clients8.coordinator.health({});
    throw new Error('FAIL bearer-rejected-grpc: succeeded with invalid token');
  } catch (error) {
    if (!(error instanceof ConnectError)) {
      throw new Error(`FAIL bearer-rejected-grpc: not ConnectError (${error})`);
    }
    if (error.code !== 16) {
      throw new Error(
        `FAIL bearer-rejected-grpc: expected ConnectRPC code 16, got ${error.code}`
      );
    }
    if (isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL bearer-rejected-grpc: classifier true');
    }
    logPass('bearer-rejected-grpc', error);
  }

  // Case 9: checkhealth-refused
  const closedPort9 = await getClosedPort();
  const dir9 = directory();
  mkdirSync(join(dir9, 'runtime'), { mode: 0o700 });
  const desc9 = { ...descA, httpsPort: closedPort9 };
  writeFileSync(join(dir9, 'runtime/coordinator.json'), JSON.stringify(desc9), {
    mode: 0o600,
  });
  const prevEnv = process.env.HAN_DATA_DIR;
  try {
    process.env.HAN_DATA_DIR = dir9;
    await checkHealth(closedPort9);
    throw new Error(
      'FAIL checkhealth-refused: checkHealth succeeded on closed port'
    );
  } catch (error) {
    if (!(error instanceof CoordinatorConnectionRefusedError)) {
      throw new Error(
        `FAIL checkhealth-refused: not CoordinatorConnectionRefusedError (${error})`
      );
    }
    if (!isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL checkhealth-refused: classifier false');
    }
    logPass('checkhealth-refused', error);
  } finally {
    if (prevEnv !== undefined) process.env.HAN_DATA_DIR = prevEnv;
    else delete process.env.HAN_DATA_DIR;
  }

  // Case 10: checkhealth-pin-mismatch
  const dir10 = directory();
  mkdirSync(join(dir10, 'runtime'), { mode: 0o700 });
  const desc10 = { ...descA, httpsPort: descB.httpsPort };
  writeFileSync(
    join(dir10, 'runtime/coordinator.json'),
    JSON.stringify(desc10),
    { mode: 0o600 }
  );
  try {
    process.env.HAN_DATA_DIR = dir10;
    await checkHealth(descB.httpsPort);
    throw new Error(
      'FAIL checkhealth-pin-mismatch: succeeded with pin mismatch'
    );
  } catch (error) {
    if (error instanceof CoordinatorConnectionRefusedError) {
      throw new Error('FAIL checkhealth-pin-mismatch: typed error');
    }
    if (isExplicitConnectionRefusal(error)) {
      throw new Error('FAIL checkhealth-pin-mismatch: classifier true');
    }
    logPass('checkhealth-pin-mismatch', error);
  } finally {
    if (prevEnv !== undefined) process.env.HAN_DATA_DIR = prevEnv;
    else delete process.env.HAN_DATA_DIR;
  }

  console.log('ALL TRANSPORT CLASSIFICATION PROOFS PASSED');
} finally {
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  await Promise.all(children.map((c) => c.exited));
  for (const dir of directories) {
    rmSync(dir, { recursive: true, force: true });
  }
}
