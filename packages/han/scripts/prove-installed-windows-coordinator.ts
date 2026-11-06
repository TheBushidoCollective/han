import { strict as assert } from 'node:assert';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Run only on a disposable Windows CI runner against the freshly built artifacts:
// bun packages/han/scripts/prove-installed-windows-coordinator.ts <han.exe> <han-coordinator.exe>
interface Descriptor {
  instanceId: string;
  pid: number;
  httpsPort: number;
  grpcPort: number;
  certificatePem: string;
  bearerToken: string;
  supervisor: { pid: number; nonce: string; generationId: string } | null;
}

async function waitFor<T>(label: string, probe: () => T | undefined | Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + 60000;
  do {
    const result = await probe();
    if (result !== undefined) return result;
    await Bun.sleep(200);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

function readDescriptor(data: string): Descriptor | undefined {
  try {
    return JSON.parse(readFileSync(join(data, 'runtime', 'coordinator.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function run(argv: string[], cwd: string, env: Record<string, string>): Promise<string> {
  const child = Bun.spawn(argv, { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const timer = setTimeout(() => child.kill(), 90000);
  try {
    const code = await child.exited;
    const output = `${await stdout}\n${await stderr}`;
    assert.equal(code, 0, `${argv.slice(1).join(' ')} exited ${code}:\n${output}`);
    return output;
  } finally {
    clearTimeout(timer);
  }
}

async function request(d: Descriptor, port: number, path: string, token?: string, body?: Uint8Array): Promise<Response> {
  return fetch(`https://127.0.0.1:${port}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/grpc-web+proto' } : {}),
    },
    body,
    tls: { ca: d.certificatePem, rejectUnauthorized: true },
    signal: AbortSignal.timeout(5000),
  } as RequestInit);
}

async function live(d: Descriptor): Promise<void> {
  assert.ok(d.supervisor, 'coordinator has no supervisor binding');
  assert.ok(d.httpsPort > 0 && d.grpcPort > 0);
  const health = await request(d, d.httpsPort, '/health', d.bearerToken);
  assert.equal(health.status, 200);
  const healthBody: unknown = await health.json();
  assert.ok(healthBody && typeof healthBody === 'object' && 'pid' in healthBody);
  assert.equal(healthBody.pid, d.pid);
  assert.equal((await request(d, d.httpsPort, '/health')).status, 401);
  assert.equal((await request(d, d.httpsPort, '/health', 'wrong')).status, 401);
  const grpcPath = '/han.coordinator.CoordinatorService/Health';
  const frame = new Uint8Array(5);
  const grpc = await request(d, d.grpcPort, grpcPath, d.bearerToken, frame);
  assert.equal(grpc.status, 200);
  const bytes = new Uint8Array(await grpc.arrayBuffer());
  assert.ok(bytes.length >= 7 && bytes[0] === 0, 'missing gRPC response message');
  const messageLength = new DataView(bytes.buffer, bytes.byteOffset + 1, 4).getUint32(0);
  assert.ok(messageLength >= 2 && bytes.length >= 5 + messageLength);
  assert.equal(bytes[5], 8, 'gRPC health response lacks healthy field');
  assert.equal(bytes[6], 1, 'gRPC coordinator reports unhealthy');
  const denied = await request(d, d.grpcPort, grpcPath, 'wrong', frame);
  assert.equal(denied.headers.get('grpc-status'), '16');
  await assert.rejects(fetch(`https://127.0.0.1:${d.httpsPort}/health`, {
    headers: { Authorization: `Bearer ${d.bearerToken}` }, signal: AbortSignal.timeout(5000),
  }));
}

async function main(): Promise<void> {
  if (process.platform !== 'win32' || process.env.CI !== 'true') throw new Error('Requires a disposable Windows CI runner');
  if (process.argv.length !== 4) throw new Error('Expected CLI and coordinator artifact paths');
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot) throw new Error('SystemRoot is required');
  const powershell = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const root = mkdtempSync(join(tmpdir(), 'han-windows-installed-'));
  const bin = join(root, 'bin');
  const data = join(root, 'data');
  const cli = join(bin, 'han.exe');
  const coordinator = join(bin, 'han-coordinator.exe');
  mkdirSync(bin);
  mkdirSync(join(root, 'tmp'));
  mkdirSync(join(root, 'claude'));
  copyFileSync(resolve(process.argv[2]), cli);
  copyFileSync(resolve(process.argv[3]), coordinator);
  const env: Record<string, string> = {
    SystemRoot: systemRoot, WINDIR: systemRoot,
    PATH: `${bin};${join(systemRoot, 'System32')};${systemRoot}`,
    HOME: root, USERPROFILE: root, APPDATA: join(root, 'appdata'), LOCALAPPDATA: join(root, 'localappdata'),
    TEMP: join(root, 'tmp'), TMP: join(root, 'tmp'),
    HAN_DATA_DIR: data, CLAUDE_CONFIG_DIR: join(root, 'claude'),
    HAN_COORDINATOR_PORT: '0', HAN_COORDINATOR_TIMEOUT: '60000', CI: 'true',
    CLAUDE_CODE_ENABLE_TELEMETRY: '0',
  };
  const command = (...args: string[]) => run([cli, ...args], root, env);
  // Process selection and termination happen in the same PowerShell process, and
  // are restricted to the staged executable rather than a name or port match.
  const ownedProcess = async (pid: number, image: string, kill: boolean): Promise<boolean> => {
    assert.ok(Number.isSafeInteger(pid) && pid > 0);
    const script = `$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if (!$p) { exit 3 }; if ($p.Path -ne $env:HAN_PROOF_IMAGE) { exit 4 }; ${kill ? 'Stop-Process -InputObject $p -Force -ErrorAction Stop' : ''}`;
    const child = Bun.spawn([powershell, '-NoProfile', '-NonInteractive', '-Command', script], {
      cwd: root, env: { ...env, HAN_PROOF_IMAGE: image }, stdout: 'ignore', stderr: 'pipe',
    });
    const err = new Response(child.stderr).text();
    const code = await child.exited;
    if (code === 3) return false;
    if (code !== 0) throw new Error(`Owned process check failed (${code}): ${await err}`);
    return true;
  };
  let current: Descriptor | undefined;
  try {
    assert.match(await command('coordinator', 'status'), /Coordinator: not running/);
    assert.equal(readDescriptor(data), undefined);
    await command('coordinator', 'start');
    current = await waitFor('started descriptor', () => readDescriptor(data));
    assert.ok(await ownedProcess(current.pid, coordinator, false));
    assert.ok(await ownedProcess(current.supervisor!.pid, cli, false));
    await live(current);
    assert.match(await command('coordinator', 'status'), /Coordinator: running/);

    const beforeCrash = current;
    assert.ok(await ownedProcess(beforeCrash.pid, coordinator, true));
    current = await waitFor('supervisor crash recovery', () => {
      const d = readDescriptor(data);
      return d && d.instanceId !== beforeCrash.instanceId ? d : undefined;
    });
    assert.equal(current.supervisor?.pid, beforeCrash.supervisor?.pid);
    assert.notEqual(current.supervisor?.generationId, beforeCrash.supervisor?.generationId);
    assert.notEqual(current.bearerToken, beforeCrash.bearerToken);
    assert.ok(await ownedProcess(current.pid, coordinator, false));
    await live(current);
    assert.equal((await request(current, current.httpsPort, '/health', beforeCrash.bearerToken)).status, 401);

    const beforeRestart = current;
    await command('coordinator', 'restart');
    current = await waitFor('restarted descriptor', () => {
      const d = readDescriptor(data);
      return d && d.instanceId !== beforeRestart.instanceId ? d : undefined;
    });
    assert.notEqual(current.bearerToken, beforeRestart.bearerToken);
    assert.notEqual(current.certificatePem, beforeRestart.certificatePem);
    assert.ok(await ownedProcess(current.pid, coordinator, false));
    await live(current);
    await command('coordinator', 'stop');
    await waitFor('descriptor withdrawal', () => !readDescriptor(data) ? true : undefined);
    await waitFor('supervisor exit', async () => !await ownedProcess(current!.supervisor!.pid, cli, false) ? true : undefined);
    await waitFor('coordinator exit', async () => !await ownedProcess(current!.pid, coordinator, false) ? true : undefined);
    current = undefined;
    assert.match(await command('coordinator', 'status'), /Coordinator: not running/);
    console.log('Installed Windows CLI: start, authenticated HTTPS and gRPC, crash recovery, restart and stop passed');
  } finally {
    if (current || existsSync(join(data, 'runtime', 'coordinator.json'))) {
      // Ask the actual installed CLI to shut down its own processes, even on failure.
      await command('coordinator', 'stop');
    }
    rmSync(root, { recursive: true, force: true });
  }
}

await main();
