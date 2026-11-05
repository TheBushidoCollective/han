"""Behaviour tests for bootstrap/bootstrap.py, against a fake cloud.

The fake returns the exact not-found text captured from the installed gcloud
(bootstrap/not-found-markers.json), so a missing object is recognised by the
same words the real CLI prints. Every flag the bootstrap passes is checked
against the flags the installed gcloud accepts (bootstrap/gcloud-flags.json).
Nothing here calls a cloud API.
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import os
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
import hashlib
from datetime import datetime, timedelta, timezone
from unittest import mock

BOOT_DIR = Path(__file__).resolve().parents[1] / "bootstrap"
ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("bootstrap_py", BOOT_DIR / "bootstrap.py")
bootstrap = importlib.util.module_from_spec(spec)
sys.modules["bootstrap_py"] = bootstrap
spec.loader.exec_module(bootstrap)

CAPTURED_FLAGS = json.loads((BOOT_DIR / "gcloud-flags.json").read_text(encoding="utf-8"))["commands"]
NOT_FOUND = json.loads((BOOT_DIR / "not-found-markers.json").read_text(encoding="utf-8"))
SCHEMA = json.loads((BOOT_DIR / "tf-schema.json").read_text(encoding="utf-8"))

VERBS = {"describe", "create", "create-oidc", "deploy"}
# Command family -> the captured not-found text for a missing object in it.
FAMILY_FIXTURE = {
    "run": "run-service",
    "storage buckets": "storage-bucket",
    "iam roles": "role",
    "iam service-accounts": "service-account",
    "iam workload-identity-pools": "wif-pool",
    "iam workload-identity-pools providers": "wif-provider",
    "secrets": "secret",
    "logging buckets": "logging-bucket",
    "logging sinks": "logging-sink",
    "logging views": "logging-view",
    "artifacts repositories": "artifact-repo",
}


def object_key(argv: list[str]) -> tuple[str, str] | None:
    """(family, name) for a describe or create. Family is the command group."""
    args = argv[1:]
    for i, token in enumerate(args):
        if token in VERBS:
            group = " ".join(args[:i])
            family = "run" if group.startswith("run") else group
            name = next((t for t in args[i + 1:] if not t.startswith("--")), "")
            return family, name.split("@")[0].replace("gs://", "").rstrip("/")
    return None


class FakeCloud:
    """Holds the objects that exist, the bootstrap account's policy, and every call.

    It also models the database, the user, secret versions and labels, so the password
    sequence can be checked end to end. It records what each call was given: the flags-file
    mode and contents, and the stdin payload. The password is read from those, never from argv.
    """

    def __init__(self) -> None:
        self.objects: set[tuple[str, str]] = set()
        self.reads: list[list[str]] = []
        self.writes: list[list[str]] = []
        self.events: list[tuple[str, list[str]]] = []  # every call, reads and writes, in order
        self.account = bootstrap.BOOTSTRAP_SA
        self.keys_for: dict[str, str] = {}
        self.fail_write: str | None = None
        self.fail_read: str | None = None
        self.fail_remove = 0  # the next N removals fail with a transient error
        self.noop_remove = False  # a removal claims success and changes nothing
        self.concurrent_once = None  # run once inside the next removal, which then fails
        self.fail_reads_after_remove = False
        self.policy_read_failures = 0  # the next N policy reads fail with a transient error
        self.foreign_buckets: set[str] = set()  # exist, but in another project
        self.foreign_mutations: list[list[str]] = []
        self.removes: list[list[str]] = []
        self.removal_modes: list[int] = []
        self.removal_texts: list[str] = []  # the condition file's text, as gcloud was handed it
        self.db_users: dict[str, str] = {}  # user name -> its current password
        self.databases: set[str] = set()
        self.versions: dict[str, list[dict]] = {}  # secret -> [{"state", "password"}]
        self.labels: dict[str, dict] = {}
        self.flag_files: list[dict] = []  # {"path", "mode", "password"} seen by user calls
        self.stdin_payloads: list[str] = []
        self.argv_seen: list[list[str]] = []
        self.policy = {
            "version": 3,
            "etag": "BwYfake",
            "bindings": [
                {"role": "roles/iam.serviceAccountUser", "members": ["user:someone@example.com"]},
                sign_in_binding(DEFAULT_PLAN_SHA),
            ],
        }

    def __call__(self, kind: str, argv: list[str], stdin: str | None = None) -> tuple[int, str, str]:
        self.argv_seen.append(argv)
        self.events.append((kind, argv))
        if stdin is not None:
            self.stdin_payloads.append(stdin)
        if kind == "read":
            self.reads.append(argv)
            return self._read(argv)
        self.writes.append(argv)
        if any(name in " ".join(argv) for name in self.foreign_buckets):
            self.foreign_mutations.append(argv)
        return self._write(argv, stdin)

    def _bucket_config(self, name: str) -> dict:
        return {"name": name, "uniform_bucket_level_access": True,
                "public_access_prevention": "enforced", "versioning_enabled": True}

    def set_sign_in(self, binding: dict) -> None:
        """Replace the reviewed sign-in binding, or add it when absent."""
        kept = [b for b in self.policy["bindings"]
                if not (b.get("role") == bootstrap.SIGNIN_ROLE
                        and (b.get("condition") or {}).get("title") == bootstrap.SIGNIN_TITLE)]
        self.policy["bindings"] = [*kept, binding]

    def _remove_binding(self, argv: list[str]) -> tuple[int, str, str]:
        """Models gcloud's exact match: the member, the role, and the whole condition in the file."""
        self.removes.append(argv)
        if self.noop_remove:
            return 0, "", ""

        def flag(name: str) -> str:
            return next(a.split("=", 1)[1] for a in argv if a.startswith(f"--{name}="))

        member, role = flag("member"), flag("role")
        path = Path(flag("condition-from-file"))
        self.removal_modes.append(path.stat().st_mode & 0o777)
        raw = path.read_text(encoding="utf-8")
        self.removal_texts.append(raw)
        cond = json.loads(raw)
        if self.concurrent_once is not None:
            hook, self.concurrent_once = self.concurrent_once, None
            hook(self)
            return 1, "", "ERROR: (gcloud) The policy was changed by another request; etag mismatch. Retry."
        if self.fail_remove > 0:
            self.fail_remove -= 1
            return 1, "", "ERROR: (gcloud) transient failure"
        for binding in self.policy["bindings"]:
            if binding.get("role") == role and binding.get("condition") == cond and member in binding["members"]:
                binding["members"].remove(member)
                self.policy["bindings"] = [b for b in self.policy["bindings"] if b["members"]]
                self.policy["etag"] += "x"
                return 0, "", ""
        return 1, "", NOT_FOUND_REMOVE

    def members(self) -> list[str]:
        return [m for b in self.policy.get("bindings", []) for m in b.get("members", [])]

    def enabled_password(self, secret: str) -> str | None:
        enabled = [v for v in self.versions.get(secret, []) if v["state"] == "ENABLED"]
        return enabled[-1]["password"] if enabled else None

    def _read(self, argv: list[str]) -> tuple[int, str, str]:
        joined = " ".join(argv)
        if "get-iam-policy" in argv and self.policy_read_failures > 0:
            self.policy_read_failures -= 1
            return 1, "", "ERROR: (gcloud) transient policy read failure"
        if self.fail_reads_after_remove and self.removes and "get-iam-policy" in argv:
            return 1, "", "ERROR: (gcloud) transient failure after the removal"
        if self.fail_read and self.fail_read in joined:
            return 1, "", "ERROR: (gcloud) PERMISSION_DENIED: forbidden for this identity."
        if argv[1:3] == ["auth", "list"]:
            return 0, json.dumps([{"account": self.account, "status": "ACTIVE"}]), ""
        if bootstrap.ACTIVE_EXECUTION:
            m = bootstrap.ACTIVE_EXECUTION
            if argv[1:5] == ["iam", "workload-identity-pools", "describe", m["pool_id"]]:
                return 0, json.dumps({"name": bootstrap.SHARED_POOL, "state": "ACTIVE", "disabled": False}), ""
            if (argv[1:5] == ["iam", "workload-identity-pools", "providers", "list"] and
                    f"--workload-identity-pool={m['pool_id']}" in argv):
                return 0, json.dumps([{"name": m["provider_resource"]}]), ""
        if (argv[1:6] == ["iam", "workload-identity-pools", "providers", "describe", "github"]
                and bootstrap.ACTIVE_EXECUTION):
            m = bootstrap.ACTIVE_EXECUTION
            return 0, json.dumps({
                "name": m["provider_resource"], "state": "ACTIVE", "disabled": False,
                "attributeMapping": {"google.subject": "assertion.repository_id + ':' + assertion.run_id + ':' + assertion.run_attempt"},
                "attributeCondition": bootstrap.execution.provider_condition(m),
                "oidc": {"issuerUri": bootstrap.execution.ISSUER, "allowedAudiences": [m["audience"]]},
            }), ""
        if "get-iam-policy" in argv:
            return 0, json.dumps(self.policy), ""
        if "keys" in argv and "list" in argv:
            sa_arg = next(a.split("=", 1)[1] for a in argv if a.startswith("--iam-account="))
            return 0, self.keys_for.get(sa_arg.split("@")[0], ""), ""
        if argv[1:3] == ["storage", "buckets"] and "list" in argv:
            return 0, json.dumps([{"name": n} for (fam, n) in self.objects if fam == "storage buckets"]), ""
        if argv[1:3] == ["sql", "instances"] and "list" in argv:
            return 0, json.dumps([{"name": n} for (fam, n) in self.objects if fam == "sql instances"]), ""
        if argv[1:3] == ["sql", "users"] and "list" in argv:
            return 0, json.dumps([{"name": n} for n in self.db_users]), ""
        if argv[1:3] == ["sql", "databases"] and "list" in argv:
            return 0, json.dumps([{"name": n} for n in self.databases]), ""
        if argv[1:3] == ["secrets", "versions"] and "list" in argv:
            secret = argv[4]
            items = self.versions.get(secret, [])
            if "--filter=state=ENABLED" in argv:
                items = [v for v in items if v["state"] == "ENABLED"]
            return 0, json.dumps([{"name": str(i)} for i, _ in enumerate(items)]), ""
        key = object_key(argv)
        if key is None:
            raise AssertionError(f"unexpected read: {joined}")
        if key[0] == "storage buckets" and key[1] in self.foreign_buckets:
            return 0, json.dumps(self._bucket_config(key[1])), ""
        if key in self.objects:
            if key[0] == "storage buckets":
                return 0, json.dumps(self._bucket_config(key[1])), ""
            if key[0] == "secrets":
                return 0, json.dumps({"labels": self.labels.get(key[1], {})}), ""
            return 0, "{}", ""
        fixture = FAMILY_FIXTURE.get(key[0])
        if fixture is None:
            raise AssertionError(f"no captured not-found text for {key[0]}")
        return 1, "", NOT_FOUND[fixture]["first_line"]

    def _write(self, argv: list[str], stdin: str | None) -> tuple[int, str, str]:
        joined = " ".join(argv)
        if self.fail_write and self.fail_write in joined:
            return 1, "", "ERROR: (gcloud) simulated failure"
        if "set-iam-policy" in argv:
            raise AssertionError("the bootstrap must never call set-iam-policy")
        if "remove-iam-policy-binding" in argv:
            return self._remove_binding(argv)
        if argv[1:3] == ["sql", "users"] and ("create" in argv or "set-password" in argv):
            flags = next(a.split("=", 1)[1] for a in argv if a.startswith("--flags-file="))
            path = Path(flags)
            mode = path.stat().st_mode & 0o777  # the file must exist during the call
            data = json.loads(path.read_text(encoding="utf-8"))
            self.flag_files.append({"path": flags, "mode": mode, "password": data["--password"]})
            user = argv[4]
            if "create" in argv:
                if user in self.db_users:
                    return 1, "", "ERROR: (gcloud.sql.users.create) user already exists"
                self.db_users[user] = data["--password"]
            else:
                if user not in self.db_users:
                    return 1, "", "ERROR: (gcloud.sql.users.set-password) user does not exist"
                self.db_users[user] = data["--password"]
            return 0, "", ""
        if argv[1:3] == ["sql", "databases"] and "create" in argv:
            self.databases.add(argv[4])
            return 0, "", ""
        if argv[1:3] == ["secrets", "versions"] and "add" in argv:
            if stdin is None:
                return 1, "", "ERROR: no payload on stdin"
            prefix = "postgres://han:"
            if not stdin.startswith(prefix):
                return 1, "", "ERROR: unexpected payload shape"
            password = stdin[len(prefix):].split("@", 1)[0]
            self.versions.setdefault(argv[4], []).append({"state": "ENABLED", "password": password})
            return 0, "", ""
        if argv[1:3] == ["secrets", "update"]:
            for arg in argv:
                if arg.startswith("--update-labels="):
                    key, value = arg.split("=", 2)[1:]
                    self.labels.setdefault(argv[3], {})[key] = value
            return 0, "", ""
        key = object_key(argv)
        if key and any(v in argv for v in ("create", "create-oidc", "deploy")):
            self.objects.add(key)
        return 0, "", ""


