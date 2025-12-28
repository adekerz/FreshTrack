/**
 * TelegramSettings - Настройки Telegram уведомлений
 * Шаблоны сообщений и управление привязанными чатами
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { apiFetch } from '../../services/api'
import { 
  Save, 
  RefreshCw, 
  Check, 
  AlertCircle,
  MessageSquare,
  ExternalLink,
  Users,
  Trash2,
  Bot
} from 'lucide-react'

const BOT_USERNAME = 'FreshTrackNotifyBot' // Имя бота

export default function TelegramSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [settings, setSettings] = useState({
    messageTemplates: {
      dailyReport: '📊 Ежедневный отчёт FreshTrack\n\n✅ В норме: {good}\n⚠️ Скоро истекает: {warning}\n🔴 Просрочено: {expired}',
      expiryWarning: '⚠️ Внимание! {product} истекает {date} ({quantity} шт)',
      expiredAlert: '🔴 ПРОСРОЧЕНО: {product} — {quantity} шт',
      collectionConfirm: '✅ Собрано: {product} — {quantity} шт\nПричина: {reason}'
    }
  })
  const [linkedChats, setLinkedChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadSettings()
    loadLinkedChats()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/settings/telegram')
      if (data?.messageTemplates) {
        setSettings(prev => ({ 
          ...prev, 
          messageTemplates: { ...prev.messageTemplates, ...data.messageTemplates }
        }))
      }
    } catch (error) {
      // Error logged by apiFetch
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
      await apiFetch('/settings/telegram', {
        method: 'PUT',
        body: JSON.stringify(settings)
      })
      setMessage({ type: 'success', text: t('settings.saved') })
      addToast(t('toast.telegramSettingsSaved'), 'success')
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.saveError') })
      addToast(t('toast.telegramSettingsError'), 'error')
    } finally {
      setSaving(false)
    }
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

  const updateTemplate = (key, value) => {
    setSettings({
      ...settings,
      messageTemplates: {
        ...settings.messageTemplates,
        [key]: value
      }
    })
  }

  const openAddBotLink = () => {
    // Открываем ссылку для добавления бота в группу
    window.open(`https://t.me/${BOT_USERNAME}?startgroup=setup`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t('settings.telegram.title') || 'Telegram уведомления'}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('telegram.description') || 'Настройка шаблонов и управление чатами'}</p>
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

      {/* Добавить бота в чат */}
      <div className="p-6 border border-border rounded-xl bg-card">
        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
          <Bot className="w-5 h-5" />
          {t('telegram.addBot') || 'Добавить бота в чат'}
        </h3>
        
        <p className="text-sm text-muted-foreground mb-4">
          {t('telegram.addBotDescription') || 'Добавьте бота в групповой чат Telegram и привяжите его к отелю или отделу для получения уведомлений.'}
        </p>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">{t('telegram.setupSteps') || 'Инструкция:'}</h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>{t('telegram.step1') || 'Нажмите кнопку "Добавить бота в чат" ниже'}</li>
            <li>{t('telegram.step2') || 'Выберите группу в Telegram'}</li>
            <li>{t('telegram.step3') || 'В группе отправьте команду:'} <code className="bg-background px-2 py-0.5 rounded text-accent">/link отель:Название</code></li>
            <li>{t('telegram.step4') || 'Для привязки к отделу:'} <code className="bg-background px-2 py-0.5 rounded text-accent">/link отель:Название департамент:Название</code></li>
          </ol>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-foreground mb-2">{t('telegram.availableCommands') || 'Доступные команды:'}</h4>
          <div className="text-sm text-muted-foreground space-y-1 font-mono">
            <div><code>/link отель:Название</code> — привязать к отелю</div>
            <div><code>/link отель:Название департамент:Кухня</code> — привязать к отделу</div>
            <div><code>/status</code> — показать статус чата</div>
            <div><code>/unlink</code> — отвязать чат</div>
            <div><code>/notify on|off</code> — включить/выключить уведомления</div>
            <div><code>/filter critical|warning|expired</code> — фильтр типов</div>
            <div><code>/help</code> — справка</div>
          </div>
        </div>

        <button 
          onClick={openAddBotLink}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0088cc] text-white rounded-lg hover:bg-[#0088cc]/90 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t('telegram.addBotButton') || 'Добавить бота в чат'}
        </button>
      </div>

      {/* Привязанные чаты */}
      {linkedChats.length > 0 && (
        <div className="p-6 border border-border rounded-xl bg-card">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('telegram.linkedChats') || 'Привязанные чаты'} ({linkedChats.length})
          </h3>
          
          <div className="space-y-3">
            {linkedChats.map(chat => (
              <div 
                key={chat.chat_id} 
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{chat.chat_title || 'Чат'}</div>
                  <div className="text-sm text-muted-foreground">
                    {chat.hotel_name ? (
                      <>
                        🏨 {chat.hotel_name}
                        {chat.department_name && <span> → 🏢 {chat.department_name}</span>}
                      </>
                    ) : (
                      <span className="text-warning">⚠️ Не привязан</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    chat.is_active 
                      ? 'bg-success/10 text-success' 
                      : 'bg-danger/10 text-danger'
                  }`}>
                    {chat.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                  <button
                    onClick={() => unlinkChat(chat.chat_id)}
                    className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    title={t('telegram.unlinkChat') || 'Отвязать чат'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Шаблоны сообщений */}
      <div className="p-6 border border-border rounded-xl bg-card">
        <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          {t('telegram.messageTemplates') || 'Шаблоны сообщений'}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {t('telegram.templatesHint') || 'Используйте переменные в фигурных скобках'}
        </p>

        <div className="space-y-6">
          {/* Ежедневный отчёт */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('telegram.dailyReport') || 'Ежедневный отчёт'}
            </label>
            <textarea 
              value={settings.messageTemplates.dailyReport}
              onChange={(e) => updateTemplate('dailyReport', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-32 font-mono text-sm"
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
              value={settings.messageTemplates.expiryWarning}
              onChange={(e) => updateTemplate('expiryWarning', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
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
              value={settings.messageTemplates.expiredAlert}
              onChange={(e) => updateTemplate('expiredAlert', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
          </div>

          {/* Подтверждение сбора */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('telegram.collectionConfirm') || 'Подтверждение сбора'}
            </label>
            <textarea 
              value={settings.messageTemplates.collectionConfirm}
              onChange={(e) => updateTemplate('collectionConfirm', e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-24 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
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
          className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  )
}
