import { useParams, Link } from 'react-router-dom'
import { Package, AlertTriangle, Clock, Check, ArrowLeft, PieChart } from 'lucide-react'
import { useProducts, departments } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'

export default function DepartmentDashboardPage() {
  const { departmentId } = useParams()
  const { t } = useTranslation()
  const { batches } = useProducts()

  // Найти отдел
  const department = departments.find((d) => d.id === departmentId)

  // Фильтр партий по отделу
  const departmentBatches = batches.filter((b) => b.department === departmentId)

  // Статистика отдела
  const stats = {
    total: departmentBatches.length,
    expired: departmentBatches.filter((b) => b.status === 'expired').length,
    critical: departmentBatches.filter((b) => b.status === 'critical').length,
    warning: departmentBatches.filter((b) => b.status === 'warning').length,
    good: departmentBatches.filter((b) => b.status === 'good').length
  }

  // Ближайшие истекающие
  const upcomingExpiry = departmentBatches
    .filter((b) => b.daysLeft >= 0 && b.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5)

  // Просроченные
  const expiredItems = departmentBatches
    .filter((b) => b.status === 'expired')
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // По категориям - use categoryName from backend (properly resolved)
  const byCategory = departmentBatches.reduce((acc, batch) => {
    const cat = batch.categoryName || batch.category_name || t('categories.other') || 'Другое'
    if (!acc[cat]) acc[cat] = { count: 0, expired: 0, warning: 0 }
    acc[cat].count++
    if (batch.status === 'expired') acc[cat].expired++
    if (batch.status === 'warning' || batch.status === 'critical') acc[cat].warning++
    return acc
  }, {})

  if (!department) {
    return (
      <div className="p-4 sm:p-8">
        <div className="text-center py-16">
          <h2 className="text-xl text-charcoal mb-4">
            {t('department.notFound') || 'Отдел не найден'}
          </h2>
          <Link to="/inventory" className="text-gold hover:underline">
            {t('common.back')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/inventory" className="p-2 hover:bg-sand rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-charcoal" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: department.color }} />
          <div>
            <h1 className="text-xl sm:text-2xl font-playfair text-charcoal dark:text-cream">
              {department.name}
            </h1>
            <p className="text-sm text-charcoal/60 dark:text-warmgray">
              {t('department.dashboard') || 'Дашборд отдела'}
            </p>
          </div>
        </div>
      </div>

      {/* Статистические карточки */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-dark-surface rounded-xl p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-charcoal/10 dark:bg-charcoal/20 rounded-lg">
              <Package className="w-5 h-5 text-charcoal dark:text-cream" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60 dark:text-warmgray">{t('dashboard.totalBatches')}</p>
              <p className="text-2xl font-semibold text-charcoal dark:text-cream">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60 dark:text-warmgray">{t('dashboard.expired')}</p>
              <p className="text-2xl font-semibold text-danger">{stats.expired}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60 dark:text-warmgray">{t('dashboard.expiringSoon')}</p>
              <p className="text-2xl font-semibold text-warning">
                {stats.critical + stats.warning}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Check className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60 dark:text-warmgray">{t('dashboard.goodStatus')}</p>
              <p className="text-2xl font-semibold text-success">{stats.good}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ближайшие истекающие */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-card border border-taupe/10 dark:border-dark-border p-6">
          <h3 className="text-lg font-semibold text-charcoal dark:text-cream mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            {t('department.upcomingExpiry') || 'Скоро истекают'}
          </h3>

          {upcomingExpiry.length > 0 ? (
            <div className="space-y-3">
              {upcomingExpiry.map((batch) => (
                <div
                  key={batch.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    batch.status === 'critical'
                      ? 'border-danger bg-danger/5'
                      : 'border-warning bg-warning/5'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-charcoal dark:text-cream">{batch.productName}</p>
                      <p className="text-sm text-charcoal/60 dark:text-warmgray">
                        {batch.quantity} {t('common.units')} • {batch.category}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        batch.daysLeft <= 3 ? 'text-danger' : 'text-warning'
                      }`}
                    >
                      {batch.daysLeft === 0
                        ? t('status.expiresToday')
                        : `${batch.daysLeft} ${t('common.days')}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-charcoal/50">
              <Check className="w-12 h-12 mx-auto mb-3 text-success opacity-50" />
              <p>{t('department.noUpcoming') || 'Нет товаров с близким сроком'}</p>
            </div>
          )}
        </div>

        {/* По категориям */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-card border border-taupe/10 dark:border-dark-border p-6">
          <h3 className="text-lg font-semibold text-charcoal dark:text-cream mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-gold" />
            {t('department.byCategory') || 'По категориям'}
          </h3>

          {Object.keys(byCategory).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(byCategory).map(([category, data]) => (
                <div
                  key={category}
                  className="flex items-center justify-between p-3 bg-sand/30 dark:bg-dark-border/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-charcoal dark:text-cream">{category}</p>
                    <p className="text-sm text-charcoal/60 dark:text-warmgray">
                      {data.count} {t('common.items')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {data.expired > 0 && (
                      <span className="px-2 py-1 bg-danger/10 text-danger text-xs rounded-full">
                        {data.expired} ❌
                      </span>
                    )}
                    {data.warning > 0 && (
                      <span className="px-2 py-1 bg-warning/10 text-warning text-xs rounded-full">
                        {data.warning} ⚠️
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-charcoal/50">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('department.noItems') || 'Нет товаров'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Просроченные товары */}
      {expiredItems.length > 0 && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-card border border-taupe/10 dark:border-dark-border p-6">
          <h3 className="text-lg font-semibold text-danger mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {t('department.expiredItems') || 'Просроченные товары'}
            <span className="ml-2 px-2 py-0.5 bg-danger/10 text-danger text-sm rounded-full">
              {expiredItems.length}
            </span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sand/30 dark:bg-dark-border/30">
                <tr>
                  <th className="text-left text-xs uppercase text-charcoal/60 p-3">
                    {t('inventory.product')}
                  </th>
                  <th className="text-left text-xs uppercase text-charcoal/60 p-3">
                    {t('inventory.category')}
                  </th>
                  <th className="text-left text-xs uppercase text-charcoal/60 p-3">
                    {t('inventory.quantity')}
                  </th>
                  <th className="text-left text-xs uppercase text-charcoal/60 p-3">
                    {t('inventory.expiryDate')}
                  </th>
                  <th className="text-left text-xs uppercase text-charcoal/60 p-3">
                    {t('common.daysLeft')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {expiredItems.map((batch) => (
                  <tr key={batch.id} className="border-t border-sand dark:border-dark-border">
                    <td className="p-3 font-medium text-charcoal dark:text-cream">{batch.productName}</td>
                    <td className="p-3 text-charcoal/70 dark:text-warmgray">{batch.category}</td>
                    <td className="p-3">{batch.quantity}</td>
                    <td className="p-3">{batch.expiryDate}</td>
                    <td className="p-3">
                      <span className="text-danger font-medium">
                        {Math.abs(batch.daysLeft)} {t('collect.overdue')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
