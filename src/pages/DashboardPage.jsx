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
  ClipboardList,
  ListTodo,
  CircleDot,
  Ban,
  CheckCircle2,
  Lock,
  LayoutGrid,
} from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useDepartment } from '../context/DepartmentContext'
import { useAuth } from '../context/AuthContext'
import { useModules } from '../context/ModuleContext'
import { useTranslation } from '../context/LanguageContext'
import { useThresholds } from '../hooks/useThresholds'
import { useTaskStats } from '../hooks/useTasks'
import { SkeletonDashboard } from '../components/Skeleton'
import { formatDate } from '../utils/dateUtils'
import { Loader, TouchButton } from '../components/ui'
import PageContainer from '../components/PageContainer'
import AddBatchModal from '../components/AddBatchModal'

// ── Task stats widget ─────────────────────────────────────────────────────────
function TaskWidget() {
  const { data: stats, isLoading } = useTaskStats()

  const items = [
    {
      label: 'К выполнению',
      value: stats?.todo_count ?? 0,
      icon: ListTodo,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    },
    {
      label: 'В работе',
      value: stats?.in_progress_count ?? 0,
      icon: CircleDot,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      label: 'Заблокировано',
      value: stats?.blocked_count ?? 0,
      icon: Ban,
      color: 'text-danger',
      bg: 'bg-danger/10',
    },
    {
      label: 'Просрочено',
      value: stats?.overdue_count ?? 0,
      icon: AlertTriangle,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Выполнено',
      value: stats?.completed_count ?? 0,
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success/10',
    },
  ]

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-foreground">Задачи</h3>
        </div>
        <Link
          to="/tasks"
          className="text-xs text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors"
        >
          Открыть <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className={`flex items-center gap-3 p-3 rounded-lg ${item.bg}`}
              >
                <Icon className={`w-4 h-4 ${item.color} shrink-0`} />
                <div>
                  <div className={`text-xl font-light ${item.color}`}>
                    {item.value}
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight">
                    {item.label}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {stats && stats.due_soon_count > 0 && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{stats.due_soon_count} задач истекают скоро</span>
        </div>
      )}
    </div>
  )
}

