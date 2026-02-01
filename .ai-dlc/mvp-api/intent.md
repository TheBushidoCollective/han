---
workflow: adversarial
created: 2026-01-31
status: active
---

# MVP API for Han Team Platform

## Problem

The han-team-server has infrastructure (database schema, health endpoints, encryption) but lacks the core API functionality needed for users to:
- Authenticate and manage their accounts
- Sync Claude Code sessions from the CLI
- Manage teams and collaborate
- Subscribe to paid plans for extended features

Without these, the platform cannot launch.

## Solution

Implement the complete MVP API layer:

1. **Authentication** - GitHub OAuth with browser-based CLI flow, JWT tokens
2. **Session Sync** - Endpoint for CLI to push session data (encrypted, secret-detected)
3. **Teams & Users** - CRUD operations for teams, members, and user profiles
4. **Stripe Billing** - Subscription management with FREE/PRO tiers
5. **Infrastructure** - Stripe resources managed via Terraform

## Success Criteria

### Authentication
- [ ] GitHub OAuth flow completes and creates user record in database
- [ ] JWT access tokens issued with 24h expiry
- [ ] Refresh tokens issued with 30d expiry
- [ ] Browser-based CLI auth flow returns token via localhost callback
- [ ] Invalid/expired tokens return 401 with standardized error response
- [ ] Auth middleware validates tokens on all protected routes

### Session Sync
- [ ] `syncSession` mutation accepts CLI session data with valid auth
- [ ] Sessions encrypted using existing EncryptionService before storage
- [ ] SecretDetector scans and redacts content before encryption
- [ ] Audit log records sync events via AuditService
- [ ] User can only access their own sessions (or team sessions if member)

### Teams & Users
- [ ] `createTeam` mutation creates team with creator as admin
- [ ] `createTeamInvite` mutation generates shareable invite code (admin only)
- [ ] `joinTeam` mutation allows joining via invite code
- [ ] Team admins can add/remove members and change roles
- [ ] Personal repos use user encryption key, team repos use team key
- [ ] `me` query returns user with team memberships

### Stripe Billing
- [ ] Stripe Customer created automatically on user signup
- [ ] FREE tier enforces 30-day session retention
- [ ] PRO tier provides 365-day retention
- [ ] Stripe webhook handles subscription lifecycle events (REST endpoint)
- [ ] `billingPortalUrl` query returns Stripe billing portal URL
- [ ] Terraform creates Stripe products (FREE, PRO) via stripe_product
- [ ] Terraform creates Stripe prices (monthly $10, yearly $100) via stripe_price
- [ ] Terraform registers webhook endpoint via stripe_webhook_endpoint

### Rate Limiting & CORS
- [ ] Rate limiting: 100 req/min default, 1000 req/min authenticated
- [ ] Billing endpoints: 10 req/min to prevent spam
- [ ] CORS allows localhost for CLI callback
- [ ] Rate limit headers included in responses

### Database Migration
- [ ] Migration adds Stripe billing fields to users table
- [ ] Migration adds soft delete (deleted_at) to sessions
- [ ] Migration runs on existing data without issues

### GDPR Compliance
- [ ] `requestDataExport` mutation exports all user data as encrypted ZIP
- [ ] `requestAccountDeletion` mutation initiates deletion with 30-day grace period
- [ ] Permanent deletion removes all user data from database
- [ ] Stripe customer handled on account deletion

### API Documentation (GraphQL)
- [ ] GraphQL introspection enabled in development/staging
- [ ] GraphQL Playground served at `/graphql` (GET requests)
- [ ] All types have descriptions in SDL
- [ ] All fields and arguments have descriptions
- [ ] Introspection disabled in production (security)

### CLI Integration
- [ ] `han auth login` completes browser OAuth flow
- [ ] `han sync` pushes session to server
- [ ] Credentials stored securely in ~/.config/han/

## Context

**Existing Infrastructure:**
- PostgreSQL schema with teams, users, api_keys, synced_sessions tables
- EncryptionService with AES-256-GCM and Argon2id KDF
- SecretDetector with pattern + entropy analysis
- AuditService with hash-chain tamper-evident logs
- Health endpoints (/health, /ready, /metrics)
- Terraform modules for Railway, Sentry, GCP DNS

**Tech Stack:**
- Hono web framework on Bun runtime
- PostgreSQL via pg driver
- Redis via ioredis
- Jose for JWT
- Stripe SDK for billing

**Domains:**
- Production: `app.han.guru` (team server GraphQL)
- Local: `app.local.han.guru` (coordinator GraphQL, localhost alias)

**Key Decisions:**
- GitHub-only OAuth for MVP (can add more providers later)
- Browser OAuth flow for CLI (opens browser, redirects to localhost)
- Subscription-only billing (no usage-based pricing)
- 30-day retention for FREE, 365-day for PRO
- **GraphQL schema alignment**: Team server schema should mirror coordinator schema patterns
  - Shared types: Session, Message, ContentBlock, ToolUseBlock, ToolResultBlock, etc.
  - Team-specific additions: User, Team, TeamMembership, Billing, Authentication
  - Same Relay connection patterns for pagination
  - Same message type hierarchy (interface + implementations)
