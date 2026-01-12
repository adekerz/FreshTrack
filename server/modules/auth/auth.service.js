/**
 * Auth Module - Service
 * 
 * Бизнес-логика авторизации.
 * Сервис содержит всю логику, не зависящую от HTTP.
 */

import {
  getUserByLoginOrEmail,
  getUserById,
  createUser as dbCreateUser,
  updateUser as dbUpdateUser,
  deleteUser as dbDeleteUser,
  verifyPassword,
  getAllUsers,
  updateLastLogin,
  logAudit,
  getHotelById,
  updateUserStatus,
  createJoinRequest,
  query as dbQuery
} from '../../db/database.js'
import MarshaCodeService from '../../services/MarshaCodeService.js'
import { generateToken } from '../../middleware/auth.js'
import { PermissionService } from '../../services/PermissionService.js'
import { logError } from '../../utils/logger.js'

/**
 * Результат операции
 */
class ServiceResult {
  constructor(success, data = null, error = null, statusCode = 200) {
    this.success = success
    this.data = data
    this.error = error
    this.statusCode = statusCode
  }

  static ok(data) {
    return new ServiceResult(true, data, null, 200)
  }

  static created(data) {
    return new ServiceResult(true, data, null, 201)
  }

  static error(message, statusCode = 400) {
    return new ServiceResult(false, null, message, statusCode)
  }

  static notFound(message = 'Not found') {
    return new ServiceResult(false, null, message, 404)
  }

  static forbidden(message = 'Access denied') {
    return new ServiceResult(false, null, message, 403)
  }

  static unauthorized(message = 'Unauthorized') {
    return new ServiceResult(false, null, message, 401)
  }
}

/**
 * Auth Service - все операции авторизации
 */
export class AuthService {

  /**
   * Получить permissions пользователя как массив строк
   */
  static async getUserPermissionsArray(user) {
    try {
      const permissions = await PermissionService.getUserPermissions(user)
      return permissions.map(p => `${p.resource}:${p.action}`)
    } catch (error) {
      logError('AuthService', error)
      // Fallback based on role
      const role = user.role?.toUpperCase()
      if (role === 'SUPER_ADMIN' || role === 'HOTEL_ADMIN') return ['*']
      return []
    }
  }

  /**
   * Форматировать пользователя для ответа API
   */
  static async formatUserResponse(user, includePermissions = true) {
    let hotel = null
    if (user.hotel_id) {
      hotel = await getHotelById(user.hotel_id)
    }

    // Role labels for localization (Russian)
    const roleLabels = {
      SUPER_ADMIN: 'Супер Админ',
      HOTEL_ADMIN: 'Администратор отеля',
      DEPARTMENT_MANAGER: 'Менеджер отдела',
      MANAGER: 'Менеджер',
      STAFF: 'Сотрудник'
    }

    const role = user.role?.toUpperCase() || 'STAFF'

    const response = {
      id: user.id,
      login: user.login,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: roleLabels[role] || user.role,
      status: user.status || 'active',
      hotel_id: user.hotel_id,
      department_id: user.department_id,
      hotel: hotel ? {
        id: hotel.id,
        name: hotel.name,
        marsha_code: hotel.marsha_code
      } : null,
      telegram_chat_id: user.telegram_chat_id,
      is_active: user.is_active !== false
    }

    if (includePermissions) {
      response.permissions = await this.getUserPermissionsArray(user)

      // Add capabilities object for easier frontend checks
      const permissions = response.permissions
      const isAdmin = role === 'SUPER_ADMIN' || role === 'HOTEL_ADMIN'
      const hasAll = permissions.includes('*')

      response.capabilities = {
        // Admin checks (prefer using specific capabilities below)
        isAdmin,
        isSuperAdmin: role === 'SUPER_ADMIN',

        // Resource capabilities
        canViewAuditLogs: hasAll || isAdmin || permissions.includes('audit:read'),
        canManageUsers: hasAll || isAdmin || permissions.includes('users:create') || permissions.includes('users:manage'),
        canManageSettings: hasAll || isAdmin || permissions.includes('settings:manage'),
        canManageHotels: hasAll || role === 'SUPER_ADMIN' || permissions.includes('hotels:manage'),
        canManageDepartments: hasAll || isAdmin || permissions.includes('departments:manage'),
        canExport: hasAll || isAdmin || permissions.includes('export:create'),
        canImport: hasAll || isAdmin || permissions.includes('import:create'),

        // Inventory capabilities
        canViewInventory: hasAll || permissions.includes('inventory:read') || permissions.includes('products:read'),
        canEditInventory: hasAll || isAdmin || permissions.includes('inventory:update') || permissions.includes('products:update'),
        canDeleteInventory: hasAll || isAdmin || permissions.includes('inventory:delete') || permissions.includes('products:delete'),

        // Batch capabilities
        canCreateBatches: hasAll || permissions.includes('batches:create'),
        canCollectBatches: hasAll || permissions.includes('batches:collect') || permissions.includes('collections:create'),
        canWriteOff: hasAll || isAdmin || permissions.includes('writeoffs:create'),

        // Notification capabilities
        canManageNotifications: hasAll || isAdmin || permissions.includes('notifications:manage'),
        canViewSystemNotifications: hasAll || isAdmin || permissions.includes('notifications:admin'),

        // Access scope
        canAccessAllDepartments: isAdmin || permissions.includes('departments:*') || permissions.includes('*'),
        canAccessAllHotels: role === 'SUPER_ADMIN'
      }
    }

    return response
  }

