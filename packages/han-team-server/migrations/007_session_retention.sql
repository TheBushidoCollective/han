-- Session Retention Schema
-- Adds soft delete support for session retention enforcement

-- Add deleted_at column for soft delete
ALTER TABLE synced_sessions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Index for efficient retention queries
-- This index helps find sessions that need cleanup based on user tier and age
CREATE INDEX IF NOT EXISTS idx_synced_sessions_deleted_at
    ON synced_sessions(deleted_at)
    WHERE deleted_at IS NULL;

-- Index for finding sessions by user and creation date (for retention checks)
CREATE INDEX IF NOT EXISTS idx_synced_sessions_user_created
    ON synced_sessions(user_id, created_at)
    WHERE deleted_at IS NULL;

-- Add retention events to audit event types (conceptually - actual types are in code)
COMMENT ON COLUMN synced_sessions.deleted_at IS
    'Soft delete timestamp for retention enforcement. NULL means active session.';

-- Add session.expired to audit event types (extending the existing types)
-- This is a documentation comment; actual type extension is in TypeScript
