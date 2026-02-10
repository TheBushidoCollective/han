# Han - AI Code Quality Marketplace

Han is a curated marketplace of plugins for AI coding agents. It provides
quality gates, validation hooks, MCP server integrations, and specialized
disciplines that work across multiple AI coding tools.

## Context Injection

Run this command at the start of each session to load Han plugin context
(installed plugin rules, project conventions, and quality guidelines):

```bash
npx -y @thebushidocollective/han hook dispatch SessionStart
```

The output should be treated as system-level instructions for the session.

## Validation

After making code changes, run validation hooks to check your work:

```bash
npx -y @thebushidocollective/han hook dispatch Stop
```

## Project Structure

```
han/
  packages/
    han/              # CLI tool (Commander.js + Ink + Agent SDK)
    browse-client/    # Browse UI (React Native Web + Gluestack + Relay)
  plugins/
    core/             # Core foundation plugin (hooks, MCP, memory)
    languages/        # Language plugins (typescript, rust, etc.)
    validation/       # Validation plugins (biome, eslint, etc.)
    frameworks/       # Framework plugins (relay, nextjs, etc.)
    services/         # Service plugins (github, gitlab, etc.)
    tools/            # Tool plugins (playwright, vitest, etc.)
    disciplines/      # Discipline plugins (frontend, backend, api, etc.)
    bridges/          # Bridge plugins (opencode, gemini-cli, kiro, codex)
  website/            # Documentation and marketplace site (han.guru)
```

## Development Commands

```bash
# Build the CLI
cd packages/han && npm run build

# Run tests
cd packages/han && npm test

# Format code
cd website && npx biome format --write .

# Run Playwright tests
cd website && npx playwright test

# Start browse UI (always use this, never run browse-client independently)
cd packages/han && bun run lib/main.ts browse
```

## Critical Development Rules

### Browse Client: React Native Web Only

The browse-client is built with **react-native-web** and **Gluestack UI** for
cross-platform support. **Never use HTML tags directly.**

| Instead of | Use |
|------------|-----|
| `<div>` | `<Box>`, `<VStack>`, `<HStack>` |
| `<span>`, `<p>` | `<Text>` |
| `<h1>`-`<h6>` | `<Heading size="...">` |
| `<button>` | `<Button>`, `<Pressable>` |
| `<input>` | `<Input>` |
| `<img>` | `<Image>` |
| `<a>` | `<Link>` |

Import from `@/components/atoms`, `@/components/molecules`, etc. following
Atomic Design methodology (quarks, atoms, molecules, organisms, templates, pages).

### GraphQL: One Type Per File

Each file in `packages/han/lib/graphql/types/` must contain exactly one primary
type definition. Name files after the type they contain (e.g., `session.ts` for
`SessionType`).

### GraphQL: No Result Messages in Connections

Result-type messages (ToolResultMessage, McpToolResultMessage, HookResultMessage,
etc.) must never appear in the `Session.messages` connection. They are resolved
as fields on their parent type via DataLoader (e.g., `ToolUseBlock.result`).

### Database: Never Load Full Tables

Always use SQL for searching/filtering. Use FTS when available. Push filtering
to the database, paginate at the database level. Never load entire tables into
JS/TS and filter in memory.

### Rust: Mutex Re-entrancy Deadlock

Rust's `std::sync::Mutex` is not reentrant. If a function acquires a lock and
calls another function that acquires the same lock, it deadlocks. Use SQL
`RETURNING` clauses instead of separate getter calls after insert/update.

### Virtualized Lists

Paginated lists with large datasets must use `VirtualList` (FlashList).
SessionMessages uses `inverted={true}` for chat-log UX (newest at bottom).
Never replace VirtualList with simple `map()` rendering. Never remove
`inverted={true}` from SessionMessages.

## CI/CD Conventions

- **Linux-only runners**: Never use macOS or Windows runners (they are paid).
  Cross-compile for all platforms from Linux.
- Use `cargo-zigbuild` for Linux/Darwin targets, `cargo-xwin` for Windows MSVC.
- Darwin builds use Docker (`ghcr.io/rust-cross/cargo-zigbuild:latest`) for
  macOS SDK access.
- Railway waits for all GitHub CI checks before deploying.

## Plugin Conventions

### Short Names (Current)

Plugins use short names matching their directory, not prefixed names:

| Correct | Incorrect |
|---------|-----------|
| `typescript` | `jutsu-typescript` |
| `github` | `hashi-github` |
| `frontend` | `do-frontend-development` |

### Skills Replace Commands

Plugins use `skills/` directories with `SKILL.md` files. The `commands/`
directory is deprecated. Skills are invocable via `/skill-name` syntax.

### Marketplace Aliases

Never remove alias entries from `marketplace.json`. Old prefixed names must
remain as aliases pointing to the same source directory for backwards
compatibility with existing user installations.

## Versioning

Version bumps happen automatically via GitHub Actions:

- `feat:` commits trigger MINOR bumps
- `fix:`, `refactor:`, etc. trigger PATCH bumps
- `!` or `BREAKING CHANGE:` triggers MAJOR bumps

## Learn More

- Website: https://han.guru
- GitHub: https://github.com/thebushidocollective/han
- Install: `npx @thebushidocollective/han plugin install --auto`
