/**
 * Collections Validation Schemas
 */

import { z } from 'zod'

export const CreateCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  product_ids: z.array(z.string().uuid()).optional()
})

export const UpdateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional()
})

export const AddProductSchema = z.object({
  product_id: z.string().uuid('Invalid product ID')
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
