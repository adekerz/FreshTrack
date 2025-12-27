-- ============================================
-- Migration 015: Add missing FK indexes
-- FreshTrack performance optimization
-- ============================================

-- Batches indexes
CREATE INDEX IF NOT EXISTS idx_batches_added_by ON batches(added_by);
CREATE INDEX IF NOT EXISTS idx_batches_collected_by ON batches(collected_by);

-- Write-offs indexes
CREATE INDEX IF NOT EXISTS idx_write_offs_written_off_by ON write_offs(written_off_by);
CREATE INDEX IF NOT EXISTS idx_write_offs_product ON write_offs(product_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_batch ON notifications(batch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_by ON notifications(read_by);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- Collection history indexes
CREATE INDEX IF NOT EXISTS idx_collection_history_batch ON collection_history(batch_id);
CREATE INDEX IF NOT EXISTS idx_collection_history_product ON collection_history(product_id);
CREATE INDEX IF NOT EXISTS idx_collection_history_user ON collection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_history_department ON collection_history(department_id);

-- Audit logs indexes (for faster queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_batches_hotel_status_expiry ON batches(hotel_id, status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_products_hotel_department ON products(hotel_id, department_id);
