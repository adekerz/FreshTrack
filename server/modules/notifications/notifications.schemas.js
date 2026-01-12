/**
 * Notifications Module - Zod Validation Schemas
 * 
 * Схемы валидации для уведомлений, правил и настроек.
 */

import { z } from 'zod'

// ========================================
// Базовые типы
// ========================================

export const NotificationType = z.enum([
  'expiry_warning',     // Предупреждение об истечении срока
  'expiry_critical',    // Критическое: срок истёк
  'low_stock',          // Низкий запас
  'collection_reminder', // Напоминание о сборе
  'report_ready',       // Отчёт готов
  'system'              // Системное уведомление
])

export const NotificationChannel = z.enum([
  'in_app',     // В приложении
  'email',      // Email
  'telegram',   // Telegram
  'push'        // Push-уведомления
])

export const NotificationPriority = z.enum([
  'low',
  'medium', 
  'high',
  'critical'
])

export const NotificationStatus = z.enum([
  'unread',
  'read',
  'archived',
  'dismissed'
])

// ========================================
// Правила уведомлений (Notification Rules)
// ========================================

/**
 * POST /api/notification-rules
 */
export const CreateNotificationRuleSchema = z.object({
  name: z.string()
    .min(1, 'Название обязательно')
    .max(200, 'Название слишком длинное')
    .transform(v => v.trim()),
  
  type: NotificationType,
  
  isActive: z.boolean().default(true),
  
  // Условия срабатывания
  conditions: z.object({
    // Для expiry_warning/expiry_critical
    daysBeforeExpiry: z.number().int().min(0).max(365).optional(),
    
    // Для low_stock  
    minStockThreshold: z.number().min(0).optional(),
    
    // Фильтры
    categoryIds: z.array(z.number().int().positive()).optional(),
    productIds: z.array(z.number().int().positive()).optional(),
    departmentIds: z.array(z.number().int().positive()).optional()
  }).optional().default({}),
  
  // Каналы доставки
  channels: z.array(NotificationChannel).min(1, 'Выберите хотя бы один канал'),
  
  // Расписание
  schedule: z.object({
    // Время отправки (HH:MM)
    sendAt: z.string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Время должно быть в формате HH:MM')
      .optional(),
    
    // Дни недели (0-6, 0 = воскресенье)
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    
    // Частота (в минутах)
    frequencyMinutes: z.number().int().min(5).max(10080).optional()
  }).optional().default({}),
  
  // Получатели
  recipients: z.object({
    // Конкретные пользователи
    userIds: z.array(z.number().int().positive()).optional(),
    
    // Роли
    roles: z.array(z.string()).optional(),
    
    // Все пользователи отдела
    allDepartmentUsers: z.boolean().optional(),
    
    // Все пользователи отеля
    allHotelUsers: z.boolean().optional()
  }).optional().default({}),
  
  // Шаблон сообщения
  messageTemplate: z.string().max(2000).optional().nullable(),
  
  // Приоритет
  priority: NotificationPriority.default('medium')
})

/**
 * PUT /api/notification-rules/:id
 */
export const UpdateNotificationRuleSchema = CreateNotificationRuleSchema
  .partial()
  .refine(
    data => Object.keys(data).length > 0,
    { message: 'Необходимо указать хотя бы одно поле' }
  )

// ========================================
// Настройки уведомлений пользователя
// ========================================

/**
 * PUT /api/users/:id/notification-settings
 */
export const UserNotificationSettingsSchema = z.object({
  // Включённые каналы
  enabledChannels: z.array(NotificationChannel).optional(),
  
  // Настройки по типам
  typeSettings: z.record(
    NotificationType,
    z.object({
      enabled: z.boolean(),
      channels: z.array(NotificationChannel).optional()
    })
  ).optional(),
  
  // Email для уведомлений (может отличаться от основного)
  notificationEmail: z.string().email().optional().nullable(),
  
  // Telegram Chat ID
  telegramChatId: z.string().max(50).optional().nullable(),
  
  // Тихие часы
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional()
  }).optional(),
  
  // Сводка вместо отдельных уведомлений
  digestMode: z.object({
    enabled: z.boolean(),
    frequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
    sendAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional()
  }).optional()
})

