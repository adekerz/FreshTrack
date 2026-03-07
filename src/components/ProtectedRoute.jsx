/**
 * Protected Route Component
 * Компонент для защиты маршрутов на основе аутентификации и ролей
 * Role system: SUPER_ADMIN, HOTEL_ADMIN, DEPARTMENT_MANAGER, STAFF
 */

import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModules } from '../context/ModuleContext'
import { Loader } from './ui'
import { Lock, ArrowRight } from 'lucide-react'

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
 * Оверлей с обратным отсчётом — показывается когда модуль отключается в реальном времени
 * пока пользователь находится на защищённой странице.
 */
function ModuleDisabledOverlay({ moduleCode, onRedirect }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onRedirect()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onRedirect])

  // Prettify module code
  const moduleName =
    moduleCode?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Module'

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-danger/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-danger" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Модуль отключён
        </h2>

        {/* Description */}
        <p className="text-muted-foreground text-sm mb-6">
          Администратор отключил доступ к модулю{' '}
          <span className="font-medium text-foreground">{moduleName}</span>. Вы
          будете перенаправлены на главную страницу.
        </p>

        {/* Countdown circle */}
        <div className="flex flex-col items-center gap-1 mb-6">
          <div className="w-16 h-16 rounded-full border-4 border-accent/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-accent">{countdown}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            секунд до перенаправления
          </p>
        </div>

        {/* Manual redirect */}
        <button
          onClick={onRedirect}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 transition-colors"
        >
          Перейти сейчас
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * ProtectedRoute - обёртка для защищённых маршрутов
 * @param {Object} props
 * @param {React.ReactNode} props.children - Дочерние компоненты
 * @param {string[]} props.allowedRoles - Массив разрешённых ролей (deprecated - use requiredPermission)
 * @param {string[]} props.allowedDepartments - Массив разрешённых отделов
 * @param {boolean} props.requireAdmin - Требуется роль admin (deprecated - use requiredPermission)
 * @param {string} props.requiredPermission - Требуемый permission (e.g., 'settings:read')
 * @param {string} props.requiredModule - Требуемый модуль (e.g., 'inventory', 'task_planner')
 * @param {string} props.redirectTo - Путь для редиректа при отказе доступа
 */
export default function ProtectedRoute({
  children,
  allowedRoles = null,
  allowedDepartments = null,
  requireAdmin = false,
  requiredPermission = null,
  requiredModule = null,
  redirectTo = '/login',
}) {
  const { user, isAuthenticated, loading, hasPermission } = useAuth()
  const {
    hasModule,
    loading: modulesLoading,
    recentlyDisabledModule,
    clearDisabledEvent,
  } = useModules()
  const location = useLocation()
  const navigate = useNavigate()

  // Track if this route's module was previously accessible (to detect real-time disable)
  const hadModuleAccessRef = useRef(null)
  const [showDisabledOverlay, setShowDisabledOverlay] = useState(false)

  useEffect(() => {
    if (!requiredModule || modulesLoading) return

    const currentlyHas = hasModule(requiredModule)

    // Detect transition: had access → lost access
    if (
      hadModuleAccessRef.current === true &&
      !currentlyHas &&
      recentlyDisabledModule?.module_code === requiredModule
    ) {
      setShowDisabledOverlay(true)
    }

    hadModuleAccessRef.current = currentlyHas
  }, [hasModule, requiredModule, modulesLoading, recentlyDisabledModule])

  const handleDisabledRedirect = () => {
    setShowDisabledOverlay(false)
    clearDisabledEvent()
    navigate('/', { replace: true })
  }

  // Показываем загрузку пока проверяется авторизация или модули
  if (loading || modulesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <Loader size="medium" aria-label="Проверка авторизации" />
          <p className="text-muted-foreground text-sm">
            Проверка авторизации...
          </p>
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
    if (
      !normalizedUserRole ||
      !normalizedAllowedRoles.includes(normalizedUserRole)
    ) {
      return <Navigate to="/" state={{ accessDenied: true }} replace />
    }
  }

  // Проверка разрешённых отделов (только для сотрудников, админ имеет доступ ко всем)
  if (
    allowedDepartments &&
    allowedDepartments.length > 0 &&
    !isAdmin(user?.role)
  ) {
    const userDepts = user?.departments || []
    const hasAccess = allowedDepartments.some((dept) =>
      userDepts.includes(dept)
    )

    if (!hasAccess) {
      return <Navigate to="/" state={{ accessDenied: true }} replace />
    }
  }

  // Module-based access check
  if (requiredModule && !hasModule(requiredModule)) {
    // If module was just disabled in real-time → show countdown overlay
    if (showDisabledOverlay) {
      return (
        <>
          {children}
          <ModuleDisabledOverlay
            moduleCode={requiredModule}
            onRedirect={handleDisabledRedirect}
          />
        </>
      )
    }
    // Otherwise silent redirect (no access, never had it or not tracking)
    return (
      <Navigate
        to="/"
        state={{ accessDenied: true, reason: 'module' }}
        replace
      />
    )
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
 * ModuleProtectedRoute - обёртка для маршрутов с проверкой доступа к модулю
 * @param {string} module - Required module code (e.g., 'inventory', 'task_planner')
 */
export function ModuleProtectedRoute({ children, module, redirectTo = '/' }) {
  return (
    <ProtectedRoute requiredModule={module} redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  )
}

/**
 * Хук для проверки прав доступа
 * Updated to use permission-based checks from AuthContext
 */
export function useAccessControl() {
  const { user, isAuthenticated, hasPermission, canManage, canPerformAction } =
    useAuth()

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
    return (
      user.departments?.includes(departmentId) ||
      user.department_id === departmentId ||
      false
    )
  }

  const hasAnyDepartmentAccess = (departmentIds) => {
    if (!isAuthenticated || !user) return false
    if (isAdmin(user.role)) return true
    return departmentIds.some(
      (dept) => user.departments?.includes(dept) || user.department_id === dept
    )
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
    canViewAllDepartments:
      hasPermission?.('departments:read') || checkIsAdmin(),
    canExportData: hasPermission?.('export:read') || checkIsAdmin(),
    canManageSettings: hasPermission?.('settings:manage') || checkIsAdmin(),
  }
}
