# Jutsu: GraphQL Inspector

Validation and quality enforcement for GraphQL schemas and operations using [GraphQL Inspector](https://the-guild.dev/graphql/inspector).

## What This Jutsu Provides

### Validation Hooks

- **Schema Diff**: Detects breaking, dangerous, and non-breaking changes between schema versions
- **Operation Validation**: Validates GraphQL operations against your schema with depth and complexity limits

### Skills

This jutsu provides the following skills:

- **graphql-inspector-diff**: Breaking change detection and schema comparison
- **graphql-inspector-validate**: Operation validation with complexity analysis
- **graphql-inspector-audit**: Query complexity auditing and metrics
- **graphql-inspector-ci**: CI/CD integration for GitHub Actions, GitLab CI, and more

## Installation

Install via the Han marketplace:

```bash
han plugin install jutsu-graphql-inspector
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-graphql-inspector@han
```

## Usage

Once installed, this jutsu automatically validates your GraphQL code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

### Manual Commands

```bash
# Validate operations against schema
npx @graphql-inspector/cli validate './src/**/*.graphql' './schema.graphql'

# Check for breaking changes against main branch
npx @graphql-inspector/cli diff 'git:origin/main:schema.graphql' 'schema.graphql'

# Audit operation complexity
npx @graphql-inspector/cli audit './src/**/*.graphql'
```

## Features

### Breaking Change Detection

GraphQL Inspector categorizes changes as:

| Category | Impact | Examples |
|----------|--------|----------|
| Breaking | Will break clients | Field removed, type changed, required arg added |
| Dangerous | May break some clients | Enum value added, default changed |
| Non-Breaking | Safe | Field added, type added, deprecation |

### Validation Rules

Configure limits to prevent performance issues:

- `--maxDepth`: Maximum query nesting depth
- `--maxAliasCount`: Maximum field aliases
- `--maxDirectiveCount`: Maximum directives per operation
- `--maxComplexityScore`: Calculated complexity limit

### Federation Support

Works with Apollo Federation schemas:

```bash
npx @graphql-inspector/cli validate './ops/*.graphql' './schema.graphql' --federationV2
```

## Configuration

Create `.graphql-inspector.yaml` in your project root:

```yaml
schema: './schema.graphql'

diff:
  rules:
    - suppressRemovalOfDeprecatedField
  failOnBreaking: true

validate:
  documents: './src/**/*.graphql'
  maxDepth: 10
  maxAliasCount: 5
```

## Requirements

- Node.js 18+
- GraphQL schema file (`.graphql` or `.gql`)
- GraphQL operations to validate

## Related Plugins

- **jutsu-graphql**: Core GraphQL schema design skills
- **jutsu-relay**: Relay framework integration
- **jutsu-apollo-graphql**: Apollo Client/Server skills

## Resources

- [GraphQL Inspector Documentation](https://the-guild.dev/graphql/inspector/docs)
- [GitHub Repository](https://github.com/graphql-hive/graphql-inspector)
- [The Guild](https://the-guild.dev)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
