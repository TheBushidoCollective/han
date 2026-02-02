---
description: Create a new jutsu (weapon) plugin for a technology
---

# Create a Jutsu (術 - Technique) Plugin

Create a new jutsu plugin for: $ARGUMENTS

## What is a Jutsu?

Jutsus are "techniques" in the Han marketplace - they provide validation hooks that automatically enforce quality standards for specific technologies. A jutsu watches for tool usage and validates the results.

## Plugin Structure

Create the following directory structure:

```
jutsu/jutsu-{name}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (ONLY plugin.json goes here)
├── han-plugin.yml           # Han hook configurations (at plugin root)
├── hooks/
│   └── hooks.json           # Claude Code hooks
├── skills/
│   └── {skill-name}/
│       └── SKILL.md        # Skill documentation
└── README.md               # Plugin documentation
```

**IMPORTANT**:

- Only `plugin.json` goes inside `.claude-plugin/`
- `hooks.json` goes in the `hooks/` directory
- `han-plugin.yml` stays at the plugin root (NOT in hooks/)

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "jutsu-{technology-name}",
  "version": "1.0.0",
  "description": "Validation and quality enforcement for {Technology Name} projects.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://github.com/thebushidocollective/han",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "MIT",
  "keywords": [
    "{technology}",
    "validation",
    "{tool-name}",
    "quality",
    "enforcement"
  ]
}
```

## Step 2: Create han-plugin.yml

Create `han-plugin.yml` at the plugin root with hook definitions:

```yaml
# jutsu-{technology-name} plugin configuration
# This plugin provides validation hooks for {Technology Name} projects

# Hook definitions (managed by Han orchestrator)
hooks:
  {hook-name}:
    command: "{validation-command}"
    dirsWith:
      - "{marker-file}"
    ifChanged:
      - "{glob-patterns}"

# No MCP server for jutsu plugins (they use hooks, not MCP)
mcp: null

# Memory provider (optional)
memory: null
```

### Hook Configuration Guide

- **hooks**: Object containing named hook definitions
- **{hook-name}**: Descriptive name for the hook (e.g., "lint", "test", "typecheck", "build")
- **command**: The validation command to run (e.g., "npm run lint", "cargo check")
- **dirsWith**: Array of marker files to detect relevant directories (e.g., ["package.json"])
- **ifChanged**: Array of glob patterns to watch for changes (optional, enables caching)

### Example han-plugin.yml

```yaml
# jutsu-typescript plugin configuration
# This plugin provides TypeScript validation hooks

hooks:
  typecheck:
    command: "npx -y --package typescript tsc --noEmit"
    dirsWith:
      - tsconfig.json
    ifChanged:
      - "**/*.ts"
      - "**/*.tsx"
      - "tsconfig.json"

mcp: null
memory: null
```

### Multi-Hook Example

```yaml
# jutsu-rust plugin configuration

hooks:
  check:
    command: "cargo check"
    dirsWith:
      - Cargo.toml
    ifChanged:
      - "**/*.rs"
      - "Cargo.toml"
      - "Cargo.lock"

  clippy:
    command: "cargo clippy -- -D warnings"
    dirsWith:
      - Cargo.toml
    ifChanged:
      - "**/*.rs"

  test:
    command: "cargo test"
    dirsWith:
      - Cargo.toml
    ifChanged:
      - "**/*.rs"
      - "Cargo.toml"

mcp: null
memory: null
```

## Step 3: Create hooks.json

Create `hooks/hooks.json` to register the hook with Claude Code events:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "han hook run jutsu-{technology-name} {hook-name} --fail-fast --cached",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### hooks.json Configuration Guide

- **hooks**: Top-level object containing event hooks
- **Stop**: Hooks that run when conversation stops
- **type**: Always "command" for hook execution
- **command**: Uses `han hook run {plugin-name} {hook-name}` format
- **--fail-fast**: Stop on first error for quick feedback
- **--cached**: Enable smart caching based on ifChanged patterns
- **timeout**: Max execution time in milliseconds (120000 = 2 minutes)

### Marker Files by Technology

- JavaScript/TypeScript: `package.json`
- Python: `pyproject.toml` or `requirements.txt`
- Rust: `Cargo.toml`
- Go: `go.mod`
- Ruby: `Gemfile`
- Java/Kotlin: `pom.xml` or `build.gradle`
- C#: `*.csproj`
- Elixir: `mix.exs`

### Common Validation Commands

- **TypeScript**: `npx -y --package typescript tsc`
- **ESLint**: `npx eslint . --max-warnings 0`
- **Biome**: `npx @biomejs/biome check .`
- **Pytest**: `pytest`
- **RSpec**: `bundle exec rspec`
- **Cargo**: `cargo check && cargo clippy`
- **Go**: `go vet ./... && go test ./...`

## Step 4: Create Skills

For each major concept/feature of the technology, create a skill:

### Skill Directory Structure

```
skills/{skill-name}/
└── SKILL.md
```

### SKILL.md Format

```markdown
---
name: {technology-name}-{feature-name}
description: Use when {specific scenario requiring this skill}. {What this skill helps accomplish}.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# {Technology Name} - {Feature Name}

