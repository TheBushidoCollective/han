#!/usr/bin/env python3
"""Authenticate workflow_run sources before analyzing or acting on failures."""
import json
import math
import os
import subprocess
import sys
from urllib.parse import quote

WORKFLOWS = {
    "Test Website": ".github/workflows/test-website.yml",
    "Auto Tag Release": ".github/workflows/auto-tag-release.yml",
}


def api(path, *args):
    result = subprocess.run(["gh", "api", path, *args], check=True, text=True,
                            stdout=subprocess.PIPE)
    return json.loads(result.stdout) if result.stdout.strip() else None


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def validate_source(allow_retried=False):
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as event_file:
        event = json.load(event_file)
    repo = event["repository"]
    run = event["workflow_run"]
    name = repo["full_name"]
    require(name == os.environ["GITHUB_REPOSITORY"], "repository mismatch")
    require(repo["default_branch"] == "main", "unexpected default branch")
    require(type(repo["id"]) is int and type(run["id"]) is int, "invalid ids")
    require(event.get("action") == "completed", "not a completion")
    require(run.get("name") in WORKFLOWS and run.get("path") == WORKFLOWS[run["name"]], "workflow mismatch")
    require(run.get("conclusion") == "failure" and run.get("status") == "completed", "run not failed")
    require(type(run.get("run_attempt")) is int and run["run_attempt"] == 1, "not the first attempt")
    require(run.get("event") in ("push", "pull_request"), "unsupported event")
    require(run.get("repository", {}).get("id") == repo["id"] and
            run.get("head_repository", {}).get("id") == repo["id"], "foreign repository")
    branch, sha = run.get("head_branch"), run.get("head_sha")
    require(isinstance(branch, str) and branch and isinstance(sha, str) and len(sha) == 40 and
            all(c in "0123456789abcdef" for c in sha), "invalid branch or sha")
    actor = run.get("actor") or {}
    login = actor.get("login")
    require(isinstance(login, str) and login and actor.get("type") == "User" and
            not login.endswith("[bot]"), "invalid actor")
    root = f"repos/{name}"
    current = api(f"{root}/actions/runs/{run['id']}")
    for key in ("id", "name", "path", "event", "head_branch", "head_sha"):
        require(current.get(key) == run.get(key), "run changed: " + key)
    require(current.get("repository", {}).get("id") == repo["id"] and
            current.get("head_repository", {}).get("id") == repo["id"] and
            current.get("actor", {}).get("login") == login, "run identity changed")
    if allow_retried:
        require(current.get("run_attempt") in (1, 2), "unexpected retry attempt")
    else:
        require(current.get("run_attempt") == 1 and current.get("status") == "completed" and
                current.get("conclusion") == "failure", "run already retried or changed")
    permission = api(f"{root}/collaborators/{quote(login, safe='')}/permission")
    require(permission.get("permission") in ("admin", "maintain", "write"), "actor lacks write access")
    current_branch = api(f"{root}/branches/{quote(branch, safe='')}")
    require(current_branch.get("commit", {}).get("sha") == sha, "branch moved")
    pr_number = None
    if run["event"] == "pull_request":
        pages = api(f"{root}/pulls", "--paginate", "--slurp", "-X", "GET",
                    "-f", "state=open", "-f", f"head={name.split('/')[0]}:{branch}",
                    "-f", "base=main", "-f", "per_page=100")
        pulls = [p for page in pages for p in page if
                 p.get("head", {}).get("repo", {}).get("id") == repo["id"] and
                 p.get("head", {}).get("ref") == branch and p.get("head", {}).get("sha") == sha and
                 p.get("base", {}).get("repo", {}).get("id") == repo["id"] and
                 p.get("base", {}).get("ref") == "main"]
        require(len(pulls) == 1 and type(pulls[0].get("number")) is int, "expected one matching open PR")
        pr_number = pulls[0]["number"]
    return name, run["id"], pr_number


def parse_result(raw):
    def reject_constant(value):
        raise ValueError("invalid JSON constant: " + value)
    result = json.loads(raw, parse_constant=reject_constant)
    require(isinstance(result, dict) and set(result) == {"is_flaky", "confidence", "summary"}, "invalid result fields")
    confidence = result["confidence"]
    require(type(result["is_flaky"]) is bool and type(confidence) in (int, float) and
            math.isfinite(confidence) and 0 <= confidence <= 1 and
            isinstance(result["summary"], str) and bool(result["summary"].strip()), "invalid result values")
    return result


def act():
    result = parse_result(os.environ["ANALYSIS_RESULT"])
    name, run_id, pr_number = validate_source()
    retried = False
    action = "No automatic retry: this failure appears to need manual review."
    if result["is_flaky"] and result["confidence"] >= 0.7:
        try:
            api(f"repos/{name}/actions/runs/{run_id}/rerun-failed-jobs", "-X", "POST")
            retried = True
            action = "The failed jobs were submitted for an automatic retry."
        except subprocess.CalledProcessError:
            action = "The automatic retry request failed; manual review is needed."
    elif result["is_flaky"]:
        action = "No automatic retry: confidence is below 0.7."
    if pr_number is not None:
        confirmed = validate_source(allow_retried=retried)
        require(confirmed == (name, run_id, pr_number), "PR identity changed")
        body = (f"## Test failure analysis\n\n**Analysis**: {result['summary']}\n\n"
                f"**Confidence**: {result['confidence']}\n\n{action}\n\n"
                f"[View workflow run](https://github.com/{name}/actions/runs/{run_id})")
        subprocess.run(["gh", "api", f"repos/{name}/issues/{pr_number}/comments", "-X", "POST",
                        "-f", f"body={body}"], check=True)
    if not retried and result["is_flaky"] and result["confidence"] >= 0.7:
        raise RuntimeError("retry failed")


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["gate"]:
            validate_source()
        elif sys.argv[1:] == ["act"]:
            act()
        else:
            raise ValueError("expected gate or act")
    except (KeyError, TypeError, ValueError, OSError, subprocess.CalledProcessError, RuntimeError) as error:
        print(f"Failure analysis refused: {error}", file=sys.stderr)
        sys.exit(1)
