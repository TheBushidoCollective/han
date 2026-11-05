#!/usr/bin/env python3
"""Record the attributes of each Terraform resource and data source Han uses.

Reads `terraform providers schema -json` from an initialised working directory
(local, read-only), and writes ../tf-schema.json with the attribute and block
names of every resource and data source in the list below. Tests check that each
attribute Terraform configures exists in this record, so an attribute the
installed provider does not know fails in CI before it fails in a plan.

Usage: capture_tf_schema.py [terraform-dir] [output-path]
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

RESOURCES = [
    "google_secret_manager_secret",
    "google_secret_manager_secret_version",
    "google_sql_database_instance",
    "google_sql_database",
    "google_sql_user",
    "google_cloud_run_v2_service",
    "google_cloud_run_v2_service_iam_member",
    "google_artifact_registry_repository_iam_member",
]

DATA_SOURCES = [
    "google_iam_workload_identity_pool",
    "google_service_account",
    "google_artifact_registry_repository",
]


def names(block: dict) -> dict:
    out = {}
    for attr in (block.get("attributes") or {}):
        out[attr] = "attribute"
    for name, nested in (block.get("block_types") or {}).items():
        out[name] = "block"
        for sub in names(nested.get("block") or {}):
            out[f"{name}.{sub}"] = "nested"
    return out


def capture(tf_dir: Path) -> dict:
    # Read the schema from a copy with the backend block removed. The real backend
    # needs a bucket and credentials, and the schema does not depend on it.
    import re
    import shutil
    import tempfile

    work = Path(tempfile.mkdtemp(prefix="tf-schema-"))
    try:
        for src in tf_dir.glob("*.tf"):
            text = re.sub(r'backend\s+"gcs"\s*\{\s*\}', "", src.read_text(encoding="utf-8"))
            (work / src.name).write_text(text, encoding="utf-8")
        for name in (".terraform.lock.hcl",):
            if (tf_dir / name).exists():
                shutil.copy(tf_dir / name, work / name)
        init = subprocess.run(["terraform", "init", "-backend=false", "-input=false"], cwd=work,
                              capture_output=True, text=True, timeout=600)
        if init.returncode != 0:
            raise RuntimeError(f"terraform init (no backend) failed: {init.stderr.strip()}")
        proc = subprocess.run(["terraform", "providers", "schema", "-json"], cwd=work,
                              capture_output=True, text=True, timeout=300)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    if proc.returncode != 0:
        raise RuntimeError(f"terraform providers schema failed: {proc.stderr.strip()}")
    schema = json.loads(proc.stdout)
    provider = schema["provider_schemas"]["registry.terraform.io/hashicorp/google"]
    found = {"resources": {}, "data_sources": {}}
    for name in RESOURCES:
        found["resources"][name] = sorted(names(provider["resource_schemas"][name]["block"]))
    for name in DATA_SOURCES:
        found["data_sources"][name] = sorted(names(provider["data_source_schemas"][name]["block"]))
    found["schema_format_version"] = schema.get("format_version", "")
    return found


def main(argv: list[str]) -> int:
    here = Path(__file__).resolve().parents[2]
    tf_dir = Path(argv[0]) if argv else here / "terraform"
    out = Path(argv[1]) if len(argv) > 1 else here / "bootstrap" / "tf-schema.json"
    out.write_text(json.dumps(capture(tf_dir), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
