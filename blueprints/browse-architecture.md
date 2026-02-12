---
name: browse-architecture
summary: Han browse command architecture - remote dashboard with local GraphQL coordinator
---

# Browse Architecture

## Overview

`han browse` provides a web-based dashboard for viewing Claude Code sessions. The architecture splits between:

- **Remote Dashboard**: Static site hosted on Railway at `dashboard.local.han.guru`
- **Local Coordinator**: GraphQL server + indexing daemon running on user's machine

This hybrid approach enables:
- Zero-installation dashboard access (just open the URL)
- Secure local data (never leaves the machine)
- Real-time updates via GraphQL subscriptions
- Cross-platform compatibility (React Native Web)

## Deployment Modes

### Default Mode (Remote Dashboard)

```bash
han browse
# Opens https://dashboard.local.han.guru
# Dashboard connects back to local coordinator for data
```

**Flow:**
1. Ensures local coordinator is running (lazy start on port 41956/41957)
2. Opens remote dashboard URL in browser
3. Dashboard detects coordinator via TLS (coordinator.local.han.guru)
4. GraphQL queries/subscriptions flow over HTTPS/WSS to local coordinator

**Benefits:**
- No local build/install needed
- Always latest dashboard version
- Fast startup (no bundling)
- Works from any device on local network

### Local Mode (--local)

```bash
han browse --local
# Builds and serves dashboard locally on port 41956
```

**Used for:**
- Development/testing
- Offline usage
- CI/CD verification

**Flow:**
1. Runs `Bun.build()` to bundle browse-client
2. Serves static files from `.browse-out/`
3. Opens `http://localhost:41956`

## Coordinator Daemon

The coordinator is a long-running process that provides:

### GraphQL API

- **Endpoint**: `https://coordinator.local.han.guru:41957/graphql`
- **Transport**: HTTPS with TLS certificates
- **Subscriptions**: WebSocket (WSS) on same port
- **Schema**: Relay-compatible with Cursor pagination

Built with:
- Pothos GraphQL for type-safe schema
- DataLoader for batching and caching
- PubSub for real-time subscriptions

### Database Indexing

- **Engine**: SQLite (han-native Rust bindings)
- **Source**: JSONL transcript files in `~/.claude/projects/*/`
- **Watcher**: Native FSEvents/inotify for file changes
- **Polling**: 30s full scan to catch missed events (macOS FSEvents can miss rapid changes)

**Indexed Data:**
- Sessions (metadata, project paths, status)
- Messages (assistant/user, tool calls, results, han events)
- Native tasks (TaskCreate/TaskUpdate events)
- Session summaries (compaction checkpoints)

### Single-Instance Coordination

**Lock Mechanism**: SQLite-based coordinator lock ensures only one instance indexes at a time.

**Failover**: If coordinator crashes, next instance detects stale lock and acquires it.

**Heartbeat**: Active coordinator updates heartbeat every 5s. Lock expires after 30s of missed heartbeats.

## File Structure

```
packages/han/lib/commands/
├── browse/
│   └── index.ts              # Browse command entry point
├── coordinator/
│   ├── index.ts              # Coordinator CLI commands
│   ├── daemon.ts             # Process management (start/stop/status)
│   ├── health.ts             # Health check utilities
│   └── launchd/              # macOS auto-start support
│       └── install.ts
├── graphql/
│   ├── schema.ts             # Pothos schema builder
│   ├── pubsub.ts             # Subscription event emitter
│   ├── loaders/              # DataLoader definitions
│   └── types/                # GraphQL type definitions (one per file)
└── services/
    └── coordinator-service.ts # Indexing service (watcher + pubsub)

packages/browse-client/
├── src/
│   ├── main.tsx              # App entry point
│   ├── theme.ts              # Design tokens (quarks)
│   ├── components/           # Atomic design structure
│   │   ├── atoms/            # Basic components (Box, Text, Button)
│   │   ├── molecules/        # Composed components (StatItem, Badge)
│   │   ├── organisms/        # Complex sections (SessionListItem, VirtualList)
│   │   ├── templates/        # Page layouts (PageLayout, Sidebar)
│   │   └── pages/            # Full pages with data (DashboardPage, SessionDetailPage)
│   ├── relay/                # Relay environment setup
│   └── lists/                # VirtualList configurations
├── build/
│   ├── build.ts              # Production build script (Bun bundler)
│   ├── relay-plugin.ts       # Bun plugin for Relay __generated__
│   ├── pages-plugin.ts       # Bun plugin for page routing
│   └── rnw-compat-plugin.ts  # React Native Web compatibility fixes
├── serve.ts                  # Static file server (Railway production)
├── Dockerfile                # Multi-stage build for Railway
├── index.html                # HTML template
└── vite.config.ts            # Vite dev server config
```

