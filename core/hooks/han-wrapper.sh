#!/usr/bin/env bash
#
# Han CLI Wrapper
#
# Ensures han binary is available, then execs it.
# Works in both persistent and ephemeral environments (Claude Code Web).
#
# - Honors HAN_BIN env var (set by parent han with hanBinary config)
# - Falls back to ~/.local/bin/han-bin (the real binary)
# - Auto-installs via install.sh if not found
#
# Layout:
#   ~/.local/bin/han      <- this wrapper (stays in place)
#   ~/.local/bin/han-bin  <- real binary (downloaded by install.sh)
#

# Honor existing HAN_BIN (may be set by parent han process with hanBinary)
HAN_BIN="${HAN_BIN:-$HOME/.local/bin/han-bin}"

# Install if binary doesn't exist
if [ ! -x "$HAN_BIN" ]; then
    # Use embedded install script (downloads from GitHub, which is usually allowed)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    HAN_INSTALL_TARGET=han-bin bash "$SCRIPT_DIR/install-han.sh" 2>/dev/null
fi

# Export so child han commands inherit it
export HAN_BIN
exec "$HAN_BIN" "$@"
