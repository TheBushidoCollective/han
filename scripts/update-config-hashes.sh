#!/bin/bash
# Updates configHash in marketplace.json for each plugin
# Hash is computed from han-config.json and any han-config.yml files

set -e

MARKETPLACE_JSON=".claude-plugin/marketplace.json"

# Compute hash for a plugin's config files
compute_config_hash() {
    local plugin_source="$1"
    local plugin_dir="${plugin_source#./}"
    local hash_input=""

    # Include han-config.json if it exists
    if [ -f "$plugin_dir/hooks/han-config.json" ]; then
        hash_input+=$(cat "$plugin_dir/hooks/han-config.json")
    fi

    # Include any han-config.yml files (user overrides in target directories)
    # These are typically in the plugin directory for defaults
    if [ -f "$plugin_dir/han-config.yml" ]; then
        hash_input+=$(cat "$plugin_dir/han-config.yml")
    fi

    # If no config files, return empty
    if [ -z "$hash_input" ]; then
        echo ""
        return
    fi

    # Compute SHA256 hash (first 12 chars for brevity)
    echo -n "$hash_input" | shasum -a 256 | cut -c1-12
}

# Update marketplace.json with config hashes
update_marketplace() {
    local tmp_file=$(mktemp)
    local updated=0

    # Process each plugin
    jq -c '.plugins[]' "$MARKETPLACE_JSON" | while read -r plugin; do
        local name=$(echo "$plugin" | jq -r '.name')
        local source=$(echo "$plugin" | jq -r '.source')
        local hash=$(compute_config_hash "$source")

        if [ -n "$hash" ]; then
            echo "$name: $hash"
        fi
    done

    # Build the update using jq
    local plugins_with_hashes=$(mktemp)

    jq -c '.plugins[] | {name: .name, source: .source}' "$MARKETPLACE_JSON" | while read -r plugin; do
        local name=$(echo "$plugin" | jq -r '.name')
        local source=$(echo "$plugin" | jq -r '.source')
        local hash=$(compute_config_hash "$source")
        echo "$name|$hash"
    done > "$plugins_with_hashes"

    # Create jq filter to update hashes
    local jq_filter='.plugins = [.plugins[] | . as $p |'
    jq_filter+=' if $hashes[$p.name] != "" then . + {configHash: $hashes[$p.name]} else del(.configHash) end]'

    # Build hash map
    local hash_map="{}"
    while IFS='|' read -r name hash; do
        if [ -n "$hash" ]; then
            hash_map=$(echo "$hash_map" | jq --arg name "$name" --arg hash "$hash" '. + {($name): $hash}')
        fi
    done < "$plugins_with_hashes"

    # Apply updates
    jq --argjson hashes "$hash_map" "$jq_filter" "$MARKETPLACE_JSON" > "$tmp_file"
    mv "$tmp_file" "$MARKETPLACE_JSON"

    rm -f "$plugins_with_hashes"

    echo "Updated config hashes in $MARKETPLACE_JSON"
}

update_marketplace
