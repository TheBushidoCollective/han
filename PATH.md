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

---

# Han on Firebase and Cloud Run: end-to-end path

Read-only checks. Run them from a GitHub-hosted runner or any machine with
network access. They make GET requests only. None of them writes to a live
tenant, signs in, mutates data, or posts a webhook.

Commands assume `HAN_GCP_PROJECT_ID` is set and that the sites are the fixed
IDs in `deploy/firebase/terraform/main.tf`.

## What this path does not prove

- **No authenticated API.** `/graphql` runs without caller identity on `main`
  (`routes.rs`). This PR does not change that, so these checks make no claim
  about signed-in use.
- **No WebSocket.** The app bundle opens `wss://api.han.guru/graphql`, but
  `han-server` has no WebSocket route, and this path does not check one.
- **No browse path.** `han browse` still depends on `certs.han.guru` and the
  TLS coordinator. This PR does not change them.

## 1. Infrastructure

- The latest `Han Infrastructure` run on `main` is `success`, and its
  post-apply plan says "No changes" (`-detailed-exitcode` exits 0).
- `gcloud secrets list --project "$HAN_GCP_PROJECT_ID"` lists the six
  `han-server-*` secrets. Values are never printed.

## 2. Hosting

```sh
curl -fsS https://han-guru-dashboard.web.app/ | grep -q '<script'
curl -sS -o /dev/null -w '%{http_code}\n' https://han-guru-app.web.app/some/deep/link   # 200
```

- The app bundle contains `https://api.han.guru/graphql`. The dashboard bundle
  contains no `api.han.guru` address. The deploy workflow checks both.

## 3. API host

```sh
curl -fsS https://han-guru-api.web.app/health | jq -e 'has("service") and has("status")'
location="$(curl -sS -o /dev/null -w '%{redirect_url}' https://han-guru-api.web.app/auth/github)"
python3 deploy/firebase/scripts/check_redirect.py "$location" "$HAN_GITHUB_CLIENT_ID" \
  https://api.han.guru/auth/github/callback
```

`han-server` percent-encodes `redirect_uri`, so the raw header will not contain
the callback in plain form. `check_redirect.py` compares the decoded values.
Do not follow the redirect and do not sign in.

## 4. Live revision

The deploy workflow reads the startup lines through the constrained view on the
`han-server-logs` bucket, the only log access the deployer holds:

```sh
live="$(gcloud run services describe han-server --project "$HAN_GCP_PROJECT_ID" \
  --region us-central1 --format='value(status.latestReadyRevisionName)')"
gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"han-server\" AND resource.labels.revision_name=\"$live\"" \
  --bucket=han-server-logs --location=us-central1 --view=startup \
  --project "$HAN_GCP_PROJECT_ID" --limit 300 --freshness 2h --format=json > logs.json
python3 deploy/firebase/scripts/check_startup.py logs.json "$live"
```

Passes only when this revision logged "Connected to PostgreSQL", "Migrations
complete" and "LISTEN/NOTIFY triggers created", and logged no degraded-mode or
migration failure. Lines from other revisions do not count.

## 5. Database password: the bootstrap owns it, and recovery is a reviewed rerun

The `han` database user and the `database-url` secret take one password. Only the
bootstrap writes either, so Terraform holds no database or user permission and no
password variable. The bootstrap sets the password and then adds the matching
`database-url` version, in that order, and marks the secret `ready` only when both are
done. The password is generated in the run, reaches gcloud only through a 0600 flags file
(for the user) and stdin (for the secret), and is never in an argument, the plan, the run
output or an artifact. gcloud's own per-run debug log is turned off for these calls. Measured
locally on the installed gcloud 580.0.0 with a sentinel value: without the variable, a run
wrote a log file and the flags-file value was in it; with the variable, the run wrote no
log file. Whether Cloud SQL's audit log records the password is unverified (artifact 20).

A failed run is repaired by running the bootstrap again, with no change to the code:

1. Run the plan and read it. A normal rerun changes nothing when the user exists, an enabled
   `database-url` version exists and the secret is marked `ready`. Otherwise the plan runs the
   sequence again, with a new password, so the user and the newest enabled version match.
2. Dispatch Han Bootstrap as section 8 describes, with `expected_sha256` from that plan.
3. To rotate the password on purpose, dispatch with `rotate_db_password` set to true, and
   compute the hash with `--rotate-db-password`. The rotation changes the plan, so the hash
   covers it. Rotation changes the password the database accepts for new connections, so a
   running revision that opens new connections after the rotation fails them until it is
   replaced. Rotate only with a deploy ready to follow: `han-server` reads
   `database-url:latest`, so the next revision uses the new password.

