import { useState, useEffect } from 'react'
import {
  FileText,
  Search,
  LogIn,
  LogOut,
  Plus,
  Edit2,
  Trash2,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Calendar,
  X,
  Eye,
  Settings,
  Shield,
  Users,
  AlertCircle,
  AlertTriangle,
  Info,
  Download,
  Upload,
  UserCheck,
  UserX,
  Link,
  Unlink
} from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { useHotel } from '../context/HotelContext'
import { cn } from '../utils/classNames'
import { formatDate } from '../utils/dateUtils'
import { apiFetch, API_BASE_URL } from '../services/api'
import ExportButton from '../components/ExportButton'
import { EXPORT_COLUMNS } from '../utils/exportUtils'
import { PageLoader } from '../components/ui'
import { ActivityChart } from '../components/audit/ActivityChart'
import { AuditDetailsModal } from '../components/audit/AuditDetailsModal'
import { useToast } from '../context/ToastContext'
import { useAuditSSE } from '../hooks/useAuditSSE'

export default function AuditLogsPage() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId, selectedHotel } = useHotel()
  const { newLogs, clearNewLogs } = useAuditSSE(!!selectedHotelId)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    actionType: '',
    entityType: '',
    dateFrom: '',
    dateTo: '',
    userId: '',
    departmentId: '',
    severity: '',
    securityOnly: false
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  useEffect(() => {
    if (selectedHotelId) {
      loadLogs()
      loadStats()
      loadUsers()
      loadDepartments()
    }
  }, [selectedHotelId, filters, pagination.page])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: ((pagination.page - 1) * pagination.limit).toString(),
        ...(filters.actionType && { action: filters.actionType }),
        ...(filters.entityType && { entityType: filters.entityType }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.departmentId && { departmentId: filters.departmentId }),
        ...(filters.severity && { severity: filters.severity }),
        ...(filters.securityOnly && { securityOnly: 'true' })
      })

      const data = await apiFetch(`/audit-logs?${params}`)
      setLogs(data.logs || [])
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total ?? data.total ?? 0
      }))
    } catch {
      setLogs([])
      addToast(t('auditLogs.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await apiFetch('/audit-logs/stats?days=7')
      setStats(data.stats ?? null)
    } catch {
      setStats(null)
    }
  }

  const loadUsers = async () => {
    try {
      const data = await apiFetch('/audit-logs/users')
      setUsers(data.users || [])
    } catch {
      setUsers([])
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await apiFetch('/departments')
      setDepartments(data.departments || [])
    } catch {
      setDepartments([])
    }
  }

  /** Параметры для экспорта (те же фильтры, что и для списка) */
  const buildExportParams = () => {
    const p = new URLSearchParams()
    const selectedHotelId = localStorage.getItem('freshtrack_selected_hotel')
    if (selectedHotelId) p.set('hotel_id', selectedHotelId)
    if (filters.actionType) p.set('action', filters.actionType)
    if (filters.entityType) p.set('entityType', filters.entityType)
    if (filters.dateFrom) p.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) p.set('dateTo', filters.dateTo)
    if (filters.userId) p.set('userId', filters.userId)
    if (filters.departmentId) p.set('departmentId', filters.departmentId)
    if (filters.severity) p.set('severity', filters.severity)
    if (filters.securityOnly) p.set('securityOnly', 'true')
    return p
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const params = buildExportParams()
      const token = localStorage.getItem('freshtrack_token')
      const url = `${API_BASE_URL}/audit-logs/export/pdf?${params}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const filename =
        disposition?.match(/filename="?([^";]+)"?/)?.[1] || `audit-logs-${Date.now()}.pdf`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
      addToast(t('toast.exportSuccess'), 'success')
    } catch (err) {
      addToast(err.message || t('toast.exportError'), 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      const params = buildExportParams()
      const token = localStorage.getItem('freshtrack_token')
      const url = `${API_BASE_URL}/audit-logs/export/excel?${params}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const filename =
        disposition?.match(/filename="?([^";]+)"?/)?.[1] || `audit-logs-${Date.now()}.xlsx`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
      addToast(t('toast.exportSuccess'), 'success')
    } catch (err) {
      addToast(err.message || t('toast.exportError'), 'error')
    } finally {
      setExportingExcel(false)
    }
  }

  const resetFilters = () => {
    setFilters({
      actionType: '',
      entityType: '',
      dateFrom: '',
      dateTo: '',
      userId: '',
      departmentId: '',
      severity: '',
      securityOnly: false
    })
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const getSeverityBadge = (severity) => {
    const severityMap = {
      critical: {
        icon: AlertCircle,
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        labelKey: 'auditLogs.severityCritical'
      },
      important: {
        icon: AlertTriangle,
        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        labelKey: 'auditLogs.severityImportant'
      },
      normal: {
        icon: Info,
        className: 'bg-muted text-muted-foreground',
        labelKey: 'auditLogs.severityNormal'
      }
    }
    const config = severityMap[severity] || severityMap.normal
    const Icon = config.icon
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
          config.className
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {t(config.labelKey)}
      </span>
    )
  }

  const getActionIcon = (action) => {
    const normalizedAction = (action || '').toUpperCase().replace(/-/g, '_')
    const iconMap = {
      LOGIN: LogIn,
      LOGOUT: LogOut,
      CREATE: Plus,
      UPDATE: Edit2,
      DELETE: Trash2,
      COLLECT: ShoppingCart,
      PASSWORD_CHANGE: Shield,
      PASSWORD_CHANGED: Shield,
      EMAIL_CHANGED: Settings,
      ROLE_CHANGED: Users,
      MFA_ENABLED: Shield,
      MFA_DISABLED: Shield,
      EXPORT: Download,
      IMPORT: Upload,
      WRITE_OFF: Trash2,
      USER_ACTIVATED: UserCheck,
      USER_DEACTIVATED: UserX,
      ASSIGN_MARSHA: Link,
      RELEASE_MARSHA: Unlink,
      SETTINGS_UPDATE: Settings,
      CLEAR_CACHE: RefreshCw
    }
    const Icon = iconMap[normalizedAction] || FileText
    return <Icon className="w-4 h-4" />
  }

  const getActionColor = (action) => {
    const normalizedAction = (action || '').toUpperCase().replace(/-/g, '_')
    const colorMap = {
      LOGIN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      LOGOUT: 'bg-muted text-muted-foreground',
      CREATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      UPDATE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      COLLECT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      PASSWORD_CHANGE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      MFA_ENABLED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      MFA_DISABLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      ROLE_CHANGED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      USER_ACTIVATED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      USER_DEACTIVATED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      EXPORT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      IMPORT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      ASSIGN_MARSHA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      RELEASE_MARSHA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    }
    return colorMap[normalizedAction] || 'bg-muted text-muted-foreground'
  }

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      log.human_readable_description?.toLowerCase().includes(query) ||
      log.human_readable_details?.toLowerCase().includes(query) ||
      log.user_name?.toLowerCase().includes(query)
    )
  })

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const hasActiveFilters = Object.values(filters).some((v) => v !== '' && v !== false)
  const activeFiltersCount = [
    filters.actionType,
    filters.entityType,
    filters.dateFrom,
    filters.dateTo,
    filters.userId,
    filters.departmentId,
    filters.severity,
    filters.securityOnly
  ].filter(Boolean).length

  const exportData = logs.map((log) => ({
    timestamp: formatDate(log.created_at, true),
    user_name: log.user_name || '—',
    action: log.human_readable_description || log.action,
    entity_type: log.entity_type || '—',
    details: log.human_readable_details || (log.details && typeof log.details === 'object' ? JSON.stringify(log.details) : log.details) || '',
    ip_address: log.ip_address || ''
  }))

  if (loading && logs.length === 0) {
    return <PageLoader message={t('common.loading')} />
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-light text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
            {t('auditLogs.title')}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {t('auditLogs.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
            title={t('common.refresh')}
          >
            <RefreshCw className={cn('w-4 h-4 sm:w-5 sm:h-5', loading && 'animate-spin')} />
          </button>
          <ExportButton
            data={exportData}
            columns={EXPORT_COLUMNS.auditLogs(t)}
            filename={`audit-logs_${selectedHotel?.name || 'hotel'}`}
            title={t('auditLogs.title')}
            subtitle={selectedHotel?.name || ''}
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportExcel}
            exportingPdf={exportingPdf}
            exportingExcel={exportingExcel}
            exportRecordCount={pagination.total}
          />
        </div>
      </div>

      {/* New records banner (SSE) */}
      {newLogs.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">
            {t('auditLogs.newRecords', { count: newLogs.length })}
          </span>
          <button
            type="button"
            onClick={() => {
              loadLogs()
              clearNewLogs()
            }}
            className="text-sm font-medium text-accent underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-accent/20 rounded min-h-[44px] min-w-[44px] flex items-center justify-center px-2"
          >
            {t('auditLogs.refreshList')}
          </button>
        </div>
      )}

      {/* Activity Chart */}
      {stats && stats.length > 0 && (
        <ActivityChart data={stats} />
      )}

      {/* Filters Bar */}
      <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('auditLogs.searchPlaceholder')}
              className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              aria-label={t('common.search')}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border transition-colors text-sm flex-1 sm:flex-none justify-center min-h-[44px]',
                showFilters || hasActiveFilters
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              <Filter className="w-4 h-4" />
              {t('common.filters')}
              {activeFiltersCount > 0 && (
                <span className="ml-1 w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-danger hover:bg-danger/10 rounded-lg text-sm transition-colors min-h-[44px]"
              >
                <X className="w-4 h-4" />
                {t('common.reset')}
              </button>
            )}
          </div>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('auditLogs.filters.severity')}
              </label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('auditLogs.severityAll')}</option>
                <option value="critical">{t('auditLogs.severityCritical')}</option>
                <option value="important">{t('auditLogs.severityImportant')}</option>
                <option value="normal">{t('auditLogs.severityNormal')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('auditLogs.filters.user')}
              </label>
              <select
                value={filters.userId}
                onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all')}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.action_count != null ? `(${user.action_count})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('auditLogs.filters.department')}
              </label>
              <select
                value={filters.departmentId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, departmentId: e.target.value }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all')}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={filters.securityOnly}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, securityOnly: e.target.checked }))
                  }
                  className="rounded border-border text-accent focus:ring-2 focus:ring-accent/20 w-4 h-4"
                />
                {t('auditLogs.filters.securityOnly')}
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          {t('auditLogs.totalRecords', { count: pagination.total })}
        </span>
        {searchQuery && (
          <span>
            {t('auditLogs.found', { count: filteredLogs.length })}
          </span>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('auditLogs.noLogs')}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.timestamp')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.user')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.action')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.details')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('auditLogs.filters.severity')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                        {formatDate(log.created_at, true)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-foreground">{log.user_name}</span>
                          {log.department_name && (
                            <span className="block text-xs text-muted-foreground">
                              {log.department_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                            getActionColor(log.action)
                          )}
                        >
                          {getActionIcon(log.action)}
                          {log.human_readable_description || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">
                        {log.human_readable_details || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {getSeverityBadge(log.severity || 'normal')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center mx-auto"
                          title={t('common.viewDetails')}
                          aria-label={t('common.viewDetails')}
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
                  role="button"
                  tabIndex={0}
                  className="p-4 space-y-3 cursor-pointer hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
                  onClick={() => setSelectedLog(log)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedLog(log)
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        getActionColor(log.action)
                      )}
                    >
                      {getActionIcon(log.action)}
                      {log.human_readable_description || log.action}
                    </span>
                    {getSeverityBadge(log.severity || 'normal')}
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">
                    {log.human_readable_details || '—'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{log.user_name}</span>
                    <span>{formatDate(log.created_at, true)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              {(pagination.page - 1) * pagination.limit + 1}—{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              {t('common.of')} {pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
                disabled={pagination.page === 1}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('common.back')}
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(totalPages, prev.page + 1)
                  }))
                }
                disabled={pagination.page === totalPages}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('common.next')}
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <AuditDetailsModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}