## Development Workflow

### Starting Development Server

```bash
cd packages/han
bun lib/main.ts browse --local

# OR for remote dashboard testing
bun lib/main.ts browse
```

**What happens (dev mode):**
1. Coordinator starts in foreground (auto-detected in dev)
2. Relay compiler starts in watch mode
3. GraphQL schema watcher regenerates `schema.graphql` on type changes
4. Vite dev server starts with HMR on port 41956
5. Browser opens to `http://localhost:41956`

**Hot Reload:**
- Browse-client changes: Vite HMR (instant)
- GraphQL types: schema regenerates → Relay recompiles → HMR refreshes
- Coordinator changes: requires restart (`han coordinator restart`)

### Production Build

```bash
cd packages/browse-client
bun run build
# Outputs to out/
```

**Build Process** (`build/build.ts`):
1. Uses Bun bundler with JS entrypoint (`src/main.tsx`)
2. Applies plugins: rnw-compat, relay, pages
3. Minifies and splits chunks
4. Finds entry-point output from build metadata
5. Generates `index.html` with correct script reference

**Why JS entrypoint?** Bun's HTML bundler has a bug on Linux where it assigns the wrong chunk as the entry script. Using JS entrypoint + manual HTML generation avoids this.

## Railway Deployment

**Service**: `han-dashboard`  
**Repository**: thebushidocollective/han  
**Root Directory**: `/packages/browse-client`  
**Domain**: `dashboard.local.han.guru`

### Build Process

```dockerfile
# Stage 1: Builder
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Stage 2: Production
FROM oven/bun:1
COPY --from=builder /app/out ./out
COPY --from=builder /app/serve.ts ./
CMD ["bun", "serve.ts"]
```

### Static File Server

`serve.ts` is a simple Bun HTTP server:
- Serves files from `out/` directory
- Falls back to `index.html` for SPA routing
- Uses `PORT` env var (Railway sets this)
- Supports standard MIME types

### CI/CD Flow

1. Push to `main` branch
2. GitHub Actions CI runs tests
3. Railway waits for all CI checks to pass
4. Railway pulls repo and runs Dockerfile
5. Deploys to `dashboard.local.han.guru`

**Note:** Railway auto-skips deployments if CI fails.

## Frontend Architecture

### React Native Web + Gluestack UI

**CRITICAL**: The browse-client uses React Native Web, NOT standard React.

**Forbidden:**
```tsx
// NEVER use HTML tags
<div>, <span>, <p>, <button>, <input>, <a>, <img>
```

**Required:**
```tsx
// ALWAYS use Gluestack/RN components
import { Box, VStack, HStack, Text, Button, Input, Image, Link } from '@/components/atoms';
```

**Why?** Cross-platform support. The same codebase can compile to iOS/Android apps via React Native.

### Atomic Design Structure

**Quarks** (`theme.ts`): Design tokens (colors, spacing, fonts)  
**Atoms** (`components/atoms/`): Basic building blocks (Box, Text, Button)  
**Molecules** (`components/molecules/`): Composed components (StatItem, Badge)  
**Organisms** (`components/organisms/`): Complex sections (SessionListItem, VirtualList)  
**Templates** (`components/templates/`): Page layouts (PageLayout, Sidebar)  
**Pages** (`components/pages/`): Full pages with data (DashboardPage)

