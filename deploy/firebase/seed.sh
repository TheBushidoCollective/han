#!/usr/bin/env bash
# One-time bootstrap for the Han GCP project. Everything after this runs in CI
# through deploy/firebase/terraform and the workflows.
#
# Why this exists and why it is not CI: the first sign-in needs a trust anchor
# (the Workload Identity pool and provider) and the first owner-level identity
# (han-tf-apply). CI cannot create its own trust, so a human with owner rights
# runs this once. That is an exception to the CI-only rule and needs Jason's
# explicit authorization, recorded in HAN_BOOTSTRAP_AUTHORIZED.
#
# What it creates: the project, its billing link, the state bucket, the sign-in
# pool and provider, han-tf-apply and han-tf-plan with their bindings, the
# han-production environment with a required reviewer, the repo variables and
# the main-branch ruleset.
#
# Trust, stated plainly: han-tf-apply is project owner, so owner-level
# principals can change the provider and their own bindings. The controls are
# the environment's required reviewer, the main-only deployment branch, and the
# provider's attribute condition below, which admits only the named workflows.
#
# Idempotent: each step checks, creates or updates, then reads back. It prints
# resource names only and never reads a secret value.
set -euo pipefail

if [ -z "${HAN_BOOTSTRAP_AUTHORIZED:-}" ]; then
  echo "seed: refusing to run. Set HAN_BOOTSTRAP_AUTHORIZED to the decision record (plan D3)." >&2
  exit 2
fi

ORG_ID="${HAN_ORG_ID:-949208237676}"
BILLING_ACCOUNT="${HAN_BILLING_ACCOUNT:-01087D-2C415F-DD4F66}"
REGION="${HAN_REGION:-us-central1}"
REPO="${HAN_REPO:-TheBushidoCollective/han}"
REPO_ID="${HAN_REPO_ID:-1100192477}"
# Numeric GitHub user ID of the required reviewer for production applies.
REVIEWER_ID="${HAN_REVIEWER_ID:-}"
ENVIRONMENT="han-production"
POOL="github"
PROVIDER="github"
ISSUER="https://token.actions.githubusercontent.com"

log() { printf '%s\n' "$*" >&2; }
die() { log "seed: $*"; exit 1; }

for tool in gcloud gh jq; do
  command -v "$tool" >/dev/null 2>&1 || die "missing tool: $tool"
done

if [ -z "$REVIEWER_ID" ]; then
  die "HAN_REVIEWER_ID is required: the numeric GitHub ID of the production reviewer"
fi

# Prints one of: exists, absent, taken, or dies on any other error. "taken"
# means another owner holds the ID (PERMISSION_DENIED); it is never a reason to
# create. A network or auth failure stops the run rather than being guessed at.
project_state() {
  local id="$1" out
  if out="$(gcloud projects describe "$id" --format='value(projectId)' 2>&1)"; then
    echo exists
  elif printf '%s' "$out" | grep -q 'NOT_FOUND'; then
    echo absent
  elif printf '%s' "$out" | grep -q 'PERMISSION_DENIED'; then
    echo taken
  else
    die "could not read project $id: $(printf '%s' "$out" | tail -n1)"
  fi
}

# A project is ours only if this seed created it (label) and it still sits under
# our organization.
project_is_ours() {
  local id="$1"
  [ "$(gcloud projects describe "$id" --format='value(labels.han-bootstrap)' 2>/dev/null)" = "true" ] &&
    [ "$(gcloud projects describe "$id" --format='value(parent.id)' 2>/dev/null)" = "$ORG_ID" ]
}

# Step 1: choose the project ID. han-guru first, then han-guru-prod, else stop.
PROJECT=""
for candidate in han-guru han-guru-prod; do
  state="$(project_state "$candidate")"
  case "$state" in
    absent)
      PROJECT="$candidate"
      break
      ;;
    exists)
      if project_is_ours "$candidate"; then
        PROJECT="$candidate"
        break
      fi
      log "seed: $candidate exists and is not ours"
      ;;
    taken)
      log "seed: $candidate is held by another owner"
      ;;
  esac
