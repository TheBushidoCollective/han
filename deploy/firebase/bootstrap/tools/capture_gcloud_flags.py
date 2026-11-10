#!/usr/bin/env python3
"""Record which flags each gcloud command accepts, from the installed gcloud.

Runs `gcloud <command> --help` for every command the bootstrap uses, and writes
the flags it finds to ../gcloud-flags.json. Help output is read-only. Nothing
is created, changed or granted.

The bootstrap tests check every flag the script passes against this file. The
file is regenerated when the SDK version changes, and its version is recorded.

Usage: capture_gcloud_flags.py [output-path]
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

COMMANDS = [
    "services enable",
    "iam roles create",
    "iam roles update",
    "iam roles describe",
    "storage buckets create",
    "storage buckets update",
    "storage buckets describe",
    "storage buckets add-iam-policy-binding",
    "storage buckets list",
    "iam workload-identity-pools create",
    "iam workload-identity-pools describe",
    "iam workload-identity-pools providers create-oidc",
    "iam workload-identity-pools providers describe",
    "iam workload-identity-pools providers list",
    "iam service-accounts create",
    "iam service-accounts describe",
    "iam service-accounts add-iam-policy-binding",
    "iam service-accounts remove-iam-policy-binding",
    "iam service-accounts get-iam-policy",
    "iam service-accounts set-iam-policy",
    "services enable",
    "iam service-accounts keys list",
    "projects add-iam-policy-binding",
    "run deploy",
    "run services describe",
    "run services add-iam-policy-binding",
    "artifacts repositories create",
    "artifacts repositories describe",
    "artifacts repositories add-iam-policy-binding",
    "logging buckets create",
    "logging buckets describe",
    "logging sinks create",
    "logging sinks describe",
    "logging views create",
    "logging views describe",
    "logging views add-iam-policy-binding",
    "logging read",
    "sql instances create",
    "sql instances describe",
    "sql instances list",
    "secrets create",
    "secrets describe",
    "secrets add-iam-policy-binding",
    "auth list",
    "sql databases create",
    "sql databases list",
    "sql users create",
    "sql users list",
    "sql users set-password",
    "secrets versions add",
    "secrets versions list",
    "secrets update",
]

FLAG_RE = re.compile(r"(?<![\w-])--(?:\[no-\])?([a-z][a-z0-9-]*)")


def capture(command: str) -> list[str]:
    argv = ["gcloud", *command.split(), "--help"]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(f"gcloud {command} --help failed: {proc.stderr.strip()}")
    flags = set()
    for match in FLAG_RE.finditer(proc.stdout):
        flags.add(match.group(1))
    # The no- form of a flag is the same flag.
    return sorted(flags)


def sdk_version() -> str:
    proc = subprocess.run(["gcloud", "version"], capture_output=True, text=True, timeout=60)
    for line in proc.stdout.splitlines():
        if line.startswith("Google Cloud SDK"):
            return line.strip()
    return "unknown"


def main(argv: list[str]) -> int:
    out = Path(argv[0]) if argv else Path(__file__).resolve().parents[1] / "gcloud-flags.json"
    data = {"sdk": sdk_version(), "commands": {cmd: capture(cmd) for cmd in COMMANDS}}
    out.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {out} for {data['sdk']}: {len(COMMANDS)} commands")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
