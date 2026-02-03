# Browse UI Verification (Mandatory)

After ANY changes to:
- `packages/han/lib/graphql/**` (GraphQL types, schema, loaders, pubsub)
- `packages/han/lib/services/coordinator-service.ts`
- `packages/han/lib/commands/browse/**`
- `packages/browse-client/**`

**You MUST verify browse loads before marking the task complete:**

```bash
# 1. Kill any existing processes
lsof -ti:41956 | xargs kill -9 2>/dev/null
lsof -ti:41957 | xargs kill -9 2>/dev/null

# 2. Start browse in background
cd packages/han && bun run lib/main.ts browse &

# 3. Wait for startup
sleep 8

# 4. Verify both endpoints respond
curl -s -o /dev/null -w "%{http_code}" http://localhost:41956/  # Should return 200
curl -s http://localhost:41956/graphql -X POST -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | grep -q "data" && echo "GraphQL OK"
```

If either check fails, debug and fix before completing the task.
