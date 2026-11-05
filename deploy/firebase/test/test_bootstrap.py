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

    def __init__(self, *, sign_in_member: bool = True) -> None:
        self.objects: set[tuple[str, str]] = set()
        self.reads: list[list[str]] = []
        self.writes: list[list[str]] = []
        self.account = bootstrap.BOOTSTRAP_SA
        self.keys_for: dict[str, str] = {}
        self.fail_write: str | None = None
        self.fail_read: str | None = None
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
            ],
        }
        if sign_in_member:
            self.policy["bindings"].append({
                "role": "roles/iam.workloadIdentityUser",
                "members": [bootstrap.BOOTSTRAP_PRINCIPAL],
                "condition": {"title": "time-boxed",
                              "expression": "request.time < timestamp('2026-11-05T00:00:00Z')"},
            })

    def __call__(self, kind: str, argv: list[str], stdin: str | None = None) -> tuple[int, str, str]:
        self.argv_seen.append(argv)
        if stdin is not None:
            self.stdin_payloads.append(stdin)
        if kind == "read":
            self.reads.append(argv)
            return self._read(argv)
        self.writes.append(argv)
        return self._write(argv, stdin)

    def members(self) -> list[str]:
        return [m for b in self.policy.get("bindings", []) for m in b.get("members", [])]

    def enabled_password(self, secret: str) -> str | None:
        enabled = [v for v in self.versions.get(secret, []) if v["state"] == "ENABLED"]
        return enabled[-1]["password"] if enabled else None

    def _read(self, argv: list[str]) -> tuple[int, str, str]:
        joined = " ".join(argv)
        if self.fail_read and self.fail_read in joined:
            return 1, "", "ERROR: (gcloud) PERMISSION_DENIED: forbidden for this identity."
        if argv[1:3] == ["auth", "list"]:
            return 0, json.dumps([{"account": self.account, "status": "ACTIVE"}]), ""
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
        if key in self.objects:
            if key[0] == "storage buckets":
                return 0, json.dumps({"uniform_bucket_level_access": True,
                                      "public_access_prevention": "enforced",
                                      "versioning_enabled": True}), ""
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
            path = argv[argv.index("set-iam-policy") + 2]
            self.policy = json.loads(Path(path).read_text(encoding="utf-8"))
            return 0, "", ""
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


def run(fake, *args: str) -> tuple[int, str, str]:
    """Run main with a backend (a FakeCloud, or any callable) and capture its output."""
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        rc = bootstrap.main(list(args), backend=fake)
    return rc, out.getvalue(), err.getvalue()


TEST_COMMIT = "0123456789abcdef0123456789abcdef01234567"


