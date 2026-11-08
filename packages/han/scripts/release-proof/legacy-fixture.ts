import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export interface LegacyFixture {
  homeDir: string;
  coordinatorPid: number;
  supervisorPid: number;
  stop: () => Promise<void>;
}

export async function setupLegacyFixture(
  homeDir: string
): Promise<LegacyFixture> {
  const isWindows = process.platform === 'win32';
  const binSuffix = isWindows ? '.exe' : '';

  // 1. Determine platform key
  let platformKey = '';
  if (process.platform === 'linux') {
    platformKey = `linux-${process.arch}`;
  } else if (process.platform === 'darwin') {
    platformKey = `darwin-${process.arch}`;
  } else if (process.platform === 'win32') {
    platformKey = 'win32-x64';
  } else {
    throw new Error(`Unsupported fixture platform: ${process.platform}`);
  }

  // 2. Read integrity map
  const integrityPath = resolve(
    import.meta.dir,
    '../../test/fixtures/legacy-v3.22.0/npm-integrity.json'
  );
  const integrityMap = JSON.parse(readFileSync(integrityPath, 'utf8'));
  const expectedIntegrity: string = integrityMap[platformKey];
  if (!expectedIntegrity) {
    throw new Error(`Missing expected integrity for platform ${platformKey}`);
  }

  // 3. Download / pack legacy package
  const pkgName = `@thebushidocollective/han-${platformKey}@3.22.0`;
  const tempExtractDir = join(homeDir, 'legacy-package-extract');
  mkdirSync(tempExtractDir, { recursive: true });

  const packProc = Bun.spawnSync(['npm', 'pack', pkgName], {
    cwd: tempExtractDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (packProc.exitCode !== 0) {
    throw new Error(
      `npm pack ${pkgName} failed: ${packProc.stderr.toString()}`
    );
  }
  const tgzFile = packProc.stdout.toString().trim().split('\n').pop()?.trim();
  if (!tgzFile) {
    throw new Error(`No tarball name returned by npm pack`);
  }
  const tgzPath = join(tempExtractDir, tgzFile);

  // Check integrity (sha512)
  const tarballBytes = readFileSync(tgzPath);
  const actualSha512 = `sha512-${createHash('sha512').update(tarballBytes).digest('base64')}`;
  if (actualSha512 !== expectedIntegrity) {
    throw new Error(
      `Integrity mismatch for ${pkgName}: expected ${expectedIntegrity}, got ${actualSha512}`
    );
  }

  // Extract tarball
  const tgzFileName = `${pkgName}-${LEGACY_VERSION}.tgz`;
  const tarProc = Bun.spawnSync(
    process.platform === 'win32'
      ? ['tar', '--force-local', '-xzf', tgzFileName]
      : ['tar', '-xzf', tgzFileName],
    {
      cwd: tempExtractDir,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  if (tarProc.exitCode !== 0) {
    throw new Error(`tar extract failed: ${tarProc.stderr.toString()}`);
  }

  const extractedHan = join(tempExtractDir, 'package', `han${binSuffix}`);
  const extractedCoordinator = join(
    tempExtractDir,
    'package',
    `han-coordinator${binSuffix}`
  );
  if (!existsSync(extractedHan) || !existsSync(extractedCoordinator)) {
    throw new Error('Extracted legacy binaries not found in package/');
  }

  // 4. Place legacy coordinator in $HOME/.han/bin/
  const hanBinDir = join(homeDir, '.han', 'bin');
  mkdirSync(hanBinDir, { recursive: true });
  const stagedCoordinator = join(hanBinDir, `han-coordinator${binSuffix}`);
  copyFileSync(extractedCoordinator, stagedCoordinator);

  // macOS ad-hoc signing
  if (process.platform === 'darwin') {
    Bun.spawnSync(['codesign', '-s', '-', '-f', stagedCoordinator], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
    Bun.spawnSync(['codesign', '-s', '-', '-f', extractedHan], {
      stdout: 'ignore',
      stderr: 'ignore',
    });
  }

  // 5. Seed $HOME/.claude/han/certs/
  const certsDir = join(homeDir, '.claude', 'han', 'certs');
  mkdirSync(certsDir, { recursive: true });
  writeFileSync(join(certsDir, 'coordinator.crt'), 'DUMMY_LEGACY_CERT');
  writeFileSync(join(certsDir, 'coordinator.key'), 'DUMMY_LEGACY_KEY');
  writeFileSync(
    join(certsDir, 'metadata.json'),
    JSON.stringify({ expires: 1893456000000 })
  );

  // 6. Start legacy supervisor: han coordinator start --foreground --port 41957
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    HOME: homeDir,
    USERPROFILE: homeDir,
  };
  delete env.HAN_DATA_DIR;
  delete env.CLAUDE_CONFIG_DIR;

  const supervisorProc = Bun.spawn(
    [extractedHan, 'coordinator', 'start', '--foreground', '--port', '41957'],
    {
      cwd: homeDir,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );

  const supervisorPid = supervisorProc.pid;

  // 7. Wait for precondition
  let coordinatorPid: number | null = null;
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    await Bun.sleep(200);
    try {
      const resp = await fetch('https://127.0.0.1:41957/health', {
        tls: { rejectUnauthorized: false },
      } as RequestInit);
      if (resp.ok) {
        const body = (await resp.json()) as {
          status?: string;
          version?: string;
        };
        if (body.status === 'ok' && body.version === '0.1.0') {
          // Read coordinator.pid from $HOME/.han/coordinator.pid
          const pidFile = join(homeDir, '.han', 'coordinator.pid');
          if (existsSync(pidFile)) {
            const raw = readFileSync(pidFile, 'utf8').trim();
            const p = parseInt(raw, 10);
            if (p > 0) {
              coordinatorPid = p;
              break;
            }
          }
        }
      }
    } catch {
      // connecting
    }
  }

  if (!coordinatorPid) {
    try {
      supervisorProc.kill();
    } catch {}
    throw new Error(
      'Timed out waiting for v3.22 legacy coordinator precondition'
    );
  }

  console.log(
    `Legacy v3.22 fixture running: supervisor PID ${supervisorPid}, coordinator PID ${coordinatorPid}`
  );

  return {
    homeDir,
    coordinatorPid,
    supervisorPid,
    stop: async () => {
      try {
        supervisorProc.kill();
      } catch {}
    },
  };
}
