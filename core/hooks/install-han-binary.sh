#!/usr/bin/env bash
# Check that han is available in PATH (required for MCP server invocation)

set -e

if command -v han &>/dev/null; then
	exit 0
fi

# han not found - provide installation instructions
cat >&2 <<'EOF'
han CLI not found in PATH.

Han is required for MCP server integration and hook execution.

Install via one of:

  # macOS (Homebrew)
  brew install thebushidocollective/tap/han

  # curl (macOS/Linux)
  curl -fsSL https://han.guru/install.sh | bash

  # npm (any platform)
  npm install -g @anthropic/han

After installation, restart your terminal or run:
  source ~/.bashrc  # or ~/.zshrc

EOF

exit 1
