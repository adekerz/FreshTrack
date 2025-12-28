/**
 * Protected Route Component
 * Компонент для защиты маршрутов на основе аутентификации и ролей
 * Updated for new role system: SUPER_ADMIN, HOTEL_ADMIN, STAFF
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Нормализует роль пользователя к верхнему регистру
 */
const normalizeRole = (role) => {
  if (!role) return null
  return role.toUpperCase()
}

/**
 * Проверяет является ли пользователь админом (SUPER_ADMIN или HOTEL_ADMIN)
 */
const isAdmin = (role) => {
  const normalized = normalizeRole(role)
  return normalized === 'SUPER_ADMIN' || normalized === 'HOTEL_ADMIN'
}

/**
 * Проверяет является ли пользователь супер-админом
 */
const isSuperAdmin = (role) => {
  return normalizeRole(role) === 'SUPER_ADMIN'
}

/**
 * ProtectedRoute - обёртка для защищённых маршрутов
 * @param {Object} props
 * @param {React.ReactNode} props.children - Дочерние компоненты
 * @param {string[]} props.allowedRoles - Массив разрешённых ролей (deprecated - use requiredPermission)
 * @param {string[]} props.allowedDepartments - Массив разрешённых отделов
 * @param {boolean} props.requireAdmin - Требуется роль admin (deprecated - use requiredPermission)
 * @param {string} props.requiredPermission - Требуемый permission (e.g., 'settings:read')
 * @param {string} props.redirectTo - Путь для редиректа при отказе доступа
 */
export default function ProtectedRoute({
  children,
  allowedRoles = null,
  allowedDepartments = null,
  requireAdmin = false,
  requiredPermission = null,
  redirectTo = '/login'
}) {
  const { user, isAuthenticated, loading, hasPermission } = useAuth()
  const location = useLocation()

  // Показываем загрузку пока проверяется авторизация
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="loader loader-md">
            <div className="cell d-0" />
            <div className="cell d-1" />
            <div className="cell d-2" />
            <div className="cell d-1" />
            <div className="cell d-2" />
            <div className="cell d-3" />
            <div className="cell d-2" />
            <div className="cell d-3" />
            <div className="cell d-4" />
          </div>
          <p className="text-muted-foreground text-sm">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  // Если не авторизован - редирект на страницу входа
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // Permission-based access check (preferred method)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    // Fallback: allow admins for backward compatibility
    if (!isAdmin(user?.role)) {
      return <Navigate to="/" state={{ accessDenied: true }} replace />
    }
  }

  // Проверка роли admin если требуется (deprecated - use requiredPermission)
  if (requireAdmin && !isAdmin(user?.role)) {
    return <Navigate to="/" state={{ accessDenied: true }} replace />
  }

  // Проверка разрешённых ролей
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedUserRole = normalizeRole(user?.role)
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole)
    if (!normalizedUserRole || !normalizedAllowedRoles.includes(normalizedUserRole)) {
      return <Navigate to="/" state={{ accessDenied: true }} replace />
    }
  }

  // Проверка разрешённых отделов (только для сотрудников, админ имеет доступ ко всем)
  if (allowedDepartments && allowedDepartments.length > 0 && !isAdmin(user?.role)) {
    const userDepts = user?.departments || []
    const hasAccess = allowedDepartments.some((dept) => userDepts.includes(dept))

    if (!hasAccess) {
      return <Navigate to="/" state={{ accessDenied: true }} replace />
    }
  }

  return children
}

/**
 * AdminRoute - обёртка для маршрутов только для администраторов
 */
export function AdminRoute({ children, redirectTo = '/' }) {
  return (
    <ProtectedRoute requireAdmin redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  )
}

/**
 * DepartmentRoute - обёртка для маршрутов с доступом к определённым отделам
 */
export function DepartmentRoute({ children, departments, redirectTo = '/' }) {
  return (
    <ProtectedRoute allowedDepartments={departments} redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  )
}

/**
 * RoleRoute - обёртка для маршрутов с доступом к определённым ролям
 * @deprecated Prefer using PermissionRoute for granular access control
 */
export function RoleRoute({ children, roles, redirectTo = '/' }) {
  return (
    <ProtectedRoute allowedRoles={roles} redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  )
}

/**
 * PermissionRoute - обёртка для маршрутов с проверкой permission
 * @param {string} permission - Required permission (e.g., 'settings:read', 'audit:read')
 */
export function PermissionRoute({ children, permission, redirectTo = '/' }) {
  return (
    <ProtectedRoute requiredPermission={permission} redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  )
}

/**
 * Хук для проверки прав доступа
 * Updated to use permission-based checks from AuthContext
 */
export function useAccessControl() {
  const { user, isAuthenticated, hasPermission, canManage, canPerformAction } = useAuth()

  const hasRole = (role) => {
    if (!isAuthenticated || !user) return false
    return normalizeRole(user.role) === normalizeRole(role)
  }

  const hasAnyRole = (roles) => {
    if (!isAuthenticated || !user) return false
    const normalizedUserRole = normalizeRole(user.role)
    return roles.map(normalizeRole).includes(normalizedUserRole)
  }

  const hasDepartmentAccess = (departmentId) => {
    if (!isAuthenticated || !user) return false
    if (isAdmin(user.role)) return true
    return user.departments?.includes(departmentId) || user.department_id === departmentId || false
  }

  const hasAnyDepartmentAccess = (departmentIds) => {
    if (!isAuthenticated || !user) return false
    if (isAdmin(user.role)) return true
    return departmentIds.some((dept) => user.departments?.includes(dept) || user.department_id === dept)
  }

  const checkIsSuperAdmin = () => isSuperAdmin(user?.role)
  const checkIsAdmin = () => isAdmin(user?.role)
  const checkIsStaff = () => normalizeRole(user?.role) === 'STAFF'

  return {
    user,
    isAuthenticated,
    hasRole,
    hasAnyRole,
    hasDepartmentAccess,
    hasAnyDepartmentAccess,
    hasPermission,
    canManage,
    canPerformAction,
    isSuperAdmin: checkIsSuperAdmin,
    isAdmin: checkIsAdmin,
    isHotelAdmin: () => normalizeRole(user?.role) === 'HOTEL_ADMIN',
    isStaff: checkIsStaff,
    // Permission-based access checks (preferred)
    canManageUsers: hasPermission?.('users:manage') || checkIsAdmin(),
    canViewAllDepartments: hasPermission?.('departments:read') || checkIsAdmin(),
    canExportData: hasPermission?.('export:read') || checkIsAdmin(),
    canManageSettings: hasPermission?.('settings:manage') || checkIsAdmin()
  }
}
