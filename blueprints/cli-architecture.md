# CLI Architecture

Entry point and command structure for the Han CLI.

## Overview

The Han CLI (`packages/bushido-han`) provides plugin management, hook execution, and MCP server functionality. It uses Commander.js for command parsing and Ink (React for CLI) for interactive UIs.

## Architecture

### Command Hierarchy

```
han (root program)
├── plugin          Plugin management
│   ├── install     Install plugins
│   ├── uninstall   Remove plugins
│   └── search      Search marketplace
├── hook            Hook utilities
│   ├── run         Execute plugin hooks
│   ├── dispatch    Dispatch Claude Code hooks
│   └── test        Validate hook configurations
├── mcp             MCP server mode
└── validate        Alias for hook run
```

### Entry Point

`lib/main.ts` initializes the CLI:

1. Resolves version from `HAN_VERSION` env or `package.json`
2. Creates Commander program with metadata
3. Registers command handlers from command modules
4. Parses arguments and routes to handlers

## API / Interface

### Commands

#### `han plugin install [plugins...]`

Install plugins from the marketplace.

**Options:**

- `--auto` - Auto-detect plugins based on codebase
- `--scope <scope>` - Installation scope (user, project, local)

#### `han plugin uninstall <plugins...>`

Remove installed plugins.

**Options:**

- `--scope <scope>` - Which scope to modify

#### `han hook run <plugin> <hook> [options]`

Execute a plugin hook.

**Options:**

- `--fail-fast` - Stop on first failure
- `--cached` - Only run if files changed
- `--only <dir>` - Limit to specific directory
- `--verbose` - Show detailed output

#### `han hook dispatch <hookType>`

Dispatch Claude Code hooks across all plugins.

#### `han mcp`

Start MCP server mode (JSON-RPC over stdio).

## Behavior

### Version Resolution

```typescript
const version = process.env.HAN_VERSION || packageJson.version;
```

### Command Registration

Each command module exports a `register*Commands(program)` function:

```typescript
export function registerPluginCommands(program: Command): void {
  const pluginCmd = program.command('plugin');
  pluginCmd.command('install').action(handleInstall);
  // ...
}
```

## Files

- `lib/main.ts:1-50` - Entry point, version resolution, program setup
- `lib/commands/plugin/index.ts` - Plugin command registration
- `lib/commands/hook/index.ts` - Hook command registration
- `lib/commands/mcp/index.ts` - MCP command registration
- `lib/commands/aliases.ts` - Command aliases

## Related Systems

- [Plugin Installation](./plugin-installation.md) - Installation flow
- [Hook System](./hook-system.md) - Hook execution
- [MCP Server](./mcp-server.md) - MCP implementation