// ── Inventory stats widget ─────────────────────────────────────────────────────
function InventoryWidget({ stats, alerts, thresholds, t }) {
  const statItems = [
    {
      title: t('dashboard.totalBatches'),
      value: stats.total,
      icon: Package,
      color: 'text-foreground',
      bg: 'bg-muted',
    },
    {
      title: t('dashboard.goodStatus'),
      value: stats.good,
      icon: Check,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      title: 'Скоро истекает',
      value: stats.warning,
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Внимание',
      value: stats.attention ?? 0,
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      title: 'Критично',
      value: stats.critical,
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      title: t('dashboard.expired'),
      value: stats.expired,
      icon: Ban,
      color: 'text-danger',
      bg: 'bg-danger/10',
    },
  ]

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-accent" />
          <h3 className="font-semibold text-foreground">Инвентарь</h3>
        </div>
        <Link
          to="/notifications"
          className="text-xs text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors"
        >
          {t('dashboard.viewAll')} <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {statItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.title}
              className={`flex items-center gap-2 p-3 rounded-lg ${item.bg}`}
            >
              <Icon className={`w-4 h-4 ${item.color} shrink-0`} />
              <div>
                <div className={`text-xl font-light ${item.color}`}>
                  {item.value}
                </div>
                <div className="text-xs text-muted-foreground leading-tight">
                  {item.title}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Требуют внимания
          </p>
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border-l-2 bg-muted/40 ${
                alert.daysLeft < 0
                  ? 'border-l-danger'
                  : alert.daysLeft <= thresholds.critical
                    ? 'border-l-danger'
                    : alert.daysLeft <= (thresholds.attention ?? 5)
                      ? 'border-l-orange-500'
                      : 'border-l-warning'
              }`}
            >
              <span className="text-sm text-foreground truncate">
                {alert.productName}
              </span>
              <span
                className={`text-xs shrink-0 font-medium ${
                  alert.daysLeft < 0 ? 'text-danger'
                  : alert.daysLeft <= thresholds.critical ? 'text-danger'
                  : alert.daysLeft <= (thresholds.attention ?? 5) ? 'text-orange-500'
                  : 'text-warning'
                }`}
              >
                {alert.daysLeft < 0
                  ? `−${Math.abs(alert.daysLeft)}д`
                  : `${alert.daysLeft}д`}
              </span>
            </div>
          ))}
          {alerts.length > 3 && (
            <Link
              to="/notifications"
              className="block text-center text-xs text-muted-foreground hover:text-accent transition-colors py-1"
            >
              +{alerts.length - 3} ещё
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ── No modules empty state ────────────────────────────────────────────────────
function NoModulesState({ user }) {
  const isAdmin = user?.role === 'HOTEL_ADMIN' || user?.role === 'SUPER_ADMIN'
  return (
    <div className="flex-1 flex items-center justify-center py-24 animate-fade-in">
      <div className="flex flex-col items-center gap-6 text-center px-4 max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
          <LayoutGrid className="w-10 h-10 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Модули не подключены
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isAdmin
              ? 'Включите модули для вашего отдела в настройках, чтобы начать работу.'
              : 'Обратитесь к администратору для подключения модулей к вашему отделу.'}
          </p>
        </div>
        <div className="w-full space-y-2">
          {[
            { label: 'Инвентарь', desc: 'Учёт продуктов и сроков' },
            { label: 'Task Planner', desc: 'Управление задачами' },
            { label: 'Logbook Scanner', desc: 'Сканирование чеков' },
          ].map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border text-left opacity-60"
            >
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {isAdmin && (
          <Link
            to="/settings"
            className="px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors text-sm"
          >
            Настройки модулей
          </Link>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { hasModule } = useModules()
  const { getStats, getAlerts, loading, refresh } = useProducts()
  const {
    departments,
    getDepartmentIcon,
    selectedDepartmentId,
    selectDepartment,
    showDepartmentSelector,
  } = useDepartment()
  const { thresholds } = useThresholds()
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const hasInventory = hasModule('inventory')
  const hasTaskPlanner = hasModule('task_planner')

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
    if (hour < 12) return t('dashboard.goodMorning') || 'Доброе утро'
    if (hour < 18) return t('dashboard.goodAfternoon') || 'Добрый день'
    return t('dashboard.goodEvening') || 'Добрый вечер'
  }

  if (loading && departments.length > 0) {
    return (
      <PageContainer
        title={t('nav.dashboard') || 'Главная'}
        subtitle={t('dashboard.summary') || 'Обзор'}
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
        subtitle={t('dashboard.summary') || 'Обзор'}
        stickyHeader={true}
      >
        <div className="flex-1 flex items-center justify-center py-16 sm:py-24">
          <div
            className="flex flex-col items-center gap-6"
            role="status"
            aria-live="polite"
          >
            <Loader
              size="large"
              aria-label={t('common.loading') || 'Загрузка'}
            />
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
        subtitle={t('dashboard.summary') || 'Обзор'}
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
                  'Создайте отделы и категории для начала работы.'}
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

  const currentDept = selectedDepartmentId
    ? departments.find((d) => d.id === selectedDepartmentId)
    : departments[0]

  const alerts = selectedDepartmentId
    ? allAlerts.filter((a) => {
        const deptId =
          typeof a.department === 'object' ? a.department?.id : a.department
        return deptId === selectedDepartmentId
      })
    : allAlerts

  const otherDepts = departments.filter((d) => d.id !== currentDept?.id)
  const currentIcon = currentDept ? getDepartmentIcon(currentDept) : null
  const CurrentDeptIcon = currentIcon

  // Header actions — только если инвентарь включён
  const headerActions = (
    <div className="flex gap-2 sm:gap-3">
      {hasInventory && (
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
      )}
      {hasInventory && alerts.length > 0 && (
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
  )

  return (
    <PageContainer
      title={`${getGreeting()}, ${user?.name?.split(' ')[0] || t('common.user')}`}
      subtitle={t('dashboard.summary') || 'Обзор'}
      stickyHeader={true}
      headerClassName="bg-gradient-to-r from-accent/20 via-accent/10 to-transparent dark:from-accent/30 dark:via-accent/15 dark:to-transparent rounded-xl"
      actions={hasInventory || hasTaskPlanner ? headerActions : null}
    >
      {/* No modules state */}
      {!hasInventory && !hasTaskPlanner && <NoModulesState user={user} />}

      {(hasInventory || hasTaskPlanner) && (
        <div className="space-y-6 sm:space-y-8">
          {/* ── Текущий отдел + быстрое переключение ── */}
          {currentDept && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                to={
                  hasInventory
                    ? `/inventory/${currentDept.id}`
                    : '/tasks'
                }
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors group flex-1 sm:flex-none sm:min-w-[220px]"
              >
                {CurrentDeptIcon && (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{
                      backgroundColor: `${currentDept.color || '#C4A35A'}20`,
                    }}
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
                        <span className="truncate max-w-[100px]">
                          {dept.name}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Variant 1: оба модуля — двухколоночный layout ── */}
          {hasInventory && hasTaskPlanner && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <TaskWidget />
              <InventoryWidget
                stats={stats}
                alerts={alerts}
                thresholds={thresholds}
                t={t}
              />
            </div>
          )}

          {/* ── Variant 2: только Task Planner ── */}
          {!hasInventory && hasTaskPlanner && <TaskWidget />}

          {/* ── Variant 3: только инвентарь — полная статистика + алерты ── */}
          {hasInventory && !hasTaskPlanner && (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6">
                {[
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
                    title: 'Скоро истекает',
                    value: stats.warning,
                    icon: Clock,
                    color: 'text-warning',
                    bgColor: 'bg-warning/10',
                  },
                  {
                    title: 'Внимание',
                    value: stats.attention ?? 0,
                    icon: AlertTriangle,
                    color: 'text-orange-500',
                    bgColor: 'bg-orange-500/10',
                  },
                  {
                    title: 'Критично',
                    value: stats.critical,
                    icon: AlertTriangle,
                    color: 'text-red-500',
                    bgColor: 'bg-red-500/10',
                  },
                  {
                    title: t('dashboard.expired'),
                    value: stats.expired,
                    icon: Ban,
                    color: 'text-danger',
                    bgColor: 'bg-danger/10',
                  },
                ].map((card, index) => {
                  const Icon = card.icon
                  const isCritical =
                    card.title === t('dashboard.expired') && card.value > 0
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
                          <Icon
                            className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`}
                          />
                        </div>
                      </div>
                      <div
                        className={`text-2xl sm:text-3xl font-light mb-0.5 sm:mb-1 ${card.color}`}
                      >
                        {card.value}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                        {card.title}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Alerts */}
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
                              {alert.department &&
                                typeof alert.department === 'object' && (
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
                                ? t('status.expiredDaysAgo', {
                                    days: Math.abs(alert.daysLeft),
                                  })
                                : alert.daysLeft === 0
                                  ? t('status.expiresToday')
                                  : t('status.expiresInDays', {
                                      days: alert.daysLeft,
                                    })}
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
            </>
          )}
        </div>
      )}

      {showAddBatchModal && (
        <AddBatchModal onClose={() => setShowAddBatchModal(false)} />
      )}
    </PageContainer>
  )
}
