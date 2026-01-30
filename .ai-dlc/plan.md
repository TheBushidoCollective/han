# Data Synchronization System - Implementation Plan

## Overview

This plan details the implementation of a data synchronization system that transfers session data from local han instances to the hosted team platform. The system must be:
- **Resilient**: Queue-based with retry logic and offline support
- **Efficient**: Incremental sync with compression and delta encoding
- **Privacy-aware**: Personal repos excluded, org ownership validation

## Architecture

```
Local Han Instance                           Hosted Platform
┌─────────────────────┐                    ┌─────────────────────┐
│ SQLite Database     │                    │ PostgreSQL Database │
└────────┬────────────┘                    └──────────┬──────────┘
         │                                            │
         ▼                                            ▼
┌─────────────────────┐   HTTPS POST       ┌─────────────────────┐
│ Sync Client         │ ───────────────►   │ Sync Receiver API   │
│ - Queue Manager     │   /api/sync        │ - Auth validation   │
│ - Privacy Filter    │   (gzipped JSON)   │ - Deduplication     │
│ - Delta Calculator  │                    │ - Org mapping       │
└─────────────────────┘                    └─────────────────────┘
```

## Phase 1: Sync Protocol Definition

### 1.1 Data Model for Sync

**File: `packages/han/lib/sync/types.ts`**

```typescript
interface SyncPayload {
  version: "1.0";
  clientId: string;
  userId: string;
  timestamp: string;
  cursor: SyncCursor;
  sessions: SyncSession[];
  checksum: string;
}

interface SyncSession {
  id: string;
  projectSlug: string;
  repoRemote: string;
  status: string;
  slug: string | null;
  messages: SyncMessage[];
  tasks: SyncTask[];
  lastModified: string;
}

interface SyncCursor {
  lastSessionId: string | null;
  lastMessageLineNumber: number;
  lastSyncTimestamp: string;
}
```

### 1.2 Sync Protocol Specification

**Endpoint:** `POST /api/sync`

**Headers:**
- `Authorization: Bearer <api_key>`
- `Content-Type: application/json`
- `Content-Encoding: gzip`

**Response:**
```typescript
interface SyncResponse {
  status: "success" | "partial" | "error";
  cursor: SyncCursor;
  processed: number;
  errors: SyncError[];
}
```

## Phase 2: Configuration System

**File: `packages/han/lib/config/han-settings.ts`**

```typescript
interface SyncConfig {
  enabled?: boolean;
  endpoint?: string;
  apiKey?: string;
  interval?: number;        // seconds (default: 300)
  batchSize?: number;       // messages per batch (default: 1000)
  includePersonal?: boolean;
  forceInclude?: string[];
  forceExclude?: string[];
}
```

Environment variables:
- `HAN_SYNC_ENABLED`
- `HAN_SYNC_API_KEY`
- `HAN_SYNC_ENDPOINT`

## Phase 3: Privacy Filtering

**File: `packages/han/lib/sync/privacy-filter.ts`**

```typescript
function checkSyncEligibility(
  session: Session,
  repo: Repo,
  config: SyncConfig,
  userId: string
): SyncEligibility {
  // 1. Check forced exclusions
  // 2. Check forced inclusions
  // 3. Check personal repo (excluded by default)
  // 4. Org repo = eligible
}
```

## Phase 4: Sync Client Implementation

### 4.1 Queue Manager

**File: `packages/han/lib/sync/queue.ts`**

- Persist queue to `~/.claude/han/sync-queue.json`
- Exponential backoff: 1s, 2s, 4s... max 1 hour
- Process on session end + periodic catch-up

### 4.2 Delta Calculator

**File: `packages/han/lib/sync/delta.ts`**

- Track `lastSyncedLine` per session
- Only sync messages after last synced line
- Store state in `~/.claude/han/sync-state.json`

### 4.3 Sync Client

**File: `packages/han/lib/sync/client.ts`**

- Check eligibility before sync
- Build payload with unsyced data
- Compress with gzip
- Update cursors on success

## Phase 5: Server-Side Receiver

**File: `packages/han/lib/api/sync-receiver.ts`**

```typescript
async function processSyncPayload(payload, user) {
  for (const session of payload.sessions) {
    // Validate repo ownership
    // Upsert session and messages
    // Update aggregated metrics
  }
}
```

Deduplication via composite key `(session_id, message_id)` with ON CONFLICT.

## Phase 6: Integration Points

### Session End Hook
Trigger sync when session ends with high priority.

### CLI Commands
```bash
han sync status
han sync session <id>
han sync all
han sync queue
```

## Phase 7: Monitoring

- SyncStatus type exposed via GraphQL
- Structured logging for all operations
- Error tracking with retry counts

## Implementation Sequence

1. Define sync types and protocol
2. Extend configuration system
3. Implement privacy filtering
4. Build sync client (queue, delta, client)
5. Build sync receiver API
6. Add integration hooks and CLI
7. Add monitoring and status tracking

## Key Files to Create

1. `packages/han/lib/sync/types.ts`
2. `packages/han/lib/sync/privacy-filter.ts`
3. `packages/han/lib/sync/queue.ts`
4. `packages/han/lib/sync/delta.ts`
5. `packages/han/lib/sync/client.ts`
6. `packages/han/lib/api/sync-receiver.ts`
7. `packages/han/lib/commands/sync/index.ts`