  /**
   * Логин пользователя
   */
  static async login(email, password, ipAddress) {
    try {
      // Найти пользователя
      console.log('[AuthService] Login attempt:', email)
      const user = await getUserByLoginOrEmail(email)
      console.log('[AuthService] User found:', user ? user.login : 'NOT FOUND')
      if (!user) {
        return ServiceResult.unauthorized('Invalid credentials')
      }

      // Проверить блокировку
      if (user.is_active === false) {
        return ServiceResult.forbidden('Account is blocked. Contact administrator.')
      }

      // Проверить пароль
      console.log('[AuthService] Password check, hash exists:', !!user.password)
      const isValidPassword = verifyPassword(password, user.password)
      console.log('[AuthService] Password valid:', isValidPassword)
      if (!isValidPassword) {
        return ServiceResult.unauthorized('Invalid credentials')
      }

      // Обновить last_login
      await updateLastLogin(user.id)

      // Сгенерировать токен
      const token = generateToken(user)

      // Логирование
      await logAudit({
        hotel_id: user.hotel_id,
        user_id: user.id,
        user_name: user.name || user.login,
        action: 'login',
        entity_type: 'user',
        entity_id: user.id,
        details: { method: 'password' },
        ip_address: ipAddress
      })

      // Форматировать ответ
      const userData = await this.formatUserResponse(user, true)

      return ServiceResult.ok({
        user: userData,
        token
      })
    } catch (error) {
      logError('AuthService.login', error)
      return ServiceResult.error('Authentication failed', 500)
    }
  }

