import { useState, useEffect } from 'react'
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ToggleLeft,
  ToggleRight,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  AlertTriangle
} from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { useHotel } from '../context/HotelContext'
import { useToast } from '../context/ToastContext'
import { cn } from '../utils/classNames'
import { apiFetch } from '../services/api'
import { PageLoader, ButtonSpinner } from '../components/ui'

export default function NotificationRulesPage() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId, selectedHotel } = useHotel()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingRule, setEditingRule] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    condition: 'daysToExpiry',
    threshold: 3,
    channels: ['telegram'],
    schedule: 'daily',
    enabled: true
  })
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Глобальное время отправки уведомлений
  const [sendTime, setSendTime] = useState('09:00')
  const [savingSendTime, setSavingSendTime] = useState(false)

  // Перезагружаем при смене отеля
  useEffect(() => {
    if (selectedHotelId) {
      loadRules()
      loadSendTime()
    }
  }, [selectedHotelId])

  // Загрузка времени отправки из настроек
  const loadSendTime = async () => {
    try {
      const data = await apiFetch('/settings/telegram')
      setSendTime(data.sendTime || '09:00')
    } catch (error) {
      console.error('Failed to load send time:', error)
    }
  }

  // Сохранение времени отправки
  const saveSendTime = async (newTime) => {
    setSavingSendTime(true)
    try {
      await apiFetch('/settings/telegram', {
        method: 'PUT',
        body: JSON.stringify({ sendTime: newTime })
      })
      setSendTime(newTime)
      addToast(t('notificationRules.sendTimeSaved') || 'Время отправки сохранено', 'success')
    } catch (error) {
      addToast(t('notificationRules.sendTimeError') || 'Ошибка сохранения времени', 'error')
    } finally {
      setSavingSendTime(false)
    }
  }

  // Нормализуем данные из БД (snake_case) в формат UI
  const normalizeRule = (dbRule) => ({
    id: dbRule.id,
    name: dbRule.name,
    condition: dbRule.type === 'expiry' ? 'daysToExpiry' : dbRule.type,
    threshold: dbRule.warning_days || dbRule.warningDays || 7,
    criticalDays: dbRule.critical_days || dbRule.criticalDays || 3,
    channels: Array.isArray(dbRule.channels)
      ? dbRule.channels
      : typeof dbRule.channels === 'string'
        ? JSON.parse(dbRule.channels)
        : ['app'],
    schedule: 'daily', // schedule не хранится в БД, используем дефолт
    enabled: dbRule.enabled,
    isSystemRule: dbRule.isSystemRule || dbRule.hotel_id === null
  })

  const loadRules = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/notification-rules/')
      // Нормализуем данные и используем только правила из БД
      const normalizedRules = (data.rules || []).map(normalizeRule)
      setRules(normalizedRules)
    } catch {
      // При ошибке - пустой список, пользователь может создать правила
      setRules([])
      addToast(t('toast.rulesLoadError'), 'error')
    } finally {
      setLoading(false)
    }
  }

  // Сохранение отдельного правила через POST /notification-rules/rules
  const saveRule = async (ruleData) => {
    try {
      const response = await apiFetch('/notification-rules/rules', {
        method: 'POST',
        body: JSON.stringify(ruleData)
      })
      return response.id
    } catch {
      throw new Error('Failed to save rule')
    }
  }

  const handleToggleRule = async (ruleId) => {
    try {
      // Вызываем PATCH endpoint для переключения состояния
      await apiFetch(`/notification-rules/${ruleId}/toggle`, {
        method: 'PATCH'
      })
      // Обновляем локальный state
      setRules(
        rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
      )
    } catch {
      addToast(t('toast.ruleToggleError'), 'error')
    }
  }

  const handleDeleteRule = async (ruleId, ruleName) => {
    setDeleteConfirm({ id: ruleId, name: ruleName })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    setDeleting(true)
    try {
      // Вызываем DELETE endpoint для удаления правила из БД
      await apiFetch(`/notification-rules/${deleteConfirm.id}`, {
        method: 'DELETE'
      })

      // Обновляем локальный state
      setRules(rules.filter((rule) => rule.id !== deleteConfirm.id))
      addToast(t('toast.ruleDeleted'), 'success')
      setDeleteConfirm(null)
    } catch (error) {
      addToast(t('toast.ruleDeleteError'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleEditRule = (rule) => {
    setFormData({ ...rule })
    setEditingRule(rule.id)
    setShowForm(true)
  }

  const handleAddRule = () => {
    setFormData({
      name: '',
      condition: 'daysToExpiry',
      threshold: 3,
      channels: ['telegram'],
      schedule: 'daily',
      enabled: true
    })
    setEditingRule(null)
    setShowForm(true)
  }

  const handleSaveRule = async () => {
    if (!formData.name.trim()) return

    try {
      // Преобразуем данные формы в формат API
      const ruleData = {
        id: editingRule || undefined,
        name: formData.name,
        type: formData.condition === 'daysToExpiry' ? 'expiry' : formData.condition,
        warningDays: formData.threshold,
        criticalDays: Math.max(1, Math.floor(formData.threshold / 2)),
        channels: formData.channels,
        enabled: formData.enabled,
        description: ''
      }

      await saveRule(ruleData)

      // Перезагружаем список правил с сервера
      await loadRules()

      setShowForm(false)
      setEditingRule(null)
      addToast(t('toast.ruleSaved'), 'success')
    } catch (error) {
      addToast(t('toast.ruleSaveError'), 'error')
    }
  }

  const toggleChannel = (channel) => {
    const channels = formData.channels.includes(channel)
      ? formData.channels.filter((c) => c !== channel)
      : [...formData.channels, channel]
    setFormData({ ...formData, channels })
  }

  const getConditionLabel = (condition) => {
    const labels = {
      daysToExpiry: t('notificationRules.conditions.daysToExpiry'),
      quantity: t('notificationRules.conditions.quantity'),
      newExpired: t('notificationRules.conditions.newExpired')
    }
    return labels[condition] || condition
  }

  const getScheduleLabel = (schedule) => {
    const labels = {
      immediate: t('notificationRules.immediate'),
      daily: t('notificationRules.daily'),
      weekly: t('notificationRules.weekly')
    }
    return labels[schedule] || schedule
  }

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'telegram':
        return <MessageSquare className="w-4 h-4" />
      case 'push':
        return <Smartphone className="w-4 h-4" />
      default:
        return <Bell className="w-4 h-4" />
    }
  }

  if (loading) {
    return <PageLoader message={t('common.loading') || 'Загрузка...'} />
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-light text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-accent" />
            {t('notificationRules.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('notificationRules.subtitle')}</p>
        </div>
        <button
          onClick={handleAddRule}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('notificationRules.addRule')}
        </button>
      </div>

      {/* Global Send Time Settings */}
      <div className="bg-card rounded-xl shadow-lg p-4 md:p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent" />
          {t('notificationRules.sendTimeTitle') || 'Время отправки уведомлений'}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {t('notificationRules.sendTimeDescription') ||
            'Все уведомления (Telegram, Email, Push) будут отправляться в указанное время'}
        </p>
        <div className="flex items-center gap-4">
          <input
            type="time"
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            className="px-4 py-2.5 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
          <button
            onClick={() => saveSendTime(sendTime)}
            disabled={savingSendTime}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {savingSendTime ? <ButtonSpinner /> : <Save className="w-4 h-4" />}
            {t('common.save') || 'Сохранить'}
          </button>
          <span className="text-sm text-muted-foreground">
            {t('notificationRules.timezoneNote') || 'По часовому поясу сервера'}
          </span>
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-card rounded-xl shadow-lg overflow-hidden">
        {rules.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('notificationRules.noRules')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4',
                  !rule.enabled && 'opacity-50'
                )}
              >
                {/* Rule Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">{rule.name}</h3>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        rule.enabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {rule.enabled
                        ? t('notificationRules.enabled')
                        : t('notificationRules.disabled')}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {getConditionLabel(rule.condition)}: {rule.threshold}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {getScheduleLabel(rule.schedule)}
                    </span>
                  </div>

                  {/* Channels */}
                  <div className="mt-3 flex gap-2">
                    {rule.channels.map((channel) => (
                      <span
                        key={channel}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                      >
                        {getChannelIcon(channel)}
                        {channel === 'email' && t('notificationRules.email')}
                        {channel === 'telegram' && t('notificationRules.telegram')}
                        {channel === 'push' && t('notificationRules.push')}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    title={rule.enabled ? 'Disable' : 'Enable'}
                  >
                    {rule.enabled ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEditRule(rule)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Edit2 className="w-5 h-5 text-gray-500" />
                  </button>
                  {/* Системные правила нельзя удалять */}
                  {!rule.isSystemRule && (
                    <button
                      onClick={() => handleDeleteRule(rule.id, rule.name)}
                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-foreground">
                {editingRule ? t('notificationRules.editRule') : t('notificationRules.addRule')}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('notificationRules.ruleName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                  placeholder="Введите название..."
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('notificationRules.condition')}
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                >
                  <option value="daysToExpiry">
                    {t('notificationRules.conditions.daysToExpiry')}
                  </option>
                  <option value="quantity">{t('notificationRules.conditions.quantity')}</option>
                  <option value="newExpired">{t('notificationRules.conditions.newExpired')}</option>
                </select>
              </div>

              {/* Threshold */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('notificationRules.threshold')}
                </label>
                <input
                  type="number"
                  value={formData.threshold}
                  onChange={(e) =>
                    setFormData({ ...formData, threshold: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                  min="0"
                />
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('notificationRules.schedule')}
                </label>
                <select
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                >
                  <option value="immediate">{t('notificationRules.immediate')}</option>
                  <option value="daily">{t('notificationRules.daily')}</option>
                  <option value="weekly">{t('notificationRules.weekly')}</option>
                </select>
              </div>

              {/* Channels */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  {t('notificationRules.channels')}
                </label>
                <div className="flex gap-2">
                  {['email', 'telegram', 'push'].map((channel) => (
                    <button
                      key={channel}
                      onClick={() => toggleChannel(channel)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                        formData.channels.includes(channel)
                          ? 'bg-primary-100 border-primary-500 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      {getChannelIcon(channel)}
                      {channel === 'email' && t('notificationRules.email')}
                      {channel === 'telegram' && t('notificationRules.telegram')}
                      {channel === 'push' && t('notificationRules.push')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveRule}
                disabled={!formData.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center animate-danger-pulse">
                <AlertTriangle className="w-7 h-7 text-danger animate-danger-shake" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('notificationRules.deleteTitle') || 'Удалить правило?'}
                </h3>
                <p className="text-sm text-muted-foreground">{deleteConfirm.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t('notificationRules.deleteWarning') || 'Это действие нельзя отменить.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <ButtonSpinner /> : <Trash2 className="w-4 h-4" />}
                {t('common.delete') || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
