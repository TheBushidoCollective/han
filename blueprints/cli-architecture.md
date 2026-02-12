---
name: cli-architecture
summary: Entry point, command structure, and CLI framework
---

# CLI Architecture

Entry point and command structure for the Han CLI.

## Overview

The Han CLI (`packages/han`) provides plugin management, hook execution, MCP server functionality, and Browse UI. It uses Commander.js for command parsing and Ink (React for CLI) for interactive UIs.

## Architecture

### Command Hierarchy

```
han (root program)
├── plugin          Plugin management
│   ├── install     Install plugins
│   ├── uninstall   Remove plugins
│   └── list        List installed plugins
├── hook            Hook utilities
│   ├── run         Execute plugin hooks
│   └── list        List available hooks
├── mcp             MCP server mode
├── browse          Start Browse UI and GraphQL server
├── coordinator     Coordinator daemon management
├── memory          Memory system queries
├── blueprints      Blueprint management
├── doctor          Diagnostic checks
├── setup           Setup wizard
├── completion      Shell completion
└── aliases         Command aliases
```

### Entry Point

`lib/main.ts` initializes the CLI:

1. Checks for `hanBinary` config and re-execs if needed
2. Resolves version from `HAN_VERSION` env or generated build info
3. Creates Commander program with metadata
4. Registers command handlers from command modules
5. Parses arguments and routes to handlers

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

#### `han hook run <plugin> <hook>`

Execute a plugin hook.

**Options:**

- `--cached` - Only run if files changed
- `--verbose` - Show detailed output

#### `han browse`

Start Browse UI server with GraphQL coordinator.

**Options:**

- `--port <port>` - Override port (default: auto-allocated)

#### `han mcp`

Start MCP server mode (JSON-RPC over stdio).

#### `han coordinator start`

Start coordinator daemon in background.

#### `han memory <question>`

Query the memory system.

**Options:**

- `--scope <scope>` - Memory scope (personal, team, rules)

## Behavior

### Version Resolution

```typescript
const version = HAN_VERSION; // From build-info.generated.ts
```

### Binary Re-execution

Han supports `hanBinary` configuration for development:

```yaml
# .claude/han.yml
hanBinary: bun "$(git rev-parse --show-toplevel)/packages/han/lib/main.ts"
```

When set, all `han` invocations re-exec to the configured binary.

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

- `lib/main.ts` - Entry point, version resolution, program setup, re-exec logic
- `lib/commands/plugin/index.ts` - Plugin command registration
- `lib/commands/hook/index.ts` - Hook command registration
- `lib/commands/mcp/index.ts` - MCP command registration
- `lib/commands/browse/index.ts` - Browse command
- `lib/commands/coordinator/index.ts` - Coordinator commands
- `lib/commands/memory/index.ts` - Memory commands
- `lib/commands/blueprints/index.ts` - Blueprint commands
- `lib/commands/doctor.ts` - Doctor command
- `lib/commands/setup/index.ts` - Setup wizard
- `lib/commands/completion/index.ts` - Shell completion
- `lib/commands/aliases.ts` - Command aliases

## Related Systems

- [Plugin Installation](./plugin-installation.md) - Installation flow
- [Hook System](./hook-system.md) - Hook execution
- [MCP Server](./mcp-server.md) - MCP implementation
- [Browse Architecture](./browse-architecture.md) - Browse UI
- [Coordinator Daemon](./coordinator-daemon.md) - GraphQL server