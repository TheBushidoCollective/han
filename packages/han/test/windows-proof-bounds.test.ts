import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { type AddressInfo, createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  abortableSleep,
  barrierIdentityScript,
  createProofClock,
  establishedConnectionScript,
  findPowershell,
  identityProbeScript,
  PROBE_PRELUDE,
  ProofDeadlineError,
  ProofOutputRetained,
  ProofSubprocessTimeout,
  ProofWatchdogError,
  readProofBudget,
  restrictedProofEnv,
  sleepFixtureScript,
  spawnBounded,
  startBounded,
  sweepRoot,
  sweepRootSync,
  validateSweepRoots,
} from '../scripts/windows-proof-bounds.ts';

describe('windows-proof-bounds budget and unit contracts', () => {
  test('readProofBudget parses valid integer bounds between 30000 and 3600000', () => {
    const budget = readProofBudget({
      HAN_PROOF_DEADLINE_MS: '60000',
      HAN_PROOF_CLEANUP_MS: '120000',
    });
    expect(budget).toEqual({
      deadlineMs: 60000,
      cleanupMs: 120000,
    });
  });

  test('readProofBudget applies safe defaults when env is unset', () => {
    const budget = readProofBudget({});
    expect(budget).toEqual({
      deadlineMs: 2100000,
      cleanupMs: 180000,
    });
  });

  test('readProofBudget rejects non-integers, floats, negative numbers, and out-of-range values', () => {
    const badValues = [
      '29999',
      '3600001',
      '-60000',
      '60000.5',
      'not_a_number',
      ' 60000ms ',
      '',
    ];

    for (const bad of badValues) {
      if (bad === '') continue; // empty string falls back to default
      expect(() =>
        readProofBudget({
          HAN_PROOF_DEADLINE_MS: bad,
        })
      ).toThrow();
      expect(() =>
        readProofBudget({
          HAN_PROOF_CLEANUP_MS: bad,
        })
      ).toThrow();
    }
  });

  test('createProofClock aborts phaseSignal at deadline and cleanupSignal at deadline + cleanup', async () => {
    const clock = createProofClock({
      deadlineMs: 50,
      cleanupMs: 50,
      watchdogMarginMs: 500,
    });

    expect(clock.phaseSignal.aborted).toBe(false);
    expect(clock.cleanupSignal.aborted).toBe(false);

    // Await actual abort event signal rather than arbitrary sleep
    const { promise: phaseAborted, resolve: resolvePhase } =
      Promise.withResolvers<void>();
    if (clock.phaseSignal.aborted) {
      resolvePhase();
    } else {
      clock.phaseSignal.addEventListener('abort', () => resolvePhase(), {
        once: true,
      });
    }
    await phaseAborted;
    expect(clock.phaseSignal.aborted).toBe(true);
    expect(clock.cleanupSignal.aborted).toBe(false);

    const { promise: cleanupAborted, resolve: resolveCleanup } =
      Promise.withResolvers<void>();
    if (clock.cleanupSignal.aborted) {
      resolveCleanup();
    } else {
      clock.cleanupSignal.addEventListener('abort', () => resolveCleanup(), {
        once: true,
      });
    }
    await cleanupAborted;
    expect(clock.cleanupSignal.aborted).toBe(true);

    clock.disarm();
  });
  test('error classes carry exact names and inheritance', () => {
    const deadlineErr = new ProofDeadlineError();
    expect(deadlineErr.name).toBe('ProofDeadlineError');
    expect(deadlineErr instanceof Error).toBe(true);

    const timeoutErr = new ProofSubprocessTimeout();
    expect(timeoutErr.name).toBe('ProofSubprocessTimeout');
    expect(timeoutErr instanceof Error).toBe(true);

    const retainedErr = new ProofOutputRetained();
    expect(retainedErr.name).toBe('ProofOutputRetained');
    expect(retainedErr instanceof Error).toBe(true);

    const watchdogErr = new ProofWatchdogError();
    expect(watchdogErr.name).toBe('ProofWatchdogError');
    expect(watchdogErr.code).toBe('WATCHDOG');
    expect(watchdogErr instanceof Error).toBe(true);
  });

  test('abortableSleep cancel gracefully resolves and cleans up timer', async () => {
    const controller = new AbortController();
    const sleep = abortableSleep(10000, controller.signal);
    // Cancel immediately: must resolve cleanly and not throw when signal later aborts
    sleep.cancel();
    await sleep;
    controller.abort();
  });

  test('validateSweepRoots enforces expected prefix on basename, existence, and protected path checks', () => {
    expect(() => validateSweepRoots('')).toThrow('must be a non-empty string');
    expect(() => validateSweepRoots('C:\\')).toThrow('Refusing to sweep');
    expect(() => validateSweepRoots('C:\\Windows')).toThrow(
      'Refusing to sweep'
    );

    // Directory whose basename does not start with prefix
    const genericDir = mkdtempSync(join(tmpdir(), 'other-unrelated-temp-'));
    try {
      expect(() => validateSweepRoots(genericDir)).toThrow(
        'does not start with an allowed prefix'
      );
    } finally {
      rmSync(genericDir, { recursive: true, force: true });
    }

    // Directory whose parent contains prefix but child basename does not
    const parentWithPrefix = mkdtempSync(join(tmpdir(), 'han-bounds-parent-'));
    try {
      const childDir = join(parentWithPrefix, 'unprefixed-child');
      mkdirSync(childDir);
      expect(() => validateSweepRoots(childDir)).toThrow(
        'does not start with an allowed prefix'
      );
    } finally {
      rmSync(parentWithPrefix, { recursive: true, force: true });
    }

    // Directory whose basename contains prefix as substring but does not start with it
    const substringDir = mkdtempSync(
      join(tmpdir(), 'prefix-han-bounds-middle-')
    );
    try {
      expect(() => validateSweepRoots(substringDir)).toThrow(
        'does not start with an allowed prefix'
      );
    } finally {
      rmSync(substringDir, { recursive: true, force: true });
    }

    // Non-existent directory with valid prefix
    const nonExistent = join(tmpdir(), 'han-bounds-nonexistent-12345');
    expect(() => validateSweepRoots(nonExistent)).toThrow('does not exist');

    // Valid temporary directories with expected prefixes
    const validBounds = mkdtempSync(join(tmpdir(), 'han-bounds-unit-'));
    try {
      const roots = validateSweepRoots(validBounds);
      expect(roots.length).toBeGreaterThanOrEqual(1);
      expect(roots[0]).toBe(resolve(validBounds));
    } finally {
      rmSync(validBounds, { recursive: true, force: true });
    }

    const validInstalled = mkdtempSync(
      join(tmpdir(), 'han-windows-installed-unit-')
    );
    try {
      const roots = validateSweepRoots(validInstalled);
      expect(roots.length).toBeGreaterThanOrEqual(1);
      expect(roots[0]).toBe(resolve(validInstalled));
    } finally {
      rmSync(validInstalled, { recursive: true, force: true });
    }
  });
  test('sweepRoot refuses protected root paths', async () => {
    await expect(sweepRoot('')).rejects.toThrow();
    await expect(sweepRoot('C:\\')).rejects.toThrow();
    await expect(sweepRoot('C:\\Windows')).rejects.toThrow();
    expect(() => sweepRootSync('')).toThrow();
    expect(() => sweepRootSync('C:\\')).toThrow();
    expect(() => sweepRootSync('C:\\Windows')).toThrow();
  });
  test('probe script builders reject invalid identifiers', () => {
    for (const invalidPid of [0, -1, 1.5, Number.NaN, 2 ** 32]) {
      expect(() => identityProbeScript(invalidPid, false)).toThrow(
        'Invalid process id'
      );
      expect(() => barrierIdentityScript(invalidPid, 1)).toThrow(
        'Invalid process id'
      );
    }
    expect(() => barrierIdentityScript(1, -1)).toThrow(
      'Invalid parent process id'
    );
    expect(() => barrierIdentityScript(1, 2 ** 32)).toThrow(
      'Invalid parent process id'
    );
    expect(() => establishedConnectionScript(0)).toThrow('Invalid port');
    expect(() => establishedConnectionScript(65536)).toThrow('Invalid port');
    expect(() => sleepFixtureScript(0)).toThrow('Invalid sleep duration');
    expect(() => sleepFixtureScript(-1)).toThrow('Invalid sleep duration');
  });

  test('probe scripts start with the autoload-disabled prelude and invoke no cmdlets', () => {
    expect(PROBE_PRELUDE).toBe(
      "$ErrorActionPreference='Stop'; $PSModuleAutoLoadingPreference='None'; "
    );
    const scripts = [
      identityProbeScript(1234, false),
      identityProbeScript(1234, true),
      barrierIdentityScript(1234, 5678),
      establishedConnectionScript(8080),
      sleepFixtureScript(10),
    ];
    for (const s of scripts) {
      expect(s.startsWith(PROBE_PRELUDE)).toBe(true);
      expect(s).not.toMatch(/\b[A-Z][a-z]+-[A-Z][A-Za-z]+\b/);
    }
  });
});

