---
name: graphql-inspector-diff
user-invocable: false
description: Use when detecting breaking changes between GraphQL schema versions, comparing schemas across branches, or validating schema migrations.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# GraphQL Inspector - Schema Diff

Expert knowledge of GraphQL Inspector's diff command for detecting breaking, non-breaking, and dangerous changes between GraphQL schema versions.

## Overview

GraphQL Inspector's diff command compares two GraphQL schemas and outputs a precise list of changes. Each change is categorized as breaking, non-breaking, or dangerous, helping teams prevent API regressions.

## Core Commands

### Basic Diff

```bash
# Compare two schema files
npx @graphql-inspector/cli diff old-schema.graphql new-schema.graphql

# Compare against git branch
npx @graphql-inspector/cli diff 'git:origin/main:schema.graphql' schema.graphql

# Compare against specific commit
npx @graphql-inspector/cli diff 'git:abc123:schema.graphql' schema.graphql

# Compare against tag
npx @graphql-inspector/cli diff 'git:v1.0.0:schema.graphql' schema.graphql
```

### URL-Based Comparison

```bash
# Compare local schema against remote endpoint
npx @graphql-inspector/cli diff 'https://api.example.com/graphql' schema.graphql

# Compare two remote endpoints
npx @graphql-inspector/cli diff 'https://staging.api.com/graphql' 'https://prod.api.com/graphql'
```

### Command Options

```bash
# Only show breaking changes
npx @graphql-inspector/cli diff old.graphql new.graphql --onlyBreaking

# Fail on dangerous changes
npx @graphql-inspector/cli diff old.graphql new.graphql --failOnDangerous

# Custom rules
npx @graphql-inspector/cli diff old.graphql new.graphql --rule suppressRemovalOfDeprecatedField

# Output as JSON
npx @graphql-inspector/cli diff old.graphql new.graphql --json
```

## Change Categories

### Breaking Changes

Changes that will break existing clients:

| Change Type | Example |
|-------------|---------|
| Field removed | `User.email` removed |
| Type removed | `UserType` deleted |
| Required argument added | New `id: ID!` on query |
| Type changed | `User.age: Int` → `User.age: String` |
| Non-null constraint added | `email: String` → `email: String!` |
| Union member removed | `SearchResult` loses `Product` type |
| Enum value removed | `Status.PENDING` removed |
| Interface field removed | `Node.id` removed from interface |

### Dangerous Changes

Changes that may break some clients:

| Change Type | Example |
|-------------|---------|
| Argument default changed | `limit = 10` → `limit = 20` |
| Enum value added | New `Status.ARCHIVED` |
| Optional argument added | New `User.name(format: String)` |
| Union member added | `SearchResult` gains `Article` type |
| Interface added to type | `User` implements `Timestampable` |
| Nullable field becomes non-null | `email: String` → `email: String!` on output |

### Non-Breaking Changes

Safe changes that won't break clients:

| Change Type | Example |
|-------------|---------|
| Field added | New `User.avatar` field |
| Type added | New `Comment` type |
| Optional argument added | New `users(filter: String)` |
| Deprecation added | `@deprecated(reason: "Use newField")` |
| Description changed | Updated field documentation |
| Directive added | `@cacheControl(maxAge: 60)` |

## Configuration

### Rules Configuration

Create `.graphql-inspector.yaml`:

```yaml
diff:
  rules:
    - suppressRemovalOfDeprecatedField
    - considerUsage
  failOnBreaking: true
  failOnDangerous: false
```

### Available Rules

```yaml
# Suppress rules
- suppressRemovalOfDeprecatedField  # Deprecated fields can be removed
- suppressCommonPrefixChanges       # Ignore prefix renames

# Usage-based rules
- considerUsage                     # Check if breaking change affects real usage
```

### Schema Sources

```yaml
# Local file
old: ./old-schema.graphql

# Git reference
old: git:origin/main:schema.graphql

# URL with headers
old:
  url: https://api.example.com/graphql
  headers:
    Authorization: Bearer ${API_TOKEN}

# Glob pattern
new: ./**/*.graphql
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Schema Diff
user-invocable: false
on:
  pull_request:
    paths:
      - 'schema.graphql'
      - '**/*.graphql'

jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Inspector
        run: npm install -g @graphql-inspector/cli

      - name: Check for breaking changes
        run: |
          graphql-inspector diff \
            'git:origin/main:schema.graphql' \
            schema.graphql \
            --onlyBreaking
```

### GitLab CI

```yaml
schema-diff:
  image: node:20
  script:
    - npm install -g @graphql-inspector/cli
    - graphql-inspector diff "git:origin/main:schema.graphql" schema.graphql
  rules:
    - changes:
        - "**/*.graphql"
```

## Usage-Based Diffing

Check if breaking changes affect actual operations:

```bash
# Provide operations to check against
npx @graphql-inspector/cli diff old.graphql new.graphql \
  --rule considerUsage \
  --documents "src/**/*.graphql"
```

Benefits:

- Only flags breaking changes that affect real operations
- Allows safe removal of unused fields
- Reduces false positives in large schemas

## Federation Support

For Apollo Federation schemas:

```bash
# Compare federated schemas
npx @graphql-inspector/cli diff \
  --federation \
  old-subgraph.graphql \
  new-subgraph.graphql
```

## Best Practices

1. **Always diff before deploying** - Run diff in CI on every schema change
2. **Use git references** - Compare against main branch, not arbitrary files
3. **Enable usage checking** - Reduce noise by checking actual usage
4. **Document deprecations** - Add `@deprecated` before removing fields
5. **Review dangerous changes** - They may still break edge cases
6. **Keep deprecation window** - Give clients time to migrate
7. **Automate in PRs** - Comment diff results on pull requests
8. **Version your schema** - Tag releases for easy comparison

## Common Patterns

### Deprecation Workflow

```graphql
# Step 1: Add new field and deprecate old
type User {
  fullName: String!
  name: String @deprecated(reason: "Use fullName instead")
}

# Step 2: After migration window, remove old field
type User {
  fullName: String!
}
```

### Safe Field Renaming

```graphql
# Phase 1: Add alias with deprecated old name
type User {
  displayName: String!
  name: String @deprecated(reason: "Use displayName")
}

# Phase 2: Remove after client migration
type User {
  displayName: String!
}
```

## Troubleshooting

### Common Issues

**"Schema not found"**

- Verify file path is correct
- Check git reference syntax: `git:branch:path`
- Ensure schema file exists in specified location

**"Breaking changes detected" in CI**

- Review if changes are intentional
- Add deprecation if removing field
- Use `--rule suppressRemovalOfDeprecatedField` if field was deprecated

**"Introspection query failed"**

- Check URL is accessible
- Verify authentication headers
- Ensure introspection is enabled on endpoint

## When to Use This Skill

- Planning schema migrations
- Reviewing schema changes in pull requests
- Setting up CI/CD for schema validation
- Detecting breaking changes before deployment
- Comparing production vs development schemas
- Auditing schema evolution over time
