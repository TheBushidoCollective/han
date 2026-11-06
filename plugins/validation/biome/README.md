# Biome

Comprehensive Biome skills for fast JavaScript/TypeScript linting and formatting with modern tooling and performance optimization.

## Skills

This plugin provides the following skills:

- **Biome Configuration** - Master Biome configuration files, rules, and project setup
- **Biome Linting** - Expert knowledge of Biome's linting capabilities and rule configuration
- **Biome Formatting** - Formatting patterns, options, and code style management

## Usage

Skills can be invoked using the Skill tool:

```javascript
Skill("biome:biome-configuration")
Skill("biome:biome-linting")
Skill("biome:biome-formatting")
```

Each skill provides specialized knowledge and patterns for Biome development.

## Quality Hooks

The `lint` hook runs Biome checks on Stop and after edits. It detects root
`biome.json` configurations in single-package and monorepo projects. Checks
report formatting and lint diagnostics without changing files.

To format selected files explicitly, run:

```bash
npx @biomejs/biome check --write <explicit-paths>
```

## Installation

```bash
han plugin install biome
```
