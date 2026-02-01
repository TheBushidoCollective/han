# Blueprints

Technical documentation for this project's architecture and systems.

## When to Consult Blueprints

Before modifying system architecture, use `search_blueprints` and `read_blueprint` to understand:
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

Update blueprints via `write_blueprint` when you:
- Add new systems or major features
- Change architectural patterns
- Discover undocumented conventions

## Available Blueprints

<!-- AUTO-GENERATED INDEX - DO NOT EDIT BELOW THIS LINE -->
| Blueprint | Summary |
|-----------|---------|
| blueprint-system | MCP-based blueprint management with frontmatter metadata |
| browse-architecture | Han browse command architecture - GraphQL + Vite unified server |
| build-deployment | CI/CD automation for releases and deployments |
| checkpoint-system | Session and agent checkpoints for scoped hook execution |
| cli-architecture | Entry point, command structure, and CLI framework |
| cli-interface | Interactive CLI with AI-powered plugin discovery |
| coordinator-daemon | Coordinator daemon architecture with GraphQL server, lazy startup, and unified data access |
| coordinator-data-layer | Single-coordinator pattern for indexing JSONL transcripts to SQLite database |
| distribution-architecture | NPM wrapper + platform-specific Bun binaries distribution model |
| han-events-logging | Session-scoped logging of Han events (hooks, MCP calls) to JSONL files indexed into SQLite for Browse UI visibility |
| han-memory-system | Complete architecture and implementation of Han Memory - five-layer semantic memory with synthesis via Agent SDK, streaming output, and citation-backed answers |
| hook-result-parent-linkage | Hook result messages need parent_id linkage to hook run messages |
| hook-system | Complete hook lifecycle from definition to execution with centralized orchestration, checkpoint filtering, and cross-plugin dependencies |
| marketplace | Central plugin registry and distribution |
| mcp-server | Model Context Protocol server exposing plugin tools |
| metrics-system | Self-reporting agent performance tracking with validation |
| native-module | High-performance Rust bindings for hook operations |
| plugin-directory | Filesystem organization and naming conventions |
| plugin-installation | Installation flow and marketplace integration |
| plugin-types | Bushido, Jutsu, Do, and Hashi plugin categories |
| rust-graphql-migration | Migration plan for tight DB-GraphQL coupling with Seaography, Relay connections, and sqlite3_update_hook subscriptions |
| sdlc-coverage | AI-native engineering workflow alignment with OpenAI's framework |
| settings-management | Multi-scope settings with precedence rules |
| validation | Configuration validation and schema enforcement |
| website | Static marketplace site with search and documentation |
