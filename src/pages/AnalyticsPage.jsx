/**
 * Analytics Page - Страница аналитики
 * Расширенная аналитика с рекомендациями и прогнозами
 */

import { useMemo } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useProducts, departments } from '../context/ProductContext'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  CalendarDays
} from 'lucide-react'

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const { user, isHotelAdmin } = useAuth()
  const { getActiveBatches, getStats } = useProducts()

  const stats = getStats()
  const batches = getActiveBatches()

  // Фильтрация по доступным отделам (permission-based)
  const filteredBatches = useMemo(() => {
    if (isHotelAdmin()) return batches
    return batches.filter((b) => user?.departments?.includes(b.departmentId))
  }, [batches, user, isHotelAdmin])

  // Расчет прогноза на следующую неделю
  const weekForecast = useMemo(() => {
    const now = new Date()
    const forecast = Array(7)
      .fill(0)
      .map((_, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        const expiringBatches = filteredBatches.filter((b) => {
          const expiry = new Date(b.expiryDate).toISOString().split('T')[0]
          return expiry === dateStr
        })

        return {
          date: dateStr,
          day: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
          dayNumber: date.getDate(),
          count: expiringBatches.length,
          batches: expiringBatches
        }
      })

    return forecast
  }, [filteredBatches])

  // Рекомендации на основе анализа
  const recommendations = useMemo(() => {
    const recs = []

    // Проверка просроченных товаров
    if (stats.expired > 0) {
      recs.push({
        type: 'danger',
        icon: AlertTriangle,
        title: t('analytics.recommendations.expiredProducts.title'),
        description: t('analytics.recommendations.expiredProducts.description', {
          count: stats.expired
        }),
        action: t('analytics.recommendations.expiredProducts.action')
      })
    }

    // Проверка критических товаров
    if (stats.critical > 0) {
      recs.push({
        type: 'warning',
        icon: Clock,
        title: t('analytics.recommendations.criticalProducts.title'),
        description: t('analytics.recommendations.criticalProducts.description', {
          count: stats.critical
        }),
        action: t('analytics.recommendations.criticalProducts.action')
      })
    }

    // Высокий процент проблемных товаров
    const problemPercent =
      stats.total > 0 ? ((stats.expired + stats.critical) / stats.total) * 100 : 0
    if (problemPercent > 20) {
      recs.push({
        type: 'warning',
        icon: TrendingDown,
        title: t('analytics.recommendations.highRisk.title'),
        description: t('analytics.recommendations.highRisk.description', {
          percent: Math.round(problemPercent)
        }),
        action: t('analytics.recommendations.highRisk.action')
      })
    }

    // Если все хорошо
    if (recs.length === 0) {
      recs.push({
        type: 'success',
        icon: CheckCircle,
        title: t('analytics.recommendations.allGood.title'),
        description: t('analytics.recommendations.allGood.description'),
        action: null
      })
    }

    return recs
  }, [stats, t])

  // Статистика по отделам для сравнения
  const departmentComparison = useMemo(() => {
    const userDepts = isHotelAdmin()
      ? departments
      : departments.filter((d) => user?.departments?.includes(d.id))

    return userDepts
      .map((dept) => {
        const deptBatches = filteredBatches.filter((b) => b.departmentId === dept.id)
        const problemBatches = deptBatches.filter((b) => b.daysLeft <= 3)
        const healthScore =
          deptBatches.length > 0
            ? Math.round(((deptBatches.length - problemBatches.length) / deptBatches.length) * 100)
            : 100

        return {
          id: dept.id,
          name: dept.name,
          color: dept.color,
          total: deptBatches.length,
          problems: problemBatches.length,
          healthScore
        }
      })
      .sort((a, b) => b.healthScore - a.healthScore)
  }, [filteredBatches, user, isHotelAdmin])

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-2xl font-light text-charcoal dark:text-cream">{t('analytics.title')}</h1>
        <p className="text-warmgray dark:text-warmgray/80 text-sm mt-1">{t('analytics.subtitle')}</p>
      </div>

      {/* Рекомендации */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-medium text-charcoal dark:text-cream">
            {t('analytics.recommendations.title')}
          </h2>
        </div>

        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <div
              key={index}
              className={`flex items-start gap-4 p-4 rounded-lg ${
                rec.type === 'danger'
                  ? 'bg-red-50 border border-red-100'
                  : rec.type === 'warning'
                    ? 'bg-amber-50 border border-amber-100'
                    : 'bg-green-50 border border-green-100'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  rec.type === 'danger'
                    ? 'bg-red-100'
                    : rec.type === 'warning'
                      ? 'bg-amber-100'
                      : 'bg-green-100'
                }`}
              >
                <rec.icon
                  className={`w-5 h-5 ${
                    rec.type === 'danger'
                      ? 'text-red-600'
                      : rec.type === 'warning'
                        ? 'text-amber-600'
                        : 'text-green-600'
                  }`}
                />
              </div>
              <div className="flex-1">
                <h3
                  className={`font-medium ${
                    rec.type === 'danger'
                      ? 'text-red-800'
                      : rec.type === 'warning'
                        ? 'text-amber-800'
                        : 'text-green-800'
                  }`}
                >
                  {rec.title}
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    rec.type === 'danger'
                      ? 'text-red-600'
                      : rec.type === 'warning'
                        ? 'text-amber-600'
                        : 'text-green-600'
                  }`}
                >
                  {rec.description}
                </p>
                {rec.action && (
                  <p
                    className={`text-sm mt-2 font-medium ${
                      rec.type === 'danger'
                        ? 'text-red-700'
                        : rec.type === 'warning'
                          ? 'text-amber-700'
                          : 'text-green-700'
                    }`}
                  >
                    → {rec.action}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Прогноз на неделю */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-medium text-charcoal dark:text-cream">{t('analytics.weekForecast')}</h2>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekForecast.map((day, index) => (
            <div
              key={day.date}
              className={`text-center p-3 rounded-lg ${
                index === 0
                  ? 'bg-charcoal text-white'
                  : day.count > 0
                    ? 'bg-warning/10 border border-warning/30'
                    : 'bg-cream/50 dark:bg-dark-border'
              }`}
            >
              <p className={`text-xs ${index === 0 ? 'text-white/70' : 'text-warmgray'}`}>
                {day.day}
              </p>
              <p className={`text-lg font-medium ${index === 0 ? 'text-white' : 'text-charcoal dark:text-cream'}`}>
                {day.dayNumber}
              </p>
              {day.count > 0 && (
                <p
                  className={`text-xs font-medium mt-1 ${
                    index === 0 ? 'text-warning' : 'text-warning'
                  }`}
                >
                  {day.count} {t('analytics.expiring')}
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="text-sm text-warmgray mt-4">{t('analytics.weekForecastHint')}</p>
      </div>

      {/* Сравнение отделов */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-medium text-charcoal dark:text-cream">{t('analytics.departmentHealth')}</h2>
        </div>

        <div className="space-y-4">
          {departmentComparison.map((dept) => (
            <div key={dept.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                  <span className="text-sm font-medium text-charcoal dark:text-cream">{dept.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-medium ${
                      dept.healthScore >= 80
                        ? 'text-success'
                        : dept.healthScore >= 50
                          ? 'text-warning'
                          : 'text-danger'
                    }`}
                  >
                    {dept.healthScore}%
                  </span>
                  {dept.problems > 0 && (
                    <span className="text-xs text-danger">
                      {dept.problems} {t('analytics.issues')}
                    </span>
                  )}
                </div>
              </div>

              {/* Health bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    dept.healthScore >= 80
                      ? 'bg-success'
                      : dept.healthScore >= 50
                        ? 'bg-warning'
                        : 'bg-danger'
                  }`}
                  style={{ width: `${dept.healthScore}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Общий показатель здоровья */}
      <div className="bg-gradient-to-r from-charcoal to-charcoal/80 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm">{t('analytics.overallHealth')}</p>
            <p className="text-4xl font-light mt-1">
              {stats.total > 0 ? Math.round((stats.good / stats.total) * 100) : 100}%
            </p>
            <p className="text-white/70 text-sm mt-2">
              {stats.good} {t('analytics.outOf')} {stats.total} {t('analytics.batchesHealthy')}
            </p>
          </div>
          <div className="text-right">
            {stats.good / stats.total >= 0.8 ? (
              <TrendingUp className="w-12 h-12 text-success" />
            ) : (
              <TrendingDown className="w-12 h-12 text-warning" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
