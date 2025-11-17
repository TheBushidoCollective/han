# @thebushidocollective/han

Monorepo validation tool and Claude Code plugin installer for Han (bushido) plugins.

## Installation

### Global Installation

```bash
npm install -g @thebushidocollective/han
```

### Use with npx (No Installation)

```bash
npx -y @thebushidocollective/han validate <command>
```

### Use in Claude Code Hooks

```json
{
  "type": "command",
  "command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with Gemfile bundle exec rspec"
}
```

## Commands

### install

Intelligently analyze your codebase and configure Claude Code with appropriate Han plugins using the Claude Agent SDK.

```bash
npx @thebushidocollective/han install
```

**How it works:**

- Spawns a Claude agent to analyze your codebase
- Uses Glob, Grep, and Read tools to understand your project
- Detects languages, frameworks, and testing tools
- Recommends appropriate Han plugins based on actual code, not just file patterns
- Configures `.claude/settings.json` automatically

**What it detects:**

- Programming languages (TypeScript, Python, Go, Rust, Ruby, etc.)
- Frontend frameworks (React, Vue, Angular, Next.js, etc.)
- Backend frameworks (NestJS, Django, FastAPI, Rails, etc.)
- Testing frameworks (Jest, Pytest, RSpec, etc.)
- GraphQL implementations
- Monorepo tools (Nx, Turborepo, Lerna)

**After installation:**
Restart Claude Code to load the new plugins.

### uninstall

Remove all Han plugins and marketplace configuration from Claude Code.

```bash
npx @thebushidocollective/han uninstall
```

### validate

Run validation commands across monorepo packages.

```bash
han validate [options] <command>
```

#### Options

- `--fail-fast` - Stop on first failure
- `--dirs-with <file>` - Only run in directories containing the specified file

#### Examples

Run RSpec tests in all directories with a Gemfile:

```bash
han validate --fail-fast --dirs-with Gemfile bundle exec rspec
```

Run npm test in all directories with package.json:

```bash
han validate --dirs-with package.json npm test
```

Run go test in all directories:

```bash
han validate go test ./...
```

## Exit Codes

- `0` - All validations passed
- `1` - Invalid usage or no directories found
- `2` - One or more validations failed

## How It Works

1. **Auto-discovers directories** - Uses git to find tracked directories,
   falls back to filesystem scan
2. **Filters by marker files** - Only runs in directories containing
   the specified file (e.g., `Gemfile`, `package.json`)
3. **Runs command in each** - Executes the command in each matching
   directory
4. **Reports failures** - Shows which directories failed with clear
   error messages
5. **Exits with code 2** - Hard failure prevents Claude from bypassing
   validation

## Use Cases

### Monorepo Testing

Run tests across all packages in a monorepo:

```bash
# JavaScript/TypeScript packages
npx -y @thebushidocollective/han validate --dirs-with package.json npm test

# Ruby packages
npx -y @thebushidocollective/han validate --dirs-with Gemfile bundle exec rspec

# Go modules
npx -y @thebushidocollective/han validate --dirs-with go.mod go test ./...

# Python packages
npx -y @thebushidocollective/han validate --dirs-with pyproject.toml pytest
```

### Claude Code Hooks

Perfect for enforcing quality in Claude Code plugins:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with package.json npm test || (echo 'Please fix failing tests before continuing:\\n'; exit 2)"
          }
        ]
      }
    ]
  }
}
```

## Development

This package is written in TypeScript and compiles to CommonJS JavaScript.

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

## Contributing

See [RELEASING.md](RELEASING.md) for information on publishing new
versions.

## License

MIT
