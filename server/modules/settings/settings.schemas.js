/**
 * Settings Module - Zod Validation Schemas
 * 
 * Схемы валидации для настроек системы.
 */

import { z } from 'zod'

// ========================================
// Базовые типы
// ========================================

export const SettingScope = z.enum([
  'system',      // Системные (SUPER_ADMIN only)
  'hotel',       // Уровень отеля
  'department',  // Уровень отдела
  'user'         // Пользовательские
])

export const SettingCategory = z.enum([
  'general',
  'notifications',
  'appearance',
  'inventory',
  'reports',
  'integrations',
  'security'
])

// ========================================
// Branding настройки
// ========================================

export const BrandingSettingsSchema = z.object({
  primaryColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Цвет должен быть в формате #RRGGBB')
    .optional(),
  
  secondaryColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  
  logoUrl: z.string().url().optional().nullable(),
  
  hotelName: z.string().max(200).optional(),
  
  footerText: z.string().max(500).optional(),
  
  customCss: z.string().max(10000).optional().nullable()
})

// ========================================
// Inventory настройки
// ========================================

export const InventorySettingsSchema = z.object({
  // Пороги истечения
  expiryWarningDays: z.number().int().min(1).max(365).default(7),
  expiryCriticalDays: z.number().int().min(1).max(30).default(3),
  
  // Порог низкого запаса
  lowStockThreshold: z.number().min(0).default(10),
  
  // Автоматический статус
  autoUpdateStatus: z.boolean().default(true),
  
  // FIFO
  fifoEnabled: z.boolean().default(true),
  
  // Единицы измерения по умолчанию
  defaultUnit: z.enum(['шт', 'кг', 'л', 'упак', 'порц']).default('шт')
})

// ========================================
// Notification настройки
// ========================================

export const NotificationSettingsSchema = z.object({
  // Email
  emailEnabled: z.boolean().default(true),
  emailDailyDigest: z.boolean().default(false),
  emailDigestTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .default('09:00'),
  
  // Telegram
  telegramEnabled: z.boolean().default(true),
  
  // Push
  pushEnabled: z.boolean().default(true),
  
  // In-app
  inAppEnabled: z.boolean().default(true),
  inAppSound: z.boolean().default(true),
  
  // Quiet hours
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional()
})

// ========================================
// Appearance настройки
// ========================================

export const AppearanceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['ru', 'en', 'kk']).default('ru'),
  dateFormat: z.enum(['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).default('DD.MM.YYYY'),
  timeFormat: z.enum(['24h', '12h']).default('24h'),
  timezone: z.string().default('Asia/Almaty'),
  compactMode: z.boolean().default(false)
})

// ========================================
// API Endpoints
// ========================================

/**
 * PUT /api/settings/user/:key
 */
export const SetUserSettingSchema = z.object({
  value: z.any()
})

/**
 * POST /api/settings/batch
 */
export const BatchUpdateSettingsSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1).max(100),
    value: z.any()
  })).min(1),
  
  scope: SettingScope.default('hotel')
})

/**
 * GET /api/settings query params
 */
export const SettingsQuerySchema = z.object({
  scope: SettingScope.optional(),
  category: SettingCategory.optional(),
  keys: z.string().optional() // comma-separated
})

/**
 * PUT /api/settings/:scope/:key
 */
export const UpdateSettingSchema = z.object({
  value: z.any(),
  departmentId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional()
})

/**
 * DELETE /api/settings/:scope/:key
 */
export const DeleteSettingSchema = z.object({
  departmentId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional()
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
// Экспорт валидаторов
// ========================================

export const validateBranding = (data) => validate(BrandingSettingsSchema, data)
export const validateInventorySettings = (data) => validate(InventorySettingsSchema, data)
export const validateNotificationSettings = (data) => validate(NotificationSettingsSchema, data)
export const validateAppearance = (data) => validate(AppearanceSettingsSchema, data)
export const validateBatchUpdate = (data) => validate(BatchUpdateSettingsSchema, data)
