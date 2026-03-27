# Always Use --local Flag for Browse (CRITICAL)

## Rule

When starting `han browse` for local development or verification, **ALWAYS** use the `--local` flag:

```bash
cd packages/han && bun run lib/main.ts browse --local
```

## Why

Without `--local`, the browse command opens the **remote** dashboard at `dashboard.local.han.guru` and immediately exits. This does NOT serve the local browse-client code — it just opens the deployed Railway site in the browser.

The `--local` flag starts a **local Vite dev server** on port 41956 that:
- Serves the local browse-client source with HMR
- Starts relay-compiler in watch mode
- Reflects your uncommitted code changes immediately

## NEVER Do This

```bash
# WRONG — opens remote dashboard, doesn't serve local code
bun run lib/main.ts browse
```

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
