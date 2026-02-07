/**
 * Export Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * GET /api/export/* — общие query params для экспорта
 */
export const ExportQuerySchema = z.object({
  format: z.enum(['json', 'xlsx', 'csv', 'pdf', 'excel']).optional().default('xlsx'),
  department_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  status: z.string().max(50).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(5000)
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
