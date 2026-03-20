import { useState } from 'react'
import {
  Clock,
  User,
  Monitor,
  Globe,
  MapPin,
  ChevronDown,
  ChevronUp,
  Package,
  Tag,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Shield,
  Database,
} from 'lucide-react'
import { useTranslation } from '../../context/LanguageContext'
import { formatDate } from '../../utils/dateUtils'
import Modal from '../ui/Modal'
import { cn } from '../../utils/classNames'

// Ключи полей, которые скрываем из snapshot-ов (технические поля)
const SKIP_SNAPSHOT_KEYS = [
  'id',
  'created_at',
  'updated_at',
  'hotel_id',
  'department_id',
  '_snapshot_type',
  '_snapshot_time',
  'user_id',
  'category_id',
]

/**
 * Маппинг ключей entity_type → i18n ключ из auditLogs.entities
 * snake_case → camelCase для i18n
 */
const ENTITY_TYPE_I18N_MAP = {
  product: 'product',
  batch: 'batch',
  user: 'user',
  category: 'category',
  department: 'department',
  hotel: 'hotel',
  settings: 'settings',
  write_off: 'writeOff',
  collection: 'collection',
  marsha_code: 'marshaCode',
  notification_rule: 'notificationRule',
  template: 'template',
  delivery_template: 'deliveryTemplate',
  join_request: 'joinRequest',
  session: 'session',
  account: 'account',
  task_board: 'taskBoard',
  data_export: 'dataExport',
  login_branding: 'loginBranding',
  branding_settings: 'brandingSettings',
  general_settings: 'generalSettings',
  telegram_settings: 'telegramSettings',
  notifications_settings: 'notificationsSettings',
}

/**
 * Маппинг action → i18n ключ из auditLogs.actions
 */
const ACTION_I18N_MAP = {
  login: 'login',
  logout: 'logout',
  create: 'create',
  update: 'update',
  delete: 'delete',
  collect: 'collect',
  settings_update: 'settingsChange',
  settingschange: 'settingsChange',
  password_change: 'passwordChanged',
  email_changed: 'emailChanged',
  email_verified: 'verifyEmail',
  role_changed: 'roleChanged',
  mfa_enabled: 'mfaEnabled',
  mfa_disabled: 'mfaDisabled',
  mfa_setup: 'mfaEnabled',
  export: 'export',
  import: 'import',
  write_off: 'writeOff',
  clear_cache: 'clearCache',
  user_activated: 'userActivated',
  user_deactivated: 'userDeactivated',
  toggle: 'settingsChange',
  assign_marsha: 'assignMarsha',
  release_marsha: 'releaseMarsha',
  approve_join: 'approve',
  reject_join: 'reject',
  gdpr_export: 'export',
  gdpr_delete: 'delete',
  apply_template: 'applyTemplate',
  resend_password: 'passwordChanged',
  password_reset: 'passwordChanged',
}

/**
 * Маппинг ключей полей snapshot → i18n ключ из auditLogs.detailLabels
 * или fallback на человекочитаемое название
 */
const FIELD_I18N_MAP = {
  name: 'name',
  quantity: 'quantity',
  role: 'role',
  login: 'login',
  reason: 'reason',
  method: 'method',
  format: 'format',
  code: 'code',
  exportType: 'exportType',
  sendTime: 'sendTime',
  version: 'version',
}

/**
 * Маппинг ключей, которые не имеют i18n, но имеют fallback
 */
const FIELD_FALLBACK = {
  unit: 'Unit',
  expiry_date: 'Expiry',
  category_name: 'Category',
  status: 'Status',
  email: 'Email',
  is_active: 'Active',
  price: 'Price',
  description: 'Description',
  min_quantity: 'Min Qty',
  notification_threshold: 'Threshold',
  department_name: 'Department',
  hotel_name: 'Hotel',
  batch_name: 'Batch',
  product_name: 'Product',
  is_enabled: 'Enabled',
  schedule: 'Schedule',
  count: 'Count',
  total: 'Total',
  batchCount: 'Batches',
  productCount: 'Products',
  department: 'Department',
  action: 'Action',
  setting: 'Setting',
  value: 'Value',
  key: 'Key',
  recordCount: 'Records',
  channels: 'Каналы',
  timezone: 'Часовой пояс',
  templatesUpdated: 'Шаблоны обновлены',
  columns: 'Колонки',
  filters: 'Фильтры',
  filename: 'Имя файла',
  rowCount: 'Кол-во строк',
  entityType: 'Тип данных',
  created_by: 'Создал',
  temporaryPasswordSent: 'Временный пароль',
  enabled: 'Включено',
  updated: 'Обновлено',
}

