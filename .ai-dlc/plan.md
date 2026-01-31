# Implementation Plan for Unit 01: Core Backend

## Executive Summary

This unit builds the foundational data abstraction layer that enables the same GraphQL schema to work with both SQLite (local mode) and PostgreSQL (hosted mode). The critical path is the DataSource interface abstraction, followed by PostgreSQL schema design with multi-tenant isolation.

---

## Phase 1: DataSource Interface Definition

**Goal**: Define a clean abstraction that resolvers can use without knowing the underlying database.

**Location**: `packages/han/lib/data/`

### 1.1 Core Interface (`packages/han/lib/data/interfaces.ts`)

```typescript
// Define the DataSource interface with all query methods
interface DataSource {
  // Session operations
  sessions: {
    get(sessionId: string): Promise<Session | null>;
    list(options?: SessionListOptions): Promise<Session[]>;
    getConnection(options: ConnectionArgs): Promise<SessionConnection>;
  };

  // Message operations
  messages: {
    list(options: MessageListOptions): Promise<Message[]>;
    count(sessionId: string): Promise<number>;
    countBatch(sessionIds: string[]): Promise<Record<string, number>>;
    timestampsBatch(sessionIds: string[]): Promise<Record<string, SessionTimestamps>>;
    search(options: SearchOptions): Promise<Message[]>;
  };

  // Project/Repo operations
  projects: {
    get(projectId: string): Promise<Project | null>;
    list(): Promise<Project[]>;
    getBySlug(slug: string): Promise<Project | null>;
  };

  repos: {
    get(repoId: string): Promise<Repo | null>;
    list(): Promise<Repo[]>;
  };

  // Task/Metrics operations
  tasks: {
    queryMetrics(options?: MetricsOptions): Promise<TaskMetrics>;
    list(sessionId: string): Promise<NativeTask[]>;
  };

  // Hook operations
  hookExecutions: {
    list(sessionId: string): Promise<HookExecution[]>;
    queryStats(period?: string): Promise<HookStats>;
  };

  // File operations
  fileChanges: {
    list(sessionId: string): Promise<SessionFileChange[]>;
  };

  fileValidations: {
    listAll(sessionId: string): Promise<SessionFileValidation[]>;
  };
}
```

### 1.2 Type Definitions (`packages/han/lib/data/types.ts`)

Define shared types that work across both implementations:
- Re-export existing types from `han-native`
- Add connection/pagination types for GraphQL
- Add filter option types

---

## Phase 2: LocalDataSource Implementation

**Goal**: Wrap existing han-native SQLite operations into the DataSource interface.

**Location**: `packages/han/lib/data/local/`

### 2.1 LocalDataSource Class (`packages/han/lib/data/local/index.ts`)

```typescript
import * as db from '../../db/index.ts';
import type { DataSource } from '../interfaces.ts';

export class LocalDataSource implements DataSource {
  sessions = {
    async get(sessionId: string) {
      return db.sessions.get(sessionId);
    },
    async list(options) {
      return db.sessions.list(options);
    },
    // ... wrap all existing db.sessions methods
  };

  messages = {
    async list(options) {
      return db.messages.list(options);
    },
    async count(sessionId) {
      return db.messages.count(sessionId);
    },
    // ... wrap all existing db.messages methods
  };

  // ... wrap remaining operations
}
```

**Key Insight**: This is a thin wrapper. All current `db/index.ts` operations get delegated through the interface. No logic changes, just structural wrapping.

---

## Phase 3: GraphQL Context Refactoring

**Goal**: Inject DataSource into GraphQL context so resolvers use abstraction.

### 3.1 Update GraphQL Context (`packages/han/lib/graphql/builder.ts`)

```typescript
export interface GraphQLContext {
  request?: Request;
  loaders: GraphQLLoaders;
  dataSource: DataSource;  // ADD THIS
  mode: 'local' | 'hosted';  // ADD THIS
}
```

### 3.2 Update Handler (`packages/han/lib/graphql/handler.ts`)

