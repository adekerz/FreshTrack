/**
 * Report Queries
 * Optimized SQL queries for analytics reports (production-scale).
 * Uses CTEs instead of correlated subqueries and LATERAL joins.
 * Requires migration 076 indexes for best performance.
 */

/**
 * Query 6.1: Daily Inventory Health Summary
 * Params: $1 = hotel_id, $2 = department_id (optional, nullable)
 */
export const HEALTH_SUMMARY_QUERY = `
SELECT
  d.id AS department_id,
  d.name AS department,
  COUNT(b.id) AS total_batches,
  COUNT(b.id) FILTER (WHERE b.expiry_date > CURRENT_DATE + 7) AS good,
  COUNT(b.id) FILTER (WHERE b.expiry_date BETWEEN CURRENT_DATE+3 AND CURRENT_DATE+7) AS warning,
  COUNT(b.id) FILTER (WHERE b.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+2) AS critical,
  COUNT(b.id) FILTER (WHERE b.expiry_date < CURRENT_DATE) AS expired,
  ROUND(
    (COUNT(b.id) FILTER (WHERE b.expiry_date > CURRENT_DATE+7)*1.0
   + COUNT(b.id) FILTER (WHERE b.expiry_date BETWEEN CURRENT_DATE+3 AND CURRENT_DATE+7)*0.5
   + COUNT(b.id) FILTER (WHERE b.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+2)*0.2)
    / NULLIF(COUNT(b.id),0) * 100
  ) AS health_score
FROM departments d
LEFT JOIN batches b ON b.department_id = d.id AND b.status = 'active'
WHERE d.hotel_id = $1
  AND ($2::uuid IS NULL OR d.id = $2::uuid)
GROUP BY d.id, d.name
ORDER BY health_score ASC NULLS LAST
`

/**
 * Query 6.2: Expiry Forecast (next N days)
 * Params: $1 = hotel_id, $2 = days_ahead (int), $3 = department_id (optional nullable uuid)
 */
export const EXPIRY_FORECAST_QUERY = `
SELECT
  p.name AS product,
  d.name AS department,
  c.name AS category,
  b.expiry_date,
  (b.expiry_date - CURRENT_DATE) AS days_left,
  b.quantity,
  p.unit,
  b.batch_number,
  CASE
    WHEN b.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN b.expiry_date = CURRENT_DATE THEN 'today'
    WHEN b.expiry_date <= CURRENT_DATE + 3 THEN 'critical'
    WHEN b.expiry_date <= CURRENT_DATE + 7 THEN 'warning'
    ELSE 'good'
  END AS status
FROM batches b
JOIN products p ON b.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN departments d ON b.department_id = d.id
WHERE b.hotel_id = $1 AND b.status = 'active'
  AND b.expiry_date <= CURRENT_DATE + $2::int
  AND ($3::uuid IS NULL OR b.department_id = $3::uuid)
ORDER BY b.expiry_date ASC
`

/**
 * Query 6.3: Collection Activity Report
 * Params: $1 = hotel_id, $2 = date_from, $3 = date_to, $4 = department_id (nullable uuid)
 */
export const COLLECTION_ACTIVITY_QUERY = `
SELECT
  ch.collected_at,
  ch.product_name,
  ch.category_name,
  d.name AS department,
  u.name AS collected_by,
  ch.quantity_collected,
  ch.collection_reason,
  ch.batch_number,
  ch.expiry_date
FROM collection_history ch
LEFT JOIN departments d ON ch.department_id = d.id
LEFT JOIN users u ON ch.user_id = u.id
WHERE ch.hotel_id = $1
  AND ch.collected_at BETWEEN $2 AND $3
  AND ($4::uuid IS NULL OR ch.department_id = $4::uuid)
ORDER BY ch.collected_at DESC
`

/**
 * Query 6.7: Collection Reason Distribution
 * Params: $1 = hotel_id, $2 = date_from, $3 = date_to, $4 = department_id (nullable uuid)
 */
