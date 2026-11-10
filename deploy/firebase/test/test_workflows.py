"""Policy tests for the Han deploy workflows.

They parse the real YAML and the real files, so a rule that a workflow silently
breaks fails here. Each test names the review finding it guards against.

These are policy checks: they show the workflow declares the right permissions,
environments, triggers and commands. They do not prove that GitHub or Google
honour them. That is proven only by a run, which is listed as a blocker in
PATH.md.

Run: python3 -B -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import json
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

INFRA = "han-infra.yml"
DEPLOY_WORKFLOWS = ("deploy-han-server.yml", "deploy-hosting.yml")
SMOKE = "han-server-smoke.yml"
VALIDATE = "validate-deploy.yml"
ALL_WORKFLOWS = (INFRA, *DEPLOY_WORKFLOWS, SMOKE, VALIDATE)
EVENT_SPLIT_WORKFLOWS = ALL_WORKFLOWS
PINNED_WORKFLOWS = ALL_WORKFLOWS

DEPLOYER_SA = "HAN_GCP_DEPLOYER_SA"
HOSTING_SA = "HAN_GCP_HOSTING_DEPLOYER_SA"
APPLY_SA = "HAN_GCP_TF_APPLY_SA"
PLAN_SA = "HAN_GCP_TF_PLAN_SA"
DEPLOY_ENV = "han-production"
HOSTING_ENV = "han-hosting"
APPLY_ENV = "han-infra-apply"


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


def signs_in_as(job: dict, secret_var: str) -> bool:
    for step in job.get("steps", []):
        if secret_var in str((step.get("with") or {}).get("service_account", "")):
            return True
    return False


def uses_wif(job: dict) -> bool:
    return any("google-github-actions/auth" in str(s.get("uses", "")) for s in job.get("steps", []))


def environment_name(job: dict):
    env = job.get("environment")
    return env.get("name") if isinstance(env, dict) else env


def declares_id_token(wf: dict, job: dict) -> bool:
    perms = job.get("permissions", wf.get("permissions", {}))
    return isinstance(perms, dict) and perms.get("id-token") == "write"


def main_gated(jobs: dict, job_name: str, seen=None) -> bool:
    """A job runs only for main pushes if it says so, or every job it needs does."""
    seen = seen or set()
    if job_name in seen:
        return False
    seen = seen | {job_name}
    job = jobs[job_name]
    cond = str(job.get("if", ""))
    if "workflow_run" in cond or "event_name == 'push'" in cond or "github.ref == 'refs/heads/main'" in cond:
        return True
    needs = job.get("needs", [])
    if isinstance(needs, str):
        needs = [needs]
    return bool(needs) and all(main_gated(jobs, n, seen) for n in needs)


class WorkflowsParse(unittest.TestCase):
    def test_every_workflow_parses(self):
        for name in ALL_WORKFLOWS:
            self.assertIsInstance(load(name)["jobs"], dict, name)


class SignInScope(unittest.TestCase):
    """N1 and N2: every sign-in can work, and only the right job can become owner."""

    def test_every_job_that_signs_in_requests_an_id_token(self):
        # Regression (review N1): han-infra signed in without id-token: write,
        # so nothing could plan or apply.
        for name in ALL_WORKFLOWS:
            wf = load(name)
            for job_name, job in wf["jobs"].items():
                if uses_wif(job):
                    self.assertTrue(
                        declares_id_token(wf, job),
                        f"{name}:{job_name} signs in with WIF but has no id-token: write",
                    )

    def test_owner_identity_is_used_only_from_the_apply_environment(self):
        for name in ALL_WORKFLOWS:
            jobs = load(name)["jobs"]
            for job_name, job in jobs.items():
                if signs_in_as(job, APPLY_SA):
                    self.assertEqual(environment_name(job), APPLY_ENV, f"{name}:{job_name}")

    def test_deploy_identity_is_used_only_from_the_deploy_environment(self):
        for name in ALL_WORKFLOWS:
            jobs = load(name)["jobs"]
            for job_name, job in jobs.items():
                if signs_in_as(job, DEPLOYER_SA):
                    self.assertEqual(environment_name(job), DEPLOY_ENV, f"{name}:{job_name}")

    def test_hosting_identity_is_used_only_from_the_hosting_environment(self):
        for name in ALL_WORKFLOWS:
            for job_name, job in load(name)["jobs"].items():
                if signs_in_as(job, HOSTING_SA):
                    self.assertEqual(environment_name(job), HOSTING_ENV, f"{name}:{job_name}")
                if environment_name(job) == HOSTING_ENV:
                    self.assertTrue(signs_in_as(job, HOSTING_SA), f"{name}:{job_name} uses han-hosting for another identity")

    def test_the_server_deployer_is_not_the_hosting_identity(self):
        server = load("deploy-han-server.yml")["jobs"]
        for job_name, job in server.items():
            self.assertFalse(signs_in_as(job, HOSTING_SA), job_name)

    def test_no_deploy_job_can_reach_the_apply_environment(self):
        # Regression (review N2): publish and deploy shared the subject that
        # could mint the owner identity. The apply environment must be used
        # only by the apply job, so the two subjects differ.
        self.assertNotEqual(DEPLOY_ENV, APPLY_ENV)
        for name in DEPLOY_WORKFLOWS + (SMOKE, VALIDATE):
            for job_name, job in load(name)["jobs"].items():
                self.assertNotEqual(environment_name(job), APPLY_ENV, f"{name}:{job_name}")

    def test_only_the_apply_job_uses_the_apply_environment(self):
        jobs = load(INFRA)["jobs"]
        users = [n for n, j in jobs.items() if environment_name(j) == APPLY_ENV]
        self.assertEqual(users, ["apply"])

    def test_plan_identity_is_never_in_an_environment(self):
        # The plan runs on pull requests, which have no environment.
        for name in ALL_WORKFLOWS:
            for job_name, job in load(name)["jobs"].items():
                if signs_in_as(job, PLAN_SA):
                    self.assertIsNone(environment_name(job), f"{name}:{job_name}")

    def test_production_environment_jobs_only_run_for_main_pushes(self):
        # A pull request must never reach an environment with a deploy identity.
        for name in (INFRA, *DEPLOY_WORKFLOWS):
            jobs = load(name)["jobs"]
            for job_name, job in jobs.items():
                if environment_name(job) is not None:
                    self.assertTrue(
                        main_gated(jobs, job_name),
                        f"{name}:{job_name} is in an environment but not limited to main",
                    )

    def test_publish_pushes_inside_the_deploy_environment(self):
        jobs = load("deploy-han-server.yml")["jobs"]
        self.assertEqual(environment_name(jobs["publish"]), DEPLOY_ENV)
        pushes = [s for s in jobs["publish"]["steps"] if "build-push-action" in str(s.get("uses", ""))]
        self.assertTrue(pushes)
        self.assertIs(pushes[0]["with"]["push"], True)

    def test_pull_request_builds_never_push_or_sign_in(self):
        jobs = load("deploy-han-server.yml")["jobs"]
        for step in jobs["build-pr"]["steps"]:
            if "build-push-action" in str(step.get("uses", "")):
                self.assertIs(step["with"]["push"], False)
        self.assertFalse(uses_wif(jobs["build-pr"]))


class InfraPlanAndApply(unittest.TestCase):
    """N4: no Terraform change can be dropped because a run was replaced."""

    def setUp(self):
        self.jobs = load(INFRA)["jobs"]

    def test_there_is_no_change_detection_gate(self):
        # Regression (review N4): gating on the push's own diff lost changes
        # when a pending run was replaced. Every push plans against the state.
        self.assertNotIn("changes", self.jobs)
        for job_name, job in self.jobs.items():
            self.assertNotIn("changes", str(job.get("needs", "")), job_name)

    def test_plan_runs_on_every_trigger_and_reports_drift(self):
        plan = self.jobs["plan"]
        self.assertNotIn("if", plan)
        text = steps_text(plan)
        self.assertIn("-detailed-exitcode", text)
        self.assertIn("has_changes", text)

    def test_apply_runs_only_when_the_plan_has_changes(self):
        apply = self.jobs["apply"]
        self.assertEqual(apply["needs"], "plan")
        self.assertIn("needs.plan.outputs.has_changes == 'true'", str(apply["if"]))

    def test_apply_uses_the_saved_plan(self):
        text = steps_text(self.jobs["apply"])
        self.assertIn("terraform apply -input=false -no-color tfplan", text)

    def test_infra_runs_on_every_push_to_main_without_a_path_filter(self):
        on = triggers(load(INFRA))
        self.assertIn("push", on)
        self.assertIsNone((on["push"] or {}).get("paths"))

    def test_main_runs_are_never_cancelled(self):
        cancel = str(load(INFRA)["concurrency"]["cancel-in-progress"])
        self.assertIn("pull_request", cancel)


class DeployOrdering(unittest.TestCase):
    """M1: deploys wait for the infra run on the same commit."""

    def test_deploys_are_driven_by_the_infra_run_not_by_push(self):
        for name in DEPLOY_WORKFLOWS:
            on = triggers(load(name))
            self.assertIn("workflow_run", on, name)
            self.assertEqual(on["workflow_run"]["workflows"], ["Han Infrastructure"], name)
            self.assertNotIn("push", on, f"{name} must not deploy on push and race the infra run")

    def test_deploys_check_out_the_commit_the_infra_run_saw(self):
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            text = "".join(steps_text(j) for j in jobs.values())
            self.assertIn("workflow_run.head_sha", text, name)

    def test_deploy_requires_infra_success(self):
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            first = jobs["build" if "build" in jobs else "test"]
            self.assertIn("workflow_run.conclusion == 'success'", str(first.get("if")), name)


class Concurrency(unittest.TestCase):
    """H6: PR and main runs use different groups. Only PR runs cancel."""

    def test_pr_and_main_runs_use_different_groups(self):
        for name in EVENT_SPLIT_WORKFLOWS:
            group = str(load(name)["concurrency"]["group"])
            self.assertIn("github.event_name", group, name)

    def test_only_pull_requests_cancel_in_progress(self):
        for name in EVENT_SPLIT_WORKFLOWS:
            cancel = str(load(name)["concurrency"]["cancel-in-progress"])
            self.assertIn("pull_request", cancel, name)
            self.assertNotEqual(cancel, "true", name)


class FirebaseCli(unittest.TestCase):
    """N2 (third-party code) and H2 (targets resolve)."""

    def test_only_the_hosting_workflow_runs_the_firebase_cli(self):
        # The server deployer never runs third-party npm code or touches Hosting.
        server_runs = "\n".join(
            str(s.get("run", "")) for j in load("deploy-han-server.yml")["jobs"].values() for s in j.get("steps", [])
        )
        for banned in ("firebase deploy", "firebase-tools", "npx ", "npm ci", "hosting:"):
            self.assertNotIn(banned, server_runs, banned)
        hosting = (WORKFLOWS / "deploy-hosting.yml").read_text(encoding="utf-8")
        self.assertNotIn("npx --yes", hosting, "the CLI must not resolve at run time")
        self.assertIn("npm ci --ignore-scripts", hosting)
        self.assertIn("npx --no-install firebase deploy", hosting)

    def test_lockfile_pins_firebase_tools(self):
        lock = json.loads((FIREBASE / "package-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(lock["packages"]["node_modules/firebase-tools"]["version"], "15.24.0")
        manifest = json.loads((FIREBASE / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["devDependencies"]["firebase-tools"], "15.24.0")

    def test_every_deployed_target_resolves_for_the_project(self):
        config = firebaserc.build("thebushido-co")
        hosting = config["targets"]["thebushido-co"]["hosting"]
        deployed = set()
        for name in DEPLOY_WORKFLOWS:
            text = (WORKFLOWS / name).read_text(encoding="utf-8")
            for match in re.finditer(r"--only ([^\s\\]+)", text):
                for part in match.group(1).split(","):
                    if part.startswith("hosting:"):
                        deployed.add(part.split(":", 1)[1])
        self.assertEqual(deployed, {"dashboard", "app", "api"})
        for target in deployed:
            self.assertIn(target, hosting)

    def test_deploy_writes_firebaserc_before_it_deploys(self):
        # H2: the target map is written for the real project before any deploy
        # step in the same job. Only the hosting job deploys Hosting.
        name = "deploy-hosting.yml"
        runs = [str(s.get("run", "")) for s in load(name)["jobs"]["deploy"]["steps"]]
        writer = [i for i, r in enumerate(runs) if "firebaserc.py" in r]
        deployer = [i for i, r in enumerate(runs) if "--only hosting" in r]
        self.assertTrue(writer and deployer, name)
        if min(writer) == min(deployer):
            run = runs[min(writer)]
            self.assertLess(run.index("firebaserc.py"), run.index("--only hosting"), name)
        else:
            self.assertLess(min(writer), min(deployer), name)

    def test_committed_firebaserc_matches_the_generator(self):
        committed = (FIREBASE / ".firebaserc").read_text(encoding="utf-8")
        self.assertEqual(committed, json.dumps(firebaserc.build("thebushido-co"), indent=2) + "\n")


class ServerChecks(unittest.TestCase):
    """H3 and H4: post-deploy checks read the data the server writes."""

    def test_startup_check_reads_json_for_the_live_revision(self):
        text = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertIn("check_startup.py", text)
        self.assertIn("revision_name", text)
        self.assertNotIn("textPayload", text)

    def test_redirect_check_decodes_the_location(self):
        text = steps_text(load("deploy-hosting.yml")["jobs"]["deploy"])
        self.assertIn("check_redirect.py", text)

    def test_invoker_setting_is_checked_after_every_deploy(self):
        # The service's invoker setting is owned by Terraform. The deploy must
        # check it, not pass a flag that could change it.
        text = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertIn("check_invoker.py", text)
        self.assertNotIn("--no-invoker-iam-check", text)
        self.assertNotIn("--allow-unauthenticated", text)

    def test_hosting_workflow_checks_the_api_host_not_the_server_workflow(self):
        hosting = steps_text(load("deploy-hosting.yml")["jobs"]["deploy"])
        self.assertIn("check_redirect.py", hosting)
        self.assertIn("han-guru-api.web.app", hosting)
        self.assertIn("/health", hosting)
        server = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertNotIn("check_redirect.py", server)

    def test_startup_logs_are_read_only_through_the_constrained_view(self):
        # The deployer has no project log role. It reads one view, nothing else.
        text = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertIn("--bucket=han-server-logs", text)
        self.assertIn("--view=startup", text)
        calls = text.split("gcloud logging read")[1:]
        self.assertTrue(calls, "the startup check must read logs")
        for call in calls:
            window = call[:400]
            self.assertIn("--bucket=han-server-logs", window)
            self.assertIn("--view=startup", window)

    def test_secret_precheck_does_not_need_payload_access(self):
        text = steps_text(load("deploy-han-server.yml")["jobs"]["deploy"])
        self.assertNotIn("secrets versions access", text)
        self.assertIn("secrets versions list", text)


class Smoke(unittest.TestCase):
    """H5 and N7: mounts, signature and Postgres readiness."""

    def setUp(self):
        self.text = (WORKFLOWS / SMOKE).read_text(encoding="utf-8")

    def test_no_short_volume_flag_with_a_colon_in_the_source(self):
        self.assertIsNone(re.search(r"-v\s+\"?\$SOCK_DIR", self.text))
        self.assertGreaterEqual(self.text.count("--mount"), 2)

    def test_bad_signature_sends_a_real_stripe_signature_header(self):
        self.assertIn("-H 'stripe-signature: t=1,v1=0000'", self.text)

    def test_signed_request_uses_the_tested_helper(self):
        self.assertIn("deploy/firebase/scripts/stripe_header.py", self.text)

    def test_waits_for_the_real_server_not_the_init_server(self):
        # Regression (review N7): pg_isready alone can pass during init.
        self.assertIn("database system is ready to accept connections", self.text)
        self.assertIn("-ge 2", self.text)


class NoSelfAuthorisedBootstrap(unittest.TestCase):
    """N3 and N4: nothing in this change bootstraps cloud trust from a workstation."""

    def test_seed_script_is_not_in_the_change(self):
        self.assertFalse((FIREBASE / "seed.sh").exists())

    def test_no_self_authorisation_variable_anywhere(self):
        for path in list((FIREBASE).rglob("*")) + list(WORKFLOWS.iterdir()):
            if path.is_file() and "test" not in path.parts and path.suffix in {".py", ".sh", ".yml", ".tf", ".md", ".json"}:
                self.assertNotIn("HAN_BOOTSTRAP_AUTHORIZED", path.read_text(encoding="utf-8"), str(path))


class Hygiene(unittest.TestCase):
    """Low: no floating inputs in jobs that reach production."""

    def test_biome_version_is_pinned_to_the_browse_client_version(self):
        deploy = (WORKFLOWS / "deploy-hosting.yml").read_text(encoding="utf-8")
        self.assertNotIn("version: latest", deploy)
        self.assertIn("version: 2.3.7", deploy)
        pkg = json.loads((ROOT / "packages" / "browse-client" / "package.json").read_text(encoding="utf-8"))
        self.assertEqual(pkg["devDependencies"]["@biomejs/biome"], "2.3.7")

    def test_every_third_party_action_is_pinned_to_a_commit(self):
        for name in PINNED_WORKFLOWS:
            text = (WORKFLOWS / name).read_text(encoding="utf-8")
            for match in re.finditer(r"^\s*(?:-\s+)?uses:\s*(\S+)", text, re.M):
                self.assertRegex(match.group(1), r"@[0-9a-f]{40}$", f"{name}: {match.group(1)}")


class ValidateWorkflow(unittest.TestCase):
    """N6: the checks run in CI, not only on a workstation."""

    def test_runs_the_python_suite_terraform_and_actionlint(self):
        jobs = load(VALIDATE)["jobs"]
        text = "".join(steps_text(j) for j in jobs.values())
        self.assertIn("python3 -B -m unittest discover -s deploy/firebase/test", text)
        self.assertIn("terraform validate", text)
        self.assertIn("terraform fmt -check", text)
        self.assertIn("raven-actions/actionlint", text)

    def test_has_no_cloud_identity_or_environment(self):
        wf = load(VALIDATE)
        for job in wf["jobs"].values():
            self.assertFalse(uses_wif(job))
            self.assertIsNone(environment_name(job))

    def test_runs_on_pull_requests(self):
        self.assertIn("pull_request", triggers(load(VALIDATE)))



class HostingSiteStep(unittest.TestCase):
    """Hosting sites are created by the Hosting deploy job, before it deploys."""

    def test_sites_are_ensured_before_the_deploy(self):
        steps = load(DEPLOY_WORKFLOWS[1])["jobs"]["deploy"]["steps"]
        names = [str(s.get("name", "")) for s in steps]
        ensure = next(i for i, n in enumerate(names) if "Ensure the Hosting sites" in n)
        deploy = next(i for i, n in enumerate(names) if "Deploy dashboard" in n)
        self.assertLess(ensure, deploy)
        self.assertIn("ensure_hosting_sites.py", steps_text({"steps": [steps[ensure]]}))


class StateBucketIsPinned(unittest.TestCase):
    def test_both_infra_init_steps_name_the_bootstrap_bucket(self):
        text = (WORKFLOWS / INFRA).read_text(encoding="utf-8")
        self.assertNotIn("${{ vars.HAN_GCP_PROJECT_ID }}-tfstate", text)
        self.assertEqual(text.count("bucket=thebushido-co-han-tfstate"), 2)


if __name__ == "__main__":
    unittest.main()
