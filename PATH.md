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
bun test test/coordinator-windows-runtime.test.ts
bun test test/coordinator-windows-health.test.ts
bun test test/coordinator-windows-startup.test.ts
bun test test/windows-proof-diagnostics.test.ts
bun test test/coordinator-windows-receipt.test.ts
bun scripts/build-bundle.js bun-windows-x64
bun scripts/prove-installed-windows-coordinator.ts <han.exe> <han-coordinator.exe>
```

The default-build installed proof uses disposable private data and exercises
authenticated HTTPS and gRPC, restart, crash recovery, dead-pair stop and
restart, orphan shutdown, missing-lock and incomplete-claim startup,
modeled PID reuse, and fast-exit startup receipt validation. The modeled case changes a stale descriptor to refer to a
live fixture process with a different creation time; it does not claim an
actual OS PID recycle. Failure output is restricted to the phase, numeric exit
status, and validated helper metadata, with cleanup failures reported
separately.

For the distinct feature-enabled fixed-port proof, build with
`cargo build --locked -p han-coordinator --features proof-startup-barrier`, set
`HAN_PROOF_BARRIER_ONLY=1`, and run the installed proof command above with that
coordinator binary. The default installed pair must also be proven separately.
The `windows-native-primitives` job runs both paths on Windows.

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
