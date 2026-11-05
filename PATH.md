# Han on Firebase and Cloud Run: end-to-end path

Read-only checks. Run them from a GitHub-hosted runner or any machine with
network access. They make GET requests only, with one exception called out
below. None of them writes to a live tenant.

Commands assume `HAN_GCP_PROJECT_ID` is set and the sites are the fixed IDs
in `deploy/firebase/terraform/main.tf`.

## 1. Infrastructure

- The `han-infra` workflow's last run on `main` shows "No changes" in its
  post-apply plan.
- `gcloud secrets list --project "$HAN_GCP_PROJECT_ID"` lists the six
  `han-server-*` secrets. Values are never printed.

## 2. Hosting

```sh
curl -fsS https://han-guru-dashboard.web.app/ | grep -q '<div id="root"\|<script'
curl -fsS -o /dev/null -w '%{http_code}\n' https://han-guru-app.web.app/some/deep/link   # 200
```

- The app bundle contains the API address. The dashboard bundle does not.

## 3. API host

```sh
curl -fsS https://han-guru-api.web.app/health | jq -e 'has("service") and has("status")'
curl -sS -o /dev/null -w '%{redirect_url}\n' https://han-guru-api.web.app/auth/github
# Expect a github.com URL with client_id=$HAN_GITHUB_CLIENT_ID and
# redirect_uri=https://api.han.guru/auth/github/callback
```

Do not follow the redirect and do not sign in. No sign-in, mutation, sync or
webhook call is made against this host.

## 4. Custom domains (after slice K)

```sh
dig +short CNAME app.han.guru           # han-guru-app.web.app.
dig +short CNAME dashboard.local.han.guru
dig +short CNAME api.han.guru
dig +short CNAME certs.han.guru         # empty once slice L removes it
dig +short A coordinator.local.han.guru # 127.0.0.1
```

## 5. Blocked until their decisions are made

- **Stripe.** The server requires `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET`. Their Secret Manager secrets exist empty. The deploy
  refuses to run until each has a version. Do not add dummy values.
- **GitHub OAuth.** `HAN_GITHUB_CLIENT_ID` and `han-server-github-client-secret`
  are required before the API deploys.
- **Browse path.** `han browse` still depends on `certs.han.guru` and the TLS
  coordinator. It is not changed by this work.
