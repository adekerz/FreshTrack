/**
 * Auth Repository
 *
 * Database operations for users, authentication, and join requests.
 * Extracted from server/db/database.js for domain isolation.
 */

import { query } from '../../db/postgres.js'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

// ===============================================================
// USER FUNCTIONS
// ===============================================================

export async function getUserByLogin(login) {
  const result = await query('SELECT * FROM users WHERE login = $1', [login])
  return result.rows[0] || null
}

export async function getUserById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id])
  return result.rows[0] || null
}

export async function getUserByLoginOrEmail(identifier) {
  if (!identifier) return null
  const isEmail = identifier.includes('@')
  if (isEmail) {
    const result = await query('SELECT * FROM users WHERE email = $1', [identifier])
    return result.rows[0] || null
  }
  const result = await query('SELECT * FROM users WHERE login = $1', [identifier])
  return result.rows[0] || null
}

export async function getAllUsers(hotelId = null) {
  if (hotelId) {
    const result = await query(`
      SELECT id, login, name, email, role, hotel_id, department_id, telegram_chat_id, is_active, status, must_change_password, is_owner, created_at
      FROM users
      WHERE hotel_id = $1 OR hotel_id IS NULL
      ORDER BY created_at DESC
    `, [hotelId])
    return result.rows
  }
  const result = await query(`
    SELECT id, login, name, email, role, hotel_id, department_id, telegram_chat_id, is_active, status, must_change_password, is_owner, created_at
    FROM users
    ORDER BY created_at DESC
  `)
  return result.rows
}

export async function createUser(user) {
  const { login, name, email, password, role, hotel_id, department_id, status, must_change_password } = user
  const id = uuidv4()
  const hashedPassword = bcrypt.hashSync(password, 10)
  const userStatus = status || 'active'
  const mustChangePassword = must_change_password !== undefined ? must_change_password : false
  // Normalize email: empty string -> null
  const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : null

  await query(`
    INSERT INTO users (id, login, name, email, password, role, hotel_id, department_id, is_active, status, must_change_password)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10)
  `, [id, login, name, normalizedEmail, hashedPassword, role || 'STAFF', hotel_id, department_id, userStatus, mustChangePassword])

  return { id, login, name, email: normalizedEmail, role: role || 'STAFF', hotel_id, department_id, status: userStatus, must_change_password: mustChangePassword }
}

export async function updateUser(id, updates) {
  const fields = []
  const values = []
  let paramIndex = 1

  if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name) }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email)
    // Reset email status when email is updated
    fields.push(`email_valid = TRUE`)
    fields.push(`email_blocked = FALSE`)
  }
  if (updates.role !== undefined) { fields.push(`role = $${paramIndex++}`); values.push(updates.role) }
  if (updates.department_id !== undefined) { fields.push(`department_id = $${paramIndex++}`); values.push(updates.department_id) }
  if (updates.password !== undefined) {
    fields.push(`password = $${paramIndex++}`)
    values.push(bcrypt.hashSync(updates.password, 10))
  }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active) }
  if (updates.telegram_chat_id !== undefined) { fields.push(`telegram_chat_id = $${paramIndex++}`); values.push(updates.telegram_chat_id) }
  if (updates.email_valid !== undefined) { fields.push(`email_valid = $${paramIndex++}`); values.push(updates.email_valid) }
  if (updates.email_blocked !== undefined) { fields.push(`email_blocked = $${paramIndex++}`); values.push(updates.email_blocked) }
  if (updates.must_change_password !== undefined) { fields.push(`must_change_password = $${paramIndex++}`); values.push(updates.must_change_password) }

  if (fields.length === 0) return false

  values.push(id)
  const result = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values)
  return result.rowCount > 0
}

export async function deleteUser(id) {
  // Очищаем ссылки в таблицах без ON DELETE CASCADE/SET NULL
  await query('UPDATE join_requests SET processed_by = NULL WHERE processed_by = $1', [id])
  await query('UPDATE notification_rules SET created_by = NULL WHERE created_by = $1', [id])
  // Удаляем связанные данные (join_requests удалятся каскадно, но подстрахуемся)
  await query('DELETE FROM join_requests WHERE user_id = $1', [id])
  await query('DELETE FROM user_settings WHERE user_id = $1', [id])
  // Удаляем пользователя
  const result = await query('DELETE FROM users WHERE id = $1', [id])
  return result.rowCount > 0
}

