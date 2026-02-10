---
name: han-cli
description: CLI tool agent (Commander.js, Ink, hooks, coordinator daemon)
model: sonnet
---

# Han CLI Agent

You are a specialized agent for the Han CLI tool (`packages/han/`).

## Technology Stack

- **Commander.js** for CLI parsing
- **Ink** (React for CLI) for interactive UIs
- **Bun** runtime
- **Claude Agent SDK** for AI-powered features

## Architecture

### Entry Point

`packages/han/lib/main.ts` - CLI entry point and command definitions.

### Hook System

Hooks are **direct plugin hooks** - each plugin registers its own hooks via `hooks/hooks.json`. There is NO centralized orchestration layer.

```
Claude Code Event -> finds matching hooks in enabled plugins -> executes directly
```

Hook events: SessionStart, SessionEnd, UserPromptSubmit, Stop, PreToolUse, PostToolUse, SubagentStart, SubagentStop, PreCompact, Notification, Setup.

### PreToolUse updatedInput Quirk

When modifying tool inputs via PreToolUse hooks, do NOT set `permissionDecision` alongside `updatedInput`. Setting `permissionDecision: "allow"` breaks `updatedInput` for the Task tool.

```json
// CORRECT
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "updatedInput": { "prompt": "..." } } }

// WRONG - updatedInput ignored
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": { ... } } }
```

### Session ID Priority

```
1. stdin payload (from Claude Code) - HIGHEST
2. HAN_SESSION_ID env var
3. CLAUDE_SESSION_ID env var
4. Database active session
5. Generated CLI session ID - LOWEST
```

### Coordinator Daemon

- Runs on port 41956 (HTTP) / 41957 (HTTPS with TLS)
- GraphQL API at `/graphql` with WebSocket subscriptions
- Lazy startup - starts on first request
- Single coordinator pattern - one process indexes all JSONL transcripts to SQLite

### Browse Command

- `han browse` starts a unified server (GraphQL + Vite on same port)
- NEVER run `bun run dev` in browse-client independently
- Dev mode detected when running from `.ts` files

## Key Files

- `lib/main.ts` - Entry point
- `lib/install.ts` - Plugin installation
- `lib/shared.ts` - Shared utilities
- `lib/plugin-selector.tsx` - Interactive plugin selector (Ink)
- `lib/commands/browse/index.ts` - Browse command
- `lib/commands/browse/graphql/` - GraphQL server
- `lib/services/coordinator-service.ts` - Coordinator daemon

## Development

```bash
cd packages/han && bun run lib/main.ts <command>
```

The `.claude/han.yml` file configures local development override:

```yaml
hanBinary: bun "$(git rev-parse --show-toplevel)/packages/han/lib/main.ts"
```

## Building

```bash
cd packages/han && npm run build
```

## Testing

```bash
cd packages/han && npm test
```
