# jutsu-yarn

Yarn package manager skills with dependency validation hooks for Claude Code.

## Features

- **Automatic dependency sync**: Ensures `yarn install` runs when `package.json` or `yarn.lock` changes
- **Smart caching**: Only runs when relevant files have changed
- **Frozen lockfile support**: Tries `--frozen-lockfile` first for CI-like behavior, falls back to regular install

## Installation

```bash
han plugin install jutsu-yarn
```

## Hooks

### install (Stop hook)

Automatically runs when you stop Claude Code to ensure dependencies are in sync:

- Detects directories containing `yarn.lock`
- Only runs if `package.json` or `yarn.lock` have changed since last successful run
- Attempts `yarn install --check-files --frozen-lockfile` first
- Falls back to `yarn install` if lockfile needs updating

## Configuration

You can customize the hook behavior in your project's `han-config.yml`:

```yaml
jutsu-yarn:
  hooks:
    install:
      enabled: true
      # Override the command if needed
      # command: "yarn install"
```

To disable the hook for a specific project:

```yaml
jutsu-yarn:
  hooks:
    install:
      enabled: false
```
