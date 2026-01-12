/**
 * FIFO Collect Validation Schemas
 */

import { z } from 'zod'

export const CollectPreviewSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive').or(z.string().regex(/^\d+$/).transform(Number))
})

export const CollectSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive').or(z.string().regex(/^\d+$/).transform(Number)),
  reason: z.string().optional(),
  notes: z.string().max(500).optional()
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
