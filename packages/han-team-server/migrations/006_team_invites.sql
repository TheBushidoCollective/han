-- Team invites table for invite code functionality
-- Invite codes are valid for 24 hours and can be used once

CREATE TABLE team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(8) NOT NULL UNIQUE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for fast code lookup
CREATE INDEX idx_team_invites_code ON team_invites(code);

-- Index for listing invites by team
CREATE INDEX idx_team_invites_team_id ON team_invites(team_id);

-- Index for cleanup of expired invites
CREATE INDEX idx_team_invites_expires_at ON team_invites(expires_at);

-- Add description field to teams table if not exists
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;

-- Add deleted_at for soft delete on teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add tier field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free';

COMMENT ON TABLE team_invites IS 'Invite codes for joining teams, valid for 24 hours';
COMMENT ON COLUMN team_invites.code IS '8-character alphanumeric invite code';
COMMENT ON COLUMN team_invites.expires_at IS 'When the invite expires (24 hours from creation)';
COMMENT ON COLUMN team_invites.used_at IS 'When the invite was used (null if not used)';
COMMENT ON COLUMN team_invites.used_by IS 'User who used the invite';
