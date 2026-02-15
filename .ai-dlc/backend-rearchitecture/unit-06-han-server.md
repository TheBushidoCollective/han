---
status: pending
depends_on: ["unit-01-han-db", "unit-03-han-api"]
branch: ai-dlc/backend-rearchitecture/06-han-server
discipline: backend
ticket: ""
---

# unit-06: han-server (Teams binary on Railway with auth, encryption, billing)

## Description
Create the `han-server` Rust binary that replaces the TypeScript `han-team-server`. It reuses `han-api` with the `postgres` feature flag, adds authentication (GitHub OAuth + JWT), encryption (AES-GCM with KEK rotation), billing (Stripe webhooks), session sync from local coordinators, and PostgreSQL LISTEN/NOTIFY for real-time subscriptions.

## Discipline
backend - Rust binary using Axum (HTTP/WS), han-api (PostgreSQL), JWT/OAuth, Stripe webhooks, deployed on Railway.

## Domain Entities
- **User** - GitHub OAuth identity. Fields: id, github_id, username, avatar_url, email, created_at
- **Team** - Multi-tenant organization. Fields: id, slug, name, plan_tier, stripe_customer_id, created_at
- **TeamMember** - Membership with role. Fields: user_id, team_id, role (admin/member), joined_at
- **ApiKey** - API authentication. Fields: id, key_hash, user_id, team_id, expires_at, created_at
- **SyncedSession** - Remote session data. Fields: id, team_id, user_id, session_id, metadata (JSONB), synced_at
- **TeamInvite** - 24-hour invite codes. Fields: id, team_id, code, expires_at, used_by
- **EncryptedField** - KEK-wrapped DEK encryption for sensitive data

## Data Sources
- **Input**: `packages/han-team-server/lib/auth/` - JWT validation, GitHub OAuth flow, middleware
- **Input**: `packages/han-team-server/lib/crypto/` - AES-GCM encryption, KEK rotation, field-level encryption
- **Input**: `packages/han-team-server/lib/billing/` - Stripe webhook handlers, plan management
- **Input**: `packages/han-team-server/lib/db/` - Drizzle ORM PostgreSQL schema and queries
- **Input**: `packages/han-team-server/lib/graphql/` - Team-specific Pothos types
- **Input**: `packages/han-team-server/lib/sync/` - Session sync protocol
- **Runtime**: PostgreSQL on Railway (connection string via `DATABASE_URL` env var)
- **Runtime**: Stripe API (via `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- **Runtime**: GitHub OAuth (via `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)

## Technical Specification

### Crate Structure
```
crates/han-server/
  Cargo.toml
  src/
    main.rs                 # Binary entry point, CLI args, server startup
    server.rs               # Axum HTTP/WS server (GraphQL + auth endpoints)
    auth/
      mod.rs                # Auth module
      jwt.rs                # JWT token generation/validation (jsonwebtoken crate)
      oauth.rs              # GitHub OAuth flow (authorization_code grant)
      middleware.rs          # Axum middleware: extract JWT from Authorization header
      api_key.rs            # API key authentication (hash comparison)
    crypto/
      mod.rs                # Encryption module
      aes_gcm.rs            # AES-256-GCM encrypt/decrypt
      kek.rs                # Key Encryption Key management and rotation
      field.rs              # Field-level encryption helpers
    billing/
      mod.rs                # Billing module
      stripe.rs             # Stripe webhook handlers
      plans.rs              # Plan tier definitions and limits
      middleware.rs          # Plan enforcement middleware (rate limits, feature gates)
    sync/
      mod.rs                # Session sync module
      receiver.rs           # Accept sync payloads from local coordinators
      transformer.rs        # Transform local session data into team format
    subscriptions.rs        # PostgreSQL LISTEN/NOTIFY -> broadcast::Sender
    migrations.rs           # Team-specific PostgreSQL migrations
```

### Cargo.toml Dependencies
```toml
[dependencies]
han-db = { path = "../han-db", features = ["postgres"] }
han-api = { path = "../han-api", features = ["team"] }

axum = { workspace = true }
async-graphql = { workspace = true }
async-graphql-axum = { workspace = true }
tower-http = { workspace = true }
tokio = { workspace = true }

# Auth
jsonwebtoken = "9"
oauth2 = "4"
reqwest = { version = "0.12", features = ["json"] }

# Crypto
aes-gcm = "0.10"
rand = "0.8"
base64 = "0.22"

# Billing
stripe-rust = "0.34"

# Database
sea-orm = { workspace = true, features = ["sqlx-postgres"] }
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio"] }
```

### Auth Flow

**GitHub OAuth:**
1. `GET /auth/github` -> Redirect to GitHub authorization URL
2. `GET /auth/github/callback?code=xxx` -> Exchange code for access token, fetch user profile, upsert User entity, generate JWT
3. JWT payload: `{ sub: user_id, team_id: optional, iat, exp }`
4. JWT signed with `JWT_SECRET` env var (HS256)

**API Key Auth:**
1. `Authorization: Bearer han_key_xxxxx` header
2. SHA-256 hash the key, look up in `api_keys` table
3. Check expiration, resolve user_id and team_id

**Middleware:**
```rust
async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = extract_bearer_token(&req)?;
    let claims = if token.starts_with("han_key_") {
        verify_api_key(&state.db, &token).await?
    } else {
        verify_jwt(&state.jwt_secret, &token)?
    };
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
```

### Encryption (AES-256-GCM)

