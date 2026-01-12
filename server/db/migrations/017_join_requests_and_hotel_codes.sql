-- Migration: Add join requests system for hotel registration
-- Users can register with hotel code and wait for admin approval

-- Add unique code to hotels for registration
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS code VARCHAR(8) UNIQUE;

-- Generate random codes for existing hotels
UPDATE hotels 
SET code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
WHERE code IS NULL;

-- Make code NOT NULL after setting defaults
ALTER TABLE hotels ALTER COLUMN code SET NOT NULL;

-- Add status to users (pending = waiting for hotel assignment)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create join_requests table
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id),
  notes TEXT,
  UNIQUE(user_id, hotel_id)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_join_requests_hotel_status ON join_requests(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);

-- Add permissions for managing join requests
INSERT INTO permissions (id, resource, action, scope, description)
VALUES 
  (gen_random_uuid(), 'join_requests', 'read', 'hotel', 'View join requests for hotel'),
  (gen_random_uuid(), 'join_requests', 'update', 'hotel', 'Approve/reject join requests'),
  (gen_random_uuid(), 'join_requests', 'read', 'all', 'View all join requests'),
  (gen_random_uuid(), 'join_requests', 'update', 'all', 'Manage all join requests')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Assign permissions to roles via role_permissions
INSERT INTO role_permissions (id, role, permission_id)
SELECT gen_random_uuid(), 'HOTEL_ADMIN', id FROM permissions WHERE resource = 'join_requests' AND scope = 'hotel'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO role_permissions (id, role, permission_id)
SELECT gen_random_uuid(), 'SUPER_ADMIN', id FROM permissions WHERE resource = 'join_requests'
ON CONFLICT (role, permission_id) DO NOTHING;

COMMENT ON TABLE join_requests IS 'Requests from new users to join a hotel';
COMMENT ON COLUMN hotels.code IS 'Unique registration code for hotel';
COMMENT ON COLUMN users.status IS 'User status: active, pending, suspended';
