/**
 * Notifications Module
 * 
 * Модуль уведомлений: правила, отправка, история.
 * 
 * Структура:
 * - notifications.schemas.js - Zod схемы валидации
 * - notifications.controller.js - HTTP обработчики
 */

// Zod Schemas
export * from './notifications.schemas.js'

// Controller (новый)
export { default as notificationsRouter } from './notifications.controller.js'

// Legacy validation (для обратной совместимости)
export * from './notifications.validation.js'
