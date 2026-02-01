---
status: completed
depends_on:
  - unit-02-encryption-service
  - unit-03-secret-detection
  - unit-04-audit-logging
branch: ai-dlc/session-encryption/05-api-integration
discipline: backend
---

# unit-05-api-integration

## Description

Integrate encryption, secret detection, and audit logging into existing API endpoints. Update session sync, retrieval, and export flows.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] Session sync endpoint: detects secrets → redacts → encrypts → stores
- [ ] Session retrieval endpoint: decrypts → returns plaintext (to authorized user)
- [ ] Session list endpoint: returns metadata only (no decryption needed)
- [ ] New `/api/sessions/:id/export` endpoint returns encrypted export file
- [ ] All data access logged to audit system
- [ ] Middleware validates user has access to decryption key for requested resource
- [ ] Error responses don't leak encryption/key information
- [ ] Config schema updated with `MASTER_ENCRYPTION_KEY` for initial bootstrap
- [ ] Graceful handling when encryption key not yet provisioned

## Notes

**Session sync flow:**
```
1. Receive session data from CLI
2. Run SecretDetector.scan()
3. If secrets found:
   - Log warning with types (not values)
   - Redact content
4. Get/create encryption key for team/user
5. Encrypt content with DEK
6. Store encrypted_content, nonce, key_id
7. Log audit event: session.sync
```

**Session retrieval flow:**
```
1. Verify user membership in team (or owns user key)
2. Fetch session with encrypted_content
3. Get user's access to encryption key
4. Unwrap DEK, decrypt content
5. Log audit event: session.view
6. Return decrypted content
```

**Export flow:**
```
1. Verify ownership
2. Collect all user's sessions
3. Decrypt each session
4. Package as JSON
5. Re-encrypt with user's personal export key (derived from passphrase)
6. Log audit event: session.export
7. Return encrypted archive
```

**API changes:**
```typescript
// POST /api/sessions/sync
// Request body now processed through encryption pipeline

// GET /api/sessions/:id
// Response includes decrypted content (transparent to client)

// POST /api/sessions/export
// Request: { passphrase: string, sessionIds?: string[] }
// Response: encrypted archive blob

// POST /api/teams/:id/rotate-key
// Rotates team encryption key (re-wraps DEK, no re-encryption)
```

**Middleware:**
```typescript
// Verify decryption access before any session read
async function requireDecryptionAccess(req, res, next) {
  const session = await getSession(req.params.id);
  const canDecrypt = await canUserDecrypt(req.user.id, session.keyId);
  if (!canDecrypt) {
    return res.status(403).json({ error: 'No access to encryption key' });
  }
  next();
}
```
