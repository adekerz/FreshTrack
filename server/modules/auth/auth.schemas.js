/**
 * Auth Module - Zod Validation Schemas
 * 
 * Строгие схемы валидации для auth эндпоинтов.
 * Используется Zod для типобезопасности и автоматической валидации.
 */

import { z } from 'zod'

// ========================================
// Базовые схемы (переиспользуемые)
// ========================================

export const loginSchema = z.string()
  .min(3, 'Логин должен быть минимум 3 символа')
  .max(50, 'Логин должен быть максимум 50 символов')
  .regex(/^[a-zA-Z0-9_]+$/, 'Логин может содержать только буквы, цифры и _')
  .transform(val => val.trim().toLowerCase())

export const emailSchema = z.string()
  .email('Неверный формат email')
  .max(100, 'Email слишком длинный')
  .transform(val => val.trim().toLowerCase())

export const passwordSchema = z.string()
  .min(6, 'Пароль должен быть минимум 6 символов')
  .max(100, 'Пароль слишком длинный')

export const nameSchema = z.string()
  .max(100, 'Имя должно быть максимум 100 символов')
  .transform(val => val.trim())
  .optional()
  .nullable()

// ========================================
// Роли пользователей
// ========================================

export const UserRole = z.enum([
  'SUPER_ADMIN',
  'HOTEL_ADMIN',
  'MANAGER',
  'DEPARTMENT_MANAGER',
  'STAFF'
])

// Какие роли может создавать каждая роль
export const ROLE_HIERARCHY = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'MANAGER', 'DEPARTMENT_MANAGER', 'STAFF'],
  HOTEL_ADMIN: ['HOTEL_ADMIN', 'MANAGER', 'DEPARTMENT_MANAGER', 'STAFF'],
  MANAGER: ['DEPARTMENT_MANAGER', 'STAFF'],
  DEPARTMENT_MANAGER: ['STAFF'],
  STAFF: []
}

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/auth/login
 */
export const LoginRequestSchema = z.object({
  email: z.string().min(1, 'Email или логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен')
}).transform(data => ({
  email: data.email.trim().toLowerCase(),
  password: data.password
}))

/**
 * POST /api/auth/register
 */
export const RegisterRequestSchema = z.object({
  login: loginSchema,
  email: emailSchema.optional().nullable(),
  password: passwordSchema,
  name: nameSchema,
  hotelId: z.string().uuid().optional().nullable(),
  hotelCode: z.string().min(3).max(10).optional().nullable(),
  departmentId: z.string().uuid().optional().nullable()
})

/**
 * POST /api/users (создание пользователя админом)
 * Поддерживает snake_case и camelCase для ID полей
 */
export const CreateUserRequestSchema = z.object({
  login: loginSchema,
  email: emailSchema.optional().nullable(), // Optional - but required if password is auto-generated
  password: passwordSchema.optional(), // Optional - if not provided, temporary password will be generated
  name: nameSchema,
  role: UserRole,
  // Поддержка обоих форматов: camelCase и snake_case
  hotelId: z.string().uuid().optional().nullable(),
  hotel_id: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true)
}).transform(data => ({
  ...data,
  hotelId: data.hotelId || data.hotel_id,
  departmentId: data.departmentId || data.department_id
}))

/**
 * PUT /api/users/:id (обновление пользователя)
 */
export const UpdateUserRequestSchema = z.object({
  login: loginSchema.optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  name: nameSchema,
  role: UserRole.optional(),
  hotelId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'Необходимо указать хотя бы одно поле для обновления'
})

/**
 * Схема смены пароля
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
  newPassword: passwordSchema
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'Новый пароль должен отличаться от текущего',
  path: ['newPassword']
})

/**
 * Query параметры для GET /api/users
 */
export const GetUsersQuerySchema = z.object({
  hotelId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  role: UserRole.optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})

// ========================================
// Вспомогательные функции
// ========================================

/**
 * Универсальная функция валидации с Zod схемой
 * @param {z.ZodSchema} schema - Zod схема
 * @param {unknown} data - Данные для валидации
 * @returns {{ isValid: boolean, errors: Array, data: any }}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data)

  if (result.success) {
    return {
      isValid: true,
      errors: [],
      data: result.data
    }
  }

  // Zod v4 uses error.issues instead of error.errors
  const issues = result.error?.issues || result.error?.errors || []
  return {
    isValid: false,
    errors: issues.map(err => ({
      field: err.path?.join('.') || '',
      message: err.message,
      code: err.code
    })),
    data: null
  }
}

/**
 * Проверка, может ли создатель назначить указанную роль
 */
export function canAssignRole(creatorRole, targetRole) {
  const allowedRoles = ROLE_HIERARCHY[creatorRole] || []
  return allowedRoles.includes(targetRole)
}

/**
 * Получить список ролей, которые может создавать пользователь
 */
export function getAllowedRolesForCreator(creatorRole) {
  return ROLE_HIERARCHY[creatorRole] || []
}

/**
 * Проверка прав на редактирование пользователя
 */
export function canEditUser(editor, targetUser) {
  // SUPER_ADMIN может редактировать всех
  if (editor.role === 'SUPER_ADMIN') {
    return true
  }

  // Пользователь может редактировать себя (ограниченно)
  if (editor.id === targetUser.id) {
    return true
  }

  // HOTEL_ADMIN может редактировать пользователей своего отеля
  if (editor.role === 'HOTEL_ADMIN' && editor.hotelId === targetUser.hotelId) {
    return canAssignRole(editor.role, targetUser.role)
  }

  // MANAGER может редактировать STAFF своего отеля
  if (editor.role === 'MANAGER' && editor.hotelId === targetUser.hotelId) {
    return ['DEPARTMENT_MANAGER', 'STAFF'].includes(targetUser.role)
  }

  // DEPARTMENT_MANAGER может редактировать STAFF своего отдела
  if (editor.role === 'DEPARTMENT_MANAGER' &&
    editor.hotelId === targetUser.hotelId &&
    editor.departmentId === targetUser.departmentId) {
    return targetUser.role === 'STAFF'
  }

  return false
}

// ========================================
// Экспорт для обратной совместимости
// ========================================

export const validateLogin = (data) => validate(LoginRequestSchema, data)
export const validateRegister = (data) => validate(RegisterRequestSchema, data)
export const validateCreateUser = (data) => validate(CreateUserRequestSchema, data)
export const validateUpdateUser = (data) => validate(UpdateUserRequestSchema, data)
export const validateChangePassword = (data) => validate(ChangePasswordSchema, data)
export const validateGetUsersQuery = (data) => validate(GetUsersQuerySchema, data)
