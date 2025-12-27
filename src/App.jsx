import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import InventoryPage from './pages/InventoryPage'
import NotificationsPage from './pages/NotificationsPage'
import NotificationsHistoryPage from './pages/NotificationsHistoryPage'
import CollectionHistoryPage from './pages/CollectionHistoryPage'
import StatisticsPage from './pages/StatisticsPage'
import SettingsPage from './pages/SettingsPage'
import CalendarPage from './pages/CalendarPage'
import AuditLogsPage from './pages/AuditLogsPage'
import Layout from './components/Layout'

function App() {
  const { user, loading } = useAuth()

  // Показываем загрузку при инициализации
  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-sand border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-warmgray font-medium">FreshTrack</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <ErrorBoundary>
      <Layout>
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
      </Layout>
    </ErrorBoundary>
  )
}

export default App
// test