  /**
   * Регистрация нового пользователя (публичная)
   */
  static async register(data) {
    try {
      // Проверить уникальность login/email
      const existingUser = await getUserByLoginOrEmail(data.login)
      if (existingUser) {
        return ServiceResult.error('Пользователь с таким логином уже существует')
      }

      if (data.email) {
        const existingEmail = await getUserByLoginOrEmail(data.email)
        if (existingEmail) {
          return ServiceResult.error('Пользователь с таким email уже существует')
        }
      }

      // Если указан hotelCode, найти отель по коду или MARSHA коду
      let hotelId = data.hotelId || null
      if (data.hotelCode && !hotelId) {
        const codeUpper = data.hotelCode.toUpperCase().trim()

        // Ищем по marsha_code отеля
        const hotelByCode = await dbQuery(`
          SELECT id FROM hotels 
          WHERE UPPER(marsha_code) = $1 AND is_active = true
        `, [codeUpper])

        if (hotelByCode.rows.length > 0) {
          hotelId = hotelByCode.rows[0].id
          console.log('[AuthService] Found hotel by code/marsha_code:', codeUpper, '-> hotelId:', hotelId)
        } else {
          // Если не нашли в hotels, ищем через MarshaCodeService (в таблице marsha_codes)
          const hotel = await MarshaCodeService.getHotelByMarshaCode(data.hotelCode)
          if (hotel) {
            hotelId = hotel.id
            console.log('[AuthService] Found hotel via MarshaCodeService:', codeUpper, '-> hotelId:', hotelId)
          } else {
            console.log('[AuthService] Hotel NOT FOUND by code:', codeUpper)
          }
        }
      }

      // Создать пользователя с базовой ролью
      const newUser = await dbCreateUser({
        login: data.login,
        email: data.email || null,
        password: data.password,
        name: data.name,
        role: 'STAFF', // Новые пользователи получают минимальную роль
        hotel_id: hotelId,
        status: hotelId ? 'pending' : 'active' // Если привязан к отелю - требуется одобрение
      })

      // Если привязан к отелю - создать заявку на вступление
      if (hotelId) {
        await createJoinRequest(newUser.id, hotelId)
        console.log('[AuthService] Created join request for user:', newUser.id, 'hotel:', hotelId)
      }

      // Генерируем токен
      const token = generateToken(newUser)

      // Форматируем ответ
      const userData = await this.formatUserResponse(newUser, true)

      return ServiceResult.created({
        user: userData,
        token
      })
    } catch (error) {
      logError('AuthService.register', error)
      return ServiceResult.error('Ошибка регистрации', 500)
    }
  }

