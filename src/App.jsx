import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import Layout from './components/Layout'
import { PageLoader, Loader } from './components/ui'
import MobileDebugHelper from './components/dev/MobileDebugHelper'
import { useAutoLogout } from './hooks/useAutoLogout'
import { useSessionSettings } from './hooks/useSessionSettings'

// Eager loading для критичных страниц (auth, change password)
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

// Lazy loading для страниц (code splitting, не загружаются пока не нужны)
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const NotificationsHistoryPage = lazy(
  () => import('./pages/NotificationsHistoryPage')
)
const CollectionHistoryPage = lazy(
  () => import('./pages/CollectionHistoryPage')
)
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const TaskPlannerPage = lazy(() => import('./pages/TaskPlannerPage'))
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))
const LogbookScannerPage = lazy(() => import('./pages/LogbookScannerPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const MFASetupPage = lazy(() => import('./pages/MFASetupPage'))
const FAQPage = lazy(() => import('./pages/FAQPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'))
const AccessibilityStatementPage = lazy(
  () => import('./pages/AccessibilityStatementPage')
)
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Suspense fallback — используем единый PageLoader
function SuspenseFallback() {
  return <PageLoader message="Загрузка страницы..." />
}

function App() {
  const { user, loading, logout, isAuthenticated, sessionExpired } = useAuth()

  // Load hotel session settings (autoLogoutMinutes, rememberDevice)
  const { autoLogoutMinutes } = useSessionSettings(isAuthenticated)

  // Auto-logout on inactivity based on hotel settings
  useAutoLogout({ timeoutMinutes: autoLogoutMinutes, logout, isAuthenticated })

  // Check if user is pending approval
  const isPendingUser = user?.status === 'pending'

  // Показываем загрузку при инициализации — используем единый Loader (landmark main для axe)
  if (loading) {
    return (
      <main
        className="min-h-screen bg-background flex items-center justify-center"
        role="main"
      >
        <div
          className="flex flex-col items-center gap-6"
          role="status"
          aria-live="polite"
        >
          <Loader size="large" aria-label="Инициализация приложения" />
          <p className="text-accent font-serif text-xl">FreshTrack</p>
        </div>
      </main>
    )
  }

  // User not logged in - show auth pages
  if (!user) {
    const loginRedirect = sessionExpired
      ? `/login?reason=session_expired`
      : `/login`
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to={loginRedirect} replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          {/* Public legal pages */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          {/* Any other path redirects to login (not 404) when unauthenticated */}
          <Route path="*" element={<Navigate to={loginRedirect} replace />} />
        </Routes>
      </Suspense>
    )
  }

  // User logged in but email not verified - show verify email page
  if (user.email && !user.emailVerified) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/verify-email" replace />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          {/* Public legal pages */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          {/* 404 — страница не найдена */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    )
  }

  // User is pending approval - show only pending page
  if (isPendingUser) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/pending-approval" replace />}
          />
          <Route path="/pending-approval" element={<PendingApprovalPage />} />
          {/* Public legal pages */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          {/* 404 — страница не найдена */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    )
  }

  // User must change password - show only change password page
  if (user?.mustChangePassword) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/change-password" replace />}
          />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          {/* Public legal pages */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          {/* 404 — страница не найдена */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <>
      {import.meta.env.DEV && <MobileDebugHelper />}
      <ErrorBoundary>
        <Layout>
          <Suspense fallback={<SuspenseFallback />}>
            <Routes>
              {/* Общедоступные страницы (для всех авторизованных) */}
              <Route
                path="/"
                element={
                  <RouteErrorBoundary>
                    <DashboardPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/change-password"
                element={
                  <RouteErrorBoundary>
                    <ChangePasswordPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/verify-email"
                element={
                  <RouteErrorBoundary>
                    <VerifyEmailPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/inventory/:departmentId"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <RouteErrorBoundary>
                      <InventoryPage />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <RouteErrorBoundary>
                      <InventoryPage />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute requiredModule="inventory">
                    <RouteErrorBoundary>
                      <NotificationsPage />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <RouteErrorBoundary>
                    <CalendarPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute requiredModule="task_planner">
                    <RouteErrorBoundary>
                      <TaskPlannerPage />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <RouteErrorBoundary>
                    <SettingsPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/logbook-scanner"
                element={
                  <ProtectedRoute requiredModule="logbook_scanner">
                    <RouteErrorBoundary>
                      <LogbookScannerPage />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute requiredModule="analytics">
                    <RouteErrorBoundary>
                      <AnalyticsPage />
                    </RouteErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mfa-setup"
                element={
                  <RouteErrorBoundary>
                    <MFASetupPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/faq"
                element={
                  <RouteErrorBoundary>
                    <FAQPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/docs"
                element={
                  <RouteErrorBoundary>
                    <DocumentationPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/accessibility"
                element={
                  <RouteErrorBoundary>
                    <AccessibilityStatementPage />
                  </RouteErrorBoundary>
                }
              />
              {/* Legal pages (accessible to logged-in users too) */}
              <Route
                path="/privacy"
                element={
                  <RouteErrorBoundary>
                    <PrivacyPolicyPage />
                  </RouteErrorBoundary>
                }
              />
              <Route
                path="/terms"
                element={
                  <RouteErrorBoundary>
                    <TermsOfServicePage />
                  </RouteErrorBoundary>
                }
              />

              {/* Страницы с ограниченным доступом */}
              <Route
                path="/notifications/history"
                element={
                  <RouteErrorBoundary>
                    <ProtectedRoute
                      allowedRoles={[
                        'SUPER_ADMIN',
                        'HOTEL_ADMIN',
                        'DEPARTMENT_MANAGER',
                      ]}
                    >
                      <NotificationsHistoryPage />
                    </ProtectedRoute>
                  </RouteErrorBoundary>
                }
              />

              {/* Для администраторов и менеджеров отделов */}
              <Route
                path="/collection-history"
                element={
                  <RouteErrorBoundary>
                    <ProtectedRoute
                      allowedRoles={[
                        'SUPER_ADMIN',
                        'HOTEL_ADMIN',
                        'DEPARTMENT_MANAGER',
                      ]}
                      requiredModule="inventory"
                    >
                      <CollectionHistoryPage />
                    </ProtectedRoute>
                  </RouteErrorBoundary>
                }
              />

              <Route
                path="/statistics"
                element={<Navigate to="/analytics" replace />}
              />

              {/* Только для администраторов (аудит логи) */}
              <Route
                path="/audit-logs"
                element={
                  <RouteErrorBoundary>
                    <ProtectedRoute
                      allowedRoles={['SUPER_ADMIN', 'HOTEL_ADMIN']}
                    >
                      <AuditLogsPage />
                    </ProtectedRoute>
                  </RouteErrorBoundary>
                }
              />

              {/* 404 — страница не найдена */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </ErrorBoundary>
    </>
  )
}

export default App
