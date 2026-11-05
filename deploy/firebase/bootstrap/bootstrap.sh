#!/usr/bin/env bash
# One-time human bootstrap for Han inside the existing project thebushido-co.
#
# This is the only place a human creates project-level objects. CI does everything
# after it, through deploy/firebase/terraform and the workflows.
#
# Default: print every command and change nothing.
# --execute: run the commands. Run it yourself, from a reviewed revision, and
#            only after the steps in PATH.md section 8 are approved. Nothing in
#            CI calls this script, and nothing reads an authorisation variable.
#
# Account: every command runs as HUMAN_ACCOUNT. Use an account that holds the
# owner-level rights the steps need. Do not use a CI identity.
#
# Secrets: none are created or printed here. Secret values are added later, out
# of band, by an operator.
set -euo pipefail

PROJECT="${PROJECT:-thebushido-co}"
PROJECT_NUMBER="911514101920"
REPO_ID="1100192477"
REPO="TheBushidoCollective/han"
REGION="us-central1"
POOL="han-github"
PROVIDER="han-github"
STATE_BUCKET="${PROJECT}-han-tfstate"
HUMAN_ACCOUNT="${HUMAN_ACCOUNT:-jason@withbushido.ai}"
ISSUER="https://token.actions.githubusercontent.com"

HERE="$(cd "$(dirname "$0")" && pwd)"
SA_DOMAIN="${PROJECT}.iam.gserviceaccount.com"

MODE="print"
if [ "${1:-}" = "--execute" ]; then MODE="execute"; fi

run() {
  if [ "$MODE" = "print" ]; then
    printf '%q ' "$@"; printf '\n'
  else
    "$@"
  fi
}

step() { printf '\n# %s\n' "$1"; }

# Conditions. Each one names exactly the resources the grant may touch.
SECRET_COND="resource.type in ['secretmanager.googleapis.com/Secret','secretmanager.googleapis.com/SecretVersion'] && resource.name.startsWith('projects/${PROJECT_NUMBER}/secrets/han-server-')"
SQL_COND="resource.name.startsWith('projects/${PROJECT}/instances/han-pg')"

step "0. Preflight. Read only. The sqladmin API must be enabled before Terraform can create the instance."
run gcloud services enable sqladmin.googleapis.com artifactregistry.googleapis.com \
  --project "$PROJECT" --account "$HUMAN_ACCOUNT"

step "1. Custom roles, from the reviewed files. Role IDs are fixed."
run gcloud iam roles create hanTfCreate --project "$PROJECT" --file "$HERE/roles/han_tf_create.yaml" --account "$HUMAN_ACCOUNT"
run gcloud iam roles create hanTfApplySecrets --project "$PROJECT" --file "$HERE/roles/han_tf_apply_secrets.yaml" --account "$HUMAN_ACCOUNT"
run gcloud iam roles create hanTfPlanSecrets --project "$PROJECT" --file "$HERE/roles/han_tf_plan_secrets.yaml" --account "$HUMAN_ACCOUNT"
run gcloud iam roles create hanTfApplySql --project "$PROJECT" --file "$HERE/roles/han_tf_apply_sql.yaml" --account "$HUMAN_ACCOUNT"
run gcloud iam roles create hanTfPlanSql --project "$PROJECT" --file "$HERE/roles/han_tf_plan_sql.yaml" --account "$HUMAN_ACCOUNT"
run gcloud iam roles create hanTfPlanGlobal --project "$PROJECT" --file "$HERE/roles/han_tf_plan_global.yaml" --account "$HUMAN_ACCOUNT"

step "2. Terraform state bucket. Uniform access, public access blocked, versioned."
run gcloud storage buckets create "gs://${STATE_BUCKET}" --project "$PROJECT" --location "$REGION" \
  --uniform-bucket-level-access --public-access-prevention --account "$HUMAN_ACCOUNT"
run gcloud storage buckets update "gs://${STATE_BUCKET}" --versioning --account "$HUMAN_ACCOUNT"

step "3. Han's own Workload Identity pool and provider. Never the shared github pool."
run gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" --location global \
  --display-name "Han GitHub" --account "$HUMAN_ACCOUNT"
run gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" --location global \
  --workload-identity-pool "$POOL" --issuer-uri "$ISSUER" \
  --attribute-mapping 'google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.environment=assertion.environment,attribute.job_workflow_ref=assertion.job_workflow_ref' \
  --attribute-condition "assertion.repository_id == '${REPO_ID}' && (assertion.job_workflow_ref.startsWith('${REPO}/.github/workflows/han-infra.yml@') || assertion.job_workflow_ref.startsWith('${REPO}/.github/workflows/deploy-han-server.yml@') || assertion.job_workflow_ref.startsWith('${REPO}/.github/workflows/deploy-hosting.yml@'))" \
  --account "$HUMAN_ACCOUNT"

step "4. Service accounts. Created here, never by Terraform. No keys are created."
for sa in han-tf-plan han-tf-apply han-deployer han-hosting-deployer han-server-run; do
  run gcloud iam service-accounts create "$sa" --project "$PROJECT" --display-name "$sa" --account "$HUMAN_ACCOUNT"
done

step "5. Project-level grants. Each is the narrowest role the step needs."
# Apply: create only, and two conditioned roles on Han's secrets and instance.
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-tf-apply@${SA_DOMAIN}" \
  --role "projects/${PROJECT}/roles/hanTfCreate" --condition=None --account "$HUMAN_ACCOUNT"
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-tf-apply@${SA_DOMAIN}" \
  --role "projects/${PROJECT}/roles/hanTfApplySecrets" --condition="expression=${SECRET_COND},title=han-secrets-only" --account "$HUMAN_ACCOUNT"
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-tf-apply@${SA_DOMAIN}" \
  --role "projects/${PROJECT}/roles/hanTfApplySql" --condition="expression=${SQL_COND},title=han-pg-only" --account "$HUMAN_ACCOUNT"
# Plan: read only.
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-tf-plan@${SA_DOMAIN}" \
  --role "projects/${PROJECT}/roles/hanTfPlanGlobal" --condition=None --account "$HUMAN_ACCOUNT"
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-tf-plan@${SA_DOMAIN}" \
  --role "projects/${PROJECT}/roles/hanTfPlanSecrets" --condition="expression=${SECRET_COND},title=han-secrets-only" --account "$HUMAN_ACCOUNT"
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-tf-plan@${SA_DOMAIN}" \
  --role "projects/${PROJECT}/roles/hanTfPlanSql" --condition="expression=${SQL_COND},title=han-pg-only" --account "$HUMAN_ACCOUNT"
# Runtime: connect to the instance, write logs. Secret access is per secret, in Terraform.
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-server-run@${SA_DOMAIN}" \
  --role roles/cloudsql.client --condition=None --account "$HUMAN_ACCOUNT"
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-server-run@${SA_DOMAIN}" \
  --role roles/logging.logWriter --condition=None --account "$HUMAN_ACCOUNT"
# Hosting deployer: EXCEPTION. firebasehosting.admin cannot be scoped to one site.
# It reaches every Hosting site in the project. See PATH.md section 8, risk 1.
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-hosting-deployer@${SA_DOMAIN}" \
  --role roles/firebasehosting.admin --condition=None --account "$HUMAN_ACCOUNT"
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-hosting-deployer@${SA_DOMAIN}" \
  --role roles/firebase.viewer --condition=None --account "$HUMAN_ACCOUNT"
run gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:han-hosting-deployer@${SA_DOMAIN}" \
  --role roles/serviceusage.serviceUsageConsumer --condition=None --account "$HUMAN_ACCOUNT"

step "6. Cloud Run service shell, once. Private until Terraform sets invoker_iam_disabled."
run gcloud run deploy han-server --project "$PROJECT" --region "$REGION" \
  --image us-docker.pkg.dev/cloudrun/container/hello \
  --service-account "han-server-run@${SA_DOMAIN}" --no-allow-unauthenticated --account "$HUMAN_ACCOUNT"

step "7. Artifact Registry repository han (repository-level IAM is set by Terraform)."
run gcloud artifacts repositories create han --project "$PROJECT" --location "$REGION" \
  --repository-format docker --account "$HUMAN_ACCOUNT"

step "8. Hosting sites for the static targets and the api rewrite. Created once."
for site in han-guru-dashboard han-guru-app han-guru-api; do
  run firebase hosting:sites:create "$site" --project "$PROJECT"