def database_payload_password(fake: FakeCloud) -> str:
    """The password the newest DSN carried, as the fake recorded it from stdin."""
    return fake.versions[bootstrap.DB_SECRET][-1]["password"]


TEST_COMMIT = "0123456789abcdef0123456789abcdef01234567"
NOW = datetime(2026, 11, 5, 10, 0, tzinfo=timezone.utc)
EXPIRY = "2026-11-05T11:30:00Z"  # 90 minutes after NOW, inside the 45 to 120 minute window
EXPIRY_AT = datetime(2026, 11, 5, 11, 30, tzinfo=timezone.utc)
DEFAULT_PLAN_SHA = bootstrap.plan_sha256(bootstrap.build_plan())
TEST_RUN = "123456789"
TEST_EXECUTION = bootstrap.execution.make_manifest(TEST_COMMIT, DEFAULT_PLAN_SHA, "a" * 40, TEST_RUN, "1", EXPIRY, False)
bootstrap.ACTIVE_EXECUTION = TEST_EXECUTION
bootstrap.BOOTSTRAP_PRINCIPAL = TEST_EXECUTION["member"]
bootstrap.SHARED_POOL = f"projects/{bootstrap.PROJECT_NUMBER}/locations/global/workloadIdentityPools/{TEST_EXECUTION['pool_id']}"
HAN_POOL_MEMBER = (f"principal://iam.googleapis.com/projects/{bootstrap.PROJECT_NUMBER}/locations/global/"
                   f"workloadIdentityPools/{bootstrap.POOL}/subject/repo:{bootstrap.REPO}:environment:han-bootstrap")
NOT_FOUND_REMOVE = "ERROR: (gcloud) Policy binding with the specified principal, role, and condition not found!"
CI_ENV = {**bootstrap.CI_ENVIRONMENT, "GITHUB_SHA": TEST_COMMIT, "GITHUB_RUN_ID": TEST_RUN, "GITHUB_RUN_ATTEMPT": "1"}


REVOKE_ARGS = ["--revoke-only", "--expect-sha256", DEFAULT_PLAN_SHA, "--expect-commit", TEST_COMMIT]

SLEEPS: list[float] = []  # backoff waits, recorded instead of waited for


def run(fake, *args: str, now: datetime = NOW) -> tuple[int, str, str]:
    """Run against a fake backend and a private execution-registration fixture."""
    out, err = io.StringIO(), io.StringIO()
    SLEEPS.clear()
    argv = list(args)
    if "--execute" in argv or "--revoke-only" in argv:
        commit = argv[argv.index("--expect-commit") + 1] if "--expect-commit" in argv else TEST_COMMIT
        digest = argv[argv.index("--expect-sha256") + 1] if "--expect-sha256" in argv else DEFAULT_PLAN_SHA
        # Invalid pins are exercised by bootstrap itself; use valid fixture fields.
        if re.fullmatch(r"[0-9a-f]{40}", commit or "") is None: commit = TEST_COMMIT
        if re.fullmatch(r"[0-9a-f]{64}", digest or "") is None: digest = DEFAULT_PLAN_SHA
        manifest = bootstrap.execution.make_manifest(commit, digest, "a" * 40, TEST_RUN, "1", EXPIRY, "--rotate-db-password" in argv)
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json")
        json.dump(manifest, tmp, sort_keys=True, separators=(",", ":")); tmp.write("\n"); tmp.flush()
        argv.extend(["--execution-manifest", tmp.name])
    else:
        tmp = None
    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err), \
                mock.patch.object(bootstrap, "utc_now", return_value=now), \
                mock.patch.object(bootstrap.time, "time", return_value=now.timestamp()), \
                mock.patch.object(bootstrap.time, "sleep", side_effect=SLEEPS.append):
            rc = bootstrap.main(argv, backend=fake)
    finally:
        if tmp: tmp.close()
    return rc, out.getvalue(), err.getvalue()




def sign_in_binding(plan_sha: str, *, description: str | None = None, expression: str | None = None,
                    members: list[str] | None = None, title: str | None = None) -> dict:
    """The reviewed grant as the website side writes it, with any one part overridden by a test."""
    return {
        "role": bootstrap.SIGNIN_ROLE,
        "members": members if members is not None else [bootstrap.BOOTSTRAP_PRINCIPAL],
        "condition": {
            "title": title or bootstrap.SIGNIN_TITLE,
            "description": description if description is not None
            else bootstrap.SIGNIN_DESCRIPTION.format(commit=TEST_COMMIT, plan=plan_sha, run=TEST_RUN),
            "expression": expression if expression is not None else f"request.time < timestamp('{EXPIRY}')",
        },
    }


@contextlib.contextmanager
def ci_env(**overrides: str | None):
    """The reviewed CI environment for the block. A None override removes that variable."""
    values = {**CI_ENV, **overrides}
    saved = {key: os.environ.get(key) for key in values}
    try:
        for key, value in values.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        yield
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def ci_run(fake, *args: str, now: datetime = NOW) -> tuple[int, str, str]:
    with ci_env():
        return run(fake, *args, now=now)


def execute_args(rotate: bool = False) -> list[str]:
    args = ["--execute", "--expect-sha256", bootstrap.plan_sha256(bootstrap.build_plan(rotate)),
            "--expect-commit", TEST_COMMIT]
    return [*args, "--rotate-db-password"] if rotate else args


def execute(fake: FakeCloud, rotate: bool = False, now: datetime = NOW) -> tuple[int, str, str]:
    """Execute the current plan from the reviewed CI environment, with the grant written for that plan."""
    fake.set_sign_in(sign_in_binding(bootstrap.plan_sha256(bootstrap.build_plan(rotate))))
    with ci_env():
        return run(fake, *execute_args(rotate), now=now)


def has(argv: list[str], text: str) -> bool:
    """True when some argument contains text, as in --member=serviceAccount:..."""
    return any(text in arg for arg in argv)


