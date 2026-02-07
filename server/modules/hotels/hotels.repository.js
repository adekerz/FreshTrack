/**
 * Hotels Repository
 *
 * Database operations for hotels.
 * Extracted from server/db/database.js for domain isolation.
 */

import { query } from '../../db/postgres.js'
import { v4 as uuidv4 } from 'uuid'

// ===============================================================
// HELPERS
// ===============================================================

/** При сохранении отеля: Казахстан -> Asia/Qostanay (UTC+6). Asia/Almaty в IANA с 2024 = UTC+5. */
function normalizeTimezoneForDb(tz) {
  if (tz == null || typeof tz !== 'string') return tz
  const s = String(tz).trim()
  if (!s) return tz
  if (s === 'Asia/Qostanay') return s
  if (s === 'Asia/Almaty' || s === 'Asia/Aqtobe') return 'Asia/Qostanay'
  if (/almat|алмат|астан|astana|qostanay/i.test(s)) return 'Asia/Qostanay'
  return s
}

// ===============================================================
// HOTEL FUNCTIONS
// ===============================================================

export async function getAllHotels() {
  const result = await query('SELECT * FROM hotels WHERE is_active = TRUE ORDER BY name ASC')
  return result.rows
}

export async function getHotelById(id) {
  const result = await query('SELECT * FROM hotels WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function getHotelByCode(code) {
  const upperCode = code.toUpperCase()

  // Ищем по MARSHA коду
  const result = await query(
    'SELECT * FROM hotels WHERE marsha_code = $1 AND is_active = TRUE',
    [upperCode]
  )
  return result.rows[0] || null
}

export async function createHotel(hotel) {
  const {
    name,
    address,
    city,
    country,
    timezone,
    marsha_code,
    marsha_code_id,
    latitude,
    longitude,
    timezone_auto_detected
  } = hotel
  const id = uuidv4()

  await query(`
    INSERT INTO hotels (id, name, address, city, country, timezone, marsha_code, marsha_code_id, latitude, longitude, timezone_auto_detected)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    id,
    name,
    address,
    city ?? null,
    country || 'Kazakhstan',
    normalizeTimezoneForDb(timezone) || 'Asia/Qostanay',
    marsha_code || null,
    marsha_code_id || null,
    latitude ?? null,
    longitude ?? null,
    timezone_auto_detected === true
  ])

  return {
    id,
    name,
    address,
    city,
    country,
    timezone,
    marsha_code,
    marsha_code_id,
    latitude,
    longitude,
    timezone_auto_detected
  }
}

export async function updateHotel(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1

  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.address !== undefined) { fields.push(`address = $${paramIndex++}`); values.push(updates.address) }
  if (updates.city !== undefined) { fields.push(`city = $${paramIndex++}`); values.push(updates.city) }
  if (updates.country !== undefined) { fields.push(`country = $${paramIndex++}`); values.push(updates.country) }
  if (updates.timezone !== undefined) { fields.push(`timezone = $${paramIndex++}`); values.push(normalizeTimezoneForDb(updates.timezone)) }
  if (updates.latitude !== undefined) { fields.push(`latitude = $${paramIndex++}`); values.push(updates.latitude) }
  if (updates.longitude !== undefined) { fields.push(`longitude = $${paramIndex++}`); values.push(updates.longitude) }
  if (updates.timezone_auto_detected !== undefined) { fields.push(`timezone_auto_detected = $${paramIndex++}`); values.push(updates.timezone_auto_detected) }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active) }
  if (updates.marsha_code !== undefined) { fields.push(`marsha_code = $${paramIndex++}`); values.push(updates.marsha_code) }
  if (updates.marsha_code_id !== undefined) { fields.push(`marsha_code_id = $${paramIndex++}`); values.push(updates.marsha_code_id) }

  if (fields.length === 0) return false

  values.push(id)
  const result = await query(`UPDATE hotels SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export async function deleteHotel(id) {
  // Освобождаем MARSHA-код, чтобы его можно было снова выбрать при добавлении отеля
  await query(`
    UPDATE marsha_codes
    SET is_assigned = FALSE, assigned_to_hotel_id = NULL, assigned_at = NULL, assigned_by = NULL
    WHERE assigned_to_hotel_id = $1
  `, [id])
  const result = await query('DELETE FROM hotels WHERE id = $1', [id])
  return result.rowCount > 0
}