Do not edit the secret or the user by hand. The bootstrap is the only writer.

**Unverified (artifact 20):** that `gcloud secrets describe` returns the `labels` field this
run reads, and that `sql users create` and `set-password` accept `password` in a flags file
exactly as the captured help says. The first run settles both. If a field is missing, the
run treats the secret as not ready and writes it again, so a wrong guess fails safe.

## 6. Custom domains (after slice K)

```sh
dig +short CNAME app.han.guru           # han-guru-app.web.app.
dig +short CNAME dashboard.local.han.guru
dig +short CNAME api.han.guru
dig +short CNAME certs.han.guru         # empty once slice L removes it
dig +short A coordinator.local.han.guru # 127.0.0.1
```

## 7. Blocked until decided

- **Stripe.** The server requires `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET`. Their Secret Manager secrets exist empty. The deploy
  refuses to run until each has a version. Do not add dummy values.
- **GitHub OAuth.** `HAN_GITHUB_CLIENT_ID` and `han-server-github-client-secret`
  are needed before the API deploys.
- **Bootstrap.** Not run. The ordered human steps are in section 8, and the
  open artifacts that block a production run are listed there too.
- **Browse path.** Unchanged. See "What this path does not prove".

## 8. Shared project: decisions, bootstrap and residual risk

Status: bootstrap rebuilt after an independent review (verdict "not ready") and
tested against a fake cloud that returns the captured gcloud output. **Not run.**
Han runs in the existing project `thebushido-co` (project number 911514101920,
organisation 949208237676). This PR stays a draft until the blockers in
"Unresolved artifacts" are cleared, and merging it is a separate decision.

### Decisions taken by Jason

- **Dedicated Han deployer in the shared project, accepting Firebase Hosting's
  project-wide reach** (residual risk 1), with a dedicated review-gated CI identity
  (`han-hosting-deployer`, environment `han-hosting`).
- **Constrained log access.** Log views exist only on custom log buckets. Han uses
  a custom bucket `han-server-logs`, which receives only `han-server` logs through
  a sink whose filter names the service. The view `startup` on it admits only
  `resource.type="cloud_run_revision"`. A log view's filter accepts only
  `resource.type`, `SOURCE()` and `LOG_ID()`, so the view names that one type, and
  the bucket receives only `han-server` logs. `roles/logging.viewAccessor` is
  granted on that view alone. No project logging viewer is granted.
- **Bootstrap through existing trusted CI only.** `han-bootstrap.yml` runs
  `bootstrap/bootstrap.py`. Nothing runs from a workstation.
- **Plan identity admits pull requests from this repository.** It is read-only,
  and it is admitted from any ref of the named workflows. Jason accepted that
  pull requests from this repository can run its Terraform plan as
  `han-tf-plan`, which reads state (residual risk 4).
- **Environment review conventions.** Required reviewer: GitHub user `jwaldrip`
  (ID 43164). Deployment from `main` only.

### What is built

| Identity | Environment | Project grants | Resource grants |
|---|---|---|---|
| `han-tf-plan` | none (PRs) | `hanTfPlanGlobal`, `hanTfPlanSql` (instance condition) | `hanTfPlanSecrets` on `jwt-secret` and `master-kek`, `run.viewer` on `han-server`, `artifactregistry.reader` on `han`, `storage.objectViewer` on the state bucket |
| `han-tf-apply` | `han-infra-apply` | `hanTfPlanGlobal`, `hanTfApplySql` (instance condition, `instances.get` and `instances.update` only) | `hanTfApplySecrets` on `jwt-secret`, `hanTfApplyKekVersions` on `master-kek` (no destroy), `run.admin` on `han-server`, `artifactregistry.reader` on `han` (read only), `storage.objectAdmin` on the state bucket |
| `han-deployer` | `han-production` | none | `run.developer` on `han-server` (Terraform), `artifactregistry.writer` on `han`, `secretmanager.viewer` on all six secrets, `logging.viewAccessor` on the `startup` view, `iam.serviceAccountUser` on `han-server-run` |
| `han-hosting-deployer` | `han-hosting` | `firebasehosting.admin`, `serviceusage.serviceUsageConsumer` (accepted risk 1). `firebase.viewer` is not granted (artifact 15) | `run.viewer` on `han-server` (Terraform) |
| `han-server-run` | none | `cloudsql.client` on `han-pg` only (instance condition, artifact 6), no logging role | `secretmanager.secretAccessor` on all six secrets |

