#!/bin/bash
# iOS Build Hook Script
# Builds an Xcode project/workspace with automatic scheme detection
# Prefers workspace over project (required for CocoaPods)

set -e

# Find workspace or project file
find_build_target() {
    # Prefer workspace (required for CocoaPods)
    local workspace
    workspace=$(find . -maxdepth 1 -name "*.xcworkspace" ! -name "project.xcworkspace" | head -1)
    if [ -n "$workspace" ]; then
        echo "workspace:$workspace"
        return
    fi

    # Fall back to project
    local project
    project=$(find . -maxdepth 1 -name "*.xcodeproj" | head -1)
    if [ -n "$project" ]; then
        echo "project:$project"
        return
    fi

    echo ""
}

# Get the first scheme from xcodebuild -list
get_scheme() {
    local target_type="$1"
    local target_path="$2"
    local flag

    if [ "$target_type" = "workspace" ]; then
        flag="-workspace"
    else
        flag="-project"
    fi

    xcodebuild "$flag" "$target_path" -list -json 2>/dev/null | node -e '
        const data = JSON.parse(require("fs").readFileSync(0));
        const schemes = data.project?.schemes || data.workspace?.schemes || [];
        if (schemes[0]) console.log(schemes[0]);
    '
}

# Main build function
main() {
    local build_target
    build_target=$(find_build_target)

    if [ -z "$build_target" ]; then
        echo "Error: No .xcworkspace or .xcodeproj found in current directory." >&2
        exit 1
    fi

    local target_type="${build_target%%:*}"
    local target_path="${build_target#*:}"

    echo "Using $target_type: $target_path"

    local scheme
    scheme=$(get_scheme "$target_type" "$target_path")

    if [ -z "$scheme" ]; then
        echo "Error: Could not detect scheme. Run 'xcodebuild -list' to see available schemes." >&2
        exit 1
    fi

    echo "Building scheme: $scheme"

    local flag
    if [ "$target_type" = "workspace" ]; then
        flag="-workspace"
    else
        flag="-project"
    fi

    # Run xcodebuild and capture exit status
    # Use generic simulator destination (no specific device required)
    # Close stdin (< /dev/null) to prevent any prompts from hanging
    local output
    local status
    output=$(xcodebuild \
        "$flag" "$target_path" \
        -scheme "$scheme" \
        -destination 'generic/platform=iOS Simulator' \
        build \
        CODE_SIGNING_ALLOWED=NO \
        2>&1 < /dev/null) || status=$?

    # Show last 20 lines of output
    echo "$output" | tail -20

    # Exit with xcodebuild's status (0 if not set)
    exit ${status:-0}
}

main "$@"