class PlanMode(unittest.TestCase):
    def test_plan_reads_nothing_and_writes_nothing(self):
        def refuse(kind, argv):
            raise AssertionError(f"plan mode called the backend: {kind} {argv}")

        rc, out, _ = run(refuse)
        self.assertEqual(rc, 0)
        self.assertIn("plan-sha256:", out)

    def test_plan_is_deterministic(self):
        self.assertEqual(bootstrap.plan_sha256(bootstrap.build_plan()),
                         bootstrap.plan_sha256(bootstrap.build_plan()))

    def test_a_different_hash_refuses_before_any_call(self):
        fake = FakeCloud()
        rc, _, err = ci_run(fake, "--execute", "--expect-sha256", "0" * 64)
        self.assertEqual(rc, 2)
        self.assertIn("nothing ran", err)
        self.assertEqual(fake.reads + fake.writes, [])

    def test_execute_without_a_pinned_hash_refuses(self):
        fake = FakeCloud()
        rc, _, err = ci_run(fake, "--execute")
        self.assertEqual(rc, 2)
        self.assertIn("--expect-sha256", err)
        self.assertEqual(fake.reads + fake.writes, [])

    def test_plan_file_carries_the_printed_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "plan.txt"
            run(None, "--plan-file", str(path))
            text = path.read_text(encoding="utf-8")
        self.assertIn(f"plan-sha256: {bootstrap.plan_sha256(bootstrap.build_plan())}", text)


class FirstRun(unittest.TestCase):
    def setUp(self):
        self.fake = FakeCloud()
        self.rc, _, self.err = execute(self.fake)

    def test_run_succeeds(self):
        self.assertEqual(self.rc, 0, self.err)

    def test_creates_every_object(self):
        expected = {
            *(("iam roles", r) for r in bootstrap.CUSTOM_ROLES),
            *(("iam service-accounts", n) for n in bootstrap.SERVICE_ACCOUNTS),
            ("storage buckets", bootstrap.STATE_BUCKET),
            ("iam workload-identity-pools", bootstrap.POOL),
            ("iam workload-identity-pools providers", bootstrap.PROVIDER),
            ("sql instances", bootstrap.SQL_INSTANCE),
            *(("secrets", bootstrap.secret_id(s)) for s in bootstrap.SECRETS),
            ("run", bootstrap.SERVICE),
            ("artifacts repositories", bootstrap.ARTIFACT_REPO),
            ("logging buckets", bootstrap.LOG_BUCKET),
            ("logging sinks", bootstrap.LOG_SINK),
            ("logging views", bootstrap.LOG_VIEW),
        }
        self.assertTrue(expected <= self.fake.objects, expected - self.fake.objects)

    def test_the_sign_in_member_is_gone(self):
        self.assertFalse(bootstrap.holders(self.fake.policy))

    def test_other_members_of_the_bootstrap_policy_are_kept(self):
        self.assertIn("user:someone@example.com", self.fake.members())

    def test_no_key_or_project_is_created(self):
        for argv in self.fake.writes:
            self.assertNotIn("keys", argv)
            self.assertFalse(argv[1:3] == ["projects", "create"], argv)

    def test_bootstrap_never_recreates_its_temporary_identity(self):
        temporary_pool = TEST_EXECUTION["pool_id"]
        for argv in self.fake.writes:
            self.assertFalse(
                temporary_pool in " ".join(argv) and
                any(verb in argv for verb in ("create", "create-oidc", "add-iam-policy-binding")),
                argv,
            )
        lists = [a for a in self.fake.reads if a[1:5] == ["iam", "workload-identity-pools", "providers", "list"]]
        self.assertEqual(len(lists), 1)
        self.assertIn("--show-deleted", lists[0])

    def test_the_logging_view_filter_uses_only_allowed_fields(self):
        self.assertEqual(bootstrap.LOG_VIEW_FILTER, 'resource.type="cloud_run_revision"')
        views = [a for a in self.fake.writes if a[1:3] == ["logging", "views"] and "create" in a]
        self.assertEqual(len(views), 1)
        self.assertIn(f"--log-filter={bootstrap.LOG_VIEW_FILTER}", views[0])

    def test_the_log_bucket_uses_retention_days(self):
        bucket = [a for a in self.fake.writes if a[1:3] == ["logging", "buckets"] and "create" in a][0]
        self.assertIn("--retention-days=30", bucket)

    def test_the_sink_writes_to_the_custom_bucket_only(self):
        sink = [a for a in self.fake.writes if a[1:3] == ["logging", "sinks"] and "create" in a][0]
        self.assertIn(bootstrap.LOG_DESTINATION, sink)

    def test_the_provider_admits_only_the_named_workflows(self):
        args = next(a for a in self.fake.writes if "create-oidc" in a)
        condition = next(a for a in args if a.startswith("--attribute-condition="))
        mapping = next(a for a in args if a.startswith("--attribute-mapping="))
        expected = " || ".join(
            f"assertion.workflow_ref.startsWith('{bootstrap.REPO}/.github/workflows/{wf}@')"
            for wf in ("han-infra.yml", "deploy-han-server.yml", "deploy-hosting.yml", "han-dns-import.yml")
        )
        self.assertEqual(condition, f"--attribute-condition=assertion.repository_id == '{bootstrap.REPO_ID}' && ({expected})")
        self.assertIn("attribute.workflow_ref=assertion.workflow_ref", mapping)
        self.assertNotIn("job_workflow_ref", mapping + condition)
        self.assertNotIn("attribute.environment", mapping)

    def test_the_cloud_run_shell_is_private(self):
        deploy = next(a for a in self.fake.writes if a[1:3] == ["run", "deploy"])
        self.assertIn("--no-allow-unauthenticated", deploy)
        self.assertNotIn("--allow-unauthenticated", deploy)

    def test_the_sql_instance_matches_the_terraform_settings(self):
        create = next(a for a in self.fake.writes if a[1:3] == ["sql", "instances"] and "create" in a)
        self.assertIn(f"--edition={bootstrap.SQL_EDITION}", create)
        self.assertIn(f"--database-version={bootstrap.SQL_VERSION}", create)
        self.assertIn(f"--ssl-mode={bootstrap.SQL_SSL_MODE}", create)
        self.assertIn("--deletion-protection", create)

    def test_secret_grants_are_per_secret_and_carry_no_condition(self):
        grants = [a for a in self.fake.writes if a[1:3] == ["secrets", "add-iam-policy-binding"]]
        self.assertTrue(grants)
        for argv in grants:
            self.assertTrue(argv[3].startswith(bootstrap.SECRET_PREFIX), argv)
            self.assertFalse(has(argv, "--condition"), argv)

    def test_only_the_three_terraform_secrets_get_the_custom_roles(self):
        role_grants = [a for a in self.fake.writes if a[1:3] == ["secrets", "add-iam-policy-binding"]
                       and has(a, "hanTf")]
        self.assertEqual({a[3] for a in role_grants},
                         {bootstrap.secret_id(s) for s in bootstrap.TF_MANAGED_SECRETS})

    def test_the_apply_identity_can_read_identity_metadata(self):
        apply_member = f"serviceAccount:{bootstrap.sa('han-tf-apply')}"
        grants = [a for a in self.fake.writes
                  if a[1:3] == ["projects", "add-iam-policy-binding"] and has(a, apply_member)]
        self.assertTrue(any(has(a, f"--role=projects/{bootstrap.PROJECT}/roles/hanTfPlanGlobal") for a in grants))

    def test_the_plan_identity_can_read_each_resource_terraform_refreshes(self):
        plan_member = f"serviceAccount:{bootstrap.sa('han-tf-plan')}"
        run_grants = [a for a in self.fake.writes if a[1:3] == ["run", "services"] and has(a, plan_member)]
        repo_grants = [a for a in self.fake.writes
                       if a[1:3] == ["artifacts", "repositories"] and has(a, plan_member)]
        self.assertTrue(any("--role=roles/run.viewer" in a for a in run_grants))
        self.assertTrue(any("--role=roles/artifactregistry.reader" in a for a in repo_grants))

    def test_no_owner_editor_or_viewer_role_is_granted(self):
        text = " ".join(" ".join(a) for a in self.fake.writes)
        for role in ("roles/owner", "roles/editor", "roles/viewer", "roles/resourcemanager.projectIamAdmin"):
            self.assertNotIn(role, text)

    def test_the_bootstrap_never_runs_the_firebase_cli(self):
        text = (BOOT_DIR / "bootstrap.py").read_text(encoding="utf-8")
        self.assertNotIn("npx", text)
        self.assertNotIn('"firebase"', text)
        self.assertNotIn("firebase-tools", text)


class IdempotentSecondRun(unittest.TestCase):
    def test_second_run_creates_nothing(self):
        fake = FakeCloud()
        execute(fake)
        before = len(fake.writes)
        fake.policy = {"version": 3, "etag": "BwYsecond", "bindings": []}
        rc, _, err = execute(fake)
        self.assertEqual(rc, 0, err)
        again = fake.writes[before:]
        self.assertFalse(any(has_exact(a, v) for a in again for v in ("create", "create-oidc", "deploy")), again)


def has_exact(argv: list[str], token: str) -> bool:
    return token in argv


class NotFoundClassification(unittest.TestCase):
    def test_every_captured_missing_text_is_recognised(self):
        for name, entry in NOT_FOUND.items():
            if name == "sql-instance":
                continue  # a permission error, covered below
            with self.subTest(name=name):
                self.assertTrue(bootstrap.is_not_found(entry["first_line"]), entry["first_line"])

    def test_a_permission_error_is_never_a_missing_object(self):
        self.assertFalse(bootstrap.is_not_found(NOT_FOUND["sql-instance"]["first_line"]))

    def test_an_unexpected_describe_error_stops_and_creates_nothing(self):
        fake = FakeCloud()
        fake.fail_read = "service-accounts describe"
        rc, _, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("unexpected reason", err)
        self.assertFalse(any(a[1:4] == ["iam", "service-accounts", "create"] for a in fake.writes))


