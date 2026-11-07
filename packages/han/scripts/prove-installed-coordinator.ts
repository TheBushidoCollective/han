import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

interface Options {
  cli: string;
  coordinator: string;
  bunVersion: string;
  bunRevision: string;
  evidenceDir: string;
}
interface Descriptor {
  instanceId: string;
  pid: number;
  httpsPort: number;
  certificatePem: string;
  bearerToken: string;
  supervisor: { pid: number; nonce: string; generationId: string } | null;
}

export function parseOptions(args: string[]): Options {
  const keys: Record<string, keyof Options> = {
    '--cli': 'cli',
    '--coordinator': 'coordinator',
    '--bun-version': 'bunVersion',
    '--bun-revision': 'bunRevision',
    '--evidence-dir': 'evidenceDir',
  };
  const result: Partial<Options> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = keys[args[i]];
    const value = args[i + 1];
    if (!key || !value || value.startsWith('--') || result[key])
      throw new Error(`Invalid or duplicate argument: ${args[i]}`);
    result[key] = value;
  }
  for (const key of Object.values(keys))
    if (!result[key]) throw new Error(`Missing ${key}`);
  return result as Options;
}

export function assertRuntime(
  output: string,
  version: string,
  revision: string
): void {
  assert.ok(
    output
      .split('\n')
      .some((line) => line.trim() === `Bun: ${version} (${revision})`),
    'Installed CLI reports an unexpected embedded Bun version or revision'
  );
}

