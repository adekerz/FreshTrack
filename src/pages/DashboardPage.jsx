import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  AlertTriangle,
  Check,
  Clock,
  Calendar,
  ArrowRight,
  Plus,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useDepartment } from '../context/DepartmentContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { useThresholds } from '../hooks/useThresholds'
import { SkeletonDashboard } from '../components/Skeleton'
import { formatDate } from '../utils/dateUtils'
import { Loader, TouchButton } from '../components/ui'
import PageContainer from '../components/PageContainer'
import AddBatchModal from '../components/AddBatchModal'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const {
    getStats,
    getAlerts,
    loading,
    refresh,
  } = useProducts()
  const { departments, getDepartmentIcon, selectedDepartmentId, selectDepartment, showDepartmentSelector } = useDepartment()
  const { thresholds } = useThresholds()
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Автоматический retry когда нет данных (БД ещё загружается)
  useEffect(() => {
    if (loading || retryCount >= 5) return
    if (departments.length > 0) {
      if (retryCount > 0) setRetryCount(0)
      return
    }
    const delay = (retryCount + 1) * 3000
    const timer = setTimeout(() => {
      setRetryCount((prev) => prev + 1)
      refresh()
    }, delay)
    // eslint-disable-next-line consistent-return
    return () => clearTimeout(timer)
  }, [loading, departments.length, retryCount, refresh])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashboard.goodMorning') || 'Good morning'
    if (hour < 18) return t('dashboard.goodAfternoon') || 'Good afternoon'
    return t('dashboard.goodEvening') || 'Good evening'
  }

  if (loading && departments.length > 0) {
    return (
      <PageContainer
        title={t('nav.dashboard') || 'Главная'}
        subtitle={t('dashboard.summary') || 'Обзор инвентаря'}
        stickyHeader={true}
      >
        <SkeletonDashboard />
      </PageContainer>
    )
  }

  if (loading && departments.length === 0) {
    return (
      <PageContainer
        title={t('nav.dashboard') || 'Главная'}
        subtitle={t('dashboard.summary') || 'Обзор инвентаря'}
        stickyHeader={true}
      >
        <div className="flex-1 flex items-center justify-center py-16 sm:py-24">
          <div className="flex flex-col items-center gap-6" role="status" aria-live="polite">
            <Loader size="large" aria-label={t('common.loading') || 'Загрузка'} />
            <div className="text-center">
              <p className="text-foreground font-medium mb-1">
                {t('common.loading') || 'Загрузка...'}
              </p>
              {retryCount > 0 && (
                <p className="text-muted-foreground text-sm">
                  {`${t('common.attempt') || 'Попытка'} ${retryCount}/10`}
                </p>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!loading && departments.length === 0) {
    return (
      <PageContainer
        title={t('nav.dashboard') || 'Главная'}
        subtitle={t('dashboard.summary') || 'Обзор инвентаря'}
        stickyHeader={true}
      >
        <div className="flex-1 flex items-center justify-center py-16 sm:py-24">
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {t('dashboard.noDepartments') || 'Отель пока пустой'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                {t('dashboard.noDepartmentsDescription') ||
                  'Создайте отделы и категории для начала работы с инвентарём.'}
              </p>
            </div>
            <Link
              to="/settings"
              className="mt-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
            >
              {t('common.goToSettings') || 'Перейти в настройки'}
            </Link>
          </div>
        </div>
      </PageContainer>
    )
  }

  const stats = getStats()
  const allAlerts = getAlerts()

  // Текущий отдел
  const currentDept = selectedDepartmentId
    ? departments.find((d) => d.id === selectedDepartmentId)
    : departments[0]

  // Фильтруем алерты по выбранному отделу
  const alerts = selectedDepartmentId
    ? allAlerts.filter((a) => {
        const deptId = typeof a.department === 'object' ? a.department?.id : a.department
        return deptId === selectedDepartmentId
      })
    : allAlerts

  // Остальные отделы (для быстрого переключения)
  const otherDepts = departments.filter((d) => d.id !== currentDept?.id)

  const currentIcon = currentDept ? getDepartmentIcon(currentDept) : null
  const CurrentDeptIcon = currentIcon

  // Статистические карточки
  const statCards = [
    {
      title: t('dashboard.totalBatches'),
      value: stats.total,
      icon: Package,
      color: 'text-foreground',
      bgColor: 'bg-muted',
    },
    {
      title: t('dashboard.goodStatus'),
      value: stats.good,
      icon: Check,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: t('dashboard.expiringSoon'),
      value: stats.warning + stats.critical,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: t('dashboard.expired'),
      value: stats.expired,
      icon: AlertTriangle,
      color: 'text-danger',
      bgColor: 'bg-danger/10',
    },
  ]

  return (
    <PageContainer
      title={`${getGreeting()}, ${user?.name?.split(' ')[0] || t('common.user')}`}
      subtitle={t('dashboard.summary') || 'Here is your inventory overview'}
      stickyHeader={true}
      headerClassName="bg-gradient-to-r from-accent/20 via-accent/10 to-transparent dark:from-accent/30 dark:via-accent/15 dark:to-transparent rounded-xl"
      actions={
        <div className="flex gap-2 sm:gap-3">
          <TouchButton
            onClick={() => setShowAddBatchModal(true)}
            variant="primary"
            size="default"
            icon={Plus}
            className="text-sm font-medium"
            data-onboarding="add-batch"
          >
            <span className="hidden sm:inline">{t('header.addBatch')}</span>
            <span className="sm:hidden">{t('common.add') || 'Add'}</span>
          </TouchButton>
          {alerts.length > 0 && (
            <Link
              to="/notifications"
              className="flex items-center gap-2 px-4 py-2.5 bg-danger/10 text-danger border border-danger/20 rounded-lg hover:bg-danger/20 transition-all text-sm font-medium min-h-[44px]"
            >
              <Zap className="w-4 h-4" />
              <span>
                {alerts.length} {t('dashboard.urgent') || 'urgent'}
              </span>
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-6 sm:space-y-8">

        {/* ── Текущий отдел + быстрое переключение ── */}
        {currentDept && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Текущий отдел — hero-кнопка */}
            <Link
              to={`/inventory/${currentDept.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors group flex-1 sm:flex-none sm:min-w-[220px]"
            >
              {CurrentDeptIcon && (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: `${currentDept.color || '#C4A35A'}20` }}
                >
                  <CurrentDeptIcon
                    className="w-5 h-5"
                    style={{ color: currentDept.color || '#C4A35A' }}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {t('dashboard.currentDepartment') || 'Текущий отдел'}
                </p>
                <p className="font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                  {currentDept.name}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0" />
            </Link>

            {/* Быстрое переключение на другие отделы (только если > 1 отдела) */}
            {showDepartmentSelector && otherDepts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {otherDepts.map((dept) => {
                  const Icon = getDepartmentIcon(dept)
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => selectDepartment(dept.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                    >
                      <Icon
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: dept.color || '#6366f1' }}
                      />
                      <span className="truncate max-w-[100px]">{dept.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Статистика ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {statCards.map((card, index) => {
            const Icon = card.icon
            const isCritical = card.title === t('dashboard.expired') && card.value > 0
            return (
              <div
                key={card.title}
                className={`bg-card rounded-xl sm:rounded-lg p-4 sm:p-6 border border-border animate-slide-up hover-lift ${isCritical ? 'critical-highlight' : ''}`}
                style={{
                  animationDelay: `${index * 0.1}s`,
                  animationFillMode: 'backwards',
                }}
              >
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${card.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
                  </div>
                </div>
                <div className={`text-2xl sm:text-3xl font-light mb-0.5 sm:mb-1 ${card.color}`}>
                  {card.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                  {card.title}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Требуют внимания ── */}
        <div>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-medium text-foreground">
              {t('dashboard.needsAttention')}
            </h2>
            {alerts.length > 0 && (
              <Link
                to="/notifications"
                className="text-xs sm:text-sm text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
              >
                {t('dashboard.viewAll')}
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </Link>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="bg-success/5 border border-success/20 rounded-xl sm:rounded-lg p-6 sm:p-8 text-center animate-fade-in">
              <Check className="w-10 h-10 sm:w-12 sm:h-12 text-success mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-1 sm:mb-2">
                {t('dashboard.allGood')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.noExpiring')}
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {alerts.slice(0, 5).map((alert, index) => (
                <div
                  key={alert.id}
                  className={`bg-card rounded-xl sm:rounded-lg p-3 sm:p-4 border-l-4 ${
                    alert.daysLeft < 0
                      ? 'border-l-danger'
                      : alert.daysLeft <= thresholds.critical
                        ? 'border-l-critical'
                        : 'border-l-warning'
                  } border border-border animate-slide-up`}
                  style={{
                    animationDelay: `${index * 0.05}s`,
                    animationFillMode: 'backwards',
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                        <h3 className="font-medium text-foreground text-sm sm:text-base truncate">
                          {alert.productName}
                        </h3>
                        {alert.department && typeof alert.department === 'object' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                            style={{
                              backgroundColor: `${alert.department.color}20`,
                              color: alert.department.color,
                            }}
                          >
                            {alert.department.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                          {formatDate(alert.expiryDate, false)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                          {alert.quantity === null
                            ? t('product.noQuantity')
                            : `${alert.quantity} ${t('inventory.units')}`}
                        </div>
                      </div>
                      <div
                        className={`mt-1 sm:mt-2 text-xs sm:text-sm font-medium ${
                          alert.daysLeft < 0
                            ? 'text-danger'
                            : alert.daysLeft <= thresholds.critical
                              ? 'text-critical'
                              : 'text-warning'
                        }`}
                      >
                        {alert.daysLeft < 0
                          ? t('status.expiredDaysAgo', { days: Math.abs(alert.daysLeft) })
                          : alert.daysLeft === 0
                            ? t('status.expiresToday')
                            : t('status.expiresInDays', { days: alert.daysLeft })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {alerts.length > 5 && (
                <Link
                  to="/notifications"
                  className="block text-center py-3 text-sm text-muted-foreground hover:text-accent transition-colors"
                >
                  {t('dashboard.showMore', { count: alerts.length - 5 })}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Add Batch Modal */}
        {showAddBatchModal && (
          <AddBatchModal onClose={() => setShowAddBatchModal(false)} />
        )}
      </div>
    </PageContainer>
  )
}
