/**
 * Collection History Page - История сборов
 * Страница для просмотра истории сборов товаров (только для admin)
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { Navigate } from 'react-router-dom'
import { Filter, RefreshCw, ChevronLeft, ChevronRight, ArchiveX, User, Package } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Причины сбора
const REASONS = {
  manual: { label: 'collectionHistory.reasons.manual', color: 'bg-blue-100 text-blue-800' },
  expired: { label: 'collectionHistory.reasons.expired', color: 'bg-red-100 text-red-800' },
  damaged: { label: 'collectionHistory.reasons.damaged', color: 'bg-orange-100 text-orange-800' },
  kitchen: { label: 'collectionHistory.reasons.kitchen', color: 'bg-green-100 text-green-800' },
  disposed: { label: 'collectionHistory.reasons.disposed', color: 'bg-yellow-100 text-yellow-800' },
  staff: { label: 'collectionHistory.reasons.staff', color: 'bg-purple-100 text-purple-800' },
  returned: { label: 'collectionHistory.reasons.returned', color: 'bg-cyan-100 text-cyan-800' },
  other: { label: 'collectionHistory.reasons.other', color: 'bg-gray-100 text-gray-800' }
}

export default function CollectionHistoryPage() {
  const { t } = useTranslation()
  const { isHotelAdmin, hasPermission } = useAuth()
  const { departments } = useProducts()
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Фильтры
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    departmentId: '',
    reason: '',
    startDate: '',
    endDate: ''
  })
  const [appliedFilters, setAppliedFilters] = useState({})

  // Загрузка статистики
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/write-offs/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('freshtrack_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStats({ today: data.today, week: data.week, month: data.month, total: data.total })
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [])

  // Загрузка логов
  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          limit: pagination.limit.toString(),
          offset: ((page - 1) * pagination.limit).toString()
        })

        if (appliedFilters.departmentId) params.append('department_id', appliedFilters.departmentId)
        if (appliedFilters.reason) params.append('reason', appliedFilters.reason)
        if (appliedFilters.startDate) params.append('start_date', appliedFilters.startDate)
        if (appliedFilters.endDate) params.append('end_date', appliedFilters.endDate)

        const response = await fetch(`${API_URL}/write-offs?${params}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('freshtrack_token')}`
          }
        })

        if (!response.ok) throw new Error('Failed to fetch logs')

        const data = await response.json()
        // Transform write_offs to expected log format
        const writeOffs = data.write_offs || []
        const transformedLogs = writeOffs.map(wo => ({
          id: wo.id,
          productName: wo.product_name || wo.productName || 'Неизвестный товар',
          departmentId: wo.department_id || wo.departmentId,
          quantity: wo.quantity,
          expiryDate: wo.expiry_date || wo.expiryDate,
          reason: wo.reason,
          comment: wo.notes || wo.comment,
          collectedAt: wo.created_at || wo.createdAt,
          collectedByName: wo.user_name || wo.userName
        }))
        
        setLogs(transformedLogs)
        // Calculate pagination from response or estimate
        const total = data.total || writeOffs.length
        const totalPages = Math.ceil(total / pagination.limit)
        setPagination(prev => ({ ...prev, page, total, totalPages }))
      } catch (err) {
        console.error('Error fetching logs:', err)
        setError(err.message)
        setLogs([])
      } finally {
        setLoading(false)
      }
    },
    [pagination.limit, appliedFilters]
  )

  useEffect(() => {
    // Permission-based access check
    if (isHotelAdmin() || hasPermission('collections:read')) {
      fetchLogs(pagination.page)
      fetchStats()
    }
  }, [fetchLogs, fetchStats, pagination.page, isHotelAdmin, hasPermission])

  // Проверка прав доступа (permission-based)
  const canAccessPage = isHotelAdmin() || hasPermission('collections:read')
  if (!canAccessPage) {
    return <Navigate to="/" replace />
  }

  // Применение фильтров
  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters })
    setPagination((prev) => ({ ...prev, page: 1 }))
    setShowFilters(false)
  }

  // Сброс фильтров
  const handleResetFilters = () => {
    setFilters({ departmentId: '', reason: '', startDate: '', endDate: '' })
    setAppliedFilters({})
    setPagination((prev) => ({ ...prev, page: 1 }))
    setShowFilters(false)
  }

  // Форматирование даты
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // Форматирование только даты
  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  }

  // Получение причины
  const getReason = (reason) => {
    return REASONS[reason] || REASONS.other
  }

  // Проверка наличия активных фильтров
  const hasActiveFilters =
    appliedFilters.departmentId ||
    appliedFilters.reason ||
    appliedFilters.startDate ||
    appliedFilters.endDate

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-light text-charcoal dark:text-cream">{t('collectionHistory.title')}</h1>
          <p className="text-warmgray dark:text-warmgray/80 text-xs sm:text-sm mt-1">{t('collectionHistory.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Кнопка фильтров */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border rounded-lg text-xs sm:text-sm transition-colors ${
              hasActiveFilters
                ? 'border-accent text-accent bg-accent/5'
                : 'border-sand dark:border-dark-border text-warmgray dark:text-cream/70 hover:bg-sand/50 dark:hover:bg-dark-border'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">{t('collectionHistory.filters')}</span>
            {hasActiveFilters && <span className="w-2 h-2 bg-accent rounded-full" />}
          </button>

          {/* Кнопка обновления */}
          <button
            onClick={() => {
              fetchLogs(pagination.page)
              fetchStats()
            }}
            disabled={loading}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-charcoal text-white rounded-lg text-xs sm:text-sm hover:bg-charcoal/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Статистика - Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-warmgray dark:text-warmgray/80">{t('collectionHistory.stats.today')}</p>
          <p className="text-xl sm:text-2xl font-light text-charcoal dark:text-cream">{stats.today}</p>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-warmgray dark:text-warmgray/80">{t('collectionHistory.stats.week')}</p>
          <p className="text-xl sm:text-2xl font-light text-charcoal dark:text-cream">{stats.week}</p>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-warmgray dark:text-warmgray/80">{t('collectionHistory.stats.month')}</p>
          <p className="text-xl sm:text-2xl font-light text-charcoal dark:text-cream">{stats.month}</p>
        </div>
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-warmgray dark:text-warmgray/80">{t('collectionHistory.stats.total')}</p>
          <p className="text-xl sm:text-2xl font-light text-charcoal dark:text-cream">{stats.total}</p>
        </div>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border p-6 space-y-4">
          <h3 className="font-medium text-charcoal dark:text-cream">{t('collectionHistory.filterOptions')}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Отдел */}
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('collectionHistory.filterDepartment')}
              </label>
              <select
                value={filters.departmentId}
                onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
                className="w-full px-3 py-2 border border-sand dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-dark-bg dark:text-cream"
              >
                <option value="">{t('collectionHistory.allDepartments')}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Причина */}
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('collectionHistory.filterReason')}
              </label>
              <select
                value={filters.reason}
                onChange={(e) => setFilters((prev) => ({ ...prev, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-sand dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-dark-bg dark:text-cream"
              >
                <option value="">{t('collectionHistory.allReasons')}</option>
                {Object.entries(REASONS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </div>

            {/* Дата начала */}
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('collectionHistory.startDate')}
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-sand dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-dark-bg dark:text-cream"
              />
            </div>

            {/* Дата конца */}
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('collectionHistory.endDate')}
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-sand dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white dark:bg-dark-bg dark:text-cream"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-sm text-warmgray hover:text-charcoal transition-colors"
            >
              {t('common.reset')}
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-charcoal text-white rounded-lg text-sm hover:bg-charcoal/90 transition-colors"
            >
              {t('common.apply')}
            </button>
          </div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">{error}</div>
      )}

      {/* Таблица сборов / Карточки на мобильных */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-sand dark:border-dark-border overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-warmgray animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-warmgray">
            <ArchiveX className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 opacity-50" />
            <p className="text-base sm:text-lg">{t('collectionHistory.noLogs')}</p>
            <p className="text-xs sm:text-sm">{t('collectionHistory.noLogsHint')}</p>
          </div>
        ) : (
          <>
            {/* Мобильный вид - карточки */}
            <div className="sm:hidden divide-y divide-sand/50">
              {logs.map((log) => {
                const reasonInfo = getReason(log.reason)
                const dept = departments.find(d => d.id === log.departmentId)
                const department = dept || { name: log.departmentId || 'N/A', color: '#C4A35A' }

                return (
                  <div key={log.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-warmgray flex-shrink-0" />
                        <span className="text-sm font-medium text-charcoal truncate">{log.productName}</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${reasonInfo.color}`}>
                        {t(reasonInfo.label)}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-warmgray">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: `${department.color}20`, color: department.color }}>
                        {department.name}
                      </span>
                      <span>{log.quantity} {t('inventory.units')}</span>
                      <span>•</span>
                      <span>{formatDate(log.collectedAt)}</span>
                    </div>
                    
                    {log.comment && (
                      <p className="text-xs text-warmgray line-clamp-2">{log.comment}</p>
                    )}
                    
                    <div className="flex items-center gap-1 text-xs text-warmgray">
                      <User className="w-3 h-3" />
                      {log.collectedByName || t('collectionHistory.system')}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Десктопный вид - таблица */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream/50">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('collectionHistory.columns.date')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('collectionHistory.columns.product')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider hidden md:table-cell">
                      {t('collectionHistory.columns.department')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('collectionHistory.columns.quantity')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider hidden lg:table-cell">
                      {t('collectionHistory.columns.expiryDate')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('collectionHistory.columns.reason')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider hidden xl:table-cell">
                      {t('collectionHistory.columns.comment')}
                    </th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider hidden lg:table-cell">
                      {t('collectionHistory.columns.collectedBy')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/50">
                  {logs.map((log) => {
                    const reasonInfo = getReason(log.reason)
                    const dept = departments.find(d => d.id === log.departmentId)
                    const department = dept || { name: log.departmentId || 'N/A', color: '#C4A35A' }

                    return (
                      <tr key={log.id} className="hover:bg-cream/30 transition-colors">
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-charcoal">
                          {formatDate(log.collectedAt)}
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-warmgray" />
                            <span className="text-xs lg:text-sm text-charcoal font-medium">{log.productName}</span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap hidden md:table-cell">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${department.color}20`, color: department.color }}>
                            {department.name}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-charcoal">
                          {log.quantity} {t('inventory.units')}
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-charcoal hidden lg:table-cell">
                          {formatDateOnly(log.expiryDate)}
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${reasonInfo.color}`}>
                            {t(reasonInfo.label)}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm text-warmgray max-w-xs truncate hidden xl:table-cell" title={log.comment || ''}>
                          {log.comment || '-'}
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap hidden lg:table-cell">
                          <div className="flex items-center gap-2 text-xs lg:text-sm text-warmgray">
                            <User className="w-4 h-4" />
                            {log.collectedByName || t('collectionHistory.system')}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-sand/50">
                <p className="text-xs sm:text-sm text-warmgray hidden sm:block">
                  {t('collectionHistory.showing', {
                    from: (pagination.page - 1) * pagination.limit + 1,
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total
                  })}
                </p>
                <p className="text-xs text-warmgray sm:hidden">
                  {pagination.page} / {pagination.totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="p-2 text-warmgray hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="text-sm text-charcoal hidden sm:inline">
                    {pagination.page} / {pagination.totalPages}
                  </span>

                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 text-warmgray hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