done
[ -n "$PROJECT" ] || die "no usable project ID: han-guru and han-guru-prod are both taken"
log "seed: project $PROJECT"

# Step 2: create the project and link billing.
if [ "$(project_state "$PROJECT")" = "absent" ]; then
  gcloud projects create "$PROJECT" \
    --organization="$ORG_ID" \
    --labels=han-bootstrap=true \
    --quiet
fi
gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT" >/dev/null
[ "$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)')" = "True" ] ||
  die "billing is not enabled on $PROJECT"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"

# Step 3: APIs the bootstrap steps need. Terraform enables the rest.
gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  storage.googleapis.com \
  --project "$PROJECT"

# Step 4: Terraform state bucket. Uniform access, public access blocked,
# versioned.
BUCKET="${PROJECT}-tfstate"
if ! gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" \
    --project "$PROJECT" \
    --location "$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention
fi
gcloud storage buckets update "gs://$BUCKET" --versioning >/dev/null

# Step 5: GitHub sign-in (Workload Identity Federation).
#
# The provider admits a token only when all of these hold:
#   - it comes from this repository (repository_id),
#   - and it was minted by one of the named workflows below.
# So claude.yml, release jobs and any other workflow in the repository cannot
# exchange a token for a Google identity, even though they share the repo.
if ! gcloud iam workload-identity-pools describe "$POOL" \
  --project "$PROJECT" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" \
    --project "$PROJECT" --location global \
    --display-name "GitHub Actions"
fi

ATTRIBUTE_MAPPING='google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref,attribute.environment=assertion.environment,attribute.actor=assertion.actor,attribute.job_workflow_ref=assertion.job_workflow_ref'
WORKFLOW_PREFIX="${REPO}/.github/workflows/"
ALLOWED_WORKFLOWS=(han-infra.yml deploy-han-server.yml deploy-hosting.yml)
WORKFLOW_CLAUSES=""
for wf in "${ALLOWED_WORKFLOWS[@]}"; do
  WORKFLOW_CLAUSES="${WORKFLOW_CLAUSES:+$WORKFLOW_CLAUSES || }assertion.job_workflow_ref.startsWith('${WORKFLOW_PREFIX}${wf}@')"
done
ATTRIBUTE_CONDITION="assertion.repository_id == '${REPO_ID}' && (${WORKFLOW_CLAUSES})"

if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --workload-identity-pool "$POOL" --project "$PROJECT" --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" \
    --workload-identity-pool "$POOL" --project "$PROJECT" --location global \
    --issuer-uri "$ISSUER" \
    --attribute-mapping "$ATTRIBUTE_MAPPING" \
    --attribute-condition "$ATTRIBUTE_CONDITION"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --workload-identity-pool "$POOL" --project "$PROJECT" --location global \
    --display-name "GitHub Actions" \
    --issuer-uri "$ISSUER" \
    --attribute-mapping "$ATTRIBUTE_MAPPING" \
    --attribute-condition "$ATTRIBUTE_CONDITION"
fi

# Step 6: bootstrap identities.
ensure_service_account() {
  local id="$1" display="$2"
  if ! gcloud iam service-accounts describe "${id}@${PROJECT}.iam.gserviceaccount.com" \
    --project "$PROJECT" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$id" \
      --project "$PROJECT" --display-name "$display"
  fi
}

ensure_service_account han-tf-apply "Han Terraform apply"
ensure_service_account han-tf-plan "Han Terraform plan (read-only)"

APPLY_SA="han-tf-apply@${PROJECT}.iam.gserviceaccount.com"
PLAN_SA="han-tf-plan@${PROJECT}.iam.gserviceaccount.com"

