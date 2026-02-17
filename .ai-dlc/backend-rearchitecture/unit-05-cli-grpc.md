---
status: completed
depends_on:
  - unit-04-han-coordinator
branch: ai-dlc/backend-rearchitecture/05-cli-grpc
discipline: backend
ticket: ""
---

# unit-05: cli-grpc (Pure Bun CLI with gRPC client + coordinator lifecycle)

## Description
Replace all NAPI imports in the CLI with gRPC calls to the coordinator and Bun builtins for utilities. The CLI becomes a pure Bun binary with zero native dependencies. It manages the coordinator binary lifecycle (auto-start, health check, shutdown) and translates Claude Code hook calls into gRPC requests with streamed output.

## Discipline
backend - TypeScript/Bun CLI using ConnectRPC client, buf code generation, and Bun builtins.

## Domain Entities
- **gRPC Client** - ConnectRPC transport connecting to coordinator on localhost:41956
- **Coordinator Lifecycle** - Binary download/discovery, daemon spawn, health check, auto-start
- **Hook Dispatch** - CLI receives Claude Code hook calls, delegates to coordinator via `HookService.ExecuteHooks` gRPC streaming
- **Slot Management** - CLI acquires/releases slots via `SlotService` gRPC
- **Session Queries** - CLI queries sessions via `SessionService` gRPC
- **Memory Search** - CLI delegates memory queries via `MemoryService` gRPC
- **Indexer Trigger** - CLI triggers scans via `IndexerService` gRPC

## Data Sources
- **Input**: `packages/han/lib/db/index.ts` - All direct DB imports to replace with gRPC calls
- **Input**: `packages/han/lib/native.ts` - NAPI loader to delete
- **Input**: `packages/han/lib/services/coordinator-service.ts` - Coordinator lifecycle to rewrite
- **Input**: `packages/han/lib/commands/hook/` - Hook dispatch/run commands to rewire
- **Input**: `crates/han-proto/proto/coordinator.proto` - Protobuf definitions (from unit-04)
- **Runtime**: Coordinator binary at `~/.han/bin/han-coordinator` or bundled in npm platform packages

## Technical Specification

### ConnectRPC Client Setup
```
packages/han/lib/grpc/
  client.ts              # ConnectRPC transport factory
  generated/             # buf-generated TypeScript types from coordinator.proto
```

Use `@connectrpc/connect` + `@connectrpc/connect-node` (or `@connectrpc/connect-web` with fetch transport). No heavy `grpc-node` dependency.

```typescript
// client.ts
import { createConnectTransport } from "@connectrpc/connect-node";
import { createClient } from "@connectrpc/connect";
import { CoordinatorService, SessionService, HookService, ... } from "./generated/coordinator_pb";

export function createCoordinatorClient(port = 41956) {
  const transport = createConnectTransport({
    baseUrl: `http://localhost:${port}`,
    httpVersion: "2",
  });
  return {
    coordinator: createClient(CoordinatorService, transport),
    sessions: createClient(SessionService, transport),
    hooks: createClient(HookService, transport),
    indexer: createClient(IndexerService, transport),
    slots: createClient(SlotService, transport),
    memory: createClient(MemoryService, transport),
  };
}
```

### buf Code Generation
```
packages/han/buf.gen.yaml
packages/han/buf.yaml
```

Generate TypeScript types from `crates/han-proto/proto/coordinator.proto`:
```yaml
# buf.gen.yaml
version: v2
plugins:
  - remote: buf.build/connectrpc/es
    out: lib/grpc/generated
    opt: target=ts
  - remote: buf.build/bufbuild/es
    out: lib/grpc/generated
    opt: target=ts
```

### Coordinator Lifecycle (`lib/services/coordinator-service.ts` rewrite)

The CLI manages the coordinator binary:

1. **Discovery**: Find `han-coordinator` binary:
   - Check `~/.han/bin/han-coordinator`
   - Check npm platform package (`@thebushidocollective/han-{platform}`) bundled binary
   - Check PATH
2. **Auto-start**: If gRPC health check fails, spawn coordinator as daemon:
   ```typescript
   Bun.spawn([coordinatorBinaryPath, "--daemon", "--port", "41956"], {
     stdio: ["ignore", "ignore", "ignore"],
   });
   ```
3. **Health check**: `CoordinatorService.Health()` with 2-second timeout
4. **Retry loop**: Health check with exponential backoff (100ms, 200ms, 400ms, 800ms, 1600ms) after auto-start
5. **`han coordinator start|stop|status|restart`** commands delegate to binary

### Hook Dispatch Rewrite (`lib/commands/hook/`)

Current flow:
```
Claude Code -> han hook run <event> -> CLI loads plugins, executes commands, records results
```

New flow:
```
Claude Code -> han hook run <event> -> CLI sends gRPC ExecuteHooks -> coordinator executes commands -> streams output back -> CLI prints to stdout/stderr
```

The `han hook run` command:
1. Reads stdin payload from Claude Code (session_id, event, cwd, tool_name, tool_input)
2. Sends `ExecuteHooksRequest` via gRPC to coordinator
3. Receives `stream HookOutput` messages
4. Prints `HookStdout` to process.stdout, `HookStderr` to process.stderr
5. On `HookCompleted`, exits with the hook's exit code
6. On `HookError`, prints error and exits with code 1

```typescript
// Simplified hook run
async function runHook(event: string, stdin: HookStdin) {
  const client = await getCoordinatorClient();
  const stream = client.hooks.executeHooks({
    event,
    sessionId: stdin.session_id,
    cwd: stdin.cwd,
    toolName: stdin.tool_name,
    toolInput: JSON.stringify(stdin.tool_input),
    stdinPayload: JSON.stringify(stdin),
  });

  let exitCode = 0;
  for await (const output of stream) {
    switch (output.output.case) {
      case "stdout": process.stdout.write(output.output.value.line); break;
      case "stderr": process.stderr.write(output.output.value.line); break;
      case "completed": exitCode = output.output.value.exitCode; break;
      case "error": console.error(output.output.value.message); exitCode = 1; break;
    }
  }
  process.exit(exitCode);
}
```

### Replace NAPI Utility Calls with Bun Builtins

| Current (NAPI) | Replacement (Bun) |
|---|---|
| `import { sha256 } from '../native'` | `new Bun.CryptoHasher("sha256").update(data).digest("hex")` |
| `import { globFiles } from '../native'` | `new Bun.Glob(pattern).scan({ cwd })` |
| `import { getGitRemote } from '../native'` | `Bun.spawn(["git", "remote", "get-url", "origin"])` |
| `import { getGitBranch } from '../native'` | `Bun.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"])` |
| `import { getGitRoot } from '../native'` | `Bun.spawn(["git", "rev-parse", "--show-toplevel"])` |
| `import { searchMessages } from '../native'` | `client.memory.search({ query, sessionId })` via gRPC |
| `import { getActiveSession } from '../native'` | `client.sessions.getActive({})` via gRPC |
| `import { acquireSlot } from '../native'` | `client.slots.acquire({ sessionId })` via gRPC |

