/**
 * EmailSettings - Настройки SYSTEM Email уведомлений
 * Конфигурация SMTP для системных уведомлений (сроки годности, ежедневные отчёты)
 * Получатель: department.email (не user.email)
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useHotel } from '../../context/HotelContext'
import { apiFetch } from '../../services/api'
import { GridLoader, ButtonSpinner } from '../ui'
import {
  Save,
  Check,
  AlertCircle,
  Mail,
  Settings,
  TestTube,
  Clock,
  Users,
  AlertTriangle,
  Info
} from 'lucide-react'
import { cn } from '../../utils/classNames'

export default function EmailSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId, selectedHotel } = useHotel()

  const [settings, setSettings] = useState({
    enabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    // Расписание
    dailyReportTime: '08:00',
    dailyReportEnabled: true,
    instantAlertsEnabled: true
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (selectedHotelId) {
      loadSettings()
    }
  }, [selectedHotelId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/settings/email')
      if (data?.settings) {
        // Ensure all values are properly typed and have defaults
        setSettings((prev) => ({
          ...prev,
          enabled: data.settings.enabled ?? false,
          smtpHost: data.settings.smtpHost ?? '',
          smtpPort: typeof data.settings.smtpPort === 'number' ? data.settings.smtpPort : parseInt(data.settings.smtpPort) || 587,
          smtpSecure: data.settings.smtpSecure ?? false,
          smtpUser: data.settings.smtpUser ?? '',
          smtpPassword: data.settings.smtpPassword ?? '',
          fromEmail: data.settings.fromEmail ?? '',
          fromName: data.settings.fromName ?? '',
          dailyReportTime: data.settings.dailyReportTime ?? '08:00',
          dailyReportEnabled: data.settings.dailyReportEnabled ?? true,
          instantAlertsEnabled: data.settings.instantAlertsEnabled ?? true
        }))
      }
    } catch (error) {
      // Email settings might not exist yet - use defaults
      console.warn('Failed to load email settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      // Ensure proper types before sending
      const settingsToSave = {
        ...settings,
        smtpPort: typeof settings.smtpPort === 'number' ? settings.smtpPort : parseInt(settings.smtpPort) || 587,
        smtpSecure: Boolean(settings.smtpSecure),
        enabled: Boolean(settings.enabled),
        dailyReportEnabled: Boolean(settings.dailyReportEnabled),
        instantAlertsEnabled: Boolean(settings.instantAlertsEnabled)
      }
      
      await apiFetch('/settings/email', {
        method: 'PUT',
        body: JSON.stringify({ settings: settingsToSave })
      })
      addToast(t('settings.email.saved') || 'Настройки Email сохранены', 'success')
    } catch (error) {
      addToast(error.message || t('settings.email.saveError') || 'Ошибка сохранения настроек', 'error')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // Ensure proper types before sending
      const settingsToTest = {
        ...settings,
        smtpPort: typeof settings.smtpPort === 'number' ? settings.smtpPort : parseInt(settings.smtpPort) || 587,
        smtpSecure: Boolean(settings.smtpSecure)
      }
      
      const result = await apiFetch('/settings/email/test', {
        method: 'POST',
        body: JSON.stringify({ settings: settingsToTest })
      })
      setTestResult({ success: true, message: result.message || 'Тестовое письмо отправлено' })
      addToast('Тестовое письмо отправлено', 'success')
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'Ошибка подключения' })
      addToast(error.message || 'Ошибка отправки', 'error')
    } finally {
      setTesting(false)
    }
  }

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <GridLoader size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-5 h-5" />
          {t('settings.email.title') || 'Системные Email уведомления'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.email.description') || 'Настройка SMTP для системных уведомлений (сроки годности, ежедневные отчёты)'}
        </p>
      </div>

      {/* Информационный блок */}
      <div className="p-4 bg-info/10 border border-info/20 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm text-foreground font-medium">
            {t('settings.email.infoTitle') || 'Системные Email уведомления'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('settings.email.infoText') ||
              'Настройте SMTP сервер для отправки системных уведомлений. Письма отправляются на email отдела (department.email), а не на email пользователей. Убедитесь, что у отделов настроены email адреса.'}
          </p>
        </div>
      </div>

      {/* Включение/выключение */}
      <div className="p-4 border border-border rounded-lg bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                settings.enabled ? 'bg-success/10' : 'bg-muted'
              )}
            >
              <Mail
                className={cn(
                  'w-5 h-5',
                  settings.enabled ? 'text-success' : 'text-muted-foreground'
                )}
              />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {t('settings.email.enableEmail') || 'Системные Email уведомления'}
              </p>
              <p className="text-sm text-muted-foreground">
                {settings.enabled
                  ? t('settings.email.enabled') || 'Включено — письма отправляются на email отдела'
                  : t('settings.email.disabled') || 'Отключено'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('enabled', !settings.enabled)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              settings.enabled ? 'bg-success' : 'bg-muted-foreground/30'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      {/* SMTP настройки */}
      {settings.enabled && (
        <div className="p-6 border border-border rounded-xl bg-card space-y-6">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t('settings.email.smtpSettings') || 'Настройки SMTP'}
          </h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.email.smtpHost') || 'SMTP сервер'}
              </label>
              <input
                type="text"
                value={settings.smtpHost}
                onChange={(e) => updateSetting('smtpHost', e.target.value)}
                placeholder="smtp.example.com"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.email.smtpPort') || 'Порт'}
              </label>
              <input
                type="number"
                value={settings.smtpPort || 587}
                onChange={(e) => {
                  const port = e.target.value ? parseInt(e.target.value) : 587
                  updateSetting('smtpPort', isNaN(port) ? 587 : port)
                }}
                min="1"
                max="65535"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.email.smtpUser') || 'Пользователь'}
              </label>
              <input
                type="text"
                value={settings.smtpUser}
                onChange={(e) => updateSetting('smtpUser', e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.email.smtpPassword') || 'Пароль'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.smtpPassword}
                  onChange={(e) => updateSetting('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background
                    focus:outline-none focus:ring-2 focus:ring-accent/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.email.fromEmail') || 'Email отправителя (system)'}
              </label>
              <input
                type="email"
                value={settings.fromEmail}
                onChange={(e) => updateSetting('fromEmail', e.target.value)}
                placeholder="no-reply@freshtrack.systems"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Email отправителя для системных уведомлений (system / no-reply)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('settings.email.fromName') || 'Имя отправителя'}
              </label>
              <input
                type="text"
                value={settings.fromName}
                onChange={(e) => updateSetting('fromName', e.target.value)}
                placeholder="FreshTrack"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background
                  focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="smtpSecure"
              checked={settings.smtpSecure}
              onChange={(e) => updateSetting('smtpSecure', e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="smtpSecure" className="text-sm text-foreground">
              {t('settings.email.useSSL') || 'Использовать SSL/TLS'}
            </label>
          </div>

          {/* Тест подключения */}
          <div className="pt-4 border-t border-border">
            <div className="mb-3 p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Примечание:</strong> Тестовое письмо будет отправлено на email первого активного отдела с настроенным email адресом.
              </p>
            </div>
            <button
              onClick={testConnection}
              disabled={testing || !settings.smtpHost || !settings.smtpUser}
              className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg
                hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? <ButtonSpinner /> : <TestTube className="w-4 h-4" />}
              {t('settings.email.testConnection') || 'Тест подключения (отправить на email отдела)'}
            </button>

            {testResult && (
              <div
                className={cn(
                  'mt-3 p-3 rounded-lg flex items-center gap-2 text-sm',
                  testResult.success
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-danger/10 text-danger border border-danger/20'
                )}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Расписание */}
      {settings.enabled && (
        <div className="p-6 border border-border rounded-xl bg-card space-y-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('settings.email.schedule') || 'Расписание отправки'}
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium text-foreground">
                  {t('settings.email.dailyReport') || 'Ежедневный отчёт'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('settings.email.dailyReportDesc') || 'Сводка по срокам годности отправляется на email отдела каждый день'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={settings.dailyReportTime || '08:00'}
                  onChange={(e) => {
                    const time = e.target.value || '08:00'
                    // Ensure format is HH:MM
                    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
                      updateSetting('dailyReportTime', time)
                    }
                  }}
                  disabled={!settings.dailyReportEnabled}
                  className="px-2 py-1 border border-border rounded-lg bg-background text-sm"
                />
                <button
                  onClick={() => updateSetting('dailyReportEnabled', !settings.dailyReportEnabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    settings.dailyReportEnabled ? 'bg-success' : 'bg-muted-foreground/30'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.dailyReportEnabled ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium text-foreground">
                  {t('settings.email.instantAlerts') || 'Мгновенные оповещения'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('settings.email.instantAlertsDesc') ||
                    'Немедленная отправка на email отдела при критических ситуациях (истекающие товары)'}
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('instantAlertsEnabled', !settings.instantAlertsEnabled)
                }
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.instantAlertsEnabled ? 'bg-success' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.instantAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Кнопка сохранения */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-lg
            hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {saving ? <ButtonSpinner /> : <Save className="w-4 h-4" />}
          {saving ? t('common.saving') || 'Сохранение...' : t('common.save') || 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
