#!/usr/bin/env bash
set -euo pipefail

# Check that the latest release satisfies the installer contract (20 paired assets).
# Accepts optional argument: path to a local release JSON fixture for testing.

FIXTURE="${1:-}"

if [ -n "$FIXTURE" ] && [ -f "$FIXTURE" ]; then
  RELEASE_JSON=$(cat "$FIXTURE")
else
  RELEASE_URL="${HAN_RELEASE_API_URL:-https://api.github.com/repos/TheBushidoCollective/han/releases/latest}"
  AUTH_HEADER=()
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    AUTH_HEADER=(-H "Authorization: token ${GITHUB_TOKEN}")
  fi
  RELEASE_JSON=$(curl -fsSL "${AUTH_HEADER[@]}" "$RELEASE_URL" 2>/dev/null || echo "{}")
fi

TAG=$(echo "$RELEASE_JSON" | grep -oE '"tag_name": *"[^"]+"' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$TAG" ]; then
  echo "contract unmet: could not read release or release has no tag"
  exit 1
fi

REQUIRED_ASSETS=(
  "han-linux-x64"
  "han-linux-x64.sha256"
  "han-coordinator-linux-x64"
  "han-coordinator-linux-x64.sha256"
  "han-linux-arm64"
  "han-linux-arm64.sha256"
  "han-coordinator-linux-arm64"
  "han-coordinator-linux-arm64.sha256"
  "han-darwin-x64"
  "han-darwin-x64.sha256"
  "han-coordinator-darwin-x64"
  "han-coordinator-darwin-x64.sha256"
  "han-darwin-arm64"
  "han-darwin-arm64.sha256"
  "han-coordinator-darwin-arm64"
  "han-coordinator-darwin-arm64.sha256"
  "han-windows-x64.exe"
  "han-windows-x64.exe.sha256"
  "han-coordinator-windows-x64.exe"
  "han-coordinator-windows-x64.exe.sha256"
)

MISSING=()
for asset in "${REQUIRED_ASSETS[@]}"; do
  if ! echo "$RELEASE_JSON" | grep -q "\"name\": *\"$asset\""; then
    MISSING+=("$asset")
  fi
done

if [ ${#MISSING[@]} -eq 0 ]; then
  echo "contract met: release $TAG has all 20 required paired assets"
  exit 0
else
  echo "contract unmet: release $TAG is missing ${#MISSING[@]} required assets (${MISSING[*]})"
  exit 1
fi