const repo = resolve(import.meta.dir, '../../..');
const delay = (ms: number) => Bun.sleep(ms);
async function waitFor<T>(
  label: string,
  probe: () => T | undefined | Promise<T | undefined>
): Promise<T> {
  const deadline = Date.now() + 30000;
  do {
    const value = await probe();
    if (value !== undefined) return value;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}
function descriptor(dir: string): Descriptor | undefined {
  try {
    return JSON.parse(
      readFileSync(join(dir, 'runtime/coordinator.json'), 'utf8')
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
function digest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function environment(dir: string, path: string): Record<string, string> {
  // Deliberately do not inherit checkout, re-exec, provider, proxy, or telemetry settings.
  return {
    HOME: dir,
    USERPROFILE: dir,
    HAN_DATA_DIR: join(dir, 'data'),
    CLAUDE_CONFIG_DIR: join(dir, 'claude'),
    PATH: path,
    TMPDIR: join(dir, 'tmp'),
    HAN_COORDINATOR_PORT: '0',
    CLAUDE_CODE_ENABLE_TELEMETRY: '0',
    HAN_COORDINATOR_TIMEOUT: '10000',
    CI: 'true',
  };
}
function prepare(dir: string, path: string): Record<string, string> {
  mkdirSync(join(dir, 'tmp'), { recursive: true });
  mkdirSync(join(dir, 'claude'), { recursive: true });
  return environment(dir, path);
}
async function command(
  argv: string[],
  cwd: string,
  env: Record<string, string>,
  expected = 0
): Promise<string> {
  const child = Bun.spawn(argv, { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const timer = setTimeout(() => child.kill('SIGKILL'), 90000);
  try {
    const code = await child.exited;
    const out = await stdout;
    const err = await stderr;
    if (code !== expected)
      throw new Error(
        `${argv[0]} ${argv.slice(1).join(' ')} exited ${code}, expected ${expected}\n${out}\n${err}`
      );
    return `${out}\n${err}`;
  } finally {
    clearTimeout(timer);
  }
}
async function request(
  d: Descriptor,
  path: string,
  authorized: boolean,
  body?: object
): Promise<Response> {
  return fetch(`https://127.0.0.1:${d.httpsPort}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(authorized ? { Authorization: `Bearer ${d.bearerToken}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    tls: { ca: d.certificatePem, rejectUnauthorized: true },
    signal: AbortSignal.timeout(5000),
  } as RequestInit);
}
function assertImage(d: Descriptor, sibling: string): void {
  if (process.platform === 'linux') {
    assert.equal(
      realpathSync(`/proc/${d.pid}/exe`),
      realpathSync(sibling),
      'coordinator is not the staged sibling'
    );
  } else {
    try {
      process.kill(d.pid, 0);
    } catch {
      assert.fail(`Coordinator PID ${d.pid} is not alive`);
    }
  }
  assert.ok(d.supervisor, 'descriptor is not supervised');
}
async function checkLive(d: Descriptor, sibling: string): Promise<void> {
  assertImage(d, sibling);
  const health = await request(d, '/health', true);
  assert.equal(health.status, 200);
  assert.equal(((await health.json()) as { pid: number }).pid, d.pid);
  assert.equal((await request(d, '/health', false)).status, 401);
  const result = await request(d, '/graphql', true, {
    query: '{ __typename }',
  });
  assert.equal(result.status, 200);
  assert.equal(
    ((await result.json()) as { data: { __typename: string } }).data.__typename,
    'Query'
  );
  await assert.rejects(
    fetch(`https://127.0.0.1:${d.httpsPort}/health`, {
      headers: { Authorization: `Bearer ${d.bearerToken}` },
      signal: AbortSignal.timeout(5000),
    })
  );
}
function dead(pid: number): boolean {
  if (process.platform === 'linux') {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      return /^\d+ \(.*\) Z /.test(stat);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }
  }
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true;
    return false;
  }
}
async function stopped(dir: string, d: Descriptor): Promise<void> {
  await waitFor('owned processes and records to disappear', () => {
    const runtime = join(dir, 'data/runtime');
    return !descriptor(join(dir, 'data')) &&
      !existsSync(join(dir, 'data/coordinator.pid')) &&
      (!existsSync(runtime) ||
        !readdirSync(runtime).some((n) =>
          n.startsWith('coordinator.stopping.')
        )) &&
      dead(d.pid) &&
      (!d.supervisor || dead(d.supervisor.pid))
      ? true
      : undefined;
  });
}
async function lifecycle(
  cli: string[],
  sibling: string,
  dir: string,
  env: Record<string, string>
): Promise<void> {
  const run = (...args: string[]) => command([...cli, ...args], dir, env);
  const initialStatus = await run('coordinator', 'status');
  assert.match(initialStatus, /Coordinator: not running/);
  assert.equal(descriptor(join(dir, 'data')), undefined);
  let last: Descriptor | undefined;
  try {
    await run('coordinator', 'ensure');
    last = await waitFor('fresh coordinator', () =>
      descriptor(join(dir, 'data'))
    );
    await checkLive(last, sibling);
    assert.match(await run('coordinator', 'status'), /Coordinator: running/);
    const first = last;
    await run('coordinator', 'stop');
    await stopped(dir, first);
    await run('coordinator', 'start');
    last = await waitFor('started coordinator', () =>
      descriptor(join(dir, 'data'))
    );
    await checkLive(last, sibling);
    assert.notEqual(last.instanceId, first.instanceId);
    const beforeRestart = last;
    await run('coordinator', 'restart');
    last = await waitFor('replacement coordinator', () => {
      const d = descriptor(join(dir, 'data'));
      return d && d.instanceId !== beforeRestart.instanceId ? d : undefined;
    });
    await checkLive(last, sibling);
    assert.notEqual(last.certificatePem, beforeRestart.certificatePem);
    assert.notEqual(last.bearerToken, beforeRestart.bearerToken);
    assert.notEqual(
      last.supervisor?.generationId,
      beforeRestart.supervisor?.generationId
    );
    assert.equal(
      (
        await request(
          { ...last, bearerToken: beforeRestart.bearerToken },
          '/health',
          true
        )
      ).status,
      401
    );
    await assert.rejects(
      request(
        { ...last, certificatePem: beforeRestart.certificatePem },
        '/health',
        true
      )
    );
    await waitFor('replaced processes to exit', () =>
      dead(beforeRestart.pid) &&
      (!beforeRestart.supervisor || dead(beforeRestart.supervisor.pid))
        ? true
        : undefined
    );
    await run('coordinator', 'stop');
    await stopped(dir, last);
    last = undefined;
    assert.match(
      await run('coordinator', 'status'),
      /Coordinator: not running/
    );
  } finally {
    if (last || descriptor(join(dir, 'data'))) await run('coordinator', 'stop');
  }
}

async function main(): Promise<void> {
  if (
    (process.platform !== 'linux' && process.platform !== 'darwin') ||
    process.env.CI !== 'true'
  )
    throw new Error(
      'Installed acceptance requires a disposable Linux or macOS CI runner'
    );
  const options = parseOptions(process.argv.slice(2));
  const cliArtifact = realpathSync(options.cli);
  const coordinatorArtifact = realpathSync(options.coordinator);
  const evidence = resolve(options.evidenceDir);
  const npm = Bun.which('npm');
  const node = Bun.which('node');
  if (!npm || !node) throw new Error('npm and node are required');
  const root = mkdtempSync(join(tmpdir(), 'han-installed-proof-'));
  if (root === repo || root.startsWith(`${repo}/`))
    throw new Error('Proof staging must be outside the checkout');
  if (existsSync(join(evidence, 'installed-coordinator.json')))
    throw new Error(
      'Evidence result already exists; use a fresh evidence directory'
    );
  for (const dir of ['/usr/bin', '/bin']) {
    if (existsSync(join(dir, 'han-coordinator')))
      throw new Error(`Discovery path is not isolated: ${dir}`);
  }
  const path = join(root, 'tools');
  mkdirSync(path);
  // Wrapper's install-on-demand fallback cannot contact a registry during proof.
  writeFileSync(join(path, 'npm'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const restrictedPath = `${path}:/usr/bin:/bin`;
  const results: string[] = [];
  try {
    const direct = join(root, 'direct');
    mkdirSync(direct);
    const cli = join(direct, 'han');
    const sibling = join(direct, 'han-coordinator');
    copyFileSync(cliArtifact, cli);
    copyFileSync(coordinatorArtifact, sibling);
    chmodSync(cli, 0o755);
    chmodSync(sibling, 0o755);
    const env = prepare(direct, restrictedPath);
    const version = await command([cli, '--version'], direct, env);
    assertRuntime(version, options.bunVersion, options.bunRevision);
    const badEvidence = join(root, 'wrong-version-evidence');
    await command(
      [
        process.execPath,
        import.meta.path,
        '--cli',
        cliArtifact,
        '--coordinator',
        coordinatorArtifact,
        '--bun-version',
        `${options.bunVersion}-incorrect`,
        '--bun-revision',
        options.bunRevision,
        '--evidence-dir',
        badEvidence,
      ],
      direct,
      { ...env, PATH: `${dirname(npm)}:${dirname(node)}:/usr/bin:/bin` },
      1
    );
    assert.equal(
      existsSync(join(badEvidence, 'installed-coordinator.json')),
      false
    );
    await lifecycle([cli], sibling, direct, env);
    results.push(
      'direct lifecycle, authenticated transport, identity rotation and version negative control'
    );

    const missing = join(root, 'missing');
    mkdirSync(missing);
    copyFileSync(cliArtifact, join(missing, 'han'));
    chmodSync(join(missing, 'han'), 0o755);
    const missingEnv = prepare(missing, restrictedPath);
    const child = Bun.spawn(
      [
        join(missing, 'han'),
        'coordinator',
        'start',
        '--foreground',
        '--port',
        '0',
      ],
      { cwd: missing, env: missingEnv, stdout: 'pipe', stderr: 'pipe' }
    );
    const output = new Response(child.stderr).text();
    try {
      await waitFor('missing sibling failure', () =>
        child.exitCode !== null ? child.exitCode : undefined
      );
      assert.notEqual(child.exitCode, 0);
      assert.equal(descriptor(join(missing, 'data')), undefined);
      assert.equal(existsSync(join(missing, 'data/coordinator.pid')), false);
    } finally {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        await child.exited;
      }
    }
    const stderr = await output;
    assert.match(
      stderr,
      /han-coordinator binary not found|Local runtime helper unavailable/i
    );
    results.push('missing sibling with isolated discovery paths');

    const arch =
      process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : '';
    if (!arch) throw new Error('Unsupported architecture');
    const platform = `linux-${arch}`;
    const packageWork = join(root, 'platform');
    mkdirSync(join(packageWork, 'artifact'), { recursive: true });
    copyFileSync(cliArtifact, join(packageWork, 'artifact', `han-${platform}`));
    copyFileSync(
      coordinatorArtifact,
      join(packageWork, 'artifact', `han-coordinator-${platform}`)
    );
    const generatorEnv = { ...env, PATH: '/usr/bin:/bin' };
    await command(
      [
        '/bin/bash',
        join(repo, '.github/scripts/create-npm-platform-package.sh'),
        'v9.8.7',
        platform,
        `han-${platform}`,
      ],
      packageWork,
      generatorEnv
    );
    const wrapperWork = join(root, 'wrapper');
    mkdirSync(join(wrapperWork, '.github/scripts'), { recursive: true });
    copyFileSync(
      join(repo, '.github/scripts/npm-wrapper-bin.js'),
      join(wrapperWork, '.github/scripts/npm-wrapper-bin.js')
    );
    await command(
      [
        '/bin/bash',
        join(repo, '.github/scripts/create-npm-wrapper-package.sh'),
        'v9.8.7',
      ],
      wrapperWork,
      generatorEnv
    );
    const npmHome = join(root, 'npm-home');
    mkdirSync(npmHome);
    const npmEnv = prepare(npmHome, restrictedPath);
    writeFileSync(
      join(npmHome, 'package.json'),
      '{"name":"han-proof","version":"1.0.0","private":true}'
    );
    const npmPath = `${dirname(node)}:/usr/bin:/bin`;
    for (const work of [wrapperWork, packageWork]) {
      await command(
        [
          npm,
          'pack',
          '--offline',
          '--ignore-scripts',
          '--pack-destination',
          work,
          join(work, 'package'),
        ],
        npmHome,
        { ...npmEnv, PATH: npmPath, npm_config_cache: join(npmHome, 'cache') }
      );
    }
    const packed = (work: string): string => {
      const tarballs = readdirSync(work).filter((name) =>
        name.endsWith('.tgz')
      );
      if (tarballs.length !== 1)
        throw new Error(`Expected one npm package in ${work}`);
      return join(work, tarballs[0]);
    };
    await command(
      [
        npm,
        'install',
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        packed(wrapperWork),
        packed(packageWork),
      ],
      npmHome,
      {
        ...npmEnv,
        PATH: `${dirname(node)}:/usr/bin:/bin`,
        npm_config_cache: join(npmHome, 'cache'),
      }
    );
    const wrapper = join(
      npmHome,
      'node_modules/@thebushidocollective/han/bin.js'
    );
    const platformDir = join(
      npmHome,
      `node_modules/@thebushidocollective/han-${platform}`
    );
    const npmCli = [node, wrapper];
    assertRuntime(
      await command([...npmCli, '--version'], npmHome, npmEnv),
      options.bunVersion,
      options.bunRevision
    );
    await lifecycle(
      npmCli,
      join(platformDir, 'han-coordinator'),
      npmHome,
      npmEnv
    );
    const manifestPath = join(platformDir, 'package.json');
    const manifest = readFileSync(manifestPath, 'utf8');
    const mismatched = JSON.parse(manifest);
    mismatched.version = '9.8.8';
    writeFileSync(manifestPath, JSON.stringify(mismatched));
    await command([...npmCli, '--version'], npmHome, npmEnv, 1);
    writeFileSync(manifestPath, manifest);
    rmSync(join(platformDir, 'han-coordinator'));
    await command([...npmCli, '--version'], npmHome, npmEnv, 1);
    results.push(
      'offline npm generated packages: lifecycle, mismatched and missing pair'
    );

    const installer = join(root, 'installer');
    const bin = join(installer, 'bin');
    const fixtures = join(installer, 'fixtures');
    mkdirSync(bin, { recursive: true });
    mkdirSync(fixtures);
    for (const [name, source] of [
      [`han-${platform}`, cliArtifact],
      [`han-coordinator-${platform}`, coordinatorArtifact],
    ]) {
      copyFileSync(source, join(fixtures, name));
      writeFileSync(
        join(fixtures, `${name}.sha256`),
        `${digest(join(fixtures, name))}  ${name}\n`
      );
    }
    const curlPath = join(path, 'curl');
    writeFileSync(
      curlPath,
      '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do case "$1" in -o) dest="$2"; shift 2;; http*) url="$1"; shift;; *) shift;; esac; done\nexec /bin/cp "$FIXTURES/$(basename "$url")" "$dest"\n',
      { mode: 0o755 }
    );
    const installEnv = {
      ...prepare(installer, restrictedPath),
      FIXTURES: fixtures,
      HAN_VERSION: '9.8.7',
      HAN_INSTALL_DIR: bin,
    };
    const install = () =>
      command(
        ['/bin/bash', join(repo, 'website/public/install.sh')],
        installer,
        installEnv
      );
    await install();
    const installed = join(bin, 'han');
    assert.ok(readlinkSync(installed).startsWith('.han-releases/'));
    const installedSibling = join(
      dirname(realpathSync(installed)),
      'han-coordinator'
    );
    assert.equal(digest(installed), digest(cliArtifact));
    assert.equal(digest(installedSibling), digest(coordinatorArtifact));
    assertRuntime(
      await command([installed, '--version'], installer, installEnv),
      options.bunVersion,
      options.bunRevision
    );
    await lifecycle([installed], installedSibling, installer, installEnv);
    const previousLink = readlinkSync(installed);
    writeFileSync(
      join(fixtures, `han-coordinator-${platform}.sha256`),
      `${'0'.repeat(64)}\n`
    );
    await command(
      ['/bin/bash', join(repo, 'website/public/install.sh')],
      installer,
      installEnv,
      1
    );
    assert.equal(readlinkSync(installed), previousLink);
    assert.equal(digest(installed), digest(cliArtifact));
    assert.equal(digest(installedSibling), digest(coordinatorArtifact));
    results.push(
      'installer symlink lifecycle and checksum mismatch preserves pair'
    );

    mkdirSync(evidence, { recursive: true });
    writeFileSync(
      join(evidence, 'installed-coordinator.json'),
      `${JSON.stringify(
        {
          platform,
          bunVersion: options.bunVersion,
          bunRevision: options.bunRevision,
          cliSha256: digest(cliArtifact),
          coordinatorSha256: digest(coordinatorArtifact),
          results,
        },
        null,
        2
      )}\n`
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
if (import.meta.main) await main();
