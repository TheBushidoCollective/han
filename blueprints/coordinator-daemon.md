---
name: coordinator-daemon
summary: Coordinator daemon architecture with GraphQL server, lazy startup, and unified data access
---

# Coordinator Daemon Architecture

## Overview

The coordinator is a lazily-started daemon that serves as the central GraphQL server and data manager for all Han processes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Coordinator Daemon (:41957)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              GraphQL Server (Pothos)                     │   │
│  │         Queries + Mutations + Subscriptions              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────┐  ┌────────┴───────┐  ┌──────────────────┐   │
│  │ File Watcher │  │     SQLite     │  │     PubSub       │   │
│  │ (JSONL→DB)   │  │   (Database)   │  │  (Subscriptions) │   │
│  └──────────────┘  └────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
        │                    │                    │
   HTTP/WS :41957       HTTP/WS :41957       HTTP/WS :41957
        │                    │                    │
┌───────┴───────┐   ┌────────┴───────┐   ┌───────┴───────┐
│    Browse     │   │   MCP Server   │   │     Hooks     │
│ (static files)│   │ (GraphQL client│   │(GraphQL client│
│   :41956      │   │   + codegen)   │   │  + codegen)   │
└───────┬───────┘   └────────────────┘   └───────────────┘
        │
   Static files
        │
┌───────┴───────┐
│   Frontend    │
│   (Relay)     │──── connects directly to :41957 ────►
└───────────────┘
```

## Ports

| Port | Service | Purpose |
|------|---------|---------|
| 41956 | Browse | Static file server (UI) |
| 41957 | Coordinator | GraphQL server (API) |

## Components

### Coordinator Daemon

**Location:** `packages/han/lib/commands/coordinator/`

**Responsibilities:**

- GraphQL server (queries, mutations, subscriptions)
- SQLite database management (WAL mode)
- JSONL file watching and indexing
- PubSub for real-time subscription events
- Single source of truth for all data

**Lifecycle:**

- Lazily started by first client (browse, MCP, hooks)
- Runs as detached daemon process
- PID file at `~/.claude/han/coordinator.pid`
- Stays running until explicitly stopped or system restart

**CLI Commands:**

```bash
han coordinator start   # Start daemon (if not running)
han coordinator stop    # Stop daemon gracefully
han coordinator status  # Check if running, show PID
```

### Browse (Static Server)

**Location:** `packages/han/lib/commands/browse/`

**Responsibilities:**

- Serve static frontend files
- Dev mode: Vite with HMR
- Prod mode: Simple Bun static server
- Ensure coordinator is running on startup

**No longer responsible for:**

- GraphQL handling (moved to coordinator)
- WebSocket proxying (frontend connects directly)
- PubSub (moved to coordinator)

### Frontend (Relay)

**Location:** `packages/browse-client/`

**Configuration:**

```typescript
// Direct connection to coordinator
const GRAPHQL_HTTP = 'http://localhost:41957/graphql';
const GRAPHQL_WS = 'ws://localhost:41957/graphql';
```

### MCP Server / Hooks

**GraphQL Client:**

- Use `graphql-request` + GraphQL Code Generator
- Type-safe operations generated from schema
- Connect to `http://localhost:41957/graphql`

## Lazy Startup Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client starts (browse/MCP)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ Check if coordinator running  │
              │ (try connect to :41957)       │
              └───────────────────────────────┘
                     │              │
                 Responds        Connection refused
                     │              │
                     ▼              ▼
              ┌──────────┐  ┌─────────────────┐
              │ Continue │  │ Spawn daemon:   │
              └──────────┘  │ han coordinator │
                            │ start           │
                            │                 │
                            │ Wait for ready  │
                            │ (poll :41957)   │
                            │                 │
                            │ Then continue   │
                            └─────────────────┘
