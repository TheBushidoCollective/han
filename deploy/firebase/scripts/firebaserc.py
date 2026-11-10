#!/usr/bin/env python3
"""Write deploy/firebase/.firebaserc for one Firebase project.

firebase-tools looks up hosting targets by the real project ID, under
targets.<project>.hosting. A `default` key does not match, so every
`--only hosting:<target>` fails with "Deploy target ... not configured for
project ...". This writes both the default project and the target map under
the project ID.

Usage: firebaserc.py <project-id> [path-to-.firebaserc]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Site IDs are fixed in deploy/firebase/terraform/main.tf. The target names
# match deploy/firebase/firebase.json.
TARGETS = {
    "dashboard": ["han-guru-dashboard"],
    "app": ["han-guru-app"],
    "api": ["han-guru-api"],
}

PROJECT_RE = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")


def build(project: str) -> dict:
    if not PROJECT_RE.match(project):
        raise ValueError(f"not a valid GCP project ID: {project!r}")
    return {
        "projects": {"default": project},
        "targets": {project: {"hosting": dict(TARGETS)}},
    }


def main(argv: list[str]) -> int:
    if not argv or len(argv) > 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    path = Path(argv[1]) if len(argv) == 2 else Path(__file__).resolve().parents[1] / ".firebaserc"
    path.write_text(json.dumps(build(argv[0]), indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path} for project {argv[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
