#!/usr/bin/env bash
#
# Ensure han binary is available and up-to-date for this session.
# - Installs if missing via hosted install script
# - Checks for updates daily and upgrades in-place
# - Requests a verified coordinator restart after upgrading
# - Adds install dir to PATH via CLAUDE_ENV_FILE
#

HAN_CLAUDE_BIN="$HOME/.claude/bin/han"
HAN_LOCAL_BIN="$HOME/.local/bin/han"
UPDATE_STATE_DIR="${HAN_DATA_DIR:-${CLAUDE_CONFIG_DIR:+${CLAUDE_CONFIG_DIR}/han}}"
UPDATE_STATE_DIR="${UPDATE_STATE_DIR:-${HOME}/.han}"
UPDATE_STATE_FILE="$UPDATE_STATE_DIR/.update-state"
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
  mkdir -p "$UPDATE_STATE_DIR"
  date +%s > "$UPDATE_STATE_FILE"
}


get_latest_version() {
  curl -fsSL --max-time 5 \
    "https://api.github.com/repos/TheBushidoCollective/han/releases/latest" 2>/dev/null |
    grep '"tag_name":' |
    sed -E 's/.*"v?([^"]+)".*/\1/'
}

# The hosted installer verifies and installs both executables from one release.
update_binary() {
  local han_path="$1"
  local latest_version="$2"
  local installer
  installer=$(mktemp) || return 1
  if ! curl -fsSL --max-time 60 https://han.guru/install.sh -o "$installer"; then
    rm -f "$installer"
    return 1
  fi
  if HAN_INSTALL_DIR="$(dirname "$han_path")" \
    HAN_INSTALL_TARGET="$(basename "$han_path")" \
    HAN_VERSION="$latest_version" bash "$installer"; then
    rm -f "$installer"
    return 0
  fi
  rm -f "$installer"
  return 1
}

# --- Main ---

han_path=$(resolve_han_path)

# Not installed at all: install a verified pair.
if [ -z "$han_path" ]; then
  if ! update_binary "$HAN_LOCAL_BIN" ""; then
    echo "Han installation failed." >&2
    exit 1
  fi
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

  # Package managers own their installed files and must upgrade the pair together.
  if [ -n "$latest_version" ] && [ -n "$current_version" ] && [ "$current_version" != "$latest_version" ]; then
    case "$han_path" in
      "$HAN_CLAUDE_BIN"|"$HAN_LOCAL_BIN")
        if update_binary "$han_path" "$latest_version"; then
          "$han_path" coordinator restart || echo "Han coordinator restart requires your attention." >&2
        fi
        ;;
    esac
  fi
fi

exit 0
