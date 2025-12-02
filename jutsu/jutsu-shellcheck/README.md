# Jutsu: ShellCheck

Validation and quality enforcement for Bash and shell scripts using [ShellCheck](https://www.shellcheck.net/).

## What This Jutsu Provides

### Validation Hooks

- **ShellCheck Validation**: Runs ShellCheck on all `.sh` files to catch common bugs, pitfalls, and style issues
- Validates scripts on session stop and when agents complete work
- Only runs when shell files have changed (with `--cache` flag)

### Skills

This jutsu provides the following skills:

- **shell-scripting-fundamentals**: Core patterns for variables, conditionals, loops, and functions
- **shell-error-handling**: Traps, exit codes, cleanup routines, and debugging techniques
- **shell-portability**: Writing scripts that work across Linux, macOS, and different shells

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han plugin install jutsu-shellcheck
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-shellcheck@han
```

## Usage

Once installed, this jutsu automatically validates your shell scripts:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

### Manual Validation

Run ShellCheck manually on your scripts:

```bash
shellcheck -x script.sh
shellcheck -x **/*.sh
```

### Configuring ShellCheck

Create a `.shellcheckrc` file in your project root:

```
# Disable specific checks
disable=SC2034,SC2086

# Set default shell
shell=bash

# Enable external sources
external-sources=true
```

## Requirements

- [ShellCheck](https://github.com/koalaman/shellcheck) installed and available in PATH
- Bash 4.0+ (for the validation hooks)

### Installing ShellCheck

**macOS:**
```bash
brew install shellcheck
```

**Ubuntu/Debian:**
```bash
apt-get install shellcheck
```

**Fedora:**
```bash
dnf install ShellCheck
```

**From source:**
```bash
cabal update
cabal install ShellCheck
```

## Common ShellCheck Codes

| Code | Description |
|------|-------------|
| SC2086 | Double quote to prevent globbing and word splitting |
| SC2046 | Quote this to prevent word splitting |
| SC2034 | Variable appears unused |
| SC2155 | Declare and assign separately to avoid masking return values |
| SC2164 | Use `cd ... || exit` in case cd fails |
| SC2006 | Use `$(...)` instead of legacy backticks |

## Overriding Hooks

Create a `han-config.yml` in directories where you want to customize behavior:

```yaml
jutsu-shellcheck:
  shellcheck:
    enabled: false  # Disable shellcheck for this directory
```

Or override the command:

```yaml
jutsu-shellcheck:
  shellcheck:
    command: "shellcheck -e SC2034 *.sh"  # Ignore unused variable warnings
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
