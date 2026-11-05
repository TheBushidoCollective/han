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

## 8. Bootstrap prerequisite (not built; blocks everything)

Nothing in this change can run until a trust anchor exists in GCP and GitHub.
`seed.sh` was removed from this change: it could not be authorised by a
self-declared variable, and no CI-only identity exists to run it.

**What must be created, once:**

1. Project `han-guru` (or `han-guru-prod`), linked to billing `01087D-2C415F-DD4F66`.
   A 403 on a project ID does not mean taken. Google returns it for IDs the
   caller cannot see, so the creator must call `projects create` and handle
   `ALREADY_EXISTS`, not guess from a describe.
2. Workload Identity pool `github`, provider `github`. Attribute condition:
   the repository ID `1100192477`, and `job_workflow_ref` starting with one of
   `han-infra.yml`, `deploy-han-server.yml` or `deploy-hosting.yml`.
3. `han-tf-plan`: read access only, bound to pull requests and main.
4. `han-tf-apply`: project owner. Bound only to subject
   `repo:TheBushidoCollective/han:environment:han-infra-apply` **and** to
   `job_workflow_ref` `TheBushidoCollective/han/.github/workflows/han-infra.yml@refs/heads/main`.
   It must not be bound to `environment:han-production`, which the deploy jobs use.
5. `han-deployer`: bound only to `environment:han-production`. Terraform manages
   its roles (`iam.tf`).
6. Environments `han-infra-apply` and `han-production`, each with a required
   reviewer and deployment from `main` only.
7. Repo variables `HAN_GCP_PROJECT_ID`, `HAN_GCP_WIF_PROVIDER`, `HAN_GCP_TF_PLAN_SA`,
   `HAN_GCP_TF_APPLY_SA`, `HAN_GCP_DEPLOYER_SA`. Set `HAN_GITHUB_CLIENT_ID` later (slice I).
8. The `main` ruleset (plan D9).

**Who can do it (checked read-only, 2026-11-04):**

- Organisation `949208237676` grants `roles/resourcemanager.projectCreator` and
  `roles/billing.creator` only to `domain:withbushido.ai`, a human domain. No
  service account holds any organisation role.
- The CI identities that exist (`terraform-ci`, `astro-deployer`, `relic-deployer`)
  are project-scoped to `thebushido-co`. None can create a project in the organisation.
- Billing account IAM is not readable from `jason@waldrip.net`, so billing-user
  rights could not be confirmed.

**Missing prerequisite, exactly:** a human with organisation project-creator and
billing-user rights runs steps 1 to 8 once, or Jason decides to grant an existing
CI identity those org-level rights. Either is Jason's decision. Until one happens,
the apply, deploy and plan jobs have no identity to sign in with.

**Left undisturbed:** the Railway services and the Terraform Cloud workspace.
