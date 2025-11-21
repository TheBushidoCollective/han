# Markdownlint

Markdown linting and style checking with markdownlint.

## Hooks

This plugin provides validation hooks that run markdownlint checks:

### Stop & SubagentStop Hooks

Runs `markdownlint-cli2` in all directories with a `package.json` file to validate Markdown files.

The hooks will:

- Discover all directories containing `package.json`
- Run `markdownlint-cli2` on all `**/*.md` files (excluding `node_modules`)
- Stop on the first failure with `--fail-fast`
- Exit with code 2 if any linting errors are found

## Usage

Install this plugin in your Claude Code configuration to automatically validate Markdown files on Stop and SubagentStop events.

## Configuration

You can configure markdownlint by adding a `.markdownlint.json` or `.markdownlint.jsonc` file to your project root.

Example `.markdownlint.json`:

```json
{
  "default": true,
  "MD013": false,
  "MD041": false
}
```

## License

Licensed under MIT - see repository for details.
