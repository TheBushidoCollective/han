import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Each invocation uses a disposable CI checkout. Never run mutations on a shared tree.
if (process.env.CI !== 'true')
  throw new Error('PID mutation proof requires an isolated CI checkout');
const rust = resolve(import.meta.dir, '../../han-rs');
const sourcePath = join(
  rust,
  'crates/han-coordinator/src/posix_runtime_helper.rs'
);
const original = readFileSync(sourcePath, 'utf8');
const name = process.argv[2];
const mutations: Record<
  string,
  { anchor: string; replacement: string; test: string; assertion: string }
> = {
  emptyPublication: {
    anchor:
      'if o.pid != requested_pid || o.nonce != nonce { return Ok(json!({"status":"blocked","ownerPid":o.pid})); }',
    replacement:
      'if o.pid != requested_pid || o.nonce != nonce { return Ok(json!({"status":"owned"})); }',
    test: 'native_empty_publication_never_adopts_live_partial',
    assertion: 'assertion `left == right` failed',
  },
  unguardedPid: {
    anchor:
      'let snap = snapshot(roots, &Target::Active)?;\n    if let Some(o) = owner_for(&snap.claim)? {',
    replacement:
      'let snap = snapshot(roots, &Target::Active)?;\n    if read_at(&roots.data, OsStr::new("coordinator.pid"), true)?.is_some() { unlink(&roots.data, "coordinator.pid", false)?; write_new(&roots.data, "coordinator.pid", requested_pid.to_string().as_bytes())?; }\n    if let Some(o) = owner_for(&snap.claim)? {',
    test: 'native_unguarded_pid_never_overwrites_live_claim',
    assertion: 'assertion `left == right` failed',
  },
  recursiveReclaim: {
    anchor:
      'let owner_file = read_at(&reservation, OsStr::new(&names[0]), false)?.ok_or_else(invalid)?;',
    replacement:
      'if names[0] == "unexpected" { return Ok(ClaimSnapshot::Vacated { reservation: reservation_id }); }\n    let owner_file = read_at(&reservation, OsStr::new(&names[0]), false)?.ok_or_else(invalid)?;',
    test: 'native_recursive_reclaim_rejects_unexpected_entries',
    assertion: 'assertion failed: snapshot(&roots, &Target::Active).is_err()',
  },
  ageSteal: {
    anchor:
      'if let Some(o) = owner_for(&actual.claim)? { if observed(o.pid)? != "gone" { return Ok(json!({"status":"busy"})); } }',
    replacement:
      'if let Some(o) = owner_for(&actual.claim)? { if false && observed(o.pid)? != "gone" { return Ok(json!({"status":"busy"})); } }',
    test: 'native_age_never_authorizes_live_claim_theft',
    assertion: 'assertion `left == right` failed',
  },
  staleRelease: {
    anchor:
      'if !own_claim(&snap.claim, claim)? { return Ok(json!({"status":"changed"})); }',
    replacement:
      'if false && !own_claim(&snap.claim, claim)? { return Ok(json!({"status":"changed"})); }',
    test: 'native_stale_release_preserves_successor',
    assertion: 'assertion `left == right` failed',
  },
  probeFailure: {
    anchor: 'Some(libc::EPERM) => Ok("alive")',
    replacement: 'Some(libc::EPERM) => Ok("gone")',
    test: 'native_probe_failure_never_means_gone',
    assertion: 'assertion `left == right` failed',
  },
  exhaustion: {
    anchor: 'mkdir(&roots.data, &candidate)?;',
    replacement: 'let _ = mkdir(&roots.data, &candidate);',
    test: 'native_collision_never_grants_ownership',
    assertion: 'assertion failed: acquire(&roots, parent(), &nonce).is_err()',
  },
};
const mutation = mutations[name];
if (!mutation) throw new Error(`Unknown PID mutation: ${name}`);
if (original.split(mutation.anchor).length !== 2)
  throw new Error(`Mutation anchor not unique: ${name}`);
const modified = original.replace(mutation.anchor, mutation.replacement);
if (modified === original)
  throw new Error(`Mutation did not modify source: ${name}`);
try {
  writeFileSync(sourcePath, modified);
  const result = Bun.spawnSync(
    [
      'cargo',
      'test',
      '--locked',
      '-p',
      'han-coordinator',
      '--bin',
      'han-coordinator',
      mutation.test,
    ],
    {
      cwd: rust,
      stdout: 'pipe',
      stderr: 'pipe',
      env: process.env,
      timeout: 300_000,
    }
  );
  const output = result.stdout.toString() + result.stderr.toString();
  console.log(output);
  if (
    result.exitCode === 0 ||
    !output.includes(
      `test posix_runtime_helper::tests::${mutation.test} ... FAILED`
    ) ||
    !output.includes(mutation.assertion) ||
    output.includes('timed out')
  )
    throw new Error(
      `Mutation ${name} did not produce the intended behavioral assertion failure`
    );
  console.log(`Mutation ${name} rejected by ${mutation.test}`);
} finally {
  writeFileSync(sourcePath, original);
  if (readFileSync(sourcePath, 'utf8') !== original) {
    console.error('Failed to restore native PID claim source');
    process.exitCode = 1;
  }
}
