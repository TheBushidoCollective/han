---
name: coordinator-daemon
summary: Rust coordinator, authenticated local transport, and supervisor lifecycle
---

# Coordinator Daemon Architecture

## Overview

The coordinator indexes Claude Code transcripts into SQLite and serves GraphQL queries, mutations, subscriptions, and gRPC operations. The Rust coordinator owns the database, file watcher, indexing, event broadcasts, and network listeners. The Han CLI starts and supervises it.

Key implementation paths:

- `packages/han-rs/crates/han-coordinator/src/main.rs`: startup, listeners, and lifecycle.
- `packages/han-rs/crates/han-coordinator/src/server.rs`: HTTPS health and GraphQL routes.
- `packages/han-rs/crates/han-coordinator/src/grpc.rs`: coordinator gRPC services.
- `packages/han-rs/crates/han-coordinator/src/runtime.rs`: private runtime descriptor and publication guard.
- `packages/han/lib/services/coordinator-service.ts`: child startup and authenticated shutdown.
- `packages/han/lib/commands/coordinator/daemon.ts`: CLI supervisor, crash recovery, stop, and restart.
- `packages/han/lib/coordinator/connection.ts`: descriptor validation and pinned local connections.

## Local transport

The coordinator binds HTTPS and gRPC listeners to `127.0.0.1`. The CLI coordinator port defaults to 41957 and can be configured with `HAN_COORDINATOR_PORT`; the Rust CLI also accepts its own gRPC port. Port 0 requests an ephemeral port. Consumers use the actual ports in the runtime descriptor rather than assuming either listener's port.

Each instance generates a new certificate and bearer token. Its owner-protected `runtime/coordinator.json` records the instance identity, process ID, ports, certificate, bearer token, and optional supervisor binding. Clients validate the descriptor, pin its certificate, and authenticate requests. The HTTPS listener serves `/health` and `/graphql`, including GraphQL WebSocket subscriptions. Request guards restrict authority, Origin, and credentials; the gRPC listener has equivalent local request guards.

The descriptor and token protect the local transport from other users and browser origins, not from an untrusted process running as the same operating-system user. A process with the same user privileges can read the private descriptor. Windows secure descriptor access is not provided by this implementation; it fails closed rather than assuming Unix permissions apply.

## Browse and client connections

`packages/han/lib/commands/browse/hosted-proxy.ts` starts a loopback proxy and forwards GraphQL HTTP and WebSocket traffic to the authenticated coordinator. The browser does not receive the coordinator bearer token or connect directly using a public coordinator DNS name. The browse command can use hosted dashboard assets or local assets through that proxy.

The public root shell accepts a cross-site top-level document navigation only
for a literal `GET /` with no Origin or upgrade and matching browser navigation
metadata. This permits the file launcher but does not identify the request as
coming from that launcher. Session exchange, GraphQL, and WebSocket upgrades
retain their authority, Origin, fetch metadata, and capability checks. The
launch capability is in the owner-protected launcher and session exchange, not
the HTTP navigation target. The shell's CSP continues to forbid framing.

CLI and gRPC clients obtain the runtime descriptor through `connection.ts`. An occupied port without a compatible descriptor fails closed instead of being treated as a trusted coordinator.

## Startup and ownership

The CLI can start the coordinator in the background or run the supervisor in the foreground:

```sh
han coordinator start
han coordinator stop
han coordinator restart
han coordinator status
```

The numeric `coordinator.pid` is informational. A nonempty `coordinator.pid.takeover` reservation directory holds the supervisor claim for its lifetime. Each acquisition publishes a unique owner record before its PID. Dead owners can be reclaimed; malformed metadata and uncertain ownership fail closed. Mixed old and new supervisor versions cannot share this ownership guarantee. Stop old supervisors before cutover.

A foreground supervisor assigns each owned child a binding containing the supervisor PID, its claim nonce, and a fresh generation ID. It keeps the child process referenced so it can reap it and release the matching records. A genuine child crash is eligible for restart; an attached coordinator is not treated as an owned child.

The Rust process binds its listeners and claims its coordinator lock before publishing readiness. Publication, withdrawal, and owner-checked descriptor cleanup use a shared protected lock file in the runtime directory.

## Authenticated shutdown

The CLI sends the authenticated Shutdown RPC using the descriptor it read for that instance. For a supervised child, Rust atomically moves the matching active descriptor into a generation-specific `coordinator.stopping.<nonce>.<generationId>.json` record before acknowledging the request. A replaced descriptor cannot be withdrawn by the old instance. The supervisor recognizes only an intent matching its own binding and child, waits for the child to exit, and removes the intent and its own claim.

The stop command waits for the relevant records and process to disappear. Restart stops the existing instance before starting another. A standalone Rust coordinator has no supervisor intent; an unrelated PID marker does not authorize signalling it. SIGINT and SIGTERM initiate the supervisor's cleanup path.

## Data and subscriptions

The Rust coordinator uses the `han-db`, `han-indexer`, and `han-api` crates. Its default database path is `~/.han/han.db`, subject to the configured Han data directory or explicit database path. The watcher bridge sends changes for indexing, and the coordinator broadcasts database changes to GraphQL subscriptions.

The data model includes repositories, projects, sessions, messages, native tasks, session todos, file changes and validations, and hook executions. See the coordinator data-layer blueprint for the schema and indexing details.

## Health and diagnostics

The authenticated HTTPS `GET /health` response includes status, version, PID, and uptime. Health checks use the descriptor's certificate and bearer. The supervisor uses health and child-process state to detect failures; certificate, descriptor, and authentication failures are not permission to signal an unrelated process.

The CLI keeps coordinator logs in its Han data directory. The CI path for the Rust tests and isolated supervisor proof is documented in `PATH.md`.

## Related Blueprints

- [Coordinator Data Layer](./coordinator-data-layer.md): database schema and indexing.
- [GraphQL Schema](./graphql-schema.md): type definitions and resolvers.
- [Browse Architecture](./browse-architecture.md): frontend integration.
- [Hook System](./hook-system.md): hook execution and caching.