```typescript
import { LocalDataSource } from '../data/local/index.ts';

export function createGraphQLHandler(options?: { dataSource?: DataSource }) {
  const dataSource = options?.dataSource ?? new LocalDataSource();

  return createYoga<GraphQLContext>({
    // ...existing config...
    context: ({ request }) => ({
      request,
      loaders: createLoaders(),
      dataSource,
      mode: dataSource instanceof LocalDataSource ? 'local' : 'hosted',
    }),
  });
}
```

---

## Phase 4: Resolver Migration

**Goal**: Update existing resolvers to use `context.dataSource` instead of direct `db` imports.

### 4.1 Resolver Changes Pattern

**Before** (direct db access):
```typescript
// packages/han/lib/graphql/types/session.ts
import { sessions } from '../../db/index.ts';

resolve: async (_parent, args) => {
  return sessions.get(args.id);
}
```

**After** (context-based):
```typescript
resolve: async (_parent, args, context) => {
  return context.dataSource.sessions.get(args.id);
}
```

### 4.2 Files Requiring Updates

Based on grep analysis, these files import from `db/index.ts` and need migration:

1. `packages/han/lib/graphql/types/session.ts`
2. `packages/han/lib/graphql/types/project.ts`
3. `packages/han/lib/graphql/types/repo.ts`
4. `packages/han/lib/graphql/types/metrics.ts`
5. `packages/han/lib/graphql/types/hook-execution.ts`
6. `packages/han/lib/graphql/types/activity-data.ts`
7. `packages/han/lib/graphql/loaders.ts`
8. `packages/han/lib/api/sessions.ts`

### 4.3 Loaders Refactoring

Update `createLoaders()` to accept DataSource:

```typescript
export function createLoaders(dataSource: DataSource): GraphQLLoaders {
  return {
    sessionMessagesLoader: new DataLoader(async (sessionIds) => {
      // Use dataSource instead of direct db calls
      const results = await Promise.all(
        sessionIds.map(id => dataSource.messages.list({ sessionId: id }))
      );
      return results;
    }),
    // ... update other loaders
  };
}
```

---

## Phase 5: PostgreSQL Schema Design

**Goal**: Design multi-tenant schema for hosted mode.

**Location**: `packages/han/lib/data/hosted/schema/`

### 5.1 Core Multi-Tenant Tables

```sql
-- Organization (top-level tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams within organizations
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Projects within teams
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  path TEXT,
  relative_path TEXT,
  is_worktree BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Repositories linked to projects
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  remote VARCHAR(512) NOT NULL,
  name VARCHAR(255) NOT NULL,
  default_branch VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, remote)
);

-- Users (synced from OAuth providers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  provider VARCHAR(50), -- 'github', 'gitlab', 'email'
  provider_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

-- Memberships (user access to orgs/teams)
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id, team_id)
);

-- Sessions (Claude Code sessions synced from local)
CREATE TABLE sessions (
  id UUID PRIMARY KEY, -- Matches local session ID
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Who ran the session
  status VARCHAR(50) DEFAULT 'active',
  slug VARCHAR(255), -- Human-readable session name
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages (synced from local JSONL)
CREATE TABLE messages (
  id UUID PRIMARY KEY, -- Matches local message ID
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_id VARCHAR(50),
  parent_id UUID REFERENCES messages(id),
  message_type VARCHAR(100) NOT NULL,
  role VARCHAR(50),
  content TEXT,
  tool_name VARCHAR(255),
  raw_json JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  line_number INT NOT NULL,
  indexed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for multi-tenant queries
CREATE INDEX idx_sessions_org ON sessions(organization_id);
CREATE INDEX idx_sessions_project ON sessions(project_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_org ON messages(organization_id);
CREATE INDEX idx_messages_timestamp ON messages(session_id, timestamp DESC);
```

### 5.2 Row-Level Security Policies

```sql
-- Enable RLS on all tenant tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Session policy: users see sessions in their orgs
CREATE POLICY session_access ON sessions
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = current_setting('app.user_id')::uuid
    )
  );

-- Message policy: follows session access
CREATE POLICY message_access ON messages
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = current_setting('app.user_id')::uuid
    )
  );
```

---

