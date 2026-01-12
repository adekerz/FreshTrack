/**
 * Write-offs Validation Schemas
 */

import { z } from 'zod'

export const CreateWriteOffSchema = z.object({
  batch_id: z.string().uuid().optional().nullable(),
  product_id: z.string().uuid().optional().nullable(),
  quantity: z.number().positive('Quantity must be positive').or(z.string().regex(/^\d+(\.\d+)?$/).transform(Number)),
  reason: z.string().min(1, 'Reason is required').max(100),
  notes: z.string().max(500).optional().nullable()
}).refine(data => data.batch_id || data.product_id, {
  message: 'Either batch_id or product_id is required'
})

export const UpdateWriteOffSchema = z.object({
  reason: z.string().min(1).max(100).optional(),
  notes: z.string().max(500).optional().nullable()
})

export const WriteOffFiltersSchema = z.object({
  department_id: z.string().uuid().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  reason: z.string().optional(),
  product_id: z.string().uuid().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional()
})

export function validate(schema, data) {
  try {
    const result = schema.safeParse(data)
    if (result.success) {
      return { isValid: true, data: result.data }
    }
    const errors = result.error.issues?.map(e => `${e.path.join('.')}: ${e.message}`) || 
                   result.error.errors?.map(e => `${e.path.join('.')}: ${e.message}`) || []
    return { isValid: false, errors }
  } catch (error) {
    return { isValid: false, errors: [error.message] }
  }
}
