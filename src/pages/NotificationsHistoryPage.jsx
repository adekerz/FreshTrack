/**
 * Notifications History Page - История уведомлений
 * Страница для просмотра истории отправленных Telegram уведомлений
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { useHotel } from '../context/HotelContext'
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
import { apiFetch } from '../services/api'

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
  const { selectedHotelId, selectedHotel } = useHotel()
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

        const data = await apiFetch(`/notifications/logs?${params}`)
        setLogs(data.logs)
        setPagination(data.pagination)
      } catch (err) {
        // Error already logged by apiFetch
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [pagination.limit, appliedFilters]
  )

  // Перезагружаем при смене отеля
  useEffect(() => {
    if (selectedHotelId) {
      fetchLogs(pagination.page)
    }
  }, [fetchLogs, pagination.page, selectedHotelId])

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
    <div className="space-y-4 sm:space-y-6 p-1 sm:p-0">
      {/* Заголовок и кнопки */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-light text-foreground">{t('notificationHistory.title')}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t('notificationHistory.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Кнопка фильтров */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 border rounded-lg text-xs sm:text-sm transition-colors flex-1 sm:flex-none justify-center ${
              hasActiveFilters
                ? 'border-accent text-accent bg-accent/5'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">{t('notificationHistory.filters')}</span>
            {hasActiveFilters && <span className="w-2 h-2 bg-accent rounded-full" />}
          </button>

          {/* Кнопка обновления */}
          <button
            onClick={() => fetchLogs(pagination.page)}
            disabled={loading}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-foreground text-background rounded-lg text-xs sm:text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
          <h3 className="font-medium text-foreground text-sm sm:text-base">{t('notificationHistory.filterOptions')}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Тип уведомления */}
            <div>
              <label className="block text-xs sm:text-sm text-muted-foreground mb-1">
                {t('notificationHistory.filterType')}
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm bg-card text-foreground"
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
              <label className="block text-xs sm:text-sm text-muted-foreground mb-1">
                {t('notificationHistory.startDate')}
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm bg-card text-foreground"
              />
            </div>

            {/* Дата конца */}
            <div>
              <label className="block text-xs sm:text-sm text-muted-foreground mb-1">
                {t('notificationHistory.endDate')}
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm bg-card text-foreground"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors order-2 sm:order-1"
            >
              {t('common.reset')}
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-foreground text-background rounded-lg text-sm hover:bg-foreground/90 transition-colors order-1 sm:order-2"
            >
              {t('common.apply')}
            </button>
          </div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 text-red-600 text-sm">{error}</div>
      )}

      {/* Таблица/Карточки уведомлений */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Send className="w-10 h-10 sm:w-12 sm:h-12 mb-4 opacity-50" />
            <p className="text-base sm:text-lg">{t('notificationHistory.noLogs')}</p>
            <p className="text-xs sm:text-sm">{t('notificationHistory.noLogsHint')}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('notificationHistory.columns.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('notificationHistory.columns.type')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('notificationHistory.columns.message')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('notificationHistory.columns.products')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('notificationHistory.columns.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('notificationHistory.columns.sentBy')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => {
                    const typeInfo = getNotificationType(log.type)
                    const TypeIcon = typeInfo.icon

                    return (
                      <tr key={log.id} className="hover:bg-muted transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
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
                        <td className="px-6 py-4 text-sm text-foreground max-w-md">
                          <p className="truncate">{log.message}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {log.products_count > 0 ? log.products_count : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              log.status === 'sent'
                                ? 'text-green-600'
                                : log.status === 'failed'
                                  ? 'text-red-600'
                                  : 'text-muted-foreground'
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {log.sent_by_name || t('notificationHistory.system')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {logs.map((log) => {
                const typeInfo = getNotificationType(log.type)
                const TypeIcon = typeInfo.icon

                return (
                  <div key={log.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {t(typeInfo.label)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.sent_at)}
                      </span>
                    </div>

                    <p className="text-sm text-foreground line-clamp-2">{log.message}</p>

                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          log.status === 'sent'
                            ? 'text-green-600'
                            : log.status === 'failed'
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {log.status === 'sent' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {t(`notificationHistory.status.${log.status}`)}
                      </span>
                      {log.products_count > 0 && (
                        <span className="text-muted-foreground">
                          {log.products_count} {t('notificationHistory.columns.products').toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Пагинация */}
            {pagination.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-border">
                <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
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
                    className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <span className="text-xs sm:text-sm text-foreground">
                    {pagination.page} / {pagination.totalPages}
                  </span>

                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
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
