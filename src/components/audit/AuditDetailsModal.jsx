import { useState } from 'react'
import {
  Clock, User, Monitor, Globe, MapPin, ChevronDown, ChevronUp,
  Package, Tag, ArrowRight, AlertCircle, AlertTriangle, Info
} from 'lucide-react'
import { useTranslation } from '../../context/LanguageContext'
import { formatDate } from '../../utils/dateUtils'
import Modal from '../ui/Modal'
import { cn } from '../../utils/classNames'

// Словари
const ENTITY_TYPE_LABELS = {
  product: 'Продукт',
  batch: 'Партия',
  user: 'Пользователь',
  category: 'Категория',
  department: 'Отдел',
  hotel: 'Отель',
  settings: 'Настройки',
  write_off: 'Списание',
  collection: 'Сбор',
  marsha_code: 'MARSHA код',
  notification_rule: 'Правило уведомлений',
  template: 'Шаблон',
  delivery_template: 'Шаблон доставки',
  join_request: 'Заявка на вступление',
  session: 'Сессия',
  account: 'Аккаунт',
}

const FIELD_LABELS = {
  name: 'Название',
  quantity: 'Количество',
  unit: 'Единица',
  expiry_date: 'Срок годности',
  category_name: 'Категория',
  status: 'Статус',
  email: 'Email',
  role: 'Роль',
  is_active: 'Активен',
  price: 'Цена',
  description: 'Описание',
  min_quantity: 'Мин. количество',
  notification_threshold: 'Порог уведомлений',
  login: 'Логин',
  department_name: 'Отдел',
  hotel_name: 'Отель',
  reason: 'Причина',
  batch_name: 'Партия',
  product_name: 'Продукт',
  category_id: 'ID категории',
  is_enabled: 'Включено',
  schedule: 'Расписание',
}

const DETAILS_LABELS = {
  method: 'Метод',
  format: 'Формат',
  recordCount: 'Кол-во записей',
  reason: 'Причина',
  exportType: 'Тип экспорта',
  action: 'Действие',
  setting: 'Настройка',
  value: 'Значение',
  key: 'Ключ',
  count: 'Количество',
  total: 'Всего',
  batchCount: 'Партий',
  productCount: 'Продуктов',
  department: 'Отдел',
}

const SKIP_SNAPSHOT_KEYS = [
  'id', 'created_at', 'updated_at', 'hotel_id', 'department_id',
  '_snapshot_type', '_snapshot_time', 'user_id', 'category_id'
]

function formatValue(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет'
  if (typeof val === 'object') return JSON.stringify(val)
  // Format dates
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    try {
      return new Date(val).toLocaleDateString('ru-RU')
    } catch { return val }
  }
  return String(val)
}

function SeverityBadge({ severity }) {
  const configs = {
    critical: { icon: AlertCircle, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Критично' },
    important: { icon: AlertTriangle, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Важно' },
    normal: { icon: Info, className: 'bg-muted text-muted-foreground', label: 'Обычно' },
  }
  const config = configs[severity] || configs.normal
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', config.className)}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}

// Секция: что именно изменилось (для UPDATE)
function ChangesSection({ before, after }) {
  if (!before || !after) return null
  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const changed = allKeys.filter(k => {
    if (SKIP_SNAPSHOT_KEYS.includes(k)) return false
    return String(before[k] ?? '') !== String(after[k] ?? '')
  })
  if (changed.length === 0) return <p className="text-sm text-muted-foreground">Без изменений</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Поле</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Было</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-6"></th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Стало</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {changed.map(k => (
            <tr key={k}>
              <td className="px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                {FIELD_LABELS[k] || k}
              </td>
              <td className="px-3 py-2 text-foreground line-through opacity-60 break-all">
                {formatValue(before[k])}
              </td>
              <td className="px-3 py-2 text-center">
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
              </td>
              <td className="px-3 py-2 text-foreground font-medium break-all">
                {formatValue(after[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Секция: поля снапшота (для CREATE/DELETE)
function SnapshotFields({ snapshot, skip = [] }) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const entries = Object.entries(snapshot).filter(([k]) =>
    !SKIP_SNAPSHOT_KEYS.includes(k) && !skip.includes(k)
  )
  if (entries.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <span className="text-xs text-muted-foreground">{FIELD_LABELS[k] || k}</span>
          <span className="text-sm text-foreground font-medium break-all">{formatValue(v)}</span>
        </div>
      ))}
    </div>
  )
}

// Секция: поле details JSON как читаемые KV
function DetailsFields({ details }) {
  if (!details || typeof details !== 'object' || Object.keys(details).length === 0) return null
  const entries = Object.entries(details).filter(([k]) =>
    !['id', 'hotel_id', 'user_id', 'timestamp'].includes(k)
  )
  if (entries.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <span className="text-xs text-muted-foreground">{DETAILS_LABELS[k] || k}</span>
          <span className="text-sm text-foreground font-medium break-all">{formatValue(v)}</span>
        </div>
      ))}
    </div>
  )
}

