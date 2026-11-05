#!/usr/bin/env python3
"""Print the IAM condition that limits the apply identity's role grants.

The condition goes on the apply identity's roles/resourcemanager.projectIamAdmin
binding. It lets that identity add or remove only the roles in
apply-grant-allowlist.json. A grant of any other role, including owner, is
denied.

Usage: apply_condition.py            prints the CEL expression
       apply_condition.py --gcloud   prints the --condition argument for gcloud
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ALLOWLIST = Path(__file__).with_name("apply-grant-allowlist.json")


def allowed_roles() -> list[str]:
    return sorted(json.loads(ALLOWLIST.read_text(encoding="utf-8"))["roles"])


def expression() -> str:
    roles = ", ".join(f"'{r}'" for r in allowed_roles())
    return f"api.getAttribute('iam.googleapis.com/modifiedGrantsByRole', []).hasOnly([{roles}])"


def gcloud_condition() -> str:
    return f"--condition=expression={expression()},title=han-apply-grant-allowlist,description=apply identity may grant only allowlisted Han roles"


def main(argv: list[str]) -> int:
    if argv == ["--gcloud"]:
        print(gcloud_condition())
    elif not argv:
        print(expression())
    else:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
