---
status: completed
depends_on:
  - unit-01-auth-middleware
branch: ai-dlc/mvp-api/03-session-sync
discipline: backend
---

# unit-03-session-sync

## Description

Implement the session sync endpoint that receives Claude Code session data from the CLI, processes it through secret detection, encrypts it, and stores it.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `syncSession` mutation accepts session data from authenticated CLI
- [ ] Input validated with GraphQL input types
- [ ] SecretDetector scans content and redacts detected secrets
- [ ] EncryptionService encrypts session content before storage
- [ ] Session stored in `synced_sessions` table with user/team association
- [ ] AuditService logs `session.sync` event
- [ ] Returns `SyncSessionPayload { session: Session!, secretsRedacted: Int! }`
- [ ] `sessions` query returns user's sessions (Relay connection)
- [ ] `session(id: ID!)` query returns decrypted session (if authorized)
- [ ] Users can only access own sessions or team sessions they belong to
- [ ] Proper error handling for encryption/decryption failures
- [ ] Unit tests with mocked encryption service

## Notes

**GraphQL Schema:**
```graphql
input SyncSessionInput {
  sessionId: String!        # Claude Code session ID
  projectPath: String!      # Git repo path
  summary: String           # Session summary
  messages: [MessageInput!]!
  metadata: JSON
}

type SyncSessionPayload {
  session: Session!
  secretsRedacted: Int!
}

type Mutation {
  syncSession(input: SyncSessionInput!): SyncSessionPayload!
}

type Query {
  """User's synced sessions (Relay connection)"""
  sessions(first: Int, after: String): SessionConnection!

  """Get single session by ID"""
  session(id: ID!): Session
}
```

**Processing pipeline:**
```
1. Validate GraphQL input
2. Determine owner (user or team based on project)
3. Get/create encryption key for owner
4. Run SecretDetector.scan() on content
5. Redact detected secrets
6. Encrypt with EncryptionService
7. Store in synced_sessions
8. Log to audit
9. Return payload
```

**File structure:**
```
lib/
  graphql/
    types/
      session.ts           # Session type (aligned with coordinator)
      sync-session.ts      # Mutation + payload types
    resolvers/
      session-resolvers.ts # Query/mutation resolvers
```

**Uses existing services:**
- `EncryptionService` from session-encryption units
- `SecretDetector` from session-encryption units
- `AuditService` from session-encryption units