// ========================================
// Отправка уведомлений
// ========================================

/**
 * POST /api/notifications/send (тестовое уведомление)
 */
export const SendTestNotificationSchema = z.object({
  type: NotificationType.default('system'),
  channel: NotificationChannel,
  
  title: z.string()
    .min(1, 'Заголовок обязателен')
    .max(200, 'Заголовок слишком длинный'),
  
  message: z.string()
    .min(1, 'Сообщение обязательно')
    .max(2000, 'Сообщение слишком длинное'),
  
  // Получатель (если не указан — текущий пользователь)
  userId: z.number().int().positive().optional()
})

/**
 * POST /api/notifications/broadcast (массовая рассылка)
 */
export const BroadcastNotificationSchema = z.object({
  type: NotificationType.default('system'),
  channels: z.array(NotificationChannel).min(1),
  
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  
  // Фильтры получателей
  recipientFilter: z.object({
    hotelId: z.number().int().positive().optional(),
    departmentId: z.number().int().positive().optional(),
    roles: z.array(z.string()).optional(),
    userIds: z.array(z.number().int().positive()).optional()
  }).optional(),
  
  priority: NotificationPriority.default('medium'),
  
  // Запланировать на будущее
  scheduledAt: z.string().datetime().optional()
})

// ========================================
// Фильтры
// ========================================

/**
 * Query параметры для GET /api/notifications
 */
export const NotificationFiltersSchema = z.object({
  type: NotificationType.optional(),
  status: NotificationStatus.optional(),
  priority: NotificationPriority.optional(),
  
  unreadOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  
  // Диапазон дат
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  
  search: z.string().max(100).optional(),
  
  sortBy: z.enum(['createdAt', 'priority', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

/**
 * Пометка уведомлений как прочитанных
 */
export const MarkNotificationsSchema = z.object({
  notificationIds: z.array(z.number().int().positive()).min(1),
  status: z.enum(['read', 'archived', 'dismissed'])
})

// ========================================
// Telegram интеграция
// ========================================

/**
 * POST /api/telegram/link
 */
export const LinkTelegramSchema = z.object({
  code: z.string()
    .length(6, 'Код должен быть 6 символов')
    .regex(/^[A-Z0-9]+$/, 'Код должен содержать только буквы и цифры')
})

/**
 * Webhook от Telegram
 */
export const TelegramWebhookSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional()
    }),
    chat: z.object({
      id: z.number(),
      type: z.enum(['private', 'group', 'supergroup', 'channel'])
    }),
    date: z.number(),
    text: z.string().optional()
  }).optional(),
  callback_query: z.object({
    id: z.string(),
    from: z.object({
      id: z.number()
    }),
    data: z.string()
  }).optional()
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
  
  return {
    isValid: false,
    errors: result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    })),
    data: null
  }
}

// ========================================
// Экспорт для обратной совместимости
// ========================================

export const validateNotificationRule = (data) => validate(CreateNotificationRuleSchema, data)
export const validateUpdateNotificationRule = (data) => validate(UpdateNotificationRuleSchema, data)
export const validateUserNotificationSettings = (data) => validate(UserNotificationSettingsSchema, data)
export const validateTestNotification = (data) => validate(SendTestNotificationSchema, data)
export const validateBroadcastNotification = (data) => validate(BroadcastNotificationSchema, data)
export const validateNotificationFilters = (query) => validate(NotificationFiltersSchema, query)
export const validateMarkNotifications = (data) => validate(MarkNotificationsSchema, data)
export const validateLinkTelegram = (data) => validate(LinkTelegramSchema, data)
export const validateTelegramWebhook = (data) => validate(TelegramWebhookSchema, data)
