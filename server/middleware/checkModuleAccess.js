/**
 * checkModuleAccess Middleware
 *
 * Middleware для проверки доступа к модулям на уровне эндпоинтов.
 * Проверяет что у пользователя (через его отдел) есть доступ к запрашиваемому модулю.
 *
 * Админы (SUPER_ADMIN, HOTEL_ADMIN) имеют доступ ко всем модулям.
 */

import ModuleService from '../services/ModuleService.js'
import { isAdmin } from '../utils/constants.js'
import { logError } from '../utils/logger.js'

/**
 * Middleware для проверки доступа к модулю
 * @param {string} moduleCode - Код модуля ('inventory', 'task_planner', 'logbook_scanner')
 * @returns {Function} Express middleware
 */
export const requireModule = (moduleCode) => {
  return async (req, res, next) => {
    // Требуется аутентификация
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required to access this resource',
      })
    }

    // Админы имеют доступ ко всем модулям
    if (isAdmin(req.user)) {
      return next()
    }

    try {
      const userId = req.user.id

      // Проверяем доступ через ModuleService
      const hasAccess = await ModuleService.hasModuleAccess(userId, moduleCode)

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'MODULE_ACCESS_DENIED',
          message: `Access to module '${moduleCode}' is not available for your department`,
          module: moduleCode,
        })
      }

      return next()
    } catch (error) {
      logError(
        `[ModuleAccess] Error checking access for module '${moduleCode}':`,
        error
      )
      return next(error)
    }
  }
}

export default { requireModule }
