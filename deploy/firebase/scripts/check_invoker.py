#!/usr/bin/env python3
"""Check that a Cloud Run service has its invoker IAM check disabled.

Input is the JSON printed by:
  gcloud run services describe han-server --region us-central1 --format=json

Terraform sets invoker_iam_disabled on the service (cloudrun.tf). A deploy
must not change it, so the deploy workflow runs this after every deploy and
fails if the setting is off or missing. Missing is treated as off.

Which JSON field carries the setting is not verified against live output yet.
This script accepts the v2 field and the legacy annotation, and nothing else.

Exit 0 when the check is disabled, 1 otherwise.
"""

from __future__ import annotations

import json
import sys

ANNOTATION = "run.googleapis.com/invoker-iam-disabled"


def invoker_disabled(service: dict) -> bool:
    if service.get("invokerIamDisabled") is True:
        return True
    annotations = (service.get("metadata") or {}).get("annotations") or {}
    return annotations.get(ANNOTATION) == "true"


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    with open(argv[0], encoding="utf-8") as fh:
        service = json.load(fh)
    if invoker_disabled(service):
        print("invoker IAM check is disabled")
        return 0
    print("::error::invoker IAM check is not disabled on the service", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
