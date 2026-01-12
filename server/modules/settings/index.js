/**
 * Settings Module
 * 
 * Phase 7: Hierarchical Settings System
 * Приоритет: User → Department → Hotel → System → Default
 */

// Schemas
export * from './settings.schemas.js'

// Controller (Router)
export { default as settingsRouter } from './settings.controller.js'
