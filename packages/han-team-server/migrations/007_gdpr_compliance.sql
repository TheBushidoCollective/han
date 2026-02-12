-- GDPR Compliance Migration
-- Adds support for data export (portability) and account deletion (right to be forgotten)

-- Add deletion status columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(20) DEFAULT 'none'
    CHECK (deletion_status IN ('none', 'pending', 'processing', 'deleted'));

-- Create index for finding users pending deletion
CREATE INDEX IF NOT EXISTS idx_users_deletion_status
    ON users(deletion_status) WHERE deletion_status != 'none';

-- Create data exports table
CREATE TABLE IF NOT EXISTS data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'expired')),
    format VARCHAR(20) NOT NULL DEFAULT 'zip'
        CHECK (format IN ('zip', 'json')),
    passphrase_hash VARCHAR(255), -- bcrypt hash of passphrase for encrypted exports
    file_path TEXT, -- Storage path for completed export
    file_size_bytes BIGINT,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT 3,
    error_message TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Downloads expire after 7 days
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX idx_data_exports_status ON data_exports(status);
CREATE INDEX idx_data_exports_expires_at ON data_exports(expires_at) WHERE status = 'completed';

-- Create account deletion requests table
CREATE TABLE IF NOT EXISTS deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
    confirmation_token_hash VARCHAR(255), -- Hash of confirmation token
    confirmation_token_expires_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    grace_period_ends_at TIMESTAMPTZ, -- 30 days from request
    scheduled_deletion_at TIMESTAMPTZ, -- When permanent deletion should occur
    cancelled_at TIMESTAMPTZ,
    cancelled_reason VARCHAR(255),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}', -- Track what was deleted
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_active_deletion_per_user UNIQUE (user_id, status)
);

CREATE INDEX idx_deletion_requests_user_id ON deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX idx_deletion_requests_scheduled ON deletion_requests(scheduled_deletion_at)
    WHERE status = 'confirmed';

-- Create rate limit tracking for GDPR operations
CREATE TABLE IF NOT EXISTS gdpr_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL, -- 'export', 'deletion'
    last_request_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_rate_limit_per_user_operation UNIQUE (user_id, operation_type)
);

-- Add updated_at trigger to new tables
CREATE TRIGGER data_exports_updated_at
    BEFORE UPDATE ON data_exports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER deletion_requests_updated_at
    BEFORE UPDATE ON deletion_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Add new audit event types comment (for documentation)
COMMENT ON TABLE data_exports IS 'GDPR data export requests (right to portability). Events: export.request, export.complete, export.download';
COMMENT ON TABLE deletion_requests IS 'GDPR account deletion requests (right to be forgotten). Events: account.deletion_request, account.deletion_confirm, account.deletion_cancel, account.deletion_complete';
