/**
 * Statistics Page - Страница статистики
 * Отображает ключевые метрики и графики по товарам
 */

import { useState, useMemo } from 'react'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import ExportButton from '../components/ExportButton'
import { EXPORT_COLUMNS } from '../utils/exportUtils'
import { Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function StatisticsPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { user, isHotelAdmin } = useAuth()
  const { getActiveBatches, getStats, departments, categories } = useProducts()
  const [selectedPeriod, setSelectedPeriod] = useState('week')

  const stats = getStats()
  const batches = getActiveBatches()

  // Фильтрация доступных отделов для пользователя (permission-based)
  const userDepartments = useMemo(() => {
    // Hotel admins and super admins see all departments
    if (isHotelAdmin()) return departments
    // Other users see only their assigned departments
    return departments.filter((d) => user?.departments?.includes(d.id))
  }, [user, departments, isHotelAdmin])

  // Статистика по отделам
  const departmentStats = useMemo(() => {
    return userDepartments.map((dept) => {
      const deptBatches = batches.filter((b) => b.departmentId === dept.id)
      const expired = deptBatches.filter((b) => b.daysLeft < 0)
      const critical = deptBatches.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 3)
      const warning = deptBatches.filter((b) => b.daysLeft > 3 && b.daysLeft <= 7)
      const good = deptBatches.filter((b) => b.daysLeft > 7)

      const totalQuantity = deptBatches.reduce((sum, b) => sum + (b.quantity || 0), 0)

      return {
        id: dept.id,
        name: dept.name,
        color: dept.color,
        total: deptBatches.length,
        totalQuantity,
        expired: expired.length,
        critical: critical.length,
        warning: warning.length,
        good: good.length
      }
    })
  }, [batches, userDepartments])

  // Статистика по категориям
  const categoryStats = useMemo(() => {
    const categories = {}

    batches.forEach((batch) => {
      // Filter by user's department access (permission-based via isHotelAdmin)
      if (!isHotelAdmin() && !user?.departments?.includes(batch.departmentId)) return

      // Use categoryName from backend (properly resolved from JOIN)
      const cat = batch.categoryName || batch.category_name || 'other'
      if (!categories[cat]) {
        categories[cat] = { total: 0, expired: 0, quantity: 0 }
      }
      categories[cat].total++
      categories[cat].quantity += batch.quantity || 0
      if (batch.daysLeft < 0) categories[cat].expired++
    })

    return Object.entries(categories).map(([key, data]) => {
      const translatedName = t(`categories.${key}`)
      return {
        id: key,
        name: translatedName && !translatedName.includes('categories.') ? translatedName : key,
        ...data
      }
    })
  }, [batches, user, t, isHotelAdmin])

  // Топ товаров, требующих внимания
  const topAlertProducts = useMemo(() => {
    return batches
      .filter((b) => {
        // Filter by user's department access (permission-based)
        if (!isHotelAdmin() && !user?.departments?.includes(b.departmentId)) return false
        return b.daysLeft <= 7
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5)
  }, [batches, user, isHotelAdmin])

  // Подготовка данных для экспорта (синхронизировано с InventoryPage)
  const exportData = useMemo(() => {
    // Функция для получения названия категории
    const getCategoryName = (categoryId) => {
      const cat = categories.find(c => c.id === categoryId)
      if (!cat) return '-'
      if (language === 'ru') return cat.nameRu || cat.name || '-'
      if (language === 'kk') return cat.nameKz || cat.name || '-'
      return cat.name || '-'
    }

    // Функция для получения текста статуса
    // Синхронизировано с dateUtils.js - пороги: expired(<0), today(0), critical(1-3), warning(4-7), good(>7)
    const getStatusLabel = (status) => {
      if (!status) return '-'
      const statusMap = {
        good: t('common.good') || 'В норме',
        ok: t('common.good') || 'В норме',
        warning: t('common.warning') || 'Внимание',
        critical: t('common.critical') || 'Критично',
        today: t('common.today') || 'Истекает сегодня',
        expired: t('common.expired') || 'Просрочено'
      }
      return statusMap[status] || status || '-'
    }

    return batches.map((batch) => {
      const categoryName = getCategoryName(batch.categoryId) || '-'
      const status = batch.status?.status || batch.status
      
      return {
        productName: batch.name || batch.productName,
        category: categoryName,
        department: departments.find((d) => d.id === batch.departmentId)?.name || batch.departmentId,
        quantity: batch.quantity || 1,
        unit: batch.unit || 'шт',
        formattedDate: batch.expiryDate
          ? new Date(batch.expiryDate).toLocaleDateString('ru-RU')
          : '-',
        daysLeft: batch.daysLeft ?? '-',
        statusLabel: getStatusLabel(status),
        status: status || 'good'
      }
    })
  }, [batches, departments, categories, language, t])

  // Статистические карточки
  const statCards = [
    {
      title: t('statistics.totalBatches'),
      value: stats.total,
      icon: Package,
      color: 'text-foreground',
      bgColor: 'bg-muted'
    },
    {
      title: t('statistics.goodStatus'),
      value: stats.good,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
      trend: stats.total > 0 ? Math.round((stats.good / stats.total) * 100) : 0,
      trendLabel: '%'
    },
    {
      title: t('statistics.warning'),
      value: stats.warning,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    },
    {
      title: t('statistics.critical'),
      value: stats.critical,
      icon: AlertTriangle,
      color: 'text-danger',
      bgColor: 'bg-danger/10'
    },
    {
      title: t('statistics.expired'),
      value: stats.expired,
      icon: AlertTriangle,
      color: 'text-danger',
      bgColor: 'bg-danger/10'
    }
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-light text-foreground">{t('statistics.title')}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t('statistics.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          {/* Кнопка экспорта */}
          <ExportButton
            data={exportData}
            columns={EXPORT_COLUMNS.inventory(t)}
            filename="statistics_report"
            title={t('statistics.title')}
            subtitle={t('statistics.subtitle')}
            summary={{
              [t('statistics.totalBatches')]: stats.total,
              [t('statistics.goodStatus')]: stats.good,
              [t('statistics.warning')]: stats.warning,
              [t('statistics.critical')]: stats.critical + stats.expired
            }}
          />

          {/* Переключатель периода */}
          <div className="flex items-center gap-1 sm:gap-2 bg-card rounded-lg border border-border p-1">
            {['week', 'month', 'all'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-2 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                  selectedPeriod === period
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`statistics.period.${period}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Карточки статистики - Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-card rounded-xl border border-border p-3 sm:p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className={`p-1.5 sm:p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
              </div>
              {card.trend !== undefined && (
                <span
                  className={`text-xs font-medium ${card.trend >= 50 ? 'text-success' : 'text-warning'}`}
                >
                  {card.trend}
                  {card.trendLabel}
                </span>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-light text-foreground">{card.value}</p>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Статистика по отделам */}
      <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">{t('statistics.byDepartment')}</h2>

        <div className="space-y-4">
          {departmentStats.map((dept) => {
            const total = dept.total || 1
            const goodPercent = (dept.good / total) * 100
            const warningPercent = (dept.warning / total) * 100
            const criticalPercent = (dept.critical / total) * 100
            const expiredPercent = (dept.expired / total) * 100

            return (
              <div key={dept.id}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color }} />
                    <span className="text-sm font-medium text-foreground">{dept.name}</span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground ml-5 sm:ml-0">
                    <span>
                      {dept.total} {t('statistics.batches')}
                    </span>
                    <span>
                      {dept.totalQuantity} {t('inventory.units')}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                  <div className="bg-success transition-all" style={{ width: `${goodPercent}%` }} />
                  <div
                    className="bg-warning transition-all"
                    style={{ width: `${warningPercent}%` }}
                  />
                  <div
                    className="bg-danger transition-all"
                    style={{ width: `${criticalPercent}%` }}
                  />
                  <div
                    className="bg-red-800 transition-all"
                    style={{ width: `${expiredPercent}%` }}
                  />
                </div>

                {/* Legend - scrollable on mobile */}
                <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-muted-foreground overflow-x-auto pb-1">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                    {dept.good} {t('status.good')}
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                    {dept.warning} {t('status.warning')}
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-danger flex-shrink-0" />
                    {dept.critical} {t('status.urgent')}
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-red-800 flex-shrink-0" />
                    {dept.expired} {t('status.expired')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Статистика по категориям + Топ товары */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* По категориям */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">{t('statistics.byCategory')}</h2>

          <div className="space-y-2 sm:space-y-3">
            {categoryStats.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-foreground truncate flex-1">{cat.name}</span>
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    {cat.total} {t('statistics.batches')}
                  </span>
                  {cat.expired > 0 && (
                    <span className="text-xs text-danger whitespace-nowrap">
                      {cat.expired} {t('status.expired')}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {categoryStats.length === 0 && (
              <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">{t('statistics.noData')}</p>
            )}
          </div>
        </div>

        {/* Товары, требующие внимания */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-medium text-foreground mb-3 sm:mb-4">{t('statistics.topAlerts')}</h2>

          <div className="space-y-2 sm:space-y-3">
            {topAlertProducts.map((batch, index) => {
              const dept = departments.find((d) => d.id === batch.departmentId)

              return (
                <div key={batch.id} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-5 h-5 rounded-full bg-danger/10 text-danger text-xs flex items-center justify-center font-medium flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-foreground truncate">
                      {batch.productName || batch.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{dept?.name}</p>
                  </div>
                  <span
                    className={`text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                      batch.daysLeft < 0 ? 'text-danger' : 'text-warning'
                    }`}
                  >
                    {batch.daysLeft < 0
                      ? t('status.expiredDaysAgo', { days: Math.abs(batch.daysLeft) })
                      : batch.daysLeft === 0
                        ? t('status.expiresToday')
                        : t('status.expiresInDays', { days: batch.daysLeft })}
                  </span>
                </div>
              )
            })}

            {topAlertProducts.length === 0 && (
              <div className="text-center py-4">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-success mx-auto mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">{t('statistics.allGood')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
