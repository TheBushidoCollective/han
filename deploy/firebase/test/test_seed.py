"""Run seed.sh against fake gcloud and gh that record their calls.

Nothing reaches Google or GitHub. The fakes simulate each project state and
log every call, so the tests check decisions the script makes: which project ID
it picks, what it refuses to do, and what trust it writes.

Run: python3 -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SEED = Path(__file__).resolve().parents[1] / "seed.sh"
ORG = "949208237676"

FAKE_GCLOUD = r"""#!/usr/bin/env bash
state_dir="$FAKE_STATE"
echo "gcloud $*" >> "$FAKE_LOG"
args="$*"

project_state() { cat "$state_dir/$1" 2>/dev/null || echo absent; }

case "$args" in
  "projects describe "*)
    id="$(printf '%s' "$args" | awk '{print $3}')"
    st="$(project_state "$id")"
    case "$args" in
      *"value(labels.han-bootstrap)"*) [ "$st" = ours ] && echo true; exit 0 ;;
      *"value(parent.id)"*) [ "$st" = ours ] && echo "$FAKE_ORG"; exit 0 ;;
      *"value(projectNumber)"*) echo 123456789; exit 0 ;;
    esac
    case "$st" in
      absent) echo "ERROR: (gcloud.projects.describe) NOT_FOUND: Project [$id] not found." >&2; exit 1 ;;
      taken) echo "ERROR: (gcloud.projects.describe) PERMISSION_DENIED: caller lacks access to [$id]." >&2; exit 1 ;;
      broken) echo "ERROR: could not connect to cloudresourcemanager.googleapis.com" >&2; exit 1 ;;
      ours|exists) echo "$id"; exit 0 ;;
    esac ;;
  "projects create "*)
    id="$(printf '%s' "$args" | awk '{print $3}')"
    echo ours > "$state_dir/$id"; exit 0 ;;
  "billing projects describe "*) echo True; exit 0 ;;
  *"workload-identity-pools describe "*)
    case "$args" in *"value(name)"*) echo x; exit 0 ;; esac
    exit 1 ;;
  *"providers describe "*)
    case "$args" in *"value(name)"*) echo x; exit 0 ;; esac
    exit 1 ;;
  *"buckets describe "*)
    case "$args" in *"value("*) echo x; exit 0 ;; esac
    exit 1 ;;
  *"service-accounts describe "*)
    case "$args" in *"value(email)"*) echo x@x; exit 0 ;; esac
    exit 1 ;;
esac
exit 0
"""

FAKE_GH = r"""#!/usr/bin/env bash
echo "gh $*" >> "$FAKE_LOG"
case " $* " in
  *" --input - "*) echo "stdin:" >> "$FAKE_LOG"; cat >> "$FAKE_LOG"; echo >> "$FAKE_LOG" ;;