- **Created by the bootstrap, not by Terraform:** the five identities, the `han-github`
  pool and provider, the state bucket, the six secrets (empty), the `han-pg` instance
  (same settings as Terraform), the `han_team` database, the `han` database user, the
  `han-server` Cloud Run shell (private), the `han` Artifact Registry repository, the log
  bucket, sink and view. The bootstrap also seeds `database-url` with the user's password
  (section 5), so no database or user permission is granted to any Han identity.
- **Hosting sites** are created by the Hosting deploy job, before its deploy, by
  `deploy/firebase/scripts/ensure_hosting_sites.py`. That job already holds the
  Hosting identity and the pinned CLI. The bootstrap does not run Firebase.
- **Terraform** (`deploy/firebase/terraform`) imports the `han-pg` instance and the
  `han-server` service, reads the secrets and identities as data, writes versions of
  `jwt-secret` and `master-kek`, and manages the service's invoker setting and IAM. It
  declares no database, user or database-url version. Nothing has been applied, so no state
  holds any of them. It creates no secret, no secret IAM, no identity, no project IAM, no
  project API, no Firebase project and no Hosting site.
- **The bootstrap** (`bootstrap/bootstrap.py`) has three modes:
  - Default: print the static plan and its `plan-sha256`, reading the local script,
    role files, condition file and bootstrap workflow. It does not query cloud state.
    The hash covers their contents and repository-relative paths.
  - `--execute --expect-sha256 H --expect-commit C`: require the reviewed CI context,
    matching plan hash and commit, and the exact time-limited sign-in binding before
    performing bootstrap operations. Bucket ownership is checked before changing it.
    The run subsequently checks service-account keys and bucket settings.
  - `--revoke-only`: remove the specifically authorized sign-in binding and verify
    the policy afterwards. Unrelated bindings must remain untouched.
- **Failure handling.** The process and workflow attempt revocation after a failure.
  Cancellation, failed authentication or failed policy writes can prevent cleanup.
  An independently enforced expiry and a separate CI retirement path are required.
- **Policy scope limitation.** The bootstrap inspects the service account's own IAM
  policy. It does not prove absence of inherited project, folder or organization grants,
  delegated service-account token minting, or changes to the shared provider mapping.
  Those require separate read-only security verification before the owner grant.
- **Existence is read, not guessed.** An object is treated as missing only when its
  describe prints a not-found text captured from the installed gcloud
  (`bootstrap/not-found-markers.json`). Any other error stops the run. The SQL instance
  is checked from the list, which is an empty list when none exists.

### Human steps, in this order

The environment and variable read-backs below do not grant cloud access. The temporary
sign-in must be created through a separately reviewed CI rail, never from a workstation.

1. **Environments (GitHub admin): done, read back.** Created on 2026-11-05 with the GitHub
   API, by an admin session, after checking that none of the four existed. Each has required
   reviewer `43164` (`jwaldrip`), `prevent_self_review` false, and a deployment branch policy
   for `main` only. `can_admins_bypass` is `false` on all four. The first version was created
   with the default, `true`, and was then changed to `false` in a full update that kept the
   reviewer and the branch policy. No secret was created. No workflow ran from the change.
   Read back through the API. The settings page was not viewed in the browser.
2. **Repository variables: done, read back.** `HAN_GCP_PROJECT_ID`, `HAN_GCP_WIF_PROVIDER`,
   `HAN_GCP_TF_PLAN_SA`, `HAN_GCP_TF_APPLY_SA`, `HAN_GCP_DEPLOYER_SA` and
   `HAN_GCP_HOSTING_DEPLOYER_SA` are set to the values in this section. They are resource
   names, not secrets. Not set: `HAN_GITHUB_CLIENT_ID`, which needs an OAuth app that belongs
   to slice I. Setting the WIF variable does not grant anything: the pool and provider are
   created only by the bootstrap, which has not run.
3. **Do not grant owner access yet.** The bootstrap workflow must first be present on
   the reviewed `main` commit, its checks must pass, and an independently reviewed CI
   rail must be available to create and retire the exact time-limited sign-in binding.
   No existing unchanged CI workflow provides that operation. Do not use a local gcloud
   command or an unconditional grant as a substitute.
