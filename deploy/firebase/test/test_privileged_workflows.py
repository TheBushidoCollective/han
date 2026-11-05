"""Policy tests for the workflow_run workflows that act on CI results.

Covers review finding 3. auto-fix-ci.yml and test-failure-analysis.yml are
triggered by workflow_run. A run started by an outsider's comment (for example
@claude on an issue) runs on the default branch in the same repository, so the
head-repository check alone does not stop it.

auto-fix-ci.yml is split so that:
  - should-fix accepts only failed push or pull_request runs on non-default
    branches of this repository;
  - auto-fix runs Claude with read-only scope and produces a patch file;
  - push-fix is the only job with write scope. It validates the patch as text
    and applies it to a checkout of the reviewed commit.

Most tests parse the real YAML. The secret scans and the analysis retry are also
run: their workflow shell is executed under bash against sample bundles and a fake
gh, so a negative case proves the step refuses, not just that the text is present.
They do not prove that GitHub enforces these rules; a run does that.

Run: python3 -B -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[3]
WORKFLOWS = ROOT / ".github" / "workflows"

AUTO_FIX = "auto-fix-ci.yml"
TEST_ANALYSIS = "test-failure-analysis.yml"
ALL_FILES = (AUTO_FIX, TEST_ANALYSIS)

GATE_JOB = "should-fix"
AGENT_JOB = "auto-fix"
PUSH_JOB = "push-fix"
NOTIFY_JOB = "notify-max-attempts"

SAME_REPO = "github.event.workflow_run.head_repository.full_name == github.repository"
DEFAULT_BRANCH_GUARD = "github.event.workflow_run.head_branch != github.event.repository.default_branch"

# Inputs claude-code-action v1 accepts on the steps used here. Anything else is
# ignored silently or rejected by actionlint, so it must not appear.
CLAUDE_INPUTS = {"prompt", "github_token", "claude_code_oauth_token", "claude_args"}

AUTO_FIX_TRIGGERS = {
    "Auto Tag Release",
    "Bump Plugin Versions",
    "Bump Website Version",
    "Claude Code",
    "Claude Code Review",
    "Claude Plugin Validate",
    "Coverage",
    "Deploy Han Website",
    "Manual Release",
    "Release Binaries",
    "Test Failure Analysis",
    "Test Website",
    "Validate Browse Client",
    "Validate Han CLI",
    "Validate Han Native",
    "Validate Han Website",
}

FAILURE_TYPES = {
    "formatting",
    "linting",
    "typescript",
    "test",
    "markdown",
    "plugin-validation",
    "build",
    "unknown",
}


def load_text(name: str) -> str:
    return (WORKFLOWS / name).read_text(encoding="utf-8")


def load(name: str) -> dict:
    data = yaml.safe_load(load_text(name))
    # PyYAML reads the bare key `on` as the boolean True.
    data["on"] = data.get("on", data.get(True))
    return data


def write_scopes(job: dict) -> set[str]:
    perms = job.get("permissions", {})
    if not isinstance(perms, dict):
        return set()
    return {scope for scope, level in perms.items() if level == "write"}


def claude_steps(wf: dict) -> list[tuple[str, dict]]:
    found = []
    for job_name, job in wf["jobs"].items():
        for s in job.get("steps", []):
            if "claude-code-action" in str(s.get("uses", "")):
                found.append((job_name, s))
    return found


def claude_jobs(wf: dict) -> set[str]:
    return {name for name, _ in claude_steps(wf)}


def step(job: dict, name: str) -> dict:
    matches = [s for s in job["steps"] if s.get("name") == name]
    if len(matches) != 1:
        raise AssertionError(f"expected one step named {name!r}, found {len(matches)}")
    return matches[0]


def run_text(job: dict) -> str:
    return "\n".join(str(s.get("run", "")) for s in job.get("steps", []))


def needs_of(job: dict) -> set[str]:
    needs = job.get("needs", [])
    return {needs} if isinstance(needs, str) else set(needs)


class ExpressionPlacementTests(unittest.TestCase):
    """Untrusted data reaches code through env, never through ${{ }} in code."""

    def assert_no_expression_in_code(self, wf_name: str) -> None:
        wf = load(wf_name)
        for job_name, job in wf["jobs"].items():
            for s in job.get("steps", []):
                label = f"{wf_name}:{job_name}:{s.get('name', s.get('id', '?'))}"
                if "run" in s:
                    self.assertNotIn("${{", s["run"], f"{label} interpolates into run:")
                script = (s.get("with") or {}).get("script")
                if script is not None:
                    self.assertNotIn("${{", script, f"{label} interpolates into script:")

    def test_auto_fix_has_no_expression_in_code(self) -> None:
        self.assert_no_expression_in_code(AUTO_FIX)

    def test_test_analysis_has_no_expression_in_code(self) -> None:
        self.assert_no_expression_in_code(TEST_ANALYSIS)

    def test_gate_reads_event_fields_from_env(self) -> None:
        check = step(load(AUTO_FIX)["jobs"][GATE_JOB], "Check if auto-fix should run")
        self.assertEqual(check["env"]["HEAD_BRANCH"], "${{ github.event.workflow_run.head_branch }}")
        self.assertEqual(check["env"]["RUN_EVENT"], "${{ github.event.workflow_run.event }}")
        self.assertEqual(check["env"]["DEFAULT_BRANCH"], "${{ github.event.repository.default_branch }}")
        self.assertIn("process.env.HEAD_BRANCH", check["with"]["script"])

    def test_no_shell_reads_structured_output_directly(self) -> None:
        for s_job, s in [(n, s) for n, j in load(TEST_ANALYSIS)["jobs"].items() for s in j.get("steps", [])]:
            if "run" in s:
                self.assertNotIn("steps.detect.outputs", s["run"], s_job)
                self.assertNotIn("needs.analyze.outputs", s["run"], s_job)


class TriggerAndGateTests(unittest.TestCase):
    def test_auto_fix_triggers_are_unchanged(self) -> None:
        on = load(AUTO_FIX)["on"]
        self.assertEqual(set(on["workflow_run"]["workflows"]), AUTO_FIX_TRIGGERS)
        self.assertEqual(on["workflow_run"]["types"], ["completed"])

    def test_test_analysis_triggers_are_unchanged(self) -> None:
        on = load(TEST_ANALYSIS)["on"]
        self.assertEqual(set(on["workflow_run"]["workflows"]), {"Test Website", "Auto Tag Release"})
        self.assertEqual(on["workflow_run"]["types"], ["completed"])

    def test_gate_requires_same_repository(self) -> None:
        cond = load(AUTO_FIX)["jobs"][GATE_JOB]["if"]
        self.assertIn(SAME_REPO, cond)

    def test_gate_requires_push_or_pull_request_event(self) -> None:
        # The @claude-on-issue path arrives with event issue_comment. Only the
        # two events that originate from a branch may continue.
        cond = load(AUTO_FIX)["jobs"][GATE_JOB]["if"]
        self.assertIn("github.event.workflow_run.event == 'push'", cond)
        self.assertIn("github.event.workflow_run.event == 'pull_request'", cond)
        self.assertNotIn("issue_comment", cond)

    def test_gate_refuses_default_branch(self) -> None:
        cond = load(AUTO_FIX)["jobs"][GATE_JOB]["if"]
        self.assertIn(DEFAULT_BRANCH_GUARD, cond)

    def test_gate_script_fails_closed_and_rechecks_policy(self) -> None:
        script = load(AUTO_FIX)["jobs"][GATE_JOB]["steps"][0]["with"]["script"]
        self.assertIn("if (!defaultBranch)", script)
        self.assertIn("branch === defaultBranch", script)
        self.assertIn("event !== 'push' && event !== 'pull_request'", script)
        self.assertIn("isSafeBranch(branch)", script)

    def test_downstream_jobs_depend_on_gate_and_patch(self) -> None:
        jobs = load(AUTO_FIX)["jobs"]
        self.assertEqual(needs_of(jobs[AGENT_JOB]), {GATE_JOB})
        self.assertEqual(needs_of(jobs[PUSH_JOB]), {GATE_JOB, AGENT_JOB})
        self.assertEqual(needs_of(jobs[NOTIFY_JOB]), {GATE_JOB})

    def test_auto_fix_concurrency_keys_on_repository(self) -> None:
        group = load(AUTO_FIX)["concurrency"]["group"]
        self.assertIn("github.event.workflow_run.head_repository.full_name", group)
        self.assertIn("github.event.workflow_run.head_branch", group)

    def test_test_analysis_jobs_are_gated_to_same_repository(self) -> None:
        wf = load(TEST_ANALYSIS)
        self.assertIn(SAME_REPO, wf["jobs"]["analyze"]["if"])
        self.assertIn("analyze", needs_of(wf["jobs"]["respond"]))


class LeastPrivilegeTests(unittest.TestCase):
    def test_top_level_permissions_are_empty(self) -> None:
        for name in ALL_FILES:
            self.assertEqual(load(name)["permissions"], {}, name)

    def test_gate_is_read_only(self) -> None:
        self.assertEqual(write_scopes(load(AUTO_FIX)["jobs"][GATE_JOB]), set())

    def test_agent_job_is_read_only(self) -> None:
        job = load(AUTO_FIX)["jobs"][AGENT_JOB]
        self.assertEqual(job["permissions"], {"contents": "read", "actions": "read"})
        self.assertEqual(write_scopes(job), set())

    def test_push_job_is_the_only_writer(self) -> None:
        jobs = load(AUTO_FIX)["jobs"]
        self.assertEqual(jobs[PUSH_JOB]["permissions"], {"contents": "write"})
        writers = {n for n, j in jobs.items() if write_scopes(j)}
        self.assertEqual(writers, {PUSH_JOB, NOTIFY_JOB})
        contents_writers = {n for n, j in jobs.items() if "contents" in write_scopes(j)}
        self.assertEqual(contents_writers, {PUSH_JOB})

    def test_notify_job_holds_only_issue_write(self) -> None:
        self.assertEqual(write_scopes(load(AUTO_FIX)["jobs"][NOTIFY_JOB]), {"issues"})

    def test_test_analysis_job_scopes(self) -> None:
        jobs = load(TEST_ANALYSIS)["jobs"]
        # analyze reads failed-run logs and runs Claude: read-only, no writes.
        self.assertEqual(jobs["analyze"]["permissions"], {"contents": "read", "actions": "read"})
        self.assertEqual(write_scopes(jobs["respond"]), {"actions", "pull-requests"})

    def test_claude_jobs_hold_no_write_scope(self) -> None:
        for name in ALL_FILES:
            wf = load(name)
            for job_name in claude_jobs(wf):
                self.assertEqual(write_scopes(wf["jobs"][job_name]), set(), f"{name}:{job_name}")

    def test_no_job_requests_an_oidc_token(self) -> None:
        # id-token: write lets claude-code-action mint a GitHub App token with
        # contents, pull-requests and issues write, outside the job's permissions.
        for name in ALL_FILES:
            for job_name, job in load(name)["jobs"].items():
                perms = job.get("permissions") or {}
                self.assertNotIn("id-token", perms, f"{name}:{job_name}")

    def test_checkouts_do_not_persist_credentials(self) -> None:
        for name in ALL_FILES:
            for job_name, job in load(name)["jobs"].items():
                for s in job.get("steps", []):
                    if str(s.get("uses", "")).startswith("actions/checkout"):
                        self.assertIs(
                            s["with"].get("persist-credentials"),
                            False,
                            f"{name}:{job_name} checkout keeps credentials",
                        )


class ClaudeInvocationTests(unittest.TestCase):
    def test_claude_jobs_authenticate_with_workflow_token(self) -> None:
        for name in ALL_FILES:
            for job_name, s in claude_steps(load(name)):
                self.assertEqual(
                    s["with"].get("github_token"),
                    "${{ github.token }}",
                    f"{name}:{job_name} must not mint an App token",
                )

    def test_claude_inputs_are_supported(self) -> None:
        for name in ALL_FILES:
            for job_name, s in claude_steps(load(name)):
                unknown = set(s["with"]) - CLAUDE_INPUTS
                self.assertFalse(unknown, f"{name}:{job_name} uses unsupported inputs {unknown}")

    def test_auto_fix_timeout_is_a_step_key(self) -> None:
        s = step(load(AUTO_FIX)["jobs"][AGENT_JOB], "Fix CI failures with Claude")
        self.assertEqual(s["timeout-minutes"], 15)
        self.assertNotIn("timeout_minutes", s["with"])

    def test_claude_tools_are_restricted_via_claude_args(self) -> None:
        for name in ALL_FILES:
            for job_name, s in claude_steps(load(name)):
                args = s["with"].get("claude_args", "")
                self.assertIn("--allowedTools", args, f"{name}:{job_name}")
                self.assertNotIn("Bash(*", args, f"{name}:{job_name} allows any shell")

    def test_push_job_runs_no_agent_code(self) -> None:
        job = load(AUTO_FIX)["jobs"][PUSH_JOB]
        self.assertFalse(claude_steps({"jobs": {PUSH_JOB: job}}))
        text = run_text(job)
        for forbidden in ("npm ", "biome", "bun ", "node ", "pnpm ", "yarn "):
            self.assertNotIn(forbidden, text, f"push-fix executes {forbidden!r}")


class HandoffTests(unittest.TestCase):
    def test_agent_never_commits_or_pushes(self) -> None:
        job = load(AUTO_FIX)["jobs"][AGENT_JOB]
        text = run_text(job)
        self.assertNotIn("git push", text)
        self.assertNotIn("git commit", text)

    def test_agent_reverts_ci_config_before_patch(self) -> None:
        text = run_text(load(AUTO_FIX)["jobs"][AGENT_JOB])
        revert = text.index("git checkout HEAD -- .github")
        clean = text.index("git clean -fdq -- .github")
        add = text.index("git add -A")
        patch = text.index("git diff --cached --binary")
        self.assertLess(revert, add)
        self.assertLess(clean, add)
        self.assertLess(add, patch)

    def test_patch_artifact_name_matches(self) -> None:
        jobs = load(AUTO_FIX)["jobs"]
        upload = step(jobs[AGENT_JOB], "Upload fix patch")["with"]["name"]
        download = step(jobs[PUSH_JOB], "Download fix patch")["with"]["name"]
        self.assertEqual(upload, "auto-fix-patch")
        self.assertEqual(download, upload)

    def test_has_fix_output_gates_push_job(self) -> None:
        jobs = load(AUTO_FIX)["jobs"]
        self.assertEqual(
            jobs[AGENT_JOB]["outputs"]["has_fix"], "${{ steps.collect.outputs.has_fix }}"
        )
        self.assertIn("needs.auto-fix.outputs.has_fix == 'true'", jobs[PUSH_JOB]["if"])

    def test_push_job_checks_out_the_reviewed_commit(self) -> None:
        checkout = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Checkout reviewed commit")
        self.assertEqual(checkout["with"]["ref"], "${{ github.event.workflow_run.head_sha }}")

    def test_push_refuses_default_branch_and_pins_branch(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Validate fix bundle")["run"]
        self.assertIn('"$HEAD_BRANCH" != "$DEFAULT_BRANCH"', text)
        self.assertIn('[ -n "$DEFAULT_BRANCH" ]', text)
        self.assertIn(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$", text)
        self.assertIn("git check-ref-format --branch", text)

    def test_metadata_is_checked_against_head_sha_and_fixed_fields(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Validate fix bundle")["run"]
        self.assertIn(".headSha == $sha", text)
        self.assertIn(".branch == $branch", text)
        self.assertIn("workflowName | test(", text)
        self.assertIn("runUrl | test(", text)
        for failure_type in FAILURE_TYPES:
            self.assertIn(failure_type, text)

    def test_patch_validation_rejects_ci_config_binaries_and_modes(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Validate fix bundle")["run"]
        self.assertIn("patch touches CI configuration", text)
        self.assertIn("binary change", text)
        self.assertIn("unsafe or quoted path", text)
        self.assertIn("mode 120000", text)
        self.assertIn("mode 160000", text)
        self.assertIn("mode 100755", text)
        self.assertIn("-le 50", text)

    def test_patch_must_apply_before_it_is_applied(self) -> None:
        validate = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Validate fix bundle")["run"]
        self.assertIn("git apply --check", validate)
        apply_text = run_text(load(AUTO_FIX)["jobs"][PUSH_JOB])
        self.assertLess(apply_text.index('git apply "$PATCH"'), apply_text.index("git push"))

    def test_push_is_a_plain_fast_forward(self) -> None:
        text = run_text(load(AUTO_FIX)["jobs"][PUSH_JOB])
        self.assertIn('git push origin "HEAD:refs/heads/${HEAD_BRANCH}"', text)
        self.assertNotIn("--force", text)

    def test_commit_arguments_are_not_shell_parsed_from_metadata(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Apply, commit and push")["run"]
        self.assertIn('git commit -m "$SUBJECT" -m "$BODY"', text)
        self.assertIn("[auto-fix]", text)

    def test_token_is_removed_from_remote_on_exit(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Apply, commit and push")["run"]
        self.assertIn("trap 'git remote set-url origin", text)


class AnalysisGateTests(unittest.TestCase):
    def test_analysis_output_is_schema_checked_before_use(self) -> None:
        run = step(load(TEST_ANALYSIS)["jobs"]["respond"], "Validate analysis")["run"]
        self.assertIn("jq -e", run)
        for field in ("is_flaky", "confidence", "summary"):
            self.assertIn(field, run)

    def test_pr_lookup_excludes_cross_repository_pulls(self) -> None:
        run = step(load(TEST_ANALYSIS)["jobs"]["respond"], "Comment on PR")["run"]
        self.assertIn("isCrossRepository", run)
        self.assertIn("select(.isCrossRepository == false)", run)

    def test_respond_receives_output_only_through_env(self) -> None:
        env = load(TEST_ANALYSIS)["jobs"]["respond"]["env"]
        self.assertEqual(env["STRUCTURED_OUTPUT"], "${{ needs.analyze.outputs.structured_output }}")

    def test_respond_never_runs_claude_or_checks_out(self) -> None:
        respond = load(TEST_ANALYSIS)["jobs"]["respond"]
        self.assertNotIn("respond", claude_jobs(load(TEST_ANALYSIS)))
        self.assertFalse(
            any(str(s.get("uses", "")).startswith("actions/checkout") for s in respond["steps"])
        )

    def test_analysis_allowed_tools_are_passed_via_claude_args(self) -> None:
        analyze = step(load(TEST_ANALYSIS)["jobs"]["analyze"], "Detect flaky test failures")
        self.assertIn('--allowedTools "Bash(gh:*),Read,Grep"', analyze["with"]["claude_args"])
        self.assertNotIn("allowed_tools", analyze["with"])

    def test_analysis_steps_are_preserved(self) -> None:
        names = [s.get("name") for s in load(TEST_ANALYSIS)["jobs"]["respond"]["steps"]]
        for expected in ("Retry flaky tests", "Low confidence detection", "Comment on PR"):
            self.assertIn(expected, names)

    def test_retry_threshold_is_unchanged(self) -> None:
        run = step(load(TEST_ANALYSIS)["jobs"]["respond"], "Validate analysis")["run"]
        self.assertIn(".confidence >= 0.7", run)
        self.assertIn(".confidence < 0.7", run)


# Full commit SHAs already pinned in this repo (han-bootstrap.yml, deploy-hosting.yml).
PINNED_ACTIONS = {
    "actions/checkout": "11d5960a326750d5838078e36cf38b85af677262",
    "actions/upload-artifact": "ea165f8d65b6e75b540449e92b4886f43607fa02",
    "actions/download-artifact": "d3f86a106a0bac45b974a628896c90dbdf5c8093",
}


class ActionPinTests(unittest.TestCase):
    def test_artifact_and_checkout_actions_are_sha_pinned(self) -> None:
        for name in ALL_FILES:
            for job_name, job in load(name)["jobs"].items():
                for s in job.get("steps", []):
                    uses = str(s.get("uses", ""))
                    for action, sha in PINNED_ACTIONS.items():
                        if uses.startswith(action + "@"):
                            self.assertEqual(
                                uses,
                                f"{action}@{sha}",
                                f"{name}:{job_name} must pin {action} to the repo SHA",
                            )

    def test_every_pinned_action_is_used_in_its_expected_form(self) -> None:
        # Guards against a tag ref slipping back in: no "@v4" for the pinned actions.
        for name in ALL_FILES:
            text = load_text(name)
            for action in PINNED_ACTIONS:
                self.assertNotIn(f"{action}@v4", text, f"{name} still uses a tag for {action}")


class PatchGuardTests(unittest.TestCase):
    def test_pusher_rejects_renames_and_copies(self) -> None:
        # numstat shows only a rename's destination, so a move out of .github
        # passes the path loop. Renames and copies are refused outright.
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Validate fix bundle")["run"]
        self.assertIn("grep -Eq '^(rename|copy) (from|to) ' \"$PATCH\"", text)
        self.assertIn("patch renames or copies files", text)

    def test_pusher_checks_patch_headers_on_both_sides(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Validate fix bundle")["run"]
        self.assertIn("grep -E '^(diff --git |--- |\\+\\+\\+ )' \"$PATCH\"", text)
        self.assertIn("grep -Fq '.github' <<< \"$headers\"", text)
        self.assertIn("patch header names CI configuration", text)

    def test_rename_guard_runs_before_patch_is_applied(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Validate fix bundle")["run"]
        self.assertLess(text.index("patch renames or copies files"), text.index("git apply --check"))

    def test_agent_expands_renames_and_copies_in_the_patch(self) -> None:
        text = run_text(load(AUTO_FIX)["jobs"][AGENT_JOB])
        self.assertIn("--no-renames --no-copies HEAD", text)

    def test_staged_result_is_checked_without_renames_before_commit(self) -> None:
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Apply, commit and push")["run"]
        check = text.index("git diff --cached --name-only --no-renames")
        self.assertLess(check, text.index('git commit -m "$SUBJECT"'))
        self.assertIn("staged change touches CI configuration", text)

    def test_apply_step_does_not_call_undefined_fail(self) -> None:
        # fail() is defined only in the validate step. The apply step must not use it.
        text = step(load(AUTO_FIX)["jobs"][PUSH_JOB], "Apply, commit and push")["run"]
        self.assertNotIn('fail "', text)
        self.assertIn("exit 1", text)


class NotifyTests(unittest.TestCase):
    def test_notify_runs_only_when_attempts_are_exhausted(self) -> None:
        cond = load(AUTO_FIX)["jobs"][NOTIFY_JOB]["if"]
        self.assertIn("should_run == 'false'", cond)
        self.assertIn("attempt_count >= '3'", cond)

    def test_refused_branches_do_not_trigger_exhaustion_notice(self) -> None:
        # Refusals set attempt_count to 0, so the exhaustion notice stays quiet.
        script = load(AUTO_FIX)["jobs"][GATE_JOB]["steps"][0]["with"]["script"]
        self.assertIn("skip('never auto-fix the default branch')", script)
        self.assertIn("return skip(`event", script)


# Fake, clearly non-secret token used only in these tests.
FAKE_CLAUDE_TOKEN = "fake-claude-oauth-token-0123456789abcdef"

SCAN_TOKEN_STEP = "Scan fix bundle for the Claude token"
SCAN_PATTERN_STEP = "Scan fix bundle for credential patterns"

CLEAN_PATCH = (
    "diff --git a/src/a.ts b/src/a.ts\n"
    "--- a/src/a.ts\n"
    "+++ b/src/a.ts\n"
    "@@ -1 +1 @@\n"
    "-const a = 1;\n"
    "+const a = 2;\n"
)
CLEAN_META = (
    '{"headSha":"abc","branch":"feat/x","valid":"true","failureType":"test",'
    '"workflowName":"Test Website","runUrl":"https://github.com/o/r/actions/runs/1"}'
)


def run_bash(script: str, env: dict[str, str]) -> subprocess.CompletedProcess:
    full_env = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "/tmp")}
    full_env.update(env)
    return subprocess.run(
        ["bash", "-c", script], env=full_env, capture_output=True, text=True, check=False
    )


def make_bundle(root: Path, patch: str, meta: str = CLEAN_META) -> Path:
    fix = root / "fix"
    fix.mkdir()
    (fix / "fix.patch").write_text(patch, encoding="utf-8")
    (fix / "meta.json").write_text(meta, encoding="utf-8")
    return fix


def leak_base64(token: str, prefix_len: int) -> str:
    """Base64 of a stream where the token starts at byte offset prefix_len mod 3."""
    payload = b"y" * prefix_len + token.encode() + b"zz"
    return base64.b64encode(payload).decode()


@unittest.skipUnless(shutil.which("bash") and shutil.which("jq") and shutil.which("base64"),
                     "bash, jq and base64 are required")
class SecretScanStructureTests(unittest.TestCase):
    def test_token_scan_runs_after_collect_and_before_upload(self) -> None:
        names = [s.get("name") for s in load(AUTO_FIX)["jobs"][AGENT_JOB]["steps"]]
        self.assertLess(names.index("Collect fix patch"), names.index(SCAN_TOKEN_STEP))
        self.assertLess(names.index(SCAN_TOKEN_STEP), names.index("Upload fix patch"))

    def test_token_reaches_only_the_scan_and_the_claude_action(self) -> None:
        job = load(AUTO_FIX)["jobs"][AGENT_JOB]
        holders = [
            s.get("name") or s.get("id")
            for s in job["steps"]
            if "secrets.CLAUDE_CODE_OAUTH_TOKEN" in yaml.safe_dump(s)
        ]
        self.assertEqual(sorted(holders), sorted(["Fix CI failures with Claude", SCAN_TOKEN_STEP]))

    def test_scan_never_prints_secret_material(self) -> None:
        script = step(load(AUTO_FIX)["jobs"][AGENT_JOB], SCAN_TOKEN_STEP)["run"]
        self.assertNotIn("set -x", script)
        for line in script.splitlines():
            # A message must not interpolate the token or any needle.
            self.assertIsNone(
                re.search(r"echo.*\$\{?(CLAUDE_TOKEN|needles|enc|n)\b", line), line
            )
        self.assertIn("grep -Fq -e", script)

    def test_pattern_scan_runs_before_validation_and_apply(self) -> None:
        names = [s.get("name") for s in load(AUTO_FIX)["jobs"][PUSH_JOB]["steps"]]
        self.assertLess(names.index(SCAN_PATTERN_STEP), names.index("Validate fix bundle"))
        self.assertLess(names.index(SCAN_PATTERN_STEP), names.index("Apply, commit and push"))


@unittest.skipUnless(shutil.which("bash") and shutil.which("base64"), "bash and base64 are required")
class TokenScanBehaviourTests(unittest.TestCase):
    def script(self) -> str:
        return step(load(AUTO_FIX)["jobs"][AGENT_JOB], SCAN_TOKEN_STEP)["run"]

    def scan(self, fix: Path, token: str = FAKE_CLAUDE_TOKEN) -> subprocess.CompletedProcess:
        return run_bash(self.script(), {"CLAUDE_TOKEN": token, "FIX_DIR": str(fix)})

    def assert_refused_quietly(self, result: subprocess.CompletedProcess) -> None:
        self.assertNotEqual(result.returncode, 0)
        combined = result.stdout + result.stderr
        self.assertNotIn(FAKE_CLAUDE_TOKEN, combined)
        self.assertNotIn(base64.b64encode(FAKE_CLAUDE_TOKEN.encode()).decode()[:12], combined)

    def test_clean_bundle_passes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = self.scan(make_bundle(Path(tmp), CLEAN_PATCH))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("free of the Claude token", result.stdout)

    def test_plain_token_in_patch_is_refused(self) -> None:
        patch = CLEAN_PATCH + f"+const k = '{FAKE_CLAUDE_TOKEN}';\n"
        with tempfile.TemporaryDirectory() as tmp:
            result = self.scan(make_bundle(Path(tmp), patch))
            self.assert_refused_quietly(result)
            self.assertIn("fix.patch", result.stdout + result.stderr)

    def test_plain_token_in_meta_is_refused(self) -> None:
        meta = CLEAN_META.replace("Test Website", FAKE_CLAUDE_TOKEN)
        with tempfile.TemporaryDirectory() as tmp:
            result = self.scan(make_bundle(Path(tmp), CLEAN_PATCH, meta))
            self.assert_refused_quietly(result)
            self.assertIn("meta.json", result.stdout + result.stderr)

    def test_base64_at_every_byte_alignment_is_refused(self) -> None:
        for prefix_len in (0, 1, 2):
            with self.subTest(prefix_len=prefix_len):
                patch = CLEAN_PATCH + f"+const blob = '{leak_base64(FAKE_CLAUDE_TOKEN, prefix_len)}';\n"
                with tempfile.TemporaryDirectory() as tmp:
                    result = self.scan(make_bundle(Path(tmp), patch))
                    self.assert_refused_quietly(result)

    def test_unrelated_base64_is_not_refused(self) -> None:
        blob = base64.b64encode(b"nothing to see here, just ordinary text").decode()
        with tempfile.TemporaryDirectory() as tmp:
            result = self.scan(make_bundle(Path(tmp), CLEAN_PATCH + f"+const b = '{blob}';\n"))
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_empty_or_short_token_fails_closed(self) -> None:
        for token in ("", "short-token"):
            with self.subTest(token=token), tempfile.TemporaryDirectory() as tmp:
                result = self.scan(make_bundle(Path(tmp), CLEAN_PATCH), token=token)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("missing or too short", result.stdout + result.stderr)

    def test_extra_entries_are_refused_even_when_clean(self) -> None:
        # The upload sends the whole directory, so an unscanned file must not ride along.
        for name in ("notes.txt", ".hidden-secret"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                fix = make_bundle(Path(tmp), CLEAN_PATCH)
                (fix / name).write_text(f"carry {FAKE_CLAUDE_TOKEN}", encoding="utf-8")
                result = self.scan(fix)
                self.assert_refused_quietly(result)
                self.assertIn("unexpected entry", result.stdout + result.stderr)

    def test_symlinked_bundle_entry_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            fix = make_bundle(Path(tmp), CLEAN_PATCH)
            outside = Path(tmp) / "outside.txt"
            outside.write_text(CLEAN_PATCH, encoding="utf-8")
            (fix / "fix.patch").unlink()
            os.symlink(outside, fix / "fix.patch")
            result = self.scan(fix)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("not a regular file", result.stdout + result.stderr)

    def test_missing_expected_file_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            fix = make_bundle(Path(tmp), CLEAN_PATCH)
            (fix / "meta.json").unlink()
            result = self.scan(fix)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("incomplete", result.stdout + result.stderr)


@unittest.skipUnless(shutil.which("bash"), "bash is required")
class PatternScanBehaviourTests(unittest.TestCase):
    def scan(self, patch: str, meta: str = CLEAN_META) -> subprocess.CompletedProcess:
        script = step(load(AUTO_FIX)["jobs"][PUSH_JOB], SCAN_PATTERN_STEP)["run"]
        with tempfile.TemporaryDirectory() as tmp:
            fix = make_bundle(Path(tmp), patch, meta)
            return run_bash(script, {"FIX_DIR": str(fix)})

    def test_clean_bundle_passes(self) -> None:
        self.assertEqual(self.scan(CLEAN_PATCH).returncode, 0)

    def test_added_credential_like_line_is_refused(self) -> None:
        for line in (
            "+const t = 'ghp_" + "x" * 36 + "';\n",
            "+const k = 'AKIA" + "A" * 16 + "';\n",
            "+-----BEGIN RSA PRIVATE KEY-----\n",
        ):
            with self.subTest(line=line[:20]):
                result = self.scan(CLEAN_PATCH + line)
                self.assertNotEqual(result.returncode, 0)
                # The message names the file, never the matching text.
                self.assertNotIn("ghp_", result.stdout + result.stderr)

    def test_removed_credential_line_is_allowed(self) -> None:
        # Deleting a leaked value is a fix; only what the patch adds is checked.
        patch = CLEAN_PATCH + "-const t = 'ghp_" + "x" * 36 + "';\n"
        self.assertEqual(self.scan(patch).returncode, 0)

    def test_credential_in_file_header_is_refused(self) -> None:
        patch = CLEAN_PATCH.replace("src/a.ts", "ghp_" + "x" * 36 + ".ts")
        self.assertNotEqual(self.scan(patch).returncode, 0)

    def test_credential_in_meta_is_refused(self) -> None:
        meta = CLEAN_META.replace("Test Website", "AKIA" + "B" * 16)
        self.assertNotEqual(self.scan(CLEAN_PATCH, meta).returncode, 0)


@unittest.skipUnless(shutil.which("bash") and shutil.which("jq"), "bash and jq are required")
class AnalysisRetryBehaviourTests(unittest.TestCase):
    def test_retry_reruns_the_failed_run_through_gh(self) -> None:
        script = step(load(TEST_ANALYSIS)["jobs"]["respond"], "Retry flaky tests")["run"]
        with tempfile.TemporaryDirectory() as tmp:
            bindir = Path(tmp) / "bin"
            bindir.mkdir()
            log = Path(tmp) / "gh.log"
            fake_gh = bindir / "gh"
            fake_gh.write_text(f'#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "{log}"\n', encoding="utf-8")
            fake_gh.chmod(0o755)
            env = {
                "PATH": f"{bindir}:{os.environ.get('PATH', '')}",
                "GH_REPO": "o/r",
                "RUN_ID": "123",
                "CONFIDENCE": "0.9",
                "STRUCTURED_OUTPUT": json.dumps({"is_flaky": True, "confidence": 0.9, "summary": "timeout"}),
            }
            result = run_bash(script, env)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(log.read_text(encoding="utf-8").strip(), "run rerun 123 --failed --repo o/r")

    def test_retry_is_capped_at_one_attempt_and_never_dispatches(self) -> None:
        step_def = step(load(TEST_ANALYSIS)["jobs"]["respond"], "Retry flaky tests")
        self.assertIn("github.event.workflow_run.run_attempt < 2", step_def["if"])
        self.assertNotIn("gh workflow run", step_def["run"])

    def test_verdict_rejects_malformed_analysis_and_applies_threshold(self) -> None:
        script = step(load(TEST_ANALYSIS)["jobs"]["respond"], "Validate analysis")["run"]
        cases = [
            ('{"is_flaky":"yes","confidence":2,"summary":"x"}', None),
            ('{"is_flaky":true,"confidence":0.5,"summary":"x"}', "retry=false"),
            ('{"is_flaky":true,"confidence":0.9,"summary":"x"}', "retry=true"),
        ]
        for payload, expected in cases:
            with self.subTest(payload=payload), tempfile.TemporaryDirectory() as tmp:
                out = Path(tmp) / "out"
                out.write_text("", encoding="utf-8")
                result = run_bash(script, {"STRUCTURED_OUTPUT": payload, "GITHUB_OUTPUT": str(out)})
                if expected is None:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertNotIn("retry=", out.read_text(encoding="utf-8"))
                else:
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn(expected, out.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
