/**
 * Departments Validation Schemas
 * 
 * Zod схемы для валидации запросов управления департаментами.
 */

import { z } from 'zod'

// Создание департамента
export const CreateDepartmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  hotel_id: z.string().uuid('Invalid hotel ID').optional(),
  settings: z.object({}).passthrough().optional().nullable()
})

// Обновление департамента
export const UpdateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  settings: z.object({}).passthrough().optional().nullable(),
  is_active: z.boolean().optional()
})

/**
 * Валидация данных
 * @param {z.ZodSchema} schema - Zod схема
 * @param {unknown} data - Данные для валидации
 * @returns {{ isValid: boolean, data?: T, errors?: string[] }}
 */
export function validate(schema, data) {
  try {
    const result = schema.safeParse(data)
    if (result.success) {
      return { isValid: true, data: result.data }
    }
    // Zod v4 использует error.issues
    const errors = result.error.issues?.map(e => `${e.path.join('.')}: ${e.message}`) || 
                   result.error.errors?.map(e => `${e.path.join('.')}: ${e.message}`) || []
    return { isValid: false, errors }
  } catch (error) {
    return { isValid: false, errors: [error.message] }
  }
}
