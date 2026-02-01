-- Encryption keys table for session data encryption
-- Supports key rotation with versioning

-- Create the encryption_keys table
CREATE TABLE encryption_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type VARCHAR(10) NOT NULL CHECK (owner_type IN ('team', 'user')),
    owner_id UUID NOT NULL,
    version INT NOT NULL DEFAULT 1,
    wrapped_dek BYTEA NOT NULL,  -- DEK wrapped with KEK
    kek_salt BYTEA NOT NULL,     -- Salt used to derive KEK from master secret
    algorithm VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',

    -- Composite unique constraint: one owner can have multiple keys but only one active
    CONSTRAINT fk_owner_team FOREIGN KEY (owner_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT unique_owner_version UNIQUE (owner_type, owner_id, version)
);

-- Index for fast lookups by owner
CREATE INDEX idx_encryption_keys_owner ON encryption_keys(owner_type, owner_id);

-- Partial index for active keys (fast lookup of current key)
CREATE UNIQUE INDEX idx_encryption_keys_active
    ON encryption_keys(owner_type, owner_id)
    WHERE active = true;

-- Index for finding expired keys
CREATE INDEX idx_encryption_keys_expires ON encryption_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Audit log for key operations
CREATE TABLE key_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id UUID REFERENCES encryption_keys(id) ON DELETE SET NULL,
    owner_type VARCHAR(10) NOT NULL,
    owner_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'create', 'rotate', 'deactivate', 'emergency_rotate'
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    old_key_version INT,
    new_key_version INT,
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_key_audit_log_owner ON key_audit_log(owner_type, owner_id);
CREATE INDEX idx_key_audit_log_key ON key_audit_log(key_id);
CREATE INDEX idx_key_audit_log_created ON key_audit_log(created_at);

-- Scheduled rotation configuration
CREATE TABLE key_rotation_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type VARCHAR(10) NOT NULL,
    owner_id UUID NOT NULL,
    rotation_interval_days INT NOT NULL DEFAULT 90,
    last_rotation_at TIMESTAMP WITH TIME ZONE,
    next_rotation_at TIMESTAMP WITH TIME ZONE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_rotation_schedule UNIQUE (owner_type, owner_id)
);

CREATE INDEX idx_key_rotation_next ON key_rotation_schedules(next_rotation_at) WHERE enabled = true;

-- Trigger to update rotation schedule timestamps
CREATE TRIGGER key_rotation_schedules_updated_at
    BEFORE UPDATE ON key_rotation_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE encryption_keys IS 'Stores wrapped Data Encryption Keys (DEKs) for session encryption. Supports key rotation with versioning.';
COMMENT ON COLUMN encryption_keys.wrapped_dek IS 'Data Encryption Key wrapped (encrypted) with the Key Encryption Key derived from master secret + salt';
COMMENT ON COLUMN encryption_keys.kek_salt IS 'Salt used with PBKDF2/Argon2 to derive the Key Encryption Key from the master secret';
COMMENT ON COLUMN encryption_keys.active IS 'Only one key per owner can be active at a time (enforced by partial unique index)';
COMMENT ON TABLE key_audit_log IS 'Audit trail for all key operations including rotations';
COMMENT ON TABLE key_rotation_schedules IS 'Configuration for automatic scheduled key rotation';
