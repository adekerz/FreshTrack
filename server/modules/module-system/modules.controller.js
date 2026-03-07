/**
 * Modules Controller
 *
 * API эндпоинты для управления модулями системы.
 *
 * Эндпоинты:
 *   GET  /api/modules/my-modules              - Модули текущего пользователя
 *   GET  /api/modules/all                      - Все модули системы (admin)
 *   GET  /api/modules/department/:departmentId - Модули отдела (admin)
 *   POST /api/modules/department/:departmentId/enable   - Включить модуль
 *   DELETE /api/modules/department/:departmentId/:moduleCode - Отключить модуль
 *   PATCH /api/modules/department/:departmentId/:moduleCode/settings - Обновить настройки
 */

import { Router } from 'express'
import { authMiddleware, hotelIsolation } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/permissions.js'
import ModuleService from '../../services/ModuleService.js'
import { query } from '../../db/database.js'

const router = Router()

/**
 * Middleware: проверяет что departmentId принадлежит отелю текущего пользователя
 * SUPER_ADMIN может управлять любым отделом
 */
const requireDepartmentBelongsToHotel = async (req, res, next) => {
  if (req.user?.role === 'SUPER_ADMIN') return next()

  const { departmentId } = req.params
  if (!departmentId) return next()

  try {
    const result = await query(
      'SELECT hotel_id FROM departments WHERE id = $1',
      [departmentId]
    )
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, error: 'Department not found' })
    }
    if (result.rows[0].hotel_id !== req.hotelId) {
      return res
        .status(403)
        .json({ success: false, error: 'Access denied to this department' })
    }
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/modules/my-modules
 * Получить модули доступные текущему пользователю
 */
router.get(
  '/my-modules',
  authMiddleware,
  hotelIsolation,
  async (req, res, next) => {
    try {
      const userId = req.user.id
      const modules = await ModuleService.getUserModules(userId)

      res.json({
        success: true,
        modules,
      })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * GET /api/modules/all
 * Получить все модули системы (только для админов)
 */
router.get(
  '/all',
  authMiddleware,
  hotelIsolation,
  requireRole('SUPER_ADMIN', 'HOTEL_ADMIN'),
  async (req, res, next) => {
    try {
      const modules = await ModuleService.getAllModules()

      res.json({
        success: true,
        modules,
      })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * GET /api/modules/department/:departmentId
 * Получить модули отдела (для админов)
 */
router.get(
  '/department/:departmentId',
  authMiddleware,
  hotelIsolation,
  requireRole('SUPER_ADMIN', 'HOTEL_ADMIN'),
  async (req, res, next) => {
    try {
      const { departmentId } = req.params
      const modules = await ModuleService.getDepartmentModules(departmentId)

      res.json({
        success: true,
        modules,
      })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * POST /api/modules/department/:departmentId/enable
 * Включить модуль для отдела
 * Body: { module_code: string, settings?: object }
 */
router.post(
  '/department/:departmentId/enable',
  authMiddleware,
  hotelIsolation,
  requireRole('SUPER_ADMIN', 'HOTEL_ADMIN'),
  requireDepartmentBelongsToHotel,
  async (req, res, next) => {
    try {
      const { departmentId } = req.params
      const { module_code, settings = {} } = req.body

      if (!module_code) {
        return res.status(400).json({
          success: false,
          error: 'module_code is required',
        })
      }

      const result = await ModuleService.enableModule(
        departmentId,
        module_code,
        req.user.id,
        settings
      )

      return res.json({
        success: true,
        message: `Module '${module_code}' enabled for department`,
        data: result,
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        })
      }
      return next(error)
    }
  }
)

/**
 * DELETE /api/modules/department/:departmentId/:moduleCode
 * Отключить модуль для отдела
 */
router.delete(
  '/department/:departmentId/:moduleCode',
  authMiddleware,
  hotelIsolation,
  requireRole('SUPER_ADMIN', 'HOTEL_ADMIN'),
  requireDepartmentBelongsToHotel,
  async (req, res, next) => {
    try {
      const { departmentId, moduleCode } = req.params

      await ModuleService.disableModule(departmentId, moduleCode, req.user.id)

      return res.json({
        success: true,
        message: `Module '${moduleCode}' disabled for department`,
      })
    } catch (error) {
      if (error.message.includes('Cannot disable core')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        })
      }
      return next(error)
    }
  }
)

/**
 * PATCH /api/modules/department/:departmentId/:moduleCode/settings
 * Обновить настройки модуля для отдела
 * Body: { settings: object }
 */
router.patch(
  '/department/:departmentId/:moduleCode/settings',
  authMiddleware,
  hotelIsolation,
  requireRole('SUPER_ADMIN', 'HOTEL_ADMIN'),
  requireDepartmentBelongsToHotel,
  async (req, res, next) => {
    try {
      const { departmentId, moduleCode } = req.params
      const { settings } = req.body

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'settings object is required',
        })
      }

      const result = await ModuleService.updateModuleSettings(
        departmentId,
        moduleCode,
        settings
      )

      return res.json({
        success: true,
        message: 'Module settings updated',
        data: result,
      })
    } catch (error) {
      return next(error)
    }
  }
)

export default router