```

**Helper function:**

```typescript
export async function ensureCoordinator(): Promise<void> {
  // Try to connect
  const healthy = await checkCoordinatorHealth();
  if (healthy) return;
  
  // Spawn daemon
  spawn('han', ['coordinator', 'start'], {
    detached: true,
    stdio: 'ignore'
  }).unref();
  
  // Wait for ready (poll with timeout)
  await waitForCoordinator({ timeout: 10000 });
}
```

## GraphQL Schema

The existing Pothos schema moves to coordinator. Key additions:

### Mutations (for MCP/hooks)

```graphql
type Mutation {
  # Task/Metrics
  createTask(input: TaskInput!): Task!
  completeTask(input: TaskCompletionInput!): Task!
  failTask(input: TaskFailureInput!): Task!
  
  # Hook cache
  setHookCache(input: HookCacheInput!): Boolean!
  invalidateHookCache(key: String!): Boolean!
  
  # Existing
  togglePlugin(...): PluginMutationResult!
  removePlugin(...): PluginMutationResult!
}
```

### Subscriptions (existing)

```graphql
type Subscription {
  sessionUpdated(sessionId: ID!): SessionUpdatedPayload!
  sessionMessageAdded(sessionId: ID!): SessionMessageAddedPayload!
  sessionAdded(parentId: ID): SessionAddedPayload!
  # ... etc
}
```

## File Structure

```
packages/han/lib/commands/
├── coordinator/
│   ├── index.ts          # CLI entry (start/stop/status)
│   ├── daemon.ts         # Daemon process main loop
│   ├── server.ts         # GraphQL server setup
│   └── health.ts         # Health check endpoint
├── browse/
│   ├── index.ts          # Static server (simplified)
│   └── dev.ts            # Vite dev server
└── ...

packages/han/lib/graphql/
├── schema.ts             # Pothos schema (shared)
├── client.ts             # GraphQL client for MCP/hooks
└── generated/            # Code-generated types
```

## CORS Configuration

Coordinator allows requests from browse origin:

```typescript
cors: {
  origin: ['http://localhost:41956'],
  credentials: true
}
```

---

## Future Exploration: Hosted Dashboard

### Vision (Not Yet Implemented)

**Note:** This is a potential future direction being explored. The current implementation uses `han browse` to serve the UI locally.

Potential future state: Eliminate the need for local UI serving by hosting the dashboard and using DNS + certificate infrastructure for secure local connections.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  https://dashboard.han.guru                     │
│                  Hosted on Vercel/Cloudflare (CDN)             │
│                  Static Relay frontend                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + WebSocket
                              │ (valid Let's Encrypt cert)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              https://coordinator.han.guru:41957                 │
│              DNS A record → 127.0.0.1                           │
│              Valid Let's Encrypt certificate                    │
│              Actually connects to localhost!                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     Local coordinator daemon
```

### How It Works

1. **DNS Configuration:**
   - `dashboard.han.guru` → CDN edge servers (Vercel/Cloudflare)
   - `coordinator.han.guru` → `127.0.0.1` (A record pointing to localhost)

2. **Certificate Issuance:**
   - Use DNS-01 challenge (TXT record) to validate domain ownership
   - Issue Let's Encrypt certificate for `coordinator.han.guru`
   - Certificate is valid for the domain, even though it resolves to localhost

3. **Certificate Distribution:**
   - Host cert + key at `https://certs.han.guru/coordinator/latest`
   - Coordinator downloads and caches cert on startup
   - Auto-refresh before expiry (Let's Encrypt = 90 days)

4. **Security Model:**
   - Private key is "public" but domain resolves to 127.0.0.1
   - Cannot MITM yourself - connection stays local
   - Cert just satisfies browser security requirements
   - Same pattern used by Plex (`*.plex.direct`)

### Benefits

- **No local browse process needed** - UI is hosted
- **Instant UI updates** - No han upgrades for frontend changes
- **Valid HTTPS** - Browser trusts the connection
- **Same origin** - `*.han.guru` avoids CORS complexity
- **Works offline** - After initial cert fetch, coordinator runs locally

### Implementation Steps

1. **Infrastructure Setup:**

   ```
   dashboard.han.guru  → Vercel/Cloudflare (static hosting)
   coordinator.han.guru → 127.0.0.1 (DNS A record)
   certs.han.guru      → Certificate distribution server
   ```

2. **Cert Server:**
   - Automated Let's Encrypt renewal via DNS-01
   - Secure distribution endpoint (could require han version/auth)
   - Returns PEM bundle: `{ cert: string, key: string, expires: Date }`

3. **Coordinator HTTPS:**

   ```typescript
   // On startup
   const { cert, key } = await fetchCertificate();
   
   Bun.serve({
     port: 41957,
     tls: { cert, key },
     // ... GraphQL handlers
   });
   ```

4. **Frontend Configuration:**

   ```typescript
   // In production (hosted dashboard)
   const GRAPHQL_ENDPOINT = 'https://coordinator.han.guru:41957/graphql';
   
   // Falls back to local for development
   const GRAPHQL_ENDPOINT = 'http://localhost:41957/graphql';
   ```

### Rollout Plan

1. **Phase 1 (Current):** Local browse + local coordinator
2. **Phase 2:** Add HTTPS support to coordinator (optional cert)
3. **Phase 3:** Set up DNS + cert infrastructure
4. **Phase 4:** Deploy hosted dashboard
5. **Phase 5:** Deprecate local browse (coordinator-only)
