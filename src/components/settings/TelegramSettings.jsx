/**
 * TelegramSettings - Настройки Telegram бота
 * Управление токеном, chatId, шаблонами сообщений
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { 
  Send, 
  Save, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  MessageSquare
} from 'lucide-react'

const API_URL = 'http://localhost:3001/api'

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

export default function TelegramSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [settings, setSettings] = useState({
    botToken: '',
    chatId: '-5090103384',
    enabled: true,
    scheduleTime: '09:00',
    messageTemplates: {
      dailyReport: '📊 Ежедневный отчёт FreshTrack\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}',
      expiryWarning: '⚠️ Внимание! {product} истекает {date} ({quantity} шт)',
      expiredAlert: '🔴 ПРОСРОЧЕНО: {product} — {quantity} шт',
      collectionConfirm: '✅ Собрано: {product} — {quantity} шт\nПричина: {reason}'
    }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState(null)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`${API_URL}/settings/telegram`)
      if (data) {
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Error loading telegram settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await apiFetch(`${API_URL}/settings/telegram`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      setMessage({ type: 'success', text: t('settings.saved') })
      addToast(t('toast.telegramSettingsSaved'), 'success')
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: t('settings.saveError') })
      addToast(t('toast.telegramSettingsError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const testTelegram = async () => {
    setTesting(true)
    try {
      const response = await apiFetch(`${API_URL}/notifications/test-telegram`, {
        method: 'POST'
      })
      setMessage({ 
        type: response.success ? 'success' : 'error', 
        text: response.success 
          ? (t('telegram.testSuccess') || 'Тестовое сообщение отправлено!')
          : (t('telegram.testError') || 'Ошибка отправки')
      })
      if (response.success) {
        addToast(t('toast.telegramTestSuccess'), 'success')
      } else {
        addToast(t('toast.telegramTestError'), 'error')
      }
    } catch (error) {
      console.error('Error testing telegram:', error)
      setMessage({ type: 'error', text: t('telegram.testError') || 'Ошибка отправки' })
      addToast(t('toast.telegramTestError'), 'error')
    } finally {
      setTesting(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const updateTemplate = (key, value) => {
    setSettings({
      ...settings,
      messageTemplates: {
        ...settings.messageTemplates,
        [key]: value
      }
    })
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
        <h2 className="text-xl font-semibold text-charcoal">{t('settings.telegram.title') || 'Telegram'}</h2>
        <p className="text-sm text-warmgray mt-1">{t('telegram.description') || 'Настройки Telegram-бота для уведомлений'}</p>
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

      {/* Основные настройки */}
      <div className="p-6 border border-sand rounded-xl bg-white">
        <h3 className="font-medium text-charcoal mb-4">{t('telegram.connection') || 'Подключение'}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">Bot Token</label>
            <div className="relative">
              <input 
                type={showToken ? 'text' : 'password'}
                value={settings.botToken}
                onChange={(e) => setSettings({...settings, botToken: e.target.value})}
                placeholder="123456789:ABC-DEF..."
                className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent pr-10"
              />
              <button 
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warmgray hover:text-charcoal"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">Chat ID</label>
            <input 
              value={settings.chatId}
              onChange={(e) => setSettings({...settings, chatId: e.target.value})}
              placeholder="-1001234567890"
              className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 mt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({...settings, enabled: e.target.checked})}
              className="w-5 h-5 text-accent border-sand rounded focus:ring-accent"
            />
            <span className="text-charcoal">{t('telegram.enabled') || 'Уведомления включены'}</span>
          </label>

          <button 
            onClick={testTelegram}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 border border-sand rounded-lg hover:bg-cream transition-colors disabled:opacity-50"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('telegram.test') || 'Тест отправки'}
          </button>
        </div>
      </div>

      {/* Расписание */}
      <div className="p-6 border border-sand rounded-xl bg-white">
        <h3 className="font-medium text-charcoal mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('telegram.schedule') || 'Расписание'}
        </h3>
        
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm text-warmgray mb-1">
              {t('telegram.scheduleTime') || 'Время ежедневного отчёта'}
            </label>
            <input 
              type="time"
              value={settings.scheduleTime}
              onChange={(e) => setSettings({...settings, scheduleTime: e.target.value})}
              className="px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Шаблоны сообщений */}
      <div className="p-6 border border-sand rounded-xl bg-white">
        <h3 className="font-medium text-charcoal mb-2 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {t('telegram.messageTemplates') || 'Шаблоны сообщений'}
        </h3>
        <p className="text-sm text-warmgray mb-6">
          {t('telegram.templatesHint') || 'Используйте переменные в фигурных скобках'}
        </p>

        <div className="space-y-6">
          {/* Ежедневный отчёт */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              {t('telegram.dailyReport') || 'Ежедневный отчёт'}
            </label>
            <textarea 
              value={settings.messageTemplates.dailyReport}
              onChange={(e) => updateTemplate('dailyReport', e.target.value)}
              className="w-full px-4 py-3 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-32 font-mono text-sm"
            />
            <p className="text-xs text-warmgray mt-1">
              {t('telegram.variables') || 'Переменные'}: {'{good}'}, {'{warning}'}, {'{expired}'}, {'{total}'}
            </p>
          </div>

          {/* Предупреждение об истечении */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              {t('telegram.expiryWarning') || 'Предупреждение об истечении'}
            </label>
            <textarea 
              value={settings.messageTemplates.expiryWarning}
              onChange={(e) => updateTemplate('expiryWarning', e.target.value)}
              className="w-full px-4 py-3 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
            <p className="text-xs text-warmgray mt-1">
              {t('telegram.variables') || 'Переменные'}: {'{product}'}, {'{date}'}, {'{quantity}'}
            </p>
          </div>

          {/* Просрочено */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              {t('telegram.expiredAlert') || 'Уведомление о просрочке'}
            </label>
            <textarea 
              value={settings.messageTemplates.expiredAlert}
              onChange={(e) => updateTemplate('expiredAlert', e.target.value)}
              className="w-full px-4 py-3 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
          </div>

          {/* Подтверждение сбора */}
          <div>
            <label className="block text-sm font-medium text-charcoal mb-2">
              {t('telegram.collectionConfirm') || 'Подтверждение сбора'}
            </label>
            <textarea 
              value={settings.messageTemplates.collectionConfirm}
              onChange={(e) => updateTemplate('collectionConfirm', e.target.value)}
              className="w-full px-4 py-3 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
            <p className="text-xs text-warmgray mt-1">
              {t('telegram.variables') || 'Переменные'}: {'{product}'}, {'{quantity}'}, {'{reason}'}
            </p>
          </div>
        </div>
      </div>

      {/* Кнопка сохранения */}
      <div className="flex justify-end">
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