export function AuditDetailsModal({ log, onClose }) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)

  if (!log) return null

  const action = (log.action || '').toUpperCase()
  const entityTypeLabel = ENTITY_TYPE_LABELS[log.entity_type?.toLowerCase()] || log.entity_type
  const after = log.snapshot_after
  const before = log.snapshot_before
  const entityName = after?.name || before?.name

  // Определяем что показывать в секции "Подробности о действии"
  const isLogin = ['LOGIN', 'LOGOUT', 'LOGIN_FAILED'].includes(action)
  const isUpdate = action === 'UPDATE'
  const isCreate = action === 'CREATE'
  const isDelete = action === 'DELETE'
  const hasChanges = isUpdate && before && after
  const hasSnapshot = (isCreate && after) || (isDelete && before)
  const hasDetails = log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0

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
          className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors min-h-[48px] flex items-center justify-center"
        >
          {t('common.close')}
        </button>
      }
    >
      <div className="space-y-5">

        {/* Блок 1: Время + Пользователь + Критичность */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5" />
              {t('auditLogs.time')}
            </label>
            <p className="font-medium text-foreground">{formatDate(log.created_at, true)}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <User className="w-3.5 h-3.5" />
              {t('auditLogs.user')}
            </label>
            <p className="font-medium text-foreground">
              {log.user_name}
              {log.department_name && (
                <span className="block text-sm text-muted-foreground font-normal">{log.department_name}</span>
              )}
            </p>
          </div>
        </div>

        {/* Блок 2: Действие + критичность */}
        <div className="p-3 bg-muted/50 rounded-lg flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('auditLogs.action')}</p>
            <p className="font-semibold text-foreground text-base">
              {log.human_readable_description || log.action}
            </p>
            {log.human_readable_details && (
              <p className="text-sm text-muted-foreground mt-0.5">{log.human_readable_details}</p>
            )}
          </div>
          {log.severity && <SeverityBadge severity={log.severity} />}
        </div>

        {/* Блок 3: Объект (entity) */}
        {(log.entity_type || entityName) && (
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
              <Package className="w-3.5 h-3.5" />
              Объект
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {entityTypeLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full">
                  <Tag className="w-3 h-3" />
                  {entityTypeLabel}
                </span>
              )}
              {entityName && (
                <span className="font-medium text-foreground">"{entityName}"</span>
              )}
              {log.entity_id && (
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                  {log.entity_id.length > 16 ? `${log.entity_id.slice(0, 8)}…` : log.entity_id}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Блок 4: Подробности о действии */}

        {/* UPDATE — таблица изменений */}
        {hasChanges && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Что изменилось</label>
            <ChangesSection before={before} after={after} />
          </div>
        )}

        {/* CREATE — поля созданного объекта */}
        {isCreate && after && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Созданный объект</label>
            <div className="p-3 bg-muted/50 rounded-lg">
              <SnapshotFields snapshot={after} />
            </div>
          </div>
        )}

        {/* DELETE — что было удалено */}
        {isDelete && before && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Удалённый объект</label>
            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
              <SnapshotFields snapshot={before} />
            </div>
          </div>
        )}

        {/* Поле details (JSON) — дополнительный контекст */}
        {hasDetails && (
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Данные действия</label>
            <div className="p-3 bg-muted/50 rounded-lg">
              <DetailsFields details={log.details} />
            </div>
          </div>
        )}

        {/* Блок 5: Технические данные */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Техническая информация</label>
          <div className="space-y-1.5">
            {log.ip_address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">IP:</span>
                <span className="font-mono text-foreground">{log.ip_address}</span>
              </div>
            )}
            {log.browser_name && (
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{t('auditLogs.browser')}:</span>
                <span className="text-foreground">{log.browser_name}</span>
                {log.os_name && <span className="text-muted-foreground">/ {log.os_name}</span>}
              </div>
            )}
            {log.device_type && log.device_type !== 'desktop' && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Устройство:</span>
                <span className="text-foreground capitalize">{log.device_type}</span>
              </div>
            )}
            {!log.ip_address && !log.browser_name && (
              <p className="text-sm text-muted-foreground">Нет данных</p>
            )}
          </div>
        </div>

        {/* Блок 6: Raw JSON (сворачивается) */}
        {(before || after) && (
          <div>
            <button
              type="button"
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {t('auditLogs.technicalDataJson')}
            </button>
            {showRaw && (
              <div className="mt-2 space-y-3">
                {before && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('auditLogs.beforeChange')}</p>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                      {JSON.stringify(before, null, 2)}
                    </pre>
                  </div>
                )}
                {after && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('auditLogs.afterChange')}</p>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                      {JSON.stringify(after, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>
  )
}
