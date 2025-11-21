# Create a Buki (武器 - Weapon) Plugin

Create a new buki plugin for language, framework, or tool validation.

## What is a Buki?

Bukis are "weapons" in the Han marketplace - they provide validation hooks that automatically enforce quality standards for specific technologies. A buki watches for tool usage and validates the results.

## Plugin Structure

Create the following directory structure:

```
buki/buki-{name}/
├── .claude-plugin/
│   ├── plugin.json          # Plugin metadata
│   └── marketplace.json     # Marketplace configuration (optional)
├── hooks/
│   └── hooks.json          # Validation hooks
├── skills/
│   └── {skill-name}/
│       └── SKILL.md        # Skill documentation
└── README.md               # Plugin documentation
```

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "buki-{technology-name}",
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

## Step 2: Create hooks.json

Create `hooks/hooks.json` with validation hooks:

```json
{
  "Stop": [
    {
      "name": "{technology}-validation",
      "description": "Validates {technology} code before stopping",
      "command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with {marker-file} {validation-command}",
      "showOutput": "on-error"
    }
  ],
  "SubagentStop": [
    {
      "name": "{technology}-validation",
      "description": "Validates {technology} code when agents complete",
      "command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with {marker-file} {validation-command}",
      "showOutput": "on-error"
    }
  ]
}
```

### Hook Configuration Guide:

- **name**: Descriptive name for the validation step
- **description**: What the hook validates
- **command**: The validation command to run
- **showOutput**: When to display output ("always", "on-error", "never")

### Marker Files by Technology:

- JavaScript/TypeScript: `package.json`
- Python: `pyproject.toml` or `requirements.txt`
- Rust: `Cargo.toml`
- Go: `go.mod`
- Ruby: `Gemfile`
- Java/Kotlin: `pom.xml` or `build.gradle`
- C#: `*.csproj`
- Elixir: `mix.exs`

### Common Validation Commands:

- **TypeScript**: `npx tsc --noEmit`
- **ESLint**: `npx eslint . --max-warnings 0`
- **Biome**: `npx @biomejs/biome check .`
- **Pytest**: `pytest`
- **RSpec**: `bundle exec rspec`
- **Cargo**: `cargo check && cargo clippy`
- **Go**: `go vet ./... && go test ./...`

## Step 3: Create Skills

For each major concept/feature of the technology, create a skill:

### Skill Directory Structure:

```
skills/{skill-name}/
└── SKILL.md
```

### SKILL.md Format:

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

### Recommended Skill Categories:

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

## Step 4: Write README.md

Create a comprehensive README:

```markdown
# Buki: {Technology Name}

{Brief description of what this buki validates}

## What This Buki Provides

### Validation Hooks

- **{Technology} Validation**: Runs {validation tool} to ensure code quality
- **Type Checking**: Validates type safety (if applicable)
- **Linting**: Enforces code style standards

### Skills

This buki provides the following skills:

- **{skill-1}**: {brief description}
- **{skill-2}**: {brief description}
- **{skill-3}**: {brief description}

## Installation

Install via the Han marketplace:

\`\`\`bash
npx @thebushidocollective/han install
\`\`\`

Or install manually:

\`\`\`bash
claude plugin marketplace add thebushidocollective/han
claude plugin install buki-{technology-name}@han
\`\`\`

## Usage

Once installed, this buki automatically validates your {technology} code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

## Requirements

- {Technology} {minimum version}
- {Any required tools or dependencies}

## Philosophy

This buki embodies the Bushido virtues:

- **Integrity (誠 - Makoto)**: Ensures code meets quality standards
- **Respect (礼 - Rei)**: Validates work thoroughly
- **Courage (勇 - Yū)**: Fails fast when issues are found

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
```

## Step 5: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "plugins": {
    "buki-{technology-name}": {
      "source": "directory",
      "path": "./buki/buki-{technology-name}"
    }
  }
}
```

## Best Practices

### DO:

✅ Focus on read-only validation (check, lint, test)
✅ Use `--fail-fast` for quick feedback
✅ Use `--dirs-with` for monorepo support
✅ Provide clear error messages with `showOutput: "on-error"`
✅ Include skills for modern (2024-2025) features
✅ Test your hooks in both single-project and monorepo scenarios
✅ Document required versions and dependencies
✅ Include practical examples in skills

### DON'T:

❌ Don't auto-fix code in hooks (hooks should only validate)
❌ Don't include placeholder or template content in skills
❌ Don't copy examples from other languages into your skills
❌ Don't skip testing patterns and CI/CD integration skills
❌ Don't forget security and performance patterns
❌ Don't use outdated framework versions in examples

## Testing Your Buki

1. Install locally:
   ```bash
   claude plugin install /path/to/buki-{name}@local
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

## Examples of Well-Structured Bukis

Reference these examples:

- **buki-biome**: Excellent hook configuration and skill organization
- **buki-typescript**: Clean validation patterns
- **buki-playwright**: Comprehensive testing coverage

## Questions?

See the [Han documentation](https://thebushidocollective.github.io/han) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
