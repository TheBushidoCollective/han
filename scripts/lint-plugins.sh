#!/bin/bash
# Plugin Linter for Han Marketplace
# Validates plugin structure and configuration files

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

error() {
    echo -e "${RED}ERROR:${NC} $1"
    ((ERRORS++))
}

warn() {
    echo -e "${YELLOW}WARN:${NC} $1"
    ((WARNINGS++))
}

success() {
    echo -e "${GREEN}OK:${NC} $1"
}

# Find all plugin directories
find_plugins() {
    find buki do sensei bushido -maxdepth 3 -name "plugin.json" -path "*/.claude-plugin/*" 2>/dev/null | while read -r plugin_json; do
        dirname "$(dirname "$plugin_json")"
    done
}

# Validate plugin.json is the only file in .claude-plugin/
validate_claude_plugin_dir() {
    local plugin_dir="$1"
    local claude_plugin_dir="$plugin_dir/.claude-plugin"

    if [ ! -d "$claude_plugin_dir" ]; then
        error "$plugin_dir: Missing .claude-plugin/ directory"
        return
    fi

    if [ ! -f "$claude_plugin_dir/plugin.json" ]; then
        error "$plugin_dir: Missing .claude-plugin/plugin.json"
        return
    fi

    # Check for extra files in .claude-plugin/
    local extra_files
    extra_files=$(find "$claude_plugin_dir" -type f ! -name "plugin.json" 2>/dev/null)
    if [ -n "$extra_files" ]; then
        while IFS= read -r file; do
            error "$file: Should not be in .claude-plugin/ - move to plugin root or hooks/"
        done <<< "$extra_files"
    fi
}

# Validate hooks.json location (should be in hooks/ directory)
validate_hooks_location() {
    local plugin_dir="$1"

    # Check for hooks.json at plugin root (wrong location)
    if [ -f "$plugin_dir/hooks.json" ]; then
        error "$plugin_dir/hooks.json: Should be in hooks/hooks.json"
    fi

    # Check for han-config.json at plugin root (wrong location)
    if [ -f "$plugin_dir/han-config.json" ]; then
        error "$plugin_dir/han-config.json: Should be in hooks/han-config.json"
    fi
}

# Validate han-config.json structure
validate_han_config() {
    local plugin_dir="$1"
    local han_config="$plugin_dir/hooks/han-config.json"

    if [ ! -f "$han_config" ]; then
        return  # han-config.json is optional
    fi

    # Check if file is valid JSON
    if ! jq empty "$han_config" 2>/dev/null; then
        error "$han_config: Invalid JSON"
        return
    fi

    # Check for dirsWith as string instead of array
    local dirs_with_strings
    dirs_with_strings=$(jq -r '.. | objects | select(has("dirsWith")) | select(.dirsWith | type == "string") | .dirsWith' "$han_config" 2>/dev/null)
    if [ -n "$dirs_with_strings" ]; then
        error "$han_config: dirsWith must be an array, not a string (found: \"$dirs_with_strings\")"
    fi

    # Check that hooks object exists
    if ! jq -e '.hooks' "$han_config" >/dev/null 2>&1; then
        error "$han_config: Missing 'hooks' object"
    fi

    # Validate each hook has required 'command' field
    local hooks_without_command
    hooks_without_command=$(jq -r '.hooks | to_entries[] | select(.value.command == null) | .key' "$han_config" 2>/dev/null)
    if [ -n "$hooks_without_command" ]; then
        while IFS= read -r hook_name; do
            error "$han_config: Hook '$hook_name' missing required 'command' field"
        done <<< "$hooks_without_command"
    fi
}

