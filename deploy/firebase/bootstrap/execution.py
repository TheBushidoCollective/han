#!/usr/bin/env python3
"""Validate and register one bounded Han bootstrap execution; never emit credentials."""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT_NUMBER = "911514101920"
REPOSITORY_ID = "1100192477"
OWNER_ID = "233175215"
REPOSITORY = "TheBushidoCollective/han"
WORKFLOW_REF = REPOSITORY + "/.github/workflows/han-bootstrap.yml@refs/heads/main"
ISSUER = "https://token.actions.githubusercontent.com"
PROVIDER_ID = "github"
SCOPES = "https://www.googleapis.com/auth/cloud-platform"
KEYS = frozenset({"version", "C", "H", "W", "R", "A", "T", "rotate_db_password", "pool_id",
                  "provider_id", "subject", "provider_resource", "audience", "member"})


class Refuse(Exception):
    pass


def deadline_timestamp(value: str) -> int:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", value):
        raise Refuse("deadline must be UTC timestamp")
    try:
        return int(dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc).timestamp())
    except ValueError as exc:
        raise Refuse("deadline is not a real timestamp") from exc


def make_manifest(commit: str, plan: str, website: str, run: str, attempt: str,
                  deadline: str, rotate: bool) -> dict:
    if not re.fullmatch(r"[0-9a-f]{40}", commit or "") or not re.fullmatch(r"[0-9a-f]{64}", plan or ""):
        raise Refuse("invalid Han commit or manifest digest")
    if not re.fullmatch(r"[0-9a-f]{40}", website or ""):
        raise Refuse("invalid website commit")
    if not re.fullmatch(r"[1-9][0-9]{0,19}", run or "") or attempt != "1" or type(rotate) is not bool:
        raise Refuse("invalid execution ID, attempt or rotation choice")
    deadline_timestamp(deadline)
    pool = f"han-bs-{run}-1"
    resource = f"projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{pool}/providers/{PROVIDER_ID}"
    subject = f"{REPOSITORY_ID}:{run}:1"
    return {"version": 1, "C": commit, "H": plan, "W": website, "R": run, "A": attempt,
            "T": deadline, "rotate_db_password": rotate, "pool_id": pool, "provider_id": PROVIDER_ID,
            "subject": subject, "provider_resource": resource, "audience": "https://iam.googleapis.com/" + resource,
            "member": f"principal://iam.googleapis.com/projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{pool}/subject/{subject}"}


def validate_manifest(doc: dict) -> dict:
    if not isinstance(doc, dict) or set(doc) != KEYS or type(doc.get("version")) is not int or doc["version"] != 1:
        raise Refuse("execution manifest schema mismatch")
    expected = make_manifest(doc["C"], doc["H"], doc["W"], doc["R"], doc["A"], doc["T"], doc["rotate_db_password"])
    if doc != expected:
        raise Refuse("execution manifest does not match derived identities")
    return expected


def provider_condition(m: dict) -> str:
    pairs = [("repository_owner_id", OWNER_ID), ("repository_id", REPOSITORY_ID),
             ("repository", REPOSITORY), ("ref", "refs/heads/main"), ("event_name", "workflow_dispatch"),
             ("workflow_ref", WORKFLOW_REF), ("sha", m["C"]), ("workflow_sha", m["C"]),
             ("run_id", m["R"]), ("run_attempt", "1"), ("runner_environment", "github-hosted"),
             ("environment", "han-bootstrap"), ("aud", m["audience"])]
    return " && ".join(f"assertion.{name} == '{value}'" for name, value in pairs) + f" && int(assertion.exp) <= {deadline_timestamp(m['T'])}"

def verify_provider(m: dict, provider: dict) -> None:
    oidc = provider.get("oidc") or {}
    mapping = {"google.subject": "assertion.repository_id + ':' + assertion.run_id + ':' + assertion.run_attempt"}
    if (provider.get("name") != m["provider_resource"] or provider.get("state") != "ACTIVE" or
            provider.get("disabled", False) is not False or provider.get("attributeMapping") != mapping or
            provider.get("attributeCondition") != provider_condition(m) or
            oidc.get("issuerUri") != ISSUER or oidc.get("allowedAudiences") != [m["audience"]]):
        raise Refuse("execution provider does not match the reviewed contract")


def check_ci(m: dict, *, enforce_window: bool = True) -> None:
    expected = {"GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": REPOSITORY, "GITHUB_REF": "refs/heads/main",
                "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_WORKFLOW_REF": WORKFLOW_REF,
                "RUNNER_ENVIRONMENT": "github-hosted", "GITHUB_SHA": m["C"],
                "GITHUB_RUN_ID": m["R"], "GITHUB_RUN_ATTEMPT": "1"}
    for key, value in expected.items():
        if os.environ.get(key) != value:
            raise Refuse(f"{key} does not identify the registered execution")
    if enforce_window:
        remaining = deadline_timestamp(m["T"]) - int(time.time())
        if not 2700 <= remaining <= 7200:
            raise Refuse("execution deadline is outside the allowed window")


