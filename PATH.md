# Verification paths

## Stop hook validation

From `packages/han`, run:

```sh
bun test test/hook-stop-selection.test.ts
```

The test dispatches `Stop` through the source CLI and generated plugin hooks in a disposable Git workspace. It checks project selection, ignored dependencies, BDD configuration selection, Biome diagnostics, and authored file contents. Its coordinator is mocked unavailable; it does not prove the installed binary or coordinator execution path.

## Han bootstrap lease

From the repository root, run:

```sh
PYTHONPATH=deploy/firebase/test python3 -B -m unittest -v \
  test_bootstrap.FirstRun test_bootstrap.ExecutionBoundary \
  test_bootstrap.DatabasePasswordSequence test_bootstrap_execution test_allow_coverage
```

The command exercises the approved-plan entry path, v2 lease and anchor checks,
rotation, inherited-policy coverage, and exact revoke against fake backends. It
makes no Google or GitHub requests and does not prove live IAM enforcement,
credential expiry, website retirement, or deployment. The same test classes run
in `Validate Han Bootstrap`.
