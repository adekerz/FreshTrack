/**
 * Delivery Templates Validation Schemas
 */

import { z } from 'zod'

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  supplier: z.string().max(100).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    productId: z.string().uuid().optional(),
    product_id: z.string().uuid().optional(),
    quantity: z.number().positive().optional(),
    default_quantity: z.number().positive().optional(),
    expiryDate: z.string().optional(),
    shelf_life_days: z.number().optional(),
    product_name: z.string().optional()
  }).transform(item => ({
    productId: item.productId || item.product_id,
    quantity: item.quantity || item.default_quantity,
    expiryDate: item.expiryDate,
    shelf_life_days: item.shelf_life_days,
    product_name: item.product_name
  }))).optional(),
  schedule: z.object({}).passthrough().optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
})

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  supplier: z.string().max(100).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive().optional(),
    expiryDate: z.string().optional()
  })).optional(),
  schedule: z.object({}).passthrough().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  is_active: z.boolean().optional()
})

export const ApplyTemplateSchema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive().optional().default(1),
    expiryDate: z.string()
  })).min(1, 'At least one item is required'),
  departmentId: z.string().uuid().optional()
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
