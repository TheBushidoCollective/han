-- Migration 005: Audit Log Immutability
-- Adds trigger to prevent UPDATE and DELETE operations on key_audit_log
-- for tamper-evident audit trail

-- Function to block modifications to audit log
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted. This is a security control.';
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent UPDATE operations
DROP TRIGGER IF EXISTS prevent_audit_log_update ON key_audit_log;
CREATE TRIGGER prevent_audit_log_update
    BEFORE UPDATE ON key_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Trigger to prevent DELETE operations
DROP TRIGGER IF EXISTS prevent_audit_log_delete ON key_audit_log;
CREATE TRIGGER prevent_audit_log_delete
    BEFORE DELETE ON key_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Add comment documenting the security control
COMMENT ON TABLE key_audit_log IS 'Immutable audit log for key operations. UPDATE and DELETE are blocked by database triggers for tamper-evident logging.';
