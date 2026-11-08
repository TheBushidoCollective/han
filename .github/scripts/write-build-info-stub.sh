#!/usr/bin/env bash
set -euo pipefail

DEST="${1:-packages/han/lib/build-info.generated.ts}"
VERSION="${2:-0.0.0-ci}"
BUILD_KIND="${3:-dev}"
PIN="${4:-null}"

mkdir -p "$(dirname "$DEST")"
if [[ "$PIN" != "null" && "$PIN" != \"*\" ]]; then
  PIN="\"$PIN\""
fi

cat > "$DEST" << EOF
// Auto-generated build-info stub
export const HAN_BUILD_KIND: 'release' | 'dev' = "${BUILD_KIND}";
export const HAN_VERSION = "${VERSION}";
export const COORDINATOR_SHA256: string | null = ${PIN};
export const DETECT_PLUGINS_PROMPT = "You are a plugin detector.";
EOF