{Brief overview of this skill and when to use it}

## Key Concepts

{Explain the main concepts this skill covers}

## Best Practices

{List the best practices for this feature}

## Examples

{Provide practical code examples}

## Common Patterns

{Show common usage patterns}

## Anti-Patterns

{Explain what to avoid}

## Related Skills

- {Link to related skills}
```

### Recommended Skill Categories

1. **Core Language/Framework Features** (3-5 skills)
   - Type system, syntax, fundamental patterns

2. **Testing Patterns** (1-2 skills)
   - Unit testing, integration testing, mocking

3. **Configuration** (1 skill)
   - Project setup, configuration files, build settings

4. **Advanced Features** (2-4 skills)
   - Performance optimization, async patterns, metaprogramming

5. **Integration Patterns** (1-2 skills)
   - Working with other tools, CI/CD, deployment

## Step 5: Write README.md

Create a comprehensive README:

```markdown
# Jutsu: {Technology Name}

{Brief description of what this jutsu validates}

## What This Jutsu Provides

### Validation Hooks

- **{Technology} Validation**: Runs {validation tool} to ensure code quality
- **Type Checking**: Validates type safety (if applicable)
- **Linting**: Enforces code style standards

### Skills

This jutsu provides the following skills:

- **{skill-1}**: {brief description}
- **{skill-2}**: {brief description}
- **{skill-3}**: {brief description}

## Installation

Install via the Han marketplace:

\`\`\`bash
han plugin install jutsu-{technology-name}
\`\`\`

Or install manually:

\`\`\`bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-{technology-name}@han
\`\`\`

## Usage

Once installed, this jutsu automatically validates your {technology} code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

## Requirements

- {Technology} {minimum version}
- {Any required tools or dependencies}

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
```

## Step 6: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "name": "jutsu-{technology-name}",
  "description": "Validation and quality enforcement for {Technology Name} projects.",
  "source": "./jutsu/jutsu-{technology-name}",
  "category": "Technique",
  "keywords": [
    "{technology}",
    "validation",
    "quality",
    "enforcement"
  ]
}
```

## Best Practices

### DO

✅ Focus on read-only validation (check, lint, test)
✅ Use `--fail-fast` for quick feedback
✅ Use `--dirs-with` to invoke hooks in multiple directories
✅ Provide clear error messages with `showOutput: "on-error"`
✅ Include skills for modern (2024-2025) features
✅ Test your hooks in both single-project and monorepo scenarios
✅ Document required versions and dependencies
✅ Include practical examples in skills

### DON'T

❌ Don't auto-fix code in hooks (hooks should only validate)
❌ Don't include placeholder or template content in skills
❌ Don't copy examples from other languages into your skills
❌ Don't skip testing patterns and CI/CD integration skills
❌ Don't forget security and performance patterns
❌ Don't use outdated framework versions in examples

## Testing Your Jutsu

1. Install locally:

   ```bash
   han plugin install /path/to/jutsu-{name}
   ```

2. Test validation hooks:

   ```bash
   # Intentionally break code to trigger validation
   # Then run Claude Code to verify hooks execute
   ```

3. Verify skills are accessible:

   ```bash
   # In Claude Code, invoke a skill and verify it provides correct guidance
   ```

## Examples of Well-Structured Jutsus

Reference these examples:

- **jutsu-biome**: Excellent hook configuration and skill organization
- **jutsu-typescript**: Clean validation patterns
- **jutsu-playwright**: Comprehensive testing coverage

## Questions?

See the [Han documentation](https://thebushidocollective.github.io/han) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
