#!/usr/bin/env python3
"""One-shot bootstrap for Han inside the existing project thebushido-co.

Runs from the website repository's main-only han-bootstrap workflow
(TheBushidoCollective/website/.github/workflows/han-bootstrap.yml@refs/heads/main),
using the existing owner identity terraform-ci@thebushido-co.iam.gserviceaccount.com.
No temporary sign-in grant is created or removed.

Modes:
  (default)                      print the plan and its sha256. Reads nothing and
                                 touches no cloud API. The same code path prints
                                 the plan in every mode. The hash covers this file and
                                 the roles and the condition file it names.
  --execute --expect-sha256 H --expect-commit C
                                 run the plan, but only if its hash is exactly H and C is
                                 HEAD of the Han repository. Any other value refuses
                                 before a single call.
  --rotate-db-password           with --execute: generate a new database password and seed
                                 database-url with it. It changes the plan, so the hash
                                 covers the rotation. Never run on a normal rerun.

Every object is described first and created only if the describe says it is
missing. Only a recognised not-found answer counts as missing. Any other error
stops the run, so an uncertain answer never becomes a create or a grant.

Preflight checks that the active gcloud auth account is exactly CALLER_SA.

The backend is injected. Tests use a fake backend. CI uses the real gcloud
commands, authenticated by WIF.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import shutil
import string
import tempfile
import time
from secrets import choice
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
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
WORKFLOWS_ALLOWED_TO_SIGN_IN = ("han-infra.yml", "deploy-han-server.yml", "deploy-hosting.yml", "han-dns-import.yml")

# The owner identity that executes this bootstrap from the website repo (contract C1).
CALLER_SA = f"terraform-ci@{PROJECT}.iam.gserviceaccount.com"
CALLER_REPOSITORY = "TheBushidoCollective/website"
CALLER_WORKFLOW_REF = f"{CALLER_REPOSITORY}/.github/workflows/han-bootstrap.yml@refs/heads/main"
CALLER_EVENTS = ("push", "workflow_dispatch")

CI_ENVIRONMENT = {
    "GITHUB_ACTIONS": "true",
    "RUNNER_ENVIRONMENT": "github-hosted",
    "GITHUB_REPOSITORY": CALLER_REPOSITORY,
    "GITHUB_REF": "refs/heads/main",
    "GITHUB_WORKFLOW_REF": CALLER_WORKFLOW_REF,
}

# The Terraform state bucket. han-infra.yml must name this same bucket.
STATE_BUCKET = f"{PROJECT}-han-tfstate"

SECRET_PREFIX = "han-server-"
# Every secret the bootstrap creates. Terraform writes versions of only the two in
# TF_MANAGED_SECRETS. The bootstrap seeds database-url, and the rest take values out of band.
SECRETS = (
    "database-url",
    "jwt-secret",
    "master-kek",
    "github-client-secret",
    "stripe-secret-key",
    "stripe-webhook-secret",
)
TF_MANAGED_SECRETS = ("jwt-secret", "master-kek")
KEK_SECRET = "master-kek"

SQL_INSTANCE = "han-pg"
SQL_VERSION = "POSTGRES_16"
SQL_EDITION = "enterprise"  # the gcloud spelling of the ENTERPRISE edition
SQL_TIER = "db-f1-micro"
SQL_SSL_MODE = "ENCRYPTED_ONLY"
SQL_CONDITION = HERE / "conditions" / "han_pg.yaml"

# The application database and user. The bootstrap creates both, with the password
# that database-url carries, so Terraform needs no database or user permission.
DB_NAME = "han_team"
DB_USER = "han"
DB_SECRET = f"{SECRET_PREFIX}database-url"
DB_PASSWORD_LENGTH = 40
DB_ALPHABET = string.ascii_letters + string.digits
CONNECTION_NAME = f"{PROJECT}:{REGION}:{SQL_INSTANCE}"
# The secret's state label. "ready" is set only after the user and the newest enabled
# version carry the same password. Any other value makes the next run set both again.
PW_LABEL = "han-password-state"
PW_PENDING = "pending"
PW_READY = "ready"

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


# A backend answers (returncode, stdout, stderr). Reads and writes are kept apart,
# so a test can assert that the plan never reads. stdin carries a secret payload, so a
# secret never has to be an argument or a file.
Backend = Callable[[str, list[str], str | None], tuple[int, str, str]]


@dataclass
class Runner:
    """Routes every command through one place. In plan mode it reads nothing."""

    execute: bool
    backend: Backend | None
    plan: list[str] = field(default_factory=list)

    def _read(self, argv: list[str]) -> tuple[int, str, str]:
        if not self.execute or self.backend is None:
            raise AssertionError("reads happen only in execute mode")
        return self.backend("read", argv, None)

    def write(self, argv: list[str], stdin: str | None = None, quiet: bool = False) -> None:
        line = " ".join(argv)
        self.plan.append(line)
        if not self.execute:
            return
        rc, _, err = self.backend("write", argv, stdin)
        if rc != 0:
            # quiet: the error text may echo a credential, so it is not put in the message.
            detail = "" if quiet else f"\n{err}"
            raise StepError(f"command failed ({rc}): {line}{detail}")

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


def state_bucket_guard(r: Runner, when: str, must_exist: bool) -> bool | None:
    """Refuse any change to the state bucket unless it is exactly ours. Runs before every bucket
    create, update and grant. Returns True when the bucket is in this project, False when it is
    absent and may be created, and None in plan mode. Ambiguity or any error stops the run."""
    r.plan.append(f"guard {STATE_BUCKET} {when}: one bucket of that name in {PROJECT}, "
                  "uniform access and public access prevention enforced")
    if not r.execute:
        return None
    rc, out, err = r._read(["gcloud", "storage", "buckets", "list", f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot list buckets in {PROJECT}, so {STATE_BUCKET} is not touched: {err}")
    try:
        items = json.loads(out or "[]")
    except ValueError as exc:
        raise StepError(f"bucket list is not JSON, so {STATE_BUCKET} is not touched: {exc}") from exc
    if not isinstance(items, list) or not all(isinstance(i, dict) and isinstance(i.get("name"), str) for i in items):
        raise StepError(f"bucket list has an unexpected shape, so {STATE_BUCKET} is not touched")
    count = [i["name"] for i in items].count(STATE_BUCKET)
    if count > 1:
        raise StepError(f"{count} buckets named {STATE_BUCKET} in {PROJECT}; ambiguous, so not touched")
    describe = ["gcloud", "storage", "buckets", "describe", f"gs://{STATE_BUCKET}", f"--project={PROJECT}",
                "--format=json"]
    if count == 0:
        if must_exist:
            raise StepError(f"{STATE_BUCKET} is not in {PROJECT} {when}; not touched")
        rc, out, err = r._read(describe)
        if rc == 0:
            raise StepError(f"{STATE_BUCKET} exists outside {PROJECT}; not created, updated or granted")
        if not is_not_found(err, out):
            raise StepError(f"cannot tell whether {STATE_BUCKET} exists, so not touched: {err}")
        return False
    rc, out, err = r._read(describe)
    if rc != 0:
        raise StepError(f"cannot describe {STATE_BUCKET}, so not touched: {err}")
    try:
        described = json.loads(out)
    except ValueError as exc:
        raise StepError(f"describe of {STATE_BUCKET} is not JSON, so not touched: {exc}") from exc
    if described.get("name") != STATE_BUCKET:
        raise StepError(f"describe names {described.get('name')!r}, not {STATE_BUCKET}; not touched")
    if described.get("uniform_bucket_level_access") is not True:
        raise StepError(f"{STATE_BUCKET} does not use uniform bucket-level access; not touched")
    if described.get("public_access_prevention") != "enforced":
        raise StepError(f"{STATE_BUCKET} does not enforce public access prevention; not touched")
    return True


def steps(r: Runner, rotate: bool = False) -> None:
    """Every mutation, in dependency order. Plan and execute both walk this list."""

    # 1. APIs. Enabling an API changes no other resource.
    for api in APIS:
        r.write(gcloud("services", "enable", api, f"--project={PROJECT}"))

    # 2. Custom roles, from the reviewed files.
    for role_id, filename in CUSTOM_ROLES.items():
        r.upsert_role(role_id, rel(HERE / "roles" / filename))

    # 3. Terraform state bucket. Nothing is created, updated or granted unless the guard proves
    #    the bucket is exactly ours: one bucket of that name in this project.
    bucket = f"gs://{STATE_BUCKET}"
    exists = state_bucket_guard(r, "before any change", must_exist=False)
    if exists is not True:
        r.write(["gcloud", "storage", "buckets", "create", bucket, f"--project={PROJECT}", f"--location={REGION}",
                 "--uniform-bucket-level-access", "--public-access-prevention", "--quiet"])
    state_bucket_guard(r, "after create", must_exist=True)
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
        + " || ".join(f"assertion.workflow_ref.startsWith('{REPO}/.github/workflows/{wf}@')"
                      for wf in WORKFLOWS_ALLOWED_TO_SIGN_IN)
        + ")"
    )
    # attribute.environment is not mapped. No binding reads it, and a claim missing
    # from a job without an environment may break the token exchange.
    mapping = (
        "google.subject=assertion.sub,attribute.repository=assertion.repository,"
        "attribute.repository_id=assertion.repository_id,attribute.workflow_ref=assertion.workflow_ref"
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
    # 6b. The application database. Created here, so Terraform needs no database permission.
    r.ensure_listed(
        ["gcloud", "sql", "databases", "list", f"--instance={SQL_INSTANCE}", f"--project={PROJECT}", "--format=json"],
        DB_NAME,
        ["gcloud", "sql", "databases", "create", DB_NAME, f"--instance={SQL_INSTANCE}", f"--project={PROJECT}", "--quiet"],
    )

    # 7. Secrets. Created empty. Terraform writes two of them, and the bootstrap seeds database-url later (7b).
    for name in SECRETS:
        sid = secret_id(name)
        r.ensure(
            gcloud("secrets", "describe", sid, f"--project={PROJECT}"),
            gcloud("secrets", "create", sid, "--replication-policy=automatic", f"--project={PROJECT}"),
        )

    # 7b. The database user and database-url, seeded with one matching password.
    provision_database(r, rotate)

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
    # Runtime: Cloud SQL connect on han-pg only. The condition names the instance type and the
    # exact instance. No logging role: the server writes JSON to stdout, which Cloud Run collects
    # for the service identity (PATH.md section 8).
    project_bind(run_member, "roles/cloudsql.client", SQL_CONDITION)
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
    state_bucket_guard(r, "before the grants", must_exist=True)
    r.write(["gcloud", "storage", "buckets", "add-iam-policy-binding", f"gs://{STATE_BUCKET}",
             f"--member={apply_member}", "--role=roles/storage.objectAdmin", "--quiet"])
    r.write(["gcloud", "storage", "buckets", "add-iam-policy-binding", f"gs://{STATE_BUCKET}",
             f"--member={plan_member}", "--role=roles/storage.objectViewer", "--quiet"])


def caller_plan(r: Runner) -> None:
    r.plan.append(f"caller: {CALLER_SA} from {CALLER_WORKFLOW_REF} on push or workflow_dispatch; "
                  "no sign-in grant is created or removed")


def preflight(r: Runner) -> None:
    """Read-only, before any mutation. Verifies the caller identity is exactly CALLER_SA."""
    rc, out, err = r._read(["gcloud", "auth", "list", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot read the active account: {err}")
    active = [a.get("account") for a in json.loads(out) if a.get("status") == "ACTIVE"]
    if active != [CALLER_SA]:
        raise StepError(f"refusing to continue as {active!r}; expected {CALLER_SA}")



def postcheck(r: Runner) -> None:
    """Read-only checks after the steps. Any failure stops the run."""
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


def database_url(password: str) -> str:
    return f"postgres://{DB_USER}:{password}@localhost/{DB_NAME}?host=/cloudsql/{CONNECTION_NAME}"


def _user_exists(r: Runner) -> bool:
    rc, out, err = r._read(["gcloud", "sql", "users", "list", f"--instance={SQL_INSTANCE}",
                            f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot list database users: {err}")
    return DB_USER in {item.get("name") for item in json.loads(out or "[]")}


def _enabled_versions(r: Runner) -> int:
    rc, out, err = r._read(["gcloud", "secrets", "versions", "list", DB_SECRET, f"--project={PROJECT}",
                            "--filter=state=ENABLED", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot list versions of {DB_SECRET}: {err}")
    return len(json.loads(out or "[]"))


def _secret_label(r: Runner) -> str | None:
    rc, out, err = r._read(["gcloud", "secrets", "describe", DB_SECRET, f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot describe {DB_SECRET}: {err}")
    return (json.loads(out).get("labels") or {}).get(PW_LABEL)


def provision_database(r: Runner, rotate: bool) -> None:
    """Create the user and database, and seed database-url with the user's password.

    The password is generated here and reaches gcloud only through a 0600 flags file
    (for the user) and stdin (for the secret). It is never in an argument, the plan, the
    run output or an artifact. gcloud's own debug log is off for these calls (real_backend).
    Whether Cloud SQL's audit log records the password is unverified (PATH.md artifact 20).
    Order, so a failure at any step is repaired by a rerun:
      1. label database-url pending,
      2. create the user, or set its password if it exists,
      3. add a database-url version holding the matching DSN,
      4. label database-url ready.
    A rerun changes nothing only when the user exists, an enabled version exists and the
    label says ready. Any other state runs 1 to 4 again with a new password.
    """
    r.plan.append(
        f"database access: label {DB_SECRET} {PW_PENDING}; create user {DB_USER} or set its password "
        f"(password in a 0600 flags file, never in argv); add a version of {DB_SECRET} from stdin; "
        f"label {PW_READY}. Rotate requested: {'yes' if rotate else 'no'}"
    )
    if not r.execute:
        return
    user_present = _user_exists(r)
    enabled = _enabled_versions(r)
    label = _secret_label(r)
    if not rotate and user_present and enabled > 0 and label == PW_READY:
        return
    r.write(["gcloud", "secrets", "update", DB_SECRET, f"--project={PROJECT}",
             f"--update-labels={PW_LABEL}={PW_PENDING}", "--quiet"])
    password = "".join(choice(DB_ALPHABET) for _ in range(DB_PASSWORD_LENGTH))
    workdir = tempfile.mkdtemp(prefix="han-db-")  # mode 0700
    try:
        flags = Path(workdir) / "user.yaml"
        fd = os.open(flags, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump({"--password": password}, fh)  # JSON is valid YAML for --flags-file
        verb = "set-password" if user_present else "create"
        r.write(["gcloud", "sql", "users", verb, DB_USER, f"--instance={SQL_INSTANCE}",
                 f"--project={PROJECT}", f"--flags-file={flags}", "--quiet"], quiet=True)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    r.write(["gcloud", "secrets", "versions", "add", DB_SECRET, "--data-file=-", f"--project={PROJECT}", "--quiet"],
            stdin=database_url(password), quiet=True)
    r.write(["gcloud", "secrets", "update", DB_SECRET, f"--project={PROJECT}",
             f"--update-labels={PW_LABEL}={PW_READY}", "--quiet"])
    del password


def database_postcheck(r: Runner) -> None:
    """Read-only, after the steps. The database, the user and a matching secret must exist."""
    rc, out, err = r._read(["gcloud", "sql", "databases", "list", f"--instance={SQL_INSTANCE}",
                            f"--project={PROJECT}", "--format=json"])
    if rc != 0:
        raise StepError(f"cannot list databases: {err}")
    if DB_NAME not in {item.get("name") for item in json.loads(out or "[]")}:
        raise StepError(f"database {DB_NAME} is missing")
    if not _user_exists(r):
        raise StepError(f"database user {DB_USER} is missing")
    if _enabled_versions(r) < 1:
        raise StepError(f"{DB_SECRET} has no enabled version")
    if _secret_label(r) != PW_READY:
        raise StepError(f"{DB_SECRET} is not marked {PW_READY}, so its password may not match the user")




def _strings(value) -> set[str]:
    if isinstance(value, str):
        return {value}
    if isinstance(value, dict):
        return set().union(*(_strings(v) for v in value.values())) if value else set()
    if isinstance(value, list):
        return set().union(*(_strings(v) for v in value)) if value else set()
    return set()


def pinned_identity_error(commit: str, plan_sha: str) -> str | None:
    """Validate the commit and plan sha256 formatting. Both must be well formed or nothing runs."""
    if re.fullmatch(r"[0-9a-f]{40}", commit or "") is None:
        return f"the approved commit {commit!r} is not a 40-character lowercase commit; nothing ran"
    if re.fullmatch(r"[0-9a-f]{64}", plan_sha or "") is None:
        return f"the approved plan {plan_sha!r} is not a 64-character lowercase sha256; nothing ran"
    return None


def rel(path: Path) -> str:
    """Repository-relative and POSIX. The plan names files this way, never by absolute path."""
    return path.resolve().relative_to(ROOT).as_posix()


def referenced_files() -> list[Path]:
    """Every file whose contents the plan depends on: this code, the roles and the condition."""
    roles = [HERE / "roles" / name for name in sorted(CUSTOM_ROLES.values())]
    return [Path(__file__).resolve(), SQL_CONDITION, *roles]


def build_plan(rotate: bool = False) -> list[str]:
    r = Runner(execute=False, backend=None)
    steps(r, rotate)
    caller_plan(r)
    # Contents, not only names: a changed permission, condition or line of code changes the hash.
    for path in referenced_files():
        r.plan.append(f"input {rel(path)} sha256 {hashlib.sha256(path.read_bytes()).hexdigest()}")
    return r.plan


def plan_sha256(lines: list[str]) -> str:
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


def run_execute(backend: Backend, plan_sha: str, commit: str, rotate: bool = False) -> None:
    r = Runner(execute=True, backend=backend)
    preflight(r)
    steps(r, rotate)
    postcheck(r)
    database_postcheck(r)


def real_backend(kind: str, argv: list[str], stdin: str | None = None) -> tuple[int, str, str]:
    # Run from the repository root, so the repository-relative paths in the plan resolve.
    # gcloud writes a debug log for each run, and that log records argument values, including
    # values read from --flags-file. The database password is one of those, so the log is off.
    # Checked locally: with this variable a run created no log file, and a flags-file value
    # was not found in any log. Without it, one file was created and held the value.
    env = {**os.environ, "CLOUDSDK_CORE_DISABLE_FILE_LOGGING": "1"}
    proc = subprocess.run(argv, input=stdin, capture_output=True, text=True, timeout=900, cwd=ROOT, env=env)
    return proc.returncode, proc.stdout, proc.stderr


def commit_check(expected: str | None) -> str | None:
    """Return an error text unless HEAD in this checkout is the reviewed commit, or None when it is."""
    if expected is None:
        return None
    try:
        actual = subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception as exc:
        return f"cannot determine git HEAD in {ROOT}: {exc}; nothing ran"
    if actual != expected:
        return f"HEAD commit {actual!r} is not the reviewed commit {expected!r}; nothing ran"
    return None


def ci_guard() -> str | None:
    """Return an error text unless this is the reviewed website workflow on main, or None when it is."""
    for key, want in CI_ENVIRONMENT.items():
        if os.environ.get(key) != want:
            return f"{key} is {os.environ.get(key)!r}, not {want!r}; this command runs only from {CALLER_WORKFLOW_REF}"
    event = os.environ.get("GITHUB_EVENT_NAME", "")
    if event not in CALLER_EVENTS:
        return f"GITHUB_EVENT_NAME is {event!r}, not one of {CALLER_EVENTS!r}; this command runs only from {CALLER_WORKFLOW_REF}"
    return None


def main(argv: list[str], backend: Backend | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else "")
    parser.add_argument("--execute", action="store_true", help="run the plan (CI only)")
    parser.add_argument("--expect-sha256", help="refuse unless the plan hashes to this value")
    parser.add_argument("--expect-commit", help="refuse unless git HEAD is this commit")
    parser.add_argument("--rotate-db-password", action="store_true",
                        help="generate a new database password and seed database-url with it")
    parser.add_argument("--plan-file", help="write the plan text here")
    args = parser.parse_args(argv)
    if args.execute:
        error = ci_guard()
        if error:
            print(f"::error::{error}", file=sys.stderr)
            return 2
        if args.expect_sha256 is None or args.expect_commit is None:
            print("::error::--expect-sha256 and --expect-commit are required; nothing ran", file=sys.stderr)
            return 2

    lines = build_plan(args.rotate_db_password)
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
    error = pinned_identity_error(args.expect_commit, args.expect_sha256)
    if error:
        print(f"::error::{error}", file=sys.stderr)
        return 2
    try:
        run_execute(backend or real_backend, sha, args.expect_commit, args.rotate_db_password)
    except StepError as err:
        print(f"::error::{err}", file=sys.stderr)
        return 1
    print(f"done: {len(lines)} planned operations executed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