export const COLLECTION_REASONS_QUERY = `
SELECT
  ch.collection_reason AS reason,
  COUNT(*) AS transaction_count,
  SUM(ch.quantity_collected) AS total_quantity,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) AS percentage
FROM collection_history ch
WHERE ch.hotel_id = $1
  AND ch.collected_at BETWEEN $2 AND $3
  AND ($4::uuid IS NULL OR ch.department_id = $4::uuid)
GROUP BY ch.collection_reason
ORDER BY total_quantity DESC
`

/**
 * Query 6.10: Batch Age Distribution
 * Params: $1 = hotel_id, $2 = department_id (nullable uuid)
 */
export const BATCH_AGE_DISTRIBUTION_QUERY = `
SELECT
  CASE
    WHEN expiry_date < CURRENT_DATE THEN 'Expired'
    WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2 THEN '0-2 days'
    WHEN expiry_date BETWEEN CURRENT_DATE + 3 AND CURRENT_DATE + 7 THEN '3-7 days'
    WHEN expiry_date BETWEEN CURRENT_DATE + 8 AND CURRENT_DATE + 30 THEN '8-30 days'
    WHEN expiry_date BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 90 THEN '31-90 days'
    ELSE '90+ days'
  END AS age_range,
  COUNT(*) AS batch_count,
  SUM(quantity) AS total_quantity,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) AS percentage
FROM batches
WHERE hotel_id = $1 AND status = 'active'
  AND ($2::uuid IS NULL OR department_id = $2::uuid)
GROUP BY age_range
ORDER BY MIN(expiry_date - CURRENT_DATE)
`

/**
 * Query 6.8: Weekly Executive Summary
 * Params: $1 = hotel_id
 */
export const WEEKLY_SUMMARY_QUERY = `
WITH current_week AS (
  SELECT
    COUNT(*) AS total_batches,
    COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE+7) AS good,
    COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired,
    ROUND(
      (COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE+7)*1.0
     + COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE+3 AND CURRENT_DATE+7)*0.5
     + COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+2)*0.2)
      / NULLIF(COUNT(*),0) * 100
    ) AS health_score
  FROM batches WHERE hotel_id = $1 AND status = 'active'
),
prev_snapshot AS (
  SELECT health_score AS prev_health_score
  FROM analytics_snapshots
  WHERE hotel_id = $1 AND snapshot_date = CURRENT_DATE - 7
  LIMIT 1
),
week_collections AS (
  SELECT COUNT(*) AS collections, COALESCE(SUM(quantity_collected),0) AS collected_qty
  FROM collection_history
  WHERE hotel_id = $1 AND collected_at >= CURRENT_DATE - 7
)
SELECT
  cw.total_batches, cw.good, cw.expired, cw.health_score,
  ps.prev_health_score,
  cw.health_score - COALESCE(ps.prev_health_score, cw.health_score) AS health_delta,
  wc.collections, wc.collected_qty
FROM current_week cw
CROSS JOIN week_collections wc
LEFT JOIN prev_snapshot ps ON true
`

/**
 * Query 6.4: Product Turnover
 * Pre-aggregates collection_history in a CTE with date bounds to avoid full table scan.
 * Params: $1 = hotel_id, $2 = date_from, $3 = date_to
 */
