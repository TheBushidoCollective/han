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

The proof uses disposable data directories and checks authenticated stop,
restart, crash recovery, replacement isolation, and shutdown races. It does
not exercise an installed production binary or a shared data directory.

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
