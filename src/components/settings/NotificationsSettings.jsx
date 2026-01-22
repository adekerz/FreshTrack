/**
 * NotificationsSettings - Объединённые настройки уведомлений
 * Управление каналами доставки (Telegram, Email) и едиными шаблонами сообщений
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
  Bell,
  MessageSquare,
  Mail,
  Clock,
  Bot,
  ExternalLink,
  Users,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '../../utils/classNames'

const BOT_USERNAME = 'freshtracksystemsbot'

export default function NotificationsSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId, selectedHotel } = useHotel()

  const [settings, setSettings] = useState({
    // Каналы доставки
    channels: {
      telegram: { enabled: false },
      email: { enabled: false }
    },
    // Единые шаблоны сообщений
    templates: {
      dailyReport: '📊 Ежедневный отчёт FreshTrack\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}',
      expiryWarning: '⚠️ Внимание! {product} истекает {date} ({quantity} шт)',
      expiredAlert: '🔴 ПРОСРОЧЕНО: {product} — {quantity} шт',
      collectionConfirm: '✅ Собрано: {product} — {quantity} шт\nПричина: {reason}'
    },
    // Расписание
    sendTime: '09:00',
    timezone: 'Asia/Almaty'
  })

  const [linkedChats, setLinkedChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedChannels, setExpandedChannels] = useState({
    telegram: false,
    email: false
  })

  useEffect(() => {
    if (selectedHotelId) {
      loadSettings()
      loadLinkedChats()
    }
  }, [selectedHotelId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      // Загружаем объединённые настройки уведомлений
      const data = await apiFetch('/settings/notifications')
      
      if (data) {
        setSettings((prev) => ({
          ...prev,
          channels: data.channels || prev.channels,
          templates: data.templates || prev.templates,
          sendTime: data.sendTime || prev.sendTime,
          timezone: data.timezone || prev.timezone
        }))
      }
    } catch (error) {
      // Если endpoint не найден, загружаем из старых endpoints для обратной совместимости
      try {
        const [telegramData] = await Promise.all([
          apiFetch('/settings/telegram').catch(() => null)
        ])

        if (telegramData) {
          setSettings((prev) => ({
            ...prev,
            templates: telegramData.messageTemplates || prev.templates,
            sendTime: telegramData.sendTime || prev.sendTime,
            channels: {
              ...prev.channels,
              telegram: { enabled: true } // Telegram считается включённым, если есть настройки
            }
          }))
        }
      } catch (fallbackError) {
        console.warn('Failed to load notification settings:', fallbackError)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadLinkedChats = async () => {
    try {
      const data = await apiFetch('/settings/telegram/chats')
      setLinkedChats(data.chats || [])
    } catch (error) {
      // Error logged by apiFetch
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      // Сохраняем настройки уведомлений (каналы и шаблоны)
      await apiFetch('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({
          channels: settings.channels,
          templates: settings.templates,
          sendTime: settings.sendTime,
          timezone: settings.timezone
        })
      })

      addToast(t('settings.notifications.saved') || 'Настройки уведомлений сохранены', 'success')
    } catch (error) {
      addToast(error.message || t('settings.notifications.saveError') || 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateChannel = (channel, enabled) => {
    setSettings((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: { enabled }
      }
    }))
  }

  const updateTemplate = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [key]: value
      }
    }))
  }

  const toggleChannelExpanded = (channel) => {
    setExpandedChannels((prev) => ({
      ...prev,
      [channel]: !prev[channel]
    }))
  }

  const unlinkChat = async (chatId) => {
    try {
      await apiFetch(`/settings/telegram/chats/${chatId}`, {
        method: 'DELETE'
      })
      addToast(t('telegram.chatUnlinked') || 'Чат отвязан', 'success')
      loadLinkedChats()
    } catch (error) {
      addToast(t('telegram.chatUnlinkError') || 'Ошибка отвязки чата', 'error')
    }
  }

  const openAddBotLink = () => {
    window.open(`https://t.me/${BOT_USERNAME}?startgroup=setup`, '_blank')
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
          <Bell className="w-5 h-5" />
          {t('settings.notifications.title') || 'Уведомления'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.notifications.description') || 'Настройка каналов доставки и шаблонов сообщений'}
        </p>
      </div>

      {/* Каналы доставки */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">
          {t('settings.notifications.channels') || 'Каналы доставки'}
        </h3>

        {/* Telegram */}
        <div className="p-4 border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  settings.channels.telegram.enabled ? 'bg-[#0088cc]/10' : 'bg-muted'
                )}
              >
                <MessageSquare
                  className={cn(
                    'w-5 h-5',
                    settings.channels.telegram.enabled ? 'text-[#0088cc]' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">Telegram</p>
                <p className="text-sm text-muted-foreground">
                  {settings.channels.telegram.enabled
                    ? t('settings.notifications.enabled') || 'Включено'
                    : t('settings.notifications.disabled') || 'Отключено'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleChannelExpanded('telegram')}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                {expandedChannels.telegram ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => updateChannel('telegram', !settings.channels.telegram.enabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  settings.channels.telegram.enabled ? 'bg-[#0088cc]' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    settings.channels.telegram.enabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>

          {expandedChannels.telegram && settings.channels.telegram.enabled && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              {/* Добавить бота в чат */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  {t('telegram.addBot') || 'Добавить бота в чат'}
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('telegram.addBotDescription') || 'Добавьте бота в групповой чат Telegram для получения уведомлений.'}
                </p>
                <button
                  onClick={openAddBotLink}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white rounded-lg hover:bg-[#0088cc]/90 transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('telegram.addBotButton') || 'Добавить бота в чат'}
                </button>
              </div>

              {/* Привязанные чаты */}
              {linkedChats.length > 0 && (
                <div>
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('telegram.linkedChats') || 'Привязанные чаты'} ({linkedChats.length})
                  </h4>
                  <div className="space-y-2">
                    {linkedChats.map((chat) => (
                      <div
                        key={chat.chat_id}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {chat.chat_photo_url ? (
                            <img
                              src={chat.chat_photo_url}
                              alt={chat.chat_title}
                              className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                              <MessageSquare className="w-4 h-4 text-accent" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {chat.chat_title || 'Чат'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {chat.hotel_name && (
                                <>
                                  🏨 {chat.hotel_name}
                                  {chat.department_name && <span> → 🏢 {chat.department_name}</span>}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => unlinkChat(chat.chat_id)}
                          className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded transition-colors"
                          title={t('telegram.unlinkChat') || 'Отвязать чат'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email */}
        <div className="p-4 border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  settings.channels.email.enabled ? 'bg-accent/10' : 'bg-muted'
                )}
              >
                <Mail
                  className={cn(
                    'w-5 h-5',
                    settings.channels.email.enabled ? 'text-accent' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">
                  {settings.channels.email.enabled
                    ? t('settings.notifications.enabled') || 'Включено'
                    : t('settings.notifications.disabled') || 'Отключено'}
                </p>
              </div>
            </div>
            <button
              onClick={() => updateChannel('email', !settings.channels.email.enabled)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                settings.channels.email.enabled ? 'bg-accent' : 'bg-muted-foreground/30'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  settings.channels.email.enabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          {expandedChannels.email && settings.channels.email.enabled && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                {t('settings.notifications.emailNote') || 'Email уведомления отправляются на адреса отделов (department.email)'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Единые шаблоны сообщений */}
      <div className="p-6 border border-border rounded-xl bg-card">
        <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {t('settings.notifications.templates') || 'Шаблоны сообщений'}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {t('settings.notifications.templatesHint') || 'Единые шаблоны для всех каналов доставки. Используйте переменные в фигурных скобках.'}
        </p>

        <div className="space-y-6">
          {/* Ежедневный отчёт */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('telegram.dailyReport') || 'Ежедневный отчёт'}
            </label>
            <textarea
              value={settings.templates.dailyReport}
              onChange={(e) => updateTemplate('dailyReport', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-32 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('telegram.variables') || 'Переменные'}: {'{good}'}, {'{warning}'}, {'{expired}'}, {'{total}'}
            </p>
          </div>

          {/* Предупреждение об истечении */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('telegram.expiryWarning') || 'Предупреждение об истечении'}
            </label>
            <textarea
              value={settings.templates.expiryWarning}
              onChange={(e) => updateTemplate('expiryWarning', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('telegram.variables') || 'Переменные'}: {'{product}'}, {'{date}'}, {'{quantity}'}
            </p>
          </div>

          {/* Просрочено */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('telegram.expiredAlert') || 'Уведомление о просрочке'}
            </label>
            <textarea
              value={settings.templates.expiredAlert}
              onChange={(e) => updateTemplate('expiredAlert', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
          </div>

          {/* Подтверждение сбора */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('telegram.collectionConfirm') || 'Подтверждение сбора'}
            </label>
            <textarea
              value={settings.templates.collectionConfirm}
              onChange={(e) => updateTemplate('collectionConfirm', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('telegram.variables') || 'Переменные'}: {'{product}'}, {'{quantity}'}, {'{reason}'}
            </p>
          </div>
        </div>
      </div>

      {/* Расписание */}
      <div className="p-6 border border-border rounded-xl bg-card">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('settings.notifications.schedule') || 'Расписание отправки'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('settings.notifications.sendTime') || 'Время отправки ежедневных отчётов'}
            </label>
            <input
              type="time"
              value={settings.sendTime}
              onChange={(e) => setSettings((prev) => ({ ...prev, sendTime: e.target.value }))}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>
      </div>

      {/* Кнопка сохранения */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {saving ? <ButtonSpinner /> : <Save className="w-4 h-4" />}
          {saving ? t('common.saving') || 'Сохранение...' : t('common.save') || 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