def execute(fake: FakeCloud, rotate: bool = False) -> tuple[int, str, str]:
    """Execute the current plan as the run of TEST_COMMIT, the only commit it will accept."""
    previous = os.environ.get("GITHUB_SHA")
    os.environ["GITHUB_SHA"] = TEST_COMMIT
    args = ["--execute", "--expect-sha256", bootstrap.plan_sha256(bootstrap.build_plan(rotate)),
            "--expect-commit", TEST_COMMIT]
    if rotate:
        args.append("--rotate-db-password")
    try:
        return run(fake, *args)
    finally:
        if previous is None:
            os.environ.pop("GITHUB_SHA", None)
        else:
            os.environ["GITHUB_SHA"] = previous


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
        rc, _, err = run(fake, "--execute", "--expect-sha256", "0" * 64)
        self.assertEqual(rc, 2)
        self.assertIn("nothing ran", err)
        self.assertEqual(fake.reads + fake.writes, [])

    def test_execute_without_a_pinned_hash_refuses(self):
        fake = FakeCloud()
        rc, _, err = run(fake, "--execute")
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
        self.assertFalse(any(bootstrap.is_bootstrap_member(m) for m in self.fake.members()))

    def test_other_members_of_the_bootstrap_policy_are_kept(self):
        self.assertIn("user:someone@example.com", self.fake.members())

    def test_no_key_or_project_is_created(self):
        for argv in self.fake.writes:
            self.assertNotIn("keys", argv)
            self.assertFalse(argv[1:3] == ["projects", "create"], argv)

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
        text = " ".join(next(a for a in self.fake.writes if "create-oidc" in a))
        for wf in ("han-infra.yml", "deploy-han-server.yml", "deploy-hosting.yml"):
            self.assertIn(f"workflows/{wf}@", text)
        self.assertNotIn("attribute.environment", text)

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
        self.assertFalse(any(bootstrap.is_bootstrap_member(m) for m in fake.members()))

    def test_the_sign_in_is_removed_when_verification_fails(self):
        fake = FakeCloud()
        fake.account = "someone-else@example.com"
        rc, _, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("refusing", err)
        self.assertFalse(any(bootstrap.is_bootstrap_member(m) for m in fake.members()))

    def test_the_sign_in_is_removed_when_a_han_account_has_a_user_key(self):
        fake = FakeCloud()
        fake.keys_for["han-deployer"] = "abcd1234\n"
        rc, _, err = execute(fake)
        self.assertEqual(rc, 1)
        self.assertIn("user-managed key", err)
        self.assertFalse(any(bootstrap.is_bootstrap_member(m) for m in fake.members()))

    def test_revoke_only_removes_the_sign_in_and_keeps_other_members(self):
        fake = FakeCloud()
        rc, _, _ = run(fake, "--revoke-only")
        self.assertEqual(rc, 0)
        self.assertFalse(any(bootstrap.is_bootstrap_member(m) for m in fake.members()))
        self.assertIn("user:someone@example.com", fake.members())
        self.assertEqual(fake.policy["etag"], "BwYfake")

    def test_revoke_fails_when_the_policy_cannot_be_read(self):
        fake = FakeCloud()
        fake.fail_read = "get-iam-policy"
        rc, _, err = run(fake, "--revoke-only")
        self.assertEqual(rc, 1)
        self.assertIn("cannot prove the sign-in is revoked", err)

    def test_revoke_fails_when_the_member_survives_the_write(self):
        fake = FakeCloud()
        original = fake._write

        def stubborn(argv, stdin=None):
            if "set-iam-policy" in argv:
                return 0, "", ""  # claims success and changes nothing
            return original(argv, stdin)

        fake._write = stubborn
        rc, _, err = run(fake, "--revoke-only")
        self.assertEqual(rc, 1)
        self.assertIn("still present after revoke", err)

    def test_revoke_only_refuses_to_combine_with_execute(self):
        rc, _, _ = run(FakeCloud(), "--revoke-only", "--execute")
        self.assertEqual(rc, 2)

    def test_a_failed_reread_after_the_revoke_fails_the_run(self):
        fake = FakeCloud()
        backend = fake
        reads = {"policy": 0}

        def first_read_ok_then_fail(kind, argv, stdin=None):
            if kind == "read" and "get-iam-policy" in argv:
                reads["policy"] += 1
                if reads["policy"] >= 2:
                    return 1, "", "ERROR: (gcloud) transient failure"
            return backend(kind, argv, stdin)

        rc, _, err = run(first_read_ok_then_fail, "--revoke-only")
        self.assertEqual(rc, 1)
        self.assertIn("cannot re-read the bootstrap policy after revoke", err)

    def test_remove_member_keeps_other_members_of_a_conditional_binding(self):
        policy = {"bindings": [{"role": "r", "members": [bootstrap.BOOTSTRAP_PRINCIPAL, "user:x@y.z"],
                                "condition": {"title": "t", "expression": "e"}}]}
        self.assertTrue(bootstrap.remove_bootstrap_member(policy))
        self.assertEqual(policy["bindings"][0]["members"], ["user:x@y.z"])
        self.assertIn("condition", policy["bindings"][0])


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


if __name__ == "__main__":
    unittest.main()
