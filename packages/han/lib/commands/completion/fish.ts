/**
 * Generate fish completion script for han CLI
 */

export function generateFishCompletion(): string {
	return `# han fish completion
# To enable, save to ~/.config/fish/completions/han.fish:
#   han completion fish > ~/.config/fish/completions/han.fish

function __han_completions
    set -l tokens (commandline -opc)
    han --get-completions $tokens 2>/dev/null
end

# Disable file completions for han
complete -c han -f

# Dynamic completions from han CLI
complete -c han -a '(__han_completions)'
`;
}
