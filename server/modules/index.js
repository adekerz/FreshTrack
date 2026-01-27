/**
 * Server Modules Index
 * 
 * Barrel export для всех серверных модулей.
 * 
 * Структура модуля:
 * modules/
 *   feature/
 *     feature.schemas.js     - Zod валидация
 *     feature.service.js     - Бизнес-логика (опционально)
 *     feature.controller.js  - HTTP обработчики
 *     index.js               - Public API модуля
 */

// Auth module
export * as auth from './auth/index.js'
export { authRouter } from './auth/index.js'

// Inventory module
export * as inventory from './inventory/index.js'
export { inventoryRouter } from './inventory/index.js'

// Notifications module
export * as notifications from './notifications/index.js'
export { notificationsRouter } from './notifications/index.js'

// Settings module
export * as settings from './settings/index.js'
export { settingsRouter } from './settings/index.js'

// Reports module
export * as reports from './reports/index.js'
export { reportsRouter } from './reports/index.js'

// Hotels module
export { hotelsController } from './hotels/index.js'

// Departments module
export { departmentsController } from './departments/index.js'

// Collections module
export { collectionsController } from './collections/index.js'

// FIFO Collect module
export { fifoCollectController } from './fifo-collect/index.js'

// Write-offs module
export { writeOffsController } from './write-offs/index.js'

// Audit module
export { auditController } from './audit/index.js'

// Delivery Templates module
export { deliveryTemplatesController } from './delivery-templates/index.js'

// Notification Rules module
export { notificationRulesController } from './notification-rules/index.js'

// Custom Content module
export { customContentController } from './custom-content/index.js'

// Department Settings module
export { departmentSettingsController } from './department-settings/index.js'

// Health module
export { healthController } from './health/index.js'

// Import module
export { importController } from './import/index.js'

// Export module
export { exportController } from './export/index.js'

// Telegram module
export { telegramController } from './telegram/index.js'

// Events (SSE) module
export { eventsController } from './events/index.js'

// MARSHA Codes module
export { marshaCodesController } from './marsha-codes/index.js'

// GDPR module
export { gdprController } from './gdpr/index.js'
