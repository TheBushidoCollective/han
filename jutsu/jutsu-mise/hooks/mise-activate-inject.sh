#!/usr/bin/env bash
# Inject mise activate into CLAUDE_ENV_FILE if not already present

set -e

# Get project root (CLAUDE_PROJECT_ROOT or current working directory)
PROJECT_ROOT="${CLAUDE_PROJECT_ROOT:-$(pwd)}"

# Check for mise config files in project root
# Supported config paths: https://mise.jdx.dev/configuration.html
has_mise_config() {
	local root="$1"
	[[ -f "$root/mise.toml" ]] ||
		[[ -f "$root/.mise.toml" ]] ||
		[[ -f "$root/mise.local.toml" ]] ||
		[[ -f "$root/.mise.local.toml" ]] ||
		[[ -f "$root/.config/mise.toml" ]] ||
		[[ -f "$root/.config/mise/config.toml" ]] ||
		[[ -f "$root/.tool-versions" ]]
}

# Check if project has a mise config
if ! has_mise_config "$PROJECT_ROOT"; then
	echo "No mise config found in project root ($PROJECT_ROOT), skipping mise activation" >&2
	exit 0
fi

# Check if mise is available
if ! command -v mise &>/dev/null; then
	echo "mise is not installed, skipping mise activation" >&2
	echo "Install mise: https://mise.jdx.dev/getting-started.html" >&2
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
