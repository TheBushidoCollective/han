---
description: Create a new technique plugin for a technology (language, tool, framework, or validation)
---

# Create a Technique (術 - Jutsu) Plugin

Create a new technique plugin for: $ARGUMENTS

## What is a Technique Plugin?

Technique plugins provide validation hooks that automatically enforce quality standards for specific technologies. They watch for tool usage and validate the results. They live under `plugins/` organized by category.

## Plugin Structure

Create the following directory structure under the appropriate category:

```
plugins/{category}/{name}/
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

### Categories

| Category | For | Examples |
|----------|-----|---------|
| `languages/` | Programming languages | typescript, python, rust |
| `frameworks/` | Frameworks | react, nextjs, relay |
| `tools/` | Build/dev tools | bun, playwright, mise |
| `validation/` | Linters/formatters | biome, eslint, prettier |
| `patterns/` | Development patterns | tdd, bdd, git-storytelling |

**IMPORTANT**:

- Only `plugin.json` goes inside `.claude-plugin/`
- `hooks.json` goes in the `hooks/` directory
- `han-plugin.yml` stays at the plugin root (NOT in hooks/)

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "{technology-name}",
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
# {technology-name} plugin configuration
# This plugin provides validation hooks for {Technology Name} projects

# Hook definitions (managed by Han orchestrator)
hooks:
  {hook-name}:
    command: "{validation-command}"
    dirsWith:
      - "{marker-file}"
    ifChanged:
      - "{glob-patterns}"

# No MCP server for technique plugins (they use hooks, not MCP)
mcp: null

# Memory provider (optional)
memory: null
```

### Example han-plugin.yml

```yaml
# typescript plugin configuration
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
# rust plugin configuration

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
            "command": "han hook run {technology-name} {hook-name} --fail-fast --cached",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### Marker Files by Technology

- JavaScript/TypeScript: `package.json`
- Python: `pyproject.toml` or `requirements.txt`
- Rust: `Cargo.toml`
- Go: `go.mod`
- Ruby: `Gemfile`
- Java/Kotlin: `pom.xml` or `build.gradle`
- C#: `*.csproj`
- Elixir: `mix.exs`

## Step 4: Create Skills

For each major concept/feature of the technology, create a skill:

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
## Best Practices
## Examples
## Common Patterns
## Anti-Patterns
```

## Step 5: Write README.md

```markdown
# {Technology Name}

{Brief description of what this plugin validates}

## What This Plugin Provides

### Validation Hooks

- **{Technology} Validation**: Runs {validation tool} to ensure code quality

### Skills

- **{skill-1}**: {brief description}
- **{skill-2}**: {brief description}

## Installation

\`\`\`bash
han plugin install {technology-name}
\`\`\`
```

## Step 6: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "name": "{technology-name}",
  "description": "Validation and quality enforcement for {Technology Name} projects.",
  "source": "./plugins/{category}/{technology-name}",
  "category": "Technique",
  "keywords": [
    "{technology}",
    "validation",
    "quality",
    "enforcement"
  ]
}
```

## Examples of Well-Structured Technique Plugins

- **biome**: Excellent hook configuration and skill organization
- **typescript**: Clean validation patterns
- **playwright**: Comprehensive testing coverage

## Questions?

See the [Han documentation](https://han.guru) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
