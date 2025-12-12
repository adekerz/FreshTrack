/**
 * Notifications History Page - История уведомлений
 * Страница для просмотра истории отправленных Telegram уведомлений
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../context/LanguageContext'
import {
  Send,
  Filter,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Типы уведомлений и их отображение
const NOTIFICATION_TYPES = {
  daily_alert: {
    label: 'notificationHistory.types.dailyAlert',
    color: 'bg-blue-100 text-blue-800',
    icon: Calendar
  },
  test: {
    label: 'notificationHistory.types.test',
    color: 'bg-gray-100 text-gray-800',
    icon: CheckCircle
  },
  expired_alert: {
    label: 'notificationHistory.types.expiredAlert',
    color: 'bg-red-100 text-red-800',
    icon: AlertCircle
  },
  expiring_soon: {
    label: 'notificationHistory.types.expiringSoon',
    color: 'bg-amber-100 text-amber-800',
    icon: AlertCircle
  },
  manual: {
    label: 'notificationHistory.types.manual',
    color: 'bg-green-100 text-green-800',
    icon: Send
  }
}

export default function NotificationsHistoryPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState([])
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
    type: '',
    startDate: '',
    endDate: ''
  })
  const [appliedFilters, setAppliedFilters] = useState({})

  // Загрузка логов
  const fetchLogs = useCallback(
    async (page = 1) => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: pagination.limit.toString()
        })

        if (appliedFilters.type) params.append('type', appliedFilters.type)
        if (appliedFilters.startDate) params.append('startDate', appliedFilters.startDate)
        if (appliedFilters.endDate) params.append('endDate', appliedFilters.endDate)

        const response = await fetch(`${API_URL}/notifications/logs?${params}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('freshtrack_token')}`
          }
        })

        if (!response.ok) throw new Error('Failed to fetch logs')

        const data = await response.json()
        setLogs(data.logs)
        setPagination(data.pagination)
      } catch (err) {
        console.error('Error fetching logs:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [pagination.limit, appliedFilters]
  )

  useEffect(() => {
    fetchLogs(pagination.page)
  }, [fetchLogs, pagination.page])

  // Применение фильтров
  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters })
    setPagination((prev) => ({ ...prev, page: 1 }))
    setShowFilters(false)
  }

  // Сброс фильтров
  const handleResetFilters = () => {
    setFilters({ type: '', startDate: '', endDate: '' })
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

  // Получение типа уведомления
  const getNotificationType = (type) => {
    return (
      NOTIFICATION_TYPES[type] || {
        label: type,
        color: 'bg-gray-100 text-gray-800',
        icon: Send
      }
    )
  }

  // Проверка наличия активных фильтров
  const hasActiveFilters = appliedFilters.type || appliedFilters.startDate || appliedFilters.endDate

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопки */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-charcoal">{t('notificationHistory.title')}</h1>
          <p className="text-warmgray text-sm mt-1">{t('notificationHistory.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Кнопка фильтров */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm transition-colors ${
              hasActiveFilters
                ? 'border-accent text-accent bg-accent/5'
                : 'border-sand text-warmgray hover:bg-sand/50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t('notificationHistory.filters')}
            {hasActiveFilters && <span className="w-2 h-2 bg-accent rounded-full" />}
          </button>

          {/* Кнопка обновления */}
          <button
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-lg text-sm hover:bg-charcoal/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-sand p-6 space-y-4">
          <h3 className="font-medium text-charcoal">{t('notificationHistory.filterOptions')}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Тип уведомления */}
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('notificationHistory.filterType')}
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option value="">{t('notificationHistory.allTypes')}</option>
                {Object.entries(NOTIFICATION_TYPES).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </div>

            {/* Дата начала */}
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('notificationHistory.startDate')}
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            {/* Дата конца */}
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('notificationHistory.endDate')}
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
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

      {/* Таблица уведомлений */}
      <div className="bg-white rounded-xl border border-sand overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-warmgray animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-warmgray">
            <Send className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">{t('notificationHistory.noLogs')}</p>
            <p className="text-sm">{t('notificationHistory.noLogsHint')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-cream/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('notificationHistory.columns.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('notificationHistory.columns.type')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('notificationHistory.columns.message')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('notificationHistory.columns.products')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('notificationHistory.columns.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-warmgray uppercase tracking-wider">
                      {t('notificationHistory.columns.sentBy')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand/50">
                  {logs.map((log) => {
                    const typeInfo = getNotificationType(log.type)
                    const TypeIcon = typeInfo.icon

                    return (
                      <tr key={log.id} className="hover:bg-cream/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                          {formatDate(log.sent_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}
                          >
                            <TypeIcon className="w-3.5 h-3.5" />
                            {t(typeInfo.label)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-charcoal max-w-md">
                          <p className="truncate">{log.message}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-charcoal">
                          {log.products_count > 0 ? log.products_count : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              log.status === 'sent'
                                ? 'text-green-600'
                                : log.status === 'failed'
                                  ? 'text-red-600'
                                  : 'text-warmgray'
                            }`}
                          >
                            {log.status === 'sent' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <AlertCircle className="w-4 h-4" />
                            )}
                            {t(`notificationHistory.status.${log.status}`)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-warmgray">
                          {log.sent_by_name || t('notificationHistory.system')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-sand/50">
                <p className="text-sm text-warmgray">
                  {t('notificationHistory.showing', {
                    from: (pagination.page - 1) * pagination.limit + 1,
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total
                  })}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1}
                    className="p-2 text-warmgray hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <span className="text-sm text-charcoal">
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