4. **Review the exact plan and commit.** Do not execute unreviewed repository code on a
   workstation holding cloud credentials. Review the complete commit and inspect the
   plan-only CI artifact. Independently compare its input hashes with the reviewed
   commit's files and establish the plan hash before granting access.
5. **Grant and approve only after review.** The CI grant must be limited to the exact
   principal, role and time condition and tied to the reviewed commit and plan. Check
   the full run SHA with `gh run view <run-id> --json headSha` before approving the
   same run. A short SHA is not sufficient. Expiry is a backstop, not proof of revoke.
   Confirm the exact binding was removed and the grant rail will not recreate it.
6. Then `han-infra` and the deploy workflows run in the order in "How it runs after
   the prerequisites".

### How it runs after the prerequisites

1. Open a PR. `han-infra` plans as `han-tf-plan`. Merge to `main`, approve
   `han-infra-apply`, and it applies as `han-tf-apply`.
2. The deploy workflows run after `han-infra` succeeds on the same commit.
   `deploy-hosting` creates any missing Hosting site before it deploys.

### Tests, and what they prove

Run `python3 -m unittest discover -s deploy/firebase/test -p 'test_*.py'` on the
revision under review. Results are reported by that run, not assumed here.

- `test_bootstrap.py`: plan mode makes no cloud calls and is deterministic. A
  different hash, or execute without a hash, refuses before any call. A first run creates
  every object and leaves no sign-in member, while other members of the bootstrap policy
  are kept. The logging view filter uses `resource.type` only, the log bucket uses
  `--retention-days`, the sink writes only to the custom bucket, and the Cloud Run shell
  is private. The SQL instance matches Terraform's edition, version, SSL mode and
  deletion protection. Secret grants are per secret with no condition, and only the two
  Terraform secrets, `jwt-secret` and `master-kek`, get the custom roles. A second run creates nothing. A permission error
  is never treated as missing, and an unexpected describe error creates nothing. Revoke
  runs after a failed step, after a failed verification, and after a user key is found. It
  fails when the policy cannot be read or the member survives the write. Every gcloud flag
  the bootstrap passes is one the installed gcloud 580.0.0 accepts (`gcloud-flags.json`).
  The Terraform schema has every attribute used (`tf-schema.json`). The infra workflow's
  bucket name matches the bootstrap's.
- `test_isolation.py`: Terraform grants are the reviewed set, no owner, editor or
  viewer role is used, no Han role can set or create secret IAM, and the shared pool is
  referenced only by the bootstrap workflow. The least-privilege checks: no `firebase.viewer`,
  the apply identity reads the registry and holds no `repoAdmin`, Terraform manages no
  Artifact Registry IAM, the KEK version cannot be destroyed by the apply identity, the apply
  SQL role cannot delete the instance, and the SQL condition is an exact match.
- `test_workflows.py`: the bootstrap plan job has no environment, no sign-in and no
  owner token, and only the apply job holds the environment. Execution is pinned to the
  approved hash and commit, and the revoke step runs only when the execute step did not
  succeed. The Hosting sites are ensured before the deploy. Each identity is used only from
  its environment, and every third-party action is pinned. These are source-text checks.
- `test_scripts.py`: helper scripts, and the Hosting site creation is tested in
  `test_bootstrap.py` (creates only missing sites, stops on a failed list, and reports a
  failed create).

- `test_behaviour.py`: these run code, not text. The infra plan step runs as a script
  under `bash -eo pipefail` with a stub `terraform` that exits 0, 2 or 1: 2 completes and
  records `has_changes=true`, 1 fails. The bootstrap plan from a second checkout path hashes
  the same, a changed role or condition changes the hash, no plan line names an absolute
  path, and a run from another commit is refused before any cloud call.
  Terraform's own dependency graph has no node for the database, the user or the
  database-url version, which is checked offline. The instance sets Cloud SQL's own
  deletion protection, and the provider schema has that attribute under `settings`.

The fault-injection proof, run once against the pre-fix workflow and script: a plan that
exits 2 ended its step with exit 2 and wrote no `has_changes`, so the apply job could not
run. The same plan hashed differently from two checkouts of one commit. Both are fixed,
and `test_behaviour.py` now fails on either.

Not run here: `terraform plan`, any gcloud mutation, and the workflows themselves.
`actionlint` and `terraform validate` pass on the changed files.

