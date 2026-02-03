/**
 * ScheduledExportsManager
 * Управление запланированными экспортами (стиль сайта: Tailwind + SettingsLayout)
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../context/LanguageContext'
import { apiFetch } from '../../services/api'
import { Send, Calendar, Clock, BarChart3, FileText, Mail, Loader2, Pencil, Trash2, Power, PowerOff, Package, FileSpreadsheet, FolderTree, Tags, History } from 'lucide-react'
import { SectionLoader, TouchButton } from '../ui'
import SettingsLayout from '../ui/settings/SettingsLayout'
import { ScheduleCreateModal } from './ScheduleCreateModal'
import { ScheduleEditModal } from './ScheduleEditModal'
import { EXPORT_TYPES } from '../../config/exportConfig'

// Иконки для типов экспорта
const EXPORT_ICONS = {
  products: Package,
  batches: FileSpreadsheet,
  inventory: Package,
  collections: History,
  categories: Tags,
  departments: FolderTree,
  audit: FileText
}

/**
 * ScheduleCard - карточка расписания экспорта
 */
function ScheduleCard({ schedule, t, testingSchedule, onTest, onEdit, onToggleActive, onDelete }) {
  const exportTypes = Array.isArray(schedule.export_types)
    ? schedule.export_types
    : JSON.parse(schedule.export_types || '[]')
  const exportFormats = Array.isArray(schedule.export_formats)
    ? schedule.export_formats
    : JSON.parse(schedule.export_formats || '["excel"]')

  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

  const formatScheduleType = (type, dayOfWeek, dayOfMonth) => {
    if (type === 'daily') return t('scheduledExports.daily')
    if (type === 'weekly') {
      const key = dayKeys[Number(dayOfWeek)] ?? 'mon'
      return `${t('scheduledExports.weekly')} (${t(`scheduledExports.days.${key}`)})`
    }
    if (type === 'monthly') return `${t('scheduledExports.monthly')} (${dayOfMonth})`
    return type
  }

  const formatDeliveryMethod = (method) => {
    const map = {
      email: t('scheduledExports.deliveryEmail'),
      telegram: t('scheduledExports.deliveryTelegram'),
      both: t('scheduledExports.deliveryBoth')
    }
    return map[method] ?? method
  }

  const getStatusColor = (status) => {
    if (status === 'success') return 'text-success'
    if (status === 'failed') return 'text-danger'
    if (status === 'partial') return 'text-warning'
    return 'text-muted-foreground'
  }

  return (
    <div
      className={`p-5 border border-border rounded-xl bg-card transition-colors ${
        !schedule.is_active ? 'opacity-75 border-muted-foreground/30' : 'hover:border-accent/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="font-semibold text-foreground truncate flex-1 min-w-0">
          {schedule.department_name}
        </h3>
        <span
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
            schedule.is_active
              ? 'bg-success/15 text-success'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {schedule.is_active ? t('common.active') : t('common.inactive')}
        </span>
      </div>

      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t('scheduledExports.schedule')}: </span>
            {formatScheduleType(schedule.schedule_type, schedule.day_of_week, schedule.day_of_month)} {t('scheduledExports.at') || 'в'} {schedule.time}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-muted-foreground flex-1">
            <span className="font-medium text-foreground">{t('scheduledExports.reports')}: </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {exportTypes.map((type) => {
                const config = EXPORT_TYPES[type]
                const Icon = EXPORT_ICONS[type]
                if (!config) return null
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-accent/10 text-accent rounded-md text-xs font-medium"
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {config.title}
                  </span>
                )
              })}
            </div>
          </div>
        </li>
        <li className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-muted-foreground flex-1">
            <span className="font-medium text-foreground">{t('scheduledExports.format')}: </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {exportFormats.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center px-2 py-1 bg-muted text-foreground rounded-md text-xs font-medium uppercase"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </li>
        <li className="flex items-start gap-2">
          {schedule.delivery_method === 'email' && <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />}
          {schedule.delivery_method === 'telegram' && <Send className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />}
          {schedule.delivery_method === 'both' && <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />}
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t('scheduledExports.delivery')}: </span>
            {formatDeliveryMethod(schedule.delivery_method)}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t('scheduledExports.nextRun')}: </span>
            {schedule.next_run_at
              ? new Date(schedule.next_run_at).toLocaleString(undefined, {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })
              : '–'}
          </span>
        </li>
        {schedule.last_run_at && (
          <li className="flex items-start gap-2">
            <span className="shrink-0 mt-0.5" aria-hidden="true">
              {schedule.last_run_status === 'success' ? '✓' : '✕'}
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{t('scheduledExports.lastRun')}: </span>
              {new Date(schedule.last_run_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}{' '}
              <span className={getStatusColor(schedule.last_run_status)}>
                {schedule.last_run_status === 'success'
                  ? t('scheduledExports.statusSuccess') || 'Успешно'
                  : schedule.last_run_status === 'failed'
                    ? t('scheduledExports.statusFailed') || 'Ошибка'
                    : schedule.last_run_status === 'partial'
                      ? t('scheduledExports.statusPartial') || 'Частично'
                      : schedule.last_run_status}
              </span>
            </span>
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
        <TouchButton
          variant="secondary"
          size="sm"
          onClick={() => onTest(schedule)}
          loading={testingSchedule === schedule.id}
          disabled={testingSchedule === schedule.id}
          icon={Send}
          className="min-h-[44px]"
        >
          {t('scheduledExports.test')}
        </TouchButton>
        <TouchButton
          variant="secondary"
          size="sm"
          onClick={() => onEdit(schedule)}
          icon={Pencil}
          className="min-h-[44px]"
        >
          {t('common.edit')}
        </TouchButton>
        <TouchButton
          variant="secondary"
          size="sm"
          onClick={() => onToggleActive(schedule)}
          icon={schedule.is_active ? PowerOff : Power}
          className="min-h-[44px]"
        >
          {schedule.is_active ? t('scheduledExports.disable') : t('scheduledExports.enable')}
        </TouchButton>
        <TouchButton
          variant="danger"
          size="sm"
          onClick={() => onDelete(schedule)}
          icon={Trash2}
          className="min-h-[44px]"
        >
          {t('common.delete')}
        </TouchButton>
      </div>
    </div>
  )
}

export function ScheduledExportsManager() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const { t } = useTranslation()
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [testingSchedule, setTestingSchedule] = useState(null)

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const data = await apiFetch('/scheduled-exports')
      setSchedules(data)
    } catch (error) {
      console.error('Failed to load schedules:', error)
      addToast(t('scheduledExports.loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (schedule) => {
    if (!confirm(t('scheduledExports.confirmDelete'))) return
    try {
      await apiFetch(`/scheduled-exports/${schedule.id}`, { method: 'DELETE' })
      addToast(t('scheduledExports.deleteSuccess'), 'success')
      loadSchedules()
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      addToast(t('scheduledExports.deleteError'), 'error')
    }
  }

  const handleTest = async (schedule) => {
    setTestingSchedule(schedule.id)
    try {
      await apiFetch(`/scheduled-exports/${schedule.id}/test`, { method: 'POST' })
      addToast(t('scheduledExports.testStarted'), 'success')
    } catch (error) {
      console.error('Failed to test schedule:', error)
      addToast(t('scheduledExports.testError'), 'error')
    } finally {
      setTestingSchedule(null)
    }
  }

  const handleToggleActive = async (schedule) => {
    try {
      await apiFetch(`/scheduled-exports/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !schedule.is_active })
      })
      addToast(
        schedule.is_active ? t('scheduledExports.disabled') : t('scheduledExports.enabled'),
        'success'
      )
      loadSchedules()
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
      addToast(t('scheduledExports.toggleError'), 'error')
    }
  }

  if (loading) {
    return (
      <SettingsLayout
        title={t('scheduledExports.title')}
        description={t('scheduledExports.description')}
        icon={Send}
        loading
      >
        <SectionLoader message={t('common.loading')} className="py-12" />
      </SettingsLayout>
    )
  }

  return (
    <SettingsLayout
      title={t('scheduledExports.title')}
      description={t('scheduledExports.description')}
      icon={Send}
      hideSaveButton
      headerActions={
        <TouchButton
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          icon={Calendar}
          className="min-h-[48px]"
        >
          + {t('scheduledExports.create')}
        </TouchButton>
      }
    >
      {schedules.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-xl bg-card text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Calendar className="w-8 h-8 text-accent" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t('scheduledExports.noSchedules')}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            {t('scheduledExports.emptyDescription')}
          </p>
          <TouchButton variant="primary" onClick={() => setShowCreateModal(true)} icon={Calendar}>
            {t('scheduledExports.createFirst')}
          </TouchButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              t={t}
              testingSchedule={testingSchedule}
              onTest={handleTest}
              onEdit={setEditingSchedule}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <ScheduleCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadSchedules()
          }}
        />
      )}

      {editingSchedule && (
        <ScheduleEditModal
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSuccess={() => {
            setEditingSchedule(null)
            loadSchedules()
          }}
        />
      )}
    </SettingsLayout>
  )
}
