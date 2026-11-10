# Always Use --local Flag for Browse (CRITICAL)

## Rule

When starting `han browse` for local development or verification, **ALWAYS** use the `--local` flag:

```bash
cd packages/han && bun run lib/main.ts browse --local
```
## Behavior

In release binaries, `han browse` serves the embedded dashboard assets directly from loopback.

For local development from the repository checkout, use the `--local` flag:
```bash
cd packages/han && bun run lib/main.ts browse --local
```

The `--local` flag starts a **local Vite dev server** on port 41956 that:
- Serves the local browse-client source with HMR
- Starts relay-compiler in watch mode
- Reflects your uncommitted code changes immediately

## Verification After Changes

```bash
# Kill existing
lsof -ti:41956 | xargs kill -9 2>/dev/null

# Start LOCAL server
cd packages/han && bun run lib/main.ts browse --local &

# Wait and verify
sleep 12
curl -s -o /dev/null -w "%{http_code}" http://localhost:41956/  # Should return 200
```
