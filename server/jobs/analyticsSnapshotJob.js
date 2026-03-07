/**
 * analyticsSnapshotJob — Ежедневный снапшот инвентаря для трендов
 *
 * Запускается через node-cron каждый день в 00:05 UTC.
 * Для каждого отеля INSERT ... ON CONFLICT DO UPDATE — идемпотентно.
 * Также делает первый прогон при старте, если сегодняшний снапшот отсутствует.
 */

import cron from 'node-cron'
import { query } from '../db/postgres.js'
import { logInfo, logError } from '../utils/logger.js'

// SQL — один INSERT на все отели (INSERT ... SELECT ... GROUP BY)
const SNAPSHOT_SQL = `
  INSERT INTO analytics_snapshots
    (hotel_id, snapshot_date, total_batches, good_count, warning_count, critical_count, expired_count, health_score)
  SELECT
    b.hotel_id,
    CURRENT_DATE,
    COUNT(*),
    COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + 7),
    COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE + 3 AND CURRENT_DATE + 7),
    COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE     AND CURRENT_DATE + 2),
    COUNT(*) FILTER (WHERE expiry_date < CURRENT_DATE),
    COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE expiry_date > CURRENT_DATE + 7)                          * 1.0
       + COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE + 3 AND CURRENT_DATE + 7) * 0.5
       + COUNT(*) FILTER (WHERE expiry_date BETWEEN CURRENT_DATE     AND CURRENT_DATE + 2) * 0.2)
        / NULLIF(COUNT(*), 0) * 100
      ), 0)
  FROM batches b
  WHERE b.status = 'active'
  GROUP BY b.hotel_id
  ON CONFLICT (hotel_id, snapshot_date) DO UPDATE SET
    total_batches  = EXCLUDED.total_batches,
    good_count     = EXCLUDED.good_count,
    warning_count  = EXCLUDED.warning_count,
    critical_count = EXCLUDED.critical_count,
    expired_count  = EXCLUDED.expired_count,
    health_score   = EXCLUDED.health_score
`

/**
 * Выполнить снапшот
 */
async function runSnapshot() {
  try {
    const result = await query(SNAPSHOT_SQL)
    logInfo(`[AnalyticsSnapshot] Снапшот создан, строк: ${result.rowCount}`)
    return result.rowCount
  } catch (err) {
    logError('[AnalyticsSnapshot] Ошибка при создании снапшота', err)
    throw err
  }
}

/**
 * Начальный прогон — если сегодняшний снапшот отсутствует, создать.
 * Вызывается при старте сервера.
 */
async function runInitialIfNeeded() {
  try {
    const check = await query(
      `SELECT COUNT(*) AS cnt FROM analytics_snapshots WHERE snapshot_date = CURRENT_DATE`
    )
    const existing = parseInt(check.rows[0]?.cnt) || 0
    if (existing === 0) {
      logInfo('[AnalyticsSnapshot] Сегодняшний снапшот отсутствует — создаю...')
      await runSnapshot()
    } else {
      logInfo(
        `[AnalyticsSnapshot] Сегодняшний снапшот уже есть (${existing} отелей)`
      )
    }
  } catch (err) {
    logError('[AnalyticsSnapshot] Ошибка при начальной проверке', err)
  }
}

/**
 * Запуск cron-задачи + первый прогон
 */
export function startAnalyticsSnapshotJob() {
  // Каждый день в 00:05 UTC
  cron.schedule(
    '5 0 * * *',
    async () => {
      logInfo('[AnalyticsSnapshot] Cron-задача запущена (00:05 UTC)')
      try {
        await runSnapshot()
      } catch (err) {
        logError('[AnalyticsSnapshot] Cron-задача завершилась с ошибкой', err)
      }
    },
    { timezone: 'UTC' }
  )

  logInfo(
    '[AnalyticsSnapshot] Cron-задача зарегистрирована: 00:05 UTC ежедневно'
  )

  // Первый прогон при старте
  runInitialIfNeeded()
}
