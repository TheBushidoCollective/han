#!/usr/bin/env python3
"""Decide whether one Cloud Run revision started with a working database.

Input is the JSON array printed by:
  gcloud logging read 'resource.type="cloud_run_revision" AND
    resource.labels.service_name="han-server" AND
    resource.labels.revision_name="<revision>"' --format=json

han-server writes tracing-subscriber JSON to stdout. Cloud Run stores each line
as jsonPayload, and the message sits at jsonPayload.fields.message. Entries
without that shape, or from another revision, never count.

Exit 0 when every required startup line appears for the revision and no
degraded-mode or migration failure line does. Exit 1 otherwise, printing why.
"""

from __future__ import annotations

import argparse
import json
import sys

REQUIRED = (
    "Connected to PostgreSQL",
    "Migrations complete",
    "LISTEN/NOTIFY triggers created",
)

# Any of these means the revision is up but not usable as an API.
FORBIDDEN_PREFIXES = (
    "Database connection failed",
    "Migration failed",
    "Failed to create notify triggers",
    "PgListener failed",
)


def messages_for_revision(entries: list, revision: str) -> list[str]:
    """Return the log messages from entries that belong to `revision`."""
    out: list[str] = []
    for entry in entries:
        labels = (entry.get("resource") or {}).get("labels") or {}
        if labels.get("revision_name") != revision:
            continue
        payload = entry.get("jsonPayload")
        if not isinstance(payload, dict):
            continue
        fields = payload.get("fields")
        if isinstance(fields, dict) and isinstance(fields.get("message"), str):
            out.append(fields["message"])
    return out


def evaluate(entries: list, revision: str) -> tuple[bool, str]:
    messages = messages_for_revision(entries, revision)
    missing = [line for line in REQUIRED if not any(line in m for m in messages)]
    if missing:
        return False, f"missing startup lines for {revision}: {', '.join(missing)}"
    for message in messages:
        for prefix in FORBIDDEN_PREFIXES:
            if message.startswith(prefix) or prefix in message:
                return False, f"{revision} logged a failure: {message}"
    return True, f"{revision}: all startup lines present, no failure lines"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("logs", help="JSON file from gcloud logging read")
    parser.add_argument("revision", help="live Cloud Run revision name")
    args = parser.parse_args(argv)
    with open(args.logs, encoding="utf-8") as fh:
        entries = json.load(fh)
    ok, reason = evaluate(entries, args.revision)
    print(reason)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
