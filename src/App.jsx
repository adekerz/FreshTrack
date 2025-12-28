import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'

// Eager loading для критичных страниц
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

// Lazy loading для вторичных страниц (уменьшает initial bundle)
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const NotificationsHistoryPage = lazy(() => import('./pages/NotificationsHistoryPage'))
const CollectionHistoryPage = lazy(() => import('./pages/CollectionHistoryPage'))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-muted border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      </div>
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()

  // Показываем загрузку при инициализации
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="loader loader-lg">
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
          <p className="text-accent font-serif text-xl">FreshTrack</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<PageLoader />}>
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
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN']}>
                  <NotificationsHistoryPage />
                </ProtectedRoute>
              }
            />

            {/* Только для администраторов */}
            <Route
              path="/collection-history"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN']}>
                  <CollectionHistoryPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/statistics"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN']}>
                  <StatisticsPage />
                </ProtectedRoute>
              }
            />

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