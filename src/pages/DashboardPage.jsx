import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  AlertTriangle,
  Check,
  Clock,
  Wine,
  Coffee,
  Utensils,
  ChefHat,
  Warehouse,
  Calendar,
  ArrowRight,
  Plus,
  Zap
} from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { useThresholds } from '../hooks/useThresholds'
import { format, parseISO } from 'date-fns'
import { SkeletonDashboard } from '../components/Skeleton'
import { Loader } from '../components/ui'
import AddBatchModal from '../components/AddBatchModal'

// Иконки для отделов - универсальный маппинг
const ICON_MAP = {
  Wine,
  Coffee,
  Utensils,
  ChefHat,
  Warehouse,
  Package
}

// Получить иконку по имени или типу
const getDeptIcon = (dept) => {
  if (dept?.icon && ICON_MAP[dept.icon]) return ICON_MAP[dept.icon]
  // Fallback based on type or name keywords
  const name = (dept?.name || dept?.code || '').toLowerCase()
  if (name.includes('bar')) return Wine
  if (name.includes('kitchen') || name.includes('кухня')) return ChefHat
  if (name.includes('restaurant') || name.includes('ресторан')) return Utensils
  if (name.includes('storage') || name.includes('склад')) return Warehouse
  if (name.includes('cafe') || name.includes('кафе')) return Coffee
  return Package
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { getStats, getAlerts, collectBatch, departments, loading, refresh } = useProducts()
  const { thresholds } = useThresholds()
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Автоматический retry когда нет данных (БД ещё загружается)
  // Делаем retry только если не loading и прошло достаточно времени
  useEffect(() => {
    // Не делаем retry если уже идёт загрузка или достигнут лимит
    if (loading || retryCount >= 5) return

    // Если данные есть - сбрасываем счётчик
    if (departments.length > 0) {
      if (retryCount > 0) setRetryCount(0)
      return
    }

    // Retry с увеличивающимся интервалом (3s, 6s, 9s...)
    const delay = (retryCount + 1) * 3000
    const timer = setTimeout(() => {
      setRetryCount((prev) => prev + 1)
      refresh()
    }, delay)

    return () => clearTimeout(timer)
  }, [loading, departments.length, retryCount, refresh])

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t('dashboard.goodMorning') || 'Good morning'
    if (hour < 18) return t('dashboard.goodAfternoon') || 'Good afternoon'
    return t('dashboard.goodEvening') || 'Good evening'
  }

  // Show skeleton while loading (когда есть данные)
  if (loading && departments.length > 0) {
    return (
      <div className="p-4 sm:p-6">
        <SkeletonDashboard />
      </div>
    )
  }

  // Загрузка БД (нет данных и идёт загрузка)
  if (loading && departments.length === 0) {
    return (
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
    )
  }

  // Если нет отделов после загрузки - показываем empty state
  if (!loading && departments.length === 0) {
    return (
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
            className="mt-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            {t('common.goToSettings') || 'Перейти в настройки'}
          </Link>
        </div>
      </div>
    )
  }

  const stats = getStats()
  const alerts = getAlerts()

  // Форматирование даты
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return format(parseISO(dateString), 'dd.MM.yyyy')
    } catch {
      return 'Invalid'
    }
  }

  // Статистические карточки
  const statCards = [
    {
      title: t('dashboard.totalBatches'),
      value: stats.total,
      icon: Package,
      color: 'text-foreground',
      bgColor: 'bg-muted'
    },
    {
      title: t('dashboard.goodStatus'),
      value: stats.good,
      icon: Check,
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      title: t('dashboard.expiringSoon'),
      value: stats.warning + stats.critical,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    {
      title: t('dashboard.expired'),
      value: stats.expired,
      icon: AlertTriangle,
      color: 'text-danger',
      bgColor: 'bg-danger/10'
    }
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting Section - Peak-End Rule: Start with positive experience */}
      <div className="bg-gradient-to-r from-accent/5 to-transparent dark:from-accent/10 dark:to-transparent rounded-xl p-4 sm:p-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-light text-foreground">
              {getGreeting()}, {user?.name?.split(' ')[0] || t('common.user')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('dashboard.summary') || 'Here is your inventory overview'}
            </p>
          </div>

          {/* Quick Actions - Fitts Law: Large targets for common actions */}
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => setShowAddBatchModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 active:scale-[0.98] transition-all text-sm font-medium min-h-[44px]"
              data-onboarding="add-batch"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.addBatch')}</span>
              <span className="sm:hidden">{t('common.add') || 'Add'}</span>
            </button>
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
        </div>
      </div>

      {/* Statistics - Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon
          // Von Restorff Effect - выделяем критические элементы
          const isCritical = card.title === t('dashboard.expired') && card.value > 0
          return (
            <div
              key={card.title}
              className={`bg-card rounded-xl sm:rounded-lg p-4 sm:p-6 border border-border animate-slide-up hover-lift ${isCritical ? 'critical-highlight' : ''}`}
              style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'backwards' }}
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

      {/* Отделы - адаптивный Bento Grid */}
      <div>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-medium text-foreground">
            {t('dashboard.departments')}
          </h2>
          <Link
            to="/inventory"
            className="text-xs sm:text-sm text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
          >
            {t('dashboard.viewAll')}
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {departments.map((dept, index) => {
            const Icon = getDeptIcon(dept)
            return (
              <Link
                key={dept.id}
                to={`/inventory/${dept.id}`}
                className="interactive-card bg-card rounded-xl sm:rounded-lg p-4 sm:p-6 border border-border group animate-slide-up focus-ring"
                style={{ animationDelay: `${(index + 4) * 0.1}s`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${dept.color || '#C4A35A'}20` }}
                  >
                    <Icon
                      className="w-6 h-6 sm:w-7 sm:h-7"
                      style={{ color: dept.color || '#C4A35A' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground group-hover:text-accent transition-colors truncate">
                      {dept.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {t('dashboard.viewInventory')}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-accent group-hover:translate-x-1 transition-all ml-auto" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Требуют внимания - компактный вид на мобильных */}
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
            <p className="text-sm text-muted-foreground">{t('dashboard.noExpiring')}</p>
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
                      ? 'border-l-danger'
                      : 'border-l-warning'
                } border border-border animate-slide-up`}
                style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'backwards' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                      <h3 className="font-medium text-foreground text-sm sm:text-base truncate">
                        {alert.productName}
                      </h3>
                      {alert.department && (
                        <span
                          className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                          style={{
                            backgroundColor: `${alert.department.color}20`,
                            color: alert.department.color
                          }}
                        >
                          {alert.department.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                        {formatDate(alert.expiryDate)}
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
                            ? 'text-danger'
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
      {showAddBatchModal && <AddBatchModal onClose={() => setShowAddBatchModal(false)} />}
    </div>
  )
}