## Phase 6: HostedDataSource Implementation

**Goal**: Implement DataSource interface for PostgreSQL.

**Location**: `packages/han/lib/data/hosted/`

### 6.1 Database Connection (`packages/han/lib/data/hosted/db.ts`)

Use Drizzle ORM for type-safe PostgreSQL access:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export function createHostedDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}
```

### 6.2 HostedDataSource Class (`packages/han/lib/data/hosted/index.ts`)

```typescript
import { eq, desc, and, inArray } from 'drizzle-orm';
import type { DataSource } from '../interfaces.ts';
import * as schema from './schema.ts';

export class HostedDataSource implements DataSource {
  constructor(
    private db: ReturnType<typeof createHostedDb>,
    private organizationId: string, // Tenant context
  ) {}

  sessions = {
    async get(sessionId: string) {
      const result = await this.db.query.sessions.findFirst({
        where: and(
          eq(schema.sessions.id, sessionId),
          eq(schema.sessions.organizationId, this.organizationId),
        ),
      });
      return result ? this.mapSession(result) : null;
    },

    async list(options) {
      const results = await this.db.query.sessions.findMany({
        where: eq(schema.sessions.organizationId, this.organizationId),
        orderBy: desc(schema.sessions.startedAt),
        limit: options?.limit ?? 100,
      });
      return results.map(this.mapSession);
    },
    // ... implement remaining methods
  };

  // Map PostgreSQL row to common type
  private mapSession(row: typeof schema.sessions.$inferSelect): Session {
    return {
      id: row.id,
      projectId: row.projectId,
      status: row.status,
      slug: row.slug,
      // ... map all fields
    };
  }
}
```

---

## Phase 7: Migrations Infrastructure

**Goal**: Set up database migration system for PostgreSQL.

**Location**: `packages/han/lib/data/hosted/migrations/`

### 7.1 Migration Tool

Use Drizzle-Kit for migrations:

```typescript
// drizzle.config.ts
export default {
  schema: './packages/han/lib/data/hosted/schema.ts',
  out: './packages/han/lib/data/hosted/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
};
```

### 7.2 Migration Commands

Add to `packages/han/package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:migrate": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Phase 8: Testing and Verification

**Goal**: Ensure local mode continues working with no regressions.

### 8.1 Test Strategy

1. **Unit Tests**: Test DataSource interface implementations
2. **Integration Tests**: Test GraphQL resolvers with both data sources
3. **Regression Tests**: Ensure `han browse` works identically

### 8.2 Verification Steps

```bash
# 1. Start local browse and verify all features work
cd packages/han && bun lib/main.ts browse

# 2. Run existing tests
bun test

# 3. Test GraphQL queries work
curl -X POST http://localhost:41956/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ sessions(first: 5) { edges { node { id } } } }"}'
```

---

## Dependencies and Sequencing

```
Phase 1 (Interface)
    │
    ├──► Phase 2 (LocalDataSource)
    │
    ├──► Phase 3 (Context Refactor) ─────► Phase 4 (Resolver Migration)
    │
    └──► Phase 5 (PostgreSQL Schema) ────► Phase 6 (HostedDataSource)
                                              │
                                              └──► Phase 7 (Migrations)

Phase 8 (Testing) runs continuously after Phase 2 completes
```

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing browse | High | Phase 2 creates thin wrapper, minimal code changes |
| Type mismatches between SQLite/PostgreSQL | Medium | Define canonical types in `interfaces.ts`, map in implementations |
| Performance regression | Medium | Keep DataLoaders, add PostgreSQL-specific batching |
| Migration complexity | Low | Use Drizzle ORM with generated migrations |

---

## Critical Files for Implementation

- `packages/han/lib/db/index.ts` - Current SQLite data access layer to wrap
- `packages/han/lib/graphql/builder.ts` - GraphQL context definition to extend
- `packages/han/lib/graphql/loaders.ts` - DataLoaders to refactor for abstraction
- `packages/han-native/src/schema.rs` - Type definitions to align with PostgreSQL schema
- `packages/han/lib/graphql/types/session.ts` - Example resolver pattern to follow for migration
