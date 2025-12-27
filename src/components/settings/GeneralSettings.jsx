/**
 * GeneralSettings - Общие настройки системы
 * Управление базовыми параметрами: название, формат дат, пороги предупреждений
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { Save, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { logError } from '../../utils/logger'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('freshtrack_token')
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export default function GeneralSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [settings, setSettings] = useState({
    siteName: 'FreshTrack',
    departmentName: '',
    timezone: 'Asia/Almaty',
    dateFormat: 'DD.MM.YYYY',
    warningDays: 7,
    criticalDays: 3,
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
      const data = await apiFetch(`${API_URL}/settings/general`)
      if (data) {
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      logError('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await apiFetch(`${API_URL}/settings/general`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      setMessage({ type: 'success', text: t('settings.saved') })
      addToast(t('toast.settingsSaved'), 'success')
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      logError('Error saving settings:', error)
      setMessage({ type: 'error', text: t('settings.saveError') })
      addToast(t('toast.settingsSaveError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-warmgray" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-charcoal">{t('settings.generalTitle') || 'Общие настройки'}</h2>
        <p className="text-sm text-warmgray mt-1">{t('settings.generalDescription') || 'Основные параметры системы'}</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Название сайта */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t('settings.siteName') || 'Название сайта'}
          </label>
          <input 
            type="text"
            value={settings.siteName}
            onChange={(e) => setSettings({...settings, siteName: e.target.value})}
            className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>

        {/* Название отдела */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t('settings.departmentName') || 'Название отдела'}
          </label>
          <input 
            type="text"
            value={settings.departmentName}
            onChange={(e) => setSettings({...settings, departmentName: e.target.value})}
            className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>

        {/* Предупреждение за дней */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t('settings.warningDays') || 'Предупреждать за (дней)'}
          </label>
          <input 
            type="number"
            min="1"
            max="30"
            value={settings.warningDays}
            onChange={(e) => setSettings({...settings, warningDays: parseInt(e.target.value) || 7})}
            className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          <p className="text-sm text-warmgray mt-1">
            {t('settings.warningDaysHint') || 'За сколько дней до истечения предупреждать'}
          </p>
        </div>

        {/* Критический срок */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t('settings.criticalDays') || 'Критический срок (дней)'}
          </label>
          <input 
            type="number"
            min="1"
            max="10"
            value={settings.criticalDays}
            onChange={(e) => setSettings({...settings, criticalDays: parseInt(e.target.value) || 3})}
            className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </div>

        {/* Формат даты */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t('settings.dateFormat') || 'Формат даты'}
          </label>
          <select 
            value={settings.dateFormat}
            onChange={(e) => setSettings({...settings, dateFormat: e.target.value})}
            className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
          >
            <option value="DD.MM.YYYY">DD.MM.YYYY (31.12.2025)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
          </select>
        </div>

        {/* Часовой пояс */}
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            {t('settings.timezone') || 'Часовой пояс'}
          </label>
          <select 
            value={settings.timezone}
            onChange={(e) => setSettings({...settings, timezone: e.target.value})}
            className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
          >
            <option value="Asia/Almaty">Asia/Almaty (UTC+5)</option>
            <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
            <option value="UTC">UTC (UTC+0)</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-sand">
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  )
}
