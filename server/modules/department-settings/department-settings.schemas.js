/**
 * Department Settings Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Базовые типы
// ========================================

const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Время должно быть в формате HH:MM')

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * PUT /api/department-settings/:departmentId
 */
export const UpdateDepartmentSettingsSchema = z.object({
  telegramEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  quietHoursStart: TimeSchema.optional().nullable(),
  quietHoursEnd: TimeSchema.optional().nullable(),
  warningDays: z.number().int().min(0).max(365).optional().nullable(),
  criticalDays: z.number().int().min(0).max(365).optional().nullable()
}).catchall(z.any()) // Разрешаем дополнительные ключи настроек

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
