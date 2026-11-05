#!/usr/bin/env python3
"""One-shot bootstrap for Han inside the existing project thebushido-co.

Runs only from .github/workflows/han-bootstrap.yml, in the han-bootstrap
environment, which needs a reviewer and runs from main. Nothing else calls it.

Modes:
  (default)                      print the plan and its sha256. Reads nothing and
                                 touches no cloud API. The same code path prints
                                 the plan in every mode, so the hash is a function
                                 of this file alone.
  --execute --expect-sha256 H    run the plan, but only if its hash is exactly H.
                                 Any other hash refuses before a single call.
  --revoke-only                  remove the bootstrap sign-in member from the
                                 bootstrap account's policy. Runs in its own
                                 always-run workflow step.

Every object is described first and created only if the describe says it is
missing. Only a recognised not-found answer counts as missing. Any other error
stops the run, so an uncertain answer never becomes a create or a grant.

The last act of every execute, success or failure, is the revoke. If it cannot
verify that the sign-in member is gone, the run fails.

The backend is injected. Tests use a fake backend. CI uses the real gcloud
commands, authenticated by WIF.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

HERE = Path(__file__).resolve().parent
# The repository root. Plan lines name files relative to it, so the plan and its hash are
# the same on any checkout, and every command runs from it.
ROOT = HERE.parents[2]

PROJECT = "thebushido-co"
PROJECT_NUMBER = "911514101920"
REGION = "us-central1"
REPO = "TheBushidoCollective/han"
REPO_ID = "1100192477"

# Han's own pool and provider. Created here, never the shared github pool.
POOL = "han-github"
PROVIDER = "han-github"
ISSUER = "https://token.actions.githubusercontent.com"
WORKFLOWS_ALLOWED_TO_SIGN_IN = ("han-infra.yml", "deploy-han-server.yml", "deploy-hosting.yml")

# The existing identity this job signs in as. A human grants the subject below,
# time-boxed, before the run (PATH.md section 8). This run removes it again.
BOOTSTRAP_SA = f"terraform-bootstrap@{PROJECT}.iam.gserviceaccount.com"
BOOTSTRAP_ENV_SUBJECT = f"repo:{REPO}:environment:han-bootstrap"
SHARED_POOL = f"projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/github"
BOOTSTRAP_PRINCIPAL = f"principal://iam.googleapis.com/{SHARED_POOL}/subject/{BOOTSTRAP_ENV_SUBJECT}"

# The Terraform state bucket. han-infra.yml must name this same bucket.
STATE_BUCKET = f"{PROJECT}-han-tfstate"

SECRET_PREFIX = "han-server-"
# Every secret the bootstrap creates. Terraform manages versions of only the
# three in TF_MANAGED_SECRETS; the rest take values out of band.
SECRETS = (
    "database-url",
    "jwt-secret",
    "master-kek",
    "github-client-secret",
    "stripe-secret-key",
    "stripe-webhook-secret",
)
TF_MANAGED_SECRETS = ("database-url", "jwt-secret", "master-kek")
KEK_SECRET = "master-kek"

SQL_INSTANCE = "han-pg"
SQL_VERSION = "POSTGRES_16"
SQL_EDITION = "enterprise"  # the gcloud spelling of the ENTERPRISE edition
SQL_TIER = "db-f1-micro"
SQL_SSL_MODE = "ENCRYPTED_ONLY"
SQL_CONDITION = HERE / "conditions" / "han_pg.yaml"

SERVICE = "han-server"
ARTIFACT_REPO = "han"
LOG_BUCKET = "han-server-logs"
LOG_SINK = "han-server-logs"
LOG_VIEW = "startup"
LOG_SINK_FILTER = 'resource.type="cloud_run_revision" AND resource.labels.service_name="han-server"'
# A log view accepts only resource.type, SOURCE() and LOG_ID() in its filter. The
# bucket receives only han-server logs, so the view is already limited to them.
LOG_VIEW_FILTER = 'resource.type="cloud_run_revision"'
LOG_RETENTION_DAYS = "30"
LOG_DESTINATION = f"logging.googleapis.com/projects/{PROJECT}/locations/{REGION}/buckets/{LOG_BUCKET}"

# Placeholder only. The deploy workflow replaces the image, and Terraform ignores
# template changes.
PLACEHOLDER_IMAGE = "us-docker.pkg.dev/cloudrun/container/hello"

APIS = (
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "logging.googleapis.com",
    "firebasehosting.googleapis.com",
    "secretmanager.googleapis.com",
    "run.googleapis.com",
    "iam.googleapis.com",
)

SERVICE_ACCOUNTS = {
    "han-tf-plan": "Han Terraform plan (read-only)",
    "han-tf-apply": "Han Terraform apply",
    "han-deployer": "Han server deployer",
    "han-hosting-deployer": "Han Hosting deployer",
    "han-server-run": "Han server runtime",
}

# Custom role id -> reviewed file. Created or updated to match the file.
CUSTOM_ROLES = {
    "hanTfPlanGlobal": "han_tf_plan_global.yaml",
    "hanTfPlanSql": "han_tf_plan_sql.yaml",
    "hanTfApplySql": "han_tf_apply_sql.yaml",
    "hanTfPlanSecrets": "han_tf_plan_secrets.yaml",
    "hanTfApplySecrets": "han_tf_apply_secrets.yaml",
    "hanTfApplyKekVersions": "han_tf_apply_kek.yaml",
}

# Words that mean "the object does not exist", per describe command. Each is the
# text the installed gcloud printed for a missing object (not-found-markers.json,
# captured from gcloud 580.0.0). Anything else is an error, not a missing object.
NOT_FOUND_MARKERS = ("NOT_FOUND", "Cannot find service", "not found: 404")


class StepError(RuntimeError):
    pass


def sa(name: str) -> str:
    return f"{name}@{PROJECT}.iam.gserviceaccount.com"


def role(role_id: str) -> str:
    return f"projects/{PROJECT}/roles/{role_id}"


def gcloud(*args: str) -> list[str]:
    return ["gcloud", *args, "--quiet"]


def secret_id(name: str) -> str:
    return f"{SECRET_PREFIX}{name}"


def is_not_found(stderr: str, stdout: str = "") -> bool:
    text = stderr + stdout
    return any(marker in text for marker in NOT_FOUND_MARKERS)


def is_bootstrap_member(member: str) -> bool:
    return member.endswith(f"/subject/{BOOTSTRAP_ENV_SUBJECT}")


# A backend answers (returncode, stdout, stderr). Reads and writes are kept apart,
# so a test can assert that the plan never reads.
Backend = Callable[[str, list[str]], tuple[int, str, str]]


@dataclass
class Runner:
    """Routes every command through one place. In plan mode it reads nothing."""

    execute: bool
    backend: Backend | None
    plan: list[str] = field(default_factory=list)

    def _read(self, argv: list[str]) -> tuple[int, str, str]:
        if not self.execute or self.backend is None:
            raise AssertionError("reads happen only in execute mode")
        return self.backend("read", argv)

    def write(self, argv: list[str]) -> None:
        line = " ".join(argv)
        self.plan.append(line)
        if not self.execute:
            return
        rc, _, err = self.backend("write", argv)
        if rc != 0:
            raise StepError(f"command failed ({rc}): {line}\n{err}")

    def ensure_listed(self, list_argv: list[str], name: str, create: list[str]) -> None:
        """Create the object if the list does not name it. A list has no not-found text to read."""
        self.plan.append(f"ensure-listed {name}: list {' '.join(list_argv)} | create: {' '.join(create)}")
        if not self.execute:
            return
        rc, out, err = self._read(list_argv)
        if rc != 0:
            raise StepError(f"cannot list objects, not creating {name}: {err}")
        if name in {item.get("name") for item in json.loads(out or "[]")}:
            return
        self.write(create)

    def ensure(self, describe: list[str], create: list[str]) -> None:
        """Create the object if its describe says it is missing. Refuse on any other error."""
        self.plan.append(f"ensure: {' '.join(describe)} | create: {' '.join(create)}")
        if not self.execute:
            return
        rc, out, err = self._read(describe)
        if rc == 0:
            return
        if not is_not_found(err, out):
            raise StepError(f"describe failed for an unexpected reason, not creating: {' '.join(describe)}\n{err}")
        self.write(create)

    def upsert_role(self, role_id: str, file: str) -> None:
        describe = gcloud("iam", "roles", "describe", role_id, f"--project={PROJECT}")
        create = gcloud("iam", "roles", "create", role_id, f"--project={PROJECT}", f"--file={file}")
        update = gcloud("iam", "roles", "update", role_id, f"--project={PROJECT}", f"--file={file}")
        self.plan.append(f"upsert role {role_id}: describe {' '.join(describe)} | create {' '.join(create)} | update {' '.join(update)}")
        if not self.execute:
            return
        rc, out, err = self._read(describe)
        if rc == 0:
            self.write(update)
        elif is_not_found(err, out):
            self.write(create)
        else:
            raise StepError(f"describe role {role_id} failed for an unexpected reason\n{err}")


def steps(r: Runner) -> None:
    """Every mutation, in dependency order. Plan and execute both walk this list."""

    # 1. APIs. Enabling an API changes no other resource.
    for api in APIS:
        r.write(gcloud("services", "enable", api, f"--project={PROJECT}"))

    # 2. Custom roles, from the reviewed files.
    for role_id, filename in CUSTOM_ROLES.items():
        r.upsert_role(role_id, rel(HERE / "roles" / filename))

    # 3. Terraform state bucket: uniform access, public access blocked, versioned.
    bucket = f"gs://{STATE_BUCKET}"
    r.ensure(
        ["gcloud", "storage", "buckets", "describe", bucket, f"--project={PROJECT}", "--format=json"],
        ["gcloud", "storage", "buckets", "create", bucket, f"--project={PROJECT}", f"--location={REGION}",
         "--uniform-bucket-level-access", "--public-access-prevention", "--quiet"],
    )
    r.write(["gcloud", "storage", "buckets", "update", bucket, "--versioning", "--quiet"])

    # 4. Han's pool and provider. The condition admits this repository only, and only
    #    from the named workflows. Plan runs from pull requests, so its ref is not pinned.
    r.ensure(
        gcloud("iam", "workload-identity-pools", "describe", POOL, "--location=global", f"--project={PROJECT}"),
        gcloud("iam", "workload-identity-pools", "create", POOL, "--location=global", f"--project={PROJECT}",
               "--display-name=Han GitHub"),
    )
    condition = (
        f"assertion.repository_id == '{REPO_ID}' && ("
        + " || ".join(f"assertion.job_workflow_ref.startsWith('{REPO}/.github/workflows/{wf}@')"
                      for wf in WORKFLOWS_ALLOWED_TO_SIGN_IN)
        + ")"
    )
    # attribute.environment is not mapped. No binding reads it, and a claim missing
    # from a job without an environment may break the token exchange.
    mapping = (
        "google.subject=assertion.sub,attribute.repository=assertion.repository,"
        "attribute.repository_id=assertion.repository_id,attribute.job_workflow_ref=assertion.job_workflow_ref"
    )
    r.ensure(
        gcloud("iam", "workload-identity-pools", "providers", "describe", PROVIDER,
               f"--workload-identity-pool={POOL}", "--location=global", f"--project={PROJECT}"),
        gcloud("iam", "workload-identity-pools", "providers", "create-oidc", PROVIDER,
               f"--workload-identity-pool={POOL}", "--location=global", f"--project={PROJECT}",
               f"--issuer-uri={ISSUER}", f"--attribute-mapping={mapping}", f"--attribute-condition={condition}"),
    )

    # 5. Service accounts. Created here, never by Terraform. No keys are created.
    for name, display in SERVICE_ACCOUNTS.items():
        r.ensure(
            gcloud("iam", "service-accounts", "describe", sa(name), f"--project={PROJECT}"),
            gcloud("iam", "service-accounts", "create", name, f"--project={PROJECT}", f"--display-name={display}"),
        )

    # 6. Cloud SQL instance. Terraform imports it, then sets its settings. Existence
    #    is read from the list, which returns an empty list for no match, so no
    #    not-found text is needed.
    r.ensure_listed(
        ["gcloud", "sql", "instances", "list", f"--project={PROJECT}", "--format=json"],
        SQL_INSTANCE,
        ["gcloud", "sql", "instances", "create", SQL_INSTANCE, f"--project={PROJECT}", f"--region={REGION}",
         f"--database-version={SQL_VERSION}", f"--edition={SQL_EDITION}", f"--tier={SQL_TIER}",
         f"--ssl-mode={SQL_SSL_MODE}", "--deletion-protection", "--quiet"],
    )

    # 7. Secrets. Created empty. Terraform writes versions of the three it manages.
    for name in SECRETS:
        sid = secret_id(name)
        r.ensure(
            gcloud("secrets", "describe", sid, f"--project={PROJECT}"),
            gcloud("secrets", "create", sid, "--replication-policy=automatic", f"--project={PROJECT}"),
        )

    # 8. Cloud Run service shell. Private until Terraform sets invoker_iam_disabled.
    r.ensure(
        gcloud("run", "services", "describe", SERVICE, f"--region={REGION}", f"--project={PROJECT}"),
        gcloud("run", "deploy", SERVICE, f"--region={REGION}", f"--project={PROJECT}",
               f"--image={PLACEHOLDER_IMAGE}", f"--service-account={sa('han-server-run')}",
               "--no-allow-unauthenticated"),
    )

    # 9. Artifact Registry repository for Han images only.
    r.ensure(
        gcloud("artifacts", "repositories", "describe", ARTIFACT_REPO, f"--location={REGION}", f"--project={PROJECT}"),
        gcloud("artifacts", "repositories", "create", ARTIFACT_REPO, f"--location={REGION}", f"--project={PROJECT}",
               "--repository-format=docker"),
    )

    # 10. Constrained log access. A custom bucket receives only han-server logs, a
    #     view shows only that bucket, and only the deployer can view it.
    r.ensure(
        gcloud("logging", "buckets", "describe", LOG_BUCKET, f"--location={REGION}", f"--project={PROJECT}"),
        gcloud("logging", "buckets", "create", LOG_BUCKET, f"--location={REGION}", f"--project={PROJECT}",
               f"--retention-days={LOG_RETENTION_DAYS}"),
    )
    r.ensure(
        gcloud("logging", "sinks", "describe", LOG_SINK, f"--project={PROJECT}"),
        gcloud("logging", "sinks", "create", LOG_SINK, LOG_DESTINATION, f"--project={PROJECT}",
               f"--log-filter={LOG_SINK_FILTER}"),
    )
    r.ensure(
        gcloud("logging", "views", "describe", LOG_VIEW, f"--bucket={LOG_BUCKET}", f"--location={REGION}",
               f"--project={PROJECT}"),
        gcloud("logging", "views", "create", LOG_VIEW, f"--bucket={LOG_BUCKET}", f"--location={REGION}",
               f"--project={PROJECT}", f"--log-filter={LOG_VIEW_FILTER}"),
    )
    r.write(gcloud("logging", "views", "add-iam-policy-binding", LOG_VIEW, f"--bucket={LOG_BUCKET}",
                   f"--location={REGION}", f"--project={PROJECT}",
                   f"--member=serviceAccount:{sa('han-deployer')}", "--role=roles/logging.viewAccessor"))

    # 11. Project-level grants. Each is the narrowest role its identity needs.
    def project_bind(member: str, role_name: str, condition_file: Path | None = None) -> None:
        # Conditions come from reviewed files. An inline --condition would be split
        # on commas, and the expression contains commas.
        argv = gcloud("projects", "add-iam-policy-binding", PROJECT, f"--member={member}", f"--role={role_name}")
        argv += [f"--condition-from-file={rel(condition_file)}"] if condition_file else ["--condition=None"]
        r.write(argv)

    plan_member = f"serviceAccount:{sa('han-tf-plan')}"
    apply_member = f"serviceAccount:{sa('han-tf-apply')}"
    hosting_member = f"serviceAccount:{sa('han-hosting-deployer')}"
    run_member = f"serviceAccount:{sa('han-server-run')}"
    # The apply identity reads the same identity metadata as the plan identity. The
    # data sources it refreshes need it, and the role names no secret or payload.
    project_bind(plan_member, role("hanTfPlanGlobal"))
    project_bind(apply_member, role("hanTfPlanGlobal"))
    project_bind(plan_member, role("hanTfPlanSql"), SQL_CONDITION)
    project_bind(apply_member, role("hanTfApplySql"), SQL_CONDITION)
    # Runtime: not conditioned to han-pg. A Cloud SQL resource-name condition is not
    # verified (PATH.md section 8). Name the gap, do not claim it closed.
    project_bind(run_member, "roles/cloudsql.client")
    project_bind(run_member, "roles/logging.logWriter")
    # Hosting deployer: the accepted project-wide exception (PATH.md section 8, risk 1).
    project_bind(hosting_member, "roles/firebasehosting.admin")
    project_bind(hosting_member, "roles/serviceusage.serviceUsageConsumer")

    # 12. Secret-level grants. Each secret the identity needs, and nothing else.
    for name in SECRETS:
        sid = secret_id(name)
        r.write(gcloud("secrets", "add-iam-policy-binding", sid, f"--project={PROJECT}",
                       f"--member=serviceAccount:{sa('han-deployer')}", "--role=roles/secretmanager.viewer"))
        r.write(gcloud("secrets", "add-iam-policy-binding", sid, f"--project={PROJECT}",
                       f"--member={run_member}", "--role=roles/secretmanager.secretAccessor"))
    for name in TF_MANAGED_SECRETS:
        sid = secret_id(name)
        # The KEK role has no versions.destroy, so this identity cannot destroy the KEK version.
        apply_role = "hanTfApplyKekVersions" if name == KEK_SECRET else "hanTfApplySecrets"
        r.write(gcloud("secrets", "add-iam-policy-binding", sid, f"--project={PROJECT}",
                       f"--member={apply_member}", f"--role={role(apply_role)}"))
        r.write(gcloud("secrets", "add-iam-policy-binding", sid, f"--project={PROJECT}",
                       f"--member={plan_member}", f"--role={role('hanTfPlanSecrets')}"))

    # 13. Identity-level grants, on the account and never at project level.
    r.write(gcloud("iam", "service-accounts", "add-iam-policy-binding", sa("han-server-run"),
                   f"--project={PROJECT}", f"--member=serviceAccount:{sa('han-deployer')}",
                   "--role=roles/iam.serviceAccountUser"))
    wif = f"principal://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL}/subject"
    for account, env in (("han-tf-apply", "han-infra-apply"), ("han-deployer", "han-production"),
                         ("han-hosting-deployer", "han-hosting")):
        r.write(gcloud("iam", "service-accounts", "add-iam-policy-binding", sa(account),
                       f"--project={PROJECT}", f"--member={wif}/repo:{REPO}:environment:{env}",
                       "--role=roles/iam.workloadIdentityUser"))
    r.write(gcloud("iam", "service-accounts", "add-iam-policy-binding", sa("han-tf-plan"),
                   f"--project={PROJECT}",
                   f"--member=principalSet://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL}/attribute.repository_id/{REPO_ID}",
                   "--role=roles/iam.workloadIdentityUser"))

    # 14. Resource-level grants on Han's own resources only. The plan identity gets
    #     read on each resource Terraform refreshes or imports. The apply identity
    #     gets the write it needs.
    r.write(gcloud("run", "services", "add-iam-policy-binding", SERVICE, f"--region={REGION}",
                   f"--project={PROJECT}", f"--member={apply_member}", "--role=roles/run.admin"))
    r.write(gcloud("run", "services", "add-iam-policy-binding", SERVICE, f"--region={REGION}",
                   f"--project={PROJECT}", f"--member={plan_member}", "--role=roles/run.viewer"))
    r.write(gcloud("artifacts", "repositories", "add-iam-policy-binding", ARTIFACT_REPO, f"--location={REGION}",
                   f"--project={PROJECT}", f"--member={apply_member}", "--role=roles/artifactregistry.reader"))
    r.write(gcloud("artifacts", "repositories", "add-iam-policy-binding", ARTIFACT_REPO, f"--location={REGION}",
                   f"--project={PROJECT}", f"--member=serviceAccount:{sa('han-deployer')}",
                   "--role=roles/artifactregistry.writer"))
    r.write(gcloud("artifacts", "repositories", "add-iam-policy-binding", ARTIFACT_REPO, f"--location={REGION}",
                   f"--project={PROJECT}", f"--member={plan_member}", "--role=roles/artifactregistry.reader"))
    r.write(["gcloud", "storage", "buckets", "add-iam-policy-binding", f"gs://{STATE_BUCKET}",
             f"--member={apply_member}", "--role=roles/storage.objectAdmin", "--quiet"])
    r.write(["gcloud", "storage", "buckets", "add-iam-policy-binding", f"gs://{STATE_BUCKET}",
             f"--member={plan_member}", "--role=roles/storage.objectViewer", "--quiet"])


def revoke_plan(r: Runner) -> None:
    r.plan.append(f"revoke: remove every member ending /subject/{BOOTSTRAP_ENV_SUBJECT} from {BOOTSTRAP_SA}")


def preflight(r: Runner) -> None:
    """Read-only, before any mutation. Refuses to run as any identity but the bootstrap account."""
    # The run must be signed in as the bootstrap account. A wrong identity stops it.
    rc, out, err = r._read(["gcloud", "auth", "list", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot read the active account: {err}")
    active = [a.get("account") for a in json.loads(out) if a.get("status") == "ACTIVE"]
    if active != [BOOTSTRAP_SA]:
        raise StepError(f"refusing to continue as {active!r}; expected {BOOTSTRAP_SA}")



def postcheck(r: Runner) -> None:
    """Read-only checks after the steps, before the revoke. Any failure stops the run."""
    # After the steps: the state bucket exists now, and must be private and versioned.
    rc, out, err = r._read(["gcloud", "storage", "buckets", "list", f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot list buckets: {err}")
    if STATE_BUCKET not in _strings(json.loads(out)):
        raise StepError(f"{STATE_BUCKET} is not a bucket in {PROJECT}")
    rc, out, err = r._read(["gcloud", "storage", "buckets", "describe", f"gs://{STATE_BUCKET}",
                            f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot describe {STATE_BUCKET}: {err}")
    described = json.loads(out)
    if described.get("uniform_bucket_level_access") is not True:
        raise StepError(f"{STATE_BUCKET} does not use uniform bucket-level access")
    if described.get("public_access_prevention") != "enforced":
        raise StepError(f"{STATE_BUCKET} does not enforce public access prevention")
    if described.get("versioning_enabled") is not True:
        raise StepError(f"{STATE_BUCKET} is not versioned")

    # After the steps: no Han identity has a user-managed key.
    for name in SERVICE_ACCOUNTS:
        rc, out, err = r._read(["gcloud", "iam", "service-accounts", "keys", "list",
                                f"--iam-account={sa(name)}", "--managed-by=user",
                                "--format=value(name)", f"--project={PROJECT}"])
        if rc != 0:
            raise StepError(f"cannot list keys for {name}: {err}")
        if out.strip():
            raise StepError(f"{name} has a user-managed key; refusing to continue")


def _strings(value) -> set[str]:
    if isinstance(value, str):
        return {value}
    if isinstance(value, dict):
        return set().union(*(_strings(v) for v in value.values())) if value else set()
    if isinstance(value, list):
        return set().union(*(_strings(v) for v in value)) if value else set()
    return set()


def remove_bootstrap_member(policy: dict) -> bool:
    """Drop the sign-in member from every binding, keeping its etag and other members."""
    changed = False
    for binding in policy.get("bindings", []):
        members = binding.get("members", [])
        kept = [m for m in members if not is_bootstrap_member(m)]
        if len(kept) != len(members):
            changed = True
            binding["members"] = kept
    policy["bindings"] = [b for b in policy.get("bindings", []) if b.get("members")]
    return changed


def revoke(r: Runner) -> None:
    """Remove the sign-in member, then prove it is gone. Fails if it cannot prove that."""
    if not r.execute:
        revoke_plan(r)
        return
    rc, out, err = r._read(["gcloud", "iam", "service-accounts", "get-iam-policy", BOOTSTRAP_SA,
                            f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot read the bootstrap policy, so cannot prove the sign-in is revoked: {err}")
    policy = json.loads(out)
    if remove_bootstrap_member(policy):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
            json.dump(policy, fh)
            path = fh.name
        try:
            r.write(gcloud("iam", "service-accounts", "set-iam-policy", BOOTSTRAP_SA, path, f"--project={PROJECT}"))
        finally:
            Path(path).unlink(missing_ok=True)
    rc, out, err = r._read(["gcloud", "iam", "service-accounts", "get-iam-policy", BOOTSTRAP_SA,
                            f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot re-read the bootstrap policy after revoke: {err}")
    if any(is_bootstrap_member(m) for b in json.loads(out).get("bindings", []) for m in b.get("members", [])):
        raise StepError("bootstrap sign-in member is still present after revoke")


def rel(path: Path) -> str:
    """Repository-relative and POSIX. The plan names files this way, never by absolute path."""
    return path.resolve().relative_to(ROOT).as_posix()


def referenced_files() -> list[Path]:
    """Every file whose contents the plan depends on: this code, the roles and the condition."""
    roles = [HERE / "roles" / name for name in sorted(CUSTOM_ROLES.values())]
    return [Path(__file__).resolve(), SQL_CONDITION, *roles]


def build_plan() -> list[str]:
    r = Runner(execute=False, backend=None)
    steps(r)
    revoke_plan(r)
    # Contents, not only names: a changed permission, condition or line of code changes the hash.
    for path in referenced_files():
        r.plan.append(f"input {rel(path)} sha256 {hashlib.sha256(path.read_bytes()).hexdigest()}")
    return r.plan


def plan_sha256(lines: list[str]) -> str:
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


def run_execute(backend: Backend) -> None:
    r = Runner(execute=True, backend=backend)
    try:
        preflight(r)
        steps(r)
        postcheck(r)
    except BaseException:
        # The sign-in must not outlive a failed run. A failure to revoke is reported
        # alongside the original error, which is kept as the cause.
        try:
            revoke(r)
        except StepError as err:
            print(f"::error::revoke also failed: {err}", file=sys.stderr)
        raise
    revoke(r)


def real_backend(kind: str, argv: list[str]) -> tuple[int, str, str]:
    # Run from the repository root, so the repository-relative paths in the plan resolve.
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=900, cwd=ROOT)
    return proc.returncode, proc.stdout, proc.stderr


def commit_check(expected: str | None) -> str | None:
    """Return an error text unless this run is the reviewed commit, or None when it is."""
    if expected is None:
        return None
    actual = os.environ.get("GITHUB_SHA", "")
    if actual != expected:
        return f"run commit {actual!r} is not the reviewed commit {expected!r}; nothing ran"
    return None


def main(argv: list[str], backend: Backend | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else "")
    parser.add_argument("--execute", action="store_true", help="run the plan (CI only)")
    parser.add_argument("--expect-sha256", help="refuse unless the plan hashes to this value")
    parser.add_argument("--expect-commit", help="refuse unless GITHUB_SHA is this commit")
    parser.add_argument("--revoke-only", action="store_true", help="remove the sign-in member and nothing else")
    parser.add_argument("--plan-file", help="write the plan text here")
    args = parser.parse_args(argv)

    if args.revoke_only:
        if args.execute:
            print("::error::--revoke-only cannot be combined with --execute", file=sys.stderr)
            return 2
        try:
            revoke(Runner(execute=True, backend=backend or real_backend))
        except StepError as err:
            print(f"::error::{err}", file=sys.stderr)
            return 1
        print("revoked: the bootstrap sign-in member is absent")
        return 0

    lines = build_plan()
    sha = plan_sha256(lines)
    for line in lines:
        print(line)
    print(f"plan-sha256: {sha}")
    if args.plan_file:
        Path(args.plan_file).write_text("\n".join(lines) + f"\nplan-sha256: {sha}\n", encoding="utf-8")

    if args.expect_sha256 is not None and args.expect_sha256 != sha:
        print(f"::error::plan hash {sha} does not match the approved {args.expect_sha256}; nothing ran", file=sys.stderr)
        return 2
    error = commit_check(args.expect_commit)
    if error:
        print(f"::error::{error}", file=sys.stderr)
        return 2
    if not args.execute:
        return 0
    if args.expect_sha256 is None or args.expect_commit is None:
        print("::error::--execute needs --expect-sha256 and --expect-commit, so the approval names the exact plan and commit",
              file=sys.stderr)
        return 2
    try:
        run_execute(backend or real_backend)
    except StepError as err:
        print(f"::error::{err}", file=sys.stderr)
        return 1
    print(f"done: {len(lines)} planned operations executed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