const isWindows = process.platform === 'win32';
const describeWindows = isWindows ? describe : describe.skip;

describeWindows('Windows real-process limits and sweep tests', () => {
  test('T1: child exits while grandchild keeps stdout open -> pipeRetained true within grace + 10s, then sweepRoot leaves remaining 0', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'han-bounds-t1-'));
    try {
      const grandchildExe = join(tempRoot, 'sleeper-grandchild.exe');
      copyFileSync(process.execPath, grandchildExe);

      const grandchildScript = join(tempRoot, 'grandchild.ts');
      writeFileSync(grandchildScript, 'await Bun.sleep(600000);\n');

      const childScript = join(tempRoot, 'child.ts');
      writeFileSync(
        childScript,
        `import { spawnSync } from 'node:child_process';
spawnSync('cmd.exe', ['/c', 'start', '/b', '', ${JSON.stringify(grandchildExe)}, ${JSON.stringify(grandchildScript)}], {
  windowsHide: true,
  stdio: 'inherit',
});
process.exit(0);
`
      );

      const start = Date.now();
      const result = await spawnBounded([process.execPath, childScript], {
        cwd: tempRoot,
        capture: true,
        eofGraceMs: 2000,
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(12000); // 2000ms grace + 10s = 12000ms
      expect(result.pipeRetained).toBe(true);

      const sweep = await sweepRoot(tempRoot, 15000);
      expect(sweep.remaining).toBe(0);
      expect(sweep.terminated).toBeGreaterThanOrEqual(1);
    } finally {
      try {
        rmSync(tempRoot, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch {}
    }
  }, 30000);

  test('T2: Start-Sleep 600 comes back with timedOut within timeout plus 10s and process is gone', async () => {
    const powershell = findPowershell();
    const start = Date.now();
    const result = await spawnBounded(
      [
        powershell,
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Start-Sleep -Seconds 600',
      ],
      {
        timeoutMs: 2000,
      }
    );
    const elapsed = Date.now() - start;

    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(12000); // 2000ms timeout + 10s = 12000ms

    if (result.pid) {
      const check = spawnSync(
        powershell,
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `try { (Get-Process -Id ${result.pid} -ErrorAction Stop).Id } catch { 'NONE' }`,
        ],
        { encoding: 'utf8', windowsHide: true }
      );
      expect(check.stdout.trim()).toBe('NONE');
    }
  }, 20000);

  test('T3: aborting mid-run rejects with ProofDeadlineError within 5s, later call with aborted signal never starts process', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'han-bounds-t3-'));
    try {
      const markerFile1 = join(tempRoot, 'marker1.txt');
      const markerFile2 = join(tempRoot, 'marker2.txt');

      const script1 = join(tempRoot, 'script1.ts');
      writeFileSync(
        script1,
        `import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(markerFile1)}, 'started');
await Bun.sleep(600000);
`
      );

      const script2 = join(tempRoot, 'script2.ts');
      writeFileSync(
        script2,
        `import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(markerFile2)}, 'started');
`
      );

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 1000);
      const start = Date.now();

      await expect(
        spawnBounded([process.execPath, script1], {
          cwd: tempRoot,
          signal: controller.signal,
        })
      ).rejects.toThrow(ProofDeadlineError);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);

      await expect(
        spawnBounded([process.execPath, script2], {
          cwd: tempRoot,
          signal: controller.signal,
        })
      ).rejects.toThrow(ProofDeadlineError);

      expect(existsSync(markerFile2)).toBe(false);
    } finally {
      try {
        rmSync(tempRoot, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch {}
    }
  }, 20000);

  test('T4: two sleepers with same file name under root A and A + x -> sweep kills only A', async () => {
    const baseDir = mkdtempSync(join(tmpdir(), 'han-bounds-t4-'));
    try {
      const rootA = join(baseDir, 'han-bounds-rootA');
      const rootAx = join(baseDir, 'han-bounds-rootAx');
      mkdirSync(rootA, { recursive: true });
      mkdirSync(rootAx, { recursive: true });

      const exeA = join(rootA, 'sleeper-node.exe');
      const exeAx = join(rootAx, 'sleeper-node.exe');
      copyFileSync(process.execPath, exeA);
      copyFileSync(process.execPath, exeAx);

      const scriptA = join(rootA, 'sleep.ts');
      const scriptAx = join(rootAx, 'sleep.ts');
      writeFileSync(scriptA, 'await Bun.sleep(600000);\n');
      writeFileSync(scriptAx, 'await Bun.sleep(600000);\n');

      const childA = Bun.spawn([exeA, scriptA], {
        cwd: rootA,
        stdout: 'ignore',
        stderr: 'ignore',
        windowsHide: true,
      });
      const childAx = Bun.spawn([exeAx, scriptAx], {
        cwd: rootAx,
        stdout: 'ignore',
        stderr: 'ignore',
        windowsHide: true,
      });

      await Bun.sleep(500);
      expect(childA.exitCode).toBeNull();
      expect(childAx.exitCode).toBeNull();

      const sweep = await sweepRoot(rootA, 15000);
      expect(sweep.remaining).toBe(0);
      expect(sweep.terminated).toBeGreaterThanOrEqual(1);

      await Bun.sleep(500);
      expect(childA.exitCode).not.toBeNull();
      expect(childAx.exitCode).toBeNull();

      childAx.kill();
      await childAx.exited;
    } finally {
      try {
        rmSync(baseDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch {}
    }
  }, 30000);

  test('T5: watchdog fixture armed at 2s with unsettled await exits 1 within 30s and prints failure line with reason watchdog', async () => {
    const fixture = resolve(
      import.meta.dir,
      'fixtures/windows-proof-watchdog.ts'
    );
    expect(existsSync(fixture)).toBe(true);

    const start = Date.now();
    const proc = Bun.spawn([process.execPath, fixture], {
      stdout: 'pipe',
      stderr: 'pipe',
      windowsHide: true,
    });

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    const elapsed = Date.now() - start;

    expect(exitCode).toBe(1);
    expect(elapsed).toBeLessThan(30000);

    const combined = `${stdout}\n${stderr}`;
    const failureLines = combined
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('Installed Windows proof failure: '));

    expect(failureLines.length).toBe(1);
    const jsonStr = failureLines[0].slice(
      'Installed Windows proof failure: '.length
    );
    const parsed = JSON.parse(jsonStr);
    expect(parsed.reason).toBe('watchdog');
    expect(parsed.phase).toBeDefined();
  }, 35000);

  test('four-variant execution (capture true/false x windowsHide true/false) for PowerShell and Bun with exit 7', async () => {
    const powershell = findPowershell();
    const variants = [
      { capture: false, windowsHide: true },
      { capture: true, windowsHide: true },
      { capture: false, windowsHide: false },
      { capture: true, windowsHide: false },
    ] as const;

    interface VariantResult {
      kind: 'powershell' | 'bun';
      capture: boolean;
      windowsHide: boolean;
      exitCode: number | null;
      timedOut: boolean;
      ms: number;
      error?: string;
    }

    const results: VariantResult[] = [];

    for (const { capture, windowsHide } of variants) {
      // 1. PowerShell exit 7
      try {
        const psStart = Date.now();
        const psRes = await spawnBounded(
          [powershell, '-NoProfile', '-NonInteractive', '-Command', 'exit 7'],
          {
            capture,
            windowsHide,
            timeoutMs: 20000,
          }
        );
        results.push({
          kind: 'powershell',
          capture,
          windowsHide,
          exitCode: psRes.exitCode,
          timedOut: psRes.timedOut,
          ms: Date.now() - psStart,
        });
      } catch (err) {
        results.push({
          kind: 'powershell',
          capture,
          windowsHide,
          exitCode: null,
          timedOut: false,
          ms: -1,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // 2. Bun exit 7
      try {
        const bunStart = Date.now();
        const bunRes = await spawnBounded(
          [process.execPath, '-e', 'process.exit(7)'],
          {
            capture,
            windowsHide,
            timeoutMs: 20000,
          }
        );
        results.push({
          kind: 'bun',
          capture,
          windowsHide,
          exitCode: bunRes.exitCode,
          timedOut: bunRes.timedOut,
          ms: Date.now() - bunStart,
        });
      } catch (err) {
        results.push({
          kind: 'bun',
          capture,
          windowsHide,
          exitCode: null,
          timedOut: false,
          ms: -1,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const tableHeader =
      'kind       | capture | windowsHide | exitCode | timedOut | ms    | error\n';
    const tableRows = results
      .map(
        (r) =>
          `${r.kind.padEnd(10)} | ${String(r.capture).padEnd(7)} | ${String(r.windowsHide).padEnd(11)} | ${String(r.exitCode).padEnd(8)} | ${String(r.timedOut).padEnd(8)} | ${String(r.ms).padEnd(5)} | ${r.error || 'none'}`
      )
      .join('\n');
    const fullTable = `\n${tableHeader}${tableRows}\n`;

    expect(results.length).toBe(8);

    const failures = results.filter(
      (r) => r.exitCode !== 7 || r.timedOut || r.ms >= 15000 || r.error
    );

    if (failures.length > 0) {
      throw new Error(
        `Variant execution test failed for ${failures.length}/8 combinations:${fullTable}`
      );
    }
  }, 120000);
});

describeWindows('Windows restricted-environment PowerShell probes', () => {
  const createTestEnv = () => {
    const root = mkdtempSync(join(tmpdir(), 'han-probe-test-'));
    const bin = join(root, 'bin');
    const data = join(root, 'data');
    mkdirSync(bin);
    mkdirSync(join(root, 'tmp'));
    mkdirSync(join(root, 'claude'));
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    const env = restrictedProofEnv({ root, bin, data, systemRoot });
    return { root, bin, data, systemRoot, env };
  };

  test('identity probes keep their exit-code contract and finish under 5 s in the proof environment', async () => {
    const { root, env } = createTestEnv();
    const powershell = findPowershell();
    let sleeper: ReturnType<typeof startBounded> | undefined;

    try {
      sleeper = startBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          sleepFixtureScript(120),
        ],
        { cwd: root, env }
      );
      expect(sleeper.pid).toBeGreaterThan(0);

      // 2. barrierIdentityScript(sleeper.pid, process.pid) with HAN_PROOF_IMAGE set to powershell path
      const tBarrier = Date.now();
      const barrierRes = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          barrierIdentityScript(sleeper.pid, process.pid),
        ],
        {
          cwd: root,
          env: { ...env, HAN_PROOF_IMAGE: powershell },
          timeoutMs: 60000,
          capture: true,
        }
      );
      const barrierMs = Date.now() - tBarrier;
      expect(barrierRes.timedOut).toBe(false);
      expect(barrierRes.pipeRetained).toBe(false);
      expect(barrierRes.exitCode).toBe(0);
      expect(barrierMs).toBeLessThan(10000);
      const fileTime = barrierRes.output.trim();
      expect(fileTime).toMatch(/^[1-9][0-9]{0,19}$/);

      // 3. identityProbeScript(sleeper.pid, false): expect 0
      const t3 = Date.now();
      const res3 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          identityProbeScript(sleeper.pid, false),
        ],
        {
          cwd: root,
          env: {
            ...env,
            HAN_PROOF_IMAGE: powershell,
            HAN_PROOF_TIME: fileTime,
          },
          timeoutMs: 60000,
          capture: true,
        }
      );
      expect(res3.timedOut).toBe(false);
      expect(res3.pipeRetained).toBe(false);
      expect(res3.exitCode).toBe(0);
      expect(Date.now() - t3).toBeLessThan(5000);

      // 4. The same with HAN_PROOF_TIME='1': expect 5
      const t4 = Date.now();
      const res4 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          identityProbeScript(sleeper.pid, false),
        ],
        {
          cwd: root,
          env: {
            ...env,
            HAN_PROOF_IMAGE: powershell,
            HAN_PROOF_TIME: '1',
          },
          timeoutMs: 60000,
          capture: true,
        }
      );
      expect(res4.timedOut).toBe(false);
      expect(res4.pipeRetained).toBe(false);
      expect(res4.exitCode).toBe(5);
      expect(Date.now() - t4).toBeLessThan(5000);

      // 5. identityProbeScript(process.pid, false): expect 4
      const t5 = Date.now();
      const res5 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          identityProbeScript(process.pid, false),
        ],
        {
          cwd: root,
          env: {
            ...env,
            HAN_PROOF_IMAGE: powershell,
            HAN_PROOF_TIME: fileTime,
          },
          timeoutMs: 60000,
          capture: true,
        }
      );
      expect(res5.timedOut).toBe(false);
      expect(res5.pipeRetained).toBe(false);
      expect(res5.exitCode).toBe(4);
      expect(Date.now() - t5).toBeLessThan(5000);

      // 6. identityProbeScript(2147483644, false): expect 3
      const t6 = Date.now();
      const res6 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          identityProbeScript(2147483644, false),
        ],
        {
          cwd: root,
          env: {
            ...env,
            HAN_PROOF_IMAGE: powershell,
            HAN_PROOF_TIME: fileTime,
          },
          timeoutMs: 60000,
          capture: true,
        }
      );
      expect(res6.timedOut).toBe(false);
      expect(res6.pipeRetained).toBe(false);
      expect(res6.exitCode).toBe(3);
      expect(Date.now() - t6).toBeLessThan(5000);

      // 7. barrierIdentityScript(sleeper.pid, 0): expect 4
      const t7 = Date.now();
      const res7 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          barrierIdentityScript(sleeper.pid, 0),
        ],
        {
          cwd: root,
          env: { ...env, HAN_PROOF_IMAGE: powershell },
          timeoutMs: 60000,
          capture: true,
        }
      );
      expect(res7.timedOut).toBe(false);
      expect(res7.pipeRetained).toBe(false);
      expect(res7.exitCode).toBe(4);
      expect(Date.now() - t7).toBeLessThan(10000);

      // 8. barrierIdentityScript with HAN_PROOF_IMAGE set to process.execPath: expect 5
      const t8 = Date.now();
      const res8 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          barrierIdentityScript(sleeper.pid, process.pid),
        ],
        {
          cwd: root,
          env: { ...env, HAN_PROOF_IMAGE: process.execPath },
          timeoutMs: 60000,
          capture: true,
        }
      );
      expect(res8.timedOut).toBe(false);
      expect(res8.pipeRetained).toBe(false);
      expect(res8.exitCode).toBe(5);
      expect(Date.now() - t8).toBeLessThan(10000);

      // 9. identityProbeScript(sleeper.pid, true): expect 0, and the sleeper exits within 10 s
      const t9 = Date.now();
      const res9 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          identityProbeScript(sleeper.pid, true),
        ],
        {
          cwd: root,
          env: {
            ...env,
            HAN_PROOF_IMAGE: powershell,
            HAN_PROOF_TIME: fileTime,
          },
          timeoutMs: 60000,
          capture: true,
        }
      );
      expect(res9.timedOut).toBe(false);
      expect(res9.pipeRetained).toBe(false);
      expect(res9.exitCode).toBe(0);
      expect(Date.now() - t9).toBeLessThan(5000);

      const exitStatus = await Promise.race([
        sleeper.exited,
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), 10000)
        ),
      ]);
      expect(exitStatus).not.toBe('timeout');
    } finally {
      if (sleeper && sleeper.exitCode === null) {
        try {
          sleeper.kill();
          await sleeper.exited;
        } catch {}
      }
      try {
        rmSync(root, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch {}
    }
  }, 120000);

  test('cmdlets are unreachable under the probe prelude', async () => {
    const { root, env } = createTestEnv();
    const powershell = findPowershell();
    try {
      const t1 = Date.now();
      const res1 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `${PROBE_PRELUDE}exit 0`,
        ],
        { cwd: root, env, timeoutMs: 60000, capture: true }
      );
      expect(res1.timedOut).toBe(false);
      expect(res1.pipeRetained).toBe(false);
      expect(res1.exitCode).toBe(0);
      expect(Date.now() - t1).toBeLessThan(5000);

      const t2 = Date.now();
      const res2 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `${PROBE_PRELUDE}$null = Get-Process -Id $PID; exit 0`,
        ],
        { cwd: root, env, timeoutMs: 60000, capture: true }
      );
      expect(res2.timedOut).toBe(false);
      expect(res2.pipeRetained).toBe(false);
      expect(res2.exitCode).not.toBe(0);
      expect(Date.now() - t2).toBeLessThan(5000);
    } finally {
      try {
        rmSync(root, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch {}
    }
  }, 60000);

  test('established-connection probe distinguishes listener from accepted connection under 5 s', async () => {
    const { root, env } = createTestEnv();
    const powershell = findPowershell();
    const server = createServer();
    const listening = Promise.withResolvers<void>();
    server.once('error', listening.reject);
    server.listen(0, '127.0.0.1', listening.resolve);
    await listening.promise;
    const addr = server.address();
    expect(addr && typeof addr !== 'string').toBe(true);
    const port = (addr as AddressInfo).port;
    let client: ReturnType<typeof createConnection> | undefined;

    try {
      // 0 with no client
      const t0 = Date.now();
      const res0 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          establishedConnectionScript(port),
        ],
        { cwd: root, env, timeoutMs: 60000, capture: true }
      );
      expect(res0.timedOut).toBe(false);
      expect(res0.pipeRetained).toBe(false);
      expect(res0.exitCode).toBe(0);
      expect(Date.now() - t0).toBeLessThan(5000);

      // connect client
      client = createConnection({ host: '127.0.0.1', port });
      const connected = Promise.withResolvers<void>();
      client.once('connect', connected.resolve);
      client.once('error', connected.reject);
      await connected.promise;

      // wait briefly for connection establishment in OS
      await new Promise((r) => setTimeout(r, 200));

      const t1 = Date.now();
      const res1 = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          establishedConnectionScript(port),
        ],
        { cwd: root, env, timeoutMs: 60000, capture: true }
      );
      expect(res1.timedOut).toBe(false);
      expect(res1.pipeRetained).toBe(false);
      expect(res1.exitCode).toBe(1);
      expect(Date.now() - t1).toBeLessThan(5000);
    } finally {
      client?.destroy();
      const closed = Promise.withResolvers<void>();
      server.close(() => closed.resolve());
      await closed.promise;
      rmSync(root, { recursive: true, force: true });
    }
  }, 60000);

  test('sleep fixture script runs without module discovery', async () => {
    const { root, env } = createTestEnv();
    const powershell = findPowershell();
    try {
      const t0 = Date.now();
      const res = await spawnBounded(
        [
          powershell,
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          sleepFixtureScript(1),
        ],
        { cwd: root, env, timeoutMs: 60000, capture: true }
      );
      expect(res.timedOut).toBe(false);
      expect(res.pipeRetained).toBe(false);
      expect(res.exitCode).toBe(0);
      expect(Date.now() - t0).toBeLessThan(5000);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60000);
});
