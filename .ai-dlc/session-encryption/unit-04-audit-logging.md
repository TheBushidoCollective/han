---
status: completed
depends_on:
  - unit-01-schema-crypto
branch: ai-dlc/session-encryption/04-audit-logging
discipline: backend
---

# unit-04-audit-logging

## Description

Implement tamper-evident audit logging for all session data access, with append-only storage and integrity verification.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `audit_logs` table with append-only constraint (no UPDATE/DELETE via trigger)
- [ ] Each log entry includes: user_id, team_id, action, resource_type, resource_id, ip_address, user_agent, timestamp
- [ ] Hash chain integrity: each entry includes hash of previous entry
- [ ] `AuditService.log(event)` writes audit entry with hash chain
- [ ] `AuditService.verify(startId, endId)` validates hash chain integrity
- [ ] Logged actions: `session.view`, `session.export`, `session.decrypt`, `key.rotate`, `key.access`
- [ ] Audit logs stored in separate schema or table for isolation
- [ ] Retention policy support (archive old logs, don't delete)
- [ ] Query API for compliance reporting
- [ ] Unit tests verify tamper detection

## Notes

**Schema:**
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_hash BYTEA NOT NULL,        -- SHA-256 of this entry
  prev_hash BYTEA NOT NULL,         -- Hash of previous entry (chain)
  user_id UUID NOT NULL,
  team_id UUID,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent modifications
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Index for common queries
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_team ON audit_logs(team_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
```

**Hash chain calculation:**
```typescript
function calculateEventHash(entry: AuditEntry, prevHash: Buffer): Buffer {
  const payload = JSON.stringify({
    prev_hash: prevHash.toString('hex'),
    user_id: entry.userId,
    team_id: entry.teamId,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    timestamp: entry.timestamp.toISOString(),
  });
  return crypto.createHash('sha256').update(payload).digest();
}
```

**Verification:**
```typescript
async function verifyChain(startId: number, endId: number): Promise<{
  valid: boolean;
  brokenAt?: number;
}> {
  const entries = await getEntriesInRange(startId, endId);
  for (let i = 1; i < entries.length; i++) {
    const expectedHash = calculateEventHash(entries[i], entries[i-1].eventHash);
    if (!entries[i].eventHash.equals(expectedHash)) {
      return { valid: false, brokenAt: entries[i].id };
    }
  }
  return { valid: true };
}
```
