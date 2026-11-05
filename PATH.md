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

## 8. Shared project: decisions, bootstrap and residual risk

Status: bootstrap built and tested. Not run. Han runs in the existing project
`thebushido-co` (project number 911514101920, organisation 949208237676).

### Decisions taken by Jason

- **Dedicated Han deployer in the shared project, accepting Firebase Hosting's
  project-wide reach** (risk 1), with a dedicated review-gated CI identity
  (`han-hosting-deployer`, environment `han-hosting`).
- **Constrained log access.** Log views exist only on custom log buckets, not on
  `_Default` (Google's logs-views documentation). Han uses a custom bucket
  `han-server-logs` that receives only `han-server` logs, a view `startup` on
  it, and `roles/logging.viewAccessor` granted on that view alone. No project
  logging viewer is granted.
- **Bootstrap through existing trusted CI only.** `han-bootstrap.yml` runs
  `bootstrap/bootstrap.py`, in environment `han-bootstrap`. Nothing runs from a
  workstation.
- **Conservative PR plan identity.** The plan identity admits pull requests from
  this repository only, through the repository-ID condition. It is read-only.
- **Existing environment review conventions.** Required reviewer: GitHub user
  `jwaldrip` (ID 43164, verified). Deployment from `main` only.

### What is built

| Identity | Environment | Project grants |
|---|---|---|
| `han-tf-plan` | none (PRs) | read-only custom roles, `storage.objectViewer` on the state bucket |
| `han-tf-apply` | `han-infra-apply` | `hanTfCreate`, and conditioned `hanTfApplySecrets` and `hanTfApplySql`. No owner or project-IAM role |
| `han-deployer` | `han-production` | none. Per-resource only: `run.developer` on `han-server`, `artifactregistry.writer` on `han`, `secretmanager.viewer` per secret, `logging.viewAccessor` on the `startup` view |
| `han-hosting-deployer` | `han-hosting` | `firebasehosting.admin`, `firebase.viewer`, `serviceusage.serviceUsageConsumer` (accepted risk 1). `run.viewer` on `han-server` |
| `han-server-run` | none | `cloudsql.client`, `logging.logWriter` |

- **Created by the bootstrap, not by Terraform:** the five identities, the `han-github`
  pool and provider, the state bucket, the Cloud Run service shell (private),
  the `han` Artifact Registry repo, the log bucket, sink and view, and the three
  Hosting sites.
- **Terraform** (`deploy/firebase/terraform`) manages the six secrets, their
  per-secret IAM, the `han-pg` instance and user, the `han-server` service's
  invoker setting and IAM, and the `han` repo's IAM. It creates no identity, no
  project IAM, no project API, no Firebase project and no logging resource.
- **The bootstrap** (`bootstrap/bootstrap.py`) is idempotent. Every step first
  describes the object and creates it only if missing. Print mode runs the
  read-only checks and prints the mutations. `--execute` runs them. It refuses to
  run as any identity other than `terraform-bootstrap`, refuses if a Han identity
  has a user-managed key, and fails if its own sign-in binding survives the final
  revoke.

### Prerequisites a human must do (two, once, and nothing else)

These need an owner or a GitHub admin. Neither can be done from CI, because the
CI identity that would need them does not exist yet.

1. **Grant the bootstrap sign-in** (Jason, owner session):

   ```sh
   gcloud iam service-accounts add-iam-policy-binding terraform-bootstrap@thebushido-co.iam.gserviceaccount.com \
     --project=thebushido-co --role=roles/iam.workloadIdentityUser \
     --member="principal://iam.googleapis.com/projects/911514101920/locations/global/workloadIdentityPools/github/subject/repo:TheBushidoCollective/han:environment:han-bootstrap" \
     --account=jason@withbushido.ai
   ```

   The bootstrap removes this binding itself at the end. It can then run again
   only after a new grant.

2. **Create the GitHub environments and variables** (Jason, repo admin). Four
   environments, each with reviewer `43164` and deployment from `main` only:
   `han-bootstrap`, `han-infra-apply`, `han-production`, `han-hosting`. Then the
   repo variables: `HAN_GCP_PROJECT_ID=thebushido-co`,
   `HAN_GCP_WIF_PROVIDER=projects/911514101920/locations/global/workloadIdentityPools/han-github/providers/han-github`,
   `HAN_GCP_TF_PLAN_SA`, `HAN_GCP_TF_APPLY_SA`, `HAN_GCP_DEPLOYER_SA`,
   `HAN_GCP_HOSTING_DEPLOYER_SA`. Set `HAN_GITHUB_CLIENT_ID` at slice I.

   The bootstrap cannot do this. `GITHUB_TOKEN` cannot manage environments or
   variables, and Han has no GitHub App.

### How it runs after the prerequisites

1. Merge this PR. Run **Han Bootstrap** from `main`, read the printed plan, approve
   `han-bootstrap`. It creates everything above and revokes its sign-in.
2. Open a PR. `han-infra` plans as `han-tf-plan`. Merge to `main`, approve
   `han-infra-apply`, and it applies as `han-tf-apply`.
3. The deploy workflows run after `han-infra` succeeds on the same commit.

### Tests, and what they prove

- `test_bootstrap.py` (24): against a fake cloud, the first run creates every
  object, a second run creates nothing, no key or project is created, no owner,
  editor, viewer or IAM-admin role is granted, the Cloud Run shell is private, log
  access is granted on the view only, the sink and view share one filter, the
  revoke is the last write, and print mode writes nothing. A planted public
  binding and a planted project-level viewer were each caught.
- `test_isolation.py`: Terraform's grants are the reviewed set, no identity-admin
  role appears, and the shared pool is referenced only by the bootstrap workflow,
  as the bootstrap identity.
- `test_workflows.py`: each identity is used only from its environment, the server
  deployer never runs the Firebase CLI, the startup check reads only the constrained
  view, and every third-party action is pinned.

### Unverified: each needs a real check, and the first run is that check

- **IAM Conditions on `resource.name`** for Secret Manager and Cloud SQL. The
  condition text in `bootstrap.py` is untested. Check: the apply identity cannot
  read `anthropic-api-key`, and can manage `han-server-*`.
- **The sink writes into a log bucket without an extra grant.** Google's docs
  suggest it does. Check: the `startup` view shows a new `han-server` revision's
  lines.
- **`gcloud auth list` names the bootstrap account under WIF.** The bootstrap
  refuses to run otherwise, so a mismatch fails closed. Check on the first run.
- **The invoker setting's JSON field** in `gcloud run services describe`.
  `check_invoker.py` accepts `invokerIamDisabled` and the legacy annotation.
- **`run.developer` covers `gcloud run revisions describe`.**
- **Whether `invoker_iam_disabled` survives a plain `gcloud run deploy`.** The
  deploy checks it afterwards.
- **The `terraform-bootstrap` user-managed key** (see residual 2).

### Residual risk, accepted or open

1. **Hosting is project-wide (accepted by Jason).** `han-hosting-deployer` can
   deploy or delete every Hosting site in the project: `withbushido-ai`,
   `thebushido-web`, `thebushido-co` and the client demos. Covered by
   `test_isolation.py` (`OPEN_PROJECT_WIDE_GRANTS`) and by the single hosting grant
   in `bootstrap.py`.
2. **`terraform-bootstrap` is owner and has a user-managed key.**
   `gcloud iam service-accounts keys list` shows key `871c68f6…`. Anyone holding
   that key is owner of `thebushido-co`. The bootstrap uses the identity only
   through WIF, so it does not need the key. Han does not revoke it. **Decision:
   Jason, whether to delete it.** Deleting it is a live change outside this task.
3. **`terraform-ci` is owner and reachable from website-repo branches**
   (`deploy/terraform/workload_identity.tf:57-61`). It outranks anything Han builds.
   No test here covers it. **Owner: the website team.**
4. **Create permissions are unconditioned** (`secretmanager.secrets.create`,
   `cloudsql.instances.create`). They cannot read or change other resources.
5. **The apply identity can set IAM on `han-server-*` secrets** (needed to manage them).
   It cannot read payloads.

### Left undisturbed

The Railway services, the Terraform Cloud workspace, and every existing
`thebushido-co` resource: the website, Relic, client demos, secrets and buckets.
