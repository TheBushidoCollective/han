---
name: browse-architecture
summary: Han browse command architecture - GraphQL + Vite unified server
---

# Browse Architecture

## Starting the Browse UI

**ALWAYS use `han browse`, NEVER start browse-client independently.**

```bash
# Correct way (from packages/han)
cd packages/han && bun lib/main.ts browse

# Or with options
bun lib/main.ts browse --port 41956 --no-open
```

## Architecture

`han browse` starts a **single unified server** that handles:

- GraphQL API at `/graphql` (with WebSocket subscriptions)
- Vite dev server (in development mode) with hot reload
- Static file serving (in production mode)

### Port Layout

- Main server: 41956 (default)
- All WebSockets (GraphQL subscriptions and Vite HMR) use the same port

### Mode Detection

- **Development**: Detected when running from `.ts` files or `NODE_ENV=development`
- **Production**: Detected when compiled binary or `NODE_ENV=production`

## File Locations

```text
packages/han/lib/commands/
├── browse.ts           # Command registration
└── browse/
    ├── index.ts        # Main server (GraphQL + Vite)
    ├── graphql/        # GraphQL schema and resolvers
    │   ├── schema.ts
    │   └── pubsub.ts
    ├── watch.ts        # File watcher for live updates
    └── types.ts        # TypeScript types

packages/browse-client/  # Frontend (served by han browse)
├── src/
└── out/                # Production build output
```

## Key Points

1. **browse-client has no backend** - It's purely frontend
2. **GraphQL is embedded** - Runs in same process as web server
3. **Hot reload works** - Vite middleware handles HMR in dev mode
4. **WebSocket subscriptions** - For real-time updates (memory events)

## Development Workflow

1. Make changes to browse-client code
2. Run `han browse` from packages/han
3. Hot reload updates automatically in browser
4. GraphQL changes require server restart
