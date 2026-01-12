/**
 * Server Shared Module
 * 
 * Общие утилиты, middleware, сервисы для всех модулей.
 * 
 * @example
 * import { authMiddleware, requirePermission } from './shared/middleware'
 * import { AuditService, sseManager } from './shared/services'
 * import { getUserById, logAudit } from './shared/database'
 */

export * from './middleware/index.js'
export * from './database/index.js'
export * from './services/index.js'
