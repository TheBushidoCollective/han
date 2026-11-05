"""Behaviour tests. Each one runs real code and checks what it did, not what a file says.

- The Terraform plan step of han-infra.yml runs as a script under the shell GitHub
  uses (bash --noprofile --norc -eo pipefail), with a stub terraform that exits
  0, 2 or 1. It must write has_changes and exit 0 for 0 and 2, and fail for 1.
- The bootstrap plan is computed from two checkouts at different paths, and must
  hash the same. Changing a role or a condition must change the hash.
- The bootstrap refuses a run from another commit before any cloud call.

Nothing here reaches a cloud API. What still needs a real GitHub run is listed in
PATH.md section 8 (the environment and the revoke step's skip, which are GitHub
behaviour, and the Cloud SQL and IAM condition evaluation).
"""

from __future__ import annotations

import contextlib
import importlib.util
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
BOOT_DIR = ROOT / "deploy" / "firebase" / "bootstrap"
INFRA = ROOT / ".github" / "workflows" / "han-infra.yml"

spec = importlib.util.spec_from_file_location("bootstrap_py", BOOT_DIR / "bootstrap.py")
bootstrap = importlib.util.module_from_spec(spec)
sys.modules["bootstrap_py"] = bootstrap
spec.loader.exec_module(bootstrap)

TEST_COMMIT = "0123456789abcdef0123456789abcdef01234567"


def plan_step_script() -> str:
    """The exact run script of the infra plan step, as GitHub would execute it."""
    jobs = yaml.safe_load(INFRA.read_text(encoding="utf-8"))["jobs"]
    step = next(s for s in jobs["plan"]["steps"] if s.get("id") == "plan")
    return step["run"]


def run_plan_step(terraform_exit: int) -> tuple[int, str]:
    """Run the plan step with a stub terraform that exits with terraform_exit."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        stub = tmp_path / "terraform"
        stub.write_text(f"#!/usr/bin/env bash\necho stub terraform \"$@\"\nexit {terraform_exit}\n", encoding="utf-8")
        stub.chmod(stub.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        script = tmp_path / "step.sh"
        script.write_text(plan_step_script(), encoding="utf-8")
        output = tmp_path / "github_output"
        output.write_text("", encoding="utf-8")
        env = {**os.environ, "PATH": f"{tmp}{os.pathsep}{os.environ['PATH']}", "GITHUB_OUTPUT": str(output)}
        proc = subprocess.run(["bash", "--noprofile", "--norc", "-eo", "pipefail", str(script)],
                              cwd=tmp, env=env, capture_output=True, text=True, timeout=120)
        return proc.returncode, output.read_text(encoding="utf-8")


class TerraformPlanStepBehaviour(unittest.TestCase):
    def test_no_changes_exits_zero_and_records_false(self):
        rc, out = run_plan_step(0)
        self.assertEqual(rc, 0)
        self.assertEqual(out, "has_changes=false\n")

    def test_changes_exit_two_still_completes_and_records_true(self):
        # The defect this covers: under bash -e a plain plan that exits 2 ended the step
        # before has_changes was written, so the apply job never ran.
        rc, out = run_plan_step(2)
        self.assertEqual(rc, 0, "a plan with changes must not end the step")
        self.assertEqual(out, "has_changes=true\n")

    def test_a_real_error_fails_the_step_and_records_nothing(self):
        rc, out = run_plan_step(1)
        self.assertNotEqual(rc, 0)
        self.assertEqual(out, "")

    def test_the_wrapper_is_disabled_so_exit_codes_are_terraforms_own(self):
        text = INFRA.read_text(encoding="utf-8")
        self.assertEqual(text.count("terraform_wrapper: false"), 2)


def copy_deploy(into: Path) -> Path:
    """Copy the deploy tree to another root and return the copy's bootstrap.py."""
    shutil.copytree(ROOT / "deploy", into / "deploy",
                    ignore=shutil.ignore_patterns("__pycache__", ".terraform", "node_modules"))
    return into / "deploy" / "firebase" / "bootstrap" / "bootstrap.py"


def plan_sha_from_process(script: Path, cwd: Path) -> str:
    proc = subprocess.run([sys.executable, "-B", str(script)], cwd=cwd, capture_output=True, text=True, timeout=120)
    assert proc.returncode == 0, proc.stderr
    line = next(l for l in proc.stdout.splitlines() if l.startswith("plan-sha256: "))
    return line.split(": ", 1)[1]


