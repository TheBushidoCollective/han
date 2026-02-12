# Blueprints

Technical documentation for this project's architecture and systems.

## When to Consult Blueprints

Before modifying system architecture, use Glob and Read on the `blueprints/` directory to understand:
- Current design decisions and rationale
- Integration points and dependencies
- Established patterns to follow

## Key Triggers

Consult blueprints when working on:
- GraphQL schema changes
- CLI command modifications
- MCP server integrations
- Plugin architecture changes
- Database schema updates
- Hook system modifications

## After Modifications

Update blueprints using the Write tool on `blueprints/{name}.md` when you:
- Add new systems or major features
- Change architectural patterns
- Discover undocumented conventions

## Available Blueprints

<!-- AUTO-GENERATED INDEX - DO NOT EDIT BELOW THIS LINE -->
| Blueprint | Summary |
|-----------|---------|
| blueprint-system | Skills-based blueprint management with frontmatter metadata |
| browse-architecture | Han browse command architecture - remote dashboard with local GraphQL coordinator |
| build-deployment | CI/CD with auto-versioning, cross-platform builds from Linux, npm OIDC publishing, and Railway deployment |
| cli-architecture | Entry point, command structure, and CLI framework |
| cli-interface | Interactive CLI with Commander.js, Ink UI, and AI-powered plugin discovery via Agent SDK |
| coordinator-daemon | Coordinator daemon with GraphQL server, lazy startup, file watching, and unified data access via han-native |
| coordinator-data-layer | JSONL transcript indexing to SQLite via han-native with FTS5 search and DataLoader-compatible batch queries |
| distribution-architecture | NPM wrapper with platform-specific Bun binaries, curl installer, and Homebrew distribution |
| han-events-logging | Session-scoped logging of Han events (hooks, MCP calls) to JSONL files indexed into SQLite for Browse UI visibility |
| han-memory-system | Memory system with Agent SDK synthesis, multi-strategy search (FTS/Vector/Hybrid), plugin-discovered MCP providers, and read-only Memory Agent for autonomous research |
| hook-result-parent-linkage | Hook result messages need parent_id linkage to hook run messages |
| hook-system | Direct plugin hook execution via Claude Code with no centralized orchestration |
| marketplace | Central plugin registry with canonical names, backward-compatible aliases, and category-based organization |
| mcp-server | MCP tool exposure via direct plugin registration and dynamic han_workflow orchestrator |
| metrics-system | Automatic task tracking via Claude Code native TaskCreate/TaskUpdate indexed from JSONL transcripts |
| native-module | Rust NAPI-RS bindings providing complete database layer, JSONL indexing, FTS search, and coordinator management |
| plugin-directory | Filesystem organization with category-based directories and short plugin identifiers |
| plugin-installation | Multi-scope plugin installation with auto-detection, three-tier UX fallback, and npm distribution |
| plugin-types | Plugin categories organized by function: core, languages, validation, services, tools, frameworks, disciplines |
| rust-graphql-migration | [PROPOSAL] Migration plan for tight DB-GraphQL coupling with Seaography, Relay connections, and sqlite3_update_hook subscriptions |
| sdlc-coverage | AI-native engineering workflow alignment with OpenAI's framework |
| settings-management | Multi-scope settings with precedence rules |
| validation | Configuration validation and schema enforcement |
| website | Static marketplace site with search and documentation |
