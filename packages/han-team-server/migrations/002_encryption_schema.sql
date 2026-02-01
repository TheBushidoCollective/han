-- Encryption schema for Han Team Platform
-- Implements zero-knowledge encryption for session content
--
-- KEY HIERARCHY:
-- ┌─────────────────────────────────────────────────────────────────┐
-- │  Master Secret (per team/user, never stored in database)       │
-- │      │                                                          │
-- │      ▼ Argon2id KDF (with stored salt)                         │
-- │  Key Encryption Key (KEK) - derived, never stored              │
-- │      │                                                          │
-- │      ▼ AES-256-GCM wrap                                        │
-- │  Data Encryption Key (DEK) - stored wrapped in encryption_keys │
-- │      │                                                          │
-- │      ▼ AES-256-GCM encrypt                                     │
-- │  Session Content (stored in synced_sessions.encrypted_content) │
-- └─────────────────────────────────────────────────────────────────┘
--
-- SECURITY PROPERTIES:
-- - Server never has access to plaintext content
-- - Master secret is only known to the client
-- - key_secrets stores hash for verification, not derivation
-- - DEK rotation possible without re-encrypting all content immediately

-- ============================================================================
-- UP MIGRATION
-- ============================================================================

-- Enable pgcrypto for cryptographic functions
-- Used for: gen_random_bytes() for nonce/key generation, digest() for hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Key Secrets Table
-- ============================================================================
-- Stores the Argon2id hash of the master secret for verification purposes.
-- This allows the server to verify that a client knows the correct secret
-- without ever storing the secret itself.
--
-- The salt is used during KDF to derive the KEK on the client side.
-- The hash is used to verify the client provided the correct secret.
--
-- SECURITY CONSTRAINTS:
-- - salt: Minimum 16 bytes (128 bits) per NIST SP 800-132 recommendations
-- - secret_hash: Exactly 32 bytes (256 bits) for Argon2id output
-- - argon2_time_cost: Minimum 2 iterations per OWASP guidelines
-- - argon2_memory_cost: Minimum 19456 KiB (~19 MiB) per OWASP minimum
-- - argon2_parallelism: Minimum 1 thread
CREATE TABLE key_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner can be a team or individual user
    owner_type VARCHAR(10) NOT NULL CHECK (owner_type IN ('team', 'user')),
    owner_id UUID NOT NULL,

    -- Argon2id hash of the master secret (for verification only)
    -- Client computes: Argon2id(secret, salt) and sends hash
    -- Server verifies hash matches, then client uses derived KEK locally
    -- SECURITY: Exactly 32 bytes (256-bit hash output)
    secret_hash BYTEA NOT NULL CHECK (length(secret_hash) = 32),

    -- Salt used in Argon2id derivation (shared with client for KEK derivation)
    -- Generated server-side with gen_random_bytes(16)
    -- SECURITY: Minimum 16 bytes (128 bits) per NIST SP 800-132
    salt BYTEA NOT NULL CHECK (length(salt) >= 16),

    -- Argon2id parameters (stored for future-proofing if we need to upgrade)
    -- SECURITY: Minimum values enforced per OWASP password storage guidelines
    argon2_time_cost INTEGER NOT NULL DEFAULT 3 CHECK (argon2_time_cost >= 2),
    argon2_memory_cost INTEGER NOT NULL DEFAULT 65536 CHECK (argon2_memory_cost >= 19456),  -- 64 MiB default, 19 MiB minimum
    argon2_parallelism INTEGER NOT NULL DEFAULT 4 CHECK (argon2_parallelism >= 1),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Each owner can only have one active secret configuration
    UNIQUE(owner_type, owner_id)
);

-- Index for looking up secrets by owner
CREATE INDEX idx_key_secrets_owner ON key_secrets(owner_type, owner_id);

-- Add foreign key constraints via triggers since owner_id can reference either teams or users
-- (PostgreSQL doesn't support polymorphic foreign keys directly)
CREATE OR REPLACE FUNCTION validate_key_secrets_owner()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_type = 'team' THEN
        IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.owner_id) THEN
            RAISE EXCEPTION 'Invalid team owner_id: %', NEW.owner_id;
        END IF;
    ELSIF NEW.owner_type = 'user' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.owner_id) THEN
            RAISE EXCEPTION 'Invalid user owner_id: %', NEW.owner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER key_secrets_owner_check
    BEFORE INSERT OR UPDATE ON key_secrets
    FOR EACH ROW
    EXECUTE FUNCTION validate_key_secrets_owner();

