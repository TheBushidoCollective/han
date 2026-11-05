#!/usr/bin/env python3
"""Fail when Terraform state holds a secret value or a generated password.

Usage: state_guard.py <state.json>

<state.json> is `terraform show -json` with no plan file, i.e. the state. The
secret and SQL-password attributes are write-only, so Terraform should store
null for them. Any non-null value under those names means a secret reached
state, and the run fails so the value can be rotated before anything else
reads that state.
"""

from __future__ import annotations

import json
import sys

# Attribute names that carry a secret value or password, in any resource.
SECRET_KEYS = {"secret_data", "secret_data_wo", "password", "password_wo"}


def leaks(node, path: str = "") -> list[str]:
    found: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            here = f"{path}.{key}" if path else key
            if key in SECRET_KEYS and value not in (None, "", []):
                found.append(here)
            found.extend(leaks(value, here))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            found.extend(leaks(value, f"{path}[{i}]"))
    return found


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    with open(argv[0], encoding="utf-8") as fh:
        state = json.load(fh)
    found = leaks(state)
    for path in found:
        print(f"::error::state holds a secret value at {path}")
    if found:
        return 1
    print("no secret values in state")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