/**
 * Форматирование простого значения для отображения (строка)
 */
function formatValue(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? '✓' : '✗'
  if (Array.isArray(val)) {
    if (val.length === 0) return '—'
    if (val.every((v) => typeof v !== 'object')) {
      if (val.length <= 5) return val.join(', ')
      return `${val.slice(0, 3).join(', ')} (+${val.length - 3})`
    }
    return JSON.stringify(val)
  }
  if (typeof val === 'object') return JSON.stringify(val)
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    try {
      return new Date(val).toLocaleDateString('ru-RU')
    } catch {
      return val
    }
  }
  return String(val)
}

/**
 * Компонент для раскрываемого списка (массивы > 4 элементов)
 */
function ExpandableList({ items }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, 3)
  const remaining = items.length - 3
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {shown.map((v, i) => (
        <span
          key={i}
          className="px-1.5 py-0.5 bg-muted border border-border/50 rounded text-xs font-mono"
        >
          {String(v)}
        </span>
      ))}
      {!expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-xs font-medium hover:bg-accent/20 transition-colors"
        >
          +{remaining}
        </button>
      )}
      {expanded && items.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-1.5 py-0.5 text-muted-foreground rounded text-xs hover:text-foreground transition-colors"
        >
          ↑
        </button>
      )}
    </div>
  )
}

/**
 * Компонент для вложенных объектов
 */
function NestedObject({ obj, t, depth = 0 }) {
  if (!obj || typeof obj !== 'object') return <span>{formatValue(obj)}</span>
  if (Array.isArray(obj)) return <ExpandableList items={obj} />
  const entries = Object.entries(obj)
  if (entries.length === 0) return <span>—</span>
  return (
    <div
      className={cn(
        'space-y-1.5',
        depth > 0 && 'pl-3 border-l-2 border-border/40'
      )}
    >
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium">
            {t ? getFieldLabel(k, t) : k}
          </span>
          {v !== null && typeof v === 'object' ? (
            <NestedObject obj={v} t={t} depth={depth + 1} />
          ) : (
            <span className="text-sm text-foreground font-medium">
              {formatValue(v)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Рич-компонент для отображения значения (массивы как теги, объекты рекурсивно)
 */
function DetailValue({ value, t }) {
  if (value === null || value === undefined) return <span>—</span>
  if (typeof value === 'boolean') return <span>{value ? '✓' : '✗'}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span>—</span>
    if (value.every((v) => typeof v !== 'object')) {
      if (value.length <= 4) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-muted border border-border/50 rounded text-xs font-mono"
              >
                {String(v)}
              </span>
            ))}
          </div>
        )
      }
      return <ExpandableList items={value} />
    }
    return <NestedObject obj={value} t={t} />
  }
  if (typeof value === 'object') {
    return <NestedObject obj={value} t={t} />
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return <span>{new Date(value).toLocaleDateString('ru-RU')}</span>
    } catch {
      /* fallthrough */
    }
  }
  return <span>{String(value)}</span>
}

/**
 * Получение человекочитаемой метки поля через i18n
 */
function getFieldLabel(key, t) {
  // Проверяем i18n маппинг
  const i18nKey = FIELD_I18N_MAP[key]
  if (i18nKey) {
    const translated = t(`auditLogs.detailLabels.${i18nKey}`)
    if (translated && !translated.startsWith('auditLogs.detailLabels.'))
      return translated
  }
  // Fallback на статический маппинг
  if (FIELD_FALLBACK[key]) return FIELD_FALLBACK[key]
  // Последний fallback — сам ключ
  return key
}

