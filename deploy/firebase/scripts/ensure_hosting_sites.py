#!/usr/bin/env python3
"""Create the Han Hosting sites that do not exist yet. Idempotent.

Runs in the han-hosting deploy job, as the Hosting deployer, with the pinned
Firebase CLI installed (deploy/firebase/package-lock.json). A site is created only
when the site list does not name it, and a failed list stops the run. Nothing is
deleted.

Usage: ensure_hosting_sites.py PROJECT_ID
"""

from __future__ import annotations

import json
import subprocess
import sys

SITES = ("han-guru-dashboard", "han-guru-app", "han-guru-api")
FIREBASE = ["npx", "--no-install", "firebase"]


def run_firebase(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run([*FIREBASE, *args], capture_output=True, text=True, timeout=600)


def list_sites(project: str, run=run_firebase) -> set[str]:
    proc = run(["hosting:sites:list", "--json", "--project", project])
    if proc.returncode != 0:
        raise RuntimeError(f"firebase hosting:sites:list failed ({proc.returncode}): {proc.stderr.strip()}")
    payload = json.loads(proc.stdout)
    # The CLI wraps the command result: {"status": "success", "result": {"sites": [...]}}.
    sites = payload["result"]["sites"]
    # A site's resource name is projects/<number>/sites/<site-id>.
    return {site["name"].rsplit("/", 1)[-1] for site in sites}


def ensure(project: str, run=run_firebase) -> list[str]:
    existing = list_sites(project, run)
    created: list[str] = []
    for site in SITES:
        if site in existing:
            continue
        proc = run(["hosting:sites:create", site, "--project", project, "--non-interactive"])
        if proc.returncode != 0:
            raise RuntimeError(f"firebase hosting:sites:create {site} failed: {proc.stderr.strip()}")
        created.append(site)
    return created


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: ensure_hosting_sites.py PROJECT_ID", file=sys.stderr)
        return 2
    try:
        created = ensure(argv[0])
    except RuntimeError as err:
        print(f"::error::{err}", file=sys.stderr)
        return 1
    print(f"hosting sites ready; created: {', '.join(created) or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
