#!/usr/bin/env bash
set -euo pipefail

LSP_CMD="terraform-ls"
BIN_DIR="${HOME}/.claude/bin"

# Graceful degradation: Check if terraform files exist in the project
# This prevents the LSP from walking entire directory trees in non-terraform projects
has_terraform_files() {
    # Check common locations for terraform files
    # Use find with maxdepth 5 for monorepo support (apps/name/infra/*.tf)
    # Exclude node_modules, .git, vendor to keep search fast
    local found
    found=$(find . -maxdepth 5 \
        -path "*/node_modules" -prune -o \
        -path "*/.git" -prune -o \
        -path "*/vendor" -prune -o \
        -path "*/.terraform" -prune -o \
        -name "*.tf" -type f -print 2>/dev/null | head -1)
    [[ -n "$found" ]]
}

if ! has_terraform_files; then
    echo "No .tf files found in project. Terraform LSP disabled." >&2
    exit 0
fi

# Check if already installed
if command -v "$LSP_CMD" &> /dev/null; then
    exec "$LSP_CMD" "$@"
fi

if [[ -x "${BIN_DIR}/${LSP_CMD}" ]]; then
    exec "${BIN_DIR}/${LSP_CMD}" "$@"
fi

echo "Installing $LSP_CMD..." >&2

# Try brew first on macOS
if [[ "$(uname -s)" == "Darwin" ]] && command -v brew &> /dev/null; then
    brew install hashicorp/tap/terraform-ls
    exec "$LSP_CMD" "$@"
fi

# Try apt on Debian/Ubuntu
if command -v apt-get &> /dev/null; then
    echo "For Debian/Ubuntu, please run:" >&2
    echo "  curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -" >&2
    echo "  sudo apt-add-repository \"deb [arch=amd64] https://apt.releases.hashicorp.com \$(lsb_release -cs) main\"" >&2
    echo "  sudo apt-get update && sudo apt-get install terraform-ls" >&2
fi

# Download from HashiCorp releases
mkdir -p "$BIN_DIR"

# Determine platform
case "$(uname -s)" in
    Darwin) OS="darwin" ;;
    Linux) OS="linux" ;;
    *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

# Get latest version from releases API
LATEST_VERSION=$(curl -fsSL https://api.github.com/repos/hashicorp/terraform-ls/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
DOWNLOAD_URL="https://releases.hashicorp.com/terraform-ls/${LATEST_VERSION}/terraform-ls_${LATEST_VERSION}_${OS}_${ARCH}.zip"

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

if command -v curl &>/dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "${TEMP_DIR}/terraform-ls.zip"
else
    wget -q "$DOWNLOAD_URL" -O "${TEMP_DIR}/terraform-ls.zip"
fi

unzip -q "${TEMP_DIR}/terraform-ls.zip" -d "$BIN_DIR"
chmod +x "${BIN_DIR}/${LSP_CMD}"
echo "$LSP_CMD installed successfully" >&2

exec "${BIN_DIR}/${LSP_CMD}" "$@"
