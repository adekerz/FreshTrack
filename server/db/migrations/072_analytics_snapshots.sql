-- ============================================================
-- FreshTrack Analytics — Historical Snapshots
-- Enables real trend data (replaces mock in TrendsTab)
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    total_batches   INT NOT NULL DEFAULT 0,
    good_count      INT NOT NULL DEFAULT 0,
    warning_count   INT NOT NULL DEFAULT 0,
    critical_count  INT NOT NULL DEFAULT 0,
    expired_count   INT NOT NULL DEFAULT 0,
    health_score    INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hotel_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_hotel_date ON analytics_snapshots(hotel_id, snapshot_date);

-- Daily cron job via pg_cron (run once to schedule):
-- SELECT cron.schedule('analytics-snapshot', '0 0 * * *', $$
-- INSERT INTO analytics_snapshots (hotel_id, snapshot_date, total_batches, good_count, warning_count, critical_count, expired_count, health_score)
-- SELECT
--   b.hotel_id,
--   CURRENT_DATE,
--   COUNT(*),
--   COUNT(*) FILTER (WHERE expiry_date > NOW() + INTERVAL '7 days'),
--   COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() + INTERVAL '3 days' AND NOW() + INTERVAL '7 days'),
--   COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'),
--   COUNT(*) FILTER (WHERE expiry_date < NOW()),
--   ROUND(
--     (COUNT(*) FILTER (WHERE expiry_date > NOW() + INTERVAL '7 days') * 1.0 +
--      COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() + INTERVAL '3 days' AND NOW() + INTERVAL '7 days') * 0.5 +
--      COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '3 days') * 0.2)
--     / NULLIF(COUNT(*), 0) * 100
--   )
-- FROM batches b
-- WHERE b.is_active = true
-- GROUP BY b.hotel_id
-- ON CONFLICT (hotel_id, snapshot_date) DO UPDATE
-- SET total_batches = EXCLUDED.total_batches,
--     good_count = EXCLUDED.good_count,
--     warning_count = EXCLUDED.warning_count,
--     critical_count = EXCLUDED.critical_count,
--     expired_count = EXCLUDED.expired_count,
--     health_score = EXCLUDED.health_score;
-- $$);
