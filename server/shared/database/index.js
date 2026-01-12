/**
 * Shared Database
 * 
 * Экспорт базы данных и утилит.
 */

import * as db from '../../db/database.js'

export { db }

// Re-export common functions
export const {
  getUserById,
  getUserByLoginOrEmail,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  getHotelById,
  logAudit
} = db
