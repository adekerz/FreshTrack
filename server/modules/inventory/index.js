/**
 * Inventory Module
 * 
 * Модуль управления инвентарём: продукты, партии, категории, сборы.
 * 
 * Структура:
 * - inventory.schemas.js - Zod схемы валидации
 * - inventory.controller.js - HTTP обработчики (новый)
 * - inventory.validation.js - legacy валидация (deprecated)
 */

// Controller (Router) - использовать этот
export { default as inventoryRouter } from './inventory.controller.js'

// Zod Schemas
export * from './inventory.schemas.js'

// Legacy validation (deprecated)
export * from './inventory.validation.js'

// Service exports (TODO: after migration)
// export * from './inventory.service.js'

// Backward compatibility - re-export existing routes
// These will be replaced after full migration
export const batchesRoutes = () => import('../../routes/batches.js')
export const productsRoutes = () => import('../../routes/products.js')
export const categoriesRoutes = () => import('../../routes/categories.js')
export const collectionsRoutes = () => import('../../routes/collections.js')
