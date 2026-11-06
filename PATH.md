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
