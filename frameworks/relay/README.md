# Relay

Advanced Relay GraphQL framework skills for React applications

## Skills

This plugin provides the following skills:

- **Relay Fragments Patterns**
- **Relay Mutations Patterns**
- **Relay Pagination**

## Usage

Once enabled, Claude will automatically apply these skills when working with relevant code. The plugin provides context and expertise that Claude uses to:

- Write idiomatic code following best practices
- Suggest appropriate patterns and architectures
- Catch common mistakes and anti-patterns
- Provide framework-specific guidance

## Quality Hooks

This plugin includes hooks that ensure Relay artifacts are compiled before completing work. The hooks use `@thebushidocollective/han` to support both single-package and monorepo projects.

### Compile Hook

The `compile` hook runs `npx relay-compiler` to generate artifacts from GraphQL fragments and queries. It automatically detects directories containing Relay configuration files:

- `relay.config.js`
- `relay.config.json`
- `relay.config.cjs`
- `relay.config.mjs`

The hook runs when any of the following file types are changed:

- `**/*.ts`
- `**/*.tsx`
- `**/*.js`
- `**/*.jsx`
- `**/*.graphql`

### Monorepo Support

The hooks automatically detect directories with Relay config files and run the compiler in each:

```bash
han hook run jutsu-relay compile
```

This ensures all packages in your monorepo have up-to-date Relay artifacts before work is marked complete.

## Installation

Install with npx (no installation required):

```bash
han plugin install jutsu-relay
```
