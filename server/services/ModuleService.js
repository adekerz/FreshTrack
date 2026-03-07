/**
 * ModuleService
 *
 * Сервис управления модулями системы.
 * Отвечает за проверку доступа к модулям, включение/отключение модулей для отделов.
 */

import { query } from '../db/database.js'
import sseManager from './SSEManager.js'
import { logError } from '../utils/logger.js'

// Кэш модулей пользователей (TTL-based)
const moduleCache = new Map()
const CACHE_TTL = 60 * 1000 // 60 секунд

class ModuleService {
  /**
   * Получить все модули доступные пользователю
   * @param {string} userId - ID пользователя
   * @returns {Promise<Array>} - список модулей
   */
  static async getUserModules(userId) {
    const cacheKey = `user:${userId}`
    const cached = moduleCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.modules
    }

    const result = await query(
      `
      SELECT DISTINCT m.code, m.name, m.description, m.icon, m.is_core, m.tier
      FROM modules m
      WHERE m.is_core = true
        AND EXISTS (SELECT 1 FROM users WHERE id = $1)
      UNION
      SELECT DISTINCT m.code, m.name, m.description, m.icon, m.is_core, m.tier
      FROM modules m
      INNER JOIN department_modules dm ON dm.module_code = m.code
      INNER JOIN users u ON u.department_id = dm.department_id
      WHERE u.id = $1
        AND dm.is_enabled = true
        AND m.is_core = false
      ORDER BY is_core DESC, name ASC
    `,
      [userId]
    )

    const modules = result.rows
    moduleCache.set(cacheKey, { modules, timestamp: Date.now() })

