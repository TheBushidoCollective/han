---
status: completed
depends_on:
  - unit-03-session-sync
  - unit-06-stripe-integration
branch: ai-dlc/mvp-api/07-retention-job
discipline: backend
---

# unit-07-retention-job

## Description

Implement background job that enforces session retention limits based on user tier. FREE users have 30-day retention, PRO users have 365-day retention.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `RetentionService` class manages retention logic
- [ ] `cleanupExpiredSessions()` deletes sessions beyond retention period
- [ ] FREE tier: sessions older than 30 days are soft-deleted
- [ ] PRO tier: sessions older than 365 days are soft-deleted
- [ ] Cleanup runs on configurable schedule (default: daily at 3am UTC)
- [ ] Batch processing to avoid memory issues (100 sessions per batch)
- [ ] Audit log records `session.expired` events
- [ ] Encrypted content properly cleaned up (DEK references)
- [ ] Job status visible in `/metrics` endpoint
- [ ] Manual trigger via `POST /api/v1/admin/retention/run` (admin only)
- [ ] Dry-run mode for testing: `?dry_run=true`
- [ ] Unit tests with various retention scenarios

## Notes

**Retention logic:**
```typescript
async function getRetentionDays(userId: string): Promise<number> {
  const tier = await getUserTier(userId);
  return tier === 'pro' ? 365 : 30;
}

async function cleanupExpiredSessions(): Promise<CleanupResult> {
  const users = await getAllUsersWithSessions();
  let deleted = 0;

  for (const user of users) {
    const retentionDays = await getRetentionDays(user.id);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const expired = await softDeleteSessionsBefore(user.id, cutoff);
    deleted += expired;
  }

  return { deleted, timestamp: new Date() };
}
```

**Scheduling:**
Use Bun's built-in `setInterval` for MVP, or integrate with existing job system if available.

```typescript
// Run daily at 3am UTC
const RETENTION_CRON = '0 3 * * *';
```

**File structure:**
```
lib/
  jobs/
    retention-service.ts   # Retention logic
    scheduler.ts           # Job scheduling
  routes/
    admin.ts               # Admin endpoints
```

**Soft delete:**
Sessions are marked with `deleted_at` timestamp rather than hard deleted. This allows:
- Grace period for users to upgrade
- Audit trail
- Easy restoration if needed

**Hard delete (future):**
Implement separate job to permanently delete sessions 30 days after soft delete.
