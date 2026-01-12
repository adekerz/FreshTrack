/**
 * Reports Validation Schemas
 * 
 * Zod schemas для валидации входящих данных reports endpoints.
 */

import { z } from 'zod'

/**
 * Валидатор схемы
 */
export const validate = (schema, data) => {
  const result = schema.safeParse(data)
  
  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
    }
  }
  
  return {
    isValid: true,
    data: result.data
  }
}

/**
 * Схема для query параметров статистики
 */
export const StatisticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  locale: z.enum(['ru', 'en', 'kk']).default('ru'),
  trend_days: z.coerce.number().min(1).max(365).optional()
})

/**
 * Схема для query параметров inventory report
 */
export const InventoryReportQuerySchema = z.object({
  department_id: z.coerce.number().optional(),
  category_id: z.coerce.number().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(50),
  locale: z.enum(['ru', 'en', 'kk']).default('ru')
})

/**
 * Схема для query параметров expiry report
 */
export const ExpiryReportQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  department_id: z.coerce.number().optional(),
  locale: z.enum(['ru', 'en', 'kk']).default('ru')
})

/**
 * Схема для query параметров write-offs report
 */
export const WriteOffsReportQuerySchema = z.object({
  department_id: z.coerce.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  reason: z.string().optional()
})

/**
 * Схема для query параметров activity report
 */
export const ActivityReportQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  user_id: z.coerce.number().optional(),
  action: z.string().optional(),
  entity_type: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100)
})

/**
 * Схема для query параметров calendar report
 */
export const CalendarReportQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  department_id: z.coerce.number().optional(),
  category_id: z.coerce.number().optional(),
  locale: z.enum(['ru', 'en', 'kk']).default('ru')
})

/**
 * Схема для query параметров dashboard
 */
export const DashboardQuerySchema = z.object({
  department_id: z.coerce.number().optional()
})

// Экспорт валидаторов
export const validateStatisticsQuery = (data) => validate(StatisticsQuerySchema, data)
export const validateInventoryQuery = (data) => validate(InventoryReportQuerySchema, data)
export const validateExpiryQuery = (data) => validate(ExpiryReportQuerySchema, data)
export const validateWriteOffsQuery = (data) => validate(WriteOffsReportQuerySchema, data)
export const validateActivityQuery = (data) => validate(ActivityReportQuerySchema, data)
export const validateCalendarQuery = (data) => validate(CalendarReportQuerySchema, data)
export const validateDashboardQuery = (data) => validate(DashboardQuerySchema, data)
