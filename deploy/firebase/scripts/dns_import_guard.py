#!/usr/bin/env python3
"""Fail closed on an unfrozen legacy workspace or non-import Terraform plan."""
import json
import os
import sys
import urllib.error
import urllib.request

WORKSPACE = "ws-AA2EKyjD2QwuBzaM"
STATE_VERSION = "sv-LnLxbXprxmBMkekg"
BASE = "https://app.terraform.io/api/v2"
RECORDS = {
    "api": ("api.han.guru.", "CNAME"),
    "api_verify": ("_railway-verify.api.han.guru.", "TXT"),
    "website": ("app.han.guru.", "CNAME"),
    "website_verify": ("_railway-verify.app.han.guru.", "TXT"),
}
TERMINAL = {"applied", "planned_and_finished", "discarded", "canceled", "errored", "force_canceled"}


class Refuse(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def api(path, token):
    request = urllib.request.Request(BASE + path, headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.api+json"})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
            if response.status != 200:
                raise Refuse("Terraform Cloud read refused")
            return json.load(response)
    except (urllib.error.URLError, ValueError, OSError) as exc:
        raise Refuse("Terraform Cloud read failed") from exc

def check_workspace(doc):
    data = doc.get("data") or {}
    attrs, rel = data.get("attributes") or {}, data.get("relationships") or {}
    state = ((rel.get("current-state-version") or {}).get("data") or {}).get("id")
    if (data.get("id") != WORKSPACE or attrs.get("name") != "han-guru" or
            attrs.get("locked") is not True or attrs.get("auto-apply") is not False or
            "vcs-repo" not in attrs or attrs["vcs-repo"] is not None or state != STATE_VERSION):
        raise Refuse("legacy workspace is not frozen, detached and at the expected state version")


def check_runs(pages):
    for page in pages:
        if not isinstance(page.get("data"), list):
            raise Refuse("invalid legacy run listing")
        for run in page["data"]:
            if (run.get("attributes") or {}).get("status") not in TERMINAL:
                raise Refuse("legacy workspace has a nonterminal run")


def check_cloud(token):
    if not token:
        raise Refuse("TFC_READ_TOKEN is required")
    check_workspace(api("/organizations/thebushido-co/workspaces/han-guru", token))
    pages = []
    page = 1
    while True:
        doc = api(f"/workspaces/{WORKSPACE}/runs?page%5Bsize%5D=100&page%5Bnumber%5D={page}", token)
        pages.append(doc)
        metadata = (doc.get("meta") or {}).get("pagination") or {}
        total = metadata.get("total-pages")
        if not isinstance(total, int) or total < 1 or total > 100:
            raise Refuse("invalid run pagination")
        if page >= total:
            break
        page += 1
    check_runs(pages)


def check_plan(plan):
    if plan.get("errored") is not False or plan.get("complete") is not True:
        raise Refuse("plan is incomplete or errored")
    changes = plan.get("resource_changes")
    if not isinstance(changes, list):
        raise Refuse("plan lacks resource changes")
    if any(not isinstance(c, dict) or c.get("mode") not in ("managed", "data") for c in changes):
        raise Refuse("plan contains an unknown resource mode")
    if any((c.get("change") or {}).get("actions") not in (["read"], ["no-op"])
           for c in changes if c.get("mode") == "data"):
        raise Refuse("plan contains an unexpected data source operation")
    managed = [c for c in changes if c.get("mode") == "managed"]
    expected = {f'google_dns_record_set.legacy["{key}"]' for key in RECORDS}
    if len(managed) != 4 or {c.get("address") for c in managed} != expected:
        raise Refuse("plan does not contain exactly the four DNS imports")
    for change in managed:
        key = change.get("index")
        if key not in RECORDS:
            raise Refuse("unexpected DNS address")
        name, kind = RECORDS[key]
        expected_id = f"projects/waldrip-net/managedZones/han-guru/rrsets/{name}/{kind}"
        operation = change.get("change") or {}
        after = operation.get("after") or {}
        if (change.get("type") != "google_dns_record_set" or operation.get("actions") != ["no-op"] or
                (operation.get("importing") or {}).get("id") != expected_id or
                after.get("project") != "waldrip-net" or after.get("managed_zone") != "han-guru" or
                after.get("name") != name or after.get("type") != kind or
                not isinstance(after.get("ttl"), int) or not isinstance(after.get("rrdatas"), list) or
                not after["rrdatas"]):
            raise Refuse("DNS import is not an exact no-op")
        unknown = operation.get("after_unknown") or {}
        if any(unknown.get(field) for field in ("project", "managed_zone", "name", "type", "ttl", "rrdatas")):
            raise Refuse("DNS import contains unknown values")


def main():
    try:
        if sys.argv[1:] == ["cloud"]:
            check_cloud(os.environ.get("TFC_READ_TOKEN"))
        elif len(sys.argv) == 3 and sys.argv[1] == "plan":
            with open(sys.argv[2], encoding="utf-8") as f:
                check_plan(json.load(f))
        else:
            raise Refuse("usage: dns_import_guard.py cloud | plan PLAN_JSON")
        print("DNS import guard passed")
        return 0
    except (Refuse, OSError, ValueError) as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
