"""Behaviour tests for bootstrap/bootstrap.py, against a fake cloud.

The fake records every command and tracks which objects exist, so these tests
check what the bootstrap decides and does, not its text. Nothing reaches Google.

Run: python3 -B -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

BOOT_DIR = Path(__file__).resolve().parents[1] / "bootstrap"
spec = importlib.util.spec_from_file_location("bootstrap_py", BOOT_DIR / "bootstrap.py")
bootstrap = importlib.util.module_from_spec(spec)
sys.modules["bootstrap_py"] = bootstrap
spec.loader.exec_module(bootstrap)


class FakeCloud:
    """Tracks existing objects and records every write.

    A key in `existing` means the object exists. Reads of unknown keys fail, like
    a describe on a missing resource. `bindings` holds IAM subjects that exist.
    """

    def __init__(self, existing=None, active=bootstrap.BOOTSTRAP_SA, user_keys=None):
        self.existing = set(existing or set())
        self.active = active
        self.user_keys = set(user_keys or set())
        self.writes: list[tuple[str | None, list[str]]] = []
        self.reads: list[tuple[str, list[str]]] = []

    def __call__(self, kind, key, argv):
        if kind == "read":
            self.reads.append((key, argv))
            if key == "active-account":
                return 0, self.active + "\n"
            if key and key.startswith("keys:"):
                name = key.split(":", 1)[1]
                return 0, ("key-123\n" if name in self.user_keys else "")
            if key == "bootstrap-binding":
                present = "bootstrap-binding" in self.existing
                payload = {"bindings": [{"role": "roles/iam.workloadIdentityUser",
                                         "members": [bootstrap.BOOTSTRAP_PRINCIPAL] if present else []}]}
                return 0, json.dumps(payload)
            return (0 if key in self.existing else 1), ""
        self.writes.append((key, argv))
        if key:
            self.existing.add(key)
        if "remove-iam-policy-binding" in argv and bootstrap.BOOTSTRAP_SA in argv:
            self.existing.discard("bootstrap-binding")
        if "add-iam-policy-binding" in argv and bootstrap.BOOTSTRAP_SA in argv:
            pass
        return 0, ""

    def argv_texts(self):
        return [" ".join(argv) for _, argv in self.writes]


def first_run_state() -> set[str]:
    # The one grant a human makes before the run: the bootstrap sign-in binding.
    return {"bootstrap-binding"}


def run(fake: FakeCloud, execute=True) -> tuple[int, Path]:
    import contextlib
    import io

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        rc = bootstrap.main(["--execute"] if execute else [], backend=fake)
    return rc, buf


class FirstRun(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fake = FakeCloud(existing=first_run_state())
        cls.rc, _ = run(cls.fake)
        cls.texts = cls.fake.argv_texts()

    def test_run_succeeds(self):
        self.assertEqual(self.rc, 0)

    def test_creates_every_object_the_plan_names(self):
        for key in (
            "pool:han-github", "provider:han-github", "bucket:thebushido-co-han-tfstate",
            "sa:han-tf-plan", "sa:han-tf-apply", "sa:han-deployer",
            "sa:han-hosting-deployer", "sa:han-server-run",
            "run:han-server", "repo:han", "logbucket:han-server-logs",
            "logsink:han-server-logs", "logview:startup",
            "site:han-guru-dashboard", "site:han-guru-app", "site:han-guru-api",
        ) + tuple(f"role:{r}" for r in bootstrap.CUSTOM_ROLES):
            self.assertIn(key, self.fake.existing, key)

    def test_exactly_five_service_accounts_are_created(self):
        created = [t for t in self.texts if " service-accounts create " in t]
        self.assertEqual(len(created), 5)

    def test_no_key_is_created_and_no_project_is_created(self):
        for text in self.texts:
            self.assertNotIn("keys create", text)
            self.assertNotIn("projects create", text)

    def test_no_identity_is_granted_owner_editor_or_iam_admin(self):
        for text in self.texts:
            for forbidden in ("roles/owner", "roles/editor", "projectIamAdmin",
                              "serviceAccountTokenCreator", "roles/viewer"):
                self.assertNotIn(forbidden, text, text)

    def test_no_public_binding_is_created(self):
        for text in self.texts:
            self.assertNotIn("allUsers", text)
            self.assertNotIn("allAuthenticatedUsers", text)

    def test_cloud_run_shell_is_private(self):
        deploy = [t for t in self.texts if " run deploy han-server" in t]
        self.assertEqual(len(deploy), 1)
        self.assertIn("--no-allow-unauthenticated", deploy[0])

    def test_log_access_is_granted_on_the_view_only(self):
        view_grants = [t for t in self.texts if " views add-iam-policy-binding startup" in t]
        self.assertEqual(len(view_grants), 1)
        self.assertIn("roles/logging.viewAccessor", view_grants[0])
        self.assertIn(f"serviceAccount:han-deployer@{bootstrap.PROJECT}.iam.gserviceaccount.com", view_grants[0])
        for text in self.texts:
            if "projects add-iam-policy-binding" in text:
                self.assertNotIn("viewAccessor", text, "a project-level viewer would reach every log view")

    def test_sink_and_view_use_the_same_scoped_filter(self):
        sink = [t for t in self.texts if " sinks create han-server-logs" in t][0]
        view = [t for t in self.texts if " views create startup" in t][0]
        self.assertIn(bootstrap.LOG_FILTER, sink)
        self.assertIn(bootstrap.LOG_FILTER, view)

    def test_sink_destination_is_the_custom_bucket_only(self):
        sink = [t for t in self.texts if " sinks create han-server-logs" in t][0]
        self.assertIn(f"buckets/{bootstrap.LOG_BUCKET}", sink)
        self.assertNotIn("_Default", sink)

    def test_sites_are_created_through_the_firebase_cli(self):
        sites = [t for t in self.texts if "hosting:sites:create" in t]
        self.assertEqual(len(sites), 3)
        self.assertFalse(any("curl" in t for t in self.texts))

    def test_provider_admits_only_the_named_workflows(self):
        provider = [t for t in self.texts if "providers create-oidc han-github" in t][0]
        for wf in ("han-infra.yml", "deploy-han-server.yml", "deploy-hosting.yml"):
            self.assertIn(f"{bootstrap.REPO}/.github/workflows/{wf}@", provider)
        self.assertNotIn("validate-deploy", provider)
        self.assertIn(f"repository_id == '{bootstrap.REPO_ID}'", provider)

    def test_each_identity_is_bound_from_exactly_its_environment(self):
        bindings = [t for t in self.texts if "service-accounts add-iam-policy-binding" in t]
        self.assertIn(f"subject/repo:{bootstrap.REPO}:environment:han-infra-apply", " ".join(bindings))
        self.assertIn(f"subject/repo:{bootstrap.REPO}:environment:han-production", " ".join(bindings))
        self.assertIn(f"subject/repo:{bootstrap.REPO}:environment:han-hosting", " ".join(bindings))

    def test_revoke_is_the_last_mutation(self):
        self.assertIn("remove-iam-policy-binding", self.texts[-1])
        self.assertIn(bootstrap.BOOTSTRAP_SA, self.texts[-1])
        self.assertNotIn("bootstrap-binding", self.fake.existing)


class Conditions(unittest.TestCase):
    """Conditions come from reviewed files, and each file matches the spec in the script."""

    def load(self, name):
        import yaml

        return yaml.safe_load((BOOT_DIR / "conditions" / name).read_text(encoding="utf-8"))

    def test_secret_condition_file_matches_the_spec(self):
        self.assertEqual(self.load("han_secrets.yaml")["expression"], bootstrap.SECRET_COND)

    def test_sql_condition_file_matches_the_spec(self):
        self.assertEqual(self.load("han_pg.yaml")["expression"], bootstrap.SQL_COND)

    def test_secret_condition_is_limited_to_han_server_secrets(self):
        expr = self.load("han_secrets.yaml")["expression"]
        self.assertIn("/secrets/han-server-", expr)
        self.assertNotIn("anthropic", expr)

    def test_no_inline_condition_expression_is_passed(self):
        fake = FakeCloud(existing=first_run_state())
        run(fake)
        for text in fake.argv_texts():
            self.assertNotIn("--condition=expression", text)

    def test_each_conditioned_role_gets_its_condition_file(self):
        fake = FakeCloud(existing=first_run_state())
        run(fake)
        cond = [t for t in fake.argv_texts() if "--condition-from-file=" in t]
        self.assertEqual(len(cond), 4)
        for text in cond:
            self.assertTrue(
                "han_secrets.yaml" in text or "han_pg.yaml" in text, text
            )


class Idempotence(unittest.TestCase):
    def test_second_run_creates_nothing(self):
        first = FakeCloud(existing=first_run_state())
        run(first)
        # The bootstrap binding is gone after revoke. Put the state back as a
        # later run would find it: every object present, sign-in still revoked.
        second = FakeCloud(existing=set(first.existing))
        rc, _ = run(second)
        self.assertEqual(rc, 0)
        creates = [t for t in second.argv_texts() if " create" in t and "describe" not in t]
        self.assertEqual(creates, [], "a re-run must not create anything it finds present")

    def test_second_run_is_safe_to_repeat(self):
        first = FakeCloud(existing=first_run_state())
        run(first)
        second = FakeCloud(existing=set(first.existing))
        run(second)
        self.assertNotIn("bootstrap-binding", second.existing)


class Refusals(unittest.TestCase):
    def test_refuses_to_run_as_another_identity(self):
        fake = FakeCloud(existing=first_run_state(), active="jason@withbushido.ai")
        rc, buf = run(fake)
        self.assertEqual(rc, 1)
        self.assertIn("refusing to run as", buf.getvalue())
        self.assertEqual(fake.writes, [], "nothing may change under a wrong identity")

    def test_refuses_when_a_han_account_has_a_user_key(self):
        fake = FakeCloud(existing=first_run_state(), user_keys={"han-tf-apply"})
        rc, buf = run(fake)
        self.assertEqual(rc, 1)
        self.assertIn("user-managed key", buf.getvalue())

    def test_fails_when_the_sign_in_binding_survives_revoke(self):
        class Stubborn(FakeCloud):
            def __call__(self, kind, key, argv):
                if kind == "write" and "remove-iam-policy-binding" in argv:
                    self.writes.append((key, argv))
                    return 0, ""
                return super().__call__(kind, key, argv)

        fake = Stubborn(existing=first_run_state())
        rc, buf = run(fake)
        self.assertEqual(rc, 1)
        self.assertIn("still present", buf.getvalue())


class PrintMode(unittest.TestCase):
    def test_print_mode_performs_no_writes(self):
        fake = FakeCloud(existing=first_run_state())
        rc, buf = run(fake, execute=False)
        self.assertEqual(rc, 0)
        self.assertEqual(fake.writes, [], "print mode must not change anything")
        self.assertIn("gcloud projects add-iam-policy-binding", buf.getvalue())

    def test_print_mode_still_reads_live_state(self):
        fake = FakeCloud(existing=first_run_state())
        run(fake, execute=False)
        self.assertTrue(any(key == "pool:han-github" for key, _ in fake.reads))


class Inputs(unittest.TestCase):
    def test_every_custom_role_file_exists(self):
        for filename in bootstrap.CUSTOM_ROLES.values():
            self.assertTrue((BOOT_DIR / "roles" / filename).is_file(), filename)

    def test_service_account_names_are_han_prefixed(self):
        for name in bootstrap.SERVICE_ACCOUNTS:
            self.assertTrue(name.startswith("han-"), name)

    def test_bootstrap_identity_is_the_existing_owner_account(self):
        self.assertEqual(bootstrap.BOOTSTRAP_SA, "terraform-bootstrap@thebushido-co.iam.gserviceaccount.com")


if __name__ == "__main__":
    unittest.main()
