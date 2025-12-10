#!/usr/bin/env bash
# Inject mise activate into CLAUDE_ENV_FILE if not already present

set -e

# Check if mise is available
if ! command -v mise &>/dev/null; then
	# mise not installed, nothing to do
	exit 0
fi

# Check if CLAUDE_ENV_FILE is set
if [ -z "$CLAUDE_ENV_FILE" ]; then
	echo "CLAUDE_ENV_FILE not set, skipping mise activation injection" >&2
	exit 0
fi

# Create parent directory if it doesn't exist
mkdir -p "$(dirname "$CLAUDE_ENV_FILE")"

# Create the file if it doesn't exist
if [ ! -f "$CLAUDE_ENV_FILE" ]; then
	touch "$CLAUDE_ENV_FILE"
fi

# Check if mise activate is already in the file
if grep -q 'mise activate' "$CLAUDE_ENV_FILE" 2>/dev/null; then
	# Already present, nothing to do
	exit 0
fi

# Append mise activate to the env file
# Using bash as it's the most common shell for Claude Code sessions
cat >>"$CLAUDE_ENV_FILE" <<'EOF'

# mise activation - added by jutsu-mise
eval "$(mise activate bash)"
EOF

echo "Injected mise activate into $CLAUDE_ENV_FILE" >&2
exit 0
