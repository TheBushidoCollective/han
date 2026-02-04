/**
 * Generate zsh completion script for han CLI
 */

export function generateZshCompletion(): string {
  return `#compdef han
# han zsh completion
# To enable, add to ~/.zshrc:
#   eval "$(han completion zsh)"

_han() {
    local -a completions
    local -a completions_with_descriptions

    # Get completions from han
    local output
    output=$(han --get-completions "\${words[@]}" 2>/dev/null)

    # Parse output (format: "value\\tdescription" or just "value")
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            if [[ "$line" == *$'\\t'* ]]; then
                # Has description
                local value="\${line%%$'\\t'*}"
                local desc="\${line#*$'\\t'}"
                completions_with_descriptions+=("\${value}:\${desc}")
            else
                completions+=("$line")
            fi
        fi
    done <<< "$output"

    if (( \${#completions_with_descriptions[@]} > 0 )); then
        _describe -t commands 'han commands' completions_with_descriptions
    fi
    if (( \${#completions[@]} > 0 )); then
        compadd -a completions
    fi
}

compdef _han han
`;
}
