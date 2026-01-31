/**
 * GeneralSettings - Общие настройки системы
 * Региональные параметры, отображение, валюта, сессия
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { Globe, Coins, Clock } from 'lucide-react'
import SettingsLayout, { SettingsSection } from './SettingsLayout'
import { useSimpleUnsavedChanges } from '../../../hooks/useUnsavedChanges'
import { apiFetch } from '../../../services/api'

const defaultSettings = {
  dateFormat: 'DD.MM.YYYY',
  timeFormat: '24h',
  firstDayOfWeek: 'monday',
  defaultUnit: 'шт',
  showPrices: false,
  autoLogoutMinutes: 60,
  rememberDevice: true
}

function Toggle({ id, checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer" id={id ? `${id}-label` : undefined}>
      <span className="text-sm text-foreground">{label}</span>
      <div
        role="switch"
        aria-checked={checked}
        aria-labelledby={id ? `${id}-label` : undefined}
        tabIndex={0}
        className={`relative w-10 h-5 sm:w-11 sm:h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 flex-shrink-0 ${
          checked ? 'bg-accent' : 'bg-muted'
        }`}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onChange(!checked)
          }
        }}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </label>
  )
}

function SelectField({ id, label, value, onChange, options, hint }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-sm"
        aria-describedby={hint ? `${id}-hint` : undefined}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground mt-1">
          {hint}
        </p>
      )}
    </div>
  )
}

export default function GeneralSettings() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [initialSettings, setInitialSettings] = useState(defaultSettings)
  const [settings, setSettings] = useState({ ...defaultSettings })

  const hasUnsavedChanges = useSimpleUnsavedChanges(initialSettings, settings)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/settings/general')
      if (response?.success && response?.settings) {
        const next = { ...defaultSettings, ...response.settings }
        setSettings(next)
        setInitialSettings(next)
      }
    } catch (error) {
      console.error('Load settings error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    await apiFetch('/settings/general', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
    setInitialSettings(settings)
    return { message: t('settings.saved') || 'Настройки сохранены' }
  }

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <SettingsLayout
      title={t('settings.generalTitle') || 'Общие настройки'}
      description={t('settings.generalDescription') || 'Региональные параметры, отображение и сессия'}
      icon={Globe}
      onSave={handleSave}
      loading={loading}
      saveButtonText={hasUnsavedChanges ? '● ' + (t('common.save') || 'Сохранить') : (t('common.save') || 'Сохранить')}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingsSection icon={Globe} title="Региональные настройки">
          <div className="space-y-4">
            <SelectField
              id="general-date-format"
              label="Формат даты"
              value={settings.dateFormat}
              onChange={(v) => updateSetting('dateFormat', v)}
              options={[
                { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (31.12.2025)' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
                { value: 'DD MMM YYYY', label: 'DD MMM YYYY (31 дек 2025)' }
              ]}
            />
            <SelectField
              id="general-time-format"
              label="Формат времени"
              value={settings.timeFormat}
              onChange={(v) => updateSetting('timeFormat', v)}
              options={[
                { value: '24h', label: '24 часа (14:30)' },
                { value: '12h', label: '12 часов (2:30 PM)' }
              ]}
            />
            <SelectField
              id="general-first-day"
              label="Первый день недели"
              value={settings.firstDayOfWeek}
              onChange={(v) => updateSetting('firstDayOfWeek', v)}
              options={[
                { value: 'monday', label: 'Понедельник' },
                { value: 'sunday', label: 'Воскресенье' },
                { value: 'saturday', label: 'Суббота' }
              ]}
            />
          </div>
        </SettingsSection>

        <SettingsSection icon={Coins} title="Единицы и отображение">
          <div className="space-y-4">
            <SelectField
              id="general-unit"
              label="Единица по умолчанию"
              value={settings.defaultUnit}
              onChange={(v) => updateSetting('defaultUnit', v)}
              options={[
                { value: 'шт', label: 'Штуки (шт)' },
                { value: 'кг', label: 'Килограммы (кг)' },
                { value: 'г', label: 'Граммы (г)' },
                { value: 'л', label: 'Литры (л)' },
                { value: 'мл', label: 'Миллилитры (мл)' },
                { value: 'уп', label: 'Упаковки (уп)' }
              ]}
              hint="Используется при добавлении новых партий"
            />
            <Toggle
              id="general-show-prices"
              label="Показывать цены"
              checked={settings.showPrices}
              onChange={(v) => updateSetting('showPrices', v)}
            />
          </div>
        </SettingsSection>

        <SettingsSection icon={Clock} title="Сессия" className="lg:col-span-2">
          <div className="space-y-4 max-w-md">
            <SelectField
              id="general-autologout"
              label="Автоматический выход"
              value={settings.autoLogoutMinutes}
              onChange={(v) => updateSetting('autoLogoutMinutes', parseInt(v, 10))}
              options={[
                { value: 15, label: 'Через 15 минут' },
                { value: 30, label: 'Через 30 минут' },
                { value: 60, label: 'Через 1 час' },
                { value: 120, label: 'Через 2 часа' },
                { value: 480, label: 'Через 8 часов' },
                { value: 0, label: 'Никогда' }
              ]}
              hint="Автоматически выходить из системы при неактивности"
            />
            <Toggle
              id="general-remember"
              label="Запомнить устройство"
              checked={settings.rememberDevice}
              onChange={(v) => updateSetting('rememberDevice', v)}
            />
          </div>
        </SettingsSection>
      </div>
    </SettingsLayout>
  )
}