class Revoke(unittest.TestCase):
    def test_the_sign_in_is_removed_when_a_later_step_fails(self):
        fake = FakeCloud()
        fake.fail_write = "buckets add-iam-policy-binding"
        rc, _, _ = execute(fake)
        self.assertEqual(rc, 1)
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_the_sign_in_is_removed_when_verification_fails(self):
        fake = FakeCloud()
        fake.account = "someone-else@example.com"
        rc, _, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("refusing", err)
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_the_sign_in_is_removed_when_a_han_account_has_a_user_key(self):
        fake = FakeCloud()
        fake.keys_for["han-deployer"] = "abcd1234\n"
        rc, _, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("user-managed key", err)
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_revoke_only_removes_the_grant_and_keeps_other_members(self):
        fake = FakeCloud()
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)
        self.assertFalse(bootstrap.holders(fake.policy))
        self.assertIn("user:someone@example.com", fake.members())
        self.assertNotEqual(fake.policy["etag"], "BwYfake")  # gcloud wrote a new policy version
        self.assertEqual(fake.removal_modes, [0o600])  # the condition file was private
        self.assertFalse(any("set-iam-policy" in a for a in fake.argv_seen))

    def test_a_tampered_expression_on_the_approved_grant_is_still_cleaned_up(self):
        fake = FakeCloud()
        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA,
                                         expression="request.time < timestamp('2099-01-01T00:00:00Z') || true"))
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)
        self.assertEqual(len(fake.removes), 1)
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_revoke_fails_when_the_policy_cannot_be_read(self):
        fake = FakeCloud()
        fake.fail_read = "get-iam-policy"
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("cannot prove the sign-in is revoked", err)

    def test_revoke_fails_when_the_member_survives_the_removal(self):
        fake = FakeCloud()
        fake.noop_remove = True  # the call claims success and changes nothing
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("still present after revoke", err)

    def test_revoke_only_refuses_to_combine_with_execute(self):
        rc, _, _ = ci_run(FakeCloud(), "--revoke-only", "--execute")
        self.assertEqual(rc, 2)

    def test_a_failed_reread_after_the_removal_fails_the_run(self):
        fake = FakeCloud()
        fake.fail_reads_after_remove = True
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("cannot re-read the bootstrap policy after revoke", err)

    def test_a_failed_removal_is_retried_after_a_reread(self):
        fake = FakeCloud()
        fake.fail_remove = 1
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)
        self.assertEqual(len(fake.removes), 2)
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_a_concurrently_added_member_survives_and_fails_the_run(self):
        fake = FakeCloud()

        def concurrent(f):
            for binding in f.policy["bindings"]:
                if binding["role"] == "roles/iam.serviceAccountUser":
                    binding["members"].append("user:concurrent@example.com")
            f.policy["etag"] += "y"

        fake.concurrent_once = concurrent
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1, err)  # the grant was not granted by this run, so the run refuses
        self.assertIn("user:concurrent@example.com on roles/iam.serviceAccountUser", err)
        self.assertIn("during the revoke window", err)  # the check only sees changes after revoke's first read
        self.assertEqual(len(fake.removes), 2)  # the approved grant was still removed, after the retry
        self.assertIn("user:concurrent@example.com", fake.members())  # not deleted by the run
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_a_concurrently_added_binding_survives_and_fails_the_run(self):
        fake = FakeCloud()

        def concurrent(f):
            f.policy["bindings"].append({"role": "roles/viewer", "members": ["user:newcomer@example.com"]})
            f.policy["etag"] += "z"

        fake.concurrent_once = concurrent
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1, err)
        self.assertIn("user:newcomer@example.com on roles/viewer", err)
        self.assertIn("during the revoke window", err)

    def test_persistent_failure_stops_at_the_attempt_limit(self):
        fake = FakeCloud()
        fake.fail_remove = 100
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertEqual(len(fake.removes), bootstrap.REVOKE_ATTEMPTS)
        self.assertIn("still present after revoke", err)

    def test_lookalikes_are_never_touched(self):
        fake = FakeCloud()
        same_subject_other_project = (f"principal://iam.googleapis.com/projects/999999999999/locations/global/"
                                      f"workloadIdentityPools/github/subject/repo:{bootstrap.REPO}:environment:han-bootstrap")
        principal_set = (f"principalSet://iam.googleapis.com/projects/999999999999/locations/global/"
                         f"workloadIdentityPools/github/attribute.repository/{bootstrap.REPO}")
        lookalikes = [HAN_POOL_MEMBER, same_subject_other_project, principal_set]
        expression = f"request.time < timestamp('{EXPIRY}')"
        fake.policy["bindings"].append({"role": bootstrap.SIGNIN_ROLE, "members": list(lookalikes),
                                        "condition": {"title": "other-title", "description": "x",
                                                      "expression": expression}})
        fake.policy["bindings"].append({"role": "roles/iam.serviceAccountUser", "members": list(lookalikes),
                                        "condition": {"title": bootstrap.SIGNIN_TITLE, "description": "x",
                                                      "expression": expression}})
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)
        self.assertEqual(len(fake.removes), 1)
        for member in lookalikes:
            self.assertIn(member, fake.members())
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_an_unexpected_holder_is_left_and_the_run_fails(self):
        fake = FakeCloud()
        fake.policy["bindings"].append({"role": "roles/viewer", "members": [bootstrap.BOOTSTRAP_PRINCIPAL]})
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("roles/viewer", err)
        self.assertEqual(len(fake.removes), 1)  # the verified grant is removed; the unexpected one stays
        self.assertTrue(any(b.get("role") == "roles/viewer" and bootstrap.BOOTSTRAP_PRINCIPAL in b["members"]
                            for b in fake.policy["bindings"]))

    def test_an_approved_grant_with_another_member_fails_and_names_it(self):
        fake = FakeCloud()
        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA, members=[bootstrap.BOOTSTRAP_PRINCIPAL, "user:x@example.com"]))
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1, err)  # success would hide a grant that still binds another member
        self.assertIn("user:x@example.com", err)
        self.assertEqual(len(fake.removes), 1)  # the principal was removed; the other member was not touched
        self.assertIn("user:x@example.com", fake.members())
        self.assertFalse(bootstrap.holders(fake.policy))

    def test_a_non_ascii_condition_is_written_verbatim(self):
        fake = FakeCloud()
        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA,
                                         expression="request.time < timestamp('2099-01-01T00:00:00Z') && '\u00e9' != ''"))
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)
        self.assertIn("\u00e9", fake.removal_texts[0])
        self.assertNotIn("\\u00e9", fake.removal_texts[0])  # ensure_ascii would have escaped it

    def test_a_conditional_role_the_reader_does_not_model_is_refused(self):
        fake = FakeCloud()
        fake.policy["bindings"].append({"role": "roles/x_withcond_abc123", "members": ["user:y@example.com"]})
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("_withcond_", err)
        self.assertEqual(fake.removes, [])



