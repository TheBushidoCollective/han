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

```sh
live="$(gcloud run services describe han-server --project "$HAN_GCP_PROJECT_ID" \
  --region us-central1 --format='value(status.latestReadyRevisionName)')"
gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"han-server\" AND resource.labels.revision_name=\"$live\"" \
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
3. The apply rewrites the SQL user and the secret version together.
4. Redeploy `han-server` so the new revision reads the new secret.

Do not edit the secret or the user by hand. Both are managed by Terraform.

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
- **Bootstrap (missing prerequisite, no CI path yet).** See section 8.
- **Browse path.** Unchanged. See "What this path does not prove".

## 8. Shared project, identities and residual risk

Status: not deployed. Nothing here is created yet. Han runs in the existing
project `thebushido-co` (project number 911514101920, organisation
949208237676). Jason's direction: Han-named resources and service accounts, CI-only
apply, and no Han permission over existing services or secrets.

### What is built

- **No Han identity is owner.** The apply identity `han-tf-apply` holds no
  owner, editor or project-IAM-admin role. Its project grants are two custom
  roles that create resources, and two conditioned custom roles that reach only
  `han-server-*` secrets and the `han-pg` instance. Everything else is a grant
  on one Han resource.
- **Own pool.** Han uses the WIF pool `han-github`, not the shared `github` pool.
  The provider admits only repository ID `1100192477`, and only the workflows
  `han-infra.yml`, `deploy-han-server.yml` and `deploy-hosting.yml`.
- **Separate identities per job.** Five service accounts, each used from one
  environment only:

  | Account | Used by | Environment | Project grants |
  |---|---|---|---|
  | `han-tf-plan` | han-infra plan, PRs | none | read-only custom roles |
  | `han-tf-apply` | han-infra apply | `han-infra-apply` (reviewer, main) | create roles and two conditioned roles |
  | `han-deployer` | server publish and deploy | `han-production` | none |
  | `han-hosting-deployer` | hosting deploy | `han-hosting` | `firebasehosting.admin` (see risk 1) |
  | `han-server-run` | Cloud Run runtime | none | `cloudsql.client`, `logging.logWriter` |

- **Created by a human, not Terraform.** Service accounts, the pool, the state
  bucket, the Cloud Run service shell and the Artifact Registry repo. Terraform
  imports or reads them (`cloudrun.tf`, `artifact.tf`, `main.tf`).
- **No project-level IAM from Terraform, no project APIs, no Firebase or DNS
  resources.** `test_isolation.py` fails if any of these appears.
- **Invoker check set in Terraform** (`invoker_iam_disabled = true` in
  `cloudrun.tf`). The deploy never passes a flag that changes it, and
  `check_invoker.py` runs after every deploy.
- **Hosting split out.** The server deploy has no Firebase CLI and does not touch
  Hosting. `deploy-hosting.yml` owns all three Hosting targets, including the
  static `api` rewrite, and the API host checks. Nothing in the server path can
  change a Hosting site.
- **Custom roles are reviewed files** in `bootstrap/roles/`, created by a human
  from `bootstrap.sh`. Every permission name was checked against the 14,091
  testable permissions for `thebushido-co` (read-only, 2026-11-05). Role creation
  itself has not run.

### Unavoidable risks, with the test that covers each

1. **Hosting is project-wide.** `roles/firebasehosting.admin` reaches every
   Hosting site in `thebushido-co`: `withbushido-ai`, `thebushido-web`,
   `thebushido-co`, `bitwits-demo-tbc`, `para-demo-tbc`, `iocore-demo-tbc`,
   `endmetaltheft-demo-tbc`. Firebase says custom roles cannot control Hosting,
   and Hosting has no site-level IAM. The only way to remove this is to take
   Han's Hosting elsewhere. Covered by `test_isolation.py`
   (`OPEN_PROJECT_WIDE_GRANTS`) and by the bootstrap's single hosting exception.
   **Decision: Jason.**
2. **terraform-ci can become owner, outside Han.** It holds `roles/owner` on
   `thebushido-co`, and can be impersonated by any ref of the website repo
   (`deploy/terraform/workload_identity.tf:57-61`). `astro-deployer` can deploy
   code that runs as it (`astro/service_accounts.tf:69-86`). Han's identities are
   reachable through owner, so no Han control caps this. Not covered by any test
   here. **Needs a website-repo change: Jason and the website owners.**
3. **Create permissions are unconditioned.** `secretmanager.secrets.create` and
   `cloudsql.instances.create` cannot be narrowed by name before the resource
   exists. They can create junk or cost money. They cannot read or change
   anyone else's resources. Covered by `test_create_role_cannot_read_or_change_anything`.
4. **The apply identity can set IAM on Han's own secrets.** That is required to
   manage them. A compromised apply could grant a principal access to a
   `han-server-*` secret. Covered by `test_no_role_holds_a_forbidden_permission`
   (no `versions.access`, no project IAM setter).
5. **The plan identity can read secret and SQL metadata** (`get`/`list` only, no
   payloads). Covered by `test_plan_roles_are_read_only`.
6. **Pull requests can use the plan identity.** It admits any pull request from
   the repository. It is read-only, but reads state and metadata. Open: Jason
   decides whether to accept it.

### Unverified: each needs a real check before relying on it

- **IAM Conditions on `resource.name`** for Secret Manager and Cloud SQL. Google
  documents Secret Manager and Cloud SQL as supporting resource attributes. The
  condition text in `bootstrap.sh` is not yet tested. Test: grant, then confirm
  the apply identity cannot read an unrelated secret (`anthropic-api-key`) and
  can manage `han-server-*`.
- **`projects/<number>` versus `projects/<id>` in secret conditions.** The
  bootstrap uses the number for secrets and the ID for Cloud SQL. Confirm with
  the first grant.
- **Whether the provider reads a write-only payload on refresh.** Not verified
  against provider source in this session. The state guard (`state_guard.py`)
  and the first plan are the check.
- **The invoker setting's JSON field** in `gcloud run services describe`.
  `check_invoker.py` accepts `invokerIamDisabled` and the legacy annotation.
- **Whether `run.developer` covers `gcloud run revisions describe`.**
- **Logging for the startup check. OPEN DECISION.** The deployer has no log
  role, so the startup check cannot run. Option (a), project `logging.viewer`,
  reads every service's logs. Option (b), a log view scoped to `han-server`, is
  unverified: the `_Default` bucket may not accept views. Until chosen, no deploy
  may pass. See `bootstrap.sh` step 9.
- **Whether `invoker_iam_disabled` in Terraform survives a plain
  `gcloud run deploy`.** The deploy checks it afterwards, but this is not proven.

### Required before merge and deploy

1. Create the custom roles and run each conditioned grant; prove the conditions
   with the tests above.
2. Decide the logging option (see above).
3. Decide risk 1 (Hosting) and risk 6 (pull-request plan), and whether
   `prevent_self_review` is set on the environments.
4. Security review of this section and of `bootstrap/roles/`. Named reviewer: to
   be assigned by Jason.
5. The website-repo change for risk 2 is a separate PR owned by the website
   team. Han does not depend on it being merged first, but it caps Han's
   protection, so it should be decided before production.

### Left undisturbed

The Railway services, the Terraform Cloud workspace, and every existing
`thebushido-co` resource: the website, Relic, client demos, secrets and buckets.
