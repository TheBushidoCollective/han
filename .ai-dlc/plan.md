# Implementation Plan for Unit 02: Authentication

## Overview

The authentication unit must implement multi-provider OAuth (GitHub, GitLab), magic link email authentication, JWT-based API auth, and session management. This builds on top of the data abstraction layer from unit-01 (HostedDataSource interface).

## Architecture Design

### 1. Database Schema (PostgreSQL - Hosted Mode)

**New Tables Required:**

```sql
-- OAuth connections (supports multiple providers per user)
CREATE TABLE oauth_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'github', 'gitlab'
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_username TEXT,
    access_token_encrypted BYTEA NOT NULL,
    refresh_token_encrypted BYTEA,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[], -- e.g., ['read:user', 'read:org', 'repo']
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider, provider_user_id)
);

-- API sessions (JWT tracking for revocation)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL, -- SHA-256 of JWT for revocation lookup
    device_info JSONB,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Magic link tokens
CREATE TABLE magic_link_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Rate limiting
CREATE TABLE auth_rate_limits (
    key TEXT PRIMARY KEY, -- e.g., 'email:user@example.com', 'ip:1.2.3.4'
    attempts INTEGER DEFAULT 0,
    blocked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. Library Selection

- **jose** - JWT creation/verification
- **oauth4webapi** - Modern OAuth 2.0 client with PKCE support
- Encryption: Node.js crypto (AES-256-GCM for token encryption at rest)

### 3. File Structure

```
packages/han/lib/
├── auth/
│   ├── index.ts                 # Export public auth API
│   ├── types.ts                 # AuthUser, AuthSession, etc.
│   ├── jwt.ts                   # JWT creation/verification
│   ├── encryption.ts            # Token encryption at rest
│   ├── oauth/
│   │   ├── index.ts             # OAuth flow orchestration
│   │   ├── github.ts            # GitHub-specific OAuth
│   │   ├── gitlab.ts            # GitLab-specific OAuth
│   │   └── pkce.ts              # PKCE challenge generation
│   ├── magic-link.ts            # Email magic link flow
│   ├── session-manager.ts       # Session CRUD, refresh, revoke
│   ├── rate-limiter.ts          # Rate limiting logic
│   └── middleware.ts            # GraphQL auth middleware
```

### 4. GraphQL Schema Extensions

```graphql
# New types
type AuthUser {
  id: ID!
  email: String
  displayName: String
  avatarUrl: String
  oauthConnections: [OAuthConnection!]!
  createdAt: DateTime!
}

type OAuthConnection {
  id: ID!
  provider: OAuthProvider!
  providerUsername: String
  connectedAt: DateTime!
}

enum OAuthProvider {
  GITHUB
  GITLAB
}

type AuthSession {
  id: ID!
  user: AuthUser!
  expiresAt: DateTime!
  deviceInfo: String
}

# New queries
extend type Query {
  viewer: AuthUser
  currentSession: AuthSession
}

# New mutations
type Mutation {
  # OAuth flow
  initiateOAuth(provider: OAuthProvider!): OAuthInitiateResult!
  completeOAuth(provider: OAuthProvider!, code: String!, state: String!, codeVerifier: String!): AuthResult!

  # Magic link flow
  requestMagicLink(email: String!): MagicLinkResult!
  verifyMagicLink(token: String!): AuthResult!

  # Session management
  refreshSession: AuthResult!
  revokeSession(sessionId: ID!): Boolean!
  revokeAllSessions: Boolean!

  # Account linking
  linkOAuthProvider(provider: OAuthProvider!, code: String!, state: String!, codeVerifier: String!): LinkResult!
  unlinkOAuthProvider(connectionId: ID!): Boolean!
}
```

### 5. GraphQL Context Extension

Extend `GraphQLContext` in `builder.ts`:

```typescript
export interface GraphQLContext {
  request?: Request;
  loaders: GraphQLLoaders;
  auth?: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
}
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create auth types and interfaces
2. Implement JWT utilities (create, verify, decode)
3. Implement AES-256-GCM encryption for token storage
4. Add auth tables to PostgreSQL schema

### Phase 2: OAuth Implementation
1. GitHub OAuth with PKCE
   - Scopes: `read:user`, `read:org`, `repo`
   - Handle token exchange and refresh
2. GitLab OAuth with PKCE
3. Account creation/linking logic
4. Token encryption before storage

### Phase 3: Magic Link Email
1. Token generation (cryptographically secure, 15-min expiry)
2. Email sending integration (abstract over provider)
3. Token verification and session creation

### Phase 4: Session Management
1. JWT-based sessions with 1-hour expiry
2. Refresh token flow (7-day refresh tokens)
3. Session revocation (single and all)
4. Device tracking (optional)

### Phase 5: GraphQL Integration
1. Auth middleware that extracts JWT from headers
2. Populate `context.auth` for resolvers
3. Viewer query implementation
4. Protected mutations

### Phase 6: Rate Limiting
1. IP-based rate limiting
2. Email-based rate limiting for magic links
3. Exponential backoff on failures

## Security Considerations

**Token Security:**
- JWT secret from environment (32+ bytes, cryptographically random)
- Tokens encrypted at rest using AES-256-GCM with unique IV per token
- Encryption key from environment (separate from JWT secret)

**PKCE:**
- Always use code_challenge_method=S256
- Generate 43-128 character code_verifier
- Store code_verifier client-side during flow

**Cookie Settings:**
```typescript
{
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 3600  // 1 hour
}
```

**Rate Limiting Rules:**
- Magic link requests: 5 per email per hour
- OAuth initiates: 10 per IP per minute
- Failed logins: 5 attempts then 15-minute lockout

## Environment Variables

```bash
# JWT
AUTH_JWT_SECRET=<32+ byte secret>
AUTH_JWT_ISSUER=https://han.guru

# Token encryption
AUTH_ENCRYPTION_KEY=<32 byte key>

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# GitLab OAuth
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_INSTANCE_URL=https://gitlab.com

# Email (for magic links)
EMAIL_PROVIDER=resend
EMAIL_API_KEY=
EMAIL_FROM=noreply@han.guru
```

## Integration Points

**With Unit 01 (Core Backend):**
- HostedDataSource must implement auth-related queries
- User table links to organization memberships

**With Unit 03 (Data Sync):**
- Sync API authenticated via JWT
- API key alternative for automated sync

**With Unit 04 (Permissions):**
- OAuth tokens used to fetch repo permissions from GitHub/GitLab APIs
- Permission checks reference user from auth context
