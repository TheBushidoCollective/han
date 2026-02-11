# npm

NPM package manager skills with dependency validation hooks for Claude Code.

## Features

- **Automatic dependency sync**: Ensures `npm install` runs when `package.json` or `package-lock.json` changes
- **Smart caching**: Only runs when relevant files have changed
- **CI-like behavior**: Tries `npm ci` first for reproducible installs, falls back to `npm install`

## Installation

```bash
han plugin install npm
```

## Hooks

### install (Stop hook)

Automatically runs when you stop Claude Code to ensure dependencies are in sync:

- Detects directories containing `package-lock.json`
- Only runs if `package.json` or `package-lock.json` have changed since last successful run
- Attempts `npm ci` first for faster, reproducible installs
- Falls back to `npm install` if lockfile needs updating

## Configuration

You can customize the hook behavior in your project's `han-config.yml`:

```yaml
npm:
  hooks:
    install:
      enabled: true
      # Override the command if needed
      # command: "npm install"
```

To disable the hook for a specific project:

```yaml
npm:
  hooks:
    install:
      enabled: false
```

## Note

If your project uses yarn instead of npm, consider using `yarn` instead.
