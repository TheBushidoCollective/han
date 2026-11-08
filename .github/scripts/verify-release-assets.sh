#!/usr/bin/env bash
set -euo pipefail

RELEASE_DIR="${1:-release}"

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "Error: Release directory not found: $RELEASE_DIR" >&2
  exit 1
fi

COUNT=$(find "$RELEASE_DIR" -maxdepth 1 -type f | wc -l)
if [[ "$COUNT" -ne 20 ]]; then
  echo "Error: Expected exactly 20 release assets, found $COUNT" >&2
  exit 1
fi

# Verify each .sha256 file
for shafile in "$RELEASE_DIR"/*.sha256; do
  binfile="${shafile%.sha256}"
  if [[ ! -f "$binfile" ]]; then
    echo "Error: Matching binary not found for $shafile" >&2
    exit 1
  fi
  expected_sha=$(awk '{print $1}' "$shafile")
  actual_sha=$(sha256sum "$binfile" | awk '{print $1}')
  if [[ "$expected_sha" != "$actual_sha" ]]; then
    echo "Error: SHA-256 mismatch for $binfile: expected $expected_sha, got $actual_sha" >&2
    exit 1
  fi
done

echo "Verified all 20 release assets and checksums."
exit 0
