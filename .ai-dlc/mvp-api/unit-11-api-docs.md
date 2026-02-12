---
status: completed
depends_on: []
branch: ai-dlc/mvp-api/11-api-docs
discipline: backend
---

# unit-11-api-docs

## Description

Enable GraphQL introspection and serve interactive GraphQL Playground for API exploration. Schema is self-documenting via SDL.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] GraphQL introspection enabled in development/staging
- [ ] GraphQL Playground served at `/graphql` (GET requests)
- [ ] All types have descriptions in SDL
- [ ] All fields have descriptions
- [ ] All arguments have descriptions
- [ ] Deprecation notices on deprecated fields
- [ ] Authentication documented in schema descriptions
- [ ] Error types documented in schema
- [ ] Introspection disabled in production (security)
- [ ] Schema printable via `han schema export` or build script

## Notes

**GraphQL Yoga / Hono setup:**
```typescript
import { createYoga } from 'graphql-yoga';

const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
});

app.use('/graphql', yoga);
```

**Schema documentation example:**
```graphql
"""
A user account on the Han platform.
"""
type User {
  """Unique identifier"""
  id: ID!

  """GitHub username"""
  githubUsername: String!

  """Email address from GitHub"""
  email: String!

  """Current subscription tier (FREE or PRO)"""
  tier: UserTier!

  """Teams this user belongs to"""
  teams: [TeamMembership!]!
}
```

**Playground vs Production:**
- Development: Playground enabled at `/graphql`
- Production: Only POST requests accepted, no introspection

This unit is simpler than REST since GraphQL handles documentation natively.

**Schema alignment with coordinator:**
The team server GraphQL schema should align with the local coordinator schema (`packages/han/lib/graphql/types/`):
- Reuse type patterns: Session, Message interface, ContentBlock union, ToolUseBlock, etc.
- Same Relay connection/edge patterns for pagination
- Team-specific types extend the base: User, Team, TeamMembership, Billing
- Shared SDL can be extracted to a common package if needed later