class PrincipalCoverage(unittest.TestCase):
    """What revoke removes and what it leaves, judged on the principal's effective coverage."""

    def remaining_roles(self, fake: FakeCloud) -> list[str]:
        return [b.get("role") for b in fake.policy["bindings"]
                if bootstrap.BOOTSTRAP_PRINCIPAL in b.get("members", [])]

    def test_no_binding_passes_and_removes_nothing(self):
        fake = FakeCloud()
        fake.policy["bindings"] = [{"role": "roles/iam.serviceAccountUser", "members": ["user:someone@example.com"]}]
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)
        self.assertEqual(fake.removes, [])
        self.assertEqual(fake.members(), ["user:someone@example.com"])

    def test_no_binding_refuses_an_execute_before_any_write(self):
        fake = FakeCloud()
        fake.policy["bindings"] = [{"role": "roles/iam.serviceAccountUser", "members": ["user:someone@example.com"]}]
        rc, _, err = ci_run(fake, *execute_args())
        self.assertEqual(rc, 1, err)
        self.assertIn("expected exactly one", err)
        self.assertEqual(fake.writes, [])

    def test_an_unconditional_binding_is_left_and_the_run_fails(self):
        fake = FakeCloud()
        fake.policy["bindings"].append({"role": bootstrap.SIGNIN_ROLE, "members": [bootstrap.BOOTSTRAP_PRINCIPAL]})
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("still present after revoke", err)
        self.assertEqual(len(fake.removes), 1)  # only the verified grant was removed
        self.assertEqual(self.remaining_roles(fake), [bootstrap.SIGNIN_ROLE])

    def test_an_unconditional_binding_alone_is_left_and_nothing_is_removed(self):
        fake = FakeCloud()
        fake.policy["bindings"] = [{"role": bootstrap.SIGNIN_ROLE, "members": [bootstrap.BOOTSTRAP_PRINCIPAL]}]
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertEqual(fake.removes, [])
        self.assertEqual(self.remaining_roles(fake), [bootstrap.SIGNIN_ROLE])

    def test_a_grant_for_another_commit_survives_and_the_run_fails(self):
        """Two otherwise valid grants. Revoke names only the approved commit and plan, so the other stays."""
        other = f"han-bootstrap commit={'c' * 40} plan={'d' * 64}"
        fake = FakeCloud()
        fake.policy["bindings"].append({"role": "roles/viewer", "members": ["user:v@example.com"]})
        fake.policy["bindings"].append(sign_in_binding(
            DEFAULT_PLAN_SHA, description=other, expression="request.time < timestamp('2026-11-05T11:45:00Z')"))
        rc, _, err = ci_run(fake, *REVOKE_ARGS)  # approves TEST_COMMIT and DEFAULT_PLAN_SHA
        self.assertEqual(rc, 1, err)
        self.assertIn("still present after revoke", err)
        self.assertEqual(len(fake.removes), 1)  # only the approved grant was removed
        survivors = [b for b in fake.policy["bindings"] if bootstrap.BOOTSTRAP_PRINCIPAL in b.get("members", [])]
        self.assertEqual([b["condition"]["description"] for b in survivors], [other])
        self.assertIn("user:v@example.com", fake.members())
        self.assertIn("user:someone@example.com", fake.members())

    def test_a_revoke_for_another_commit_and_plan_refuses_and_removes_nothing(self):
        """Revoke-only names the run's own commit and plan. A pair naming another grant refuses before any call."""
        other = f"han-bootstrap commit={'c' * 40} plan={'d' * 64}"
        fake = FakeCloud()
        fake.policy["bindings"].append(sign_in_binding(
            DEFAULT_PLAN_SHA, description=other, expression="request.time < timestamp('2026-11-05T11:45:00Z')"))
        rc, _, err = ci_run(fake, "--revoke-only", "--expect-sha256", "d" * 64, "--expect-commit", "c" * 40)
        self.assertEqual(rc, 2, err)
        self.assertIn("nothing ran", err)
        self.assertEqual(fake.argv_seen, [])
        self.assertEqual(len(bootstrap.holders(fake.policy)), 2)

    def test_a_revoke_for_a_plan_this_checkout_does_not_compute_refuses_before_any_call(self):
        fake = FakeCloud()
        rc, _, err = ci_run(fake, "--revoke-only", "--expect-sha256", "e" * 64, "--expect-commit", TEST_COMMIT)
        self.assertEqual(rc, 2, err)
        self.assertIn("computes plan hash", err)
        self.assertIn("han-signin-retire", err)  # recovery is the website's retire job, not a rerun of this one
        self.assertEqual(fake.argv_seen, [])
        self.assertEqual(len(bootstrap.holders(fake.policy)), 1)  # the grant is untouched

    def test_a_grant_with_the_same_commit_and_another_plan_survives(self):
        fake = FakeCloud()
        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA, description=f"han-bootstrap commit={TEST_COMMIT} plan={'e' * 64}"))
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1, err)
        self.assertEqual(fake.removes, [])

    def test_revoke_only_without_the_approved_commit_and_plan_refuses_before_any_call(self):
        fake = FakeCloud()
        rc, _, err = ci_run(fake, "--revoke-only")
        self.assertEqual(rc, 2)
        self.assertIn("--expect-sha256", err)
        self.assertEqual(fake.argv_seen, [])

    def test_malformed_approved_values_refuse_before_any_call(self):
        for args in (["--expect-sha256", "ABC", "--expect-commit", TEST_COMMIT],
                     ["--expect-sha256", DEFAULT_PLAN_SHA, "--expect-commit", "main"]):
            with self.subTest(args=args):
                fake = FakeCloud()
                rc, _, err = ci_run(fake, "--revoke-only", *args)
                self.assertEqual(rc, 2, err)
                self.assertEqual(fake.argv_seen, [])

    def test_two_grants_refuse_an_execute_and_keep_unrelated_bindings(self):
        fake = FakeCloud()
        fake.policy["bindings"].append(sign_in_binding(
            DEFAULT_PLAN_SHA, description=f"han-bootstrap commit={'c' * 40} plan={'d' * 64}"))
        rc, _, err = ci_run(fake, *execute_args())
        self.assertEqual(rc, 1, err)
        self.assertIn("expected exactly one", err)
        self.assertTrue(all("remove-iam-policy-binding" in a for a in fake.writes), fake.writes)
        self.assertEqual(len(self.remaining_roles(fake)), 1)  # the grant for another commit survives
        self.assertIn("user:someone@example.com", fake.members())


class CapableMembers(unittest.TestCase):
    """A member that could match the principal without naming it is never deleted; the run fails on it."""

    def add(self, fake: FakeCloud, member: str, role: str = "roles/viewer") -> None:
        fake.policy["bindings"].append({"role": role, "members": [member]})

    def test_a_shared_pool_principal_set_is_left_and_the_run_fails(self):
        fake = FakeCloud()
        member = f"principalSet://iam.googleapis.com/{bootstrap.SHARED_POOL}/attribute.repository/{bootstrap.REPO}"
        self.add(fake, member, bootstrap.SIGNIN_ROLE)
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("could still match", err)
        self.assertIn(member, fake.members())
        self.assertEqual(len(fake.removes), 1)  # the verified grant was removed, the capable member was not

    def test_all_users_is_left_and_the_run_fails(self):
        fake = FakeCloud()
        self.add(fake, "allUsers")
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("allUsers", fake.members())

    def test_all_authenticated_users_is_left_and_the_run_fails(self):
        fake = FakeCloud()
        self.add(fake, "allAuthenticatedUsers")
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("allAuthenticatedUsers", fake.members())

    def test_a_principal_set_over_another_project_does_not_count(self):
        fake = FakeCloud()
        self.add(fake, "principalSet://iam.googleapis.com/projects/999999999999/locations/global/"
                       "workloadIdentityPools/github/attribute.repository/x")
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)

    def test_an_execute_refuses_a_capable_member_before_any_write_and_keeps_it(self):
        fake = FakeCloud()
        self.add(fake, "allUsers")
        rc, _, err = ci_run(fake, *execute_args())
        self.assertEqual(rc, 1, err)
        self.assertIn("could match", err)
        self.assertTrue(all("remove-iam-policy-binding" in a for a in fake.writes), fake.writes)
        self.assertIn("allUsers", fake.members())


class PolicyReadRetry(unittest.TestCase):
    def test_transient_policy_reads_are_retried_with_bounded_backoff(self):
        fake = FakeCloud()
        fake.policy_read_failures = 2
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 0, err)
        self.assertEqual(SLEEPS, [1.0, 2.0])
        self.assertEqual(len(fake.removes), 1)
        self.assertEqual(fake.members(), ["user:someone@example.com"])

    def test_a_persistent_policy_read_failure_stops_within_the_attempt_limit(self):
        fake = FakeCloud()
        fake.policy_read_failures = 10 ** 6
        rc, _, err = ci_run(fake, *REVOKE_ARGS)
        self.assertEqual(rc, 1)
        self.assertIn("cannot prove the sign-in is revoked", err)
        self.assertEqual(len(SLEEPS), bootstrap.POLICY_READ_ATTEMPTS - 1)
        self.assertLessEqual(max(SLEEPS), bootstrap.POLICY_READ_MAX_BACKOFF)
        self.assertEqual(fake.removes, [])


class FlagsAreCaptured(unittest.TestCase):
    """Every gcloud flag the bootstrap passes is one the installed gcloud accepts."""

    def captured_key(self, argv: list[str]) -> str:
        words = argv[1:]
        matches = [k for k in CAPTURED_FLAGS if words[: len(k.split())] == k.split()]
        self.assertTrue(matches, f"no captured help for: {' '.join(argv)}")
        return max(matches, key=lambda k: len(k.split()))

    def test_every_command_the_bootstrap_runs_has_captured_help_and_flags(self):
        fake = FakeCloud()
        execute(fake)
        for argv in fake.writes + fake.reads:
            self.assertEqual(argv[0], "gcloud", argv)
            accepted = set(CAPTURED_FLAGS[self.captured_key(argv)]) | {"quiet"}
            for token in argv:
                if token.startswith("--"):
                    flag = token[2:].split("=", 1)[0]
                    self.assertIn(flag, accepted, f"{' '.join(argv[:4])} does not accept --{flag}")


class StateBucketIsOneName(unittest.TestCase):
    def test_the_infra_workflow_names_the_bootstrap_bucket(self):
        infra = (ROOT / ".github" / "workflows" / "han-infra.yml").read_text(encoding="utf-8")
        self.assertEqual(infra.count(f'-backend-config="bucket={bootstrap.STATE_BUCKET}"'), 2)
        self.assertNotIn("HAN_GCP_PROJECT_ID }}-tfstate", infra)


class TerraformAgreesWithTheBootstrap(unittest.TestCase):
    def tf(self, name: str) -> str:
        return (ROOT / "deploy" / "firebase" / "terraform" / name).read_text(encoding="utf-8")

    def test_database_settings_match(self):
        self.assertIn(f'default     = "{bootstrap.SQL_TIER}"', self.tf("variables.tf"))
        self.assertIn('database_version    = "POSTGRES_16"', self.tf("database.tf"))
        self.assertIn(f'ssl_mode     = "{bootstrap.SQL_SSL_MODE}"', self.tf("database.tf"))
        self.assertEqual(bootstrap.SQL_EDITION.upper(), "ENTERPRISE")

    def test_the_secret_prefix_matches(self):
        self.assertIn(f'secret_prefix = "{bootstrap.SECRET_PREFIX}"', self.tf("main.tf"))

    def test_terraform_creates_no_secret_and_no_secret_iam(self):
        text = "".join(p.read_text(encoding="utf-8") for p in (ROOT / "deploy/firebase/terraform").glob("*.tf"))
        self.assertNotRegex(text, r'resource\s+"google_secret_manager_secret"\s')
        self.assertNotRegex(text, r'resource\s+"google_secret_manager_secret_iam')

    def test_terraform_reads_only_the_two_secrets_it_writes(self):
        text = self.tf("secrets.tf")
        for name in bootstrap.TF_MANAGED_SECRETS:
            self.assertIn(f'"${{local.secret_prefix}}{name}"', text)
        self.assertEqual(len(re.findall(r'data\s+"google_secret_manager_secret"', text)),
                         len(bootstrap.TF_MANAGED_SECRETS))

    def test_the_provider_schema_has_every_attribute_terraform_uses(self):
        resources = SCHEMA["resources"]
        self.assertIn("invoker_iam_disabled", resources["google_cloud_run_v2_service"])
        self.assertIn("secret_data_wo_version", resources["google_secret_manager_secret_version"])
        self.assertIn("settings.deletion_protection_enabled", resources["google_sql_database_instance"])
        self.assertIn("settings.edition", resources["google_sql_database_instance"])
        self.assertIn("settings.ip_configuration.ssl_mode", resources["google_sql_database_instance"])
        self.assertIn("deletion_protection", resources["google_sql_database_instance"])

    def test_terraform_imports_the_instance_and_service_by_provider_id(self):
        self.assertIn('id = "projects/${var.project_id}/instances/han-pg"', self.tf("database.tf"))
        self.assertIn('id = "projects/${var.project_id}/locations/${var.region}/services/han-server"',
                      self.tf("cloudrun.tf"))


