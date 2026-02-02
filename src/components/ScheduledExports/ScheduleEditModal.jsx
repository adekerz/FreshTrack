/**
 * ScheduleEditModal
 * Модальное окно редактирования расписания экспорта (общий Modal + Tailwind)
 */

import { useState, useEffect } from 'react'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../context/LanguageContext'
import { apiFetch } from '../../services/api'
import Modal from '../ui/Modal'
import { TouchButton } from '../ui'

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
    email_override: schedule.email_override || '',
    telegram_chat_id_override: schedule.telegram_chat_id_override || '',
    is_active: schedule.is_active ?? true
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      const data = await apiFetch('/departments')
      const list = Array.isArray(data) ? data : (data?.departments ?? [])
      setDepartments(list)
      // Установить выбранный отдел на основе schedule
      if (schedule.department_id) {
        const dept = list.find((d) => d.id === schedule.department_id)
        if (dept) setSelectedDepartment(dept)
      }
    } catch (error) {
      console.error('Failed to load departments:', error)
    }
  }

  const handleDepartmentChange = (deptId) => {
    setFormData({ ...formData, department_id: deptId })
    const dept = departments.find((d) => d.id === deptId)
    setSelectedDepartment(dept || null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.department_id) {
      addToast(t('scheduledExports.selectDepartment'), 'error')
      return
    }
    if (formData.export_types.length === 0) {
      addToast(t('scheduledExports.chooseReportTypes'), 'error')
      return
    }

    // Проверка email для email/both доставки
    if ((formData.delivery_method === 'email' || formData.delivery_method === 'both')) {
      if (!formData.email_override && !selectedDepartment?.email) {
        addToast(t('scheduledExports.emailRequired') || 'Укажите email для отправки или настройте email отдела', 'error')
        return
      }
    }

    // Проверка Telegram для telegram/both доставки
    if ((formData.delivery_method === 'telegram' || formData.delivery_method === 'both')) {
      if (!formData.telegram_chat_id_override && !selectedDepartment?.telegram_chat_id) {
        addToast(t('scheduledExports.telegramRequired') || 'Укажите Telegram Chat ID для отправки или настройте его в отделе', 'error')
        return
      }
    }
    setLoading(true)
    try {
      await apiFetch(`/scheduled-exports/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...formData,
          day_of_week: formData.schedule_type === 'weekly' ? parseInt(formData.day_of_week) : undefined,
          day_of_month: formData.schedule_type === 'monthly' ? parseInt(formData.day_of_month) : undefined
        })
      })
      addToast(t('scheduledExports.updateSuccess'), 'success')
      onSuccess()
    } catch (error) {
      console.error('Failed to update schedule:', error)
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
        : [...prev.export_types, type]
    }))
  }

  const handleFormatChange = (format) => {
    setFormData((prev) => ({
      ...prev,
      export_formats: prev.export_formats.includes(format)
        ? prev.export_formats.filter((f) => f !== format)
        : [...prev.export_formats, format]
    }))
  }

  const exportTypeOptions = [
    { value: 'inventory', labelKey: 'reportInventory' },
    { value: 'collections', labelKey: 'reportCollections' },
    { value: 'writeOffs', labelKey: 'reportWriteOffs' },
    { value: 'audit', labelKey: 'reportAudit' }
  ]
  const formatOptions = [
    { value: 'excel', labelKey: 'formatExcel' },
    { value: 'csv', labelKey: 'formatCsv' },
    { value: 'pdf', labelKey: 'formatPdf' }
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
          <TouchButton variant="primary" type="submit" form="schedule-edit-form" loading={loading} disabled={loading}>
            {loading ? t('common.saving') : t('common.save')}
          </TouchButton>
        </>
      }
    >
      <form id="schedule-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('scheduledExports.department')} <span className="text-danger">*</span>
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

        <div className="flex items-center gap-2 min-h-[48px]">
          <input
            type="checkbox"
            id="edit-is-active"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
          />
          <label htmlFor="edit-is-active" className="text-sm font-medium text-foreground cursor-pointer">
            {t('scheduledExports.isActive')}
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('scheduledExports.scheduleType')} <span className="text-danger">*</span>
          </label>
          <select
            value={formData.schedule_type}
            onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
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
            {t('scheduledExports.reportTypes')} <span className="text-danger">*</span>
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {exportTypeOptions.map((opt) => (
              <label
                key={opt.value}
                className="inline-flex items-center gap-2 cursor-pointer min-h-[48px] text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={formData.export_types.includes(opt.value)}
                  onChange={() => handleExportTypeChange(opt.value)}
                  className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                />
                <span>{t(`scheduledExports.${opt.labelKey}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('scheduledExports.formats')} <span className="text-danger">*</span>
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {formatOptions.map((opt) => (
              <label
                key={opt.value}
                className="inline-flex items-center gap-2 cursor-pointer min-h-[48px] text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={formData.export_formats.includes(opt.value)}
                  onChange={() => handleFormatChange(opt.value)}
                  className="w-5 h-5 rounded border-border text-accent focus:ring-accent"
                />
                <span>{t(`scheduledExports.${opt.labelKey}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('scheduledExports.deliveryMethod')} <span className="text-danger">*</span>
          </label>
          <select
            value={formData.delivery_method}
            onChange={(e) => setFormData({ ...formData, delivery_method: e.target.value })}
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="email">{t('scheduledExports.deliveryEmail')}</option>
            <option value="telegram">{t('scheduledExports.deliveryTelegram')}</option>
            <option value="both">{t('scheduledExports.deliveryBoth')}</option>
          </select>
        </div>

        {(formData.delivery_method === 'email' || formData.delivery_method === 'both') && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('scheduledExports.emailOverride')}
              {!selectedDepartment?.email && <span className="text-danger ml-1">*</span>}
            </label>
            <input
              type="email"
              value={formData.email_override}
              onChange={(e) => setFormData({ ...formData, email_override: e.target.value })}
              placeholder={t('scheduledExports.emailPlaceholder')}
              required={!selectedDepartment?.email}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            {selectedDepartment?.email ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t('scheduledExports.emailHelp')} (Default: {selectedDepartment.email})
              </p>
            ) : (
              <p className="text-xs text-warning mt-1">
                {t('scheduledExports.emailRequired') || 'У отдела не настроен email. Укажите email для отправки.'}
              </p>
            )}
          </div>
        )}

        {(formData.delivery_method === 'telegram' || formData.delivery_method === 'both') && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('scheduledExports.telegramOverride')}
              {!selectedDepartment?.telegram_chat_id && <span className="text-danger ml-1">*</span>}
            </label>
            <input
              type="text"
              value={formData.telegram_chat_id_override}
              onChange={(e) => setFormData({ ...formData, telegram_chat_id_override: e.target.value })}
              placeholder={t('scheduledExports.telegramPlaceholder')}
              required={!selectedDepartment?.telegram_chat_id}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-foreground min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            {selectedDepartment?.telegram_chat_id ? (
              <p className="text-xs text-muted-foreground mt-1">
                {t('scheduledExports.telegramHelp')} (Default: {selectedDepartment.telegram_chat_id})
              </p>
            ) : (
              <p className="text-xs text-warning mt-1">
                {t('scheduledExports.telegramRequired') || 'У отдела не настроен Telegram. Укажите Chat ID для отправки.'}
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
