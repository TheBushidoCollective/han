#!/usr/bin/env python3
"""One-shot bootstrap for Han inside the existing project thebushido-co.

Runs only from .github/workflows/han-bootstrap.yml, in the han-bootstrap
environment, which needs a reviewer and runs from main. Nothing else calls it.

Modes:
  (default)   print the plan. Read-only commands run, so the plan reflects the
              live state. Mutating commands are printed, not run.
  --execute   run the plan.

Every step is idempotent: it describes the object first and creates it only if
it is missing. The last step removes the binding that let this job sign in, so
the bootstrap identity cannot be used again without a new human grant.

The backend is injected. Tests use a fake backend. CI uses the real gcloud,
gsutil-free storage commands, and npx firebase, all authenticated by WIF.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

HERE = Path(__file__).resolve().parent

PROJECT = "thebushido-co"
PROJECT_NUMBER = "911514101920"
REGION = "us-central1"
REPO = "TheBushidoCollective/han"
REPO_ID = "1100192477"

# Han's own pool and provider. Created here, never the shared github pool.
POOL = "han-github"
PROVIDER = "han-github"
ISSUER = "https://token.actions.githubusercontent.com"

# The existing identity this job signs in as. It is the only existing trusted
# identity the bootstrap can use. Its owner grant is accepted for this one run.
BOOTSTRAP_SA = f"terraform-bootstrap@{PROJECT}.iam.gserviceaccount.com"
BOOTSTRAP_ENV_SUBJECT = f"repo:{REPO}:environment:han-bootstrap"
SHARED_POOL = f"projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/github"
BOOTSTRAP_PRINCIPAL = f"principal://iam.googleapis.com/{SHARED_POOL}/subject/{BOOTSTRAP_ENV_SUBJECT}"

STATE_BUCKET = f"{PROJECT}-han-tfstate"
LOG_BUCKET = "han-server-logs"
LOG_SINK = "han-server-logs"
LOG_VIEW = "startup"
LOG_FILTER = 'resource.type="cloud_run_revision" AND resource.labels.service_name="han-server"'
LOG_DESTINATION = f"logging.googleapis.com/projects/{PROJECT}/locations/{REGION}/buckets/{LOG_BUCKET}"

SECRET_COND = (
    "resource.type in ['secretmanager.googleapis.com/Secret','secretmanager.googleapis.com/SecretVersion'] "
    f"&& resource.name.startsWith('projects/{PROJECT_NUMBER}/secrets/han-server-')"
)
SQL_COND = f"resource.name.startsWith('projects/{PROJECT}/instances/han-pg')"

APIS = [
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "logging.googleapis.com",
    "firebasehosting.googleapis.com",
    "secretmanager.googleapis.com",
    "run.googleapis.com",
    "iam.googleapis.com",
]

SERVICE_ACCOUNTS = {
    "han-tf-plan": "Han Terraform plan (read-only)",
    "han-tf-apply": "Han Terraform apply",
    "han-deployer": "Han server deployer",
    "han-hosting-deployer": "Han Hosting deployer",
    "han-server-run": "Han server runtime",
}

CUSTOM_ROLES = {
    "hanTfCreate": "han_tf_create.yaml",
    "hanTfApplySecrets": "han_tf_apply_secrets.yaml",
    "hanTfPlanSecrets": "han_tf_plan_secrets.yaml",
    "hanTfApplySql": "han_tf_apply_sql.yaml",
    "hanTfPlanSql": "han_tf_plan_sql.yaml",
    "hanTfPlanGlobal": "han_tf_plan_global.yaml",
}

SITES = ["han-guru-dashboard", "han-guru-app", "han-guru-api"]

Backend = Callable[[str, str | None, list[str]], tuple[int, str]]


def sa(name: str) -> str:
    return f"{name}@{PROJECT}.iam.gserviceaccount.com"


@dataclass
class Runner:
    """Routes every command through one place, so print mode and tests share code."""

    execute: bool
    backend: Backend
    log: list[str] = field(default_factory=list)

    def read(self, key: str, argv: list[str]) -> tuple[int, str]:
        """Read-only. Runs in both modes, because the plan depends on it."""
        return self.backend("read", key, argv)

    def exists(self, key: str, argv: list[str]) -> bool:
        rc, _ = self.read(key, argv)
        return rc == 0

    def write(self, key: str | None, argv: list[str]) -> None:
        printable = " ".join(argv)
        if not self.execute:
            print(printable)
            self.log.append(printable)
            return
        rc, out = self.backend("write", key, argv)
        if rc != 0:
            raise RuntimeError(f"command failed ({rc}): {printable}\n{out}")
        self.log.append(printable)

    def ensure(self, key: str, describe: list[str], create: list[str]) -> None:
        if self.exists(key, describe):
            print(f"# exists: {key}")
            return
        self.write(key, create)


def gcloud(*args: str) -> list[str]:
    return ["gcloud", *args, "--quiet"]


def steps(r: Runner, roles_dir: Path) -> None:
    # 0. Confirm who is running this. A wrong identity must stop the run.
    rc, active = r.read("active-account", ["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"])
    if active.strip() != BOOTSTRAP_SA and r.execute:
        raise RuntimeError(f"refusing to run as {active.strip()!r}; expected {BOOTSTRAP_SA}")

    # 1. APIs. Enabling an API changes no other resource.
    for api in APIS:
        r.write(None, gcloud("services", "enable", api, f"--project={PROJECT}"))

    # 2. Custom roles, from the reviewed files. Create or update to match.
    for role, filename in CUSTOM_ROLES.items():
        file = str(roles_dir / filename)
        if r.exists(f"role:{role}", gcloud("iam", "roles", "describe", role, f"--project={PROJECT}")):
            r.write(f"role:{role}", gcloud("iam", "roles", "update", role, f"--project={PROJECT}", f"--file={file}"))
        else:
            r.write(f"role:{role}", gcloud("iam", "roles", "create", role, f"--project={PROJECT}", f"--file={file}"))

    # 3. Terraform state bucket: uniform access, public access blocked, versioned.
    r.ensure(
        f"bucket:{STATE_BUCKET}",
        ["gcloud", "storage", "buckets", "describe", f"gs://{STATE_BUCKET}", f"--project={PROJECT}"],
        ["gcloud", "storage", "buckets", "create", f"gs://{STATE_BUCKET}", f"--project={PROJECT}",
         f"--location={REGION}", "--uniform-bucket-level-access", "--public-access-prevention", "--quiet"],
    )
    r.write(None, ["gcloud", "storage", "buckets", "update", f"gs://{STATE_BUCKET}", "--versioning", "--quiet"])

    # 4. Han's pool and provider. The condition admits this repository only, and
    #    only from the three named workflows.
    r.ensure(
        f"pool:{POOL}",
        gcloud("iam", "workload-identity-pools", "describe", POOL, "--location=global", f"--project={PROJECT}"),
        gcloud("iam", "workload-identity-pools", "create", POOL, "--location=global", f"--project={PROJECT}",
               "--display-name=Han GitHub"),
    )
    condition = (
        f"assertion.repository_id == '{REPO_ID}' && ("
        + " || ".join(
            f"assertion.job_workflow_ref.startsWith('{REPO}/.github/workflows/{wf}@')"
            for wf in ("han-infra.yml", "deploy-han-server.yml", "deploy-hosting.yml")
        )
        + ")"
    )
    mapping = (
        "google.subject=assertion.sub,attribute.repository=assertion.repository,"
        "attribute.repository_id=assertion.repository_id,attribute.environment=assertion.environment,"
        "attribute.job_workflow_ref=assertion.job_workflow_ref"
    )
    r.ensure(
        f"provider:{PROVIDER}",
        gcloud("iam", "workload-identity-pools", "providers", "describe", PROVIDER,
               f"--workload-identity-pool={POOL}", "--location=global", f"--project={PROJECT}"),
        gcloud("iam", "workload-identity-pools", "providers", "create-oidc", PROVIDER,
               f"--workload-identity-pool={POOL}", "--location=global", f"--project={PROJECT}",
               f"--issuer-uri={ISSUER}", f"--attribute-mapping={mapping}", f"--attribute-condition={condition}"),
    )

    # 5. Service accounts. Created here, never by Terraform. No keys are created.
    for name, display in SERVICE_ACCOUNTS.items():
        r.ensure(
            f"sa:{name}",
            gcloud("iam", "service-accounts", "describe", sa(name), f"--project={PROJECT}"),
            gcloud("iam", "service-accounts", "create", name, f"--project={PROJECT}", f"--display-name={display}"),
        )

    # 6. Project-level grants. Each is the narrowest role its identity needs.
    def project_bind(member: str, role: str, condition_file: str | None = None) -> None:
        # Conditions come from reviewed files. An inline --condition would be split
        # on commas, and the secret expression contains commas.
        argv = gcloud("projects", "add-iam-policy-binding", PROJECT, f"--member={member}", f"--role={role}")
        if condition_file:
            argv += [f"--condition-from-file={HERE / 'conditions' / condition_file}"]
        else:
            argv += ["--condition=None"]
        r.write(None, argv)

    project_bind(f"serviceAccount:{sa('han-tf-apply')}", f"projects/{PROJECT}/roles/hanTfCreate")
    project_bind(f"serviceAccount:{sa('han-tf-apply')}", f"projects/{PROJECT}/roles/hanTfApplySecrets", "han_secrets.yaml")
    project_bind(f"serviceAccount:{sa('han-tf-apply')}", f"projects/{PROJECT}/roles/hanTfApplySql", "han_pg.yaml")
    project_bind(f"serviceAccount:{sa('han-tf-plan')}", f"projects/{PROJECT}/roles/hanTfPlanGlobal")
    project_bind(f"serviceAccount:{sa('han-tf-plan')}", f"projects/{PROJECT}/roles/hanTfPlanSecrets", "han_secrets.yaml")
    project_bind(f"serviceAccount:{sa('han-tf-plan')}", f"projects/{PROJECT}/roles/hanTfPlanSql", "han_pg.yaml")
    project_bind(f"serviceAccount:{sa('han-server-run')}", "roles/cloudsql.client")
    project_bind(f"serviceAccount:{sa('han-server-run')}", "roles/logging.logWriter")
    # Hosting deployer: the accepted project-wide exception (PATH.md section 8, risk 1).
    project_bind(f"serviceAccount:{sa('han-hosting-deployer')}", "roles/firebasehosting.admin")
    project_bind(f"serviceAccount:{sa('han-hosting-deployer')}", "roles/firebase.viewer")
    project_bind(f"serviceAccount:{sa('han-hosting-deployer')}", "roles/serviceusage.serviceUsageConsumer")

    # 7. Cloud Run service shell. Private until Terraform sets invoker_iam_disabled.
    r.ensure(
        "run:han-server",
        gcloud("run", "services", "describe", "han-server", f"--region={REGION}", f"--project={PROJECT}"),
        gcloud("run", "deploy", "han-server", f"--region={REGION}", f"--project={PROJECT}",
               "--image=us-docker.pkg.dev/cloudrun/container/hello",
               f"--service-account={sa('han-server-run')}", "--no-allow-unauthenticated"),
    )

    # 8. Artifact Registry repository for Han images only.
    r.ensure(
        "repo:han",
        gcloud("artifacts", "repositories", "describe", "han", f"--location={REGION}", f"--project={PROJECT}"),
        gcloud("artifacts", "repositories", "create", "han", f"--location={REGION}", f"--project={PROJECT}",
               "--repository-format=docker"),
    )

    # 9. Constrained log access. A custom bucket receives only han-server logs, a
    #    view shows only that bucket, and only the deployer can view it.
    r.ensure(
        f"logbucket:{LOG_BUCKET}",
        gcloud("logging", "buckets", "describe", LOG_BUCKET, f"--location={REGION}", f"--project={PROJECT}"),
        gcloud("logging", "buckets", "create", LOG_BUCKET, f"--location={REGION}", f"--project={PROJECT}",
               "--retention=30d"),
    )
    r.ensure(
        f"logsink:{LOG_SINK}",
        gcloud("logging", "sinks", "describe", LOG_SINK, f"--project={PROJECT}"),
        gcloud("logging", "sinks", "create", LOG_SINK, LOG_DESTINATION, f"--project={PROJECT}",
               f"--log-filter={LOG_FILTER}"),
    )
    r.ensure(
        f"logview:{LOG_VIEW}",
        gcloud("logging", "views", "describe", LOG_VIEW, f"--bucket={LOG_BUCKET}", f"--location={REGION}",
               f"--project={PROJECT}"),
        gcloud("logging", "views", "create", LOG_VIEW, f"--bucket={LOG_BUCKET}", f"--location={REGION}",
               f"--project={PROJECT}", f"--log-filter={LOG_FILTER}"),
    )
    r.write(None, gcloud("logging", "views", "add-iam-policy-binding", LOG_VIEW, f"--bucket={LOG_BUCKET}",
                         f"--location={REGION}", f"--project={PROJECT}",
                         f"--member=serviceAccount:{sa('han-deployer')}", "--role=roles/logging.viewAccessor"))

    # 10. Hosting sites, through the Firebase CLI, authenticated by WIF.
    for site in SITES:
        r.ensure(
            f"site:{site}",
            ["npx", "--no-install", "firebase", "hosting:sites:get", site, f"--project={PROJECT}"],
            ["npx", "--no-install", "firebase", "hosting:sites:create", site, f"--project={PROJECT}"],
        )

    # 11. Identity-level grants, on the account and never at project level.
    r.write(None, gcloud("iam", "service-accounts", "add-iam-policy-binding", sa("han-server-run"),
                         f"--project={PROJECT}", f"--member=serviceAccount:{sa('han-deployer')}",
                         "--role=roles/iam.serviceAccountUser"))
    wif = f"principal://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL}/subject"
    for account, env in (("han-tf-apply", "han-infra-apply"), ("han-deployer", "han-production"),
                         ("han-hosting-deployer", "han-hosting")):
        r.write(None, gcloud("iam", "service-accounts", "add-iam-policy-binding", sa(account),
                             f"--project={PROJECT}", f"--member={wif}/repo:{REPO}:environment:{env}",
                             "--role=roles/iam.workloadIdentityUser"))
    r.write(None, gcloud("iam", "service-accounts", "add-iam-policy-binding", sa("han-tf-plan"),
                         f"--project={PROJECT}",
                         f"--member=principalSet://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL}/attribute.repository_id/{REPO_ID}",
                         "--role=roles/iam.workloadIdentityUser"))

    # 12. Resource-level grants on Han's own resources only.
    r.write(None, gcloud("run", "services", "add-iam-policy-binding", "han-server", f"--region={REGION}",
                         f"--project={PROJECT}", f"--member=serviceAccount:{sa('han-tf-apply')}", "--role=roles/run.admin"))
    r.write(None, gcloud("artifacts", "repositories", "add-iam-policy-binding", "han", f"--location={REGION}",
                         f"--project={PROJECT}", f"--member=serviceAccount:{sa('han-tf-apply')}",
                         "--role=roles/artifactregistry.repoAdmin"))
    r.write(None, gcloud("artifacts", "repositories", "add-iam-policy-binding", "han", f"--location={REGION}",
                         f"--project={PROJECT}", f"--member=serviceAccount:{sa('han-deployer')}",
                         "--role=roles/artifactregistry.writer"))
    r.write(None, ["gcloud", "storage", "buckets", "add-iam-policy-binding", f"gs://{STATE_BUCKET}",
                   f"--member=serviceAccount:{sa('han-tf-apply')}", "--role=roles/storage.objectAdmin", "--quiet"])
    r.write(None, ["gcloud", "storage", "buckets", "add-iam-policy-binding", f"gs://{STATE_BUCKET}",
                   f"--member=serviceAccount:{sa('han-tf-plan')}", "--role=roles/storage.objectViewer", "--quiet"])

    # 13. Verify, read-only. Any failure stops the run before the revoke step.
    for name in SERVICE_ACCOUNTS:
        keys = r.read(f"keys:{name}", gcloud("iam", "service-accounts", "keys", "list",
                                             f"--iam-account={sa(name)}", "--managed-by=user",
                                             "--format=value(name)", f"--project={PROJECT}"))[1]
        if keys.strip() and r.execute:
            raise RuntimeError(f"{name} has a user-managed key; refusing to continue")

    # 14. Revoke the bootstrap sign-in. This is the last mutating step.
    r.write(None, gcloud("iam", "service-accounts", "remove-iam-policy-binding", BOOTSTRAP_SA,
                         f"--project={PROJECT}", f"--member={BOOTSTRAP_PRINCIPAL}",
                         "--role=roles/iam.workloadIdentityUser"))
    _, after = r.read("bootstrap-binding", gcloud("iam", "service-accounts", "get-iam-policy", BOOTSTRAP_SA,
                                                 f"--project={PROJECT}", "--format=json"))
    if BOOTSTRAP_ENV_SUBJECT in after and r.execute:
        raise RuntimeError("bootstrap sign-in binding is still present after revoke")


def real_backend(kind: str, key: str | None, argv: list[str]) -> tuple[int, str]:
    import subprocess

    proc = subprocess.run(argv, capture_output=True, text=True)
    return proc.returncode, proc.stdout + proc.stderr


def main(argv: list[str], backend: Backend | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--execute", action="store_true", help="run the plan (CI only)")
    args = parser.parse_args(argv)
    runner = Runner(execute=args.execute, backend=backend or real_backend)
    try:
        steps(runner, HERE / "roles")
    except RuntimeError as err:
        print(f"::error::{err}", file=sys.stderr)
        return 1
    print(f"done: {len(runner.log)} mutating commands {'run' if args.execute else 'planned'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