def check_claims(m: dict, claims: dict) -> None:
    expected = {"repository_owner_id": OWNER_ID, "repository_id": REPOSITORY_ID, "repository": REPOSITORY,
                "ref": "refs/heads/main", "event_name": "workflow_dispatch", "workflow_ref": WORKFLOW_REF,
                "sha": m["C"], "workflow_sha": m["C"], "run_id": m["R"], "run_attempt": "1",
                "runner_environment": "github-hosted", "environment": "han-bootstrap", "aud": m["audience"]}
    if any(claims.get(k) != v for k, v in expected.items()):
        raise Refuse("GitHub assertion claim mismatch")
    exp = claims.get("exp")
    if type(exp) is not int or exp <= int(time.time()) or exp > deadline_timestamp(m["T"]):
        raise Refuse("GitHub assertion expiration is outside the registered window")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def http_json(url: str, *, data: bytes | None = None, headers: dict | None = None) -> dict:
    request = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            if response.status != 200:
                raise Refuse("identity endpoint refused request")
            return json.load(response)
    except (urllib.error.URLError, OSError, ValueError) as exc:
        # Never print endpoint bodies, URLs or exception text: they can contain credentials.
        raise Refuse("identity endpoint unavailable") from exc


def get_assertion(m: dict) -> tuple[str, dict]:
    raw_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL", "")
    token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "")
    parsed = urllib.parse.urlsplit(raw_url)
    if parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".actions.githubusercontent.com") or not token:
        raise Refuse("GitHub assertion endpoint is unavailable")
    sep = "&" if parsed.query else "?"
    doc = http_json(raw_url + sep + urllib.parse.urlencode({"audience": m["audience"]}),
                    headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
    assertion = doc.get("value")
    if not isinstance(assertion, str) or len(assertion.split(".")) != 3:
        raise Refuse("invalid GitHub assertion")
    try:
        payload = assertion.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (ValueError, TypeError) as exc:
        raise Refuse("invalid GitHub assertion payload") from exc
    check_claims(m, claims)
    return assertion, claims


def wait_for_federation(m: dict) -> None:
    check_ci(m)
    # Never persist or log assertions or tokens. Readiness proves both STS
    # federation and service-account impersonation before the pinned auth action.
    limit = min(time.monotonic() + 900, time.monotonic() + max(0, deadline_timestamp(m["T"]) - time.time() - 2700))
    while time.monotonic() < limit:
        assertion, _ = get_assertion(m)
        payload = json.dumps({"audience": "//iam.googleapis.com/" + m["provider_resource"],
                              "grantType": "urn:ietf:params:oauth:grant-type:token-exchange",
                              "requestedTokenType": "urn:ietf:params:oauth:token-type:access_token",
                              "subjectTokenType": "urn:ietf:params:oauth:token-type:jwt",
                              "scope": SCOPES, "subjectToken": assertion}).encode()
        try:
            response = http_json("https://sts.googleapis.com/v1/token", data=payload,
                                 headers={"Content-Type": "application/json"})
            federated = response.get("access_token")
            if isinstance(federated, str) and federated:
                credentials = http_json(
                    "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"
                    "terraform-bootstrap@thebushido-co.iam.gserviceaccount.com:generateAccessToken",
                    data=json.dumps({"scope": [SCOPES], "lifetime": "600s"}).encode(),
                    headers={"Content-Type": "application/json", "Authorization": "Bearer " + federated},
                )
                if isinstance(credentials.get("accessToken"), str) and credentials["accessToken"]:
                    print("Execution-specific federation is ready")
                    return
        except Refuse:
            pass
        time.sleep(5)
    raise Refuse("execution-specific federation did not become ready in its bounded window")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("register", "inspect", "ready"))
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--commit")
    parser.add_argument("--plan")
    parser.add_argument("--website")
    parser.add_argument("--deadline")
    parser.add_argument("--claims-file")
    parser.add_argument("--rotate", action="store_true")
    args = parser.parse_args()
    try:
        if args.mode == "register":
            m = make_manifest(args.commit, args.plan, args.website, os.environ.get("GITHUB_RUN_ID", ""),
                              os.environ.get("GITHUB_RUN_ATTEMPT", ""), args.deadline, args.rotate)
            check_ci(m)
            Path(args.manifest).write_text(json.dumps(m, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
            print("Registered execution", m["R"], "attempt", m["A"])
        elif args.mode == "inspect":
            m = validate_manifest(json.loads(Path(args.manifest).read_text(encoding="utf-8")))
            check_ci(m)
            if not args.claims_file:
                raise Refuse("claims metadata output path is required")
            _, claims = get_assertion(m)
            keys = ("repository_owner_id", "repository_id", "repository", "ref", "event_name", "workflow_ref",
                    "sha", "workflow_sha", "run_id", "run_attempt", "runner_environment", "environment", "aud", "exp")
            Path(args.claims_file).write_text(json.dumps({k: claims[k] for k in keys}, sort_keys=True,
                                                        separators=(",", ":")) + "\n", encoding="utf-8")
            print("Captured allowlisted execution claim metadata")
        else:
            m = validate_manifest(json.loads(Path(args.manifest).read_text(encoding="utf-8")))
            wait_for_federation(m)
        return 0
    except (Refuse, OSError, ValueError) as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