### Unresolved artifacts (each blocks production; the PR stays draft)

Every item here is a fact the repository cannot establish. Each names who supplies it.

1. **Environment protections: set and read back (see human step 1).** What remains
   unverified: the admin bypass is read as `false` through the API, and nothing here tests
   that it holds against a real admin attempt. Supplier: a GitHub admin, once, by trying it.
2. **The time-boxed sign-in and its condition.** Whether WIF exchange honours
   `request.time` remains unverified. The required binding uses role
   `roles/iam.workloadIdentityUser`, title `han-bootstrap-sign-in`, description
   `han-bootstrap commit=<full commit> plan=<plan sha256>`, and expression
   `request.time < timestamp('<UTC expiry>')`. The bootstrap checks the expiry window
   and the description against the approved run. Only a reviewed CI rail may grant it.
3. **The shared pool admits the bootstrap subject.** The `github` pool's provider must
   accept `repo:TheBushidoCollective/han:environment:han-bootstrap`. Supplier: the owner of
   that pool (the website team, or Jason). Unverified here.
4. **Apply needs `actAs` on `han-server-run` to update the service?** The apply identity
   changes `invoker_iam_disabled` on `han-server`, and the role set grants no
   `iam.serviceAccounts.actAs`. If the first apply fails for it, the grant is a choice
   Jason makes: `iam.serviceAccountUser` on `han-server-run` lets the holder run a
   workload as the runtime account, which reads all six secrets. Supplier: the first apply,
   and Jason's decision.
5. **Cloud SQL database and user permissions: closed by design.** No Han identity holds
   any database or user permission. The bootstrap creates `han_team` and the `han` user under
   its own time-limited grant, so the condition question no longer applies. Supplier: none
   for this PR. Google documents no Cloud SQL database or user resource type a condition can
   match, so the bootstrap route is the only one that avoids a standing grant.
6. **Runtime Cloud SQL scope: narrowed, not yet proven.** `cloudsql.client` on `han-server-run`
   is bound with the instance condition, `resource.type == 'sqladmin.googleapis.com/Instance'`
   and `resource.name` for `han-pg`, the form Google's Cloud SQL page documents. `logging.logWriter`
   is removed: the server writes JSON to stdout, and it has no Logging API client (checked in
   `packages/han-rs/crates/han-server`). Supplier: the first deploy. Its `check_startup`
   requires "Connected to PostgreSQL" through the `startup` view, so a missing grant fails the
   deploy rather than passing it.
7. **Write-only read-back and replacement, narrowed.** The question is now limited to
   `jwt-secret` and `master-kek`. The database password is no longer in Terraform. Whether
   the provider reads a write-only value back during refresh, and whether bumping the
   version is an update or a replacement. Supplier: the first plan.
8. **Terraform's GCS backend under the plan identity.** Whether `storage.objectViewer` on
   the state bucket is enough for `init`, or whether the backend also needs a bucket read.
   Supplier: the first plan.
9. **Refresh of IAM members under `run.viewer`.** Whether `run.viewer` includes
   `run.services.getIamPolicy`, which the `google_cloud_run_v2_service_iam_member`
   refresh uses. Supplier: the first plan.
10. **Cloud SQL missing-instance check.** The list-based check reads a `name` field from
    `gcloud sql instances list --format=json`. That field is not captured from a live call
    here. Supplier: the first run, which fails closed if the field differs.
11. **`gcloud auth list --format=json` under WIF.** The active account is read from this
    output, and a mismatch stops the run before any change. Supplier: the first run.
12. **Fork pull requests and the plan identity.** The fork approval policy reads
    `first_time_contributors`, and GitHub does not grant `id-token` to fork pull requests by
    default. Whether that holds for the plan job is unverified. The repo's default workflow
    token permission reads `write` (not Han's own setting; Han's workflows declare their
    permissions). Supplier: a GitHub admin, to confirm the fork setting for this repository.
13. **Website-repo identities hold project-wide reach (not fixed here).** Read from the
    website repo's Terraform, not live IAM. `astro-deployer` holds project-wide `run.admin`
    and `iam.serviceAccountUser` (`deploy/terraform/astro/service_accounts.tf:69-78`), and
    any branch of that repo can sign in as it (`:22,90-95`). With those roles it can
    redeploy `han-server` as `han-server-run` and read all six secrets. Project-wide
    `serviceAccountUser` also covers `terraform-ci` and `terraform-bootstrap`.
    `website-deployer` adds project `run.admin` from any website branch
    (`service_accounts.tf:47-51`, `workload_identity.tf:50-54`). Supplier: the website
    team. Han cannot isolate itself in this project until this changes.
