/**
 * ScheduleEditModal
 * Модальное окно редактирования расписания экспорта (общий Modal + Tailwind)
 */

import { useState, useEffect } from 'react'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../context/LanguageContext'
import { logError } from '../../utils/logger'
import { apiFetch } from '../../services/api'
import Modal from '../ui/Modal'
import { TouchButton, Switch } from '../ui'
import { EXPORT_TYPES } from '../../config/exportConfig'
import {
  Package,
  FileSpreadsheet,
  FolderTree,
  Tags,
  History,
  FileText,
  MessageSquare,
  HeartPulse,
  CalendarClock,
  ClipboardList,
  TrendingUp,
  BarChart3,
  PieChart,
  Layers,
  LayoutDashboard,
} from 'lucide-react'

const EXPORT_ICONS = {
  products: Package,
  batches: FileSpreadsheet,
  inventory: Package,
  collections: History,
  categories: Tags,
  departments: FolderTree,
  audit: FileText,
  'health-summary': HeartPulse,
  'expiry-forecast': CalendarClock,
  'collection-activity': ClipboardList,
  'product-turnover': TrendingUp,
  'department-scorecard': BarChart3,
  'collection-reasons': PieChart,
  'batch-age-distribution': Layers,
  'weekly-summary': LayoutDashboard,
}

