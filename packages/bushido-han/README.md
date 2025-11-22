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
npx @thebushidocollective/han install [--scope <project|local>]
```

**Options:**

- `--scope <project|local>` - Installation scope (default: `project`)
  - `project`: Install to `.claude/settings.json` (shared via git)
  - `local`: Install to `.claude/settings.local.json` (git-ignored, machine-specific)

**How it works:**

- Spawns a Claude agent to analyze your codebase
- Uses Glob, Grep, and Read tools to understand your project
- Detects languages, frameworks, and testing tools
- Recommends appropriate Han plugins based on actual code, not just file patterns
- Displays real-time progress with a beautiful Ink-powered terminal UI
- Configures Claude Code settings automatically

**What it detects:**

- Programming languages (TypeScript, Python, Go, Rust, Ruby, etc.)
- Frontend frameworks (React, Vue, Angular, Next.js, etc.)
- Backend frameworks (NestJS, Django, FastAPI, Rails, etc.)
- Testing frameworks (Jest, Pytest, RSpec, etc.)
- GraphQL implementations
- Monorepo tools (Nx, Turborepo, Lerna)

**After installation:**
Restart Claude Code to load the new plugins.

**Examples:**

```bash
# Install to project settings (default, shared via git)
npx @thebushidocollective/han install

# Install to local settings (machine-specific, not shared)
npx @thebushidocollective/han install --scope local
```

### align

Continuously align your Han plugins with your evolving codebase. Automatically adds plugins for new technologies and removes plugins for technologies no longer in use.

```bash
npx @thebushidocollective/han align [--scope <project|local>]
```

**Options:**

- `--scope <project|local>` - Alignment scope (default: `project`)
  - `project`: Align plugins in `.claude/settings.json` (shared via git)
  - `local`: Align plugins in `.claude/settings.local.json` (git-ignored, machine-specific)

**How it works:**

- Re-analyzes your codebase to detect current technologies
- Compares detected plugins with currently installed plugins
- **Adds** plugins for newly detected technologies
- **Removes** plugins for technologies no longer found
- Reports all changes clearly

**When to use:**

- After adding new dependencies or frameworks
- After removing technologies from your project
- Periodically to keep plugins in sync with your codebase
- Automatically via Stop and PreCompact hooks (see below)

**Automatic Alignment:**

The bushido plugin includes hooks that automatically run `han align`:
- **Stop hook**: Runs at the end of each Claude Code session
- **PreCompact hook**: Runs before compacting conversation history

This ensures your plugins stay synchronized with your codebase as it evolves.

**Examples:**

```bash
# Align project settings (default)
npx @thebushidocollective/han align

# Align local settings
npx @thebushidocollective/han align --scope local
```

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

This package is written in TypeScript and uses React (via Ink) for the terminal UI.

### Prerequisites

- Node.js >= 24
- TypeScript 5.9+

### Building

The build process compiles TypeScript to ES modules:

```bash
npm run build       # Compile TypeScript to dist/
npm run typecheck   # Type-check without emitting
```

The compiled output is in `dist/` and is what gets published to npm.

### Testing

Tests run against the compiled JavaScript:

```bash
npm test            # Run tests from dist/test/
```

### Linting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### UI Development

The install command uses [Ink](https://github.com/vadimdemedes/ink) for a rich terminal UI experience. The UI components are in:

- `lib/install-progress.tsx` - Main UI component
- `lib/install.ts` - Integration with Claude Agent SDK

## Contributing

See [RELEASING.md](RELEASING.md) for information on publishing new
versions.

## License

MIT
