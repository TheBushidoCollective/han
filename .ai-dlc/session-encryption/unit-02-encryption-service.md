---
status: completed
depends_on:
  - unit-01-schema-crypto
branch: ai-dlc/session-encryption/02-encryption-service
discipline: backend
---

# unit-02-encryption-service

## Description

Implement the core encryption service with key derivation, envelope encryption, and encrypt/decrypt operations for session content.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `EncryptionService` class with `encrypt(plaintext, keyId)` and `decrypt(ciphertext, nonce, keyId)` methods
- [ ] Key derivation using Argon2id with configurable parameters (memory: 64MB, iterations: 3, parallelism: 1)
- [ ] AES-256-GCM encryption with random 96-bit nonces
- [ ] Envelope encryption: DEK encrypted by KEK, DEK encrypts content
- [ ] `deriveKeyFromSecret(secret, salt)` returns KEK
- [ ] `generateDataKey()` returns new random DEK
- [ ] `wrapKey(dek, kek)` and `unwrapKey(wrappedDek, kek)` for key wrapping
- [ ] Constant-time comparison for HMAC/hash verification
- [ ] Unit tests with test vectors for AES-256-GCM
- [ ] Memory-safe: keys zeroed after use

## Notes

**Dependencies:**
- `@noble/ciphers` for AES-256-GCM (audited, no native deps)
- `@noble/hashes` for Argon2id (audited, no native deps)

**Key derivation parameters (OWASP recommended):**
```typescript
const ARGON2_PARAMS = {
  memory: 65536,    // 64 MB
  iterations: 3,
  parallelism: 1,
  hashLength: 32,   // 256 bits for AES-256
};
```

**Envelope encryption flow:**
```
1. Generate random DEK (32 bytes)
2. Derive KEK from team/user secret + salt
3. Wrap DEK with KEK (AES-256-GCM)
4. Store wrapped DEK in database
5. Use DEK to encrypt session content
6. Store encrypted content + nonce
```

**File structure:**
```
lib/
  crypto/
    encryption-service.ts   # Main service
    key-derivation.ts       # Argon2id KDF
    aes-gcm.ts             # AES-256-GCM wrapper
    index.ts               # Public exports
```