const SCHEDULABLE_TYPES = [
  'products',
  'batches',
  'inventory',
  'collections',
  'categories',
  'departments',
  'audit',
  'health-summary',
  'expiry-forecast',
  'collection-activity',
  'product-turnover',
  'department-scorecard',
  'collection-reasons',
  'batch-age-distribution',
  'weekly-summary',
]

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function parseJSON(value) {
  if (Array.isArray(value)) return value
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

export function ScheduleEditModal({ schedule, onClose, onSuccess }) {
  const { addToast } = useToast()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [linkedChats, setLinkedChats] = useState([])
  const [formData, setFormData] = useState({
    department_id: schedule.department_id || '',
    schedule_type: schedule.schedule_type || 'daily',
    day_of_week: schedule.day_of_week ?? 1,
    day_of_month: schedule.day_of_month ?? 1,
    time: schedule.time || '06:00',
    timezone: schedule.timezone || 'Asia/Almaty',
    export_types: parseJSON(schedule.export_types),
    export_formats: parseJSON(schedule.export_formats),
    delivery_method: schedule.delivery_method || 'email',
    recipient_type: schedule.recipient_type || 'department',
    email_override: schedule.email_override || '',
    telegram_chat_id_override: schedule.telegram_chat_id_override || '',
    is_active: schedule.is_active ?? true,
    download_pin: '',
    link_expiry_hours: schedule.link_expiry_hours || 72,
  })

  useEffect(() => {
    loadDepartments()
    loadLinkedChats()
  }, [])

  const loadLinkedChats = async () => {
    try {
      const data = await apiFetch('/settings/telegram/chats')
      setLinkedChats(data?.chats ?? [])
    } catch {
      setLinkedChats([])
    }
  }

  const loadDepartmentDetails = async (deptId, fallbackList = []) => {
    if (!deptId) {
      setSelectedDepartment(null)
      return
    }
    try {
      const data = await apiFetch(`/departments/${deptId}`)
      const dept = data?.department ?? data
      setSelectedDepartment(dept || null)
    } catch {
      const dept = fallbackList.find((d) => d.id === deptId)
      setSelectedDepartment(dept || null)
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await apiFetch('/departments')
      const list = Array.isArray(data) ? data : (data?.departments ?? [])
      setDepartments(list)
      if (schedule.department_id) {
        await loadDepartmentDetails(schedule.department_id, list)
      }
    } catch (error) {
      logError('Failed to load departments:', error)
    }
  }

  const handleDepartmentChange = (deptId) => {
    setFormData((prev) => ({ ...prev, department_id: deptId }))
    loadDepartmentDetails(deptId, departments)
  }

  const linkedChatsForDepartment = selectedDepartment
    ? linkedChats.filter(
        (c) =>
          c.department_id === selectedDepartment.id ||
          (c.department_id == null &&
            c.hotel_id === selectedDepartment.hotel_id)
      )
    : []

  const effectiveTelegramChatId =
    formData.telegram_chat_id_override?.trim() ||
    selectedDepartment?.telegram_chat_id ||
    linkedChatsForDepartment[0]?.chat_id?.toString() ||
    ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Защита от множественных кликов
    if (loading) return
    if (!formData.department_id) {
      addToast(t('scheduledExports.selectDepartment'), 'error')
      return
    }
    if (formData.export_types.length === 0) {
      addToast(t('scheduledExports.chooseReportTypes'), 'error')
      return
    }

    // PIN validation (only if non-empty)
    if (formData.download_pin && formData.download_pin.length < 4) {
      addToast(
        t('scheduledExports.pinRequired') ||
          'PIN must be at least 4 characters',
        'error'
      )
      return
    }

    if (
      formData.delivery_method === 'email' ||
      formData.delivery_method === 'both'
    ) {
      if (!formData.email_override && !selectedDepartment?.email) {
        addToast(
          t('scheduledExports.emailRequired') ||
            'Укажите email для отправки или настройте email отдела',
          'error'
        )
        return
      }
    }

    if (
      formData.delivery_method === 'telegram' ||
      formData.delivery_method === 'both'
    ) {
      if (!effectiveTelegramChatId) {
        addToast(
          t('scheduledExports.telegramRequired') ||
            'Привяжите бота в чат (Уведомления) или укажите Chat ID в настройках отдела',
          'error'
        )
        return
      }
    }
    setLoading(true)
    try {
      const telegramOverride =
        formData.telegram_chat_id_override?.trim() ||
        (linkedChatsForDepartment[0]?.chat_id &&
        !selectedDepartment?.telegram_chat_id
          ? String(linkedChatsForDepartment[0].chat_id)
          : null)

      await apiFetch(`/scheduled-exports/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...formData,
          telegram_chat_id_override: telegramOverride || null,
          day_of_week:
            formData.schedule_type === 'weekly'
              ? parseInt(formData.day_of_week)
              : undefined,
          day_of_month:
            formData.schedule_type === 'monthly'
              ? parseInt(formData.day_of_month)
              : undefined,
          ...(formData.download_pin
            ? { download_pin: formData.download_pin }
            : {}),
          link_expiry_hours: formData.link_expiry_hours,
        }),
      })
      addToast(t('scheduledExports.updateSuccess'), 'success')
      onSuccess()
    } catch (error) {
      logError('Failed to update schedule:', error)
      addToast(error?.message || t('scheduledExports.updateError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExportTypeChange = (type) => {
    setFormData((prev) => ({
      ...prev,
      export_types: prev.export_types.includes(type)
        ? prev.export_types.filter((x) => x !== type)
        : [...prev.export_types, type],
    }))
  }

  const handleFormatChange = (format) => {
    setFormData((prev) => ({
      ...prev,
      export_formats: prev.export_formats.includes(format)
        ? prev.export_formats.filter((f) => f !== format)
        : [...prev.export_formats, format],
    }))
  }

  // Dynamic from centralized config (same as ScheduleCreateModal)
  const exportTypeOptions = SCHEDULABLE_TYPES.map((typeId) => {
    const config = EXPORT_TYPES[typeId]
    if (!config) return null
    return {
      value: typeId,
      label: config.title,
      subtitle: config.subtitle,
      icon: EXPORT_ICONS[typeId],
    }
  }).filter(Boolean)

  const formatOptions = [
    { value: 'excel', labelKey: 'formatExcel', disabled: false },
    { value: 'csv', labelKey: 'formatCsv', disabled: false },
    { value: 'pdf', labelKey: 'formatPdf', disabled: false },
  ]

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('scheduledExports.editTitle')}
      size="lg"
      footer={
        <>
          <TouchButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </TouchButton>
          <TouchButton
            variant="primary"
            type="submit"
            form="schedule-edit-form"
            loading={loading}
            disabled={loading}
          >
            {loading ? t('common.saving') : t('common.save')}
          </TouchButton>
        </>
      }
    >
      <form
        id="schedule-edit-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('scheduledExports.department')}{' '}
            <span className="text-danger">*</span>
          </label>
          <select
            value={formData.department_id}
            onChange={(e) => handleDepartmentChange(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="">{t('common.select')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div
          className="flex items-center gap-2 min-h-[48px] cursor-pointer"
          onClick={() =>
            setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))
            }
          }}
          role="button"
          tabIndex={0}
        >
          <Switch
            checked={formData.is_active}
            onChange={(v) => setFormData((prev) => ({ ...prev, is_active: v }))}
            aria-label={t('scheduledExports.isActive')}
          />
          <span className="text-sm font-medium text-foreground">
            {t('scheduledExports.isActive')}
          </span>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('scheduledExports.scheduleType')}{' '}
            <span className="text-danger">*</span>
          </label>
          <select
            value={formData.schedule_type}
            onChange={(e) =>
              setFormData({ ...formData, schedule_type: e.target.value })
            }
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="daily">{t('scheduledExports.daily')}</option>
            <option value="weekly">{t('scheduledExports.weekly')}</option>
            <option value="monthly">{t('scheduledExports.monthly')}</option>
          </select>
        </div>

        {formData.schedule_type === 'weekly' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('scheduledExports.dayOfWeek')}
            </label>
            <select
              value={formData.day_of_week}
              onChange={(e) =>
                setFormData({ ...formData, day_of_week: e.target.value })
              }
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {dayKeys.map((key, i) => (
                <option key={key} value={i}>
                  {t(`scheduledExports.days.${key}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        {formData.schedule_type === 'monthly' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('scheduledExports.dayOfMonth')}
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={formData.day_of_month}
              onChange={(e) =>
                setFormData({ ...formData, day_of_month: e.target.value })
              }
              required
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('scheduledExports.time')} <span className="text-danger">*</span>
          </label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('scheduledExports.reportTypes')}{' '}
            <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exportTypeOptions.map((opt) => {
              const Icon = opt.icon
              const isChecked = formData.export_types.includes(opt.value)
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all min-h-[48px] ${
                    isChecked
                      ? 'border-accent bg-accent/10'
                      : 'border-border hover:border-accent/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleExportTypeChange(opt.value)}
                    className="mt-1 w-5 h-5 rounded border-border text-accent"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="w-4 h-4 text-foreground" />}
                      <span className="font-medium text-foreground">
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.subtitle}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('scheduledExports.formats')}{' '}
            <span className="text-danger">*</span>
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {formatOptions.map((opt) => (
              <label
                key={opt.value}
                className={`inline-flex items-center gap-2 min-h-[48px] text-sm ${opt.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={formData.export_formats.includes(opt.value)}
                  onChange={() =>
                    !opt.disabled && handleFormatChange(opt.value)
                  }
                  disabled={opt.disabled}
                  className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                />
                <span className="text-foreground">
                  {t(`scheduledExports.${opt.labelKey}`)}
                </span>
                {opt.hint && (
                  <span className="text-xs text-muted-foreground">
                    ({opt.hint})
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('scheduledExports.deliveryMethod')}{' '}
            <span className="text-danger">*</span>
          </label>
          <select
            value={formData.delivery_method}
            onChange={(e) =>
              setFormData({ ...formData, delivery_method: e.target.value })
            }
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-60"
          >
            <option value="email">{t('scheduledExports.deliveryEmail')}</option>
            <option value="telegram">
              {t('scheduledExports.deliveryTelegram')}
            </option>
            <option value="both">{t('scheduledExports.deliveryBoth')}</option>
          </select>

          {selectedDepartment && (
            <div className="mt-3 p-3 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs font-medium text-foreground mb-2">
                {t('scheduledExports.departmentSettings') ||
                  'Настройки отдела:'}
              </p>
              <div className="space-y-2 text-sm">
                <div
                  className={`flex items-center gap-1.5 ${
                    selectedDepartment.email
                      ? 'text-success'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedDepartment.email
                        ? 'bg-success'
                        : 'bg-muted-foreground'
                    }`}
                    aria-hidden
                  />
                  Email:{' '}
                  {selectedDepartment.email ||
                    t('scheduledExports.notConfigured') ||
                    'Не настроен'}
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    effectiveTelegramChatId
                      ? 'text-success'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      effectiveTelegramChatId
                        ? 'bg-success'
                        : 'bg-muted-foreground'
                    }`}
                    aria-hidden
                  />
                  Telegram:{' '}
                  {effectiveTelegramChatId ? (
                    linkedChatsForDepartment.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {linkedChatsForDepartment.map((chat) => (
                          <span
                            key={chat.chat_id}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0088cc]/10 text-[#0088cc]"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {chat.chat_title || 'Чат'} — {chat.chat_id}
                            {chat.hotel_name && (
                              <span className="text-muted-foreground text-xs">
                                ({chat.hotel_name})
                              </span>
                            )}
                          </span>
                        ))}
                      </span>
                    ) : (
                      selectedDepartment.telegram_chat_id ||
                      formData.telegram_chat_id_override
                    )
                  ) : (
                    t('scheduledExports.notConfigured') || 'Не настроен'
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {(formData.delivery_method === 'email' ||
          formData.delivery_method === 'both') && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('scheduledExports.emailOverride')}
              {!selectedDepartment?.email && (
                <span className="text-danger ml-1">*</span>
              )}
            </label>
            <input
              type="email"
              value={formData.email_override}
              onChange={(e) =>
                setFormData({ ...formData, email_override: e.target.value })
              }
              placeholder={t('scheduledExports.emailPlaceholder')}
              required={!selectedDepartment?.email}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            {selectedDepartment?.email ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t('scheduledExports.emailHelp')} (Default:{' '}
                {selectedDepartment.email})
              </p>
            ) : (
              <p className="text-xs text-warning mt-1">
                {t('scheduledExports.emailRequired') ||
                  'У отдела не настроен email. Укажите email для отправки.'}
              </p>
            )}
          </div>
        )}

        {(formData.delivery_method === 'telegram' ||
          formData.delivery_method === 'both') && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('scheduledExports.telegramOverride')}
              {!effectiveTelegramChatId && (
                <span className="text-danger ml-1">*</span>
              )}
            </label>
            {linkedChatsForDepartment.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  {t('scheduledExports.telegramLinkedChats') ||
                    'Используется привязанный чат из раздела Уведомления'}
                </p>
                <div className="space-y-2">
                  {linkedChatsForDepartment.map((chat) => (
                    <div
                      key={chat.chat_id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border"
                    >
                      <MessageSquare className="w-4 h-4 text-[#0088cc] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">
                          {chat.chat_title || 'Чат'}
                        </span>
                        {chat.hotel_name && (
                          <span className="text-muted-foreground text-xs ml-1">
                            — {chat.hotel_name}
                          </span>
                        )}
                        <span className="text-muted-foreground text-xs ml-1">
                          ({chat.chat_id})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <input
                type="text"
                value={formData.telegram_chat_id_override}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    telegram_chat_id_override: e.target.value,
                  })
                }
                placeholder={t('scheduledExports.telegramPlaceholder')}
                required={!effectiveTelegramChatId}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            )}
            {effectiveTelegramChatId &&
              linkedChatsForDepartment.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('scheduledExports.telegramHelp')} (
                  {selectedDepartment?.telegram_chat_id ||
                    formData.telegram_chat_id_override}
                  )
                </p>
              )}
            {!effectiveTelegramChatId && (
              <p className="text-xs text-warning mt-1">
                {t('scheduledExports.telegramLinkHint') ||
                  'Добавьте бота в чат в разделе Уведомления или укажите Chat ID ниже.'}
              </p>
            )}
          </div>
        )}

        {/* PIN and link expiry */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
          <p className="text-xs font-medium text-foreground mb-3">
            {t('scheduledExports.securitySettings') ||
              '🔐 Безопасность скачивания'}
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('scheduledExports.pinLabel') || 'PIN для скачивания'}
              </label>
              <input
                type="text"
                value={formData.download_pin}
                onChange={(e) =>
                  setFormData({ ...formData, download_pin: e.target.value })
                }
                placeholder={
                  t('scheduledExports.pinKeepCurrent') ||
                  'Оставьте пустым, чтобы сохранить текущий'
                }
                minLength={4}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t('scheduledExports.linkExpiryLabel') ||
                  'Срок действия ссылки (часы)'}
              </label>
              <input
                type="number"
                value={formData.link_expiry_hours}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    link_expiry_hours: parseInt(e.target.value) || 72,
                  })
                }
                min={1}
                max={720}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}
