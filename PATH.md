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

## 5. Recovering a database password mismatch

The SQL user and the `han-server-database-url` secret take one password,
generated per apply and tied to `var.db_credential_version`. A failed apply can
leave one of them behind. To recover:

1. Confirm which side is stale: the apply log shows which resource failed.
2. Bump `db_credential_version` by one, in a PR. Merge it through `han-infra`.
3. Read the saved plan's action for `google_secret_manager_secret_version.database_url`
   and `google_sql_user.han`. Both must be `update`. If either is `replace`, the
   plan guard refuses it. Then a reviewed `DESTROY_ALLOWLIST` entry for that
   exact address is needed, added in a PR and reviewed before merge.
4. The apply rewrites the SQL user and the secret version together.
5. Redeploy `han-server` so the new revision reads the new secret.

Do not edit the secret or the user by hand. Both are managed by Terraform.

**Unverified (artifact 7 in section 8):** whether the provider reports a change to
`secret_data_wo_version` or `password_wo_version` as an in-place update or a
replacement. The installed schema does not say. The first plan that bumps the
version shows it. Until then, step 3 is the check, not an assumption.

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
| `han-tf-plan` | none (PRs) | `hanTfPlanGlobal`, `hanTfPlanSql` (instance condition) | `hanTfPlanSecrets` on the three Terraform secrets, `run.viewer` on `han-server`, `artifactregistry.reader` on `han`, `storage.objectViewer` on the state bucket |
| `han-tf-apply` | `han-infra-apply` | `hanTfPlanGlobal`, `hanTfApplySql` (instance condition) | `hanTfApplySecrets` on `database-url` and `jwt-secret`, `hanTfApplyKekVersions` on `master-kek` (no destroy), `run.admin` on `han-server`, `artifactregistry.reader` on `han` (read only, for the data source), `storage.objectAdmin` on the state bucket |
| `han-deployer` | `han-production` | none | `run.developer` on `han-server` (Terraform), `artifactregistry.writer` on `han`, `secretmanager.viewer` on all six secrets, `logging.viewAccessor` on the `startup` view, `iam.serviceAccountUser` on `han-server-run` |
| `han-hosting-deployer` | `han-hosting` | `firebasehosting.admin`, `serviceusage.serviceUsageConsumer` (accepted risk 1). `firebase.viewer` is not granted (artifact 15) | `run.viewer` on `han-server` (Terraform) |
| `han-server-run` | none | `cloudsql.client`, `logging.logWriter` (both unconditioned, see artifact 6) | `secretmanager.secretAccessor` on all six secrets |

- **Created by the bootstrap, not by Terraform:** the five identities, the `han-github`
  pool and provider, the state bucket, the six secrets (empty), the `han-pg` instance
  (same settings as Terraform), the `han-server` Cloud Run shell (private), the
  `han` Artifact Registry repository, the log bucket, sink and view.
- **Hosting sites** are created by the Hosting deploy job, before its deploy, by
  `deploy/firebase/scripts/ensure_hosting_sites.py`. That job already holds the
  Hosting identity and the pinned CLI. The bootstrap does not run Firebase.
- **Terraform** (`deploy/firebase/terraform`) imports the `han-pg` instance and the
  `han-server` service, reads the secrets and identities as data, writes versions of
  the three secrets it manages, and manages the `han-pg` database and user and the
  service's invoker setting and IAM. It creates no secret, no secret IAM, no identity,
  no project IAM, no project API, no Firebase project and no Hosting site.
- **The bootstrap** (`bootstrap/bootstrap.py`) has three modes:
  - Default: print the plan and its `plan-sha256`. It reads nothing and calls no
    cloud API. The hash covers repository-relative paths, the code, and the role and condition
    files, so it is the same on any checkout of one commit.
  - `--execute --expect-sha256 H --expect-commit C`: run the plan, but refuse before any call
    unless it hashes to `H` and `GITHUB_SHA` is `C`. It first checks the run is signed in as
    `terraform-bootstrap` and no Han identity has a user-managed key, then runs the
    plan, then checks the state bucket is private, versioned and in the project.
  - `--revoke-only`: remove every member ending `/subject/repo:TheBushidoCollective/han:environment:han-bootstrap`
    from the bootstrap account's policy, then read the policy back and fail if any
    such member remains.
