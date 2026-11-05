"""Policy tests for the Han deploy workflows.

They parse the real YAML, so a rule that a workflow silently breaks fails here
before CI runs. Each test names the review finding it guards against.

Run: python3 -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github" / "workflows"
FIREBASE = ROOT / "deploy" / "firebase"
sys.path.insert(0, str(FIREBASE / "scripts"))

import firebaserc  # noqa: E402

DEPLOY_WORKFLOWS = ("deploy-han-server.yml", "deploy-hosting.yml")
INFRA = "han-infra.yml"
SMOKE = "han-server-smoke.yml"
PINNED_WORKFLOWS = (INFRA, *DEPLOY_WORKFLOWS, SMOKE)
DEPLOYER_SA = "HAN_GCP_DEPLOYER_SA"
APPLY_SA = "HAN_GCP_TF_APPLY_SA"


def load(name: str) -> dict:
    with open(WORKFLOWS / name, encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    # PyYAML reads the bare key `on` as the boolean True.
    data["on"] = data.get("on", data.get(True))
    return data


def triggers(wf: dict) -> dict:
    on = wf["on"]
    return on if isinstance(on, dict) else {on: None}


def steps_text(job: dict) -> str:
    return "\n".join(str(s) for s in job.get("steps", []))


def authenticates_as(job: dict, secret_var: str) -> bool:
    for step in job.get("steps", []):
        with_ = step.get("with") or {}
        if secret_var in str(with_.get("service_account", "")):
            return True
    return False


def main_gated(name: str, jobs: dict, job_name: str, seen=None) -> bool:
    """A job runs only for main pushes if it says so, or every job it needs does."""
    seen = seen or set()
    if job_name in seen:
        return False
    seen = seen | {job_name}
    job = jobs[job_name]
    cond = str(job.get("if", ""))
    if "workflow_run" in cond or "event_name == 'push'" in cond:
        return True
    needs = job.get("needs", [])
    if isinstance(needs, str):
        needs = [needs]
    return bool(needs) and all(main_gated(name, jobs, n, seen) for n in needs)


class IdentityScope(unittest.TestCase):
    """H1: deployer and apply identities are reachable only from han-production."""

    def test_every_deployer_or_apply_job_is_in_the_production_environment(self):
        for name in (INFRA, *DEPLOY_WORKFLOWS):
            jobs = load(name)["jobs"]
            for job_name, job in jobs.items():
                if authenticates_as(job, DEPLOYER_SA) or authenticates_as(job, APPLY_SA):
                    env = job.get("environment")
                    env_name = env.get("name") if isinstance(env, dict) else env
                    self.assertEqual(
                        env_name,
                        "han-production",
                        f"{name}:{job_name} signs in as an owner-level identity without han-production",
                    )

    def test_production_environment_jobs_only_run_for_main_pushes(self):
        # Regression (review H1): a PR run must never reach the production
        # environment, and the publish step must not run for pull requests.
        for name in (INFRA, *DEPLOY_WORKFLOWS):
            jobs = load(name)["jobs"]
            for job_name, job in jobs.items():
                env = job.get("environment")
                if env is None:
                    continue
                self.assertTrue(
                    main_gated(name, jobs, job_name),
                    f"{name}:{job_name} is in han-production but is not limited to main pushes or the infra run",
                )

    def test_publish_job_pushes_the_image_inside_the_environment(self):
        # Regression (review H1): the push used to run without the environment.
        jobs = load("deploy-han-server.yml")["jobs"]
        publish = jobs["publish"]
        self.assertEqual(publish["environment"]["name"], "han-production")
        pushes = [s for s in publish["steps"] if "build-push-action" in str(s.get("uses", ""))]
        self.assertTrue(pushes)
        self.assertIs(pushes[0]["with"]["push"], True)

    def test_pull_request_builds_never_push(self):
        jobs = load("deploy-han-server.yml")["jobs"]
        for step in jobs["build-pr"]["steps"]:
            if "build-push-action" in str(step.get("uses", "")):
                self.assertIs(step["with"]["push"], False)
        self.assertNotIn("google-github-actions/auth", steps_text(jobs["build-pr"]))


class DeployOrdering(unittest.TestCase):
    """M1: deploys wait for the infra run on the same commit."""

    def test_deploys_are_driven_by_the_infra_run_not_by_push(self):
        for name in DEPLOY_WORKFLOWS:
            on = triggers(load(name))
            self.assertIn("workflow_run", on, name)
            self.assertEqual(on["workflow_run"]["workflows"], ["Han Infrastructure"], name)
            self.assertNotIn("push", on, f"{name} must not deploy on push and race the infra run")

    def test_infra_runs_on_every_push_to_main(self):
        # Without this, the workflow_run gate never fires for server-only changes.
        on = triggers(load(INFRA))
        self.assertIn("push", on)
        self.assertIsNone(on["push"] and on["push"].get("paths"), "infra must not path-filter pushes")

    def test_deploys_check_out_the_commit_the_infra_run_saw(self):
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            text = steps_text(jobs["deploy"]) + steps_text(jobs.get("publish", {}))
            self.assertIn("workflow_run.head_sha", text, name)

    def test_deploy_requires_infra_success(self):
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            self.assertIn("workflow_run.conclusion == 'success'", str(jobs["build" if "build" in jobs else "test"].get("if")), name)


class Concurrency(unittest.TestCase):
    """H6: a PR run must never cancel a pending main deploy or apply."""

    def test_pr_and_main_runs_use_different_groups(self):
        for name in (INFRA, *DEPLOY_WORKFLOWS):
            wf = load(name)
            group = str(wf["concurrency"]["group"])
            self.assertIn("github.event_name", group, f"{name}: group must split PR from main")

    def test_only_pull_requests_cancel_in_progress(self):
        for name in (INFRA, *DEPLOY_WORKFLOWS):
            cancel = str(load(name)["concurrency"]["cancel-in-progress"])
            self.assertIn("pull_request", cancel, f"{name}: main runs must never be cancelled")
            self.assertNotEqual(cancel, "true", name)


class FirebaseTargets(unittest.TestCase):
    """H2: every --only target a workflow deploys resolves under the project."""

    def test_every_deployed_target_resolves_for_the_project(self):
        config = firebaserc.build("han-guru")
        hosting = config["targets"]["han-guru"]["hosting"]
        deployed = set()
        for name in DEPLOY_WORKFLOWS:
            text = (WORKFLOWS / name).read_text(encoding="utf-8")
            for match in re.finditer(r"--only ([^\s\\]+)", text):
                for part in match.group(1).split(","):
                    if part.startswith("hosting:"):
                        deployed.add(part.split(":", 1)[1])
        self.assertEqual(deployed, {"dashboard", "app", "api"})
        for target in deployed:
            self.assertIn(target, hosting, f"hosting:{target} is not under targets[project]")

    def test_committed_firebaserc_matches_the_generator(self):
        committed = (FIREBASE / ".firebaserc").read_text(encoding="utf-8")
        generated = __import__("json").dumps(firebaserc.build("han-guru"), indent=2) + "\n"
        self.assertEqual(committed, generated)

    def test_firebase_json_targets_match_the_deployed_names(self):
        import json

        targets = {entry["target"] for entry in json.loads((FIREBASE / "firebase.json").read_text())["hosting"]}
        self.assertEqual(targets, {"dashboard", "app", "api"})


class ServerChecks(unittest.TestCase):
    """H3 and H4: the post-deploy checks read the data the server really writes."""

    def test_startup_check_reads_json_for_the_live_revision(self):
        text = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertIn("check_startup.py", text)
        self.assertIn("revision_name", text)
        self.assertNotIn("textPayload", text, "JSON logs have no textPayload (review H3)")

    def test_redirect_check_decodes_the_location(self):
        text = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertIn("check_redirect.py", text)
        self.assertNotIn("grep -q \"redirect_uri=https://", text, "the server encodes redirect_uri (review H4)")

    def test_secret_precheck_does_not_need_payload_access(self):
        text = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertNotIn("secrets versions access", text)
        self.assertIn("secrets versions list", text)

    def test_deploy_writes_firebaserc_before_it_deploys(self):
        # H2: the target map must be written for the real project before any
        # `firebase deploy --only hosting:*` runs in the same job.
        for name in DEPLOY_WORKFLOWS:
            steps = load(name)["jobs"]["deploy"]["steps"]
            runs = [str(s.get("run", "")) for s in steps]
            writer = [i for i, r in enumerate(runs) if "firebaserc.py" in r]
            deployer = [i for i, r in enumerate(runs) if "--only hosting" in r]
            self.assertTrue(writer, f"{name} never writes .firebaserc")
            self.assertTrue(deployer, f"{name} never runs firebase deploy")
            if min(writer) == min(deployer):
                # Same step: the writer line must come before the deploy line.
                run = runs[min(writer)]
                self.assertLess(run.index("firebaserc.py"), run.index("--only hosting"), name)
            else:
                self.assertLess(min(writer), min(deployer), f"{name} deploys before writing .firebaserc")


class Smoke(unittest.TestCase):
    """H5: the smoke job's mounts and signature check are correct."""

    def setUp(self):
        self.text = (WORKFLOWS / SMOKE).read_text(encoding="utf-8")

    def test_no_short_volume_flag_with_a_colon_in_the_source(self):
        # `-v src:dst` splits on every colon, and the connection name has colons.
        self.assertIsNone(re.search(r"-v\s+\"?\$SOCK_DIR", self.text))
        self.assertGreaterEqual(self.text.count("--mount"), 2)

    def test_bad_signature_sends_a_real_stripe_signature_header(self):
        # Regression (review H5): `-H 't=1,v1=0000'` had no header name.
        self.assertIn("-H 'stripe-signature: t=1,v1=0000'", self.text)

    def test_signed_request_uses_the_tested_helper(self):
        self.assertIn("deploy/firebase/scripts/stripe_header.py", self.text)


class PinnedActions(unittest.TestCase):
    """Low: jobs that hold owner-level tokens use commit-pinned actions."""

    def test_every_third_party_action_is_pinned_to_a_commit(self):
        for name in PINNED_WORKFLOWS:
            text = (WORKFLOWS / name).read_text(encoding="utf-8")
            for match in re.finditer(r"^\s*(?:-\s+)?uses:\s*(\S+)", text, re.M):
                ref = match.group(1)
                self.assertRegex(ref, r"@[0-9a-f]{40}$", f"{name}: {ref} is not pinned to a commit")


if __name__ == "__main__":
    unittest.main()
