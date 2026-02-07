/**
 * GDPR Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/gdpr/delete-my-account
 */
export const DeleteAccountSchema = z.object({
  confirmPassword: z.string().min(1, 'Подтверждение пароля обязательно')
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