class RoleFiles(unittest.TestCase):
    def permissions(self, name: str) -> set[str]:
        body = (BOOT_DIR / "roles" / name).read_text(encoding="utf-8").split("includedPermissions:", 1)[1]
        return {line[2:].strip() for line in body.splitlines() if line.startswith("- ")}

    def test_the_role_files_are_exactly_the_ones_the_bootstrap_creates(self):
        on_disk = {p.name for p in (BOOT_DIR / "roles").glob("*.yaml")}
        self.assertEqual(on_disk, set(bootstrap.CUSTOM_ROLES.values()))

    def test_the_apply_secret_role_cannot_change_iam_or_read_payloads(self):
        perms = self.permissions("han_tf_apply_secrets.yaml")
        for forbidden in ("secretmanager.secrets.setIamPolicy", "secretmanager.secrets.getIamPolicy",
                          "secretmanager.secrets.create", "secretmanager.secrets.delete",
                          "secretmanager.versions.access"):
            self.assertNotIn(forbidden, perms)

    def test_the_plan_secret_role_is_read_only_without_iam(self):
        for perm in self.permissions("han_tf_plan_secrets.yaml"):
            self.assertTrue(perm.rsplit(".", 1)[-1].startswith(("get", "list")), perm)

    def test_the_apply_sql_role_cannot_create_instances(self):
        self.assertNotIn("cloudsql.instances.create", self.permissions("han_tf_apply_sql.yaml"))


class HostingSiteCreation(unittest.TestCase):
    """The Hosting deploy job creates only missing sites, from the CLI's JSON list."""

    def load(self):
        spec2 = importlib.util.spec_from_file_location(
            "ensure_hosting_sites", ROOT / "deploy" / "firebase" / "scripts" / "ensure_hosting_sites.py")
        mod = importlib.util.module_from_spec(spec2)
        spec2.loader.exec_module(mod)
        return mod

    def fake(self, existing: set[str], list_rc: int = 0, create_rc: int = 0):
        calls: list[list[str]] = []

        class Proc:
            def __init__(self, rc, out="", err=""):
                self.returncode, self.stdout, self.stderr = rc, out, err

        def run_firebase(args):
            calls.append(args)
            if args[0] == "hosting:sites:list":
                sites = [{"name": f"projects/911514101920/sites/{s}"} for s in existing]
                return Proc(list_rc, json.dumps({"status": "success", "result": {"sites": sites}}), "list failed")
            return Proc(create_rc, "", "create failed")

        return run_firebase, calls

    def test_creates_only_the_missing_sites(self):
        mod = self.load()
        run_fb, calls = self.fake({"han-guru-app"})
        created = mod.ensure("thebushido-co", run_fb)
        self.assertEqual(set(created), {"han-guru-dashboard", "han-guru-api"})
        creates = [c for c in calls if c[0] == "hosting:sites:create"]
        self.assertEqual(sorted(c[1] for c in creates), ["han-guru-api", "han-guru-dashboard"])
        self.assertTrue(all("--project" in c and "thebushido-co" in c for c in creates))

    def test_a_failed_list_stops_before_any_create(self):
        mod = self.load()
        run_fb, calls = self.fake(set(), list_rc=1)
        with self.assertRaises(RuntimeError):
            mod.ensure("thebushido-co", run_fb)
        self.assertFalse(any(c[0] == "hosting:sites:create" for c in calls))

    def test_a_failed_create_is_an_error(self):
        mod = self.load()
        run_fb, _ = self.fake(set(), create_rc=1)
        with self.assertRaises(RuntimeError):
            mod.ensure("thebushido-co", run_fb)


class DatabasePasswordSequence(unittest.TestCase):
    """The bootstrap creates the han user and seeds database-url with its password.

    These run the real sequence against the fake, which models the user, the versions and the
    labels. The password is checked as it is handed to gcloud (flags file and stdin), never
    as text in an argument, a plan, an output or an artifact.
    """

    def setUp(self):
        self.fake = FakeCloud()
        self.rc, self.out, self.err = execute(self.fake)
        self.assertEqual(self.rc, 0, self.err)

    def test_a_fresh_run_creates_the_user_and_seeds_database_url_with_its_password(self):
        self.assertIn("han", self.fake.db_users)
        self.assertIn("han_team", self.fake.databases)
        self.assertEqual(self.fake.enabled_password(bootstrap.DB_SECRET), self.fake.db_users["han"])
        self.assertEqual(self.fake.labels[bootstrap.DB_SECRET][bootstrap.PW_LABEL], bootstrap.PW_READY)
        self.assertTrue(any(a[1:4] == ["sql", "users", "create"] for a in self.fake.argv_seen))

    def test_the_password_never_appears_in_argv_plan_or_output(self):
        password = self.fake.db_users["han"]
        argv_text = "\n".join(" ".join(a) for a in self.fake.argv_seen)
        plan_text = "\n".join(bootstrap.build_plan(False) + bootstrap.build_plan(True))
        for label, text in (("argv", argv_text), ("plan", plan_text), ("stdout", self.out), ("stderr", self.err)):
            self.assertNotIn(password, text, label)
            self.assertNotIn("postgres://", text, label)
            self.assertNotIn("--password", text.replace("--password-policy", ""), label)

    def test_the_password_reaches_gcloud_only_through_a_private_flags_file_and_stdin(self):
        self.assertEqual(len(self.fake.flag_files), 1)
        entry = self.fake.flag_files[0]
        self.assertEqual(entry["mode"], 0o600)
        self.assertEqual(entry["password"], self.fake.db_users["han"])
        self.assertTrue(any(p.startswith("postgres://han:") for p in self.fake.stdin_payloads))
        self.assertFalse(any(entry["password"] in " ".join(a) for a in self.fake.argv_seen))

    def test_the_flags_file_and_its_directory_are_removed_after_the_call(self):
        entry = self.fake.flag_files[0]
        self.assertFalse(Path(entry["path"]).exists())
        self.assertFalse(Path(entry["path"]).parent.exists())

    def test_the_database_is_created_before_the_user_and_the_secret(self):
        order = [a[1:4] for a in self.fake.argv_seen if a[1] in ("sql", "secrets")]
        db = order.index(["sql", "databases", "create"])
        user = order.index(["sql", "users", "create"])
        version = order.index(["secrets", "versions", "add"])
        self.assertLess(db, user)
        self.assertLess(user, version)

    def test_a_rerun_changes_nothing_when_user_version_and_label_agree(self):
        users = dict(self.fake.db_users)
        versions = len(self.fake.versions[bootstrap.DB_SECRET])
        flag_files = len(self.fake.flag_files)
        rc, _, err = execute(self.fake)
        self.assertEqual(rc, 0, err)
        self.assertEqual(self.fake.db_users, users)
        self.assertEqual(len(self.fake.versions[bootstrap.DB_SECRET]), versions)
        self.assertEqual(len(self.fake.flag_files), flag_files)

    def test_rotation_gives_a_new_password_and_the_new_version_matches_it(self):
        old = self.fake.db_users["han"]
        rc, _, err = execute(self.fake, rotate=True)
        self.assertEqual(rc, 0, err)
        new = self.fake.db_users["han"]
        self.assertNotEqual(new, old)
        self.assertEqual(self.fake.enabled_password(bootstrap.DB_SECRET), new)
        self.assertTrue(any(a[1:4] == ["sql", "users", "set-password"] for a in self.fake.argv_seen))

    def test_rotation_changes_the_plan_so_its_hash_covers_it(self):
        self.assertNotEqual(bootstrap.plan_sha256(bootstrap.build_plan(False)),
                            bootstrap.plan_sha256(bootstrap.build_plan(True)))

    def test_a_failed_secret_write_is_repaired_by_the_next_run(self):
        fake = FakeCloud()
        fake.fail_write = "versions add"
        rc, _, _ = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("han", fake.db_users)  # the user write happened first
        self.assertEqual(fake.enabled_password(bootstrap.DB_SECRET), None)
        self.assertEqual(fake.labels[bootstrap.DB_SECRET][bootstrap.PW_LABEL], bootstrap.PW_PENDING)
        fake.fail_write = None
        before = len(fake.argv_seen)
        rc, _, err = execute(fake)
        self.assertEqual(rc, 0, err)
        rerun = fake.argv_seen[before:]
        self.assertTrue(any(a[1:4] == ["sql", "users", "set-password"] for a in rerun))
        self.assertFalse(any(a[1:4] == ["sql", "users", "create"] for a in rerun))
        self.assertEqual(fake.enabled_password(bootstrap.DB_SECRET), fake.db_users["han"])
        self.assertEqual(fake.labels[bootstrap.DB_SECRET][bootstrap.PW_LABEL], bootstrap.PW_READY)

    def test_a_failed_user_create_writes_no_secret_and_the_rerun_creates_the_user(self):
        fake = FakeCloud()
        fake.fail_write = "users create"
        rc, _, _ = execute(fake)
        self.assertEqual(rc, 1)
        self.assertEqual(fake.versions.get(bootstrap.DB_SECRET, []), [])
        self.assertEqual(fake.labels[bootstrap.DB_SECRET][bootstrap.PW_LABEL], bootstrap.PW_PENDING)
        fake.fail_write = None
        rc, _, err = execute(fake)
        self.assertEqual(rc, 0, err)
        self.assertEqual(fake.enabled_password(bootstrap.DB_SECRET), fake.db_users["han"])

    def test_postcheck_refuses_a_secret_that_is_not_marked_ready(self):
        self.fake.labels[bootstrap.DB_SECRET][bootstrap.PW_LABEL] = bootstrap.PW_PENDING
        with self.assertRaises(bootstrap.StepError) as ctx:
            bootstrap.database_postcheck(bootstrap.Runner(execute=True, backend=self.fake))
        self.assertIn("not marked", str(ctx.exception))

    def test_postcheck_refuses_a_missing_user(self):
        del self.fake.db_users["han"]
        with self.assertRaises(bootstrap.StepError) as ctx:
            bootstrap.database_postcheck(bootstrap.Runner(execute=True, backend=self.fake))
        self.assertIn("user han is missing", str(ctx.exception))

    def test_the_plan_has_the_password_destination_and_no_value(self):
        text = "\n".join(bootstrap.build_plan(False))
        self.assertIn("never in argv", text)
        self.assertIn(bootstrap.DB_SECRET, text)
        self.assertNotIn("postgres://", text)

    def test_a_gcloud_error_that_echoes_the_password_is_not_surfaced(self):
        fake = FakeCloud()
        original = fake._write
        seen: list[str] = []

        def echo(argv, stdin=None):
            if argv[1:3] == ["sql", "users"] and "create" in argv:
                flags = next(a.split("=", 1)[1] for a in argv if a.startswith("--flags-file="))
                seen.append(json.loads(Path(flags).read_text(encoding="utf-8"))["--password"])
                return 1, "", f"ERROR: could not set {seen[-1]}"
            return original(argv, stdin)

        fake._write = echo
        rc, out, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertEqual(len(seen), 1)
        self.assertNotIn(seen[0], out + err)
        self.assertNotIn(seen[0], "\n".join(" ".join(a) for a in fake.argv_seen))