**Import Rules:**
- Atoms import from quarks only
- Molecules import from atoms + quarks
- Organisms import from molecules + atoms + quarks
- Templates import from organisms down
- Pages import from any layer

### Relay for GraphQL

**Environment**: `src/relay/environment.ts`  
**Fragments**: Colocated with components (via Relay compiler)  
**Pagination**: Cursor-based with `@connection` directive  

**Pattern:**
```tsx
import { graphql, useFragment, usePaginationFragment } from 'react-relay';

const SessionListFragment = graphql`
  fragment SessionListFragment on Query
  @argumentDefinitions(first: { type: "Int", defaultValue: 20 })
  @refetchable(queryName: "SessionListPaginationQuery") {
    sessions(first: $first, after: $cursor)
    @connection(key: "SessionList_sessions") {
      edges { node { id slug status } }
    }
  }
`;
```

### VirtualList for Performance

**CRITICAL**: Paginated lists MUST use VirtualList (FlashList).

**Why?** Prevents DOM bloat with thousands of messages/sessions.

```tsx
import { VirtualList } from '@/components/organisms';

<VirtualList
  data={messageNodes}
  renderItem={(item) => <MessageCard fragmentRef={item} />}
  itemHeight={ItemHeights.MESSAGE_ITEM}
  dynamicHeights={true}
  onEndReached={handleLoadMore}
/>
```

**Chat Log Specific** (`SessionMessages`):
```tsx
<VirtualList
  inverted={true}  // NEVER REMOVE - enables bottom-up chat UX
  maintainVisibleContentPosition={{
    startRenderingFromBottom: true,
    autoscrollToBottomThreshold: 100,
  }}
/>
```

## GraphQL Subscriptions

### Real-Time Updates

**Events Published:**
- `sessionAdded`: New session created
- `sessionUpdated`: Session metadata changed
- `sessionMessageAdded`: New message (includes edge data for `@prependEdge`)
- `sessionTodosChanged`: Task status changed
- `sessionFilesChanged`: File-modifying tool executed
- `sessionHooksChanged`: Hook run/result added
- `hookResultAdded`: Hook result available
- `toolResultAdded`: MCP/exposed tool result available

### Subscription Pattern

```graphql
subscription SessionMessagesSubscription($sessionId: String!) {
  sessionMessageAdded(sessionId: $sessionId) {
    messageIndex
    edge @prependEdge(connections: ["Session_messages"]) {
      cursor
      node { id timestamp type rawJson }
    }
  }
}
```

**Relay auto-updates** the connection when using `@prependEdge` directive.

## Port Configuration

| Service | Default Port | TLS Port | Environment Variable |
|---------|-------------|----------|---------------------|
| Coordinator | 41956 | 41957 | `HAN_COORDINATOR_PORT` |
| Browse (local) | 41956 | - | `HAN_BROWSE_PORT` |

**TLS Certificates**: Coordinator uses local.han.guru wildcard cert for HTTPS.

## Health Checks

```typescript
// Check if coordinator is running
const running = await isCoordinatorRunning(coordinatorPort);

// Health check with protocol detection
const health = await checkHealthHttps(coordinatorPort);
// Returns: { protocol: 'https', host: 'coordinator.local.han.guru' }

// Ensure coordinator (lazy start)
const status = await ensureCoordinator(coordinatorPort);
// Starts daemon if not running, waits for health check
```

## Multi-Environment Support

**Config Directories**: Coordinator can index multiple config directories (e.g., different user accounts).

```bash
# Register additional config directory
han coordinator register --config-dir /path/to/.claude --name "Work Account"
```

**Watcher**: Adds `/path/to/.claude/projects` to watch paths. Sessions from all registered directories appear in the dashboard.

## Coordinator Lifecycle

### SessionStart Hook

