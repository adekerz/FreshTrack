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

const DEFAULT_RULES = [
  {
    id: 1,
    name: 'Критичные товары',
    condition: 'daysToExpiry',
    threshold: 3,
    channels: ['telegram', 'push'],
    schedule: 'daily',
    enabled: true
  },
  {
    id: 2,
    name: 'Просроченные товары',
    condition: 'newExpired',
    threshold: 1,
    channels: ['telegram', 'email'],
    schedule: 'immediate',
    enabled: true
  },
  {
    id: 3,
    name: 'Предупреждение о сроках',
    condition: 'daysToExpiry',
    threshold: 7,
    channels: ['push'],
    schedule: 'weekly',
    enabled: false
  }
]

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

  // Перезагружаем при смене отеля
  useEffect(() => {
    if (selectedHotelId) {
      loadRules()
    }
  }, [selectedHotelId])

  const loadRules = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/settings/notifications/rules')
      setRules(data.rules || DEFAULT_RULES)
    } catch {
      // Используем дефолтные правила если API недоступен
      setRules(DEFAULT_RULES)
    } finally {
      setLoading(false)
    }
  }

  const saveRules = async (newRules) => {
    try {
      await apiFetch('/settings/notifications/rules', {
        method: 'PUT',
        body: JSON.stringify({ rules: newRules })
      })
    } catch {
      // Error already logged by apiFetch
    }
  }

  const handleToggleRule = async (ruleId) => {
    const newRules = rules.map((rule) =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    )
    setRules(newRules)
    await saveRules(newRules)
  }

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm(t('notificationRules.deleteConfirm'))) return
    try {
      const newRules = rules.filter((rule) => rule.id !== ruleId)
      setRules(newRules)
      await saveRules(newRules)
      addToast(t('toast.ruleDeleted'), 'success')
    } catch (error) {
      addToast(t('toast.ruleDeleteError'), 'error')
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
      let newRules
      if (editingRule) {
        newRules = rules.map((rule) =>
          rule.id === editingRule ? { ...formData, id: editingRule } : rule
        )
      } else {
        const newId = Math.max(0, ...rules.map((r) => r.id)) + 1
        newRules = [...rules, { ...formData, id: newId }]
      }

      setRules(newRules)
      await saveRules(newRules)
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary-500" />
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
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </button>
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
              <button
                onClick={() => setShowForm(false)}
                className="p-1 hover:bg-muted rounded"
              >
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
    </div>
  )
}
