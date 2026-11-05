#!/usr/bin/env python3
"""Record the real error text each describe returns for a missing object.

Runs read-only describe commands against names that cannot exist. The bootstrap
treats only the recorded "missing" marker as absence, so the marker must be
what the installed tools actually print. Any other failure stops the run.

Usage: capture_not_found.py [output-path]
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PROBE = "han-probe-does-not-exist-7f3a"
PROJECT = "thebushido-co"

PROBES = {
    "service-account": ["gcloud", "iam", "service-accounts", "describe",
                        f"{PROBE}@{PROJECT}.iam.gserviceaccount.com", f"--project={PROJECT}", "--format=json"],
    # Custom role IDs allow letters, digits, underscores and periods only.
    "role": ["gcloud", "iam", "roles", "describe", "hanProbeMissing7f3a", f"--project={PROJECT}", "--format=json"],
    "storage-bucket": ["gcloud", "storage", "buckets", "describe", f"gs://{PROBE}", "--format=json"],
    "wif-pool": ["gcloud", "iam", "workload-identity-pools", "describe", PROBE, "--location=global",
                 f"--project={PROJECT}", "--format=json"],
    "wif-provider": ["gcloud", "iam", "workload-identity-pools", "providers", "describe", PROBE,
                     f"--workload-identity-pool={PROBE}", "--location=global", f"--project={PROJECT}", "--format=json"],
    "run-service": ["gcloud", "run", "services", "describe", PROBE, "--region=us-central1",
                    f"--project={PROJECT}", "--format=json"],
    "artifact-repo": ["gcloud", "artifacts", "repositories", "describe", PROBE, "--location=us-central1",
                      f"--project={PROJECT}", "--format=json"],
    "logging-bucket": ["gcloud", "logging", "buckets", "describe", PROBE, "--location=us-central1",
                       f"--project={PROJECT}", "--format=json"],
    "logging-sink": ["gcloud", "logging", "sinks", "describe", PROBE, f"--project={PROJECT}", "--format=json"],
    "logging-view": ["gcloud", "logging", "views", "describe", PROBE, f"--bucket={PROBE}",
                     "--location=us-central1", f"--project={PROJECT}", "--format=json"],
    "sql-instance": ["gcloud", "sql", "instances", "describe", PROBE, f"--project={PROJECT}", "--format=json"],
    "secret": ["gcloud", "secrets", "describe", PROBE, f"--project={PROJECT}", "--format=json"],
}


def main(argv: list[str]) -> int:
    out = Path(argv[0]) if argv else Path(__file__).resolve().parents[1] / "not-found-markers.json"
    results = {}
    for name, argv_cmd in PROBES.items():
        proc = subprocess.run(argv_cmd, capture_output=True, text=True, timeout=120)
        text = (proc.stdout + proc.stderr).strip().splitlines()
        results[name] = {"returncode": proc.returncode, "first_line": text[0] if text else ""}
    out.write_text(json.dumps(results, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    for name, r in results.items():
        print(f"{name}: rc={r['returncode']} {r['first_line'][:120]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
