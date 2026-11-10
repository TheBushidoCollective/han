# Stop hook validation path

From `packages/han`, run:

```sh
bun test test/hook-stop-selection.test.ts
```

The test dispatches `Stop` through the source CLI and generated plugin hooks in a disposable Git workspace. It checks project selection, ignored dependencies, BDD configuration selection, Biome diagnostics, and authored file contents. Its coordinator is mocked unavailable; it does not prove the installed binary or coordinator execution path.

## Coordinator supervisor path

In an isolated Linux CI runner, build and test `han-coordinator` from
`packages/han-rs` with `cargo build --locked -p han-coordinator` and
`cargo test --locked -p han-coordinator`. Then run
`bun run scripts/prove-supervisor.ts` from `packages/han`.

The default-build proof uses disposable data directories and exercises
authenticated stop, restart, crash recovery, dead supervisor and child recovery,
orphan shutdown, replacement isolation, and shutdown races. It does not
exercise an installed production binary or a shared data directory.

The fixed-port bind-before-publication case uses a separate, explicitly
feature-enabled coordinator. After the default proof, build with
`cargo build --locked -p han-coordinator --features proof-startup-barrier`
from `packages/han-rs`, then run
`HAN_PROOF_BARRIER_ONLY=1 bun run scripts/prove-supervisor.ts` from
`packages/han`. The feature is not in the default build. Its private fixture
holds a real child after binding and before publication, checks the predecessor
descriptor and pending listener connections, then releases it and authenticates
the replacement. This is separate evidence from the default artifact.

## Installed Windows coordinator path

On a disposable Windows CI runner, from `packages/han-rs`, run
`cargo test --locked -p han-coordinator windows_` and
`powershell -File crates/han-coordinator/tests/windows_cross_user.ps1 -Coordinator <fresh-coordinator.exe>`.
From `packages/han`, run each test in a separate Bun invocation:

```sh
bun test test/coordinator-binary-windows.test.ts
bun test test/coordinator-windows-runtime.test.ts
bun test test/coordinator-windows-health.test.ts
bun test test/coordinator-windows-startup.test.ts
bun test test/windows-proof-diagnostics.test.ts
bun test test/coordinator-windows-receipt.test.ts
bun test test/windows-proof-bounds.test.ts
bun scripts/build-bundle.js bun-windows-x64
bun scripts/prove-installed-windows-coordinator.ts <han.exe> <han-coordinator.exe>
```

The default-build installed proof uses disposable private data and exercises
authenticated HTTPS and gRPC, restart, crash recovery, dead-pair stop and
restart, orphan shutdown, missing-lock and incomplete-claim startup,
modeled PID reuse, and fast-exit startup receipt validation. The modeled case changes a stale descriptor to refer to a
live fixture process with a different creation time; it does not claim an
actual OS PID recycle.

PowerShell probes (identity and kill checks, the barrier parent check, the loopback connection check) and the modeled-PID-reuse fixture run under the proof's private environment with `$PSModuleAutoLoadingPreference='None'` and call only .NET APIs, so no launch performs module discovery. `test/windows-proof-bounds.test.ts` runs each under that environment and fails if a launch takes 5 seconds or more (10 seconds for the WMI parent check).

### Output contract

Proof progress and diagnostic output is emitted to stderr in structured JSON lines:

- Progress: `Installed Windows proof progress: {"phase","elapsedMs","previous":{"phase","ms","cliCount","cliMs","cliMaxMs","probeCount","probeMs"}}`
- Cleanup: `Installed Windows proof cleanup: {"step","ms","ok","terminated?","remaining?"}` where step is one of `fixture`, `stop`, `fast-exit-stop`, `sweep`, `remove`, `complete`
- Failure: `Installed Windows proof failure: {"phase","exitStatus","diagnostic","process?","reason"}`
- Pass (on stdout): `Installed Windows CLI: authenticated transport, crash recovery, restart, stop, missing lock, partial claim, modeled PID reuse, and fast-exit receipt passed`

Output lines contain only allowlisted phase and cleanup step names, integers, and booleans. Diagnostic error payloads may include validated process metadata (such as `childPid` and `supervisorPid`), but no secrets, credentials, certificates (`BEGIN CERTIFICATE`), or bearer tokens are leaked. Validated failure reasons include `deadline`, `subprocess_timeout`, `output_handle_retained`, `watchdog`, and helper error categories.
### Budgets and environment variables

The proof execution is bounded by strict timing hierarchy:

