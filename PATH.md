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

## 8. Bootstrap and project decision (on hold, not built)

Status: blocked on a security decision. Nothing here is created yet.

Jason's direction: put Han in the existing project `thebushido-co` (project
number 911514101920, organisation 949208237676), with Han-named resources and
service accounts, CI-only apply, and no Han permission over existing services
or secrets.

**What was verified (read-only, 2026-11-04):**

- Live resources in `thebushido-co`: Cloud Run services `website`, `relic`,
  `subscribe`, `contactform`, `emt-quote` and others; Artifact Registry repos
  `website`, `relic`, `emt-demo`, `gcf-artifacts`; secrets `anthropic-api-key`,
  `github-token`, `resend-api-key`, `relic-resend-api-key`, `slack-error-webhook-url`,
  `turnstile-secret-key`; Firebase Hosting sites `withbushido-ai`,
  `thebushido-web`, `thebushido-co`, `bitwits-demo-tbc`, `para-demo-tbc`,
  `iocore-demo-tbc`, `endmetaltheft-demo-tbc`.
- Cloud SQL Admin API is not enabled in `thebushido-co`.
- The shared WIF pool `github` admits every `TheBushidoCollective` and
  `Para-Apparel` repository. Its existing bindings are all per-repo principal
  sets, so no other repository can impersonate today. Han must use its own pool.
- `terraform-ci` and `terraform-bootstrap` hold `roles/owner` on the project.
  Han must not be granted anything that reaches them.

**What IAM cannot isolate inside the shared project:**

1. Firebase Hosting has no site-level IAM. A project-level `firebasehosting.admin`
   for the Han deployer can deploy or delete the live website and every client demo.
2. Cloud Run `run.admin` at project level reaches every service. Resource-level
   IAM only works once a service exists, and creating `han-server` needs
   project-level create rights.
3. Creating Han's secrets, Cloud SQL instance and Artifact Registry repo needs
   project-level admin roles. `secretmanager.admin` can read every secret,
   including `anthropic-api-key` and `github-token`. `artifactregistry.admin`
   reads the website and Relic images.
4. Whether IAM Conditions on `resource.name` work for Secret Manager, Cloud SQL
   and Artifact Registry is not verified. If they do, grants could be narrowed
   to `han-*` names. This needs a test before anyone relies on it.

**What is already enforced in the code (commit on this branch):**

- Han's own WIF pool and provider (`wif_pool_id`, default `han-github`), not the
  shared pool.
- Service accounts `han-tf-plan`, `han-tf-apply`, `han-deployer` and
  `han-server-run` are created by a human, not by Terraform. The apply identity
  has no service-account admin, token-creator or key-admin role.
- Project grants Terraform makes are exactly the reviewed set in `iam.tf`
  (`test_isolation.py`). Two of them are open exceptions: `run.admin` and
  `firebasehosting.admin` at project level.
- The apply identity may grant only allowlisted roles, through an IAM condition
  (`deploy/firebase/bootstrap/`).

**Decision needed from Jason (consult with the parent before any apply):**

A. Accept the project-wide exposure in `thebushido-co`, with the open exceptions
   and the admin roles above, and the residual that a compromised Han deploy could
   change the live website. Not recommended.
B. Put Han in a separate project. This reverses the latest direction and needs a
   new project created by a human (org project-creator is domain-granted to
   `withbushido.ai`). It is the only option that isolates Firebase Hosting and
   Secret Manager with IAM alone.
C. Narrow the Han surface: remove Firebase Hosting from Han (serve the dashboard and
   app from a Han Cloud Run service behind a load balancer), pre-create the
   shared-project resources once by a human, and accept that the CI identity still
   holds project-wide `run.admin` on the shared project.

Until one of these is chosen, do not run `han-infra` apply, `deploy-han-server`
or `deploy-hosting` against `thebushido-co`.

**Also a risk in the current Terraform:** `google_firebase_project` would try to
create a Firebase project that already exists. It must be imported, not created,
and the import has not been reviewed.

**Left undisturbed:** the Railway services, the Terraform Cloud workspace and all
existing `thebushido-co` resources.