esac
exit 0
"""


class SeedRun:
    """One isolated run of seed.sh with fake tools on PATH."""

    def __init__(self, states: dict[str, str], env: dict[str, str] | None = None):
        self.tmp = Path(tempfile.mkdtemp(prefix="seedtest-"))
        self.bin = self.tmp / "bin"
        self.bin.mkdir()
        self.state = self.tmp / "state"
        self.state.mkdir()
        self.log = self.tmp / "calls.log"
        self.log.write_text("")
        for name, body in (("gcloud", FAKE_GCLOUD), ("gh", FAKE_GH)):
            path = self.bin / name
            path.write_text(body)
            path.chmod(0o755)
        for project, state in states.items():
            (self.state / project).write_text(state)
        self.env = {
            "PATH": f"{self.bin}{os.pathsep}{os.environ.get('PATH', '/usr/bin:/bin')}",
            "FAKE_LOG": str(self.log),
            "FAKE_STATE": str(self.state),
            "FAKE_ORG": ORG,
            "HAN_BOOTSTRAP_AUTHORIZED": "D3-test",
            "HAN_REVIEWER_ID": "42",
        }
        self.env.update(env or {})

    def run(self, overrides: dict[str, str | None] | None = None) -> subprocess.CompletedProcess:
        env = dict(self.env)
        for key, value in (overrides or {}).items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
        return subprocess.run(["bash", str(SEED)], env=env, capture_output=True, text=True, timeout=60)

    def text(self) -> str:
        return self.log.read_text()

    def calls(self) -> list[str]:
        return self.text().splitlines()

    def created(self) -> list[str]:
        return [c for c in self.calls() if c.startswith("gcloud projects create ")]

    def cleanup(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)


class SeedProjectSelection(unittest.TestCase):
    def setUp(self):
        self.runs: list[SeedRun] = []

    def tearDown(self):
        for run in self.runs:
            run.cleanup()

    def make(self, states, env=None) -> SeedRun:
        run = SeedRun(states, env)
        self.runs.append(run)
        return run

    def test_refuses_without_recorded_authorization(self):
        run = self.make({})
        result = run.run({"HAN_BOOTSTRAP_AUTHORIZED": None})
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("HAN_BOOTSTRAP_AUTHORIZED", result.stderr)
        self.assertEqual(run.calls(), [], "no cloud call may happen without authorization")

    def test_refuses_without_a_named_reviewer(self):
        run = self.make({})
        result = run.run({"HAN_REVIEWER_ID": None})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("HAN_REVIEWER_ID", result.stderr)
        self.assertEqual(run.calls(), [])

    def test_creates_han_guru_when_absent(self):
        run = self.make({"han-guru": "absent"})
        run.run()
        self.assertEqual(len(run.created()), 1)
        self.assertEqual(run.created()[0].split()[3], "han-guru")

    def test_permission_denied_on_han_guru_falls_back_to_prod_id(self):
        # Regression (review M3): a 403 on han-guru used to read as "absent".
        run = self.make({"han-guru": "taken", "han-guru-prod": "absent"})
        run.run()
        self.assertEqual([c.split()[3] for c in run.created()], ["han-guru-prod"])

    def test_both_ids_taken_stops_without_creating(self):
        run = self.make({"han-guru": "taken", "han-guru-prod": "taken"})
        result = run.run()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no usable project ID", result.stderr)
        self.assertEqual(run.created(), [])

    def test_unknown_error_stops_instead_of_guessing(self):
        run = self.make({"han-guru": "broken"})
        result = run.run()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(run.created(), [], "a network error must never trigger a create")

    def test_existing_project_we_own_is_reused(self):
        run = self.make({"han-guru": "ours"})
        run.run()
        self.assertEqual(run.created(), [], "an owned project must not be created again")


class SeedTrust(unittest.TestCase):
    """The trust the script writes is what the review checks."""

    @classmethod
    def setUpClass(cls):
        cls.run_ = SeedRun({"han-guru": "absent"})
        cls.result = cls.run_.run()
        cls.text = cls.run_.text()
        cls.calls = cls.run_.calls()

    @classmethod
    def tearDownClass(cls):
        cls.run_.cleanup()

    def provider_line(self) -> str:
        lines = [c for c in self.calls if "create-oidc" in c or "update-oidc" in c]
        self.assertTrue(lines, "the provider must be created or updated")
        return lines[0]

    def test_run_succeeds(self):
        self.assertEqual(self.result.returncode, 0, self.result.stderr)

    def test_provider_admits_only_the_named_workflows(self):
        line = self.provider_line()
        for wf in ("han-infra.yml", "deploy-han-server.yml", "deploy-hosting.yml"):
            self.assertIn(f"TheBushidoCollective/han/.github/workflows/{wf}@", line)

    def test_provider_does_not_admit_other_workflows(self):
        # claude.yml holds id-token: write. It must not exchange a token.
        self.assertNotIn("claude.yml", self.provider_line())

    def test_provider_is_bound_to_the_repository_id(self):
        self.assertIn("assertion.repository_id == '1100192477'", self.provider_line())

    def test_environment_requires_the_named_reviewer(self):
        self.assertIn('"reviewers"', self.text)
        self.assertRegex(self.text, r'"id":\s*42')

    def test_apply_identity_is_bound_to_the_environment_subject(self):
        self.assertIn("subject/repo:TheBushidoCollective/han:environment:han-production", self.text)

    def test_no_secret_material_is_requested(self):
        self.assertNotIn("secrets versions access", self.text)
        self.assertIsNone(re.search(r"keys create", self.text))


if __name__ == "__main__":
    unittest.main()
