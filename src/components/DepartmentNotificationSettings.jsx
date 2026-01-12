import { useState, useEffect } from 'react'
import { Bell, Clock, Mail, MessageSquare, Smartphone, Save } from 'lucide-react'
import { SectionLoader, ButtonLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { departments } from '../context/ProductContext'
import { cn } from '../utils/classNames'
import { apiFetch } from '../services/api'

export default function DepartmentNotificationSettings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/department-settings')
      setSettings(data.settings || {})
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = async (departmentId, field, value) => {
    // Обновляем локально
    setSettings((prev) => ({
      ...prev,
      [departmentId]: {
        ...prev[departmentId],
        [field]: value
      }
    }))
  }

  const saveDepartmentSettings = async (departmentId) => {
    setSaving(departmentId)
    try {
      await apiFetch(`/department-settings/${departmentId}`, {
        method: 'PUT',
        body: JSON.stringify(settings[departmentId] || {})
      })
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setSaving(null)
    }
  }

  const getSettings = (departmentId) => {
    return (
      settings[departmentId] || {
        telegramEnabled: true,
        pushEnabled: true,
        emailEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        notificationDays: [7, 3, 1]
      }
    )
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-primary-600" />
        <h3 className="font-medium text-foreground">
          {t('deptNotifications.title') || 'Уведомления по отделам'}
        </h3>
      </div>

      {departments.map((dept) => {
        const deptSettings = getSettings(dept.id)
        const isExpanded = expanded === dept.id

        return (
          <div key={dept.id} className="bg-muted/50 rounded-xl overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setExpanded(isExpanded ? null : dept.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
            >
              <span className="font-medium text-foreground">{dept.name}</span>
              <div className="flex items-center gap-3">
                {/* Quick status indicators */}
                <div className="flex gap-1">
                  {deptSettings.telegramEnabled && (
                    <MessageSquare className="w-4 h-4 text-accent" />
                  )}
                  {deptSettings.pushEnabled && <Smartphone className="w-4 h-4 text-green-500" />}
                  {deptSettings.emailEnabled && <Mail className="w-4 h-4 text-orange-500" />}
                </div>
                <svg
                  className={cn(
                    'w-5 h-5 text-gray-400 transition-transform',
                    isExpanded && 'rotate-180'
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                {/* Channels */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-500 mb-3">
                    {t('deptNotifications.channels') || 'Каналы уведомлений'}
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deptSettings.telegramEnabled}
                        onChange={(e) =>
                          updateSetting(dept.id, 'telegramEnabled', e.target.checked)
                        }
                        className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                      />
                      <MessageSquare className="w-4 h-4 text-accent" />
                      <span className="text-sm text-muted-foreground">Telegram</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deptSettings.pushEnabled}
                        onChange={(e) => updateSetting(dept.id, 'pushEnabled', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                      />
                      <Smartphone className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-muted-foreground">Push</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deptSettings.emailEnabled}
                        onChange={(e) => updateSetting(dept.id, 'emailEnabled', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                      />
                      <Mail className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-muted-foreground">Email</span>
                    </label>
                  </div>
                </div>

                {/* Quiet Hours */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {t('deptNotifications.quietHours') || 'Тихие часы'}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={deptSettings.quietHoursStart || '22:00'}
                      onChange={(e) => updateSetting(dept.id, 'quietHoursStart', e.target.value)}
                      className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
                    />
                    <span className="text-gray-500">—</span>
                    <input
                      type="time"
                      value={deptSettings.quietHoursEnd || '08:00'}
                      onChange={(e) => updateSetting(dept.id, 'quietHoursEnd', e.target.value)}
                      className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('deptNotifications.quietHoursHint') || 'В это время уведомления отключены'}
                  </p>
                </div>

                {/* Notification Days */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">
                    {t('deptNotifications.notifyDays') || 'Уведомлять за (дней)'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 5, 7, 14, 30].map((day) => {
                      const isSelected = (deptSettings.notificationDays || [7, 3, 1]).includes(day)
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const days = deptSettings.notificationDays || [7, 3, 1]
                            const newDays = isSelected
                              ? days.filter((d) => d !== day)
                              : [...days, day].sort((a, b) => b - a)
                            updateSetting(dept.id, 'notificationDays', newDays)
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          )}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => saveDepartmentSettings(dept.id)}
                    disabled={saving === dept.id}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm"
                    aria-busy={saving === dept.id}
                  >
                    {saving === dept.id ? <ButtonLoader /> : <Save className="w-4 h-4" />}
                    {t('common.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