# han-tf-apply is project owner. Only a job in the han-production environment
# can impersonate it, and that environment requires a reviewer.
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:${APPLY_SA}" --role roles/owner --condition=None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$APPLY_SA" \
  --project "$PROJECT" \
  --member "principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/subject/repo:${REPO}:environment:${ENVIRONMENT}" \
  --role roles/iam.workloadIdentityUser --quiet >/dev/null

# han-tf-plan reads metadata and state, and writes nothing. It is reachable only
# from the named workflows (provider condition above).
for role in roles/viewer roles/iam.securityReviewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:${PLAN_SA}" --role "$role" --condition=None --quiet >/dev/null
done
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:${PLAN_SA}" --role roles/storage.objectViewer >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$PLAN_SA" \
  --project "$PROJECT" \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" \
  --role roles/iam.workloadIdentityUser --quiet >/dev/null

# Step 7: GitHub environment. Deployable from main only, with a required
# reviewer, so an owner-level apply waits for a human.
jq -n --argjson reviewer "$REVIEWER_ID" '{
  reviewers: [{ type: "User", id: $reviewer }],
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }
}' | gh api --method PUT "repos/${REPO}/environments/${ENVIRONMENT}" --input - >/dev/null

if [ "$(gh api "repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies" --jq '[.branch_policies[]? | select(.name == "main")] | length')" = "0" ]; then
  gh api --method POST "repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies" \
    -f name=main -f type=branch >/dev/null
fi

# Step 8: repo variables read by the workflows. The client ID for GitHub
# sign-in (HAN_GITHUB_CLIENT_ID) is set in slice I, after the OAuth app exists.
set_repo_var() {
  gh variable set "$1" --repo "$REPO" --body "$2" >/dev/null
}
set_repo_var HAN_GCP_PROJECT_ID "$PROJECT"
set_repo_var HAN_GCP_WIF_PROVIDER "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
set_repo_var HAN_GCP_TF_APPLY_SA "$APPLY_SA"
set_repo_var HAN_GCP_TF_PLAN_SA "$PLAN_SA"
set_repo_var HAN_GCP_DEPLOYER_SA "han-deployer@${PROJECT}.iam.gserviceaccount.com"

# Step 9 (decision D9): main requires a pull request. Repo admins and the
# GitHub Actions app bypass it, because the release jobs push to main.
RULESET_NAME="han-main-requires-pr"
RULESET_BODY="$(jq -n --arg name "$RULESET_NAME" '{
  name: $name,
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
  bypass_actors: [
    { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
    { actor_id: 15368, actor_type: "Integration", bypass_mode: "always" }
  ],
  rules: [
    { type: "pull_request", parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false } }
  ]
}')"
RULESET_ID="$(gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" | head -n1)"
if [ -n "$RULESET_ID" ]; then
  printf '%s' "$RULESET_BODY" | gh api --method PUT "repos/${REPO}/rulesets/${RULESET_ID}" --input - >/dev/null
else
  printf '%s' "$RULESET_BODY" | gh api --method POST "repos/${REPO}/rulesets" --input - >/dev/null
fi

# Step 10: read back, names only.
log "seed: read back"
gcloud iam workload-identity-pools providers describe "$PROVIDER" \
  --workload-identity-pool "$POOL" --project "$PROJECT" --location global --format='value(name)'
gcloud storage buckets describe "gs://$BUCKET" --format='value(name,versioning.enabled)'
gcloud iam service-accounts describe "$APPLY_SA" --project "$PROJECT" --format='value(email)'
gcloud iam service-accounts describe "$PLAN_SA" --project "$PROJECT" --format='value(email)'
gh api "repos/${REPO}/environments/${ENVIRONMENT}" --jq '.name'
gh api "repos/${REPO}/environments/${ENVIRONMENT}/deployment-branch-policies" --jq '.branch_policies[].name'
gh variable list --repo "$REPO" --json name --jq '.[].name' | grep '^HAN_GCP_' || true
gh api "repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${RULESET_NAME}\") | .name"

log "seed: done for project $PROJECT. Next: merge the Terraform PR so han-infra.yml plans it."
