---
status: completed
depends_on: []
branch: ai-dlc/session-encryption/01-schema-crypto
discipline: backend
---

# unit-01-schema-crypto

## Description

Add database schema support for encryption: enable pgcrypto, add key storage tables, and update synced_sessions to store encrypted content.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] Migration enables `pgcrypto` extension
- [ ] New `encryption_keys` table stores wrapped DEKs (data encryption keys)
- [ ] New `key_secrets` table stores team/user master secret hashes (for key derivation)
- [ ] `synced_sessions` columns updated: `encrypted_content BYTEA`, `content_nonce BYTEA`, `key_id UUID`
- [ ] Indexes added for key lookups
- [ ] Migration is reversible (down migration exists)
- [ ] Schema documented with comments explaining encryption model

## Notes

**Key hierarchy:**
```
Master Secret (per team/user)
  → Argon2id KDF
  → Key Encryption Key (KEK)
  → wraps Data Encryption Key (DEK)
  → DEK encrypts session content
```

This allows key rotation by re-wrapping DEKs with new KEK without re-encrypting all data.

**Tables to create:**

```sql
-- Stores the wrapped DEK for each team/user
CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY,
  owner_type VARCHAR(10) NOT NULL, -- 'team' or 'user'
  owner_id UUID NOT NULL,
  wrapped_key BYTEA NOT NULL,      -- DEK wrapped with KEK
  key_nonce BYTEA NOT NULL,        -- Nonce used for wrapping
  algorithm VARCHAR(20) DEFAULT 'aes-256-gcm',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  UNIQUE(owner_type, owner_id)
);

-- Stores master secret hash (for verification, not the secret itself)
CREATE TABLE key_secrets (
  id UUID PRIMARY KEY,
  owner_type VARCHAR(10) NOT NULL,
  owner_id UUID NOT NULL,
  secret_hash BYTEA NOT NULL,      -- Argon2id hash for verification
  salt BYTEA NOT NULL,             -- Salt used in derivation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_type, owner_id)
);
```

**pgcrypto functions needed:**
- `gen_random_bytes(n)` - Generate random nonces/keys
- `digest(data, 'sha256')` - For audit log integrity
