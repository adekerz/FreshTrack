import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import { PageLoader, FullscreenLoader, Loader } from './components/ui'

// Eager loading для критичных страниц
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

// Lazy loading для вторичных страниц (уменьшает initial bundle)
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const NotificationsHistoryPage = lazy(() => import('./pages/NotificationsHistoryPage'))
const CollectionHistoryPage = lazy(() => import('./pages/CollectionHistoryPage'))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))

// Suspense fallback — используем единый PageLoader
function SuspenseFallback() {
  return <PageLoader message="Загрузка страницы..." />
}

function App() {
  const { user, loading } = useAuth()

  // Check if user is pending approval
  const isPendingUser = user?.status === 'pending'

  // Показываем загрузку при инициализации — используем единый Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6" role="status" aria-live="polite">
          <Loader size="large" aria-label="Инициализация приложения" />
          <p className="text-accent font-serif text-xl">FreshTrack</p>
        </div>
      </div>
    )
  }

  // User not logged in - show auth pages
  if (!user) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  // User is pending approval - show only pending page
  if (isPendingUser) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          <Route path="*" element={<Navigate to="/pending-approval" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<SuspenseFallback />}>
          <Routes>
            {/* Общедоступные страницы (для всех авторизованных) */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Страницы с ограниченным доступом */}
            <Route
              path="/notifications/history"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']}>
                  <NotificationsHistoryPage />
                </ProtectedRoute>
              }
            />

            {/* Для администраторов и менеджеров отделов */}
            <Route
              path="/collection-history"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']}>
                  <CollectionHistoryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/statistics"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER']}>
                  <StatisticsPage />
                </ProtectedRoute>
              }
            />

            {/* Только для администраторов (аудит логи) */}
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  )
}

export default App
// test
