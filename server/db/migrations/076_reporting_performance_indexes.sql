-- Migration 076: Indexes for reporting queries
-- Optimizes the new report endpoints at production scale

-- Product Turnover: collection_history by product + date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ch_hotel_product_date
  ON collection_history(hotel_id, product_id, collected_at);

-- Department Scorecard: collection_history by dept + month
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ch_hotel_dept_date
  ON collection_history(hotel_id, department_id, collected_at);

-- Collection Reason Distribution: reason + hotel + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ch_hotel_reason_date
  ON collection_history(hotel_id, collection_reason, collected_at);

-- Daily Active Users: audit_logs by hotel + date + user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_hotel_date_user
  ON audit_logs(hotel_id, created_at, user_id);

-- Batch Age Distribution: partial index for active batches
-- (016 already has idx_batches_active_expiry, but adding composite partial)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batches_active_hotel_expiry
  ON batches(hotel_id, expiry_date)
  WHERE status = 'active';
