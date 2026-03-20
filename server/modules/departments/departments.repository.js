/**
 * Departments Repository
 *
 * Database operations for departments.
 * Extracted from server/db/database.js for domain isolation.
 */

import { query } from '../../db/postgres.js'
import { v4 as uuidv4 } from 'uuid'

// ===============================================================
// DEPARTMENT FUNCTIONS
// ===============================================================

export async function getAllDepartments(hotelId = null) {
  if (hotelId) {
    const result = await query(
      'SELECT * FROM departments WHERE hotel_id = $1 AND is_active = TRUE ORDER BY name ASC',
      [hotelId]
    )
    return result.rows
  }
  const result = await query(
    'SELECT * FROM departments WHERE is_active = TRUE ORDER BY name ASC'
  )
  return result.rows
}

export async function getDepartmentById(id) {
  const result = await query('SELECT * FROM departments WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function createDepartment(dept) {
  const {
    hotel_id,
    name,
    description,
    name_en,
    name_kk,
    type,
    color,
    icon,
    email,
    telegram_chat_id,
  } = dept
  const id = uuidv4()

  await query(
    `
    INSERT INTO departments (id, hotel_id, name, description, name_en, name_kk, type, color, icon, email, telegram_chat_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `,
    [
      id,
      hotel_id,
      name,
      description || null,
      name_en,
      name_kk,
      type || null,
      color || '#FF8D6B',
      icon || 'package',
      email || null,
      telegram_chat_id || null,
    ]
  )

  return {
    id,
    hotel_id,
    name,
    description,
    name_en,
    name_kk,
    type,
    color,
    icon,
    email,
    telegram_chat_id,
  }
}

export async function updateDepartment(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`)
    values.push(
      updates.description === null || updates.description === ''
        ? null
        : updates.description
    )
  }
  if (updates.name_en !== undefined) {
    fields.push(`name_en = $${paramIndex++}`)
    values.push(updates.name_en)
  }
  if (updates.name_kk !== undefined) {
    fields.push(`name_kk = $${paramIndex++}`)
    values.push(updates.name_kk)
  }
  if (updates.type !== undefined) {
    fields.push(`type = $${paramIndex++}`)
    values.push(updates.type)
  }
  if (updates.color !== undefined) {
    fields.push(`color = $${paramIndex++}`)
    values.push(updates.color)
  }
  if (updates.icon !== undefined) {
    fields.push(`icon = $${paramIndex++}`)
    values.push(updates.icon)
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`)
    values.push(updates.is_active)
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`)
    values.push(
      updates.email === null || updates.email === ''
        ? null
        : String(updates.email).trim()
    )
  }
  if (updates.telegram_chat_id !== undefined) {
    fields.push(`telegram_chat_id = $${paramIndex++}`)
    values.push(
      updates.telegram_chat_id === null || updates.telegram_chat_id === ''
        ? null
        : String(updates.telegram_chat_id).trim()
    )
  }

  if (fields.length === 0) return false

  values.push(id)
  const result = await query(
    `UPDATE departments SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  )
  return result.rowCount > 0
}

export async function deleteDepartment(id) {
  const result = await query('DELETE FROM departments WHERE id = $1', [id])
  return result.rowCount > 0
}
