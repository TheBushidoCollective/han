# jutsu-lerna

Lerna monorepo management skills with bootstrap validation hooks for Claude Code.

## Features

- **Automatic dependency bootstrapping**: Ensures `lerna bootstrap` runs when package dependencies change
- **Smart caching**: Only runs when relevant files have changed
- **CI-like behavior**: Tries `--ci` flag first for faster installs, falls back to regular bootstrap

## Installation

```bash
han plugin install jutsu-lerna
```

## Hooks

### bootstrap (Stop hook)

Automatically runs when you stop Claude Code to ensure monorepo dependencies are properly linked:

- Detects directories containing `lerna.json`
- Only runs if `package.json`, `lerna.json`, or lockfiles have changed since last successful run
- Attempts `lerna bootstrap --ci` first for faster, reproducible installs
- Falls back to `lerna bootstrap` if needed

## Configuration

You can customize the hook behavior in your project's `han-config.yml`:

```yaml
jutsu-lerna:
  hooks:
    bootstrap:
      enabled: true
      # Override the command if needed
      # command: "npx lerna bootstrap"
```

To disable the hook for a specific project:

```yaml
jutsu-lerna:
  hooks:
    bootstrap:
      enabled: false
```

## Note

For modern Lerna (v7+) using npm/yarn/pnpm workspaces, the bootstrap command links local packages and installs remaining dependencies. Consider using `jutsu-npm` or `jutsu-yarn` alongside this plugin for complete dependency management.