class CloudSdkFileLoggingIsOff(unittest.TestCase):
    """gcloud's per-run debug log records argument values, including values read from a flags
    file. The bootstrap runs every gcloud call with that log turned off. The locally measured
    effect is in real_backend's comment and in PATH.md section 5."""

    def test_real_backend_sets_the_variable_and_passes_stdin(self):
        import subprocess
        from unittest import mock

        seen: dict = {}

        def fake_run(argv, **kwargs):
            seen.update(kwargs)
            seen["argv"] = argv
            return subprocess.CompletedProcess(argv, 0, "", "")

        with mock.patch.object(bootstrap.subprocess, "run", side_effect=fake_run):
            bootstrap.real_backend("write", ["gcloud", "version"], "payload")
        self.assertEqual(seen["env"]["CLOUDSDK_CORE_DISABLE_FILE_LOGGING"], "1")
        self.assertEqual(seen["input"], "payload")
        self.assertEqual(seen["argv"], ["gcloud", "version"])

    def test_the_variable_is_set_even_when_the_caller_has_none(self):
        import subprocess
        from unittest import mock

        seen: dict = {}

        def fake_run(argv, **kwargs):
            seen.update(kwargs)
            return subprocess.CompletedProcess(argv, 0, "", "")

        with mock.patch.dict(os.environ, {}, clear=False), mock.patch.object(bootstrap.subprocess, "run", side_effect=fake_run):
            os.environ.pop("CLOUDSDK_CORE_DISABLE_FILE_LOGGING", None)
            bootstrap.real_backend("read", ["gcloud", "version"])
        self.assertEqual(seen["env"]["CLOUDSDK_CORE_DISABLE_FILE_LOGGING"], "1")


class CiOnly(unittest.TestCase):
    """--execute and --revoke-only run only from the reviewed workflow. Anything else stops before a call."""

    def test_each_required_variable_stops_the_run_before_any_call(self):
        for key in bootstrap.CI_ENVIRONMENT:
            for forged in (None, "forged"):
                for args in (execute_args(), ["--revoke-only"]):
                    with self.subTest(key=key, forged=forged, mode=args[0]):
                        fake = FakeCloud()
                        with ci_env(**{key: forged}):
                            rc, _, err = run(fake, *args)
                        self.assertEqual(rc, 2, err)
                        self.assertEqual(fake.argv_seen, [])

    def test_a_commit_that_is_not_a_commit_stops_the_run(self):
        fake = FakeCloud()
        with ci_env(GITHUB_SHA="main"):
            rc, _, _ = run(fake, "--revoke-only")
        self.assertEqual(rc, 2)
        self.assertEqual(fake.argv_seen, [])

    def test_plan_mode_runs_outside_ci(self):
        with ci_env(GITHUB_ACTIONS=None):
            rc, out, _ = run(None)
        self.assertEqual(rc, 0)
        self.assertIn("plan-sha256:", out)


class SignInProvenance(unittest.TestCase):
    """Preflight refuses, before the first step, any sign-in that is not exactly the reviewed grant."""

    def refused(self, fake: FakeCloud, now: datetime = NOW, expect: str = "nothing ran") -> None:
        rc, _, err = ci_run(fake, *execute_args(), now=now)
        self.assertEqual(rc, 1, err)
        self.assertIn(expect, err)
        # No step ran: the only write allowed is the revoke that removes the approved grant.
        self.assertTrue(all("remove-iam-policy-binding" in a for a in fake.writes), fake.writes)
        # F: the authorised grant (this role, this title, the approved description, the principal) is removed
        # on refusal. A holder that differs in role or title is not that grant and is not asserted absent here.
        approved = bootstrap.SIGNIN_DESCRIPTION.format(commit=TEST_COMMIT, plan=DEFAULT_PLAN_SHA, run=TEST_RUN)
        self.assertFalse(any(b.get("role") == bootstrap.SIGNIN_ROLE
                             and (b.get("condition") or {}).get("title") == bootstrap.SIGNIN_TITLE
                             and (b.get("condition") or {}).get("description") == approved
                             and bootstrap.BOOTSTRAP_PRINCIPAL in b.get("members", [])
                             for b in fake.policy["bindings"]))

    def test_the_grant_proceeds_at_both_window_edges(self):
        for lead in (timedelta(minutes=45), timedelta(minutes=120)):
            with self.subTest(lead=lead):
                fake = FakeCloud()
                rc, _, err = execute(fake, now=EXPIRY_AT - lead)
                self.assertEqual(rc, 0, err)

    def test_a_grant_outside_the_window_is_refused(self):
        for now in (EXPIRY_AT - timedelta(minutes=44, seconds=59),
                    EXPIRY_AT - timedelta(minutes=120, seconds=1),
                    EXPIRY_AT + timedelta(minutes=1)):
            with self.subTest(now=now):
                fake = FakeCloud()
                rc, _, err = ci_run(fake, *execute_args(), now=now)
                self.assertEqual(rc, 2)
                self.assertIn("window", err)
                self.assertEqual(fake.reads + fake.writes, [])
                # The separate preflight independently enforces its own window.
                with mock.patch.object(bootstrap, "utc_now", return_value=now):
                    with self.assertRaises(bootstrap.StepError):
                        bootstrap.preflight(bootstrap.Runner(execute=True, backend=FakeCloud()), DEFAULT_PLAN_SHA, TEST_COMMIT)

    def test_a_grant_that_names_another_commit_or_plan_is_refused(self):
        for description in (f"han-bootstrap commit={'a' * 40} plan={DEFAULT_PLAN_SHA} run={TEST_RUN} attempt=1",
                            f"han-bootstrap commit={TEST_COMMIT} plan={'b' * 64} run={TEST_RUN} attempt=1"):
            with self.subTest(description=description):
                fake = FakeCloud()
                fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA, description=description))
                self.refused(fake, expect="does not name this commit and this plan")

    def test_a_malformed_description_is_not_the_grant(self):
        fake = FakeCloud()
        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA,
                                         description=f"han-bootstrap commit={TEST_COMMIT} plan={DEFAULT_PLAN_SHA} "))
        self.refused(fake, expect="nothing ran")

    def test_a_tampered_expression_is_refused(self):
        base = f"request.time < timestamp('{EXPIRY}')"
        for expression in (base + " || true",
                           base.replace("<", "<="),
                           base.replace("00Z", "00.500Z"),
                           base.replace("Z')", "')"),
                           base.replace("2026-11-05", "2026-13-05"),
                           base + " && true",
                           base + " "):
            with self.subTest(expression=expression):
                fake = FakeCloud()
                fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA, expression=expression))
                self.refused(fake)

    def test_a_second_holder_of_the_principal_is_refused(self):
        fake = FakeCloud()
        fake.policy["bindings"].append(sign_in_binding(DEFAULT_PLAN_SHA, title="another-title"))
        self.refused(fake, expect="expected exactly one")
        # The other-title binding is not the authorised grant, so revoke leaves it in place.
        survivors = [b for b in fake.policy["bindings"] if bootstrap.BOOTSTRAP_PRINCIPAL in b.get("members", [])]
        self.assertEqual([(b["role"], b["condition"]["title"]) for b in survivors],
                         [(bootstrap.SIGNIN_ROLE, "another-title")])

    def test_a_lookalike_member_is_not_the_grant(self):
        fake = FakeCloud()
        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA, members=[HAN_POOL_MEMBER]))
        self.refused(fake, expect="expected exactly one")