The core plugin's SessionStart hook ensures coordinator is running:

```yaml
hooks:
  ensure-coordinator:
    event: SessionStart
    command: han coordinator ensure --background
```

**Background Mode**: Starts daemon without blocking session startup. Health check happens asynchronously.

### Manual Control

```bash
# Start coordinator
han coordinator start

# Stop coordinator
han coordinator stop

# Restart coordinator
han coordinator restart

# Check status
han coordinator status

# View logs
han coordinator logs -f
```

### macOS Auto-Start (launchd)

```bash
# Install as launchd agent (starts on login)
han coordinator launchd install

# Uninstall
han coordinator launchd uninstall

# Check status
han coordinator launchd status
```

## Testing

### Playwright E2E Tests

```bash
cd packages/browse-client
npx playwright test
```

**Coverage:**
- Dashboard loads and displays sessions
- Session detail page shows messages
- Sidebar navigation works
- Real-time updates via subscriptions
- VirtualList scrolling and pagination

### Verification Script

After GraphQL/coordinator changes, verify browse loads:

```bash
# Kill existing processes
lsof -ti:41956 | xargs kill -9 2>/dev/null

# Start browse
cd packages/han && bun lib/main.ts browse --local &

# Wait for startup
sleep 8

# Verify HTTP responds
curl -o /dev/null -w "%{http_code}" http://localhost:41956/
# Should return 200

# Verify GraphQL responds
curl http://localhost:41956/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | grep -q "data"
# Should print "data"
```

## Common Issues

### Coordinator Not Found

**Symptom**: Dashboard shows "Coordinator unavailable" placeholder.

**Fix:**
```bash
han coordinator start
# Wait 5 seconds, refresh dashboard
```

### Stale Schema

**Symptom**: Relay compilation errors, GraphQL type mismatches.

**Fix:**
```bash
cd packages/han
bun run schema:export > ../browse-client/schema.graphql

cd ../browse-client
npx relay-compiler
```

### TLS Certificate Issues

**Symptom**: Browser warns about invalid certificate for `coordinator.local.han.guru`.

**Fix**: Coordinator uses self-signed cert. Add exception in browser or use `--local` mode.

### Build Failures on Linux

**Known Issue**: Bun HTML bundler assigns wrong entry chunk on Linux.

**Workaround**: Use JS entrypoint pattern (already implemented in `build/build.ts`).

## Architecture Decisions

### Why Remote Dashboard?

- **Zero installation**: Users just open a URL
- **Auto-updates**: No need to rebuild/reinstall for UI changes
- **Multi-device**: Access from phone/tablet on local network
- **Fast startup**: No local bundling delay

### Why Local Coordinator?

- **Data privacy**: JSONL transcripts never leave the machine
- **Performance**: Direct SQLite access, no network latency
- **Security**: No cloud API, no authentication needed
- **Offline**: Works without internet (except dashboard load)

### Why React Native Web?

- **Cross-platform**: Can ship iOS/Android apps from same codebase
- **Performance**: Native-optimized components
- **Accessibility**: Built-in a11y primitives
- **Design system**: Gluestack provides token-based theming

### Why Relay?

- **Type safety**: Full TypeScript integration
- **Colocation**: Fragments live with components
- **Performance**: Automatic batching, deduplication, caching
- **Pagination**: Built-in cursor pagination with `@connection`
- **Subscriptions**: First-class support with `@prependEdge`

### Why Bun?

- **Speed**: Faster builds than Webpack/Vite for production
- **Simplicity**: Built-in bundler, no config bloat
- **Compatibility**: Supports plugins for Relay integration
- **Runtime**: Fast server for `serve.ts`

## Future Enhancements

- [ ] Mobile app (React Native iOS/Android)
- [ ] Plugin marketplace integration
- [ ] Advanced search/filtering
- [ ] Session diffing
- [ ] Export sessions to Markdown/PDF
- [ ] Team collaboration features
- [ ] Analytics/insights dashboard