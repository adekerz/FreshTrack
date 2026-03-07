import { useState, useEffect, lazy, Suspense, useMemo } from 'react'
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
  Unlink,
} from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { useHotel } from '../context/HotelContext'
import { cn } from '../utils/classNames'
import { formatDate } from '../utils/dateUtils'
import {
  useAuditLogs,
  useAuditStats,
  useAuditUsers,
} from '../hooks/useAuditLogs'
import ExportButton from '../components/ExportButton'
import PageContainer from '../components/PageContainer'
import AnimatedPage from '../components/AnimatedPage'
import { SkeletonTable, Skeleton } from '../components/Skeleton'
const ActivityChart = lazy(() =>
  import('../components/audit/ActivityChart').then((m) => ({
    default: m.ActivityChart,
  }))
)
import { AuditDetailsModal } from '../components/audit/AuditDetailsModal'
import { useAuditSSE } from '../hooks/useAuditSSE'
import EmptyState from '../components/EmptyState'
import ExportProgress from '../components/ExportProgress'
import Tooltip from '../components/Tooltip'
import { useExport } from '../hooks/useExport'

export default function AuditLogsPage() {
  const { t } = useTranslation()
  const { selectedHotelId } = useHotel()
  const { newLogs, clearNewLogs } = useAuditSSE(
    !!selectedHotelId,
    selectedHotelId
  )
  const { exportProgress, dismissExportProgress } = useExport()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState({
    actionType: '',
    entityType: '',
    dateFrom: '',
    dateTo: '',
    userId: '',
    severity: '',
    securityOnly: false,
  })
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)

  // Сброс при смене отеля
  useEffect(() => {
    setPage(1)
    setSearchQuery('')
    setDebouncedSearch('')
    setFilters({
      actionType: '',
      entityType: '',
      dateFrom: '',
      dateTo: '',
      userId: '',
      severity: '',
      securityOnly: false,
    })
  }, [selectedHotelId])

  // Дебаунс поиска (300ms) + сброс страницы
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // React Query hooks - memoized
  const queryFilters = useMemo(
    () => ({
      limit: 20,
      offset: (page - 1) * 20,
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(filters.actionType && { action: filters.actionType }),
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.severity && { severity: filters.severity }),
      ...(filters.securityOnly && { securityOnly: true }),
    }),
    [page, filters, debouncedSearch]
  )

  const {
    data: logsData,
    isLoading,
    isFetching,
    refetch: refetchLogs,
  } = useAuditLogs(selectedHotelId, queryFilters)
  const { data: stats } = useAuditStats(selectedHotelId)
  const { data: users = [] } = useAuditUsers(selectedHotelId, showFilters)

  const logs = logsData?.logs || []
  const loading = isFetching
  const paginationTotal = logsData?.pagination?.total ?? 0

  const resetFilters = () => {
    setFilters({
      actionType: '',
      entityType: '',
      dateFrom: '',
      dateTo: '',
      userId: '',
      severity: '',
      securityOnly: false,
    })
    setSearchQuery('')
    setDebouncedSearch('')
    setPage(1)
  }

  const getSeverityBadge = (severity) => {
    const severityMap = {
      critical: {
        icon: AlertCircle,
        className:
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        labelKey: 'auditLogs.severityCritical',
      },
      important: {
        icon: AlertTriangle,
        className:
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        labelKey: 'auditLogs.severityImportant',
      },
      normal: {
        icon: Info,
        className: 'bg-muted text-muted-foreground',
        labelKey: 'auditLogs.severityNormal',
      },
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
      EMAIL_VERIFIED: Settings,
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
      CLEAR_CACHE: RefreshCw,
      APPLY_TEMPLATE: Plus,
      BLOCK: UserX,
      UNBLOCK: UserCheck,
      APPROVE: UserCheck,
      REJECT: UserX,
      TERMS_ACCEPTED: Shield,
      VERIFY_EMAIL: Settings,
      RESEND_VERIFICATION_CODE: Settings,
      SEND_CONFIRMATION: Settings,
      TEST_NOTIFICATION: Settings,
      CHANGE_PASSWORD: Shield,
    }
    const Icon = iconMap[normalizedAction] || FileText
    return <Icon className="w-4 h-4" />
  }

  const getActionColor = (action) => {
    const normalizedAction = (action || '').toUpperCase().replace(/-/g, '_')
    const colorMap = {
      LOGIN:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      LOGOUT: 'bg-muted text-muted-foreground',
      CREATE:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      UPDATE:
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      COLLECT:
        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      PASSWORD_CHANGE:
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      CHANGE_PASSWORD:
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      MFA_ENABLED:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      MFA_DISABLED:
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      ROLE_CHANGED:
        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      USER_ACTIVATED:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      USER_DEACTIVATED:
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      EXPORT:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      IMPORT:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      ASSIGN_MARSHA:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      RELEASE_MARSHA:
        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      APPLY_TEMPLATE:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      BLOCK: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      UNBLOCK:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      APPROVE:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      REJECT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      TERMS_ACCEPTED:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      EMAIL_VERIFIED:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      VERIFY_EMAIL:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      SEND_CONFIRMATION:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      TEST_NOTIFICATION:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    }
    return colorMap[normalizedAction] || 'bg-muted text-muted-foreground'
  }

  // Человекочитаемое название действия (через i18n)
  const getActionLabel = (action) => {
    const normalizedAction = (action || '').toUpperCase().replace(/-/g, '_')
    const actionLabels = {
      LOGIN: t('auditLogs.actions.login'),
      LOGOUT: t('auditLogs.actions.logout'),
      CREATE: t('auditLogs.actions.create'),
      UPDATE: t('auditLogs.actions.update'),
      DELETE: t('auditLogs.actions.delete'),
      COLLECT: t('auditLogs.actions.collect'),
      EXPORT: t('auditLogs.actions.export'),
      PASSWORD_CHANGE: t('auditLogs.actions.passwordChanged'),
      PASSWORD_CHANGED: t('auditLogs.actions.passwordChanged'),
      CHANGE_PASSWORD: t('auditLogs.actions.passwordChanged'),
      EMAIL_CHANGED: t('auditLogs.actions.emailChanged'),
      EMAIL_VERIFIED: t('auditLogs.actions.verifyEmail'),
      ROLE_CHANGED: t('auditLogs.actions.roleChanged'),
      MFA_ENABLED: t('auditLogs.actions.mfaEnabled'),
      MFA_DISABLED: t('auditLogs.actions.mfaDisabled'),
      IMPORT: t('auditLogs.actions.import'),
      SETTINGS_UPDATE: t('auditLogs.actions.settingsChange'),
      USER_ACTIVATED: t('auditLogs.actions.userActivated'),
      USER_DEACTIVATED: t('auditLogs.actions.userDeactivated'),
      APPLY_TEMPLATE: t('auditLogs.actions.applyTemplate'),
      BLOCK: t('auditLogs.actions.block'),
      UNBLOCK: t('auditLogs.actions.unblock'),
      APPROVE: t('auditLogs.actions.approve'),
      REJECT: t('auditLogs.actions.reject'),
      TERMS_ACCEPTED: t('auditLogs.actions.termsAccepted'),
      VERIFY_EMAIL: t('auditLogs.actions.verifyEmail'),
      RESEND_VERIFICATION_CODE: t('auditLogs.actions.sendConfirmation'),
      RESEND_PASSWORD: t('auditLogs.actions.passwordChanged'),
      SEND_CONFIRMATION: t('auditLogs.actions.sendConfirmation'),
      TEST_NOTIFICATION: t('auditLogs.actions.testNotification'),
      ASSIGN_MARSHA: t('auditLogs.actions.assignMarsha'),
      RELEASE_MARSHA: t('auditLogs.actions.releaseMarsha'),
      WRITE_OFF: t('auditLogs.actions.writeOff'),
      CLEAR_CACHE: t('auditLogs.actions.clearCache'),
      GDPR_EXPORT: t('auditLogs.actions.export'),
      GDPR_DELETE: t('auditLogs.actions.delete'),
    }
    return actionLabels[normalizedAction] || action
  }

  // Человекочитаемое название типа объекта (через i18n)
  const getEntityLabel = (entityType) => {
    const normalized = (entityType || '').toLowerCase().replace(/-/g, '_')
    const entityLabels = {
      user: t('auditLogs.entities.user'),
      batch: t('auditLogs.entities.batch'),
      product: t('auditLogs.entities.product'),
      category: t('auditLogs.entities.category'),
      department: t('auditLogs.entities.department'),
      hotel: t('auditLogs.entities.hotel'),
      settings: t('auditLogs.entities.settings'),
      template: t('auditLogs.entities.template'),
      delivery_template: t('auditLogs.entities.deliveryTemplate'),
      notification_rule: t('auditLogs.entities.notificationRule'),
      data_export: t('auditLogs.entities.dataExport'),
      marsha_code: t('auditLogs.entities.marshaCode'),
      join_request: t('auditLogs.entities.joinRequest'),
      joinrequest: t('auditLogs.entities.joinRequest'),
      login_branding: t('auditLogs.entities.loginBranding'),
      branding_settings: t('auditLogs.entities.brandingSettings'),
      general_settings: t('auditLogs.entities.generalSettings'),
      telegram_settings: t('auditLogs.entities.telegramSettings'),
      notifications_settings: t('auditLogs.entities.notificationsSettings'),
      telegram_notifications: t('auditLogs.entities.telegramSettings'),
      session: t('auditLogs.entities.session'),
      account: t('auditLogs.entities.account'),
      task_board: t('auditLogs.entities.taskBoard'),
    }
    return entityLabels[normalized] || entityType || '—'
  }

  const filteredLogs = logs

  // Строим краткую строку подробностей для таблицы
  const getDetailsSummary = (log) => {
    // 1. human_readable_details из metadata (от EnrichmentService)
    if (log.human_readable_details) return log.human_readable_details

    const action = (log.action || '').toUpperCase().replace(/-/g, '_')
    const details =
      log.details && typeof log.details === 'object' ? log.details : null
    const after = log.snapshot_after
    const before = log.snapshot_before
    const name = after?.name || before?.name || details?.name

    // 2. Для входа/выхода — метод + IP
    if (['LOGIN', 'LOGOUT', 'LOGIN_FAILED'].includes(action)) {
      const parts = []
      if (details?.method)
        parts.push(`${t('auditLogs.detailLabels.method')}: ${details.method}`)
      if (log.ip_address) parts.push(`IP: ${log.ip_address}`)
      return parts.length > 0 ? parts.join(' · ') : '—'
    }

    // 3. key_changes из server-side enrichment (snapshot поля)
    if (log.key_changes) return log.key_changes

    // 4. Применение шаблона
    if (action === 'APPLY_TEMPLATE' && details) {
      const parts = []
      if (details.template_name) parts.push(`"${details.template_name}"`)
      if (details.batches_created != null)
        parts.push(
          `${t('auditLogs.detailLabels.batchesCreated')}: ${details.batches_created}`
        )
      return parts.length > 0 ? parts.join(' · ') : '—'
    }

    // 5. Сбор продуктов
    if (action === 'COLLECT' && details) {
      const parts = []
      if (details.productName) parts.push(`"${details.productName}"`)
      if (details.totalCollected != null)
        parts.push(
          `${t('auditLogs.detailLabels.collected')}: ${details.totalCollected}`
        )
      if (details.reason) {
        const reasonLabels = {
          expired: t('auditLogs.detailLabels.reasonExpired'),
          damaged: t('auditLogs.detailLabels.reasonDamaged'),
          return: t('auditLogs.detailLabels.reasonReturn'),
          compliment: t('auditLogs.detailLabels.reasonCompliment'),
          other: t('auditLogs.detailLabels.reasonOther'),
        }
        parts.push(reasonLabels[details.reason] || details.reason)
      }
      return parts.length > 0 ? parts.join(' · ') : '—'
    }

    // 6. Экспорт данных
    if (action === 'EXPORT' && details) {
      const parts = []
      if (details.entityType) {
        const typeLabels = {
          auditLogs: t('auditLogs.detailLabels.exportAuditLogs'),
          inventory: t('auditLogs.detailLabels.exportInventory'),
          batches: t('auditLogs.detailLabels.exportBatches'),
          collections: t('auditLogs.detailLabels.exportCollections'),
          categories: t('auditLogs.detailLabels.exportCategories'),
          users: t('auditLogs.detailLabels.exportUsers'),
          marshaCodes: t('auditLogs.detailLabels.exportMarsha'),
        }
        parts.push(typeLabels[details.entityType] || details.entityType)
      }
      if (details.format) parts.push(details.format.toUpperCase())
      if (details.rowCount != null)
        parts.push(`${details.rowCount} ${t('auditLogs.detailLabels.records')}`)
      if (details.recordCount != null)
        parts.push(
          `${details.recordCount} ${t('auditLogs.detailLabels.records')}`
        )
      return parts.length > 0 ? parts.join(' · ') : '—'
    }

    // 7. Блокировка / деактивация пользователя
    if (
      ['BLOCK', 'UNBLOCK', 'USER_ACTIVATED', 'USER_DEACTIVATED'].includes(
        action
      ) &&
      details
    ) {
      if (details.target_login)
        return `${t('auditLogs.entities.user')}: ${details.target_login}`
      if (details.isActive !== undefined)
        return details.isActive
          ? t('auditLogs.actions.userActivated')
          : t('auditLogs.actions.userDeactivated')
    }

    // 8. Одобрение / отклонение заявки
    if (['APPROVE', 'REJECT'].includes(action) && details) {
      const parts = []
      if (details.role)
        parts.push(`${t('auditLogs.detailLabels.role')}: ${details.role}`)
      if (details.notes) parts.push(`"${details.notes}"`)
      return parts.length > 0 ? parts.join(' · ') : '—'
    }

    // 9. Создание пользователя
    if (action === 'CREATE' && details?.login) {
      const parts = [`${t('auditLogs.detailLabels.login')}: ${details.login}`]
      if (details.role)
        parts.push(`${t('auditLogs.detailLabels.role')}: ${details.role}`)
      return parts.join(' · ')
    }

    // 10. Удаление пользователя
    if (action === 'DELETE' && details?.deleted_login) {
      return `${t('auditLogs.detailLabels.deleted')}: ${details.deleted_login}`
    }

    // 11. Для удаления — что именно удалено
    if (action === 'DELETE' && name)
      return `${t('auditLogs.detailLabels.deleted')}: "${name}"`

    // 12. Для создания — название объекта
    if (action === 'CREATE' && name) return `"${name}"`

    // 13. Обновление настроек
    if (action === 'UPDATE' && details?.updatedKeys) {
      const count = Array.isArray(details.updatedKeys)
        ? details.updatedKeys.length
        : 0
      return `${t('auditLogs.detailLabels.updatedParams', { count })}`
    }

    // 14. Обновление с списком изменённых полей
    if (action === 'UPDATE' && details?.updates) {
      const updates = Array.isArray(details.updates) ? details.updates : []
      if (name) return `"${name}" · ${updates.join(', ')}`
      return updates.join(', ')
    }

    // 15. Telegram настройки
    if (action === 'UPDATE' && details?.sendTime) {
      return `${t('auditLogs.detailLabels.sendTime')}: ${details.sendTime}`
    }

    // 16. Подтверждение email
    if (
      [
        'VERIFY_EMAIL',
        'EMAIL_VERIFIED',
        'RESEND_VERIFICATION_CODE',
        'SEND_CONFIRMATION',
      ].includes(action) &&
      details?.email
    ) {
      return details.email
    }

    // 17. Принятие условий
    if (action === 'TERMS_ACCEPTED') {
      return details?.termsVersion
        ? `${t('auditLogs.detailLabels.version')}: ${details.termsVersion}`
        : t('auditLogs.actions.termsAccepted')
    }

    // 18. Смена пароля
    if (
      ['PASSWORD_CHANGE', 'CHANGE_PASSWORD', 'PASSWORD_CHANGED'].includes(
        action
      )
    ) {
      return details?.method === 'self'
        ? t('auditLogs.detailLabels.selfChange')
        : t('auditLogs.actions.passwordChanged')
    }

    // 19. Обновление партии (объединение)
    if (action === 'UPDATE' && details?.reason === 'merged_same_expiry') {
      return `${t('auditLogs.detailLabels.merge')} · ${t('auditLogs.detailLabels.quantity')}: ${details.newQuantity || '—'} (+${details.quantityAdded || '—'})`
    }

    // 20. Очистка всех партий
    if (action === 'DELETE' && details?.action === 'clear_all_batches') {
      return `${t('auditLogs.detailLabels.clearedBatches')}: ${details.deleted || 0}`
    }

    // 21. Уведомления (правила)
    if (action === 'CREATE' && details?.type === 'expiry') {
      return `"${details.name || '—'}" · ${t('auditLogs.detailLabels.typeExpiry')}`
    }

    // 22. Общий fallback для details
    if (details) {
      const LABELS = {
        method: t('auditLogs.detailLabels.method'),
        format: t('auditLogs.detailLabels.format'),
        recordCount: t('auditLogs.detailLabels.records'),
        reason: t('auditLogs.detailLabels.reason'),
        name: t('auditLogs.detailLabels.name'),
        quantity: t('auditLogs.detailLabels.quantity'),
        productId: t('auditLogs.entities.product'),
        role: t('auditLogs.detailLabels.role'),
        login: t('auditLogs.detailLabels.login'),
        template_name: t('auditLogs.entities.template'),
        email: 'Email',
        productName: t('auditLogs.entities.product'),
        exportType: t('auditLogs.detailLabels.exportType'),
        entityType: t('auditLogs.entity'),
        rowCount: t('auditLogs.detailLabels.rows'),
        code: t('auditLogs.detailLabels.code'),
        marsha_code: 'MARSHA',
      }
      const SKIP_KEYS = [
        'id',
        'hotel_id',
        'user_id',
        'action',
        'exportId',
        'columns',
        'filters',
        'productId',
        'department_id',
        'created_by',
        'temporaryPasswordSent',
        'deleted_by',
        'action_by',
        'updated_by',
        'changes',
        'acceptedAt',
        'filename',
        'updatedKeys',
        'ipAddress',
        'userAgent',
        'timestamp',
        'batchesDeleted',
        'batchesAffected',
        'environment',
        'channels',
        'timezone',
        'templatesUpdated',
      ]
      const entries = Object.entries(details)
        .filter(
          ([k, v]) =>
            !SKIP_KEYS.includes(k) &&
            v !== null &&
            v !== undefined &&
            v !== '' &&
            typeof v !== 'object'
        )
        .slice(0, 3)
        .map(([k, v]) => `${LABELS[k] || k}: ${v}`)
      if (entries.length > 0) return entries.join(' · ')
    }

    return '—'
  }

  const totalPages = Math.ceil(paginationTotal / 20)
  const hasActiveFilters =
    searchQuery !== '' ||
    Object.values(filters).some((v) => v !== '' && v !== false)
  const activeFiltersCount = [
    filters.actionType,
    filters.entityType,
    filters.dateFrom,
    filters.dateTo,
    filters.userId,
    filters.severity,
    filters.securityOnly,
  ].filter(Boolean).length

  const exportFilters = {
    ...(filters.actionType && { action: filters.actionType }),
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
    ...(filters.dateTo && { dateTo: filters.dateTo }),
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.severity && { severity: filters.severity }),
    ...(filters.securityOnly && { securityOnly: 'true' }),
  }

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageContainer
          title={t('auditLogs.title')}
          subtitle={t('auditLogs.subtitle')}
          stickyHeader={true}
        >
          <div
            className="space-y-4 sm:space-y-6"
            role="status"
            aria-live="polite"
            aria-label={t('common.loading')}
          >
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-24 rounded-lg" />
                  <Skeleton className="h-10 w-20 rounded-lg" />
                </div>
              </div>
            </div>
            <SkeletonTable rows={10} columns={6} />
          </div>
        </PageContainer>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <PageContainer
        title={t('auditLogs.title')}
        subtitle={t('auditLogs.subtitle')}
        stickyHeader={true}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Tooltip content={t('common.refresh') || 'Обновить'}>
              <span className="inline-flex">
                <button
                  onClick={() => refetchLogs()}
                  disabled={loading}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                  aria-label={t('common.refresh') || 'Обновить'}
                  title={t('common.refresh')}
                >
                  <RefreshCw
                    className={cn(
                      'w-4 h-4 sm:w-5 sm:h-5',
                      loading && 'animate-spin'
                    )}
                  />
                </button>
              </span>
            </Tooltip>
            <ExportButton
              exportType="audit"
              filters={exportFilters}
              formats={['excel', 'csv', 'pdf']}
              showFilterCount={true}
              size="sm"
              compact={true}
            />
          </div>
        }
      >
        <div className="space-y-4 sm:space-y-6">
          {/* New records banner (SSE) */}
          {newLogs.length > 0 && (
            <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">
                {t('auditLogs.newRecords', { count: newLogs.length })}
              </span>
              <button
                type="button"
                onClick={() => {
                  refetchLogs()
                  clearNewLogs()
                }}
                className="text-sm font-medium text-accent underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-accent/20 rounded min-h-[44px] min-w-[44px] flex items-center justify-center px-2"
              >
                {t('auditLogs.refreshList')}
              </button>
            </div>
          )}

          {/* Activity Chart (lazy — chart.js loaded on demand) */}
          {stats && stats.length > 0 && (
            <Suspense
              fallback={<Skeleton className="h-64 w-full rounded-xl" />}
            >
              <ActivityChart data={stats} />
            </Suspense>
          )}

          {/* Filters Bar */}
          <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="relative flex-1">
                <label htmlFor="audit-log-search" className="sr-only">
                  {t('common.search')}
                </label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <input
                  id="audit-log-search"
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
                    'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border transition-colors text-sm flex-1 sm:flex-none justify-center min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent/20',
                    showFilters || hasActiveFilters
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                  aria-label={t('common.filters')}
                  aria-expanded={showFilters}
                >
                  <Filter className="w-4 h-4" aria-hidden="true" />
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
                    aria-label={t('common.reset') || 'Сбросить фильтры'}
                    title={t('common.reset')}
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                    {t('common.reset')}
                  </button>
                )}
              </div>
            </div>

            {/* Extended Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Row 1 */}
                <div>
                  <label
                    htmlFor="audit-filter-severity"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t('auditLogs.filters.severity')}
                  </label>
                  <select
                    id="audit-filter-severity"
                    value={filters.severity}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        severity: e.target.value,
                      }))
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">{t('auditLogs.severityAll')}</option>
                    <option value="critical">
                      {t('auditLogs.severityCritical')}
                    </option>
                    <option value="important">
                      {t('auditLogs.severityImportant')}
                    </option>
                    <option value="normal">
                      {t('auditLogs.severityNormal')}
                    </option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="audit-filter-user"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t('auditLogs.filters.user')}
                  </label>
                  <select
                    id="audit-filter-user"
                    value={filters.userId}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        userId: e.target.value,
                      }))
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">{t('common.all')}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}{' '}
                        {user.action_count != null
                          ? `(${user.action_count})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="audit-filter-action"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t('auditLogs.filters.action') || 'Действие'}
                  </label>
                  <select
                    id="audit-filter-action"
                    value={filters.actionType}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        actionType: e.target.value,
                      }))
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="">{t('common.all')}</option>
                    <option value="login">Вход</option>
                    <option value="logout">Выход</option>
                    <option value="create">Создание</option>
                    <option value="update">Изменение</option>
                    <option value="delete">Удаление</option>
                    <option value="export">Экспорт</option>
                    <option value="write_off">Списание</option>
                    <option value="collect">Сбор</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label
                    htmlFor="audit-filter-security"
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer min-h-[44px]"
                  >
                    <input
                      id="audit-filter-security"
                      type="checkbox"
                      checked={filters.securityOnly}
                      onChange={(e) => {
                        setFilters((prev) => ({
                          ...prev,
                          securityOnly: e.target.checked,
                        }))
                        setPage(1)
                      }}
                      className="rounded border-border text-accent focus:ring-2 focus:ring-accent/20 w-4 h-4"
                    />
                    {t('auditLogs.filters.securityOnly')}
                  </label>
                </div>

                {/* Row 2 — date range */}
                <div>
                  <label
                    htmlFor="audit-filter-date-from"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t('auditLogs.filters.dateFrom') || 'С даты'}
                  </label>
                  <input
                    id="audit-filter-date-from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        dateFrom: e.target.value,
                      }))
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="audit-filter-date-to"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    {t('auditLogs.filters.dateTo') || 'По дату'}
                  </label>
                  <input
                    id="audit-filter-date-to"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => {
                      setFilters((prev) => ({
                        ...prev,
                        dateTo: e.target.value,
                      }))
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {t('auditLogs.totalRecords', { count: paginationTotal })}
            </span>
            {searchQuery && (
              <span>
                {t('auditLogs.found', { count: filteredLogs.length })}
              </span>
            )}
          </div>

          {/* Logs Table */}
          <div
            className="bg-card rounded-xl border border-border overflow-hidden"
            role="region"
            aria-label={t('auditLogs.title')}
          >
            {filteredLogs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t('auditLogs.noLogs') || 'Нет записей в журнале'}
                description={
                  searchQuery
                    ? t('auditLogs.noSearchResults') ||
                      'Попробуйте изменить поисковый запрос'
                    : hasActiveFilters
                      ? t('auditLogs.noFilterResults') ||
                        'Попробуйте изменить фильтры'
                      : t('auditLogs.noLogsHint') ||
                        'Здесь будет отображаться журнал действий пользователей'
                }
              />
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
                          {t('auditLogs.entity')}
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
                        <tr
                          key={log.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                            {formatDate(log.created_at, true)}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium text-foreground">
                                {log.user_name}
                              </span>
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
                              {getActionLabel(log.action)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {getEntityLabel(log.entity_type)}
                          </td>
                          <td
                            className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate"
                            title={getDetailsSummary(log)}
                          >
                            {getDetailsSummary(log)}
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
                          {getActionLabel(log.action)}
                        </span>
                        {getSeverityBadge(log.severity || 'normal')}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {getEntityLabel(log.entity_type)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">
                        {getDetailsSummary(log)}
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
                  {(page - 1) * 20 + 1}— {Math.min(page * 20, paginationTotal)}{' '}
                  {t('common.of')} {paginationTotal}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={t('common.back')}
                  >
                    <ChevronLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
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

        {/* Export Progress Notification */}
        {exportProgress.status && (
          <ExportProgress
            status={exportProgress.status}
            filename={exportProgress.filename}
            onDismiss={dismissExportProgress}
          />
        )}
      </PageContainer>
    </AnimatedPage>
  )
}
