#!/bin/bash
# iOS Build Hook Script
# Builds an Xcode project/workspace with automatic scheme detection

set -e

# Get the first scheme from xcodebuild -list
get_scheme() {
    local json_output
    json_output=$(xcodebuild -list -json 2>/dev/null) || return 1

    # Extract first scheme from the schemes array
    # grep -A2 gets the "schemes" key and the first array element
    # tail -1 skips the "schemes" line itself
    # Then extract the quoted string
    echo "$json_output" | grep -A2 '"schemes"' | tail -1 | grep -o '"[^"]*"' | tr -d '"'
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
    local output
    local status
    output=$(xcodebuild \
        -scheme "$scheme" \
        -destination 'platform=iOS Simulator,name=iPhone 16' \
        build \
        CODE_SIGNING_ALLOWED=NO \
        2>&1) || status=$?

    # Show last 20 lines of output
    echo "$output" | tail -20

    # Exit with xcodebuild's status (0 if not set)
    exit ${status:-0}
}

main "$@"