- **Failure never leaves the sign-in open.** An execute that fails at any step still
  runs the revoke before it exits. The workflow's last step also runs the revoke with
  `if: always()`, after a successful sign-in, so a killed process is covered too.
- **Existence is read, not guessed.** An object is treated as missing only when its
  describe prints a not-found text captured from the installed gcloud
  (`bootstrap/not-found-markers.json`). Any other error stops the run. The SQL instance
  is checked from the list, which is an empty list when none exists.

### Human steps, in this order

These need an owner or a GitHub admin. None of them can be done from CI, because
the identity that would need them is not yet able to sign in.

1. **Environments first (GitHub admin).** Create `han-bootstrap`, `han-infra-apply`,
   `han-production` and `han-hosting`. Each gets required reviewer `43164` and
   deployment from `main` only. On `han-bootstrap` and `han-infra-apply`, turn off
   "Allow administrators to bypass configured protection rules". Leave "Prevent
   self-review" off, because Jason both dispatches and approves. Check each page shows
   these before step 3.
   **Artifact 1:** the bypass setting is read from each environment page. No test here
   verifies it.
2. **Repository variables (GitHub admin).** `HAN_GCP_PROJECT_ID=thebushido-co`,
   `HAN_GCP_WIF_PROVIDER=projects/911514101920/locations/global/workloadIdentityPools/han-github/providers/han-github`,
   `HAN_GCP_TF_PLAN_SA`, `HAN_GCP_TF_APPLY_SA`, `HAN_GCP_DEPLOYER_SA`,
   `HAN_GCP_HOSTING_DEPLOYER_SA`. Set `HAN_GITHUB_CLIENT_ID` at slice I.
3. **Time-boxed sign-in grant (Jason, owner session).** Write a condition file that
   expires after the approval wait and the apply job's 45-minute limit have passed, with the time chosen by Jason:

   ```yaml
   title: bootstrap-sign-in-once
   description: Time-boxed grant for one Han bootstrap run.
   expression: "request.time < timestamp('<EXPIRY, RFC 3339>')"
   ```

   Then grant it:

   ```sh
   gcloud iam service-accounts add-iam-policy-binding terraform-bootstrap@thebushido-co.iam.gserviceaccount.com \
     --project=thebushido-co --role=roles/iam.workloadIdentityUser \
     --member="principal://iam.googleapis.com/projects/911514101920/locations/global/workloadIdentityPools/github/subject/repo:TheBushidoCollective/han:environment:han-bootstrap" \
     --condition-from-file=bootstrap-sign-in.yaml \
     --account=jason@withbushido.ai
   ```

   The run removes this binding itself. If it expires unused, it does nothing.
   **Artifact 2:** whether a WIF token exchange honours a `request.time` condition
   on this grant is unverified. A refused exchange fails the run before any change.
4. **Compute the plan hash from the reviewed commit.** Check out the commit to review and
   run `python3 deploy/firebase/bootstrap/bootstrap.py` from its root. It reads nothing and
   calls no cloud API. It prints `plan-sha256`, which is the same on any checkout of that
   commit: the plan names repository-relative paths and hashes the code and the role and
   condition files.
5. **Dispatch and read the plan.** Run **Han Bootstrap** from `main`, entering that hash
   as `expected_sha256` and the head commit of `main` as `expected_commit`. The `plan` job
   checks both and uploads the plan text as `han-bootstrap-plan`. Read it.
6. **Approve.** Approve `han-bootstrap` only if the artifact matches the plan you computed
   in step 4, and the run's commit is the commit you reviewed. The `apply` job refuses any
   other hash or commit before a single cloud call. A successful execute revokes the
   sign-in in its own process. The workflow's last step runs only when the execute step
   did not succeed.
