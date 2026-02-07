/**
 * Telegram Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/telegram/chats
 */
export const RegisterTelegramChatSchema = z.object({
  chatId: z.string().min(1, 'chatId обязателен'),
  chatTitle: z.string().max(200).optional().nullable(),
  hotelId: z.string().uuid('Невалидный ID отеля'),
  departmentId: z.string().uuid().optional().nullable()
})

/**
 * POST /api/telegram/test
 */
export const TestTelegramMessageSchema = z.object({
  chatId: z.string().optional().nullable()
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