class PlanIsBoundToContent(unittest.TestCase):
    def test_the_hash_is_the_same_from_another_checkout_path(self):
        here = bootstrap.plan_sha256(bootstrap.build_plan())
        with tempfile.TemporaryDirectory() as tmp:
            other = plan_sha_from_process(copy_deploy(Path(tmp)), Path(tmp))
        self.assertEqual(here, other)

    def test_no_plan_line_names_an_absolute_path(self):
        for line in bootstrap.build_plan():
            self.assertNotIn(str(ROOT), line, line)
            self.assertNotIn("/Users/", line, line)
        files = [l for l in bootstrap.build_plan() if "--file=" in l or "--condition-from-file=" in l]
        self.assertTrue(files)
        role_lines = [l for l in files if "--file=" in l]
        condition_lines = [l for l in files if "--condition-from-file=" in l]
        self.assertTrue(role_lines and condition_lines)
        for line in role_lines:
            self.assertIn("--file=deploy/firebase/bootstrap/roles/", line)
        for line in condition_lines:
            self.assertIn("--condition-from-file=deploy/firebase/bootstrap/conditions/", line)

    def test_editing_a_role_permission_changes_the_hash(self):
        before = bootstrap.plan_sha256(bootstrap.build_plan())
        with tempfile.TemporaryDirectory() as tmp:
            script = copy_deploy(Path(tmp))
            role = script.parent / "roles" / "han_tf_apply_secrets.yaml"
            role.write_text(role.read_text(encoding="utf-8") + "- secretmanager.versions.access\n", encoding="utf-8")
            after = plan_sha_from_process(script, Path(tmp))
        self.assertNotEqual(before, after)

    def test_editing_the_sql_condition_changes_the_hash(self):
        before = bootstrap.plan_sha256(bootstrap.build_plan())
        with tempfile.TemporaryDirectory() as tmp:
            script = copy_deploy(Path(tmp))
            cond = script.parent / "conditions" / "han_pg.yaml"
            cond.write_text(cond.read_text(encoding="utf-8").replace("==", "startsWith"), encoding="utf-8")
            after = plan_sha_from_process(script, Path(tmp))
        self.assertNotEqual(before, after)

    def test_the_hash_names_the_code_itself(self):
        self.assertIn(f"input deploy/firebase/bootstrap/bootstrap.py sha256 ", "\n".join(bootstrap.build_plan()))


class CommitIsChecked(unittest.TestCase):
    class Recorder:
        def __init__(self) -> None:
            self.calls: list[tuple[str, list[str]]] = []

        def __call__(self, kind, argv):
            self.calls.append((kind, argv))
            return 0, "", ""

    @contextlib.contextmanager
    def github_sha(self, value: str | None):
        old = os.environ.get("GITHUB_SHA")
        if value is None:
            os.environ.pop("GITHUB_SHA", None)
        else:
            os.environ["GITHUB_SHA"] = value
        try:
            yield
        finally:
            if old is None:
                os.environ.pop("GITHUB_SHA", None)
            else:
                os.environ["GITHUB_SHA"] = old

    def test_a_run_from_another_commit_refuses_before_any_call(self):
        recorder = self.Recorder()
        sha = bootstrap.plan_sha256(bootstrap.build_plan())
        with self.github_sha("ffffffffffffffffffffffffffffffffffffffff"):
            rc = bootstrap.main(["--execute", "--expect-sha256", sha, "--expect-commit", TEST_COMMIT], backend=recorder)
        self.assertEqual(rc, 2)
        self.assertEqual(recorder.calls, [])

    def test_the_plan_job_refuses_another_commit_too(self):
        with self.github_sha("ffffffffffffffffffffffffffffffffffffffff"):
            rc = bootstrap.main(["--expect-commit", TEST_COMMIT])
        self.assertEqual(rc, 2)

    def test_execute_needs_the_commit_as_well_as_the_hash(self):
        recorder = self.Recorder()
        sha = bootstrap.plan_sha256(bootstrap.build_plan())
        with self.github_sha(TEST_COMMIT):
            rc = bootstrap.main(["--execute", "--expect-sha256", sha], backend=recorder)
        self.assertEqual(rc, 2)
        self.assertEqual(recorder.calls, [])


def terraform_edges() -> set[tuple[str, str]]:
    """Edges of Terraform's own dependency graph, as (dependent, dependency). Offline:
    the backend is removed from a copy, so no credential or state is read."""
    import re
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        for src in (ROOT / "deploy" / "firebase" / "terraform").glob("*.tf"):
            text = re.sub(r'backend\s+"gcs"\s*\{\s*\}', "", src.read_text(encoding="utf-8"))
            (work / src.name).write_text(text, encoding="utf-8")
        subprocess.run(["terraform", "init", "-backend=false", "-input=false", "-no-color"], cwd=work,
                       check=True, capture_output=True, timeout=600)
        graph = subprocess.run(["terraform", "graph"], cwd=work, capture_output=True, text=True, timeout=300).stdout
    return set(re.findall(r'^\s*"([^"]+)" -> "([^"]+)";', graph, re.M))


@unittest.skipUnless(shutil.which("terraform"), "terraform is not installed")
class PasswordWriteOrder(unittest.TestCase):
    """The first apply must not write a secret that holds a password the database lacks.
    Terraform's graph is the evidence: the secret version may only depend on the SQL user,
    never the reverse. A failed user create then skips the secret write."""

    @classmethod
    def setUpClass(cls):
        cls.edges = terraform_edges()

    def test_the_secret_version_depends_on_the_sql_user(self):
        self.assertIn(("google_secret_manager_secret_version.database_url", "google_sql_user.han"), self.edges)

    def test_the_sql_user_does_not_depend_on_the_secret(self):
        self.assertNotIn(("google_sql_user.han", "google_secret_manager_secret_version.database_url"), self.edges)


class SqlDeletionProtection(unittest.TestCase):
    def test_the_instance_sets_cloud_sql_own_deletion_protection(self):
        text = (ROOT / "deploy" / "firebase" / "terraform" / "database.tf").read_text(encoding="utf-8")
        settings = text[text.index("settings {"): text.index("lifecycle {", text.index("settings {"))]
        self.assertRegex(settings, r"\n\s*deletion_protection_enabled = true\n")

    def test_the_provider_has_that_attribute_under_settings(self):
        import json

        schema = json.loads((BOOT_DIR / "tf-schema.json").read_text(encoding="utf-8"))
        self.assertIn("settings.deletion_protection_enabled", schema["resources"]["google_sql_database_instance"])


if __name__ == "__main__":
    unittest.main()
