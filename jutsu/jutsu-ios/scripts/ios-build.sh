#!/bin/bash
# iOS Build Hook Script
# Builds an Xcode project/workspace with automatic scheme detection

set -e

# Get the first scheme from xcodebuild -list
get_scheme() {
    xcodebuild -list -json 2>/dev/null | node -e '
        const data = JSON.parse(require("fs").readFileSync(0));
        const schemes = data.project?.schemes || data.workspace?.schemes || [];
        if (schemes[0]) console.log(schemes[0]);
    '
}

# Main build function
main() {
    local scheme
    scheme=$(get_scheme)

    if [ -z "$scheme" ]; then
        echo "Error: Could not detect scheme. Run 'xcodebuild -list' to see available schemes." >&2
        exit 1
    fi

    echo "Building scheme: $scheme"

    # Run xcodebuild and capture exit status
    # Use generic simulator destination (no specific device required)
    # Close stdin (< /dev/null) to prevent any prompts from hanging
    local output
    local status
    output=$(xcodebuild \
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