  /**
   * Смена пароля
   */
  static async changePassword(userId, currentPassword, newPassword, ipAddress = null) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        return ServiceResult.notFound('Пользователь не найден')
      }

      // Проверить текущий пароль
      const isValidPassword = verifyPassword(currentPassword, user.password)
      if (!isValidPassword) {
        return ServiceResult.error('Неверный текущий пароль', 401)
      }

      // Обновить пароль
      await dbUpdateUser(userId, { password: newPassword })

      // Логирование
      await logAudit({
        hotel_id: user.hotel_id,
        user_id: userId,
        user_name: user.name || user.login,
        action: 'change_password',
        entity_type: 'user',
        entity_id: userId,
        details: { method: 'self' },
        ip_address: ipAddress
      })

      return ServiceResult.ok({ message: 'Пароль успешно изменён' })
    } catch (error) {
      logError('AuthService.changePassword', error)
      return ServiceResult.error('Ошибка смены пароля', 500)
    }
  }

  /**
   * Логаут пользователя
   */
  static async logout(user, ipAddress) {
    try {
      await logAudit({
        hotel_id: user.hotel_id,
        user_id: user.id,
        user_name: user.name || user.login,
        action: 'logout',
        entity_type: 'user',
        entity_id: user.id,
        ip_address: ipAddress
      })

      return ServiceResult.ok({ message: 'Logged out successfully' })
    } catch (error) {
      logError('AuthService.logout', error)
      return ServiceResult.error('Logout failed', 500)
    }
  }

  /**
   * Получить текущего пользователя
   */
  static async getCurrentUser(userId) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        return ServiceResult.notFound('User not found')
      }

      const userData = await this.formatUserResponse(user, true)
      return ServiceResult.ok({ user: userData })
    } catch (error) {
      logError('AuthService.getCurrentUser', error)
      return ServiceResult.error('Failed to get user', 500)
    }
  }

  /**
   * Создать пользователя
   */
  static async createUser(data, creator, ipAddress = null) {
    try {
      // Проверить уникальность login/email
      const existingUser = await getUserByLoginOrEmail(data.login)
      if (existingUser) {
        return ServiceResult.error('User with this login already exists')
      }

      const existingEmail = await getUserByLoginOrEmail(data.email)
      if (existingEmail) {
        return ServiceResult.error('User with this email already exists')
      }

      // Определить hotel_id (поддержка camelCase и snake_case)
      let hotelId = data.hotelId || data.hotel_id
      if (!hotelId && creator.role !== 'SUPER_ADMIN') {
        hotelId = creator.hotel_id
      }

      // Определить department_id (поддержка camelCase и snake_case)
      const departmentId = data.departmentId || data.department_id

      // Создать пользователя
      const newUser = await dbCreateUser({
        login: data.login,
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role,
        hotel_id: hotelId,
        department_id: departmentId
      })

      // Логирование
      await logAudit({
        hotel_id: hotelId,
        user_id: creator.id,
        user_name: creator.name || creator.login,
        action: 'create',
        entity_type: 'user',
        entity_id: newUser.id,
        details: {
          login: newUser.login,
          role: newUser.role,
          created_by: creator.login
        },
        ip_address: ipAddress
      })

      const userData = await this.formatUserResponse(newUser, false)
      return ServiceResult.created({ user: userData })
    } catch (error) {
      logError('AuthService.createUser', error)
      return ServiceResult.error('Failed to create user', 500)
    }
  }

  /**
   * Обновить пользователя
   */
  static async updateUser(userId, data, editor, ipAddress = null) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        return ServiceResult.notFound('User not found')
      }

      // Обновить
      const updatedUser = await dbUpdateUser(userId, data)

      // Логирование
      await logAudit({
        hotel_id: user.hotel_id,
        user_id: editor.id,
        user_name: editor.name || editor.login,
        action: 'update',
        entity_type: 'user',
        entity_id: userId,
        details: {
          changes: Object.keys(data).filter(k => data[k] !== undefined),
          updated_by: editor.login
        },
        ip_address: ipAddress
      })

      const userData = await this.formatUserResponse(updatedUser, false)
      return ServiceResult.ok({ user: userData })
    } catch (error) {
      logError('AuthService.updateUser', error)
      return ServiceResult.error('Failed to update user', 500)
    }
  }

  /**
   * Удалить пользователя
   */
  static async deleteUser(userId, deleter, ipAddress = null) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        return ServiceResult.notFound('User not found')
      }

      // Нельзя удалить себя
      if (userId === deleter.id) {
        return ServiceResult.error('Cannot delete yourself')
      }

      await dbDeleteUser(userId)

      // Логирование
      await logAudit({
        hotel_id: user.hotel_id,
        user_id: deleter.id,
        user_name: deleter.name || deleter.login,
        action: 'delete',
        entity_type: 'user',
        entity_id: userId,
        details: {
          deleted_login: user.login,
          deleted_by: deleter.login
        },
        ip_address: ipAddress
      })

      return ServiceResult.ok({ message: 'User deleted successfully' })
    } catch (error) {
      logError('AuthService.deleteUser', error)
      return ServiceResult.error('Failed to delete user', 500)
    }
  }

  /**
   * Заблокировать/разблокировать пользователя
   */
  static async toggleUserStatus(userId, editor, ipAddress = null) {
    try {
      const user = await getUserById(userId)
      if (!user) {
        return ServiceResult.notFound('User not found')
      }

      // Нельзя заблокировать себя
      if (userId === editor.id) {
        return ServiceResult.error('Cannot block yourself')
      }

      // Переключаем статус
      const newStatus = !user.is_active
      await updateUserStatus(userId, newStatus)

      // Логирование
      await logAudit({
        hotel_id: user.hotel_id,
        user_id: editor.id,
        user_name: editor.name || editor.login,
        action: newStatus ? 'unblock' : 'block',
        entity_type: 'user',
        entity_id: userId,
        details: {
          target_login: user.login,
          action_by: editor.login
        },
        ip_address: ipAddress
      })

      return ServiceResult.ok({
        message: newStatus ? 'User unblocked' : 'User blocked',
        is_active: newStatus,
        isActive: newStatus
      })
    } catch (error) {
      logError('AuthService.toggleUserStatus', error)
      return ServiceResult.error('Failed to update user status', 500)
    }
  }

  /**
   * Получить всех пользователей отеля
   */
  static async getUsers(queryParams, requestingUser) {
    try {
      const hotelId = requestingUser.hotel_id
      const users = await getAllUsers(hotelId)

      // Форматировать ответ
      const formattedUsers = await Promise.all(
        users.map(u => this.formatUserResponse(u, false))
      )

      return ServiceResult.ok({ users: formattedUsers })
    } catch (error) {
      logError('AuthService.getUsers', error)
      return ServiceResult.error('Failed to get users', 500)
    }
  }
}

export { ServiceResult }
