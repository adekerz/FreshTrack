import { useState, useEffect } from 'react'
import {
  FileText,
  Search,
  User,
  Clock,
  Package,
  Settings,
  LogIn,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  X,
  Eye,
  Database
} from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../utils/classNames'
import { formatDate } from '../utils/dateUtils'
import { apiFetch, API_BASE_URL } from '../services/api'

export default function AuditLogsPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    actionType: '',
    entityType: '',
    dateFrom: '',
    dateTo: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)

  useEffect(() => {
    loadLogs()
  }, [filters, pagination.page])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.actionType && { actionType: filters.actionType }),
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      })
      
      const data = await apiFetch(`/audit-logs?${params}`)
      setLogs(data.logs || [])
      setPagination(prev => ({ ...prev, total: data.total || 0 }))
    } catch {
      // Error already logged by apiFetch
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({
      actionType: '',
      entityType: '',
      dateFrom: '',
      dateTo: ''
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const exportLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/export/audit`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('freshtrack_token')}`
        }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.xlsx`
        a.click()
      }
    } catch {
      // Export error
    }
  }

  const getActionIcon = (action) => {
    const actionType = action?.toLowerCase() || ''
    switch (actionType) {
      case 'login':
        return <LogIn className="w-4 h-4 text-green-500" />
      case 'logout':
        return <LogOut className="w-4 h-4 text-gray-500" />
      case 'create':
        return <Plus className="w-4 h-4 text-blue-500" />
      case 'update':
        return <Edit2 className="w-4 h-4 text-yellow-500" />
      case 'delete':
        return <Trash2 className="w-4 h-4 text-red-500" />
      case 'collect':
        return <ShoppingCart className="w-4 h-4 text-purple-500" />
      case 'settingschange':
        return <Settings className="w-4 h-4 text-orange-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const getActionLabel = (action) => {
    if (!action) return 'Действие'
    const actionType = String(action).toLowerCase()
    const actions = t('auditLogs.actions') || {}
    return actions[actionType] || String(action) || 'Действие'
  }

  const getActionColor = (action) => {
    const actionType = action?.toLowerCase() || ''
    switch (actionType) {
      case 'login':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'logout':
        return 'bg-muted text-muted-foreground'
      case 'create':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'update':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'delete':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'collect':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'settingschange':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getEntityIcon = (entityType) => {
    switch (entityType?.toLowerCase()) {
      case 'product':
        return <Package className="w-4 h-4 text-blue-500" />
      case 'batch':
        return <Database className="w-4 h-4 text-green-500" />
      case 'user':
        return <User className="w-4 h-4 text-purple-500" />
      case 'settings':
        return <Settings className="w-4 h-4 text-orange-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '—'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('common.justNow') || 'Только что'
    if (diffMins < 60) return `${diffMins} ${t('common.minutesAgo') || 'мин. назад'}`
    if (diffHours < 24) return `${diffHours} ${t('common.hoursAgo') || 'ч. назад'}`
    if (diffDays < 7) return `${diffDays} ${t('common.daysAgo') || 'дн. назад'}`

    return formatDate(timestamp, true)
  }

  // Форматирование details (может быть объектом или строкой)
  const formatDetails = (details) => {
    if (!details) return '—'
    if (typeof details === 'string') return details
    if (typeof details === 'object') {
      try {
        return JSON.stringify(details, null, 2)
      } catch {
        return String(details)
      }
    }
    return String(details)
  }

  // Получить строку для поиска из details
  const getDetailsSearchString = (details) => {
    if (!details) return ''
    if (typeof details === 'string') return details.toLowerCase()
    if (typeof details === 'object') {
      try {
        return JSON.stringify(details).toLowerCase()
      } catch {
        return ''
      }
    }
    return String(details).toLowerCase()
  }

  // Локальная фильтрация по поиску
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      (log.userName || log.user || '').toLowerCase().includes(query) ||
      (log.entityName || log.target || '').toLowerCase().includes(query) ||
      getDetailsSearchString(log.details).includes(query)
    )
  })

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const hasActiveFilters = filters.actionType || filters.entityType || filters.dateFrom || filters.dateTo

  const actionTypes = [
    { value: 'login', label: t('auditLogs.actions.login') || 'Вход' },
    { value: 'logout', label: t('auditLogs.actions.logout') || 'Выход' },
    { value: 'create', label: t('auditLogs.actions.create') || 'Создание' },
    { value: 'update', label: t('auditLogs.actions.update') || 'Обновление' },
    { value: 'delete', label: t('auditLogs.actions.delete') || 'Удаление' },
    { value: 'collect', label: t('auditLogs.actions.collect') || 'Сбор' },
    { value: 'settingsChange', label: t('auditLogs.actions.settingsChange') || 'Изменение настроек' }
  ]

  const entityTypes = [
    { value: 'product', label: t('auditLogs.entities.product') || 'Продукт' },
    { value: 'batch', label: t('auditLogs.entities.batch') || 'Партия' },
    { value: 'user', label: t('auditLogs.entities.user') || 'Пользователь' },
    { value: 'category', label: t('auditLogs.entities.category') || 'Категория' },
    { value: 'settings', label: t('auditLogs.entities.settings') || 'Настройки' }
  ]

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-light text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
            {t('auditLogs.title') || 'Журнал действий'}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {t('auditLogs.subtitle') || 'История всех действий в системе'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            title={t('common.refresh') || 'Обновить'}
          >
            <RefreshCw className={cn('w-4 h-4 sm:w-5 sm:h-5', loading && 'animate-spin')} />
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.export') || 'Экспорт'}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search') || 'Поиск...'}
              className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border transition-colors text-sm flex-1 sm:flex-none justify-center',
                showFilters || hasActiveFilters
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.filters') || 'Фильтры'}</span>
              {hasActiveFilters && (
                <span className="ml-1 w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                  {[filters.actionType, filters.entityType, filters.dateFrom, filters.dateTo].filter(Boolean).length}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-danger hover:bg-danger/10 rounded-lg text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.reset') || 'Сбросить'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('auditLogs.filters.actionType') || 'Тип действия'}
              </label>
              <select
                value={filters.actionType}
                onChange={(e) => setFilters(prev => ({ ...prev, actionType: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option value="">{t('common.all') || 'Все'}</option>
                {actionTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Entity Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('auditLogs.filters.entityType') || 'Тип объекта'}
              </label>
              <select
                value={filters.entityType}
                onChange={(e) => setFilters(prev => ({ ...prev, entityType: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option value="">{t('common.all') || 'Все'}</option>
                {entityTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('auditLogs.filters.dateFrom') || 'Дата от'}
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('auditLogs.filters.dateTo') || 'Дата до'}
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {t('common.total') || 'Всего'}: <strong className="text-foreground">{pagination.total}</strong> {t('auditLogs.records') || 'записей'}
        </span>
        {hasActiveFilters && (
          <span>
            {t('common.filtered') || 'Отфильтровано'}: <strong className="text-foreground">{filteredLogs.length}</strong>
          </span>
        )}
      </div>

      {/* Logs List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('auditLogs.noLogs') || 'Журнал пуст'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.timestamp') || 'Время'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.user') || 'Пользователь'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.action') || 'Действие'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.entity') || 'Объект'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.details') || 'Детали'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.ipAddress') || 'IP'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('common.actions') || 'Действия'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">
                            {formatTimestamp(log.timestamp || log.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-accent" />
                          </div>
                          <span className="font-medium text-foreground">
                            {log.userName || log.user || 'Система'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                            getActionColor(log.action_type || log.action)
                          )}
                        >
                          {getActionIcon(log.action_type || log.action)}
                          {getActionLabel(log.action_type || log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getEntityIcon(log.entity_type)}
                          <div>
                            <span className="text-foreground">
                              {log.entity_name || log.target || '—'}
                            </span>
                            {log.entity_type && (
                              <span className="text-xs text-muted-foreground block">
                                {log.entity_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {formatDetails(log.details)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground font-mono">
                          {log.ip_address || log.ipAddress || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                          title={t('common.viewDetails') || 'Подробнее'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {filteredLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-4 space-y-3 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        getActionColor(log.action_type || log.action)
                      )}
                    >
                      {getActionIcon(log.action_type || log.action)}
                      {getActionLabel(log.action_type || log.action)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(log.timestamp || log.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {log.userName || log.user || 'Система'}
                    </span>
                  </div>

                  {(log.entity_name || log.target) && (
                    <div className="flex items-center gap-2 text-sm">
                      {getEntityIcon(log.entity_type)}
                      <span className="text-foreground">
                        {log.entity_name || log.target}
                      </span>
                    </div>
                  )}

                  {log.details && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {formatDetails(log.details)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {((pagination.page - 1) * pagination.limit) + 1}—
              {Math.min(pagination.page * pagination.limit, pagination.total)} {t('common.of') || 'из'}{' '}
              {pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1
                  } else if (pagination.page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = pagination.page - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      className={cn(
                        'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                        pageNum === pagination.page
                          ? 'bg-accent text-white'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                disabled={pagination.page === totalPages}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60">
          <div className="bg-card rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-light text-foreground">
                {t('auditLogs.logDetails') || 'Детали записи'}
              </h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">
                    {t('auditLogs.timestamp') || 'Время'}
                  </label>
                  <p className="font-medium text-foreground">
                    {formatDate(selectedLog.timestamp || selectedLog.created_at, true)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    {t('auditLogs.user') || 'Пользователь'}
                  </label>
                  <p className="font-medium text-foreground">
                    {selectedLog.userName || selectedLog.user || 'Система'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    {t('auditLogs.action') || 'Действие'}
                  </label>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mt-1',
                      getActionColor(selectedLog.action_type || selectedLog.action)
                    )}
                  >
                    {getActionIcon(selectedLog.action_type || selectedLog.action)}
                    {getActionLabel(selectedLog.action_type || selectedLog.action)}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">
                    {t('auditLogs.entity') || 'Объект'}
                  </label>
                  <p className="font-medium text-foreground">
                    {selectedLog.entity_name || selectedLog.target || '—'}
                  </p>
                  {selectedLog.entity_type && (
                    <span className="text-xs text-muted-foreground">
                      {selectedLog.entity_type} #{selectedLog.entity_id}
                    </span>
                  )}
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <label className="text-sm text-muted-foreground">
                    {t('auditLogs.details') || 'Детали'}
                  </label>
                  <pre className="mt-1 text-foreground whitespace-pre-wrap text-sm bg-muted p-3 rounded-lg">
                    {formatDetails(selectedLog.details)}
                  </pre>
                </div>
              )}

              {(selectedLog.old_value || selectedLog.new_value) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.old_value && (
                    <div>
                      <label className="text-sm text-muted-foreground">
                        {t('auditLogs.oldValue') || 'Старое значение'}
                      </label>
                      <pre className="mt-1 p-3 bg-danger/10 rounded-lg text-sm text-danger overflow-x-auto">
                        {typeof selectedLog.old_value === 'object' 
                          ? JSON.stringify(selectedLog.old_value, null, 2)
                          : selectedLog.old_value}
                      </pre>
                    </div>
                  )}
                  {selectedLog.new_value && (
                    <div>
                      <label className="text-sm text-muted-foreground">
                        {t('auditLogs.newValue') || 'Новое значение'}
                      </label>
                      <pre className="mt-1 p-3 bg-success/10 rounded-lg text-sm text-success overflow-x-auto">
                        {typeof selectedLog.new_value === 'object' 
                          ? JSON.stringify(selectedLog.new_value, null, 2)
                          : selectedLog.new_value}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <label className="text-sm text-muted-foreground">
                    {t('auditLogs.ipAddress') || 'IP-адрес'}
                  </label>
                  <p className="font-mono text-foreground">
                    {selectedLog.ip_address || selectedLog.ipAddress || '—'}
                  </p>
                </div>
                {selectedLog.user_agent && (
                  <div>
                    <label className="text-sm text-muted-foreground">
                      {t('auditLogs.userAgent') || 'User Agent'}
                    </label>
                    <p className="text-sm text-muted-foreground truncate" title={selectedLog.user_agent}>
                      {selectedLog.user_agent}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                {t('common.close') || 'Закрыть'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