/**
 * Получение i18n-метки для entity_type
 */
function getEntityLabel(entityType, t) {
  if (!entityType) return ''
  const key = ENTITY_TYPE_I18N_MAP[entityType.toLowerCase()]
  if (key) {
    const translated = t(`auditLogs.entities.${key}`)
    if (translated && !translated.startsWith('auditLogs.entities.'))
      return translated
  }
  return entityType
}

/**
 * Получение i18n-метки для action
 */
function getActionLabel(action, t) {
  if (!action) return ''
  const normalized = action.toLowerCase().replace(/-/g, '_')
  const key = ACTION_I18N_MAP[normalized]
  if (key) {
    const translated = t(`auditLogs.actions.${key}`)
    if (translated && !translated.startsWith('auditLogs.actions.'))
      return translated
  }
  return action
}

/**
 * Бейдж критичности
 */
function SeverityBadge({ severity, t }) {
  const configs = {
    critical: {
      icon: AlertCircle,
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
  const config = configs[severity] || configs.normal
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
        config.className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {t(config.labelKey)}
    </span>
  )
}

/**
 * Иконка + цвет для типа действия
 */
function getActionStyle(action) {
  const normalized = (action || '').toLowerCase().replace(/-/g, '_')
  const styles = {
    login: { color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10' },
    logout: {
      color: 'text-slate-500 dark:text-slate-400',
      bg: 'bg-slate-500/10',
    },
    create: {
      color: 'text-green-500 dark:text-green-400',
      bg: 'bg-green-500/10',
    },
    update: {
      color: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10',
    },
    delete: { color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/10' },
    collect: {
      color: 'text-violet-500 dark:text-violet-400',
      bg: 'bg-violet-500/10',
    },
    export: { color: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-500/10' },
    import: { color: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-500/10' },
    write_off: {
      color: 'text-orange-500 dark:text-orange-400',
      bg: 'bg-orange-500/10',
    },
    password_change: {
      color: 'text-yellow-500 dark:text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
  }
  return (
    styles[normalized] || { color: 'text-muted-foreground', bg: 'bg-muted' }
  )
}

/**
 * Секция: таблица изменений (для UPDATE)
 */
function ChangesSection({ before, after, t }) {
  if (!before || !after) return null
  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const changed = allKeys.filter((k) => {
    if (SKIP_SNAPSHOT_KEYS.includes(k)) return false
    return String(before[k] ?? '') !== String(after[k] ?? '')
  })
  if (changed.length === 0)
    return (
      <p className="text-sm text-muted-foreground italic">
        {t('auditLogs.detailModal.noChanges')}
      </p>
    )

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/70">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {t('auditLogs.detailModal.field')}
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {t('auditLogs.detailModal.was')}
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-6"></th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {t('auditLogs.detailModal.became')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {changed.map((k) => (
            <tr key={k} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                {getFieldLabel(k, t)}
              </td>
              <td className="px-3 py-2 text-red-400/80 line-through break-all">
                {formatValue(before[k])}
              </td>
              <td className="px-3 py-2 text-center">
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
              </td>
              <td className="px-3 py-2 text-green-500 dark:text-green-400 font-medium break-all">
                {formatValue(after[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Секция: поля снапшота (для CREATE/DELETE)
 */
function SnapshotFields({ snapshot, skip = [], t }) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const entries = Object.entries(snapshot).filter(
    ([k]) => !SKIP_SNAPSHOT_KEYS.includes(k) && !skip.includes(k)
  )
  if (entries.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {getFieldLabel(k, t)}
          </span>
          <span className="text-sm text-foreground font-medium break-all">
            {formatValue(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Технические поля, скрытые из details
 */
const DETAILS_SKIP_KEYS = [
  'id',
  'hotel_id',
  'user_id',
  'timestamp',
  'exportId',
  'ipAddress',
  'userAgent',
]

/**
 * Секция: поле details JSON как читаемые KV
 */
function DetailsFields({ details, t }) {
  if (
    !details ||
    typeof details !== 'object' ||
    Object.keys(details).length === 0
  )
    return null
  const entries = Object.entries(details).filter(
    ([k]) => !DETAILS_SKIP_KEYS.includes(k)
  )
  if (entries.length === 0) return null

  // Разделяем на простые и сложные значения
  const simpleEntries = entries.filter(
    ([, v]) => v === null || v === undefined || typeof v !== 'object'
  )
  const complexEntries = entries.filter(
    ([, v]) => v !== null && v !== undefined && typeof v === 'object'
  )

  return (
    <div className="space-y-3">
      {simpleEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {simpleEntries.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                {getFieldLabel(k, t)}
              </span>
              <span className="text-sm text-foreground font-medium break-all">
                <DetailValue value={v} t={t} />
              </span>
            </div>
          ))}
        </div>
      )}
      {complexEntries.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {getFieldLabel(k, t)}
          </span>
          <div className="pl-1">
            <DetailValue value={v} t={t} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Компонент для копирования Entity ID
 */
function CopyableId({ value }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback — молча игнорируем
    }
  }

  if (!value) return null

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors cursor-pointer"
      title={value}
    >
      {value.length > 16 ? `${value.slice(0, 8)}…` : value}
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  )
}

/**
 * Визуальный разделитель между секциями
 */
function Divider() {
  return <div className="border-t border-border/50" />
}

/**
 * Заголовок секции
 */
function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {children}
      </span>
    </div>
  )
}

/**
 * Основная модалка деталей аудит-лога
 */
export function AuditDetailsModal({ log, onClose }) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  if (!log) return null

  const action = (log.action || '').toUpperCase()
  const actionLabel = getActionLabel(log.action, t)
  const entityTypeLabel = getEntityLabel(log.entity_type, t)
  const after = log.snapshot_after
  const before = log.snapshot_before
  const entityName = after?.name || before?.name
  const actionStyle = getActionStyle(log.action)

  const isUpdate = action === 'UPDATE'
  const isCreate = action === 'CREATE'
  const isDelete = action === 'DELETE'
  const hasChanges = isUpdate && before && after

  const hasDetails =
    log.details &&
    typeof log.details === 'object' &&
    Object.keys(log.details).length > 0

  // Формируем читаемое описание действия
  // Для LOGIN/LOGOUT entity_type лишний — показываем только действие
  const isAuthAction = ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'].includes(action)
  const descriptionText = isAuthAction
    ? actionLabel
    : `${actionLabel}${entityTypeLabel ? ` · ${entityTypeLabel}` : ''}`

  // Подробности действия из human_readable_details
  // Если это IP, не дублируем (он будет в техническом блоке)
  const humanDetails = log.human_readable_details
  const isIpOnlyDetail =
    humanDetails && /^IP:\s*[\d.:]+$/.test(humanDetails.trim())
  const showHumanDetails = humanDetails && !isIpOnlyDetail

  return (
    <Modal
      isOpen={!!log}
      onClose={onClose}
      title={t('auditLogs.detailsTitle')}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors min-h-[48px] flex items-center justify-center font-medium"
        >
          {t('common.close')}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Блок 1: Карточка действия — главный акцент */}
        <div
          className={cn(
            'p-4 rounded-xl border border-border/50',
            actionStyle.bg
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-lg font-bold leading-tight',
                  actionStyle.color
                )}
              >
                {descriptionText}
              </p>
              {entityName && (
                <p className="text-sm text-foreground/80 mt-1 font-medium">
                  &quot;{entityName}&quot;
                </p>
              )}
              {showHumanDetails && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  {humanDetails}
                </p>
              )}
            </div>
            {log.severity && <SeverityBadge severity={log.severity} t={t} />}
          </div>
        </div>

        {/* Блок 2: Время + Пользователь — компактная строка */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-muted rounded-lg shrink-0">
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {t('auditLogs.time')}
              </p>
              <p className="font-medium text-foreground text-sm">
                {formatDate(log.created_at, true)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-muted rounded-lg shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {t('auditLogs.user')}
              </p>
              <p className="font-medium text-foreground text-sm">
                {log.user_name}
              </p>
              {log.department_name && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.department_name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Блок 3: Объект (entity) */}
        {(log.entity_type || entityName) && (
          <>
            <Divider />
            <div>
              <SectionTitle icon={Package}>
                {t('auditLogs.entity')}
              </SectionTitle>
              <div className="flex flex-wrap items-center gap-2">
                {entityTypeLabel && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 text-accent text-xs rounded-full font-medium">
                    <Tag className="w-3 h-3" />
                    {entityTypeLabel}
                  </span>
                )}
                {entityName && (
                  <span className="font-medium text-foreground text-sm">
                    &quot;{entityName}&quot;
                  </span>
                )}
                <CopyableId value={log.entity_id} />
              </div>
            </div>
          </>
        )}

        {/* Блок 4: Подробности о действии */}

        {/* UPDATE — таблица изменений */}
        {hasChanges && (
          <>
            <Divider />
            <div>
              <SectionTitle icon={ArrowRight}>
                {t('auditLogs.detailModal.whatChanged')}
              </SectionTitle>
              <ChangesSection before={before} after={after} t={t} />
            </div>
          </>
        )}

        {/* CREATE — поля созданного объекта */}
        {isCreate && after && (
          <>
            <Divider />
            <div>
              <SectionTitle icon={Database}>
                {t('auditLogs.detailModal.createdObject')}
              </SectionTitle>
              <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                <SnapshotFields snapshot={after} t={t} />
              </div>
            </div>
          </>
        )}

        {/* DELETE — что было удалено */}
        {isDelete && before && (
          <>
            <Divider />
            <div>
              <SectionTitle icon={Database}>
                {t('auditLogs.detailModal.deletedObject')}
              </SectionTitle>
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                <SnapshotFields snapshot={before} t={t} />
              </div>
            </div>
          </>
        )}

        {/* Поле details (JSON) — дополнительный контекст */}
        {hasDetails && (
          <>
            <Divider />
            <div>
              <SectionTitle icon={Info}>
                {t('auditLogs.detailModal.actionData')}
              </SectionTitle>
              <div className="p-3 bg-muted/40 border border-border/50 rounded-lg">
                <DetailsFields details={log.details} t={t} />
              </div>
            </div>
          </>
        )}

        {/* Блок 5: Техническая информация */}
        {(log.ip_address || log.browser_name) && (
          <>
            <Divider />
            <div>
              <SectionTitle icon={Shield}>
                {t('auditLogs.detailModal.technicalInfo')}
              </SectionTitle>
              <div className="space-y-2">
                {log.ip_address && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">IP:</span>
                    <span className="font-mono text-foreground bg-muted px-2 py-0.5 rounded text-xs">
                      {log.ip_address}
                    </span>
                  </div>
                )}
                {log.browser_name && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      {t('auditLogs.browser')}:
                    </span>
                    <span className="text-foreground">{log.browser_name}</span>
                    {log.os_name && (
                      <span className="text-muted-foreground">
                        / {log.os_name}
                      </span>
                    )}
                  </div>
                )}
                {log.device_type && log.device_type !== 'desktop' && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      {t('auditLogs.detailModal.device')}:
                    </span>
                    <span className="text-foreground capitalize">
                      {log.device_type}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Блок 6: Raw JSON (сворачивается) */}
        {(before || after) && (
          <>
            <Divider />
            <div>
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {showRaw ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {t('auditLogs.technicalDataJson')}
              </button>
              {showRaw && (
                <div className="mt-3 space-y-3">
                  {before && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                        {t('auditLogs.beforeChange')}
                      </p>
                      <pre className="p-3 bg-muted/60 border border-border/50 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
                        {JSON.stringify(before, null, 2)}
                      </pre>
                    </div>
                  )}
                  {after && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                        {t('auditLogs.afterChange')}
                      </p>
                      <pre className="p-3 bg-muted/60 border border-border/50 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
                        {JSON.stringify(after, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
