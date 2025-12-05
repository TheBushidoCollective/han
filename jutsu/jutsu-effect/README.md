# Effect

Effect validation and type checking for TypeScript projects using the Effect library.

## Hooks

This plugin provides validation hooks that run TypeScript compiler checks:

### Stop Hooks

Runs `tsc --noEmit` in all directories with a `tsconfig.json` file to validate TypeScript compilation without emitting files.

The hooks will:

- Discover all directories containing `tsconfig.json`
- Run `tsc --noEmit` in each directory
- Stop on the first failure with `--fail-fast`
- Exit with code 2 if any compilation errors are found

## Skills

This plugin includes skills for working with Effect:

- **effect-core-patterns** - Basic Effect<A, E, R> patterns, succeed/fail/sync/async
- **effect-error-handling** - Type-safe error handling with catchAll, catchTag, etc.
- **effect-dependency-injection** - Layer pattern for dependency management
- **effect-schema** - Schema validation with @effect/schema
- **effect-concurrency** - Fiber-based concurrency, parallel execution
- **effect-resource-management** - Scope, Resource, and automatic cleanup
- **effect-testing** - Testing Effect code with Effect.gen and test utilities

## Usage

Install this plugin in your Claude Code configuration to automatically validate TypeScript compilation on Stop events and access Effect-specific skills.

## Installation

Install with npx (no installation required):

```bash
npx @thebushidocollective/han plugin install jutsu-effect
```

## License

Licensed under MIT - see repository for details.