# Validate hooks.json structure (Claude Code hooks)
validate_hooks_json() {
    local plugin_dir="$1"
    local hooks_json="$plugin_dir/hooks/hooks.json"

    if [ ! -f "$hooks_json" ]; then
        return  # hooks.json is optional
    fi

    # Check if file is valid JSON
    if ! jq empty "$hooks_json" 2>/dev/null; then
        error "$hooks_json: Invalid JSON"
        return
    fi

    # Check for old format (direct Stop/SubagentStop arrays) vs new format (hooks wrapper)
    local has_hooks_wrapper
    has_hooks_wrapper=$(jq -e '.hooks' "$hooks_json" 2>/dev/null && echo "yes" || echo "no")

    if [ "$has_hooks_wrapper" = "no" ]; then
        # Old format - check for Stop without SubagentStop
        local has_stop
        local has_subagent_stop
        has_stop=$(jq -e '.Stop' "$hooks_json" 2>/dev/null && echo "yes" || echo "no")
        has_subagent_stop=$(jq -e '.SubagentStop' "$hooks_json" 2>/dev/null && echo "yes" || echo "no")

        if [ "$has_stop" = "yes" ] && [ "$has_subagent_stop" = "no" ]; then
            warn "$hooks_json: Has Stop hook but missing SubagentStop"
        fi
    else
        # New format with hooks wrapper
        local has_stop
        local has_subagent_stop
        has_stop=$(jq -e '.hooks.Stop' "$hooks_json" 2>/dev/null && echo "yes" || echo "no")
        has_subagent_stop=$(jq -e '.hooks.SubagentStop' "$hooks_json" 2>/dev/null && echo "yes" || echo "no")

        if [ "$has_stop" = "yes" ] && [ "$has_subagent_stop" = "no" ]; then
            warn "$hooks_json: Has Stop hook but missing SubagentStop"
        fi
    fi
}

# Validate plugin.json structure
validate_plugin_json() {
    local plugin_dir="$1"
    local plugin_json="$plugin_dir/.claude-plugin/plugin.json"

    if [ ! -f "$plugin_json" ]; then
        return  # Already reported in validate_claude_plugin_dir
    fi

    # Check if file is valid JSON
    if ! jq empty "$plugin_json" 2>/dev/null; then
        error "$plugin_json: Invalid JSON"
        return
    fi

    # Check required fields
    local name version description
    name=$(jq -r '.name // empty' "$plugin_json")
    version=$(jq -r '.version // empty' "$plugin_json")
    description=$(jq -r '.description // empty' "$plugin_json")

    if [ -z "$name" ]; then
        error "$plugin_json: Missing required 'name' field"
    fi

    if [ -z "$version" ]; then
        error "$plugin_json: Missing required 'version' field"
    fi

    if [ -z "$description" ]; then
        warn "$plugin_json: Missing 'description' field"
    fi

    # Validate name matches directory
    local dir_name
    dir_name=$(basename "$plugin_dir")
    if [ "$name" != "$dir_name" ]; then
        warn "$plugin_json: Plugin name '$name' doesn't match directory name '$dir_name'"
    fi
}

# Validate skill files
validate_skills() {
    local plugin_dir="$1"
    local skills_dir="$plugin_dir/skills"

    if [ ! -d "$skills_dir" ]; then
        return  # Skills are optional
    fi

    # Find all SKILL.md files
    find "$skills_dir" -name "SKILL.md" 2>/dev/null | while read -r skill_file; do
        # Check for frontmatter
        if ! head -1 "$skill_file" | grep -q "^---$"; then
            error "$skill_file: Missing YAML frontmatter"
            continue
        fi

        # Check required frontmatter fields - extract between first two ---
        local frontmatter
        frontmatter=$(awk '/^---$/{if(++c==2)exit}c==1' "$skill_file")

        if ! echo "$frontmatter" | grep -q "^name:"; then
            error "$skill_file: Missing 'name' in frontmatter"
        fi

        if ! echo "$frontmatter" | grep -q "^description:"; then
            error "$skill_file: Missing 'description' in frontmatter"
        fi
    done
}

# Main validation loop
main() {
    echo "Linting Han plugins..."
    echo ""

    local plugin_count=0

    while IFS= read -r plugin_dir; do
        [ -z "$plugin_dir" ] && continue
        ((plugin_count++))

        validate_claude_plugin_dir "$plugin_dir"
        validate_hooks_location "$plugin_dir"
        validate_plugin_json "$plugin_dir"
        validate_han_config "$plugin_dir"
        validate_hooks_json "$plugin_dir"
        validate_skills "$plugin_dir"
    done < <(find_plugins)

    echo ""
    echo "Checked $plugin_count plugins"

    if [ $ERRORS -gt 0 ]; then
        echo -e "${RED}Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
        exit 1
    elif [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Found $WARNINGS warning(s)${NC}"
        exit 0
    else
        echo -e "${GREEN}All plugins valid!${NC}"
        exit 0
    fi
}

main
