/**
 * Inventory Module - Zod Validation Schemas
 * 
 * Схемы валидации для продуктов, партий, категорий и сборов.
 */

import { z } from 'zod'

// ========================================
// Базовые схемы
// ========================================

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')

const positiveNumber = z.coerce.number().positive('Должно быть положительным числом')
const positiveInt = z.coerce.number().int().positive('Должно быть положительным целым числом')
const nonNegativeNumber = z.coerce.number().min(0, 'Не может быть отрицательным')
const uuidString = z.string().uuid('Должен быть валидный UUID')

// ========================================
// Статусы
// ========================================

export const BatchStatus = z.enum([
  'fresh',      // Свежий
  'expiring',   // Истекает
  'expired',    // Просрочен
  'collected'   // Собран
])

export const StorageType = z.enum([
  'refrigerated',   // Холодильник
  'frozen',         // Морозильник
  'dry',            // Сухое хранение
  'room_temp'       // Комнатная температура
])

export const Unit = z.enum([
  'kg',     // Килограммы
  'g',      // Граммы
  'l',      // Литры
  'ml',     // Миллилитры
  'pcs',    // Штуки
  'pack'    // Упаковки
])

// ========================================
// Продукты (Products)
// ========================================

/**
 * POST /api/products
 */
export const CreateProductSchema = z.object({
  name: z.string()
    .min(1, 'Название обязательно')
    .max(200, 'Название слишком длинное')
    .transform(v => v.trim()),

  categoryId: uuidString.optional().nullable(),

  departmentId: uuidString.optional().nullable(),
  unit: Unit.default('pcs'),

  storageType: StorageType.default('room_temp'),

  minStock: nonNegativeNumber.optional().default(0),

  barcode: z.string().max(50).optional().nullable(),

  description: z.string().max(1000).optional().nullable(),

  imageUrl: z.string().url().max(500).optional().nullable()
})

/**
 * PUT /api/products/:id
 */
export const UpdateProductSchema = CreateProductSchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'Необходимо указать хотя бы одно поле' }
)

// ========================================
// Партии (Batches)
// ========================================

/**
 * Базовая схема для batch (без refinement для использования в .omit())
 */
const BaseBatchSchema = z.object({
  // Можно указать либо productId, либо productName
  productId: uuidString.optional().nullable(),
  productName: z.string().max(200).optional().nullable(),

  // Категория (для создания/поиска продукта по имени)
  category: z.string().max(100).optional().nullable(),
  categoryId: uuidString.optional().nullable(),

  quantity: positiveNumber.optional().nullable().describe('Количество'),

  expiryDate: dateSchema.describe('Дата истечения срока'),

  productionDate: dateSchema.optional().nullable(),

  // Department (можно snake_case или camelCase)
  department: uuidString.optional().nullable(),
  departmentId: uuidString.optional().nullable(),

  supplierName: z.string()
    .max(200, 'Название поставщика слишком длинное')
    .transform(v => v.trim())
    .optional()
    .nullable(),

  batchNumber: z.string()
    .max(100, 'Номер партии слишком длинный')
    .optional()
    .nullable(),

  purchasePrice: nonNegativeNumber.optional().nullable(),

  notes: z.string().max(1000).optional().nullable()
})

/**
 * POST /api/batches
 * Поддерживает создание по productId (UUID) ИЛИ productName + category
 */
export const CreateBatchSchema = BaseBatchSchema.refine(
  data => data.productId || data.productName,
  { message: 'Необходимо указать productId или productName' }
)

/**
 * PUT /api/batches/:id
 */
export const UpdateBatchSchema = BaseBatchSchema
  .omit({ productId: true, productName: true })
  .partial()
  .extend({
    status: BatchStatus.optional()
  })
  .refine(
    data => Object.keys(data).length > 0,
    { message: 'Необходимо указать хотя бы одно поле' }
  )

// ========================================
// Категории (Categories)
// ========================================

/**
 * POST /api/categories
 */
