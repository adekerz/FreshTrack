/**
 * Routes Configuration
 * 
 * Централизованная конфигурация роутов с lazy loading.
 * Используется для code splitting и типобезопасности.
 */

import { lazy, ComponentType } from 'react'

// ========================================
// Types
// ========================================

export interface RouteConfig {
  path: string
  component: ComponentType
  
  // Доступ
  isPublic?: boolean
  roles?: string[] | null  // null = все роли
  
  // SEO & UX
  title?: string
  description?: string
  
  // Layout
  showInNav?: boolean
  icon?: string
  
  // Loading
  preload?: boolean  // Предзагрузка при наведении
}

// ========================================
// Lazy Components с предзагрузкой
// ========================================

// Критичные страницы (eager loading)
export { default as LoginPage } from '../pages/LoginPage'
export { default as DashboardPage } from '../pages/DashboardPage'

// Lazy pages с возможностью предзагрузки
export const RegisterPage = lazy(() => import('../pages/RegisterPage'))
export const PendingApprovalPage = lazy(() => import('../pages/PendingApprovalPage'))
export const InventoryPage = lazy(() => import('../pages/InventoryPage'))
export const NotificationsPage = lazy(() => import('../pages/NotificationsPage'))
export const NotificationsHistoryPage = lazy(() => import('../pages/NotificationsHistoryPage'))
export const CollectionHistoryPage = lazy(() => import('../pages/CollectionHistoryPage'))
export const StatisticsPage = lazy(() => import('../pages/StatisticsPage'))
export const SettingsPage = lazy(() => import('../pages/SettingsPage'))
export const CalendarPage = lazy(() => import('../pages/CalendarPage'))
export const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage'))

// ========================================
// Preload функции для hover prefetch
// ========================================

export const preloadPages = {
  inventory: () => import('../pages/InventoryPage'),
  notifications: () => import('../pages/NotificationsPage'),
  statistics: () => import('../pages/StatisticsPage'),
  settings: () => import('../pages/SettingsPage'),
  calendar: () => import('../pages/CalendarPage'),
  collectionHistory: () => import('../pages/CollectionHistoryPage'),
  auditLogs: () => import('../pages/AuditLogsPage'),
}

// ========================================
// Route Configurations
// ========================================

export const publicRoutes: RouteConfig[] = [
  {
    path: '/login',
    component: lazy(() => import('../pages/LoginPage')),
    isPublic: true,
    title: 'Вход'
  },
  {
    path: '/register',
    component: RegisterPage,
    isPublic: true,
    title: 'Регистрация'
  },
  {
    path: '/pending-approval',
    component: PendingApprovalPage,
    isPublic: true,
    title: 'Ожидание подтверждения'
  }
]

export const protectedRoutes: RouteConfig[] = [
  {
    path: '/',
    component: lazy(() => import('../pages/DashboardPage')),
    title: 'Главная',
    showInNav: true,
    icon: 'home',
    preload: true
  },
  {
    path: '/inventory',
    component: InventoryPage,
    title: 'Инвентарь',
    showInNav: true,
    icon: 'package',
    preload: true
  },
  {
    path: '/calendar',
    component: CalendarPage,
    title: 'Календарь',
    showInNav: true,
    icon: 'calendar'
  },
  {
    path: '/notifications',
    component: NotificationsPage,
    title: 'Уведомления',
    showInNav: true,
    icon: 'bell'
  },
  {
    path: '/notifications/history',
    component: NotificationsHistoryPage,
    title: 'История уведомлений',
    roles: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'MANAGER']
  },
  {
    path: '/collection-history',
    component: CollectionHistoryPage,
    title: 'История сборов',
    showInNav: true,
    icon: 'history'
  },
  {
    path: '/statistics',
    component: StatisticsPage,
    title: 'Статистика',
    showInNav: true,
    icon: 'bar-chart',
    roles: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'MANAGER', 'DEPARTMENT_MANAGER']
  },
  {
    path: '/settings',
    component: SettingsPage,
    title: 'Настройки',
    showInNav: true,
    icon: 'settings'
  },
  {
    path: '/audit-logs',
    component: AuditLogsPage,
    title: 'Журнал аудита',
    roles: ['SUPER_ADMIN', 'HOTEL_ADMIN']
  }
]

// ========================================
// Helpers
// ========================================

/**
 * Проверка доступа к роуту по роли
 */
export function canAccessRoute(route: RouteConfig, userRole: string): boolean {
  if (route.isPublic) return true
  if (!route.roles) return true  // null = все авторизованные
  return route.roles.includes(userRole)
}

/**
 * Получить роуты для пользователя
 */
export function getRoutesForRole(userRole: string): RouteConfig[] {
  return protectedRoutes.filter(route => canAccessRoute(route, userRole))
}

/**
 * Предзагрузка страницы при наведении
 */
export function preloadPage(pageName: keyof typeof preloadPages): void {
  const preloader = preloadPages[pageName]
  if (preloader) {
    preloader()
  }
}
