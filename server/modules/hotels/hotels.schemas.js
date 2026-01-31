/**
 * Hotels Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Schemas
// ========================================

export const CreateHotelSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  settings: z.record(z.any()).optional().nullable(),
  timezone: z.string().max(50).default('Asia/Almaty'),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  timezone_auto_detected: z.boolean().optional().default(false),
  marsha_code: z.string().length(5, 'MARSHA код должен быть 5 символов').optional().nullable(),
  marsha_code_id: z.string().uuid('Неверный формат ID').optional().nullable()
})

export const UpdateHotelSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  settings: z.record(z.any()).optional().nullable(),
  timezone: z.string().max(50).optional(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  timezone_auto_detected: z.boolean().optional(),
  is_active: z.boolean().optional()
})

// ========================================
// Helpers
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
