/**
 * Custom Content Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Базовые типы
// ========================================

export const CONTENT_KEYS = [
  'app_name', 'app_tagline', 'company_name', 'dashboard_title', 'welcome_message',
  'logo_url', 'logo_dark_url', 'favicon_url', 'primary_color', 'secondary_color',
  'accent_color', 'footer_text', 'support_email', 'support_phone'
]

const ContentKeySchema = z.enum(CONTENT_KEYS)

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * PUT /api/custom-content/:key
 */
export const UpdateContentValueSchema = z.object({
  value: z.any().refine(v => v !== undefined, { message: 'value обязателен' })
})

/**
 * PUT /api/custom-content (bulk)
 */
export const UpdateContentBulkSchema = z.object({
  content: z.record(z.string(), z.any())
    .refine(obj => {
      return Object.keys(obj).every(key => CONTENT_KEYS.includes(key))
    }, { message: 'Недопустимый ключ контента' })
    .refine(obj => Object.keys(obj).length > 0, { message: 'Объект content не может быть пустым' })
})

/**
 * Валидация параметра :key
 */
export const ContentKeyParamSchema = ContentKeySchema

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