### MCP Server Routing

The MCP server (`han mcp`) currently imports from the DB layer. Reroute all data queries through gRPC:
- `han mcp` starts, connects to coordinator via gRPC
- All tool handlers call gRPC instead of direct DB
- Memory search: `MemoryService.Search()`
- Session queries: `SessionService.List()`, `SessionService.Get()`

### Files to Modify/Delete

**Delete:**
- `packages/han/lib/native.ts` - NAPI loader with retry hack
- `packages/han/lib/db/index.ts` - Direct DB imports (replaced by gRPC)
- `packages/han/lib/db/` - Entire directory

**Rewrite:**
- `packages/han/lib/services/coordinator-service.ts` - Spawn Rust binary instead of Bun process
- `packages/han/lib/commands/hook/dispatch.ts` - gRPC calls for DB operations
- `packages/han/lib/commands/hook/run.ts` - Delegate to coordinator via streaming gRPC
- `packages/han/lib/commands/coordinator/` - Shell out to Rust binary
- `packages/han/lib/mcp/` - Route queries through gRPC

**Create:**
- `packages/han/lib/grpc/client.ts` - ConnectRPC client factory
- `packages/han/lib/grpc/generated/` - buf-generated types
- `packages/han/buf.gen.yaml` - buf configuration
- `packages/han/buf.yaml` - buf workspace config

### Distribution

The coordinator binary is distributed alongside the CLI:
- **Option A (recommended)**: Bundle in `@thebushidocollective/han-{platform}` npm packages alongside the Bun binary
- **Option B**: Separate download on first use from GitHub releases to `~/.han/bin/han-coordinator`

The CLI's `coordinator-service.ts` checks both locations.

## Success Criteria
- [ ] `han hook run Stop` sends gRPC `ExecuteHooks` request and streams output in real-time
- [ ] `han hook dispatch SessionStart` works end-to-end via coordinator gRPC
- [ ] `grep -r "from.*native" packages/han/lib/` returns zero results (no NAPI imports)
- [ ] `grep -r "from.*db/index" packages/han/lib/` returns zero results (no direct DB imports)
- [ ] `packages/han/package.json` has zero `napi` or `@napi-rs` dependencies
- [ ] CLI auto-starts coordinator if not running (lazy startup on first gRPC call)
- [ ] `han coordinator status` shows coordinator health
- [ ] MCP server queries route through gRPC to coordinator
- [ ] `buf generate` produces TypeScript types from coordinator.proto
- [ ] Bun builtins replace all NAPI utility calls (sha256, glob, git)
- [ ] 80% test coverage on gRPC client and hook dispatch

## Boundaries
This unit does NOT handle:
- Coordinator binary implementation (unit-04: han-coordinator)
- Database entities or migrations (unit-01: han-db)
- GraphQL schema (unit-03: han-api)
- Team server (unit-06: han-server)
- Deleting old code (unit-07: cleanup - but this unit may leave old imports commented/unused)

This unit PROVIDES: the pure Bun CLI that communicates exclusively via gRPC with the coordinator. Zero native dependencies.

## Notes
- The CLI should gracefully handle coordinator being unavailable for non-data operations (e.g., `han plugin install` doesn't need the coordinator).
- For hook execution, the CLI must forward the full stdin JSON payload from Claude Code to the coordinator. The coordinator needs it for hook command environment variables.
- ConnectRPC supports both HTTP/1.1 and HTTP/2. Use HTTP/2 for streaming.
- The `@connectrpc/connect-node` package uses Node.js http2 module. Verify Bun compatibility or use fetch-based transport.
- buf CLI (`npx @bufbuild/buf`) handles protobuf compilation without installing protoc.




