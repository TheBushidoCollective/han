---
status: completed
depends_on:
  - unit-02-encryption-service
  - unit-05-api-integration
branch: ai-dlc/session-encryption/06-key-rotation
discipline: backend
---

# unit-06-key-rotation

## Description

Implement key rotation mechanism that allows rotating team/user encryption keys without re-encrypting all session data.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `KeyRotationService.rotateKey(ownerId, ownerType)` generates new KEK and re-wraps DEK
- [ ] Old KEK can still unwrap DEK during transition period
- [ ] `encryption_keys` table supports key versioning (multiple active keys)
- [ ] Rotation is atomic (transaction-safe)
- [ ] Rotation logged to audit with before/after key IDs
- [ ] CLI command or API endpoint to trigger rotation
- [ ] Scheduled rotation support (e.g., every 90 days)
- [ ] Emergency rotation flag that invalidates old keys immediately
- [ ] Integration tests verify decryption works before and after rotation

## Notes

**Key versioning schema update:**
```sql
ALTER TABLE encryption_keys ADD COLUMN version INT DEFAULT 1;
ALTER TABLE encryption_keys ADD COLUMN active BOOLEAN DEFAULT true;
ALTER TABLE encryption_keys DROP CONSTRAINT encryption_keys_owner_type_owner_id_key;
CREATE UNIQUE INDEX idx_encryption_keys_active
  ON encryption_keys(owner_type, owner_id)
  WHERE active = true;
```

**Rotation flow:**
```
1. Derive new KEK from new secret (or same secret + new salt)
2. Fetch current DEK (unwrap with old KEK)
3. Wrap DEK with new KEK
4. In transaction:
   - Mark old key as inactive
   - Insert new key version
   - Update key_secrets with new salt (if secret changed)
5. Log audit event: key.rotate
```

**Backward compatibility:**
During rotation, both old and new KEK should work for a grace period:
```typescript
async function unwrapDEK(wrappedKey: Buffer, ownerId: string): Promise<Buffer> {
  const keys = await getActiveKeys(ownerId); // Returns [newest, ...older]
  for (const key of keys) {
    try {
      const kek = await deriveKEK(key.salt);
      return unwrap(wrappedKey, kek);
    } catch {
      continue; // Try older key
    }
  }
  throw new Error('No valid key found');
}
```

**API endpoint:**
```typescript
// POST /api/teams/:id/rotate-key
// Headers: Authorization: Bearer <token>
// Body: { emergency?: boolean }
// Response: { keyId: string, version: number }
```

**Scheduled rotation (optional future):**
```typescript
// Cron job or background worker
async function scheduledKeyRotation() {
  const teamsNeedingRotation = await getTeamsWithOldKeys(90); // 90 days
  for (const team of teamsNeedingRotation) {
    await KeyRotationService.rotateKey(team.id, 'team');
  }
}
```