- `HAN_PROOF_DEADLINE_MS`: soft execution deadline in milliseconds. Defaults to 2100000 (35 minutes) for the default proof, 420000 (7 minutes) for startup barrier proof, and 60000 for negative control. Accepts integer strings from 30000 to 3600000. Exceeding this budget aborts the active phase with reason `deadline`.
- `HAN_PROOF_CLEANUP_MS`: cleanup budget in milliseconds. Defaults to 180000 (3 minutes). Accepts integer strings from 30000 to 3600000. Governs teardown of fixtures, graceful stops, temp root process sweeps, and file deletion.
- Watchdog: automatically arms at soft deadline + cleanup budget + 60000 ms (39 minutes in default proof). If triggered, it emits a failure line with reason `watchdog`, runs a synchronous root sweep, and calls `process.exit(1)`.
- Step timeouts: 42 minutes for the default proof, 12 minutes for barrier proof, 8 minutes for negative control. Build steps have a 20-minute timeout. Job timeout is 75 minutes, keeping watchdog < step timeout < job timeout.

### Negative control

Before the default proof, CI runs a negative control against the real built pair with `HAN_PROOF_DEADLINE_MS=60000` and `HAN_PROOF_CLEANUP_MS=180000`. The step asserts:

- Exit code 1
- Wall time is 270 seconds or less
- Exactly one failure line with reason `deadline` and an allowlisted phase
- Progress reaches `initial-start-health` or later with `previous.probeCount >= 1`
- Cleanup reaches step `complete` with `ok: true`, and no cleanup step reports failure (`ok: false`)
- Every line matches `^Installed Windows proof (progress|failure|cleanup): \{.*\}$`
- No line contains forbidden tokens (`BEGIN CERTIFICATE` or `Bearer`)
- Followed by a clean leak check reporting 0 leftover processes

### Barrier semantics

For the distinct feature-enabled fixed-port proof, build with
`cargo build --locked -p han-coordinator --features proof-startup-barrier`, set
`HAN_PROOF_BARRIER_ONLY=1`, and run the installed proof command with that
coordinator binary. Under `HAN_PROOF_BARRIER_ONLY=1`, the proof executes only
initial status, initial start, the barrier phase (`fixed-port-bind-before-publication`),
stop, and cleanup, and exits cleanly under the 420000 ms deadline (12-minute step timeout),
matching Linux barrier semantics without repeating the full suite. The step requires
an explicit pass line (`Installed Windows CLI: fixed-port startup barrier passed`) and fails
if any cleanup step reports failure.

The default installed pair is proven separately under its 42-minute step budget, requiring
its distinct pass line (`Installed Windows CLI: authenticated transport...`) and clean cleanup.
The `windows-native-primitives` job runs both paths on Windows.

### Leak check

After the negative control and after each proof step, a post-execution PowerShell
check runs with `if: always()` and a 2-minute timeout:

```pwsh
$m = '\han-windows-installed-'
$left = @(Get-Process | Where-Object {
  try {
    $_.Path -and $_.Path.IndexOf($m, [StringComparison]::OrdinalIgnoreCase) -ge 0
  } catch {
    $false
  }
})
"Installed Windows proof leftover processes: $($left.Count)"
if ($left.Count) {
  $left | ForEach-Object { Stop-Process -InputObject $_ -Force -ErrorAction SilentlyContinue }
  exit 1
}
```

The leak check confines inspection to process executables located within the proof
temp directory (`\han-windows-installed-`). Leftover processes are terminated using
their `Process` object handle via `Stop-Process -InputObject` (never by PID alone),
and the step fails if any process leaked.

## Local browser transport path

Use Bun 1.4.4, Rust with the protobuf compiler, and the dependencies installed
from the Han and browse-client lockfiles. Build the release coordinator from
`packages/han-rs` with `cargo build --locked --release -p han-coordinator`,
generate the CLI build metadata, and install Playwright Chromium and its system
dependencies as in the `browser-transport` CI job.

From `packages/han`, run `bun test test/hosted-proxy.test.ts`. From
`packages/browse-client`, run `bun run test:unit` and
`bunx playwright test --config playwright.transport.config.ts`. The browser
proof opens the file launcher and exercises the local session, GraphQL, and
subscription transport using disposable state.

## Native release proof path

On native CI runners (`ubuntu-latest`, `ubuntu-24.04-arm`, `macos-latest`, `macos-15-intel`, `windows-latest`), each candidate release artifact undergoes native acceptance testing before publication:

1. `prove-installer.ts`: Verifies fresh curl installation, layout in `.han-releases` or Windows sibling directory, executable verification, and pair pruning.
2. `prove-installed-coordinator`: Verifies native daemon lifecycle, descriptor exchange, and process isolation.
3. `prove-installed-hooks.ts`: Verifies hook execution with the installed binary.
4. Browser transport: Playwright end-to-end suite against the installed standalone binary (`HAN_TRANSPORT_CLI`).
5. `prove-legacy-upgrade.ts`: Verifies migration from legacy v3.22.0 files.
6. Leak check: Asserts zero orphaned background processes.
