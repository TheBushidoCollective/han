"""Provenance and scheduling tests for the Han deploy workflows (audit findings 5 and 6).

Finding 5: a deploy may build only a commit that the Han Infrastructure run on
main approved, from this repository, and that is an ancestor of origin/main.
Finding 6: the production image must not read or write a shared build cache.

Three layers:
- Wiring checks parse the YAML: gate ordering, identity fields, publish cache
  settings, the Bun cache setting.
- Scheduling checks run every real `if:` expression from both deploy workflows
  through a small scheduler that follows GitHub's job rules, including the implicit
  success() that applies to an `if` with no status function. They catch a production
  job that runs after a failed gate.
- Gate checks run the real gate step in bash against real git repositories,
  then feed its exit status into the scheduler.

These are checks on the declared behaviour. They do not prove that GitHub
evaluates expressions or fills workflow_run fields as documented. Only a real
run proves that.

Run: python3 -B -m unittest discover -s deploy/firebase/test -v
"""

from __future__ import annotations

import itertools
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

SERVER = "deploy-han-server.yml"
HOSTING = "deploy-hosting.yml"
DEPLOY_WORKFLOWS = (SERVER, HOSTING)
GATE_JOB = "verify-source"
GATE_STEP = "Verify the trigger and the commit"
INFRA_PATH = ".github/workflows/han-infra.yml"
REPO = "example-org/han-test"

# The gate reads these from the trigger. Each maps to the context key the job `if`s read.
GATE_ENV_TO_CONTEXT = {
    "WR_PATH": "github.event.workflow_run.path",
    "WR_EVENT": "github.event.workflow_run.event",
    "WR_CONCLUSION": "github.event.workflow_run.conclusion",
    "WR_BRANCH": "github.event.workflow_run.head_branch",
    "WR_HEAD_SHA": "github.event.workflow_run.head_sha",
    "WR_HEAD_REPO": "github.event.workflow_run.head_repository.full_name",
    "REPO": "github.repository",
}
GOOD_TRIGGER = {
    "WR_PATH": INFRA_PATH,
    "WR_EVENT": "push",
    "WR_CONCLUSION": "success",
    "WR_BRANCH": "main",
    "WR_HEAD_SHA": "0" * 40,
    "WR_HEAD_REPO": REPO,
    "REPO": REPO,
}

PULL_REQUEST_CTX = {"github.event_name": "pull_request"}
STATUS_FUNCTIONS = {"always", "success", "failure", "cancelled"}
STATUS_CALL = re.compile(r"\b(?:always|success|failure|cancelled)\(\)")


