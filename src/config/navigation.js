/**
 * Централизованная конфигурация навигации
 * Используется в Sidebar.jsx и BottomNavigation.jsx
 * 
 * При изменении доступов - меняй ТОЛЬКО этот файл!
 * 
 * MIGRATION: Постепенно переходим от roles к requiredPermission/requiredCapability
 */

import {
  LayoutDashboard,
  Package,
  Bell,
  Calendar,
  BarChart3,
  ClipboardList,
  FileText,
  Settings
} from 'lucide-react'

/**
 * Роли с доступом к странице
 * null = доступно всем авторизованным пользователям
 * @deprecated Используй requiredPermission или requiredCapability вместо roles
 */
export const NAV_ROLES = {
  ALL: null,
  ADMINS_ONLY: ['SUPER_ADMIN', 'HOTEL_ADMIN'],
  MANAGERS_AND_UP: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER'],
}

/**
 * Основные пункты навигации (видны всегда в нижней панели)
 */
export const mainNavItems = [
  {
    id: 'dashboard',
    path: '/',
    icon: LayoutDashboard,
    labelKey: 'nav.dashboard',
    fallbackLabel: 'Главная',
    roles: NAV_ROLES.ALL
  },
  {
    id: 'inventory',
    path: '/inventory',
    icon: Package,
    labelKey: 'nav.inventory',
    fallbackLabel: 'Инвентарь',
    roles: NAV_ROLES.ALL,
    requiredPermission: 'products:read'
  },
  {
    id: 'notifications',
    path: '/notifications',
    icon: Bell,
    labelKey: 'nav.notifications',
    fallbackLabel: 'Уведомления',
    roles: NAV_ROLES.ALL,
    hasBadge: true // Показывает счётчик непрочитанных
  },
  {
    id: 'calendar',
    path: '/calendar',
    icon: Calendar,
    labelKey: 'nav.calendar',
    fallbackLabel: 'Календарь',
    roles: NAV_ROLES.ALL
  }
]

/**
 * Дополнительные пункты (в меню "Ещё" на мобильных, в группе "Отчёты" на десктопе)
 */
export const moreNavItems = [
  {
    id: 'statistics',
    path: '/statistics',
    icon: BarChart3,
    labelKey: 'nav.statistics',
    fallbackLabel: 'Статистика',
    roles: NAV_ROLES.MANAGERS_AND_UP,
    requiredCapability: 'canViewInventory', // New: use capabilities
    group: 'reports'
  },
  {
    id: 'collection-history',
    path: '/collection-history',
    icon: ClipboardList,
    labelKey: 'nav.collectionHistory',
    fallbackLabel: 'История сборов',
    roles: NAV_ROLES.MANAGERS_AND_UP,
    requiredPermission: 'collections:read',
    group: 'reports'
  },
  {
    id: 'audit-logs',
    path: '/audit-logs',
    icon: FileText,
    labelKey: 'nav.auditLogs',
    fallbackLabel: 'Журнал действий',
    roles: NAV_ROLES.ADMINS_ONLY,
    requiredCapability: 'canViewAuditLogs', // New: use capabilities
    group: 'reports'
  },
  {
    id: 'settings',
    path: '/settings',
    icon: Settings,
    labelKey: 'nav.settings',
    fallbackLabel: 'Настройки',
    roles: NAV_ROLES.ALL,
    group: 'system'
  }
]

/**
 * Проверяет, имеет ли пользователь доступ к пункту меню
 * Supports: requiredCapability, requiredPermission, roles (legacy)
 * @param {Object} item - пункт навигации
 * @param {string} userRole - роль пользователя (SUPER_ADMIN, HOTEL_ADMIN, etc.)
 * @param {Object} options - { capabilities, permissions, hasPermission }
 * @returns {boolean}
 */
export function hasNavAccess(item, userRole, options = {}) {
  if (!userRole) return false

  const { capabilities = {}, permissions = [], hasPermission } = options
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'HOTEL_ADMIN'

  // Priority 1: Check capability if specified
  if (item.requiredCapability) {
    // Admins bypass capability checks
    if (isAdmin) return true
    return capabilities[item.requiredCapability] === true
  }

  // Priority 2: Check permission if specified
  if (item.requiredPermission) {
    // Admins bypass permission checks
    if (isAdmin) return true
    // Use hasPermission function if provided
    if (hasPermission) {
      return hasPermission(item.requiredPermission)
    }
    // Fallback to array check
    return permissions.includes(item.requiredPermission) || permissions.includes('*')
  }

  // Priority 3: Legacy role-based check
  if (item.roles === null) return true // Доступно всем
  return item.roles.includes(userRole.toUpperCase())
}

/**
 * Фильтрует пункты навигации по роли/permissions пользователя
 * @param {Array} items - массив пунктов навигации
 * @param {string} userRole - роль пользователя
 * @param {Object} options - { capabilities, permissions, hasPermission }
 * @returns {Array}
 */
export function filterNavByRole(items, userRole, options = {}) {
  return items.filter(item => hasNavAccess(item, userRole, options))
}
