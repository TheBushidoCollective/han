# Han Development Rules

## Project Overview

Han is a curated marketplace of plugins for AI coding agents. It provides
quality gates, validation hooks, MCP server integrations, and specialized
disciplines that work across multiple AI coding tools.

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

## Critical Rules

### Browse Client: React Native Web Only

The browse-client uses react-native-web and Gluestack UI. Never use HTML tags.

| Instead of | Use |
|------------|-----|
| `<div>` | `<Box>`, `<VStack>`, `<HStack>` |
| `<span>`, `<p>` | `<Text>` |
| `<h1>`-`<h6>` | `<Heading size="...">` |
| `<button>` | `<Button>`, `<Pressable>` |
| `<input>` | `<Input>` |
| `<img>` | `<Image>` |
| `<a>` | `<Link>` |

Follow Atomic Design: quarks (theme.ts), atoms, molecules, organisms,
templates, pages.

### GraphQL: One Type Per File

Each file in `packages/han/lib/graphql/types/` contains exactly one primary
type definition. Name files after the type they contain.

### GraphQL: No Result Messages in Connections

Result-type messages (ToolResultMessage, McpToolResultMessage,
HookResultMessage) must never appear in `Session.messages`. Resolve them as
fields on their parent type via DataLoader.

### Database: Never Load Full Tables

Use SQL for filtering, FTS for search, paginate at the database level. Never
load entire tables into JS/TS and filter in memory.

### Rust: Mutex Deadlocks

`std::sync::Mutex` is not reentrant. If a function holds a lock and calls
another function that acquires the same lock, it deadlocks. Use SQL `RETURNING`
clauses instead of separate getter calls.

### Virtualized Lists

Use `VirtualList` (FlashList) for paginated data. SessionMessages uses
`inverted={true}` for chat UX. Never replace with `map()` rendering.

## CI/CD Conventions

- Linux-only runners (never macOS or Windows - they are paid)
- Cross-compile with `cargo-zigbuild` (Linux/Darwin) and `cargo-xwin` (Windows)
- Darwin builds use Docker for macOS SDK access
- Railway waits for all GitHub CI checks before deploying

## Plugin Conventions

- Short names: `typescript`, `github`, `frontend` (not `jutsu-typescript`,
  `hashi-github`, `do-frontend-development`)
- Skills replace commands: use `skills/` with `SKILL.md`, not `commands/`
- Never remove alias entries from `marketplace.json`

## Versioning

Automatic via GitHub Actions:

- `feat:` = MINOR bump
- `fix:`, `refactor:` = PATCH bump
- `!` or `BREAKING CHANGE:` = MAJOR bump