export const CreateCategorySchema = z.object({
  name: z.string()
    .min(1, 'Название обязательно')
    .max(100, 'Название слишком длинное')
    .transform(v => v.trim()),

  description: z.string().max(500).optional().nullable(),

  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Цвет должен быть в формате HEX (#RRGGBB)')
    .optional()
    .nullable(),

  icon: z.string().max(50).optional().nullable(),

  parentId: uuidString.optional().nullable(),

  sortOrder: z.coerce.number().int().optional().default(0)
})

/**
 * PUT /api/categories/:id
 */
export const UpdateCategorySchema = CreateCategorySchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: 'Необходимо указать хотя бы одно поле' }
)

// ========================================
// Сборы (Collections)
// ========================================

export const CollectionType = z.enum([
  'write_off',    // Списание
  'sold',         // Продано
  'used',         // Использовано
  'donated',      // Пожертвовано
  'returned',     // Возврат
  'transferred'   // Перемещено
])

/**
 * POST /api/collections
 */
export const CreateCollectionSchema = z.object({
  batchId: uuidString.describe('ID партии'),

  quantity: positiveNumber.describe('Количество для сбора'),

  type: CollectionType.default('used'),

  reason: z.string()
    .max(500, 'Причина слишком длинная')
    .optional()
    .nullable(),

  notes: z.string().max(1000).optional().nullable()
})

/**
 * POST /api/batches/:id/collect (упрощённый сбор)
 */
export const QuickCollectSchema = z.object({
  quantity: positiveNumber,
  type: CollectionType.default('used'),
  reason: z.string().max(500).optional().nullable()
})

// ========================================
// Фильтры
// ========================================

/**
 * Query параметры для GET /api/batches
 */
export const BatchFiltersSchema = z.object({
  productId: uuidString.optional(),
  categoryId: uuidString.optional(),
  departmentId: uuidString.optional(),
  status: BatchStatus.optional(),

  expiringWithin: z.coerce.number().int().min(0).max(365).optional()
    .describe('Истекает в течение N дней'),

  expiredOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional(),

  minQuantity: nonNegativeNumber.optional(),

  search: z.string().max(100).optional(),

  sortBy: z.enum(['expiryDate', 'quantity', 'createdAt', 'productName']).default('expiryDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),

  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
})

/**
 * Query параметры для GET /api/products
 */
export const ProductFiltersSchema = z.object({
  categoryId: uuidString.optional(),
  departmentId: uuidString.optional(),
  search: z.string().max(100).optional(),

  hasStock: z.enum(['true', 'false']).transform(v => v === 'true').optional(),

  storageType: StorageType.optional(),

  sortBy: z.enum(['name', 'createdAt', 'stock']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),

  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50)
})

// ========================================
// Вспомогательные функции
// ========================================

/**
 * Универсальная функция валидации
 */
export function validate(schema, data) {
  const result = schema.safeParse(data)

  if (result.success) {
    return {
      isValid: true,
      errors: [],
      data: result.data
    }
  }

  // Zod v4 uses error.issues instead of error.errors
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

// ========================================
// Экспорт для обратной совместимости
// ========================================

export const validateCreateProduct = (data) => validate(CreateProductSchema, data)
export const validateUpdateProduct = (data) => validate(UpdateProductSchema, data)
export const validateCreateBatch = (data) => validate(CreateBatchSchema, data)
export const validateUpdateBatch = (data) => validate(UpdateBatchSchema, data)
export const validateCreateCategory = (data) => validate(CreateCategorySchema, data)
export const validateUpdateCategory = (data) => validate(UpdateCategorySchema, data)
export const validateCollection = (data) => validate(CreateCollectionSchema, data)
export const validateQuickCollect = (data) => validate(QuickCollectSchema, data)
export const validateBatchFilters = (query) => validate(BatchFiltersSchema, query)
export const validateProductFilters = (query) => validate(ProductFiltersSchema, query)
