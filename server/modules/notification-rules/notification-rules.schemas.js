/**
 * Notification Rules Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Базовые типы
// ========================================

const NotificationChannelSchema = z.enum(['telegram', 'email', 'push', 'in_app'])

const RecipientRoleSchema = z.enum([
  'SUPER_ADMIN', 'HOTEL_ADMIN', 'MANAGER', 'DEPARTMENT_MANAGER', 'STAFF'
])

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/notification-rules/rules
 */
export const CreateNotificationRuleSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  type: z.string().min(1, 'Тип правила обязателен').max(100),
  name: z.string()
    .min(1, 'Название обязательно')
    .max(200, 'Название слишком длинное')
    .transform(v => v.trim()),
  description: z.string().max(500).optional().nullable(),
  warningDays: z.number().int().min(0).max(365).optional().nullable(),
  criticalDays: z.number().int().min(0).max(365).optional().nullable(),
  channels: z.array(NotificationChannelSchema).min(1, 'Выберите хотя бы один канал'),
  recipientRoles: z.array(RecipientRoleSchema).min(1, 'Выберите хотя бы одну роль'),
  departmentId: z.string().uuid().optional().nullable(),
  enabled: z.boolean().default(true),
  hotelId: z.string().uuid().optional().nullable()
})

/**
 * PUT /api/notification-rules/telegram-chats/:id
 */
export const UpdateTelegramChatSchema = z.object({
  departmentId: z.string().uuid().optional().nullable(),
  notificationTypes: z.array(z.string().max(50)).optional().nullable(),
  silentMode: z.boolean().optional().nullable()
})

/**
 * POST /api/notification-rules/test-telegram
 */
export const TestTelegramSchema = z.object({
  chatId: z.string().min(1, 'chatId обязателен'),
  message: z.string().max(4096).optional().nullable()
})

// ========================================
// Вспомогательные функции
// ========================================

export function validate(schema, data) {
  const result = schema.safeParse(data)

  if (result.success) {
    return { isValid: true, errors: [], data: result.data }
  }

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