def load(name: str) -> dict:
    with open(WORKFLOWS / name, encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    # PyYAML reads the bare key `on` as the boolean True.
    data["on"] = data.get("on", data.get(True))
    return data


def gate_step(name: str) -> dict:
    steps = [s for s in load(name)["jobs"][GATE_JOB]["steps"] if s.get("name") == GATE_STEP]
    if len(steps) != 1:
        raise AssertionError(f"{name} must have exactly one step named {GATE_STEP!r}")
    return steps[0]


def needs_of(job: dict) -> list[str]:
    needs = job.get("needs", [])
    return [needs] if isinstance(needs, str) else list(needs)


def ancestors(jobs: dict, job_name: str) -> set[str]:
    seen: set[str] = set()
    stack = needs_of(jobs[job_name])
    while stack:
        current = stack.pop()
        if current not in seen:
            seen.add(current)
            stack.extend(needs_of(jobs[current]))
    return seen


def environment_jobs(name: str) -> set[str]:
    return {j for j, job in load(name)["jobs"].items() if job.get("environment") is not None}


# ---------------------------------------------------------------------------
# A small evaluator for the `if:` expressions these workflows use, and a scheduler
# that applies GitHub's job rules to them.
# ---------------------------------------------------------------------------

_TOKEN = re.compile(r"\s*(?:(&&|\|\||==|!=|[()!])|'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)|([A-Za-z_][\w.\-]*))")


def _tokenize(text: str) -> list[tuple[str, str]]:
    text = text.strip()
    pos, out = 0, []
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m or m.end() == pos:
            raise ValueError(f"cannot parse expression at {text[pos:]!r}")
        if m.group(1):
            out.append(("op", m.group(1)))
        elif m.group(2) is not None:
            out.append(("str", m.group(2).replace("''", "'")))
        elif m.group(3):
            out.append(("num", m.group(3)))
        else:
            out.append(("word", m.group(4)))
        pos = m.end()
    return out


def _truthy(value) -> bool:
    if value is None or value is False:
        return False
    if isinstance(value, str):
        return value != ""
    return bool(value)


def _equal(a, b) -> bool:
    if isinstance(a, str) and isinstance(b, str):
        return a.lower() == b.lower()  # GitHub ignores case when comparing strings
    return a == b


class _Expression:
    """Parses and evaluates one `if:` expression against a context and the job's needs."""

    def __init__(self, text: str, ctx: dict, needs: dict):
        self.toks = _tokenize(text)
        self.i = 0
        self.ctx = ctx
        self.needs = needs

    def _peek(self):
        return self.toks[self.i] if self.i < len(self.toks) else None

    def _take(self):
        tok = self._peek()
        if tok is None:
            raise ValueError("unexpected end of expression")
        self.i += 1
        return tok

    def run(self):
        value = self._or()
        if self._peek() is not None:
            raise ValueError(f"unexpected trailing tokens {self.toks[self.i:]}")
        return value

    def _or(self):
        value = self._and()
        while self._peek() == ("op", "||"):
            self._take()
            right = self._and()
            value = _truthy(value) or _truthy(right)
        return value

    def _and(self):
        value = self._comparison()
        while self._peek() == ("op", "&&"):
            self._take()
            right = self._comparison()
            value = _truthy(value) and _truthy(right)
        return value

    def _comparison(self):
        value = self._unary()
        while self._peek() in (("op", "=="), ("op", "!=")):
            op = self._take()[1]
            same = _equal(value, self._unary())
            value = same if op == "==" else not same
        return value

    def _unary(self):
        if self._peek() == ("op", "!"):
            self._take()
            return not _truthy(self._unary())
        return self._primary()

    def _primary(self):
        kind, val = self._take()
        if (kind, val) == ("op", "("):
            value = self._or()
            if self._take() != ("op", ")"):
                raise ValueError("expected )")
            return value
        if kind == "str":
            return val
        if kind == "num":
            return float(val)
        if kind == "word":
            if val in ("true", "false"):
                return val == "true"
            if val == "null":
                return None
            if self._peek() == ("op", "("):
                if val not in STATUS_FUNCTIONS:
                    raise ValueError(f"unsupported function {val}()")
                self._take()
                if self._take() != ("op", ")"):
                    raise ValueError(f"{val}() takes no arguments here")
                return self._status(val)
            return self.ctx.get(val)
        raise ValueError(f"unexpected token {kind} {val!r}")

    def _status(self, fn: str) -> bool:
        if fn == "always":
            return True
        if fn == "cancelled":
            return False
        if fn == "success":
            return all(r == "success" for r in self.needs.values())
        return any(r == "failure" for r in self.needs.values())  # failure()


def _strip_expression(text: str) -> str:
    m = re.fullmatch(r"\$\{\{\s*(.*?)\s*\}\}", text.strip(), re.S)
    return m.group(1) if m else text


def schedule(jobs: dict, ctx: dict, outcomes: dict) -> dict:
    """Return each job's result: success, failure or skipped.

    GitHub's rules, as documented:
    - An `if` gets an implicit success() unless it calls always(), success(), failure()
      or cancelled(). So an `if` with no status function runs only when every job it
      needs succeeded.
    - `needs.<job>.result` is the direct need's result. A skipped need is 'skipped'.
    `outcomes` gives the result a job reaches when it runs.
    """
    results: dict[str, str] = {}
    while len(results) < len(jobs):
        progressed = False
        for name, job in jobs.items():
            if name in results:
                continue
            deps = needs_of(job)
            if not all(d in results for d in deps):
                continue
            dep_results = {d: results[d] for d in deps}
            scope = {**ctx, **{f"needs.{d}.result": r for d, r in dep_results.items()}}
            cond = job.get("if")
            text = "" if cond is None else _strip_expression(str(cond))
            if not STATUS_CALL.search(text):
                # GitHub's default: success() applies unless the if calls a status function.
                text = f"success() && ({text})" if text else "success()"
            run = _truthy(_Expression(text, scope, dep_results).run())
            results[name] = outcomes.get(name, "success") if run else "skipped"
            progressed = True
        if not progressed:
            raise ValueError("job graph has a missing need or a cycle")
    return results


def workflow_run_ctx(values: dict) -> dict:
    ctx = {"github.event_name": "workflow_run"}
    for env_name, context_key in GATE_ENV_TO_CONTEXT.items():
        ctx[context_key] = values[env_name]
    return ctx


CONTEXTS = {
    "pull_request": PULL_REQUEST_CTX,
    "workflow_run": workflow_run_ctx(GOOD_TRIGGER),
}


# ---------------------------------------------------------------------------
# Wiring
# ---------------------------------------------------------------------------


class GateWiring(unittest.TestCase):
    """Finding 5: the gate exists, runs first, and everything else waits for it."""

    def test_gate_job_runs_only_for_the_infra_workflow_run(self):
        for name in DEPLOY_WORKFLOWS:
            job = load(name)["jobs"][GATE_JOB]
            self.assertEqual(job["if"], "github.event_name == 'workflow_run'", name)
            self.assertNotIn("environment", job, name)
            self.assertNotIn("id-token", job.get("permissions", {}), name)

    def test_gate_checks_out_full_history_and_keeps_credentials(self):
        for name in DEPLOY_WORKFLOWS:
            checkout = load(name)["jobs"][GATE_JOB]["steps"][0]
            self.assertIn("actions/checkout@", checkout["uses"], name)
            self.assertEqual(checkout["with"]["fetch-depth"], 0, f"{name}: shallow checkout hides origin/main")
            self.assertTrue(checkout["with"].get("persist-credentials", True), f"{name}: the fetch needs the token")
            self.assertEqual(checkout["with"]["ref"], "${{ github.event.workflow_run.head_sha }}", name)

    def test_gate_reads_every_identity_field_from_the_trigger(self):
        for name in DEPLOY_WORKFLOWS:
            env = gate_step(name)["env"]
            self.assertEqual(
                env,
                {k: "${{ " + v + " }}" for k, v in GATE_ENV_TO_CONTEXT.items()},
                name,
            )

    def test_gate_script_is_identical_in_both_workflows(self):
        a, b = (gate_step(n) for n in DEPLOY_WORKFLOWS)
        self.assertEqual(a["run"], b["run"], "the two gates drifted apart")
        self.assertEqual(a["env"], b["env"])
        self.assertEqual(a.get("shell"), "bash")

    def test_gate_script_compares_by_ancestry_and_fails_fast(self):
        run = gate_step(SERVER)["run"]
        self.assertIn("set -euo pipefail", run)
        self.assertIn("git merge-base --is-ancestor", run)
        self.assertIn("refs/remotes/origin/main", run)
        self.assertIn("--is-shallow-repository", run)
        # Expressions go through env. Nothing a trigger carries is spliced into the shell text.
        self.assertNotIn("${{", run)

    def test_every_other_job_is_ordered_after_the_gate(self):
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            for job_name in jobs:
                if job_name != GATE_JOB:
                    self.assertIn(GATE_JOB, ancestors(jobs, job_name), f"{name}:{job_name}")

    def test_every_production_job_depends_on_the_gate(self):
        # The gate is a need of every production job. Whether a job also runs after a
        # failed gate depends on its if. The scheduling tests check that by behaviour.
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            for job_name in environment_jobs(name):
                self.assertIn(GATE_JOB, needs_of(jobs[job_name]), f"{name}:{job_name}")

    def test_pr_build_is_live_when_the_tests_pass(self):
        # Liveness: the PR build runs when the tests pass, and does not wait on
        # verify-source, which is skipped on pull requests.
        jobs = load(SERVER)["jobs"]
        self.assertNotIn(GATE_JOB, needs_of(jobs["build-pr"]))
        results = schedule(jobs, PULL_REQUEST_CTX, {})
        self.assertEqual(results["build-pr"], "success")


class ProductionImageHasNoSharedCache(unittest.TestCase):
    """Finding 6: publish builds with no cache that another ref could have written."""

    def test_publish_build_reads_and_writes_no_cache(self):
        publish = load(SERVER)["jobs"]["publish"]
        pushes = [s for s in publish["steps"] if "build-push-action" in str(s.get("uses", ""))]
        self.assertEqual(len(pushes), 1)
        with_ = pushes[0]["with"]
        self.assertNotIn("cache-from", with_)
        self.assertNotIn("cache-to", with_)
        self.assertIs(with_.get("no-cache"), True)
        self.assertIs(with_["push"], True)
        self.assertNotIn("type=gha", str(publish))


class HostingBuildHasNoSharedBunCache(unittest.TestCase):
    """Finding 3 (staged review): setup-bun caches the Bun executable unless told not to.

    The pinned action (oven-sh/setup-bun 0c5077e5) documents `no-cache`: "Disable
    caching of bun executable." The `bun-version` stays "1.2", the repo convention in
    about ten workflows. An exact patch pin is a blocker, not a guess.
    """

    def test_hosting_build_disables_the_bun_executable_cache(self):
        steps = load(HOSTING)["jobs"]["build"]["steps"]
        bun = [s for s in steps if "setup-bun" in str(s.get("uses", ""))]
        self.assertEqual(len(bun), 1)
        self.assertIs(bun[0]["with"].get("no-cache"), True)
        self.assertEqual(bun[0]["with"].get("bun-version"), "1.2")

    def test_hosting_deploy_runs_no_bun(self):
        # The deploy job downloads the built artifact and never runs Bun itself.
        steps = load(HOSTING)["jobs"]["deploy"]["steps"]
        self.assertFalse(any("setup-bun" in str(s.get("uses", "")) for s in steps))


# ---------------------------------------------------------------------------
# Scheduling: the real `if:` expressions under GitHub's job rules
# ---------------------------------------------------------------------------


class JobScheduling(unittest.TestCase):
    """Runs the workflows' real conditions. A regression here means a job runs when it must not."""

    def run_workflow(self, name: str, ctx: dict, outcomes: dict | None = None) -> dict:
        return schedule(load(name)["jobs"], ctx, outcomes or {})

    def ran(self, results: dict) -> set[str]:
        return {j for j, r in results.items() if r != "skipped"}

    def test_pull_request_runs_the_tests_and_the_pr_build_only(self):
        server = self.run_workflow(SERVER, PULL_REQUEST_CTX)
        self.assertEqual(server[GATE_JOB], "skipped")
        self.assertEqual(self.ran(server), {"test", "build-pr"})
        self.assertEqual(self.ran(self.run_workflow(HOSTING, PULL_REQUEST_CTX)), {"build"})

    def test_pr_build_does_not_run_when_the_tests_fail(self):
        results = self.run_workflow(SERVER, PULL_REQUEST_CTX, {"test": "failure"})
        self.assertEqual(results["build-pr"], "skipped")

    def test_pr_build_does_not_run_when_the_tests_are_skipped(self):
        # build-pr checks needs.test.result explicitly, so skipping test must skip it too.
        jobs = load(SERVER)["jobs"]
        results = schedule(
            {**jobs, "test": {**jobs["test"], "if": "false"}},
            PULL_REQUEST_CTX,
            {},
        )
        self.assertEqual(results["test"], "skipped")
        self.assertEqual(results["build-pr"], "skipped")

    def test_trusted_infra_run_publishes_and_deploys_every_job_in_order(self):
        ctx = CONTEXTS["workflow_run"]
        server = self.run_workflow(SERVER, ctx)
        self.assertEqual(self.ran(server), {GATE_JOB, "test", "publish", "deploy"})
        self.assertNotIn("build-pr", self.ran(server))
        hosting = self.run_workflow(HOSTING, ctx)
        self.assertEqual(self.ran(hosting), {GATE_JOB, "build", "deploy"})

    def test_failed_gate_runs_no_production_job(self):
        # Regression guard: publish and deploy never run after a failed gate, in either workflow.
        ctx = CONTEXTS["workflow_run"]
        server = self.run_workflow(SERVER, ctx, {GATE_JOB: "failure"})
        self.assertEqual(self.ran(server), {GATE_JOB})
        hosting = self.run_workflow(HOSTING, ctx, {GATE_JOB: "failure"})
        self.assertEqual(self.ran(hosting), {GATE_JOB})

    def test_failed_test_publishes_nothing(self):
        results = self.run_workflow(SERVER, CONTEXTS["workflow_run"], {"test": "failure"})
        self.assertEqual(results["publish"], "skipped")
        self.assertEqual(results["deploy"], "skipped")

    def test_failed_hosting_build_deploys_nothing(self):
        results = self.run_workflow(HOSTING, CONTEXTS["workflow_run"], {"build": "failure"})
        self.assertEqual(results["deploy"], "skipped")

    def test_no_production_job_runs_on_any_outcome_it_has_not_earned(self):
        # Exhaustive over every combination of job outcomes, in each trigger context:
        #  P1 a pull request runs no environment job, and the gate is skipped;
        #  P2 in a workflow_run, a job runs only if the gate succeeded;
        #  P3 an environment job runs only in a workflow_run, after the gate and every need succeeded.
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            envs = environment_jobs(name)
            for ctx_name, ctx in CONTEXTS.items():
                for combo in itertools.product(("success", "failure"), repeat=len(jobs)):
                    outcomes = dict(zip(jobs, combo))
                    results = schedule(jobs, ctx, outcomes)
                    where = f"{name} {ctx_name} {outcomes}"
                    if ctx_name == "pull_request":
                        self.assertEqual(results[GATE_JOB], "skipped", where)
                        self.assertFalse(envs & self.ran(results), where)
                        continue
                    for job_name, result in results.items():
                        if job_name != GATE_JOB and result != "skipped":
                            self.assertEqual(results[GATE_JOB], "success", f"P2 {where} {job_name}")
                    for job_name in envs & self.ran(results):
                        self.assertEqual(results[GATE_JOB], "success", f"P3 {where} {job_name}")
                        for dep in needs_of(jobs[job_name]):
                            self.assertEqual(results[dep], "success", f"P3 {where} {job_name} needs {dep}")

    def test_the_model_applies_the_implicit_success_rule(self):
        # The documented rule: success() applies unless the if calls a status function.
        jobs = {
            "gate": {"if": "github.event_name == 'workflow_run'"},
            "unguarded": {"needs": "gate", "if": "github.event_name == 'workflow_run'"},
            "guarded": {"needs": "gate", "if": "success() && github.event_name == 'workflow_run'"},
            "plain": {"needs": "gate"},
            "always": {"needs": "gate", "if": "always() && needs.gate.result == 'success'"},
        }
        ctx = workflow_run_ctx(GOOD_TRIGGER)
        failed = schedule(jobs, ctx, {"gate": "failure"})
        for job_name in ("unguarded", "guarded", "plain", "always"):
            self.assertEqual(failed[job_name], "skipped", job_name)
        passed = schedule(jobs, ctx, {})
        for job_name in ("unguarded", "guarded", "plain", "always"):
            self.assertEqual(passed[job_name], "success", job_name)

    def test_the_model_evaluates_the_operators_the_workflows_use(self):
        ctx = {"a": "Push", "b": None}
        cases = {
            "a == 'push'": True,
            "a != 'push'": False,
            "a == 'pull_request' || a == 'push'": True,
            "a == 'push' && b == 'x'": False,
            "!(b == 'x')": True,
            "b == null": True,
            "always()": True,
            "failure()": False,
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                self.assertEqual(_truthy(_Expression(text, ctx, {}).run()), expected)


# ---------------------------------------------------------------------------
# The real gate, run in bash against real git, then fed into the scheduler
# ---------------------------------------------------------------------------


def _without_git_env() -> dict:
    return {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


@unittest.skipUnless(shutil.which("git"), "git is required for the gate behaviour tests")
class TrustGateBehaviour(unittest.TestCase):
    """Runs the real gate step against real repositories, with a fake Actions context."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self._n = 0
        self.env = _without_git_env()
        self.env.update(
            {
                "HOME": str(self.root),
                "GIT_CONFIG_GLOBAL": os.devnull,
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_TERMINAL_PROMPT": "0",
                "GIT_AUTHOR_NAME": "test",
                "GIT_AUTHOR_EMAIL": "test@example.invalid",
                "GIT_COMMITTER_NAME": "test",
                "GIT_COMMITTER_EMAIL": "test@example.invalid",
            }
        )
        self.origin = self.root / "origin.git"
        self.seed = self.root / "seed"
        self._git("init", "-q", "--bare", str(self.origin), cwd=self.root)
        self._git("init", "-q", str(self.seed), cwd=self.root)
        self._git("symbolic-ref", "HEAD", "refs/heads/main", cwd=self.seed)
        self._git("remote", "add", "origin", self.origin.as_uri(), cwd=self.seed)
        self.a = self._commit("a")
        self.b = self._commit("b")  # main tip
        self._git("push", "-q", "origin", "main", cwd=self.seed)
        self._git("checkout", "-q", "-b", "feat", cwd=self.seed)
        self.feat = self._commit("feat")  # not on main
        self._git("push", "-q", "origin", "feat", cwd=self.seed)
        self._git("checkout", "-q", "main", cwd=self.seed)

    def tearDown(self):
        self._tmp.cleanup()

    def _git(self, *args: str, cwd: Path) -> str:
        result = subprocess.run(
            ["git", *args], cwd=cwd, env=self.env, check=True, capture_output=True, text=True
        )
        return result.stdout.strip()

    def _commit(self, label: str) -> str:
        (self.seed / f"{label}.txt").write_text(label + "\n", encoding="utf-8")
        self._git("add", f"{label}.txt", cwd=self.seed)
        self._git("-c", "commit.gpgsign=false", "commit", "-q", "-m", label, cwd=self.seed)
        return self._git("rev-parse", "HEAD", cwd=self.seed)

    def clone_head(self, sha: str, shallow: bool = False) -> Path:
        """Build a checkout the way actions/checkout does: a remote named origin, then one commit."""
        self._n += 1
        work = self.root / f"work-{self._n}"
        self._git("init", "-q", str(work), cwd=self.root)
        self._git("symbolic-ref", "HEAD", "refs/heads/main", cwd=work)
        self._git("remote", "add", "origin", self.origin.as_uri(), cwd=work)
        if shallow:
            self._git("fetch", "-q", "--no-tags", "--depth=1", "origin", sha, cwd=work)
            self._git("checkout", "-q", "--detach", "FETCH_HEAD", cwd=work)
        else:
            self._git("fetch", "-q", "--no-tags", "origin", "+refs/heads/*:refs/remotes/origin/*", cwd=work)
            self._git("checkout", "-q", "--detach", sha, cwd=work)
        return work

    def trigger(self, **overrides: str) -> dict:
        return {**GOOD_TRIGGER, "WR_HEAD_SHA": self.b, **overrides}

    def run_gate(self, work: Path, **overrides: str) -> subprocess.CompletedProcess:
        script = gate_step(SERVER)["run"]
        return subprocess.run(
            ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", script],
            cwd=work,
            env={**self.env, **self.trigger(**overrides)},
            capture_output=True,
            text=True,
        )

    def assertRefused(self, result: subprocess.CompletedProcess, *fragments: str) -> None:
        output = result.stdout + result.stderr
        self.assertNotEqual(result.returncode, 0, output)
        self.assertNotIn("is an ancestor of origin/main", output)
        for fragment in fragments:
            self.assertIn(fragment, output)

    def assert_gate_outcome_schedules(self, result: subprocess.CompletedProcess, trigger: dict) -> None:
        """Feed the gate's real exit status into the real workflows and check nothing cloud-side runs."""
        outcome = "success" if result.returncode == 0 else "failure"
        ctx = workflow_run_ctx(trigger)
        for name in DEPLOY_WORKFLOWS:
            jobs = load(name)["jobs"]
            ran = {j for j, r in schedule(jobs, ctx, {GATE_JOB: outcome}).items() if r != "skipped"}
            if outcome == "failure":
                self.assertEqual(ran, {GATE_JOB}, name)
            else:
                self.assertTrue(environment_jobs(name) <= ran, name)

    # Accepted paths

    def test_accepts_a_commit_that_main_contains(self):
        work = self.clone_head(self.b)
        result = self.run_gate(work)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("is an ancestor of origin/main", result.stdout)
        self.assert_gate_outcome_schedules(result, self.trigger())

    def test_accepts_a_main_commit_from_a_shallow_checkout(self):
        work = self.clone_head(self.b, shallow=True)
        self.assertEqual(self._git("rev-parse", "--is-shallow-repository", cwd=work), "true")
        result = self.run_gate(work)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        # The gate fetched full history, so the repository is no longer shallow.
        self.assertEqual(self._git("rev-parse", "--is-shallow-repository", cwd=work), "false")

    # Refusals: the trigger identity

    def test_refuses_a_different_workflow_file_with_the_same_name(self):
        work = self.clone_head(self.b)
        self.assertRefused(self.run_gate(work, WR_PATH=".github/workflows/other.yml"), "Trigger is")

    def test_refuses_a_non_push_trigger(self):
        work = self.clone_head(self.b)
        self.assertRefused(self.run_gate(work, WR_EVENT="pull_request"), "Trigger event is")

    def test_refuses_a_failed_infra_run(self):
        work = self.clone_head(self.b)
        self.assertRefused(self.run_gate(work, WR_CONCLUSION="failure"), "concluded")

    def test_refuses_a_branch_other_than_main(self):
        work = self.clone_head(self.feat)
        self.assertRefused(self.run_gate(work, WR_BRANCH="feat", WR_HEAD_SHA=self.feat), "not main")

    def test_refuses_a_fork_repository(self):
        work = self.clone_head(self.b)
        self.assertRefused(self.run_gate(work, WR_HEAD_REPO="attacker/han-test"), "Trigger repository")

    def test_refuses_a_missing_head_repository(self):
        # A deleted fork gives a null head_repository, which arrives here as an empty string.
        work = self.clone_head(self.b)
        self.assertRefused(self.run_gate(work, WR_HEAD_REPO=""), "Trigger repository")

    def test_refuses_a_head_that_is_not_a_full_sha(self):
        work = self.clone_head(self.b)
        self.assertRefused(self.run_gate(work, WR_HEAD_SHA="main"), "not a full commit SHA")

    # Refusals: the commit's ancestry

    def test_refuses_a_feature_commit_behind_a_tag_named_main(self):
        # A tag called main has head_branch "main", so only the ancestry check can refuse it.
        work = self.clone_head(self.feat)
        self.assertRefused(
            self.run_gate(work, WR_BRANCH="main", WR_HEAD_SHA=self.feat), "is not an ancestor of origin/main"
        )

    def test_refuses_a_commit_that_a_force_push_removed_from_main(self):
        self._git("checkout", "-q", "main", cwd=self.seed)
        removed = self._commit("removed")
        self._git("push", "-q", "origin", "main", cwd=self.seed)
        work = self.clone_head(removed)  # the object is local, so only ancestry can refuse it
        self._git("push", "-q", "--force", "origin", f"{self.a}:refs/heads/main", cwd=self.seed)
        self.assertRefused(self.run_gate(work, WR_HEAD_SHA=removed), "is not an ancestor of origin/main")

    def test_refuses_a_commit_missing_from_the_repository(self):
        work = self.clone_head(self.b)
        self.assertRefused(self.run_gate(work, WR_HEAD_SHA="1" * 40), "is not in this repository")

    # Refusals: git and origin failures fail closed

    def test_fails_closed_when_origin_cannot_be_fetched(self):
        work = self.clone_head(self.b)
        self._git("remote", "set-url", "origin", (self.root / "gone.git").as_uri(), cwd=work)
        self.assertRefused(self.run_gate(work))

    def test_fails_closed_when_origin_has_no_main(self):
        empty = self.root / "empty.git"
        self._git("init", "-q", "--bare", str(empty), cwd=self.root)
        work = self.clone_head(self.b)
        self._git("remote", "set-url", "origin", empty.as_uri(), cwd=work)
        self.assertRefused(self.run_gate(work))

    # The refusals, end to end: the real gate's exit status decides which production jobs run

    def test_every_refused_trigger_runs_no_production_job(self):
        cases = {
            "wrong workflow file": {"WR_PATH": ".github/workflows/other.yml"},
            "pull request event": {"WR_EVENT": "pull_request"},
            "failed infra run": {"WR_CONCLUSION": "failure"},
            "fork": {"WR_HEAD_REPO": "attacker/han-test"},
            "non-main branch": {"WR_BRANCH": "feat", "WR_HEAD_SHA": self.feat},
            "feature commit": {"WR_HEAD_SHA": self.feat},
        }
        work = self.clone_head(self.b)
        for label, overrides in cases.items():
            with self.subTest(case=label):
                result = self.run_gate(work, **overrides)
                self.assertNotEqual(result.returncode, 0, label)
                self.assert_gate_outcome_schedules(result, self.trigger(**overrides))


if __name__ == "__main__":
    unittest.main()
