/**
 * Generate bash completion script for han CLI
 */

export function generateBashCompletion(): string {
  return `# han bash completion
# To enable, add to ~/.bashrc:
#   eval "$(han completion bash)"

_han_completions() {
    local cur prev words cword
    if type _init_completion &>/dev/null; then
        _init_completion || return
    else
        cur="\${COMP_WORDS[COMP_CWORD]}"
        prev="\${COMP_WORDS[COMP_CWORD-1]}"
        words=("\${COMP_WORDS[@]}")
        cword=$COMP_CWORD
    fi

    # Get completions from han
    local completions
    completions=$(han --get-completions "\${words[@]}" 2>/dev/null)

    # Split by newline and filter by current word
    local IFS=$'\\n'
    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
}

complete -F _han_completions han
`;
}
