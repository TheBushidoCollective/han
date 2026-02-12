---
status: completed
depends_on:
  - unit-01-auth-middleware
  - unit-06-stripe-integration
branch: ai-dlc/mvp-api/10-gdpr-compliance
discipline: backend
---

# unit-10-gdpr-compliance

## Description

Implement GDPR compliance features: data export (portability) and account deletion (right to be forgotten).

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `requestDataExport` mutation queues data export job
- [ ] Export includes all user data: profile, sessions, team memberships
- [ ] Sessions are decrypted for export
- [ ] Export delivered as encrypted ZIP (user provides passphrase)
- [ ] `dataExport(id: ID!)` query returns export status and download URL
- [ ] `requestAccountDeletion` mutation initiates account deletion
- [ ] Deletion requires re-authentication confirmation token
- [ ] 30-day grace period before permanent deletion
- [ ] `cancelAccountDeletion` mutation cancels within grace period
- [ ] Permanent deletion removes: user record, sessions, team memberships
- [ ] Stripe customer marked for deletion
- [ ] Audit log records export and deletion events
- [ ] Rate limit: 1 export per day, 1 deletion request per account

## Notes

**Export format:**
```
export-{userId}-{timestamp}.zip
├── profile.json         # User profile data
├── teams.json           # Team memberships
├── sessions/
│   ├── session-001.json # Decrypted session data
│   ├── session-002.json
│   └── ...
└── audit-log.json       # User's audit events
```

**Deletion states:**
```typescript
type DeletionStatus =
  | 'none'           // Normal account
  | 'pending'        // Deletion requested, in grace period
  | 'processing'     // Grace period ended, being deleted
  | 'deleted';       // Soft deleted, will be purged
```

**File structure:**
```
lib/
  gdpr/
    export-service.ts     # Data export logic
    deletion-service.ts   # Account deletion logic
  routes/
    user.ts               # Add export/delete endpoints
```

**Database changes:**
```sql
ALTER TABLE users ADD COLUMN deletion_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deletion_status VARCHAR(20) DEFAULT 'none';
```

**Stripe cleanup:**
When user deletes account, cancel any active subscriptions and optionally delete the Stripe customer (or just mark inactive for record keeping).