done

step "9. Service-account grants, on the account and never at project level."
# DECISION PENDING, NOT GRANTED: the deploy's startup check reads logs
# (deploy/firebase/scripts/check_startup.py) as han-deployer. No role here gives
# that. The two options are:
#   (a) roles/logging.viewer at project level. Reads logs of every service in
#       thebushido-co. Rejected unless Jason accepts the exposure.
#   (b) a logging view scoped to service_name="han-server". Unverified: the
#       _Default bucket may not accept views. Test before relying on it.
# Until one is chosen, the startup check cannot run and the deploy must not pass.
run gcloud iam service-accounts add-iam-policy-binding "han-server-run@${SA_DOMAIN}" --project "$PROJECT" \
  --member "serviceAccount:han-deployer@${SA_DOMAIN}" --role roles/iam.serviceAccountUser --account "$HUMAN_ACCOUNT"
POOL_PATH="principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/subject"
run gcloud iam service-accounts add-iam-policy-binding "han-tf-apply@${SA_DOMAIN}" --project "$PROJECT" \
  --member "${POOL_PATH}/repo:${REPO}:environment:han-infra-apply" --role roles/iam.workloadIdentityUser --account "$HUMAN_ACCOUNT"
run gcloud iam service-accounts add-iam-policy-binding "han-deployer@${SA_DOMAIN}" --project "$PROJECT" \
  --member "${POOL_PATH}/repo:${REPO}:environment:han-production" --role roles/iam.workloadIdentityUser --account "$HUMAN_ACCOUNT"
run gcloud iam service-accounts add-iam-policy-binding "han-hosting-deployer@${SA_DOMAIN}" --project "$PROJECT" \
  --member "${POOL_PATH}/repo:${REPO}:environment:han-hosting" --role roles/iam.workloadIdentityUser --account "$HUMAN_ACCOUNT"
run gcloud iam service-accounts add-iam-policy-binding "han-tf-plan@${SA_DOMAIN}" --project "$PROJECT" \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository_id/${REPO_ID}" \
  --role roles/iam.workloadIdentityUser --account "$HUMAN_ACCOUNT"

step "10. Resource-level grants that Terraform cannot give itself."
run gcloud run services add-iam-policy-binding han-server --project "$PROJECT" --region "$REGION" \
  --member "serviceAccount:han-tf-apply@${SA_DOMAIN}" --role roles/run.admin --account "$HUMAN_ACCOUNT"
run gcloud artifacts repositories add-iam-policy-binding han --project "$PROJECT" --location "$REGION" \
  --member "serviceAccount:han-tf-apply@${SA_DOMAIN}" --role roles/artifactregistry.repoAdmin --account "$HUMAN_ACCOUNT"
run gcloud storage buckets add-iam-policy-binding "gs://${STATE_BUCKET}" \
  --member "serviceAccount:han-tf-apply@${SA_DOMAIN}" --role roles/storage.objectAdmin --account "$HUMAN_ACCOUNT"
run gcloud storage buckets add-iam-policy-binding "gs://${STATE_BUCKET}" \
  --member "serviceAccount:han-tf-plan@${SA_DOMAIN}" --role roles/storage.objectViewer --account "$HUMAN_ACCOUNT"

step "11. GitHub environments and repo variables. Run with a GitHub admin session. See PATH.md section 8."
printf '# gh api --method PUT repos/%s/environments/<name> with reviewers [%s] and deployment branch policy main only\n' "$REPO" "jwaldrip id 43164"
printf '# gh variable set HAN_GCP_PROJECT_ID --body %s\n' "$PROJECT"
printf '# gh variable set HAN_GCP_WIF_PROVIDER --body projects/%s/locations/global/workloadIdentityPools/%s/providers/%s\n' "$PROJECT_NUMBER" "$POOL" "$PROVIDER"
printf '# gh variable set HAN_GCP_TF_PLAN_SA / HAN_GCP_TF_APPLY_SA / HAN_GCP_DEPLOYER_SA / HAN_GCP_HOSTING_DEPLOYER_SA\n'

printf '\n# Done with human steps. Next: merge the Terraform PR so han-infra plans, then approve the apply in han-infra-apply.\n'