export function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword)
}

export async function updateLastLogin(userId) {
  await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [userId])
}

export async function updateUserStatus(userId, isActive) {
  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, userId])
  return true
}

// ===============================================================
// JOIN REQUESTS - User registration with hotel code
// ===============================================================

export async function createJoinRequest(userId, hotelId) {
  const id = uuidv4()
  await query(`
    INSERT INTO join_requests (id, user_id, hotel_id, status, requested_at)
    VALUES ($1, $2, $3, 'pending', NOW())
    ON CONFLICT (user_id, hotel_id) DO UPDATE SET status = 'pending', requested_at = NOW()
  `, [id, userId, hotelId])
  return { id, user_id: userId, hotel_id: hotelId, status: 'pending' }
}

export async function getJoinRequestsForHotel(hotelId) {
  const result = await query(`
    SELECT jr.*, u.name as user_name, u.email as user_email, u.login as user_login,
           h.name as hotel_name
    FROM join_requests jr
    JOIN users u ON jr.user_id = u.id
    JOIN hotels h ON jr.hotel_id = h.id
    WHERE jr.hotel_id = $1 AND jr.status = 'pending'
    ORDER BY jr.requested_at DESC
  `, [hotelId])
  return result.rows
}

// Get ALL pending join requests (for SUPER_ADMIN)
export async function getAllPendingJoinRequests() {
  const result = await query(`
    SELECT jr.*, u.name as user_name, u.email as user_email, u.login as user_login,
           h.name as hotel_name, h.marsha_code as hotel_code
    FROM join_requests jr
    JOIN users u ON jr.user_id = u.id
    JOIN hotels h ON jr.hotel_id = h.id
    WHERE jr.status = 'pending'
    ORDER BY jr.requested_at DESC
  `)
  return result.rows
}

export async function getJoinRequestByUserId(userId) {
  const result = await query(`
    SELECT jr.*, h.name as hotel_name, h.marsha_code as hotel_code
    FROM join_requests jr
    JOIN hotels h ON jr.hotel_id = h.id
    WHERE jr.user_id = $1
    ORDER BY jr.requested_at DESC
    LIMIT 1
  `, [userId])
  return result.rows[0] || null
}

export async function approveJoinRequest(requestId, adminId, departmentId = null, role = 'STAFF') {
  const request = await query('SELECT * FROM join_requests WHERE id = $1', [requestId])
  if (!request.rows[0]) return null

  const jr = request.rows[0]

  // Validate role - включаем DEPARTMENT_MANAGER
  const validRoles = ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN']
  const userRole = validRoles.includes(role) ? role : 'STAFF'

  // HOTEL_ADMIN не привязывается к департаменту, STAFF и DEPARTMENT_MANAGER - привязываются
  const deptId = userRole === 'HOTEL_ADMIN' ? null : departmentId

  // Update user with hotel_id, role and optionally department_id
  await query(`
    UPDATE users
    SET hotel_id = $1, department_id = $2, role = $3, status = 'active'
    WHERE id = $4
  `, [jr.hotel_id, deptId, userRole, jr.user_id])

  // Update request status
  await query(`
    UPDATE join_requests
    SET status = 'approved', processed_at = NOW(), processed_by = $1
    WHERE id = $2
  `, [adminId, requestId])

  // Get department name for email notification
  let departmentName = null
  if (deptId) {
    const deptResult = await query('SELECT name FROM departments WHERE id = $1', [deptId])
    departmentName = deptResult.rows[0]?.name
  }

  return {
    ...jr,
    department_name: departmentName,
    user_role: userRole
  }
}

export async function rejectJoinRequest(requestId, adminId, notes = null) {
  await query(`
    UPDATE join_requests
    SET status = 'rejected', processed_at = NOW(), processed_by = $1, notes = $2
    WHERE id = $3
  `, [adminId, notes, requestId])
  return true
}