class StateBucketIsOurs(unittest.TestCase):
    """No bucket is created, updated or granted unless the guard proves it is exactly ours."""

    def fake_with_foreign_bucket(self) -> FakeCloud:
        fake = FakeCloud()
        fake.foreign_buckets.add(bootstrap.STATE_BUCKET)  # the name exists, in another project
        return fake

    def assert_no_bucket_change(self, fake: FakeCloud) -> None:
        self.assertEqual(fake.foreign_mutations, [])
        self.assertFalse(any(bootstrap.STATE_BUCKET in " ".join(a) for a in fake.writes), fake.writes)

    def run_overridden(self, fake: FakeCloud, override) -> tuple[int, str, str]:
        """Run the plan against the fake, except where override returns an answer for a read."""
        def backend(kind, argv, stdin=None):
            if kind == "read":
                answer = override(argv)
                if answer is not None:
                    return answer
            return fake(kind, argv, stdin)

        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA))
        with ci_env():
            return run(backend, *execute_args())

    def test_a_foreign_bucket_of_the_same_name_is_never_mutated(self):
        fake = self.fake_with_foreign_bucket()
        rc, _, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("exists outside", err)
        self.assert_no_bucket_change(fake)

    def test_an_ambiguous_listing_stops_before_any_bucket_change(self):
        def listing(argv):
            if argv[1:4] == ["storage", "buckets", "list"]:
                return 0, json.dumps([{"name": bootstrap.STATE_BUCKET}, {"name": bootstrap.STATE_BUCKET}]), ""
            return None

        fake = FakeCloud()
        fake.objects.add(("storage buckets", bootstrap.STATE_BUCKET))
        rc, _, err = self.run_overridden(fake, listing)
        self.assertEqual(rc, 1)
        self.assertIn("ambiguous", err)
        self.assert_no_bucket_change(fake)

    def test_a_failed_or_malformed_listing_stops_before_any_bucket_change(self):
        def failing(argv):
            if argv[1:4] == ["storage", "buckets", "list"]:
                return 1, "", "ERROR: (gcloud) PERMISSION_DENIED"
            return None

        def malformed(argv):
            if argv[1:4] == ["storage", "buckets", "list"]:
                return 0, "[1, 2]", ""
            return None

        for override, expect in ((failing, "cannot list buckets"), (malformed, "unexpected shape")):
            with self.subTest(expect=expect):
                fake = FakeCloud()
                rc, _, err = self.run_overridden(fake, override)
                self.assertEqual(rc, 1)
                self.assertIn(expect, err)
                self.assert_no_bucket_change(fake)

    def test_a_describe_that_does_not_match_the_owned_bucket_stops_the_run(self):
        owned = {"name": bootstrap.STATE_BUCKET, "uniform_bucket_level_access": True,
                 "public_access_prevention": "enforced", "versioning_enabled": True}
        cases = (
            ({**owned, "name": "some-other-bucket"}, "not touched"),
            ({**owned, "uniform_bucket_level_access": False}, "uniform bucket-level access"),
            ({**owned, "public_access_prevention": "inherited"}, "public access prevention"),
        )
        for described, expect in cases:
            with self.subTest(expect=expect):
                fake = FakeCloud()
                fake.objects.add(("storage buckets", bootstrap.STATE_BUCKET))

                def describe(argv, described=described):
                    if argv[1:4] == ["storage", "buckets", "describe"]:
                        return 0, json.dumps(described), ""
                    return None

                rc, _, err = self.run_overridden(fake, describe)
                self.assertEqual(rc, 1)
                self.assertIn(expect, err)
                self.assert_no_bucket_change(fake)

    def test_every_bucket_change_follows_a_guard_read(self):
        fake = FakeCloud()
        rc, _, err = execute(fake)
        self.assertEqual(rc, 0, err)
        changes = [i for i, (kind, a) in enumerate(fake.events)
                   if kind == "write" and bootstrap.STATE_BUCKET in " ".join(a)]
        guards = [i for i, (kind, a) in enumerate(fake.events)
                  if kind == "read" and a[1:4] == ["storage", "buckets", "list"]]
        self.assertGreaterEqual(len(changes), 3)
        for change in changes:
            self.assertTrue(any(g < change for g in guards), change)
        # The grants are preceded by their own guard, after the update.
        self.assertTrue(any(changes[-3] < g < changes[-2] for g in guards), (changes, guards))

    def test_an_existing_owned_bucket_is_not_created_again(self):
        fake = FakeCloud()
        fake.objects.add(("storage buckets", bootstrap.STATE_BUCKET))
        rc, _, err = execute(fake)
        self.assertEqual(rc, 0, err)
        self.assertFalse(any(a[1:3] == ["storage", "buckets"] and "create" in a for a in fake.writes))


class ExecutionBoundary(unittest.TestCase):
    def test_wrong_provider_refuses_before_resource_mutation(self):
        fake = FakeCloud()
        original_read = fake._read
        def changed(argv):
            rc, out, err = original_read(argv)
            if argv[1:6] == ["iam", "workload-identity-pools", "providers", "describe", "github"]:
                provider = json.loads(out)
                provider["attributeCondition"] = "true"
                return 0, json.dumps(provider), ""
            return rc, out, err
        fake._read = changed
        rc, _, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("provider", err)
        self.assertTrue(all("remove-iam-policy-binding" in a for a in fake.writes))

    def test_uploaded_keys_and_sibling_provider_refuse_before_resource_mutation(self):
        for threat in ("uploaded_keys", "sibling_provider"):
            with self.subTest(threat=threat):
                fake = FakeCloud()
                original_read = fake._read
                def changed(argv):
                    rc, out, err = original_read(argv)
                    if threat == "uploaded_keys" and argv[1:6] == ["iam", "workload-identity-pools", "providers", "describe", "github"]:
                        body = json.loads(out)
                        body["oidc"]["jwksJson"] = '{"keys":[{"kid":"attacker"}]}'
                        return 0, json.dumps(body), ""
                    if threat == "sibling_provider" and argv[1:5] == ["iam", "workload-identity-pools", "providers", "list"]:
                        body = json.loads(out)
                        body.append({"name": bootstrap.ACTIVE_EXECUTION["provider_resource"] + "-attacker"})
                        return 0, json.dumps(body), ""
                    return rc, out, err
                fake._read = changed
                rc, _, err = execute(fake)
                self.assertEqual(rc, 1)
                self.assertIn("provider", err)
                self.assertTrue(all("remove-iam-policy-binding" in a for a in fake.writes))

    def test_attempt_two_refuses_without_cloud_calls(self):
        fake = FakeCloud()
        with ci_env(GITHUB_RUN_ATTEMPT="2"):
            rc, _, err = run(fake, *execute_args())
        self.assertEqual(rc, 2)
        self.assertIn("GITHUB_RUN_ATTEMPT", err)
        self.assertEqual(fake.reads + fake.writes, [])

    def test_unrelated_policy_addition_during_execution_is_detected(self):
        fake = FakeCloud()
        args = execute_args()
        fake.set_sign_in(sign_in_binding(DEFAULT_PLAN_SHA))
        original_steps = bootstrap.steps
        def change_policy(r, rotate):
            if r.execute:
                fake.policy["bindings"].append({"role": "roles/viewer", "members": ["user:unexpected@example.com"]})
            return original_steps(r, rotate)
        with ci_env(), mock.patch.object(bootstrap, "steps", side_effect=change_policy):
            rc, _, err = run(fake, *args)
        self.assertEqual(rc, 1)
        self.assertIn("policy gained grants", err)
        self.assertIn("user:unexpected@example.com", fake.members())


class WorkflowIsAnInput(unittest.TestCase):
    """The workflow that runs the bootstrap is hashed into the plan, as the code and the roles are."""

    WORKFLOW = ROOT / ".github" / "workflows" / "han-bootstrap.yml"

    def test_the_workflow_is_referenced_and_its_content_is_in_the_plan(self):
        self.assertIn(self.WORKFLOW.resolve(), [p.resolve() for p in bootstrap.referenced_files()])
        digest = hashlib.sha256(self.WORKFLOW.read_bytes()).hexdigest()
        self.assertIn(f"input .github/workflows/han-bootstrap.yml sha256 {digest}", bootstrap.build_plan())

    def test_an_edited_workflow_changes_the_plan_hash(self):
        original = bootstrap.build_plan()
        digest = hashlib.sha256(self.WORKFLOW.read_bytes()).hexdigest()
        edited_digest = hashlib.sha256(self.WORKFLOW.read_bytes() + b"# edited\n").hexdigest()
        edited = [line.replace(digest, edited_digest) if line.startswith("input .github/workflows/") else line
                  for line in original]
        self.assertNotEqual(bootstrap.plan_sha256(original), bootstrap.plan_sha256(edited))

    def test_execution_contract_is_hashed_into_both_plans(self):
        path = BOOT_DIR / "execution.py"
        self.assertIn(path.resolve(), [p.resolve() for p in bootstrap.referenced_files()])
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        altered = hashlib.sha256(path.read_bytes() + b"# changed\n").hexdigest()
        for rotate in (False, True):
            plan = bootstrap.build_plan(rotate)
            line = f"input deploy/firebase/bootstrap/execution.py sha256 {digest}"
            self.assertIn(line, plan)
            modified = [item.replace(digest, altered) if item == line else item for item in plan]
            self.assertNotEqual(bootstrap.plan_sha256(plan), bootstrap.plan_sha256(modified))


if __name__ == "__main__":
    unittest.main()