Field-level encryption for sensitive data:
- Master KEK stored in `KEK_SECRET` env var (base64-encoded 256-bit key)
- Per-field DEK generated randomly, wrapped with KEK
- Encrypted format: `version:nonce:wrapped_dek:ciphertext` (base64 components)
- KEK rotation: re-wrap all DEKs with new KEK without re-encrypting data

```rust
pub struct FieldEncryptor {
    kek: [u8; 32],
}

impl FieldEncryptor {
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<String>;
    pub fn decrypt(&self, ciphertext: &str) -> Result<Vec<u8>>;
    pub fn rotate_kek(&self, old_kek: &[u8; 32], new_kek: &[u8; 32], wrapped: &str) -> Result<String>;
}
```

### Billing (Stripe)

Webhook handlers for:
- `customer.subscription.created` -> Activate team plan
- `customer.subscription.updated` -> Change plan tier
- `customer.subscription.deleted` -> Downgrade to free
- `invoice.payment_failed` -> Mark team as payment_failed

Plan tiers:
- **Free**: 1 team member, 100 sessions/month, no encryption
- **Pro**: 10 team members, unlimited sessions, encryption, priority sync
- **Enterprise**: Unlimited members, SSO, audit logs, custom retention

### PostgreSQL LISTEN/NOTIFY -> Subscriptions

```rust
pub async fn setup_pg_subscriptions(
    pool: &PgPool,
    tx: broadcast::Sender<DbChangeEvent>,
) {
    // Create triggers on relevant tables
    sqlx::query("CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger AS $$
        BEGIN
            PERFORM pg_notify('db_changes', json_build_object(
                'table', TG_TABLE_NAME,
                'action', TG_OP,
                'id', COALESCE(NEW.id, OLD.id)
            )::text);
            RETURN NEW;
        END;
    $$ LANGUAGE plpgsql").execute(pool).await?;

    // Listen in background task
    let mut listener = PgListener::connect_with(&pool).await?;
    listener.listen("db_changes").await?;

    tokio::spawn(async move {
        while let Ok(notification) = listener.recv().await {
            let event: DbChangeEvent = serde_json::from_str(notification.payload())?;
            let _ = tx.send(event);
        }
    });
}
```

This feeds into the same `broadcast::Sender<DbChangeEvent>` that `han-api` subscriptions consume, making the subscription resolvers database-agnostic.

### Session Sync Protocol

Local coordinators push session data to the team server:

```
POST /api/sync/sessions
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "team_id": "...",
  "sessions": [
    {
      "session_id": "...",
      "metadata": { ... },
      "messages": [ ... ]
    }
  ]
}
```

The sync receiver:
1. Validates auth and team membership
2. Encrypts sensitive fields (message content) with team's DEK
3. Upserts SyncedSession records
4. Fires NOTIFY for real-time dashboard updates

### GraphQL Schema Extension

`han-api` with `team` feature flag adds:
- `Query.me` -> Current authenticated user
- `Query.team(slug: String!)` -> Team details
- `Query.teamMembers(teamId: ID!)` -> Team member list
- `Mutation.createTeam(name: String!)` -> Create team
- `Mutation.inviteToTeam(teamId: ID!, email: String!)` -> Generate invite
- `Mutation.acceptInvite(code: String!)` -> Accept invite
- `Mutation.rotateApiKey(teamId: ID!)` -> Rotate API key

### Deployment (Railway)

- Dockerfile: multi-stage Rust build (cargo-chef for caching)
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `KEK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- Health check: `GET /health`
- Railway service name: `han-server`

## Success Criteria
- [ ] `han-server` starts and serves GraphQL against PostgreSQL
- [ ] GitHub OAuth flow works end-to-end (login -> JWT -> authenticated requests)
- [ ] API key authentication works for programmatic access
- [ ] Team dashboard connects to `han-server` and renders shared sessions
- [ ] Stripe webhook correctly updates plan tier on subscription change
- [ ] Field-level encryption encrypts/decrypts message content correctly
- [ ] KEK rotation re-wraps DEKs without data loss
- [ ] PostgreSQL LISTEN/NOTIFY fires and subscriptions deliver to connected dashboards
- [ ] Session sync from local coordinator stores encrypted data correctly
- [ ] Same browse-client connects to both coordinator (local) and server (teams) without code changes
- [ ] 80% test coverage on auth, crypto, billing, and sync modules

## Boundaries
This unit does NOT handle:
- Database entity definitions (unit-01: han-db - but this unit uses them with `postgres` feature)
- GraphQL core types (unit-03: han-api - but this unit enables `team` feature and adds team types)
- Local coordinator (unit-04: han-coordinator)
- CLI changes (unit-05: cli-grpc)
- Deleting old han-team-server (unit-07: cleanup)

This unit PROVIDES: the complete teams binary that reuses han-api against PostgreSQL, with auth, encryption, billing, and session sync.

## Notes
- The existing `han-team-server` is TypeScript/Hono/Drizzle. Port the business logic (auth flows, Stripe handlers, encryption), not the framework code.
- The team-specific GraphQL types in `han-api/src/types/team/` are feature-gated behind `#[cfg(feature = "team")]`. They only compile for han-server.
- Railway auto-deploys from the main branch. Set up a separate Railway service for the Rust binary.
- The sync protocol should be designed for eventual consistency. Local coordinators push data on a schedule or on session end.
- Consider GDPR: the sync endpoint should support team-level data deletion requests.
