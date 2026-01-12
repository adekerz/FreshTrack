/**
 * Централизованная конфигурация навигации
 * Используется в Sidebar.jsx и BottomNavigation.jsx
 * 
 * При изменении доступов - меняй ТОЛЬКО этот файл!
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
    roles: NAV_ROLES.ALL
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
    group: 'reports'
  },
  {
    id: 'collection-history',
    path: '/collection-history',
    icon: ClipboardList,
    labelKey: 'nav.collectionHistory',
    fallbackLabel: 'История сборов',
    roles: NAV_ROLES.MANAGERS_AND_UP,
    group: 'reports'
  },
  {
    id: 'audit-logs',
    path: '/audit-logs',
    icon: FileText,
    labelKey: 'nav.auditLogs',
    fallbackLabel: 'Журнал действий',
    roles: NAV_ROLES.ADMINS_ONLY,
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
 * @param {Object} item - пункт навигации
 * @param {string} userRole - роль пользователя (SUPER_ADMIN, HOTEL_ADMIN, etc.)
 * @returns {boolean}
 */
export function hasNavAccess(item, userRole) {
  if (!userRole) return false
  if (item.roles === null) return true // Доступно всем
  return item.roles.includes(userRole.toUpperCase())
}

/**
 * Фильтрует пункты навигации по роли пользователя
 * @param {Array} items - массив пунктов навигации
 * @param {string} userRole - роль пользователя
 * @returns {Array}
 */
export function filterNavByRole(items, userRole) {
  return items.filter(item => hasNavAccess(item, userRole))
}
