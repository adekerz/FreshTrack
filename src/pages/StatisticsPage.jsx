/**
 * Statistics Page - Страница статистики
 * Отображает ключевые метрики и графики по товарам
 */

import { useState, useMemo } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useProducts, departments } from '../context/ProductContext'
import ExportButton from '../components/ExportButton'
import { EXPORT_COLUMNS } from '../utils/exportUtils'
import { Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function StatisticsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { getActiveBatches, getStats } = useProducts()
  const [selectedPeriod, setSelectedPeriod] = useState('week')

  const stats = getStats()
  const batches = getActiveBatches()

  // Фильтрация доступных отделов для пользователя
  const userDepartments = useMemo(() => {
    if (user?.role === 'admin') return departments
    return departments.filter((d) => user?.departments?.includes(d.id))
  }, [user])

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
      if (!user?.role === 'admin' && !user?.departments?.includes(batch.departmentId)) return

      const cat = batch.category || 'other'
      if (!categories[cat]) {
        categories[cat] = { total: 0, expired: 0, quantity: 0 }
      }
      categories[cat].total++
      categories[cat].quantity += batch.quantity || 0
      if (batch.daysLeft < 0) categories[cat].expired++
    })

    return Object.entries(categories).map(([key, data]) => ({
      id: key,
      name: t(`categories.${key}`) || key,
      ...data
    }))
  }, [batches, user, t])

  // Топ товаров, требующих внимания
  const topAlertProducts = useMemo(() => {
    return batches
      .filter((b) => {
        if (user?.role !== 'admin' && !user?.departments?.includes(b.departmentId)) return false
        return b.daysLeft <= 7
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5)
  }, [batches, user])

  // Подготовка данных для экспорта
  const exportData = useMemo(() => {
    return batches.map((batch) => ({
      productName: batch.name || batch.productName,
      category: t(`categories.${batch.category}`) || batch.category,
      department: departments.find((d) => d.id === batch.departmentId)?.name || batch.departmentId,
      quantity: batch.quantity || 1,
      unit: batch.unit || 'шт',
      formattedDate: batch.expiryDate
        ? new Date(batch.expiryDate).toLocaleDateString('ru-RU')
        : '-',
      daysLeft: batch.daysLeft ?? '-',
      statusLabel:
        {
          good: t('common.good') || 'Хорошо',
          warning: t('common.warning') || 'Внимание',
          critical: t('common.critical') || 'Критично',
          expired: t('common.expired') || 'Просрочено'
        }[batch.status] || '-',
      status: batch.status
    }))
  }, [batches, t])

  // Статистические карточки
  const statCards = [
    {
      title: t('statistics.totalBatches'),
      value: stats.total,
      icon: Package,
      color: 'text-charcoal',
      bgColor: 'bg-sand/50'
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
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-charcoal">{t('statistics.title')}</h1>
          <p className="text-warmgray text-sm mt-1">{t('statistics.subtitle')}</p>
        </div>

        <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2 bg-white rounded-lg border border-sand p-1">
            {['week', 'month', 'all'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  selectedPeriod === period
                    ? 'bg-charcoal text-white'
                    : 'text-warmgray hover:text-charcoal'
                }`}
              >
                {t(`statistics.period.${period}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-xl border border-sand p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
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
            <p className="text-2xl font-light text-charcoal">{card.value}</p>
            <p className="text-sm text-warmgray">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Статистика по отделам */}
      <div className="bg-white rounded-xl border border-sand p-6">
        <h2 className="text-lg font-medium text-charcoal mb-4">{t('statistics.byDepartment')}</h2>

        <div className="space-y-4">
          {departmentStats.map((dept) => {
            const total = dept.total || 1
            const goodPercent = (dept.good / total) * 100
            const warningPercent = (dept.warning / total) * 100
            const criticalPercent = (dept.critical / total) * 100
            const expiredPercent = (dept.expired / total) * 100

            return (
              <div key={dept.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                    <span className="text-sm font-medium text-charcoal">{dept.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-warmgray">
                    <span>
                      {dept.total} {t('statistics.batches')}
                    </span>
                    <span>
                      {dept.totalQuantity} {t('inventory.units')}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
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

                {/* Legend */}
                <div className="flex items-center gap-4 mt-2 text-xs text-warmgray">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    {dept.good} {t('status.good')}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    {dept.warning} {t('status.warning')}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-danger" />
                    {dept.critical} {t('status.urgent')}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-800" />
                    {dept.expired} {t('status.expired')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Статистика по категориям + Топ товары */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* По категориям */}
        <div className="bg-white rounded-xl border border-sand p-6">
          <h2 className="text-lg font-medium text-charcoal mb-4">{t('statistics.byCategory')}</h2>

          <div className="space-y-3">
            {categoryStats.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between">
                <span className="text-sm text-charcoal">{cat.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-warmgray">
                    {cat.total} {t('statistics.batches')}
                  </span>
                  {cat.expired > 0 && (
                    <span className="text-xs text-danger">
                      {cat.expired} {t('status.expired')}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {categoryStats.length === 0 && (
              <p className="text-sm text-warmgray text-center py-4">{t('statistics.noData')}</p>
            )}
          </div>
        </div>

        {/* Товары, требующие внимания */}
        <div className="bg-white rounded-xl border border-sand p-6">
          <h2 className="text-lg font-medium text-charcoal mb-4">{t('statistics.topAlerts')}</h2>

          <div className="space-y-3">
            {topAlertProducts.map((batch, index) => {
              const dept = departments.find((d) => d.id === batch.departmentId)

              return (
                <div key={batch.id} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-danger/10 text-danger text-xs flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-charcoal truncate">
                      {batch.productName || batch.name}
                    </p>
                    <p className="text-xs text-warmgray">{dept?.name}</p>
                  </div>
                  <span
                    className={`text-xs font-medium ${
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
                <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                <p className="text-sm text-warmgray">{t('statistics.allGood')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
