#!/usr/bin/env python3
"""Fail a Terraform plan that deletes or replaces anything not allowlisted.

Usage: plan_guard.py <plan.json> [allowed-address ...]

<plan.json> is `terraform show -json <planfile>`. A resource whose actions
include "delete" is either a delete or a replace (delete then create), so both
are caught by the same check. Addresses on the command line are the reviewed
exceptions; the default allowlist is empty.
"""

from __future__ import annotations

import json
import sys


def destructive_addresses(plan: dict) -> list[str]:
    out = []
    for change in plan.get("resource_changes") or []:
        actions = (change.get("change") or {}).get("actions") or []
        if "delete" in actions:
            out.append(change.get("address", "<unknown>"))
    return out


def unexpected(plan: dict, allowed: set[str]) -> list[str]:
    return [a for a in destructive_addresses(plan) if a not in allowed]


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    with open(argv[0], encoding="utf-8") as fh:
        plan = json.load(fh)
    bad = unexpected(plan, set(argv[1:]))
    for address in bad:
        print(f"::error::plan deletes or replaces {address}, which is not allowlisted")
    if bad:
        return 1
    print("no unexpected deletes or replaces")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
