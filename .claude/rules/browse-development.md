# Browse Development Rules

## Starting the Browse UI

**ALWAYS use `han browse`, NEVER start browse-client independently.**

```bash
# Correct way (from packages/han)
cd packages/han && bun lib/main.ts browse
```

## Architecture

- `han browse` starts a **single unified server** on port 41956
- GraphQL API at `/graphql` with WebSocket subscriptions
- Vite dev server with hot reload (dev mode only)
- Static file serving from `out/` (production mode)
- All WebSockets (GraphQL + HMR) use the same port

## Key Rules

1. **browse-client is frontend only** - No independent backend
2. **GraphQL is embedded** - Runs in same process as web server
3. **Never run `bun run dev` in browse-client** - Use `han browse` instead
4. **Mode detection** - Dev mode when running from `.ts` files

## File Locations

- Command: `packages/han/lib/commands/browse/index.ts`
- GraphQL: `packages/han/lib/commands/browse/graphql/`
- Frontend: `packages/browse-client/`
