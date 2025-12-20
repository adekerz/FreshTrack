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
  ArrowRight
} from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'
import { format, parseISO } from 'date-fns'

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
  const { getStats, getAlerts, collectBatch, departments } = useProducts()

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
      color: 'text-charcoal',
      bgColor: 'bg-sand/50'
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
      {/* Статистика - Bento Grid на мобильных */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className={`bg-white rounded-xl sm:rounded-lg p-4 sm:p-6 border border-sand animate-slide-up`}
              style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'backwards' }}
            >
              <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${card.bgColor} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
                </div>
              </div>
              <div className={`text-2xl sm:text-3xl font-serif mb-0.5 sm:mb-1 ${card.color}`}>{card.value}</div>
              <div className="text-xs sm:text-sm text-warmgray line-clamp-1">{card.title}</div>
            </div>
          )
        })}
      </div>

      {/* Отделы - адаптивный Bento Grid */}
      <div>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="font-serif text-lg sm:text-xl text-charcoal">{t('dashboard.departments')}</h2>
          <Link
            to="/inventory"
            className="text-xs sm:text-sm text-warmgray hover:text-accent transition-colors flex items-center gap-1"
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
                className={`bg-white rounded-xl sm:rounded-lg p-4 sm:p-6 border border-sand hover:border-accent hover:shadow-md transition-all group animate-slide-up`}
                style={{ animationDelay: `${(index + 4) * 0.1}s`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${dept.color || '#C4A35A'}20` }}
                  >
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: dept.color || '#C4A35A' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-charcoal group-hover:text-accent transition-colors truncate">
                      {dept.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-warmgray">{t('dashboard.viewInventory')}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Требуют внимания - компактный вид на мобильных */}
      <div>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="font-serif text-lg sm:text-xl text-charcoal">{t('dashboard.needsAttention')}</h2>
          {alerts.length > 0 && (
            <Link
              to="/notifications"
              className="text-xs sm:text-sm text-warmgray hover:text-accent transition-colors flex items-center gap-1"
            >
              {t('dashboard.viewAll')}
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="bg-success/5 border border-success/20 rounded-xl sm:rounded-lg p-6 sm:p-8 text-center animate-fade-in">
            <Check className="w-10 h-10 sm:w-12 sm:h-12 text-success mx-auto mb-3 sm:mb-4" />
            <h3 className="font-serif text-base sm:text-lg text-charcoal mb-1 sm:mb-2">{t('dashboard.allGood')}</h3>
            <p className="text-sm text-warmgray">{t('dashboard.noExpiring')}</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {alerts.slice(0, 5).map((alert, index) => (
              <div
                key={alert.id}
                className={`bg-white rounded-xl sm:rounded-lg p-3 sm:p-4 border-l-4 ${
                  alert.daysLeft < 0
                    ? 'border-l-danger'
                    : alert.daysLeft <= 3
                      ? 'border-l-danger'
                      : 'border-l-warning'
                } border border-sand animate-slide-up`}
                style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'backwards' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                      <h3 className="font-medium text-charcoal text-sm sm:text-base truncate">{alert.productName}</h3>
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

                    <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-warmgray">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                        {formatDate(alert.expiryDate)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                        {alert.quantity} {t('inventory.units')}
                      </div>
                    </div>

                    <div
                      className={`mt-1 sm:mt-2 text-xs sm:text-sm font-medium ${
                        alert.daysLeft < 0
                          ? 'text-danger'
                          : alert.daysLeft <= 3
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

                  <button
                    onClick={() => collectBatch(alert.id)}
                    className="flex items-center justify-center gap-1 px-3 sm:px-4 py-2 text-xs sm:text-sm border border-success text-success rounded-lg hover:bg-success hover:text-white transition-colors w-full sm:w-auto"
                  >
                    <Check className="w-4 h-4" />
                    {t('product.collect')}
                  </button>
                </div>
              </div>
            ))}

            {alerts.length > 5 && (
              <Link
                to="/notifications"
                className="block text-center py-3 text-sm text-warmgray hover:text-accent transition-colors"
              >
                {t('dashboard.showMore', { count: alerts.length - 5 })}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
