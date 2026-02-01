-- Migration 004: Key Rotation Enhancements
-- Adds support for multi-key rotation with transition periods

-- Add transition period support to encryption_keys
ALTER TABLE encryption_keys ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE encryption_keys ADD COLUMN IF NOT EXISTS is_emergency_rotated BOOLEAN DEFAULT false;

-- Comment on new columns
COMMENT ON COLUMN encryption_keys.valid_until IS 'Keys remain valid for decryption until this timestamp (for graceful transition)';
COMMENT ON COLUMN encryption_keys.is_emergency_rotated IS 'True if this key was replaced due to emergency rotation (old key immediately invalid)';

-- Function to get all valid keys for an owner (for decryption attempts)
-- Returns keys ordered by version DESC (newest first)
CREATE OR REPLACE FUNCTION get_valid_keys(p_owner_type VARCHAR, p_owner_id UUID)
RETURNS TABLE (
    key_id UUID,
    version INT,
    wrapped_dek BYTEA,
    kek_salt BYTEA,
    algorithm VARCHAR,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ek.id,
        ek.version,
        ek.wrapped_dek,
        ek.kek_salt,
        ek.algorithm,
        ek.active
    FROM encryption_keys ek
    WHERE ek.owner_type = p_owner_type
      AND ek.owner_id = p_owner_id
      AND (
          ek.active = true
          OR (ek.valid_until IS NOT NULL AND ek.valid_until > NOW())
      )
      AND ek.is_emergency_rotated = false
    ORDER BY ek.version DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to perform atomic key rotation
CREATE OR REPLACE FUNCTION rotate_key(
    p_owner_type VARCHAR,
    p_owner_id UUID,
    p_new_wrapped_dek BYTEA,
    p_new_kek_salt BYTEA,
    p_performed_by UUID,
    p_reason TEXT DEFAULT NULL,
    p_is_emergency BOOLEAN DEFAULT false,
    p_transition_hours INT DEFAULT 24
)
RETURNS TABLE (
    old_key_id UUID,
    old_version INT,
    new_key_id UUID,
    new_version INT
) AS $$
DECLARE
    v_old_key_id UUID;
    v_old_version INT;
    v_new_key_id UUID;
    v_new_version INT;
BEGIN
    -- Get current active key
    SELECT id, version INTO v_old_key_id, v_old_version
    FROM encryption_keys
    WHERE owner_type = p_owner_type
      AND owner_id = p_owner_id
      AND active = true
    FOR UPDATE;

    -- Calculate new version
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM encryption_keys
    WHERE owner_type = p_owner_type AND owner_id = p_owner_id;

    -- Deactivate old key
    IF v_old_key_id IS NOT NULL THEN
        UPDATE encryption_keys
        SET
            active = false,
            rotated_at = NOW(),
            valid_until = CASE
                WHEN p_is_emergency THEN NOW() -- Immediate invalidation
                ELSE NOW() + (p_transition_hours || ' hours')::INTERVAL
            END,
            is_emergency_rotated = p_is_emergency
        WHERE id = v_old_key_id;
    END IF;

    -- Create new active key
    INSERT INTO encryption_keys (
        owner_type,
        owner_id,
        version,
        wrapped_dek,
        kek_salt,
        active
    ) VALUES (
        p_owner_type,
        p_owner_id,
        v_new_version,
        p_new_wrapped_dek,
        p_new_kek_salt,
        true
    )
    RETURNING id INTO v_new_key_id;

    -- Log the rotation
    INSERT INTO key_audit_log (
        key_id,
        owner_type,
        owner_id,
        action,
        performed_by,
        old_key_version,
        new_key_version,
        reason
    ) VALUES (
        v_new_key_id,
        p_owner_type,
        p_owner_id,
        CASE WHEN p_is_emergency THEN 'emergency_rotate' ELSE 'rotate' END,
        p_performed_by,
        v_old_version,
        v_new_version,
        p_reason
    );

    -- Update rotation schedule
    UPDATE key_rotation_schedules
    SET
        last_rotation_at = NOW(),
        next_rotation_at = NOW() + (rotation_interval_days || ' days')::INTERVAL
    WHERE owner_type = p_owner_type AND owner_id = p_owner_id;

    RETURN QUERY SELECT v_old_key_id, v_old_version, v_new_key_id, v_new_version;
END;
$$ LANGUAGE plpgsql;

-- Function to check and get keys due for rotation
CREATE OR REPLACE FUNCTION get_keys_due_for_rotation()
RETURNS TABLE (
    owner_type VARCHAR,
    owner_id UUID,
    current_key_id UUID,
    current_version INT,
    last_rotation_at TIMESTAMP WITH TIME ZONE,
    overdue_days INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        krs.owner_type,
        krs.owner_id,
        ek.id as current_key_id,
        ek.version as current_version,
        krs.last_rotation_at,
        EXTRACT(DAY FROM NOW() - krs.next_rotation_at)::INT as overdue_days
    FROM key_rotation_schedules krs
    JOIN encryption_keys ek ON ek.owner_type = krs.owner_type
                            AND ek.owner_id = krs.owner_id
                            AND ek.active = true
    WHERE krs.enabled = true
      AND krs.next_rotation_at <= NOW()
    ORDER BY krs.next_rotation_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Index for cleanup of expired transition keys
CREATE INDEX IF NOT EXISTS idx_encryption_keys_valid_until
    ON encryption_keys(valid_until)
    WHERE valid_until IS NOT NULL AND active = false;
