/**
 * TelegramSettings - Настройки Telegram уведомлений
 * Шаблоны сообщений, расписание, привязанные чаты, настройка бота
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useHotel } from '../../context/HotelContext'
import { apiFetch } from '../../services/api'
import { Send, Users, MessageSquare, Clock, Bot, Trash2, ExternalLink } from 'lucide-react'
import SettingsLayout, { SettingsSection } from './SettingsLayout'
import { Tabs, TabsList, Tab, TabPanel } from '../ui/Tabs'
import TemplateEditor from './TemplateEditor'
import { useSimpleUnsavedChanges } from '../../hooks/useUnsavedChanges'

const BOT_USERNAME = 'freshtracksystemsbot'

const defaultTemplates = {
  dailyReport:
    '📊 Ежедневный отчёт FreshTrack\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}',
  expiryWarning: '⚠️ Внимание! {product} истекает {date} ({quantity} шт)',
  expiredAlert: '🔴 ПРОСРОЧЕНО: {product} — {quantity} шт',
  collectionConfirm: '✅ Собрано: {product} — {quantity} шт\nПричина: {reason}'
}

const SERVER_TIMEZONE = 'Asia/Almaty'

export default function TelegramSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId, selectedHotel } = useHotel()

  const [activeTab, setActiveTab] = useState('chats')
  const [loading, setLoading] = useState(true)
  const [initialSettings, setInitialSettings] = useState({ sendTime: '09:00', messageTemplates: { ...defaultTemplates } })
  const [settings, setSettings] = useState({
    sendTime: '09:00',
    messageTemplates: { ...defaultTemplates }
  })
  const [linkedChats, setLinkedChats] = useState([])

  const hasUnsavedChanges = useSimpleUnsavedChanges(initialSettings, settings)

  useEffect(() => {
    if (selectedHotelId) loadData()
  }, [selectedHotelId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [settingsData, chatsData] = await Promise.all([
        apiFetch('/settings/telegram'),
        apiFetch('/settings/telegram/chats')
      ])

      const next = {
        sendTime: settingsData?.sendTime ?? '09:00',
        messageTemplates: settingsData?.messageTemplates
          ? { ...defaultTemplates, ...settingsData.messageTemplates }
          : { ...defaultTemplates }
      }
      setSettings(next)
      setInitialSettings(next)
      setLinkedChats(chatsData?.chats || [])
    } catch (error) {
      setLinkedChats([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    await apiFetch('/settings/telegram', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
    setInitialSettings(settings)
    return { message: t('toast.telegramSettingsSaved') || 'Настройки Telegram обновлены' }
  }

  const handleUnlinkChat = async (chatId) => {
    await apiFetch(`/settings/telegram/chats/${chatId}`, { method: 'DELETE' })
    addToast(t('telegram.chatUnlinked') || 'Чат отвязан', 'success')
    await loadData()
  }

  return (
    <SettingsLayout
      title={t('settings.telegram.title') || 'Telegram уведомления'}
      description={t('telegram.description') || 'Настройка шаблонов, расписания и привязанных чатов'}
      icon={Send}
      onSave={handleSave}
      loading={loading}
      saveButtonText={hasUnsavedChanges ? '● ' + (t('common.save') || 'Сохранить') : (t('common.save') || 'Сохранить')}
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <TabsList>
          <Tab value="chats" icon={Users}>
            {t('telegram.linkedChats') || 'Привязанные чаты'}
            {linkedChats.length > 0 && ` (${linkedChats.length})`}
          </Tab>
          <Tab value="templates" icon={MessageSquare}>
            {t('telegram.messageTemplates') || 'Шаблоны сообщений'}
          </Tab>
          <Tab value="schedule" icon={Clock}>
            {t('telegram.schedule') || 'Расписание'}
          </Tab>
          <Tab value="setup" icon={Bot}>
            {t('telegram.addBot') || 'Настройка бота'}
          </Tab>
        </TabsList>

        <TabPanel value="chats">
          <LinkedChatsPanel chats={linkedChats} onUnlink={handleUnlinkChat} />
        </TabPanel>

        <TabPanel value="templates">
          <MessageTemplatesPanel
            templates={settings.messageTemplates}
            onChange={(messageTemplates) => setSettings((s) => ({ ...s, messageTemplates }))}
          />
        </TabPanel>

        <TabPanel value="schedule">
          <SchedulePanel
            sendTime={settings.sendTime}
            onChange={(sendTime) => setSettings((s) => ({ ...s, sendTime }))}
          />
        </TabPanel>

        <TabPanel value="setup">
          <BotSetupGuidePanel botUsername={BOT_USERNAME} marshaCode={selectedHotel?.marsha_code} />
        </TabPanel>
      </Tabs>
    </SettingsLayout>
  )
}

function LinkedChatsPanel({ chats, onUnlink }) {
  const { t } = useTranslation()

  if (chats.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-muted mx-auto mb-4" aria-hidden="true" />
        <p className="text-muted-foreground">{t('telegram.noLinkedChats') || 'Нет привязанных чатов'}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Добавьте бота в Telegram чат, чтобы получать уведомления.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {chats.map((chat) => (
        <div
          key={chat.chat_id}
          className="bg-muted/30 rounded-lg border border-border p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {chat.chat_photo_url ? (
              <img
                src={chat.chat_photo_url}
                alt=""
                className="w-10 h-10 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-accent" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground truncate">
                {chat.chat_title || 'Чат'}
              </div>
              <div className="text-sm text-muted-foreground">
                {chat.hotel_name && (
                  <>
                    🏨 {chat.hotel_name}
                    {chat.department_name && <> → 🏢 {chat.department_name}</>}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded text-xs ${
                chat.is_active ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
              }`}
            >
              {chat.is_active ? 'Активен' : 'Неактивен'}
            </span>
            <button
              type="button"
              onClick={() => onUnlink(chat.chat_id)}
              className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label={t('telegram.unlinkChat') || 'Отвязать чат'}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

const templateFields = [
  { key: 'dailyReport', label: 'Ежедневный отчёт', vars: ['good', 'warning', 'expired', 'total'] },
  { key: 'expiryWarning', label: 'Предупреждение об истечении', vars: ['product', 'date', 'quantity'] },
  { key: 'expiredAlert', label: 'Уведомление о просрочке', vars: ['product', 'quantity'] },
  { key: 'collectionConfirm', label: 'Подтверждение сбора', vars: ['product', 'quantity', 'reason'] }
]

function MessageTemplatesPanel({ templates, onChange }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {templateFields.map((field) => (
        <TemplateEditor
          key={field.key}
          label={t(`telegram.${field.key}`) || field.label}
          value={templates[field.key] || ''}
          onChange={(value) => onChange({ ...templates, [field.key]: value })}
          availableVars={field.vars}
          rows={field.key === 'dailyReport' ? 5 : 3}
        />
      ))}
    </div>
  )
}

function getNextSendTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number)
  const now = new Date()
  const next = new Date()
  next.setHours(hours, minutes, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

function SchedulePanel({ sendTime, onChange }) {
  const { t } = useTranslation()
  const nextSend = getNextSendTime(sendTime)
  const now = new Date()
  const msUntil = nextSend - now
  const hoursUntil = Math.floor(msUntil / (1000 * 60 * 60))
  const minutesUntil = Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60))

  return (
    <SettingsSection title={t('telegram.schedule') || 'Время отправки уведомлений'}>
      <div className="space-y-4">
        <div>
          <label htmlFor="telegram-send-time" className="block text-sm font-medium text-foreground mb-2">
            Ежедневные отчёты будут отправляться в:
          </label>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              id="telegram-send-time"
              type="time"
              value={sendTime}
              onChange={(e) => onChange(e.target.value)}
              className="px-4 py-2.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              aria-describedby="telegram-send-time-help"
            />
            <div id="telegram-send-time-help" className="text-sm text-muted-foreground">
              <div>🌍 Часовой пояс: {SERVER_TIMEZONE}</div>
              <div className="font-mono text-xs">
                Сейчас: {now.toLocaleTimeString('ru-RU', { timeZone: SERVER_TIMEZONE })}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-accent" aria-hidden="true" />
            <div>
              <div className="text-sm font-medium text-foreground">
                Следующая отправка через {hoursUntil}ч {minutesUntil}м
              </div>
              <div className="text-xs text-muted-foreground">
                {nextSend.toLocaleString('ru-RU', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: SERVER_TIMEZONE
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}

function BotSetupGuidePanel({ botUsername, marshaCode }) {
  const { t } = useTranslation()

  const openAddBotLink = () => {
    window.open(`https://t.me/${botUsername}?startgroup=setup`, '_blank')
  }

  const code = marshaCode || 'MARSHA_КОД'

  return (
    <div className="space-y-4">
      <SettingsSection title={t('telegram.addBot') || 'Добавить бота в чат'} icon={Bot}>
        <p className="text-sm text-muted-foreground mb-4">
          Добавьте бота в групповой чат Telegram и привяжите его к отелю для получения уведомлений.
        </p>
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-foreground mb-3">Инструкция:</h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Нажмите кнопку «Добавить бота в чат» ниже.</li>
            <li>Выберите группу в Telegram.</li>
            <li>
              В группе отправьте команду:{' '}
              <code className="bg-background px-2 py-0.5 rounded text-accent">/link {code}</code>
            </li>
            <li>
              Для привязки к отделу:{' '}
              <code className="bg-background px-2 py-0.5 rounded text-accent">/link {code}:Отдел</code>
            </li>
          </ol>
        </div>
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">Команды бота:</h4>
          <div className="text-sm text-muted-foreground space-y-1 font-mono">
            <div><code>/link MARSHA</code> — привязать к отелю</div>
            <div><code>/link MARSHA:Dept</code> — привязать к отделу</div>
            <div><code>/status</code> — статус чата</div>
            <div><code>/unlink</code> — отвязать</div>
            <div><code>/help</code> — справка</div>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddBotLink}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0088cc] text-white rounded-lg hover:bg-[#0088cc]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0088cc] focus:ring-offset-2"
        >
          <ExternalLink className="w-4 h-4" aria-hidden="true" />
          {t('telegram.addBotButton') || 'Добавить бота в чат'}
        </button>
      </SettingsSection>
    </div>
  )
}
