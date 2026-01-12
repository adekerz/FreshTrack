/**
 * Auth Module
 * 
 * Модуль авторизации: регистрация, логин, токены, permissions.
 * 
 * Структура:
 * - auth.schemas.js - Zod схемы валидации
 * - auth.service.js - бизнес-логика
 * - auth.controller.js - HTTP обработчики (новый)
 * - auth.validation.js - legacy валидация (deprecated)
 */

// Controller (Router) - использовать этот
 export { default as authRouter } from './auth.controller.js'

// Zod Schemas
export * from './auth.schemas.js'

// Service
export { AuthService, ServiceResult } from './auth.service.js'

// Legacy validation (deprecated)
export * from './auth.validation.js'

// Legacy routes (deprecated - используйте authRouter)
export const authRoutes = () => import('../../routes/auth.js')
