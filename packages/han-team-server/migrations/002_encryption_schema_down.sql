-- Down migration for 002_encryption_schema.sql
-- Removes encryption support from the database
--
-- WARNING: This will delete all encryption keys and make encrypted content
-- permanently unrecoverable. Only run this if you have backed up or decrypted
-- all session content.

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================

-- ============================================================================
-- SAFETY CHECK: Prevent accidental data loss
-- ============================================================================
-- This block will ABORT the rollback if any encrypted data exists.
-- You must decrypt all session content before running this migration.

DO $$
BEGIN
    -- Check for encrypted sessions
    IF EXISTS (SELECT 1 FROM synced_sessions WHERE encrypted_content IS NOT NULL LIMIT 1) THEN
        RAISE EXCEPTION 'ROLLBACK BLOCKED: Encrypted sessions exist. '
            'You must decrypt all session content before rolling back the encryption schema. '
            'Running this migration would make encrypted content permanently unrecoverable.';
    END IF;

    -- Check for encryption keys (even if no encrypted sessions, keys represent setup work)
    IF EXISTS (SELECT 1 FROM encryption_keys LIMIT 1) THEN
        RAISE EXCEPTION 'ROLLBACK BLOCKED: encryption_keys table is not empty. '
            'Please remove all encryption keys after verifying no encrypted content exists. '
            'This is a safety measure to prevent accidental key loss.';
    END IF;

    -- Check for key secrets
    IF EXISTS (SELECT 1 FROM key_secrets LIMIT 1) THEN
        RAISE EXCEPTION 'ROLLBACK BLOCKED: key_secrets table is not empty. '
            'Please remove all key secrets after verifying no encryption keys exist.';
    END IF;

    RAISE NOTICE 'Safety check passed: No encrypted content or keys found. Proceeding with rollback.';
END $$;

-- Remove comments (optional, but clean)
COMMENT ON COLUMN synced_sessions.key_id IS NULL;
COMMENT ON COLUMN synced_sessions.content_nonce IS NULL;
COMMENT ON COLUMN synced_sessions.encrypted_content IS NULL;
COMMENT ON TABLE encryption_keys IS NULL;
COMMENT ON TABLE key_secrets IS NULL;

-- Remove triggers
DROP TRIGGER IF EXISTS key_secrets_updated_at ON key_secrets;
DROP TRIGGER IF EXISTS encryption_keys_owner_check ON encryption_keys;
DROP TRIGGER IF EXISTS key_secrets_owner_check ON key_secrets;

-- Remove validation functions
DROP FUNCTION IF EXISTS validate_encryption_keys_owner();
DROP FUNCTION IF EXISTS validate_key_secrets_owner();

-- Remove indexes on synced_sessions
DROP INDEX IF EXISTS idx_synced_sessions_key_id;

-- Remove columns from synced_sessions (must remove FK constraint first via column drop)
ALTER TABLE synced_sessions DROP COLUMN IF EXISTS key_id;
ALTER TABLE synced_sessions DROP COLUMN IF EXISTS content_nonce;
ALTER TABLE synced_sessions DROP COLUMN IF EXISTS encrypted_content;

-- Remove indexes on encryption_keys
DROP INDEX IF EXISTS idx_encryption_keys_unique_active;
DROP INDEX IF EXISTS idx_encryption_keys_id;
DROP INDEX IF EXISTS idx_encryption_keys_owner_active;

-- Remove indexes on key_secrets
DROP INDEX IF EXISTS idx_key_secrets_owner;

-- Drop encryption tables (order matters due to FK)
DROP TABLE IF EXISTS encryption_keys;
DROP TABLE IF EXISTS key_secrets;

-- Note: We intentionally do NOT drop pgcrypto extension as:
-- 1. It may be used by other parts of the application
-- 2. It's a system extension that doesn't hurt to keep
-- 3. Other migrations may depend on it
-- If you really want to remove it: DROP EXTENSION IF EXISTS pgcrypto;
