-- Migration 008: Collection History for FIFO Picking
-- Phase 8: Automated FIFO collection with snapshots
-- Created: December 25, 2025

-- ═══════════════════════════════════════════════════════════════
-- COLLECTION HISTORY TABLE
-- Stores snapshot data for each collection transaction
-- Even if batch is deleted, history remains with full context
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS collection_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- References (batch_id can be NULL if batch was deleted)
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Transaction data
  quantity_collected INTEGER NOT NULL CHECK (quantity_collected > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  
  -- Snapshot fields (preserved even if source entities are deleted)
  expiry_date DATE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category_name VARCHAR(255),
  batch_number VARCHAR(100),
  
  -- Additional context
  collection_reason VARCHAR(100) DEFAULT 'consumption',
  notes TEXT,
  
  -- Timestamps
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Audit reference (links to audit_logs if needed)
  audit_log_id UUID
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_collection_history_hotel 
  ON collection_history(hotel_id);

CREATE INDEX IF NOT EXISTS idx_collection_history_department 
  ON collection_history(department_id);

CREATE INDEX IF NOT EXISTS idx_collection_history_product 
  ON collection_history(product_id);

CREATE INDEX IF NOT EXISTS idx_collection_history_batch 
  ON collection_history(batch_id);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_collection_history_collected_at 
  ON collection_history(collected_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_collection_history_hotel_dept 
  ON collection_history(hotel_id, department_id);

CREATE INDEX IF NOT EXISTS idx_collection_history_hotel_product 
  ON collection_history(hotel_id, product_id);

CREATE INDEX IF NOT EXISTS idx_collection_history_user 
  ON collection_history(user_id);

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════

COMMENT ON TABLE collection_history IS 'FIFO collection transactions with snapshots - Phase 8';
COMMENT ON COLUMN collection_history.quantity_collected IS 'Amount taken from this batch';
COMMENT ON COLUMN collection_history.quantity_remaining IS 'Batch quantity after collection';
COMMENT ON COLUMN collection_history.product_name IS 'Snapshot: Product name at collection time';
COMMENT ON COLUMN collection_history.category_name IS 'Snapshot: Category name at collection time';
COMMENT ON COLUMN collection_history.expiry_date IS 'Snapshot: Batch expiry date';
COMMENT ON COLUMN collection_history.collection_reason IS 'Reason: consumption, minibar, sale, other';

-- ═══════════════════════════════════════════════════════════════
-- VIEW FOR COLLECTION REPORTS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW collection_summary AS
SELECT 
  ch.hotel_id,
  ch.department_id,
  ch.product_id,
  ch.product_name,
  ch.category_name,
  DATE(ch.collected_at) as collection_date,
  COUNT(*) as transaction_count,
  SUM(ch.quantity_collected) as total_collected,
  AVG(ch.quantity_collected)::NUMERIC(10,2) as avg_per_transaction
FROM collection_history ch
GROUP BY 
  ch.hotel_id, 
  ch.department_id, 
  ch.product_id, 
  ch.product_name,
  ch.category_name,
  DATE(ch.collected_at);

COMMENT ON VIEW collection_summary IS 'Aggregated collection statistics per product per day';