14. **`terraform-bootstrap` user key `871c68f6…`.** Anyone holding it is owner of
    `thebushido-co`. Supplier: Jason, whether to delete it. Deleting it is outside this task.
15. **Hosting deployer without `firebase.viewer`.** It was removed as beyond the accepted
    Hosting exception. Supplier: the first Hosting deploy. If it fails on a Firebase
    permission, add the one permission it names by a reviewed PR, and do not restore the role.
16. **Apply reads the registry with `artifactregistry.reader`.** The repository data source
    needs `repositories.get`, which the reader role has. Supplier: the first plan.
17. **Exact-match SQL condition, and the instance-update path.** The condition names
    `sqladmin.googleapis.com/Instance` and the exact `han-pg` resource name. Verified by
    nothing yet. Two paths are unproven:
    - The runtime connection and the plan's refresh (`instances.get`). The first plan and the
      first deploy settle these.
    - The apply's instance update (`instances.update`). The bootstrap creates the instance with
      the settings Terraform declares, so the first apply most likely makes no change and never
      calls it. After a real update, the provider waits on `operations.get`, which is checked
      as `cloudsql.instances.get`. Whether that check presents the Instance type to the
      condition is not documented, so an update may apply and still fail the run. This stays
      unproven until the first real instance change. A refusal fails closed.
18. **First apply and the database password: closed by ordering and a state label.** The
    bootstrap sets the password, then adds the matching version, and marks the secret `ready`
    only after both. A failed run is repaired by a rerun, and a rerun changes nothing when the
    user, an enabled version and the `ready` label all agree (section 5). The residual is a
    rotation that stops between its steps, which the next run repairs. Supplier: the first run
    shows whether the labels read back as written (artifact 20).
19. **Cloud SQL deletion protection.** `settings.deletion_protection_enabled = true` is set in
    Terraform, matching the bootstrap's `--deletion-protection`. Supplier: the first plan after
    import must show no change to it.
20. **gcloud behaviour, and the audit log, that the password sequence relies on.**
    - `gcloud secrets describe` returns a `labels` field, and `sql users create` and
      `set-password` accept `password` in a `--flags-file`. Both are in the installed help or
      the API. Neither has run against the live project. A missing label reads as not ready, so
      the run writes the password again, which is the safe direction.
    - Cloud SQL's Admin Activity audit log records `users.insert` and `users.update`. Nothing in
      this repository shows that Google redacts the password field of those entries. Anyone with
      project-wide log access in `thebushido-co` could read them. The old Terraform route called
      the same API, so this exposure is not new. Unverified, and not tested here. Supplier: a
      project log reader, who can check the entries after the first run.
    - Supplier for the first run: confirm the labels read back as written.

### Residual risk, accepted or open

1. **Hosting is project-wide (accepted by Jason).** `han-hosting-deployer` can deploy or
   delete every Hosting site in the project: `withbushido-ai`, `thebushido-web`,
   `thebushido-co` and the client demos. Covered by `test_isolation.py`
   (`OPEN_PROJECT_WIDE_GRANTS`) and by the one hosting grant in `bootstrap.py`.
2. **`terraform-bootstrap` is owner and has a user-managed key** (artifact 14).
3. **`terraform-ci` is owner and reachable from website-repo branches** (artifact 13).
   It outranks anything Han builds. **Owner: the website team.**
4. **The plan identity is reachable from any ref of the named workflows.** Accepted by
   Jason. Its grants are read-only, and it reads state.
5. **Secret values are never in Terraform state.** Terraform writes two secrets, `jwt-secret`
   and `master-kek`, both with write-only values. The bootstrap writes `database-url` from
   stdin. The other three take values by an operator, out of band.

### Merge order (recorded, not a blocker)

The bootstrap runs only from `main`, and `han-infra` runs on pushes to `main`. Once this PR
merges, the plan job of `han-infra` fails red on each push until the bootstrap has created the
identities it plans as. No apply and no deploy runs in that window, because both wait for a
green plan. This is the cost of the order the bootstrap requires, and it is recorded here.

### Left undisturbed

The Railway services, the Terraform Cloud workspace, and every existing
`thebushido-co` resource: the website, Relic, client demos, secrets and buckets.