export const PRODUCT_TURNOVER_QUERY = `
WITH collection_agg AS (
  SELECT product_id, SUM(quantity_collected) AS total_collected
  FROM collection_history
  WHERE hotel_id = $1
    AND collected_at >= $2 AND collected_at <= $3
  GROUP BY product_id
),
batch_stats AS (
  SELECT
    product_id,
    COUNT(*) AS total_batches,
    SUM(quantity) AS current_stock,
    COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE) AS expired_batches
  FROM batches
  WHERE hotel_id = $1 AND status = 'active'
  GROUP BY product_id
)
SELECT
  p.name AS product, c.name AS category,
  COALESCE(bs.total_batches, 0) AS total_batches,
  COALESCE(bs.current_stock, 0) AS current_stock,
  COALESCE(ca.total_collected, 0) AS total_collected,
  COALESCE(bs.expired_batches, 0) AS expired_batches,
  CASE WHEN COALESCE(ca.total_collected,0) + COALESCE(bs.expired_batches,0) > 0
    THEN ROUND(COALESCE(ca.total_collected,0)::numeric
      / (COALESCE(ca.total_collected,0) + COALESCE(bs.expired_batches,0)) * 100, 1)
    ELSE NULL END AS consumption_rate_pct,
  CASE WHEN COALESCE(bs.current_stock,0) > 0
    THEN ROUND(COALESCE(ca.total_collected,0)::numeric / bs.current_stock, 2)
    ELSE NULL END AS turnover_ratio
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN batch_stats bs ON bs.product_id = p.id
LEFT JOIN collection_agg ca ON ca.product_id = p.id
WHERE p.hotel_id = $1
ORDER BY turnover_ratio DESC NULLS LAST
`

/**
 * Query 6.5: Daily Active Users
 * Uses DISTINCT ON instead of correlated subquery for top_user — single pass.
 * Params: $1 = hotel_id, $2 = date_from
 */
export const DAILY_ACTIVE_USERS_QUERY = `
WITH daily_stats AS (
  SELECT
    DATE(created_at) AS day,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(*) AS total_actions
  FROM audit_logs
  WHERE hotel_id = $1 AND created_at >= $2
  GROUP BY DATE(created_at)
),
daily_top_user AS (
  SELECT DISTINCT ON (DATE(created_at))
    DATE(created_at) AS day,
    user_name AS top_user
  FROM audit_logs
  WHERE hotel_id = $1 AND created_at >= $2
  GROUP BY DATE(created_at), user_name
  ORDER BY DATE(created_at), COUNT(*) DESC
)
SELECT ds.day, ds.active_users, ds.total_actions, dtu.top_user
FROM daily_stats ds
LEFT JOIN daily_top_user dtu ON dtu.day = ds.day
ORDER BY ds.day DESC
`

/**
 * Query 6.6: Department Scorecard
 * Uses CTE instead of LEFT JOIN LATERAL for month collections.
 * Params: $1 = hotel_id
 */
export const DEPARTMENT_SCORECARD_QUERY = `
WITH dept_collections AS (
  SELECT department_id, SUM(quantity_collected) AS total_collected
  FROM collection_history
  WHERE hotel_id = $1
    AND collected_at >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY department_id
)
SELECT
  d.name AS department,
  COUNT(b.id) AS total_batches,
  COUNT(b.id) FILTER (WHERE b.expiry_date < CURRENT_DATE) AS expired_count,
  ROUND(
    COUNT(b.id) FILTER (WHERE b.expiry_date < CURRENT_DATE)::numeric
    / NULLIF(COUNT(b.id),0) * 100, 1
  ) AS expiry_rate_pct,
  ROUND(AVG(b.expiry_date - CURRENT_DATE)::numeric, 1) AS avg_days_to_expiry,
  COALESCE(dc.total_collected, 0) AS collections_this_month,
  ROUND(
    (COUNT(*) FILTER (WHERE b.expiry_date > CURRENT_DATE+7)*1.0
   + COUNT(*) FILTER (WHERE b.expiry_date BETWEEN CURRENT_DATE+3 AND CURRENT_DATE+7)*0.5
   + COUNT(*) FILTER (WHERE b.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE+2)*0.2)
    / NULLIF(COUNT(*),0) * 100
  ) AS health_score
FROM departments d
LEFT JOIN batches b ON b.department_id = d.id AND b.status = 'active'
LEFT JOIN dept_collections dc ON dc.department_id = d.id
WHERE d.hotel_id = $1
GROUP BY d.id, d.name, dc.total_collected
ORDER BY health_score ASC
`
