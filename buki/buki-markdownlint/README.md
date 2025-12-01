# Markdownlint

Markdown linting and style checking with markdownlint.

## Hooks

This plugin provides validation hooks that run markdownlint checks:

### Stop & SubagentStop Hooks

Runs `markdownlint-cli` in all directories with markdownlint configuration files to validate Markdown files.

The hooks will:

- Discover all directories containing `.markdownlint.json`, `.markdownlint.jsonc`, `.markdownlint.yaml`, or `.markdownlint.yml`
- Run `markdownlint-cli` on all `**/*.md` files (excluding `node_modules`)
- Automatically fix fixable issues with `--fix`
- Stop on the first failure with `--fail-fast`
- Exit with code 2 if any linting errors are found

## Usage

Install this plugin in your Claude Code configuration to automatically validate Markdown files on Stop and SubagentStop events.

## Configuration

Configure markdownlint by adding a configuration file to directories you want to lint:

- `.markdownlint.json` or `.markdownlint.jsonc` (JSON format)
- `.markdownlint.yaml` or `.markdownlint.yml` (YAML format)

Example `.markdownlint.json`:

```json
{
  "default": true,
  "MD013": false,
  "MD041": false
}
```

## Installation

Install with npx (no installation required):

```bash
npx @thebushidocollective/han plugin install buki-markdownlint
```

## License

Licensed under MIT - see repository for details.