    return modules
  }

  /**
   * Проверить имеет ли пользователь доступ к модулю
   * @param {string} userId - ID пользователя
   * @param {string} moduleCode - Код модуля
   * @returns {Promise<boolean>}
   */
  static async hasModuleAccess(userId, moduleCode) {
    // Сначала проверяем кэш пользователя
    const userModules = await this.getUserModules(userId)
    return userModules.some((m) => m.code === moduleCode)
  }

  /**
   * Получить модули отдела
   * @param {string} departmentId - ID отдела
   * @returns {Promise<Array>}
   */
  static async getDepartmentModules(departmentId) {
    const result = await query(
      `
      SELECT
        m.code, m.name, m.description, m.icon, m.is_core, m.tier,
        dm.is_enabled, dm.enabled_at, dm.disabled_at, dm.settings
      FROM modules m
      LEFT JOIN department_modules dm
        ON dm.module_code = m.code AND dm.department_id = $1
      ORDER BY m.is_core DESC, m.name ASC
    `,
      [departmentId]
    )

    return result.rows
  }

  /**
   * Получить все модули системы
   * @returns {Promise<Array>}
   */
  static async getAllModules() {
    const result = await query(`
      SELECT code, name, description, icon, is_core, tier
      FROM modules
      ORDER BY is_core DESC, name ASC
    `)
    return result.rows
  }

  /**
   * Включить модуль для отдела (только HOTEL_ADMIN / SUPER_ADMIN)
   * @param {string} departmentId - ID отдела
   * @param {string} moduleCode - Код модуля
   * @param {string} enabledBy - ID пользователя, включившего модуль
   * @param {Object} settings - Настройки модуля
   * @returns {Promise<Object>}
   */
  static async enableModule(
    departmentId,
    moduleCode,
    enabledBy,
    settings = {}
  ) {
    // Проверяем что модуль существует
    const moduleCheck = await query(
      'SELECT code FROM modules WHERE code = $1',
      [moduleCode]
    )
    if (moduleCheck.rows.length === 0) {
      throw new Error(`Module '${moduleCode}' not found`)
    }

    // Получить текущее состояние для расчёта inactive_days
    const existing = await query(
      `
      SELECT disabled_at FROM department_modules
      WHERE department_id = $1 AND module_code = $2
    `,
      [departmentId, moduleCode]
    )

    const disabledAt = existing.rows[0]?.disabled_at || null
    const inactiveDays = disabledAt
      ? Math.floor(
          (Date.now() - new Date(disabledAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0

    const result = await query(
      `
      INSERT INTO department_modules (department_id, module_code, enabled_by, settings, is_enabled)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (department_id, module_code)
      DO UPDATE SET
        is_enabled = true,
        enabled_by = $3,
        settings = $4,
        enabled_at = NOW(),
        disabled_at = NULL,
        disabled_by = NULL
      RETURNING *
    `,
      [departmentId, moduleCode, enabledBy, JSON.stringify(settings)]
    )

    // Очищаем кэш для всех пользователей этого отдела
    this.clearDepartmentCache(departmentId)

    // Broadcast real-time notification to department users
    await this.broadcastModuleEvent(departmentId, 'module-enabled', {
      module_code: moduleCode,
      inactive_days: inactiveDays,
    })

    return result.rows[0]
  }

  /**
   * Отключить модуль для отдела
   * @param {string} departmentId - ID отдела
   * @param {string} moduleCode - Код модуля
   * @param {string} [disabledBy] - ID пользователя, отключившего модуль
   * @returns {Promise<boolean>}
   */
  static async disableModule(departmentId, moduleCode, disabledBy = null) {
    // Нельзя отключить core модуль
    const moduleCheck = await query(
      'SELECT is_core FROM modules WHERE code = $1',
      [moduleCode]
    )
    if (moduleCheck.rows.length > 0 && moduleCheck.rows[0].is_core) {
      throw new Error(`Cannot disable core module '${moduleCode}'`)
    }

    await query(
      `
      UPDATE department_modules
      SET is_enabled = false,
          disabled_at = NOW(),
          disabled_by = $3
      WHERE department_id = $1 AND module_code = $2
    `,
      [departmentId, moduleCode, disabledBy]
    )

    // Очищаем кэш
    this.clearDepartmentCache(departmentId)

    // Broadcast real-time notification to department users
    await this.broadcastModuleEvent(departmentId, 'module-disabled', {
      module_code: moduleCode,
    })

    return true
  }

  /**
   * Обновить настройки модуля
   * @param {string} departmentId - ID отдела
   * @param {string} moduleCode - Код модуля
   * @param {Object} settings - Новые настройки
   * @returns {Promise<Object>}
   */
  static async updateModuleSettings(departmentId, moduleCode, settings) {
    const result = await query(
      `
      UPDATE department_modules
      SET settings = $3
      WHERE department_id = $1 AND module_code = $2
      RETURNING *
    `,
      [departmentId, moduleCode, JSON.stringify(settings)]
    )

    if (result.rows.length === 0) {
      throw new Error(`Module '${moduleCode}' not found for department`)
    }

    return result.rows[0]
  }

  /**
   * Broadcast SSE event to all users in a department
   * @param {string} departmentId - ID отдела
   * @param {string} event - SSE event name
   * @param {Object} data - Event data
   */
  static async broadcastModuleEvent(departmentId, event, data) {
    try {
      const deptResult = await query(
        'SELECT hotel_id FROM departments WHERE id = $1',
        [departmentId]
      )
      if (!deptResult.rows.length) return

      const hotelId = deptResult.rows[0].hotel_id
      sseManager.broadcastToDepartment(hotelId, departmentId, event, data)
    } catch (err) {
      logError('ModuleService', `Failed to broadcast ${event}: ${err.message}`)
    }
  }

  /**
   * Очистить кэш для всех пользователей отдела
   * @param {string} departmentId - ID отдела
   */
  static clearDepartmentCache(_departmentId) {
    // Удаляем все записи кэша (простой вариант)
    // В продакшн можно хранить маппинг department -> users
    moduleCache.clear()
  }

  /**
   * Очистить весь кэш
   */
  static clearCache() {
    moduleCache.clear()
  }
}

export default ModuleService
