/**
 * NotificationsSettings - Объединённые настройки уведомлений
 * Управление каналами доставки (Telegram, Email) и едиными шаблонами сообщений
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { useToast } from '../../../context/ToastContext'
import { logError } from '../../../utils/logger'
import { useHotel } from '../../../context/HotelContext'
import { apiFetch } from '../../../services/api'
import {
  Bell,
  MessageSquare,
  Mail,
  Clock,
  Bot,
  ExternalLink,
  Users,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap
} from 'lucide-react'
import { showNotification, getNotificationPermission, requestNotificationPermission } from '../../../utils/browserAlerts'
import { Link } from 'react-router-dom'
import { cn } from '../../../utils/classNames'
import SettingsLayout, { SettingsSection } from './SettingsLayout'
import { Switch } from '..'
import TemplateEditor from './TemplateEditor'
import { useSimpleUnsavedChanges } from '../../../hooks/useUnsavedChanges'

const BOT_USERNAME = 'freshtracksystemsbot'

export default function NotificationsSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId } = useHotel()

  const [settings, setSettings] = useState({
    // Каналы доставки
    channels: {
      telegram: { enabled: false },
      email: { enabled: false }
    },
    // Единые шаблоны сообщений
    templates: {
      dailyReport: '📊 Ежедневный отчёт FreshTrack\n{department}\n\nДата: {date}\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}\n📦 Всего партий: {total}\n\n{expiringList}\n\n{expiredList}'
    },
    // Расписание
    sendTime: '09:00',
    timezone: 'Asia/Almaty'
  })

  const [linkedChats, setLinkedChats] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedChannels, setExpandedChannels] = useState({
    telegram: false,
    email: false
  })

  // Track unsaved changes
  const [initialSettings, setInitialSettings] = useState(settings)
  const hasUnsavedChanges = useSimpleUnsavedChanges(initialSettings, settings)

  useEffect(() => {
    if (selectedHotelId) {
      loadSettings()
      loadLinkedChats()
      loadDepartments()
    }
  }, [selectedHotelId])

  const loadDepartments = async () => {
    try {
      const hotelQuery = selectedHotelId ? `?hotel_id=${selectedHotelId}` : ''
      const data = await apiFetch(`/departments${hotelQuery}`)
      setDepartments(data.departments || [])
    } catch {
      setDepartments([])
    }
  }

  useEffect(() => {
    if (!loading) {
      setInitialSettings(settings)
    }
    // Only run when loading changes (after fetch). Do NOT depend on settings,
    // or we'd overwrite initial on every edit and break unsaved detection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const loadSettings = async () => {
    setLoading(true)
    try {
      // Загружаем объединённые настройки уведомлений
      const data = await apiFetch('/settings/notifications')

      if (data) {
        setSettings((prev) => ({
          ...prev,
          channels: data.channels || prev.channels,
          templates: { dailyReport: data.templates?.dailyReport ?? prev.templates.dailyReport },
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
            templates: {
              dailyReport: telegramData.messageTemplates?.dailyReport ?? prev.templates.dailyReport
            },
            sendTime: telegramData.sendTime || prev.sendTime,
            channels: {
              ...prev.channels,
              telegram: { enabled: true }
            }
          }))
        }
      } catch (fallbackError) {
        logError('Failed to load notification settings from fallback', fallbackError)
        addToast(fallbackError.message || 'Failed to load notification settings', 'error')
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
    // Сохраняем настройки уведомлений (каналы и шаблоны)
    await apiFetch('/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({
        channels: settings.channels,
        templates: { dailyReport: settings.templates.dailyReport },
        sendTime: settings.sendTime,
        timezone: settings.timezone
      })
    })

    setInitialSettings(settings)
    return { message: t('settings.notifications.saved') || 'Настройки уведомлений сохранены' }
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
    if (key !== 'dailyReport') return
    setSettings((prev) => ({
      ...prev,
      templates: { ...prev.templates, dailyReport: value }
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

  // ── Test notification ────────────────────────────────────────────────────────
  const [testingNotification, setTestingNotification] = useState(false)

  const handleTestNotification = async () => {
    setTestingNotification(true)
    try {
      // Browser notification
      let browserShown = false
      let perm = getNotificationPermission()
      if (perm === 'default') {
        const res = await requestNotificationPermission()
        perm = res.permission
      }
      if (perm === 'denied') {
        addToast(
          t('notifications.browserDenied') || 'Браузер: уведомления заблокированы. Разрешите в настройках сайта.',
          'warning'
        )
      } else if (perm === 'granted') {
        try {
          const shown = showNotification(
            t('notifications.test.title') || 'Тестовое уведомление',
            {
              body: t('notifications.test.message') || 'Это тестовое уведомление для проверки работы системы.',
              tag: 'freshtrack-test-notification'
            }
          )
          browserShown = shown !== null
        } catch (err) {
          addToast((t('notifications.browserError') || 'Браузер: ошибка уведомления') + ': ' + (err.message || ''), 'error')
        }
      }

      // Email + Telegram (backend)
      const result = await apiFetch('/notifications/test-telegram', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const channels = []
      if (browserShown) channels.push('браузер')
      if (result.emailSent) channels.push('email')
      if (result.sentTo > 0) channels.push(`Telegram (${result.sentTo})`)

      if (result.success || browserShown) {
        const msg = channels.length > 0
          ? (t('notifications.test.sent') || 'Тестовое уведомление отправлено') + ': ' + channels.join(', ')
          : t('notifications.test.sent') || 'Тестовое уведомление отправлено'
        addToast(msg, 'success')
      } else {
        addToast(
          result.error || (result.totalChats === 0
            ? 'Нет привязанных Telegram чатов'
            : t('notifications.test.error') || 'Ошибка отправки'),
          'error'
        )
      }
    } catch (error) {
      addToast(error.message || t('notifications.test.error') || 'Ошибка отправки тестового уведомления', 'error')
    } finally {
      setTestingNotification(false)
    }
  }

  if (loading) {
    return <SettingsLayout loading />
  }

  return (
    <SettingsLayout
      title={t('settings.notifications.title') || 'Уведомления'}
      description="Ежедневные сводки и критические уведомления без лишнего шума"
      icon={Bell}
      onSave={saveSettings}
      saveButtonText={hasUnsavedChanges ? '● ' + (t('common.save') || 'Сохранить') : (t('common.save') || 'Сохранить')}
      saveDisabled={!hasUnsavedChanges}
    >
      {/* Info + test button row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/40">
        <p className="text-sm text-muted-foreground flex-1 whitespace-pre-line">
          FreshTrack отправляет только одну сводку в день.
          Это снижает шум и помогает не пропускать важное.
        </p>
        <button
          type="button"
          onClick={handleTestNotification}
          disabled={testingNotification}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm text-foreground disabled:opacity-50 transition-colors shrink-0"
        >
          {testingNotification ? (
            <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          ) : (
            <Zap className="w-4 h-4 text-accent" />
          )}
          {t('notifications.test.label') || 'Тест уведомлений'}
        </button>
      </div>

      {/* Предупреждение: почта отдела не привязана */}
      {(() => {
        const departmentsWithoutEmail = (departments || []).filter(
          (d) => !d.email || !String(d.email).trim()
        )
        if (departmentsWithoutEmail.length === 0) return null
        const names = departmentsWithoutEmail.map((d) => d.name).join(', ')
        return (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {t('settings.notifications.departmentEmailNotLinked') || 'Почта отдела не привязана'}
                </p>
                <p className="text-amber-700 dark:text-amber-300 mb-2">
                  {t('settings.notifications.departmentEmailNotLinkedDetail', { names }) ||
                    `У отделов «${names}» не указана почта. Ежедневные отчёты на email туда не отправляются.`}
                </p>
                <p className="text-amber-600 dark:text-amber-400">
                  {t('settings.notifications.departmentEmailHint') || 'Как привязать:'}{' '}
                  <Link
                    to="/settings?tab=directories"
                    className="font-medium underline hover:no-underline"
                  >
                    {t('settings.notifications.gotoDirectories') || 'Настройки → Справочники → Отделы'}
                  </Link>
                  {' → '}
                  {t('settings.notifications.departmentEmailField') || 'поле «Почта отдела»'}
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Каналы доставки */}
      <SettingsSection title={t('settings.notifications.channels') || 'Каналы доставки'}>

        {/* Telegram */}
        <div className="p-4 border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between">
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
                type="button"
                onClick={() => toggleChannelExpanded('telegram')}
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label={expandedChannels.telegram ? 'Свернуть' : 'Развернуть'}
              >
                {expandedChannels.telegram ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <Switch
                checked={settings.channels.telegram.enabled}
                onChange={(v) => updateChannel('telegram', v)}
                aria-label="Telegram"
              />
            </div>
          </div>

          {expandedChannels.telegram && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              {settings.channels.telegram.enabled ? (
                <>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                      <Bot className="w-4 h-4" />
                      {t('telegram.addBot') || 'Добавить бота в чат'}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {t('telegram.addBotDescription') || 'Добавьте бота в групповой чат Telegram для получения уведомлений.'}
                    </p>
                    <button
                      type="button"
                      onClick={openAddBotLink}
                      className="flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white rounded-lg hover:bg-[#0088cc]/90 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('telegram.addBotButton') || 'Добавить бота в чат'}
                    </button>
                  </div>

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
                                  alt={chat.chat_title || t('notifications.chat') || 'Chat'}
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
                              type="button"
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

                  <p className="text-sm text-muted-foreground">
                    Уведомления приходят один раз в день в виде сводки.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Включите канал, чтобы настроить получение ежедневных сводок.
                </p>
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleChannelExpanded('email')}
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label={expandedChannels.email ? 'Свернуть' : 'Развернуть'}
              >
                {expandedChannels.email ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <Switch
                checked={settings.channels.email.enabled}
                onChange={(v) => updateChannel('email', v)}
                aria-label="Email"
              />
            </div>
          </div>
          {expandedChannels.email && (
            <div className="mt-4 pt-4 border-t border-border">
              {settings.channels.email.enabled ? (
                <div className="space-y-3">
                  {(() => {
                    const depsWithEmail = (departments || []).filter(
                      (d) => d.email && String(d.email).trim()
                    )
                    if (depsWithEmail.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          Ни у одного отдела не указан email. Настройте адреса в{' '}
                          <Link to="/settings?tab=directories" className="text-accent hover:underline">
                            Справочниках
                          </Link>.
                        </p>
                      )
                    }
                    return depsWithEmail.map((dept) => (
                      <div key={dept.id}>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          {dept.name}
                        </label>
                        <input
                          type="email"
                          value={dept.email}
                          readOnly
                          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg text-muted-foreground cursor-default focus:outline-none"
                        />
                      </div>
                    ))
                  })()}
                  <p className="text-sm text-muted-foreground">
                    Уведомления отправляются на email отделов. Изменить адреса можно в{' '}
                    <Link to="/settings?tab=directories" className="text-accent hover:underline">
                      Справочниках
                    </Link>.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Включите канал, чтобы получать ежедневные сводки на почту отделов.
                </p>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Шаблоны сообщений */}
      <SettingsSection
        title={t('settings.notifications.templates') || 'Шаблоны сообщений'}
        description="Один шаблон используется для Email и Telegram."
        icon={MessageSquare}
      >
        <TemplateEditor
          label={t('telegram.dailyReport') || 'Ежедневный отчёт'}
          value={settings.templates.dailyReport}
          onChange={(value) => updateTemplate('dailyReport', value)}
          availableVars={['good', 'warning', 'expired', 'total', 'date', 'expiringList', 'expiredList', 'department']}
          rows={8}
        />
      </SettingsSection>

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
            <p className="mt-2 text-sm text-muted-foreground">
              Даже при наличии просроченных товаров уведомления не дублируются.
            </p>
          </div>
        </div>
      </div>
    </SettingsLayout>
  )
}