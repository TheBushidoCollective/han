---
name: graphql-inspector-audit
user-invocable: false
description: Use when auditing GraphQL operations for complexity metrics, depth analysis, directive usage, or query performance concerns.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# GraphQL Inspector - Audit

Expert knowledge of GraphQL Inspector's audit command for analyzing operation complexity and identifying potential performance issues.

## Overview

The audit command analyzes GraphQL operations to provide metrics about query depth, directive count, alias count, and complexity. This helps identify operations that may cause performance issues before they reach production.

## Core Commands

### Basic Audit

```bash
# Audit all GraphQL operations
npx @graphql-inspector/cli audit './src/**/*.graphql'

# Audit operations from TypeScript files
npx @graphql-inspector/cli audit './src/**/*.tsx'

# Audit with multiple patterns
npx @graphql-inspector/cli audit './packages/**/*.graphql' './apps/**/*.tsx'
```

### Audit with Schema

```bash
# Audit against a specific schema
npx @graphql-inspector/cli audit './src/**/*.graphql' --schema './schema.graphql'
```

## Metrics Analyzed

### Query Depth

Measures the maximum nesting level of a query:

```graphql
# Depth: 4
query UserPosts {
  user {           # 1
    posts {        # 2
      comments {   # 3
        author {   # 4
          name
        }
      }
    }
  }
}
```

High depth operations can cause:

- Slow database queries (N+1 problems)
- Memory pressure on resolvers
- Long response times

### Alias Count

Counts the number of field aliases:

```graphql
# Alias count: 3
query MultipleUsers {
  admin: user(id: "1") { name }
  moderator: user(id: "2") { name }
  member: user(id: "3") { name }
}
```

High alias counts can:

- Multiply database queries
- Increase payload size
- Indicate query batching abuse

### Directive Count

Counts directives used in the operation:

```graphql
# Directive count: 4
query ConditionalData($includeEmail: Boolean!, $skipPhone: Boolean!) {
  user {
    name
    email @include(if: $includeEmail)
    phone @skip(if: $skipPhone)
    avatar @cacheControl(maxAge: 3600)
    bio @deprecated
  }
}
```

### Token Count

Counts the total tokens in the operation:

```graphql
# Higher token count = more complex query
query ComplexQuery {
  users(
    filter: { status: ACTIVE, role: ADMIN }
    orderBy: { field: NAME, direction: ASC }
    pagination: { limit: 10, offset: 0 }
  ) {
    id
    name
    email
    role
    createdAt
    updatedAt
  }
}
```

## Audit Output

The audit command outputs detailed metrics for each operation:

```
┌──────────────────────────────────────────────────────────────┐
│ GetUser (./src/queries/user.graphql)                         │
├──────────────────────────────────────────────────────────────┤
│ Depth        │ 5                                              │
│ Aliases      │ 0                                              │
│ Directives   │ 2                                              │
│ Tokens       │ 45                                             │
│ Complexity   │ 12                                             │
└──────────────────────────────────────────────────────────────┘
```

## Configuration

Create `.graphql-inspector.yaml`:

```yaml
audit:
  documents: './src/**/*.graphql'

  # Thresholds for warnings
  thresholds:
    depth: 10
    aliases: 5
    directives: 10
    tokens: 500
    complexity: 100
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Audit Operations
user-invocable: false
on:
  pull_request:
    paths:
      - 'src/**/*.graphql'
      - 'src/**/*.tsx'

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Inspector
        run: npm install -g @graphql-inspector/cli

      - name: Audit operations
        run: |
          graphql-inspector audit 'src/**/*.graphql'
```

### Audit Report

Generate a detailed report:

```bash
# JSON output for processing
npx @graphql-inspector/cli audit './src/**/*.graphql' --json > audit-report.json

# Human-readable output
npx @graphql-inspector/cli audit './src/**/*.graphql' 2>&1 | tee audit-report.txt
```

## Use Cases

### Pre-PR Checks

Run before creating pull requests:

```bash
# Script to check operations before PR
#!/bin/bash
echo "Auditing GraphQL operations..."
npx @graphql-inspector/cli audit './src/**/*.graphql'

if [ $? -ne 0 ]; then
  echo "Warning: Some operations may have performance issues"
fi
```

### Periodic Analysis

Schedule regular audits:

```yaml
# GitHub Action for weekly audit
name: Weekly GraphQL Audit
user-invocable: false
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday 9am

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @graphql-inspector/cli
      - run: graphql-inspector audit './src/**/*.graphql' --json > audit.json
      - name: Upload audit report
        uses: actions/upload-artifact@v4
        with:
          name: graphql-audit
          path: audit.json
```

### Complexity Budgets

Set limits per operation type:

```yaml
# Custom thresholds by operation type
audit:
  thresholds:
    queries:
      depth: 10
      complexity: 100
    mutations:
      depth: 5
      complexity: 50
    subscriptions:
      depth: 3
      complexity: 25
```

## Best Practices

1. **Regular audits** - Run weekly to catch complexity creep
2. **Set thresholds** - Define acceptable limits for your API
3. **Track trends** - Monitor metrics over time
4. **Review outliers** - Investigate operations with high metrics
5. **Optimize hot paths** - Focus on frequently-used operations
6. **Document exceptions** - Explain why complex operations are needed
7. **Educate team** - Share audit results and best practices
8. **Automate alerts** - Notify when thresholds are exceeded

## Common Patterns

### Reducing Query Depth

Before (depth 6):

```graphql
query DeepQuery {
  user {
    posts {
      comments {
        author {
          profile {
            avatar
          }
        }
      }
    }
  }
}
```

After (depth 3):

```graphql
query FlattenedQuery {
  user {
    posts {
      comments {
        authorName
        authorAvatar  # Denormalized field
      }
    }
  }
}
```

### Reducing Alias Count

Before (5 aliases):

```graphql
query MultipleUsers {
  user1: user(id: "1") { ...UserFields }
  user2: user(id: "2") { ...UserFields }
  user3: user(id: "3") { ...UserFields }
  user4: user(id: "4") { ...UserFields }
  user5: user(id: "5") { ...UserFields }
}
```

After (batch query):

```graphql
query BatchUsers {
  users(ids: ["1", "2", "3", "4", "5"]) {
    ...UserFields
  }
}
```

## Troubleshooting

### No operations found

- Check glob pattern matches files
- Verify files contain valid GraphQL operations
- Ensure file extensions are included

### Metrics seem wrong

- Verify operation is complete
- Check for fragment definitions
- Review inline fragment usage

### Audit is slow

- Limit scope with specific globs
- Exclude generated files
- Use `--parallel` if available

## When to Use This Skill

- Performance analysis of GraphQL operations
- Identifying complex queries before production
- Setting up complexity budgets
- Regular codebase health checks
- Training developers on query optimization
- Pre-release quality gates
