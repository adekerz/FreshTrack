/**
 * Scheduled Exports Module - Zod Validation Schemas
 */

import { z } from 'zod'

// ========================================
// Базовые типы
// ========================================

const ScheduleTypeSchema = z.enum(['daily', 'weekly', 'monthly'])
const DeliveryMethodSchema = z.enum(['email', 'telegram', 'both'])
const RecipientTypeSchema = z.enum(['department'])
const TimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Время должно быть в формате HH:MM')

// ========================================
// Схемы для эндпоинтов
// ========================================

/**
 * POST /api/scheduled-exports
 */
export const CreateScheduledExportSchema = z
  .object({
    department_id: z.string().uuid('Невалидный ID отдела'),
    schedule_type: ScheduleTypeSchema,
    day_of_week: z.number().int().min(0).max(6).optional().nullable(),
    day_of_month: z.number().int().min(1).max(31).optional().nullable(),
    time: TimeSchema,
    timezone: z.string().max(50).optional().default('Asia/Almaty'),
    export_types: z
      .array(z.string().min(1))
      .min(1, 'Выберите хотя бы один тип экспорта'),
    export_formats: z
      .array(z.string().min(1))
      .optional()
      .default(['excel'])
      .transform((formats) =>
        formats.filter((f) => ['excel', 'csv', 'pdf'].includes(f))
      )
      .refine((formats) => formats.length > 0, {
        message: 'At least one supported format required (excel, csv or pdf)',
      }),
    filters: z.record(z.any()).optional().default({}),
    delivery_method: DeliveryMethodSchema,
    recipient_type: RecipientTypeSchema.optional().default('department'),
    email_override: z.preprocess(
      (val) => (val === '' || val == null ? null : val),
      z.string().email('Невалидный email').nullable().optional()
    ),
    telegram_chat_id_override: z.preprocess(
      (val) => (val === '' || val == null ? null : val),
      z.string().nullable().optional()
    ),
    download_pin: z.string().min(4, 'PIN must be at least 4 characters'),
    link_expiry_hours: z.number().int().min(1).max(720).optional().default(72),
  })
  .refine(
    (data) => {
      if (
        data.schedule_type === 'weekly' &&
        (data.day_of_week === null || data.day_of_week === undefined)
      ) {
        return false
      }
      return true
    },
    {
      message: 'day_of_week обязателен для еженедельного расписания',
      path: ['day_of_week'],
    }
  )
  .refine(
    (data) => {
      if (
        data.schedule_type === 'monthly' &&
        (data.day_of_month === null || data.day_of_month === undefined)
      ) {
        return false
      }
      return true
    },
    {
      message: 'day_of_month обязателен для ежемесячного расписания',
      path: ['day_of_month'],
    }
  )

/**
 * PUT /api/scheduled-exports/:id
 */
export const UpdateScheduledExportSchema = z.object({
  schedule_type: ScheduleTypeSchema.optional(),
  day_of_week: z.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.number().int().min(1).max(31).optional().nullable(),
  time: TimeSchema.optional(),
  timezone: z.string().max(50).optional(),
  export_types: z.array(z.string().min(1)).min(1).optional(),
  export_formats: z
    .array(z.string().min(1))
    .optional()
    .transform((formats) =>
      formats
        ? formats.filter((f) => ['excel', 'csv', 'pdf'].includes(f))
        : formats
    )
    .refine((formats) => !formats || formats.length > 0, {
      message: 'At least one supported format required (excel, csv or pdf)',
    }),
  filters: z.record(z.any()).optional().nullable(),
  delivery_method: DeliveryMethodSchema.optional(),
  recipient_type: RecipientTypeSchema.optional(),
  email_override: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.string().email('Невалидный email').nullable().optional()
  ),
  telegram_chat_id_override: z.preprocess(
    (val) => (val === '' || val == null ? null : val),
    z.string().nullable().optional()
  ),
  is_active: z.boolean().optional(),
  download_pin: z
    .string()
    .min(4, 'PIN must be at least 4 characters')
    .optional(),
  link_expiry_hours: z.number().int().min(1).max(720).optional(),
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
    errors: issues.map((err) => ({
      field: err.path?.join('.') || '',
      message: err.message,
      code: err.code,
    })),
    data: null,
  }
}