-- ============================================================================
-- Encryption Keys Table
-- ============================================================================
-- Stores the wrapped (encrypted) Data Encryption Key (DEK) for each team/user.
-- The DEK is wrapped using the KEK derived from the master secret.
--
-- Key rotation:
-- 1. Generate new DEK
-- 2. Wrap with current KEK
-- 3. Update this record
-- 4. New sessions use new DEK, old sessions retain their key_id reference
--
-- SECURITY CONSTRAINTS:
-- - wrapped_key: Exactly 48 bytes (32-byte AES-256 key + 16-byte GCM auth tag)
-- - key_nonce: Exactly 12 bytes per NIST SP 800-38D for AES-GCM
-- - algorithm: Restricted to known-good AEAD algorithms only
-- - version: Must be positive (monotonically increasing)
CREATE TABLE encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner can be a team or individual user (matches key_secrets)
    owner_type VARCHAR(10) NOT NULL CHECK (owner_type IN ('team', 'user')),
    owner_id UUID NOT NULL,

    -- The DEK encrypted with the KEK (derived from master secret)
    -- Client: DEK = decrypt(wrapped_key, KEK, key_nonce)
    -- SECURITY: Exactly 48 bytes (32-byte key + 16-byte GCM tag)
    wrapped_key BYTEA NOT NULL CHECK (length(wrapped_key) = 48),

    -- Nonce/IV used when wrapping the DEK (12 bytes for AES-GCM)
    -- SECURITY: Exactly 12 bytes per NIST SP 800-38D
    key_nonce BYTEA NOT NULL CHECK (length(key_nonce) = 12),

    -- Encryption algorithm used (for future algorithm upgrades)
    -- SECURITY: Restricted to known-good AEAD algorithms only
    algorithm VARCHAR(20) NOT NULL DEFAULT 'aes-256-gcm'
        CHECK (algorithm IN ('aes-256-gcm', 'chacha20-poly1305')),

    -- Key version for rotation tracking
    -- SECURITY: Must be positive, monotonically increasing
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),

    -- Is this the current active key for the owner?
    -- Only one key per owner should be active at a time
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- When this key was rotated (replaced by a newer key)
    rotated_at TIMESTAMP WITH TIME ZONE,

    -- Reference to the key_secrets entry used for this key
    key_secret_id UUID NOT NULL REFERENCES key_secrets(id) ON DELETE RESTRICT
);

-- Index for looking up active key by owner
CREATE INDEX idx_encryption_keys_owner_active ON encryption_keys(owner_type, owner_id) WHERE is_active = true;

-- Index for key lookups by ID (for session content decryption)
CREATE INDEX idx_encryption_keys_id ON encryption_keys(id);

-- Ensure only one active key per owner
CREATE UNIQUE INDEX idx_encryption_keys_unique_active
    ON encryption_keys(owner_type, owner_id)
    WHERE is_active = true;

-- Validate owner references
CREATE OR REPLACE FUNCTION validate_encryption_keys_owner()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_type = 'team' THEN
        IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.owner_id) THEN
            RAISE EXCEPTION 'Invalid team owner_id: %', NEW.owner_id;
        END IF;
    ELSIF NEW.owner_type = 'user' THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.owner_id) THEN
            RAISE EXCEPTION 'Invalid user owner_id: %', NEW.owner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER encryption_keys_owner_check
    BEFORE INSERT OR UPDATE ON encryption_keys
    FOR EACH ROW
    EXECUTE FUNCTION validate_encryption_keys_owner();

-- ============================================================================
-- Update synced_sessions for encrypted content
-- ============================================================================
-- Add columns to store encrypted session content alongside metadata.
-- The encrypted_content replaces any plaintext storage.

-- Encrypted session content (JSONL data encrypted with DEK)
ALTER TABLE synced_sessions
    ADD COLUMN encrypted_content BYTEA;

-- Nonce/IV used for encrypting this session's content (12 bytes for AES-GCM)
-- SECURITY: Exactly 12 bytes per NIST SP 800-38D, or NULL if not encrypted
ALTER TABLE synced_sessions
    ADD COLUMN content_nonce BYTEA CHECK (content_nonce IS NULL OR length(content_nonce) = 12);

-- Reference to the encryption key used (for decryption)
ALTER TABLE synced_sessions
    ADD COLUMN key_id UUID REFERENCES encryption_keys(id) ON DELETE RESTRICT;

-- Index for key_id lookups (finding all sessions using a specific key)
CREATE INDEX idx_synced_sessions_key_id ON synced_sessions(key_id);

-- Add comments explaining the encryption model
COMMENT ON TABLE key_secrets IS
    'Stores Argon2id hash of master secrets for verification. The actual secret is never stored.';

