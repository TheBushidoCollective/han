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
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  abortableSleep,
  createProofClock,
  findPowershell,
  ProofDeadlineError,
  ProofOutputRetained,
  ProofSubprocessTimeout,
  ProofWatchdogError,
  readProofBudget,
  spawnBounded,
  sweepRoot,
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
});
