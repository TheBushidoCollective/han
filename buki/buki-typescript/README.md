# TypeScript

TypeScript compiler validation and type checking for TypeScript projects.

## Hooks

This plugin provides validation hooks that run TypeScript compiler checks:

### Stop & SubagentStop Hooks

Runs `tsc --noEmit` in all directories with a `tsconfig.json` file to validate TypeScript compilation without emitting files.

The hooks will:

- Discover all directories containing `tsconfig.json`
- Run `tsc --noEmit` in each directory
- Stop on the first failure with `--fail-fast`
- Exit with code 2 if any compilation errors are found

## Usage

Install this plugin in your Claude Code configuration to automatically validate TypeScript compilation on Stop and SubagentStop events.

## License

Licensed under MIT - see repository for details.