COMMENT ON COLUMN key_secrets.secret_hash IS
    'Argon2id hash used to verify client knows the correct master secret.';

COMMENT ON COLUMN key_secrets.salt IS
    'Random salt used in Argon2id KDF. Shared with client for KEK derivation.';

COMMENT ON TABLE encryption_keys IS
    'Stores wrapped (encrypted) Data Encryption Keys. DEKs are wrapped with KEKs derived from master secrets.';

COMMENT ON COLUMN encryption_keys.wrapped_key IS
    'DEK encrypted with KEK using AES-256-GCM. Client decrypts locally with derived KEK.';

COMMENT ON COLUMN encryption_keys.is_active IS
    'Only one key per owner should be active. Inactive keys retained for decrypting old content.';

COMMENT ON COLUMN synced_sessions.encrypted_content IS
    'Session content (JSONL) encrypted with AES-256-GCM using the referenced DEK.';

COMMENT ON COLUMN synced_sessions.content_nonce IS
    '12-byte nonce/IV used for AES-GCM encryption of this session content.';

COMMENT ON COLUMN synced_sessions.key_id IS
    'Reference to encryption_keys.id for the DEK used to encrypt this session.';

-- Add updated_at trigger for key_secrets
CREATE TRIGGER key_secrets_updated_at
    BEFORE UPDATE ON key_secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- KNOWN LIMITATIONS (Documented for Future Units)
-- ============================================================================
-- The following security enhancements are deferred to separate units:
--
-- 1. ROW-LEVEL SECURITY (RLS)
--    - Restricts data access based on current user context
--    - Requires application coordination (SET LOCAL role, etc.)
--    - Planned for: unit-03 or dedicated RLS unit
--
-- 2. TOCTOU RACE IN OWNER VALIDATION TRIGGERS
--    - The validate_*_owner() triggers have a theoretical race condition
--    - Between the EXISTS check and the INSERT, the referenced row could be deleted
--    - Low probability in practice due to FK constraints on dependent tables
--    - Mitigation: Application-level serialization or SERIALIZABLE isolation
--
-- 3. AUDIT TRAIL
--    - Changes to encryption keys and secrets should be logged
--    - Planned for: unit-04 (audit logging)
--
-- These limitations do not compromise the zero-knowledge encryption model,
-- which is the primary security goal of this schema.

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
-- To rollback: psql -d database -f 002_encryption_schema_down.sql
-- Or run the statements between BEGIN/END manually
--
-- SECURITY WARNING: This migration will DROP encrypted content.
-- The pre-check below prevents accidental data loss.

-- DROP statements in reverse order of creation:
/*
-- SECURITY: Pre-check to prevent data loss
-- This will fail the migration if any encrypted sessions exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM synced_sessions WHERE encrypted_content IS NOT NULL LIMIT 1) THEN
        RAISE EXCEPTION 'ROLLBACK BLOCKED: % encrypted sessions exist. '
            'Decrypt all sessions before rolling back encryption schema, or use: '
            'DELETE FROM synced_sessions WHERE encrypted_content IS NOT NULL',
            (SELECT COUNT(*) FROM synced_sessions WHERE encrypted_content IS NOT NULL);
    END IF;

    IF EXISTS (SELECT 1 FROM encryption_keys LIMIT 1) THEN
        RAISE EXCEPTION 'ROLLBACK BLOCKED: encryption_keys table is not empty. '
            'Ensure all encrypted content is decrypted and keys are properly archived.';
    END IF;
END $$;

-- Remove triggers
DROP TRIGGER IF EXISTS key_secrets_updated_at ON key_secrets;
DROP TRIGGER IF EXISTS encryption_keys_owner_check ON encryption_keys;
DROP TRIGGER IF EXISTS key_secrets_owner_check ON key_secrets;

-- Remove functions
DROP FUNCTION IF EXISTS validate_encryption_keys_owner();
DROP FUNCTION IF EXISTS validate_key_secrets_owner();

-- Remove columns from synced_sessions
ALTER TABLE synced_sessions DROP COLUMN IF EXISTS key_id;
ALTER TABLE synced_sessions DROP COLUMN IF EXISTS content_nonce;
ALTER TABLE synced_sessions DROP COLUMN IF EXISTS encrypted_content;

-- Remove encryption tables
DROP TABLE IF EXISTS encryption_keys;
DROP TABLE IF EXISTS key_secrets;

-- Note: We intentionally do NOT drop pgcrypto extension
-- as it may be used by other parts of the application
*/
