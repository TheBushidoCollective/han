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
bun test test/windows-probe-diagnostic.test.ts
bun scripts/build-bundle.js bun-windows-x64
bun scripts/prove-installed-windows-coordinator.ts <han.exe> <han-coordinator.exe>
```

The default-build installed proof uses disposable private data and exercises
authenticated HTTPS and gRPC, restart, crash recovery, dead-pair stop and
restart, orphan shutdown, missing-lock and incomplete-claim startup,
modeled PID reuse, and fast-exit startup receipt validation. The modeled case changes a stale descriptor to refer to a
live fixture process with a different creation time; it does not claim an
actual OS PID recycle.

### Output contract

Proof progress and diagnostic output is emitted to stderr in structured JSON lines:

- Progress: `Installed Windows proof progress: {"phase","elapsedMs","previous":{"phase","ms","cliCount","cliMs","cliMaxMs","probeCount","probeMs"}}`
- Cleanup: `Installed Windows proof cleanup: {"step","ms","ok","terminated?","remaining?"}` where step is one of `fixture`, `stop`, `fast-exit-stop`, `sweep`, `remove`, `complete`
- Failure: `Installed Windows proof failure: {"phase","exitStatus","diagnostic","process?","reason"}`
- Diagnostic: `Installed Windows probe diagnostic: {"variant","at20s?","ps?","traceBytes?","otherTraceLines?","osPoll?","osExitMs?","bunExitMs?","exitCode?","killedAtCap?","reaped","pipeRetained?","bunExitedBeforeCheck?","classified?"}`
- Pass (on stdout): `Installed Windows CLI: authenticated transport, crash recovery, restart, stop, missing lock, partial claim, modeled PID reuse, and fast-exit receipt passed`

Output lines contain only allowlisted phase and cleanup step names, integers, and booleans. Diagnostic error payloads may include validated process metadata (such as `childPid` and `supervisorPid`), while probe diagnostic records strictly exclude PIDs, process arguments, and paths. Across all records, no raw paths, backslashes, certificates (`BEGIN CERTIFICATE`), or bearer tokens are leaked. Validated failure reasons include `deadline`, `subprocess_timeout`, `output_handle_retained`, `watchdog`, `probe_diagnostic`, and helper error categories.
### Budgets and environment variables

The proof execution is bounded by strict timing hierarchy:

- `HAN_PROOF_DEADLINE_MS`: soft execution deadline in milliseconds. Defaults to 2100000 (35 minutes) for the default proof, 420000 (7 minutes) for startup barrier proof, and 60000 for negative control. Accepts integer strings from 30000 to 3600000. Exceeding this budget aborts the active phase with reason `deadline`.
- `HAN_PROOF_CLEANUP_MS`: cleanup budget in milliseconds. Defaults to 180000 (3 minutes). Accepts integer strings from 30000 to 3600000. Governs teardown of fixtures, graceful stops, temp root process sweeps, and file deletion.
- Watchdog: automatically arms at soft deadline + cleanup budget + 60000 ms (39 minutes in default proof). If triggered, it emits a failure line with reason `watchdog`, runs a synchronous root sweep, and calls `process.exit(1)`.
- Step timeouts: 42 minutes for the default proof, 17 minutes for probe diagnostic replay, 12 minutes for barrier proof, 8 minutes for negative control. Build steps have a 20-minute timeout. Job timeout is 75 minutes, keeping watchdog < step timeout < job timeout.

### Diagnostic probe replay

Before the negative control, CI can execute a diagnostic probe replay experiment by setting `HAN_PROOF_PROBE_DIAGNOSTIC=1`, `HAN_PROOF_DEADLINE_MS=660000`, and `HAN_PROOF_CLEANUP_MS=180000` (under a 17-minute step timeout).

The diagnostic step replays the failing `ownedProcess(kill=false)` probe against the live coordinator at `initial-start-coordinator` across five controlled variants:
1. `proof-hidden-traced`
2. `os-liveness-control`
3. `proof-fresh-hidden-untraced`
4. `proof-fresh-visible-traced`
5. `runner-hidden-traced`

The diagnostic step asserts:
- Exit code 1
- Exactly 1 failure line with `phase == 'initial-start-coordinator'` and `reason == 'probe_diagnostic'`
- Exactly 5 diagnostic records matching the variant sequence, with `reaped == true` on every record
- Exactly 1 cleanup record with `step: complete` and `ok: true`, with no cleanup failures (`ok: false`)
- Every non-empty output line matches `^Installed Windows (proof (progress|failure|cleanup)|probe diagnostic): \{.*\}$`
- No line contains forbidden tokens (`BEGIN CERTIFICATE`, `Bearer`) or backslashes (`\`)
- Followed by a clean leak check reporting 0 leftover installed-root processes (the diagnostic children `powershell.exe` and `cmd.exe` reside in `System32` outside the installed-root pattern `\han-windows-installed-`, with termination enforced by the finite child timeouts, explicit `reaped: true` assertion, and workspace deletion lock failure)

Note on disposable runner state: the `runner-hidden-traced` variant executes under `process.env`, which permits PowerShell to write module analysis cache data into the runner's `%LOCALAPPDATA%`, matching the behavior of `sweepRoot` on a disposable hosted runner.

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
check for leftover coordinator/CLI binaries inside the disposable root runs with `if: always()` and a 2-minute timeout:

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
