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
Skill("buki-biome:biome-configuration")
Skill("buki-biome:biome-linting")
Skill("buki-biome:biome-formatting")
```

Each skill provides specialized knowledge and patterns for Biome development.

## Quality Hooks

This plugin includes hooks that ensure Biome checks pass before completing work. The hooks use `@thebushidocollective/han` to support both single-package and monorepo projects.

### Monorepo Support

The hooks automatically detect directories with `biome.json` and run Biome checks in each:

```bash
han hook run --fail-fast --dirs-with biome.json -- npx biome check .
```

This ensures all packages in your monorepo pass Biome validation before work is marked complete.

## License

Licensed under MIT - see repository for details.
