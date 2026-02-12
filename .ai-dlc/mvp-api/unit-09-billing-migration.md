---
status: completed
depends_on: []
branch: ai-dlc/mvp-api/09-billing-migration
discipline: backend
---

# unit-09-billing-migration

## Description

Create database migration to add Stripe billing fields to the users table and add soft delete support for sessions.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] Migration adds `stripe_customer_id` to users table
- [ ] Migration adds `subscription_id` to users table
- [ ] Migration adds `subscription_status` to users table (enum)
- [ ] Migration adds `current_period_end` to users table
- [ ] Migration adds `deleted_at` to synced_sessions table (soft delete)
- [ ] Migration adds `tier` computed/virtual column or function
- [ ] Down migration cleanly removes all added columns
- [ ] Migration runs successfully on empty database
- [ ] Migration runs successfully on database with existing data
- [ ] Index on `stripe_customer_id` for lookup performance
- [ ] Index on `deleted_at` for retention job queries

## Notes

**Migration file:** `migrations/006_billing_fields.sql`

```sql
-- Up migration
ALTER TABLE users
  ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE,
  ADD COLUMN subscription_id VARCHAR(255),
  ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'none',
  ADD COLUMN current_period_end TIMESTAMPTZ;

CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- Subscription status enum values:
-- 'none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'

ALTER TABLE synced_sessions
  ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_sessions_deleted_at ON synced_sessions(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Add check constraint for valid subscription statuses
ALTER TABLE users ADD CONSTRAINT chk_subscription_status
  CHECK (subscription_status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'));
```

**Down migration:** `migrations/006_billing_fields_down.sql`

```sql
ALTER TABLE users
  DROP COLUMN stripe_customer_id,
  DROP COLUMN subscription_id,
  DROP COLUMN subscription_status,
  DROP COLUMN current_period_end;

ALTER TABLE synced_sessions
  DROP COLUMN deleted_at;
```

**Testing:**
- Run migration on fresh database
- Run migration on database with existing users
- Verify constraints work correctly
- Test rollback
