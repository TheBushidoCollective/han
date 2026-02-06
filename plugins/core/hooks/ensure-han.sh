#!/usr/bin/env bash
#
# Ensure han binary is available and up-to-date for this session.
# - Installs if missing via hosted install script
# - Checks for updates daily and upgrades in-place
# - Kills stale coordinator after upgrade (next hook restarts it)
# - Adds install dir to PATH via CLAUDE_ENV_FILE
#

HAN_CLAUDE_BIN="$HOME/.claude/bin/han"
HAN_LOCAL_BIN="$HOME/.local/bin/han"
HAN_DATA_DIR="$HOME/.claude/han"
UPDATE_STATE_FILE="$HAN_DATA_DIR/.update-state"
UPDATE_INTERVAL=86400  # 24 hours

# --- Helpers ---

ensure_path() {
  local bin_dir="$1"
  if [ -n "$CLAUDE_ENV_FILE" ]; then
    echo "export PATH=\"$bin_dir:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
}

# Find existing han binary path
resolve_han_path() {
  if command -v han >/dev/null 2>&1; then
    command -v han
  elif [ -x "$HAN_CLAUDE_BIN" ]; then
    echo "$HAN_CLAUDE_BIN"
  elif [ -x "$HAN_LOCAL_BIN" ]; then
    echo "$HAN_LOCAL_BIN"
  fi
}

needs_update_check() {
  [ ! -f "$UPDATE_STATE_FILE" ] && return 0
  local last_check
  last_check=$(cat "$UPDATE_STATE_FILE" 2>/dev/null || echo "0")
  local now
  now=$(date +%s)
  [ $((now - last_check)) -ge $UPDATE_INTERVAL ]
}

save_update_state() {
  mkdir -p "$HAN_DATA_DIR"
  date +%s > "$UPDATE_STATE_FILE"
}

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) echo "darwin-arm64" ;;
        x86_64|amd64)  echo "darwin-x64" ;;
      esac ;;
    Linux)
      case "$arch" in
        arm64|aarch64) echo "linux-arm64" ;;
        x86_64|amd64)  echo "linux-x64" ;;
      esac ;;
  esac
}

get_latest_version() {
  curl -fsSL --max-time 5 \
    "https://api.github.com/repos/TheBushidoCollective/han/releases/latest" 2>/dev/null |
    grep '"tag_name":' |
    sed -E 's/.*"v?([^"]+)".*/\1/'
}

# Update binary in-place, returns 0 on success
update_binary() {
  local han_path="$1"
  local latest_version="$2"
  local platform
  platform=$(detect_platform)
  [ -z "$platform" ] && return 1

  local url="https://github.com/TheBushidoCollective/han/releases/download/v${latest_version}/han-${platform}"
  local tmp
  tmp=$(mktemp)

  if curl -fsSL --max-time 60 "$url" -o "$tmp" 2>/dev/null; then
    chmod +x "$tmp"
    mv -f "$tmp" "$han_path"
    return 0
  else
    rm -f "$tmp"
    return 1
  fi
}

# Kill coordinator so next SessionStart hook restarts it with new binary
kill_stale_coordinator() {
  local pid_file="$HOME/.claude/.han-coordinator.pid"
  [ -f "$pid_file" ] || return 0
  local pid
  pid=$(cat "$pid_file" 2>/dev/null)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
}

# --- Main ---

han_path=$(resolve_han_path)

# Not installed at all — install fresh
if [ -z "$han_path" ]; then
  curl -fsSL https://han.guru/install.sh | bash 2>/dev/null
  save_update_state

  if [ -x "$HAN_LOCAL_BIN" ]; then
    ensure_path "$(dirname "$HAN_LOCAL_BIN")"
  elif [ -x "$HAN_CLAUDE_BIN" ]; then
    ensure_path "$(dirname "$HAN_CLAUDE_BIN")"
  fi
  exit 0
fi

# Installed but not in PATH — fix PATH
if ! command -v han >/dev/null 2>&1; then
  ensure_path "$(dirname "$han_path")"
fi

# Periodic update check
if needs_update_check; then
  current_version=$("$han_path" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  latest_version=$(get_latest_version)
  save_update_state

  if [ -n "$latest_version" ] && [ -n "$current_version" ] && [ "$current_version" != "$latest_version" ]; then
    if update_binary "$han_path" "$latest_version"; then
      kill_stale_coordinator
    fi
  fi
fi

exit 0
