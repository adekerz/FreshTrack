/**
 * MARSHA Codes Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/marsha-codes/assign
 */
export const AssignMarshaCodeSchema = z.object({
  hotelId: z.string().uuid('Невалидный ID отеля'),
  marshaCodeId: z.string().uuid('Невалидный ID MARSHA кода')
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
