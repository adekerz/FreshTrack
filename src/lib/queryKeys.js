/**
 * React Query Keys Factory
 * 
 * Централизованное управление ключами для queries
 * Обеспечивает типобезопасность и избегает дублирования
 * 
 * Паттерн: ['entity', ...identifiers, ...filters]
 * Примеры:
 * - ['batches', hotelId] - все партии отеля
 * - ['batches', hotelId, { departmentId }] - партии конкретного отдела
 * - ['batches', 'stats', hotelId] - статистика партий
 */

export const queryKeys = {
  // === BATCHES (партии) ===
  
  /**
   * Все партии для отеля
   * @param {string} hotelId - ID отеля
   * @param {Object} params - Дополнительные параметры (limit, offset, departmentId)
   */
  batches: (hotelId, params = {}) => {
    const baseKey = ['batches', hotelId]
    // Если есть фильтры, добавляем их как 3-й элемент
    return Object.keys(params).length > 0 ? [...baseKey, params] : baseKey
  },
  
  /**
   * Статистика партий для отеля
   * @param {string} hotelId - ID отеля
   */
  batchesStats: (hotelId) => ['batches', 'stats', hotelId],
  
  /**
   * Конкретная партия
   * @param {string} batchId - ID партии
   */
  batch: (batchId) => ['batches', 'detail', batchId],
  
  // === DEPARTMENTS (отделы) ===
  
  /**
   * Все отделы отеля
   * @param {string} hotelId - ID отеля
   */
  departments: (hotelId) => ['departments', hotelId],
  
  /**
   * Конкретный отдел
   * @param {string} departmentId - ID отдела
   */
  department: (departmentId) => ['departments', 'detail', departmentId],
  
  // === CATEGORIES (категории) ===
  
  /**
   * Все категории отеля
   * @param {string} hotelId - ID отеля
   */
  categories: (hotelId) => ['categories', hotelId],
  
  /**
   * Категории конкретного отдела
   * @param {string} hotelId - ID отеля
   * @param {string} departmentId - ID отдела
   */
  departmentCategories: (hotelId, departmentId) => [
    'categories',
    hotelId,
    { departmentId }
  ],
  
  // === PRODUCTS (товары) ===
  
  /**
   * Все товары отеля
   * @param {string} hotelId - ID отеля
   * @param {Object} params - Параметры пагинации (limit, offset)
   */
  products: (hotelId, params = {}) => {
    const baseKey = ['products', hotelId]
    return Object.keys(params).length > 0 ? [...baseKey, params] : baseKey
  },
  
  /**
   * Товары конкретного отдела
   * @param {string} hotelId - ID отеля
   * @param {string} departmentId - ID отдела
   */
  departmentProducts: (hotelId, departmentId) => [
    'products',
    hotelId,
    { departmentId }
  ],
  
  /**
   * Конкретный товар
   * @param {string} productId - ID товара
   */
  product: (productId) => ['products', 'detail', productId],
  
  // === DELIVERY TEMPLATES (шаблоны поставок) ===
  
  /**
   * Все шаблоны поставок
   * @param {string} hotelId - ID отеля (опционально для фильтрации)
   */
  deliveryTemplates: (hotelId = null) => 
    hotelId ? ['delivery-templates', hotelId] : ['delivery-templates'],
  
  /**
   * Конкретный шаблон поставки
   * @param {string} templateId - ID шаблона
   */
  deliveryTemplate: (templateId) => ['delivery-templates', 'detail', templateId],
  
  // === AUDIT (аудит) ===
  
  /**
   * Логи аудита
   * @param {string} hotelId - ID отеля
   * @param {Object} filters - Фильтры (entityType, entityId, action, etc.)
   */
  auditLogs: (hotelId, filters = {}) => {
    const baseKey = ['audit', hotelId]
    return Object.keys(filters).length > 0 ? [...baseKey, filters] : baseKey
  },
  
  // === SETTINGS (настройки) ===
  
  /**
   * Настройки отеля
   * @param {string} hotelId - ID отеля
   */
  hotelSettings: (hotelId) => ['settings', hotelId],
  
  /**
   * Глобальные настройки системы
   */
  systemSettings: () => ['settings', 'system'],
  
  // === USERS (пользователи) ===
  
  /**
   * Все пользователи отеля
   * @param {string} hotelId - ID отеля
   */
  hotelUsers: (hotelId) => ['users', hotelId],
  
  /**
   * Текущий пользователь
   */
  currentUser: () => ['users', 'me'],
  
  // === HOTELS (отели) - для SUPER_ADMIN ===
  
  /**
   * Все отели в системе
   */
  allHotels: () => ['hotels'],
  
  /**
   * Конкретный отель
   * @param {string} hotelId - ID отеля
   */
  hotel: (hotelId) => ['hotels', 'detail', hotelId]
}

/**
 * Helper для получения базового ключа (для invalidation)
 * @param {Array} queryKey - Полный ключ query
 * @returns {Array} - Базовый ключ для invalidation
 * 
 * @example
 * getBaseKey(['batches', 'hotel-1', { departmentId: 'dept-1' }]) // ['batches', 'hotel-1']
 */
export const getBaseKey = (queryKey) => {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return []
  // Берем первые 2 элемента для большинства ключей
  return queryKey.slice(0, 2)
}

/**
 * Helper для инвалидации всех queries конкретной сущности
 * @param {QueryClient} queryClient - React Query client
 * @param {string} entity - Название сущности (batches, products, etc.)
 * @param {string} hotelId - ID отеля (опционально)
 */
export const invalidateEntity = (queryClient, entity, hotelId = null) => {
  const queryKey = hotelId ? [entity, hotelId] : [entity]
  return queryClient.invalidateQueries({ queryKey })
}
