---
status: completed
depends_on: []
branch: ai-dlc/han-team-platform/01-core-backend
---

# unit-01-core-backend

## Description

Build the foundational multi-tenant backend infrastructure for the team platform. This includes the database schema, API framework, and organization hierarchy management.

## Success Criteria

### Data Abstraction (Critical - enables single codebase)
- [ ] DataSource interface abstracting over SQLite and PostgreSQL
- [ ] LocalDataSource implementation (wraps existing han-native/SQLite)
- [ ] HostedDataSource implementation (PostgreSQL via ORM)
- [ ] Existing GraphQL resolvers refactored to use DataSource interface
- [ ] Local `han browse` continues working with no regressions

### Multi-tenant Schema (PostgreSQL)
- [ ] PostgreSQL schema with multi-tenant isolation (organization_id on all tables)
- [ ] Organization CRUD operations (create, read, update, delete)
- [ ] Team management within organizations
- [ ] Project management within teams
- [ ] Repository linking to projects
- [ ] User membership and role assignments
- [ ] Database migrations infrastructure

## Technical Notes

### Database Schema Core Tables
- `organizations` - Top-level tenant
- `teams` - Groups within org
- `projects` - Work areas within team
- `repositories` - Git repos linked to projects
- `memberships` - User ↔ Org/Team/Project relationships
- `roles` - Permission definitions

### API Design
- Extend existing Pothos GraphQL patterns
- Add `viewer` query for authenticated user context
- Add organization/team/project queries with permission checks
- Mutations for management operations

### Resolver Abstraction Layer (Critical)
The same GraphQL schema must work with both backends:
- **Local mode**: SQLite via existing han-native bindings
- **Hosted mode**: PostgreSQL via Drizzle/Prisma

Create a data access abstraction:
```typescript
interface DataSource {
  getSessions(filters): Promise<Session[]>
  getMessages(sessionId): Promise<Message[]>
  // ... all existing queries
}

class LocalDataSource implements DataSource { /* SQLite */ }
class HostedDataSource implements DataSource { /* PostgreSQL */ }
```

Resolvers use `context.dataSource` which is injected based on mode.

### Multi-tenancy Pattern
- Row-level security via organization_id
- All queries scoped to user's accessible organizations
- Prepared for PostgreSQL RLS policies
