/**
 * GeneralSettings - Общие настройки системы
 * Региональные параметры, отображение, валюта, сессия
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { 
  Save, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Globe, 
  Coins, 
  Clock
} from 'lucide-react'
import { apiFetch } from '../../services/api'

export default function GeneralSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [settings, setSettings] = useState({
    // Региональные
    timezone: 'Asia/Almaty',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: '24h',
    firstDayOfWeek: 'monday',
    // Единицы и отображение
    defaultUnit: 'шт',
    showPrices: false,
    // Сессия
    autoLogoutMinutes: 60,
    rememberDevice: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/settings/general')
      if (response?.success && response?.settings) {
        setSettings(prev => ({ ...prev, ...response.settings }))
      }
    } catch (error) {
      console.error('Load settings error:', error)
      // Use defaults
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await apiFetch('/settings/general', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      setMessage({ type: 'success', text: t('settings.saved') || 'Настройки сохранены' })
      addToast(t('toast.settingsSaved') || 'Настройки сохранены', 'success')
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.saveError') || 'Ошибка сохранения' })
      addToast(t('toast.settingsSaveError') || 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Toggle component
  const Toggle = ({ checked, onChange, label }) => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-foreground">{label}</span>
      <div 
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-muted'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </div>
    </label>
  )

  // Section component
  const Section = ({ icon: Icon, title, children }) => (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-accent" />
        <h3 className="font-medium text-foreground">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )

  // Select input component
  const SelectField = ({ label, value, onChange, options, hint }) => (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </label>
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-sm"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t('settings.generalTitle') || 'Общие настройки'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.generalDescription') || 'Региональные параметры, отображение и сессия'}
        </p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-success/10 text-success border border-success/20' 
            : 'bg-danger/10 text-danger border border-danger/20'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Региональные настройки */}
        <Section icon={Globe} title="Региональные настройки">
          <SelectField 
            label="Часовой пояс"
            value={settings.timezone}
            onChange={(v) => updateSetting('timezone', v)}
            options={[
              { value: 'Asia/Almaty', label: 'Алматы (UTC+5)' },
              { value: 'Asia/Astana', label: 'Астана (UTC+5)' },
              { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
              { value: 'Europe/London', label: 'Лондон (UTC+0)' },
              { value: 'America/New_York', label: 'Нью-Йорк (UTC-5)' },
              { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
            ]}
          />
          <SelectField 
            label="Формат даты"
            value={settings.dateFormat}
            onChange={(v) => updateSetting('dateFormat', v)}
            options={[
              { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (31.12.2025)' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
              { value: 'DD MMM YYYY', label: 'DD MMM YYYY (31 дек 2025)' },
            ]}
          />
          <SelectField 
            label="Формат времени"
            value={settings.timeFormat}
            onChange={(v) => updateSetting('timeFormat', v)}
            options={[
              { value: '24h', label: '24 часа (14:30)' },
              { value: '12h', label: '12 часов (2:30 PM)' },
            ]}
          />
          <SelectField 
            label="Первый день недели"
            value={settings.firstDayOfWeek}
            onChange={(v) => updateSetting('firstDayOfWeek', v)}
            options={[
              { value: 'monday', label: 'Понедельник' },
              { value: 'sunday', label: 'Воскресенье' },
              { value: 'saturday', label: 'Суббота' },
            ]}
          />
        </Section>

        {/* Единицы и отображение */}
        <Section icon={Coins} title="Единицы и отображение">
          <SelectField 
            label="Единица по умолчанию"
            value={settings.defaultUnit}
            onChange={(v) => updateSetting('defaultUnit', v)}
            options={[
              { value: 'шт', label: 'Штуки (шт)' },
              { value: 'кг', label: 'Килограммы (кг)' },
              { value: 'г', label: 'Граммы (г)' },
              { value: 'л', label: 'Литры (л)' },
              { value: 'мл', label: 'Миллилитры (мл)' },
              { value: 'уп', label: 'Упаковки (уп)' },
            ]}
            hint="Используется при добавлении новых партий"
          />
          <Toggle 
            label="Показывать цены"
            checked={settings.showPrices}
            onChange={(v) => updateSetting('showPrices', v)}
          />
        </Section>

        {/* Сессия и безопасность */}
        <Section icon={Clock} title="Сессия">
          <SelectField 
            label="Автоматический выход"
            value={settings.autoLogoutMinutes}
            onChange={(v) => updateSetting('autoLogoutMinutes', parseInt(v))}
            options={[
              { value: 15, label: 'Через 15 минут' },
              { value: 30, label: 'Через 30 минут' },
              { value: 60, label: 'Через 1 час' },
              { value: 120, label: 'Через 2 часа' },
              { value: 480, label: 'Через 8 часов' },
              { value: 0, label: 'Никогда' },
            ]}
            hint="Автоматически выходить из системы при неактивности"
          />
          <Toggle 
            label="Запомнить устройство"
            checked={settings.rememberDevice}
            onChange={(v) => updateSetting('rememberDevice', v)}
          />
        </Section>
      </div>

      {/* Sticky save button */}
      <div className="sticky bottom-4 flex justify-end pt-4">
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-lg"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
