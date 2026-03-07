-- Rollback analytics_snapshots migration
DROP INDEX IF EXISTS idx_snapshots_hotel_date;
DROP TABLE IF EXISTS analytics_snapshots;
