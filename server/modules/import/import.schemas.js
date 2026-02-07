/**
 * Import Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Вложенные схемы
// ========================================

const ImportProductItemSchema = z.object({
  name: z.string().min(1, 'Название товара обязательно').max(200),
  description: z.string().max(1000).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  category_name: z.string().max(100).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  min_quantity: z.number().min(0).optional().nullable(),
  max_quantity: z.number().min(0).optional().nullable(),
  reorder_point: z.number().min(0).optional().nullable(),
  storage_location: z.string().max(200).optional().nullable(),
  storage_conditions: z.string().max(500).optional().nullable(),
  default_expiry_days: z.number().int().min(1).max(3650).optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
})

const ImportBatchItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  product_sku: z.string().max(100).optional().nullable(),
  product_name: z.string().max(200).optional().nullable(),
  quantity: z.number().positive('Количество должно быть положительным'),
  production_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  batch_code: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable()
}).refine(data => {
  return data.product_id || data.product_sku || data.product_name
}, {
  message: 'Необходим product_id, product_sku или product_name'
})

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/import/products
 */
export const ImportProductsSchema = z.object({
  products: z.array(ImportProductItemSchema)
    .min(1, 'Массив товаров не может быть пустым')
    .max(1000, 'Максимум 1000 товаров за один импорт'),
  options: z.object({
    skip_duplicates: z.boolean().optional().default(true),
    create_categories: z.boolean().optional().default(false)
  }).optional().default({})
})

/**
 * POST /api/import/batches
 */
export const ImportBatchesSchema = z.object({
  batches: z.array(ImportBatchItemSchema)
    .min(1, 'Массив партий не может быть пустым')
    .max(500, 'Максимум 500 партий за один импорт')
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