7. Then `han-infra` and the deploy workflows run in the order in "How it runs after
   the prerequisites".

### How it runs after the prerequisites

1. Open a PR. `han-infra` plans as `han-tf-plan`. Merge to `main`, approve
   `han-infra-apply`, and it applies as `han-tf-apply`.
2. The deploy workflows run after `han-infra` succeeds on the same commit.
   `deploy-hosting` creates any missing Hosting site before it deploys.

### Tests, and what they prove

Run with `python3 -m unittest discover -s deploy/firebase/test -p 'test_*.py'`. 168 tests, all passing:

- `test_bootstrap.py` (50): plan mode reads and writes nothing, and is deterministic. A
  different hash, or execute without a hash, refuses before any call. A first run creates
  every object and leaves no sign-in member, while other members of the bootstrap policy
  are kept. The logging view filter uses `resource.type` only, the log bucket uses
  `--retention-days`, the sink writes only to the custom bucket, and the Cloud Run shell
  is private. The SQL instance matches Terraform's edition, version, SSL mode and
  deletion protection. Secret grants are per secret with no condition, and only the three
  Terraform secrets get the custom roles. A second run creates nothing. A permission error
  is never treated as missing, and an unexpected describe error creates nothing. Revoke
  runs after a failed step, after a failed verification, and after a user key is found. It
  fails when the policy cannot be read or the member survives the write. Every gcloud flag
  the bootstrap passes is one the installed gcloud 580.0.0 accepts (`gcloud-flags.json`).
  The Terraform schema has every attribute used (`tf-schema.json`). The infra workflow's
  bucket name matches the bootstrap's.
- `test_isolation.py` (18): Terraform grants are the reviewed set, no owner, editor or
  viewer role is used, no Han role can set or create secret IAM, and the shared pool is
  referenced only by the bootstrap workflow. The least-privilege checks: no `firebase.viewer`,
  the apply identity reads the registry and holds no `repoAdmin`, Terraform manages no
  Artifact Registry IAM, the KEK version cannot be destroyed by the apply identity, the apply
  SQL role cannot delete the instance, and the SQL condition is an exact match.
- `test_workflows.py` (55): the bootstrap plan job has no environment, no sign-in and no
  owner token, and only the apply job holds the environment. Execution is pinned to the
  approved hash and commit, and the revoke step runs only when the execute step did not
  succeed. The Hosting sites are ensured before the deploy. Each identity is used only from
  its environment, and every third-party action is pinned. These are source-text checks.
- `test_scripts.py` (29): helper scripts, and the Hosting site creation is tested in
  `test_bootstrap.py` (creates only missing sites, stops on a failed list, and reports a
  failed create).

- `test_behaviour.py` (16): these run code, not text. The infra plan step runs as a script
  under `bash -eo pipefail` with a stub `terraform` that exits 0, 2 or 1: 2 completes and
  records `has_changes=true`, 1 fails. The bootstrap plan from a second checkout path hashes
  the same, a changed role or condition changes the hash, no plan line names an absolute
  path, and a run from another commit is refused before any cloud call.
  Terraform's own dependency graph puts the secret version after the SQL user, which is
  checked offline. The instance sets Cloud SQL's own deletion protection, and the provider
  schema has that attribute under `settings`.

The fault-injection proof, run once against the pre-fix workflow and script: a plan that
exits 2 ended its step with exit 2 and wrote no `has_changes`, so the apply job could not
run. The same plan hashed differently from two checkouts of one commit. Both are fixed,
and `test_behaviour.py` now fails on either.

Not run here: `terraform plan`, any gcloud mutation, and the workflows themselves.
`actionlint` and `terraform validate` pass on the changed files.

### Unresolved artifacts (each blocks production; the PR stays draft)

Every item here is a fact the repository cannot establish. Each names who supplies it.

