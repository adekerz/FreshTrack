/**
 * Audit Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/audit-logs/enrich
 */
export const EnrichAuditLogsSchema = z.object({
  limit: z.number().int().min(1).max(5000).optional().default(1000)
})

/**
 * GET /api/audit-logs — query params
 */
export const GetAuditLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  action: z.string().max(50).optional(),
  entityType: z.string().max(50).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  userId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  severity: z.enum(['critical', 'important', 'normal']).optional(),
  securityOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  hotelId: z.string().uuid().optional(),
  search: z.string().max(200).optional()
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
