import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// This script mutates only an isolated CI checkout and restores the source even on failure.
if (process.env.CI !== 'true')
  throw new Error('PID mutation proof requires an isolated CI checkout');
const sourcePath = join(
  import.meta.dir,
  '../lib/commands/coordinator/pid-claim.ts'
);
const original = readFileSync(sourcePath, 'utf8');
const name = process.argv[2];
const mutations: Record<
  string,
  { anchor: string; replacement: string; test: string }
> = {
  emptyPublication: {
    anchor: 'renameSync(candidate, reservation);',
    replacement:
      'const savedOwner = readFileSync(join(candidate, owner)); unlinkSync(join(candidate, owner)); renameSync(candidate, reservation); writeFileSync(join(reservation, owner), savedOwner, { mode: 0o600 });',
    test: 'reclaims an owner stopped before PID publication',
  },
  unguardedPid: {
    anchor:
      'inspectDirectory(dir);\n  const reservation = `' +
      '$' +
      '{pidPath}.takeover`;',
    replacement:
      'inspectDirectory(dir);\n  const reservation = `' +
      '$' +
      '{pidPath}.takeover`; writeFileSync(pidPath, String(process.pid), { mode: 0o600 });',
    test: 'reclaims an owner stopped before PID publication',
  },
  recursiveReclaim: {
    anchor:
      'function reclaim(reservation: string, pidPath: string): number | null {',
    replacement: `function unsafeRemove(path: string): void { try { rmdirSync(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') throw error; require('node:fs').rmSync(path, { recursive: true, force: true }); } }
function reclaim(reservation: string, pidPath: string): number | null {`,
    test: 'delayed removal of an empty reservation cannot remove a successor',
  },
  ageSteal: {
    anchor: 'if (alive(record.pid)) {',
    replacement:
      'if (alive(record.pid) && Date.now() - lstatSync(reservation).mtimeMs < 5000) {',
    test: 'a live reservation blocks before its PID is published',
  },
  staleRelease: {
    anchor: 'if (claim.released) return;',
    replacement: 'if (claim.released) { unlinkSync(claim.pidPath); return; }',
    test: 'old release cannot remove a later acquisition',
  },
  probeFailure: {
    anchor: "if ((e as NodeJS.ErrnoException).code === 'EPERM') return true;",
    replacement:
      "if ((e as NodeJS.ErrnoException).code === 'EPERM') return false;",
    test: 'uncertain liveness cannot reclaim a reservation',
  },
  exhaustion: {
    anchor:
      "throw new Error('Supervisor claim contention exceeded retry limit');",
    replacement: "return { kind: 'owned', claim: {} as SupervisorClaim };",
    test: 'retry exhaustion never grants ownership',
  },
};
const mutation = mutations[name];
if (!mutation) throw new Error(`Unknown PID mutation: ${name}`);
if (original.split(mutation.anchor).length !== 2)
  throw new Error(`Mutation anchor not unique: ${name}`);
let modified = original.replace(mutation.anchor, mutation.replacement);
if (name === 'recursiveReclaim') {
  const anchor = 'rmdirSync(reservation);';
  if (!modified.includes(anchor))
    throw new Error('Missing reservation removal');
  modified = modified.replaceAll(anchor, 'unsafeRemove(reservation);');
}
if (modified === original)
  throw new Error(`Mutation did not modify source: ${name}`);
function restoreSource(): void {
  writeFileSync(sourcePath, original);
  if (readFileSync(sourcePath, 'utf8') !== original)
    throw new Error('Failed to restore PID claim source');
}
try {
  writeFileSync(sourcePath, modified);
  const result = Bun.spawnSync(
    [
      process.execPath,
      'test',
      'test/coordinator-pid-claim.test.ts',
      '-t',
      mutation.test,
    ],
    {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
    }
  );
  const output = result.stdout.toString() + result.stderr.toString();
  console.log(output);
  const expectedAssertion: Record<string, string> = {
    emptyPublication: 'expect(claimSupervisorPid(path)).toEqual',
    unguardedPid: 'expect(claimSupervisorPid(path)).toEqual',
    recursiveReclaim: 'expect(existsSync(reservation)).toBe(true)',
    ageSteal: 'expect(claimSupervisorPid(path)).toEqual',
    staleRelease: 'expect(existsSync(path)).toBe(true)',
    probeFailure: 'expect(claimSupervisorPid(path)).toEqual',
    exhaustion: 'UNEXPECTED_OWNERSHIP',
  };
  if (
    result.exitCode === 0 ||
    !output.includes(`(fail) ${mutation.test}`) ||
    !output.includes('error: expect(') ||
    !output.includes(expectedAssertion[name]) ||
    output.includes('timed out')
  ) {
    throw new Error(
      `Mutation ${name} did not produce the intended assertion failure`
    );
  }
  console.log(`Mutation ${name} rejected by ${mutation.test}`);
} finally {
  restoreSource();
}
