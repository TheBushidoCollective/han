# Local Dashboard Development

## Rule: Always Open the Local Dashboard When Developing Locally

When developing or testing browse-client or GraphQL changes locally, **always use the local dashboard** served by `han browse`, not the remote Railway deployment.

## How to Start

```bash
# From the han package directory
cd packages/han && bun run lib/main.ts browse
```

This starts the coordinator with:
- GraphQL API at `https://localhost:41957/graphql`
- Web UI at `http://localhost:41956/`

## Verification After Changes

After modifying GraphQL types, resolvers, or browse-client components:

```bash
# Kill existing processes
lsof -ti:41956 | xargs kill -9 2>/dev/null
lsof -ti:41957 | xargs kill -9 2>/dev/null

# Start fresh
cd packages/han && bun run lib/main.ts browse &
sleep 8

# Verify
curl -s -o /dev/null -w "%{http_code}" http://localhost:41956/
curl -sk https://localhost:41957/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | grep -q "data" && echo "GraphQL OK"
```

## Why Local, Not Remote

1. **Immediate feedback** — See changes without deploying to Railway
2. **Real data** — Local coordinator reads from your actual `~/.han/han.db`
3. **GraphQL iteration** — Test schema changes against the local server
4. **No deployment lag** — Railway builds add delays to the feedback loop

## When to Use Remote

Only use the remote dashboard (`dashboard.local.han.guru`) for:
- Final verification before merging
- Testing TLS/CORS behavior in production-like environment
- Demonstrating to others