1. **Environment protections.** Reviewer `43164` and `main`-only deployment on all four
   environments, and whether admins can bypass them. Supplier: a GitHub admin, checked on
   each environment page, before step 3.
2. **The time-boxed sign-in and its condition.** Whether the WIF exchange honours
   `request.time`, and the expiry. Supplier: Jason, at step 3. A refused exchange fails
   before any change.
3. **The shared pool admits the bootstrap subject.** The `github` pool's provider must
   accept `repo:TheBushidoCollective/han:environment:han-bootstrap`. Supplier: the owner of
   that pool (the website team, or Jason). Unverified here.
4. **Apply needs `actAs` on `han-server-run` to update the service?** The apply identity
   changes `invoker_iam_disabled` on `han-server`, and the role set grants no
   `iam.serviceAccounts.actAs`. If the first apply fails for it, the grant is a choice
   Jason makes: `iam.serviceAccountUser` on `han-server-run` lets the holder run a
   workload as the runtime account, which reads all six secrets. Supplier: the first apply,
   and Jason's decision.
5. **Cloud SQL database and user conditions.** A condition on `resource.name` for
   `cloudsql.databases.*` and `cloudsql.users.*` is not verified, and those resources are
   not scopable the way instances are. The apply role therefore fails closed on
   `google_sql_database.han_team` and `google_sql_user.han` until a decision is made.
   Options for Jason: accept the project-wide `cloudsql.databases` and `cloudsql.users`
   permissions, or create those two resources by a different reviewed path.
6. **Runtime Cloud SQL and logging scope.** `cloudsql.client` and `logging.logWriter` on
   `han-server-run` are project-level and unconditioned. A Cloud SQL condition on an
   instance is not verified, so the grant reaches every instance in the project. Supplier:
   Jason's decision after a condition is verified, or accept it and say so in this PR.
7. **Write-only read-back and replacement.** Whether the provider reads a write-only value
   back during refresh, and whether bumping `db_credential_version` is an update or a
   replacement. Supplier: the first plan. Section 5 step 3 depends on it.
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
12. **Fork pull requests and the plan identity.** The plan identity is reached from pull
    requests of this repository, and fork pull requests need the repository setting that
    withholds secrets and id-token from them. Supplier: a GitHub admin, to confirm that
    setting.
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
17. **Exact-match SQL condition.** `resource.name == 'projects/thebushido-co/instances/han-pg'`
    replaces the prefix match. Whether Cloud SQL evaluates that name in an IAM condition is
    unverified (artifacts 5 and 6). Supplier: the first plan and the first apply.
18. **First apply and the database password.** The secret version is written only after the
    SQL user is created, in the same apply and from the same ephemeral value. A graph test
    checks that order. So a failed user create (artifact 5) writes no secret, and the first
    apply cannot leave a secret the database lacks. One window remains. If the user is created
    and the secret write then fails, the next apply writes a new password to the secret while
    the user keeps the old one. Recovery is section 5: bump `db_credential_version`, which
    rewrites both in one apply. Supplier: the first plan, which shows whether that rewrite is
    an update or a replacement (artifact 7).
19. **Cloud SQL deletion protection.** `settings.deletion_protection_enabled = true` is set in
    Terraform, matching the bootstrap's `--deletion-protection`. Supplier: the first plan after
    import must show no change to it.

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
5. **Secret values are never in Terraform state.** The three Terraform secrets take
   write-only values. The other three take values by an operator, out of band.

### Merge order (recorded, not a blocker)

The bootstrap runs only from `main`, and `han-infra` runs on pushes to `main`. Once this PR
merges, the plan job of `han-infra` fails red on each push until the bootstrap has created the
identities it plans as. No apply and no deploy runs in that window, because both wait for a
green plan. This is the cost of the order the bootstrap requires, and it is recorded here.

### Left undisturbed

The Railway services, the Terraform Cloud workspace, and every existing
`thebushido-co` resource: the website, Relic, client demos, secrets and buckets.
