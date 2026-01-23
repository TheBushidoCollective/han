#!/usr/bin/env bash
# Common functions for safe wrappers
# Sourced by individual command wrappers

# Get the real command path (skip our wrapper)
get_real_command() {
    local cmd="$1"
    local wrapper_dir
    wrapper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Find the real command by searching PATH, excluding our wrapper directory
    local IFS=':'
    for dir in $PATH; do
        # Skip our wrapper directory
        [[ "$dir" == "$wrapper_dir" ]] && continue
        # Check if command exists and is executable
        if [[ -x "$dir/$cmd" ]]; then
            echo "$dir/$cmd"
            return 0
        fi
    done

    # Fallback to standard locations
    for dir in /bin /usr/bin /usr/local/bin; do
        if [[ -x "$dir/$cmd" ]]; then
            echo "$dir/$cmd"
            return 0
        fi
    done

    return 1
}

# Check if a path is within the project directory
is_in_project() {
    local path="$1"
    local project_root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

    # Resolve to absolute path
    local abs_path
    abs_path="$(cd "$(dirname "$path")" 2>/dev/null && pwd)/$(basename "$path")" 2>/dev/null
    if [[ -z "$abs_path" ]]; then
        # Path doesn't exist yet, try resolving parent
        local parent
        parent="$(dirname "$path")"
        if [[ -d "$parent" ]]; then
            abs_path="$(cd "$parent" && pwd)/$(basename "$path")"
        else
            # Can't resolve - allow and let real command handle errors
            return 0
        fi
    fi

    # Allow /tmp and /private/tmp (standard temp directories - safe)
    if [[ "$abs_path" == /tmp/* || "$abs_path" == /private/tmp/* ]]; then
        return 0
    fi

    # Allow Claude Config directory (plan files, settings, etc.)
    local claude_config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
    if [[ "$abs_path" == "$claude_config_dir"* ]]; then
        return 0
    fi

    # Check if path starts with project root
    if [[ "$abs_path" == "$project_root"* ]]; then
        return 0
    fi

    return 1
}

# Check if a path is a protected system directory
is_protected_path() {
    local path="$1"

    # Resolve to absolute path
    local abs_path
    abs_path="$(realpath "$path" 2>/dev/null || echo "$path")"

    # Protected directories
    local protected_dirs=(
        "/etc" "/usr" "/var" "/bin" "/sbin" "/lib" "/lib64"
        "/boot" "/sys" "/proc" "/dev" "/root"
        "/System" "/Library" "/Applications"  # macOS
    )

    for dir in "${protected_dirs[@]}"; do
        if [[ "$abs_path" == "$dir" || "$abs_path" == "$dir"/* ]]; then
            return 0
        fi
    done

    return 1
}

# Print error and exit
safe_error() {
    echo "🛡️ BLOCKED by Han safe-wrapper: $1" >&2
    exit 1
}
