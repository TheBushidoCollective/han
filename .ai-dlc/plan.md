# Implementation Plan: unit-04-permissions

## Overview

This unit implements the permissions system that enforces repo-based access control, privacy rules, and configurable manager visibility for the Han Team Platform.

## Architecture

```
GraphQL Request → Permission Middleware → Resolver → PermissionService → GitProviderService
                                                            ↓
                                                    Permission Cache (5min TTL)
```

## Phase 1: Permission Service Foundation

### 1.1 Define Permission Types

**File**: `packages/han/lib/permissions/types.ts`

```typescript
export type AccessLevel = "none" | "read" | "write" | "maintain" | "admin";
export type OrgRole = "owner" | "admin" | "member" | "viewer";

export interface PermissionResult {
  allowed: boolean;
  accessLevel: AccessLevel;
  reason: string;
  source: "cache" | "api" | "override";
}

export interface CachedPermission {
  userId: string;
  repoId: string;
  accessLevel: AccessLevel;
  cachedAt: number;
  expiresAt: number;
}
```

### 1.2 Git Provider Service Interface

**File**: `packages/han/lib/permissions/git-provider.ts`

```typescript
export interface GitProviderService {
  name: "github" | "gitlab";
  checkRepoAccess(token, owner, repo, username): Promise<AccessLevel>;
  getRepoOwnership(token, owner, repo): Promise<RepoOwnership>;
  checkOrgMembership(token, orgName, username): Promise<{ isMember: boolean }>;
}
```

### 1.3 GitHub Provider

**File**: `packages/han/lib/permissions/providers/github.ts`

- `GET /repos/{owner}/{repo}/collaborators/{username}/permission`
- `GET /repos/{owner}/{repo}` for owner type
- `GET /orgs/{org}/members/{username}`

### 1.4 GitLab Provider

**File**: `packages/han/lib/permissions/providers/gitlab.ts`

- `GET /api/v4/projects/:id/members/:user_id`
- `GET /api/v4/projects/:id`
- `GET /api/v4/groups/:id/members/:user_id`

## Phase 2: Permission Caching Layer

**File**: `packages/han/lib/permissions/cache.ts`

- 5-minute TTL
- In-memory LRU cache with size limit
- Background refresh for active users
- Webhook-based invalidation (optional)

## Phase 3: Core Permission Service

**File**: `packages/han/lib/permissions/service.ts`

```typescript
async canViewSession(user, session): Promise<PermissionResult> {
  // 1. Personal repo check - only owner can view
  // 2. Org membership check
  // 3. Repo access check (cached)
  // 4. Manager override check
  // 5. Default deny + audit log
}
```

### Personal Repo Detection

**File**: `packages/han/lib/permissions/repo-ownership.ts`

Parse remote URLs:
- `git@github.com:owner/repo.git`
- `https://github.com/owner/repo.git`

## Phase 4: GraphQL Field-Level Authorization

### Extend GraphQL Context

```typescript
export interface GraphQLContext {
  user?: AuthenticatedUser;
  permissions?: PermissionService;
  mode: "local" | "hosted";
}
```

### Session Query with Authorization

- Local mode: no auth needed
- Hosted mode: check `permissions.canViewSession()`
- Filter session lists by permission

## Phase 5: Audit Logging

**File**: `packages/han/lib/permissions/audit.ts`

```typescript
interface AuditLogEntry {
  eventType: "permission_denied" | "permission_granted";
  userId: string;
  targetType: "session" | "org" | "repo";
  targetId: string;
  reason: string;
  timestamp: string;
}
```

PostgreSQL table: `permission_audit_logs`

## Phase 6: Manager Visibility Configuration

```sql
ALTER TABLE organizations ADD COLUMN visibility_settings JSONB DEFAULT '{
  "managerCanSeeAll": false,
  "aggregatedMetricsPublic": true,
  "failMode": "closed"
}';
```

GraphQL mutation for org admins to update settings.

## Key Files to Create

1. `packages/han/lib/permissions/types.ts`
2. `packages/han/lib/permissions/git-provider.ts`
3. `packages/han/lib/permissions/providers/github.ts`
4. `packages/han/lib/permissions/providers/gitlab.ts`
5. `packages/han/lib/permissions/cache.ts`
6. `packages/han/lib/permissions/service.ts`
7. `packages/han/lib/permissions/repo-ownership.ts`
8. `packages/han/lib/permissions/audit.ts`
