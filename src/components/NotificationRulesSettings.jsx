import { useState, useEffect } from 'react'
import {
  Bell,
  Plus,
  Trash2,
  Save,
  ToggleLeft,
  ToggleRight,
  X,
  AlertTriangle,
  Clock
} from 'lucide-react'
import { SectionLoader, ButtonLoader, InlineLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useProducts } from '../context/ProductContext'
import { cn } from '../utils/classNames'
import { apiFetch } from '../services/api'

export default function NotificationRulesSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { departments, categories } = useProducts()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Централизованная настройка времени отправки
  const [sendTime, setSendTime] = useState('09:00')
  const [sendTimeLoading, setSendTimeLoading] = useState(true)
  const [sendTimeSaving, setSendTimeSaving] = useState(false)

  const [newRule, setNewRule] = useState({
    name: '',
    departmentId: '',
    category: '',
    warningDays: 7,
    criticalDays: 3,
    notificationType: 'all',
    channels: ['app']
  })

  useEffect(() => {
    loadRules()
    loadSendTime()
  }, [])

  // Загрузка централизованного времени отправки
  const loadSendTime = async () => {
    setSendTimeLoading(true)
    try {
      const data = await apiFetch('/settings/telegram')
      if (data.sendTime) {
        setSendTime(data.sendTime)
      }
    } catch (error) {
      // Используем значение по умолчанию
    } finally {
      setSendTimeLoading(false)
    }
  }

  // Сохранение времени отправки
  const saveSendTime = async (newTime) => {
    setSendTimeSaving(true)
    try {
      await apiFetch('/settings/telegram', {
        method: 'PUT',
        body: JSON.stringify({ sendTime: newTime })
      })
      setSendTime(newTime)
      addToast(t('rules.sendTimeSaved') || 'Время отправки сохранено', 'success')
    } catch (error) {
      addToast(t('rules.sendTimeError') || 'Ошибка сохранения времени', 'error')
    } finally {
      setSendTimeSaving(false)
    }
  }

  // Обработчик изменения времени
  const handleSendTimeChange = (e) => {
    const newTime = e.target.value
    setSendTime(newTime)
    // Сохраняем с debounce (автосохранение при потере фокуса)
  }

  const handleSendTimeBlur = () => {
    saveSendTime(sendTime)
  }

  const loadRules = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/notification-rules')
      setRules(data.rules || [])
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setLoading(false)
    }
  }

  const toggleRule = async (ruleId) => {
    try {
      const result = await apiFetch(`/notification-rules/${ruleId}/toggle`, {
        method: 'PATCH'
      })

      setRules(
        rules.map((rule) => (rule.id === ruleId ? { ...rule, isActive: result.isActive } : rule))
      )
    } catch (error) {
      // Error logged by apiFetch
    }
  }

  const deleteRule = async (ruleId, ruleName) => {
    setDeleteConfirm({ id: ruleId, name: ruleName })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    setDeleting(true)
    try {
      await apiFetch(`/notification-rules/${deleteConfirm.id}`, {
        method: 'DELETE'
      })
      setRules(rules.filter((rule) => rule.id !== deleteConfirm.id))
      setDeleteConfirm(null)
      addToast(t('rules.deleted') || 'Правило удалено', 'success')
    } catch (error) {
      addToast(t('rules.deleteError') || 'Ошибка удаления правила', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const addRule = async () => {
    if (!newRule.name || !newRule.warningDays) return

    setSaving(true)
    try {
      await apiFetch('/notification-rules/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: newRule.name,
          departmentId: newRule.departmentId || null,
          type: 'expiry',
          warningDays: newRule.warningDays,
          criticalDays: newRule.criticalDays,
          channels: newRule.channels,
          recipientRoles: ['HOTEL_ADMIN', 'STAFF'],
          enabled: true
        })
      })

      // Перезагружаем список
      await loadRules()

      setShowAddForm(false)
      setNewRule({
        name: '',
        departmentId: '',
        category: '',
        warningDays: 7,
        criticalDays: 3,
        notificationType: 'all',
        channels: ['app']
      })
    } catch (error) {
      logError('Error adding rule:', error)
    } finally {
      setSaving(false)
    }
  }

  const getDepartmentName = (id) => {
    if (!id) return t('rules.allDepartments') || 'Все отделы'
    const dept = departments.find((d) => d.id === id)
    return dept ? dept.name : id
  }

  const getCategoryName = (id) => {
    if (!id) return t('rules.allCategories') || 'Все категории'
    const cat = categories.find((c) => c.id === id)
    return cat ? t(`categories.${cat.id}`) || cat.name : id
  }

  const getNotificationTypeBadge = (type) => {
    switch (type) {
      case 'telegram':
        return (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded">
            Telegram
          </span>
        )
      case 'push':
        return (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded">
            Push
          </span>
        )
      case 'email':
        return (
          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs rounded">
            Email
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded">
            {t('rules.all') || 'Все'}
          </span>
        )
    }
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      {/* Централизованная настройка времени отправки */}
      <div className="bg-gradient-to-r from-primary-50 to-orange-50 dark:from-primary-900/20 dark:to-orange-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
              <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">
                {t('rules.sendTimeTitle') || 'Время отправки уведомлений'}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {t('rules.sendTimeDescription') ||
                  'Ежедневные отчёты и уведомления будут отправляться в указанное время'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:ml-auto">
            {sendTimeLoading ? (
              <InlineLoader />
            ) : (
              <>
                <input
                  type="time"
                  value={sendTime}
                  onChange={handleSendTimeChange}
                  onBlur={handleSendTimeBlur}
                  disabled={sendTimeSaving}
                  className={cn(
                    'px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800',
                    'border-gray-300 dark:border-gray-600',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'min-w-[120px]'
                  )}
                />
                {sendTimeSaving && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <InlineLoader />
                    {t('common.saving') || 'Сохранение...'}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600" />
          <h3 className="font-medium text-foreground">
            {t('rules.title') || 'Правила уведомлений'}
          </h3>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('rules.add') || 'Добавить'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">{t('rules.newRule') || 'Новое правило'}</h4>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                {t('rules.name') || 'Название'}
              </label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                placeholder="Напр.: Молочка — 3 дня"
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                {t('rules.warningDays') || 'Предупреждение за дней'}
              </label>
              <input
                type="number"
                value={newRule.warningDays}
                onChange={(e) =>
                  setNewRule({ ...newRule, warningDays: parseInt(e.target.value) || 7 })
                }
                min="1"
                max="365"
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                {t('rules.criticalDays') || 'Критичный за дней'}
              </label>
              <input
                type="number"
                value={newRule.criticalDays}
                onChange={(e) =>
                  setNewRule({ ...newRule, criticalDays: parseInt(e.target.value) || 3 })
                }
                min="1"
                max="365"
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                {t('rules.department') || 'Отдел'}
              </label>
              <select
                value={newRule.departmentId}
                onChange={(e) => setNewRule({ ...newRule, departmentId: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              >
                <option value="">{t('rules.allDepartments') || 'Все отделы'}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                {t('rules.category') || 'Категория'}
              </label>
              <select
                value={newRule.category}
                onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              >
                <option value="">{t('rules.allCategories') || 'Все категории'}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {t(`categories.${cat.id}`) || cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
                {t('rules.notificationType') || 'Тип уведомления'}
              </label>
              <select
                value={newRule.notificationType}
                onChange={(e) => {
                  const notificationType = e.target.value
                  // Преобразуем тип уведомления в массив каналов
                  let channels = ['app']
                  if (notificationType === 'all') {
                    channels = ['app', 'telegram', 'email']
                  } else if (notificationType === 'telegram') {
                    channels = ['app', 'telegram']
                  } else if (notificationType === 'email') {
                    channels = ['app', 'email']
                  } else if (notificationType === 'push') {
                    channels = ['app', 'push']
                  }
                  setNewRule({ ...newRule, notificationType, channels })
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              >
                <option value="all">{t('rules.allChannels') || 'Все каналы'}</option>
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
                <option value="push">Push</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={addRule}
              disabled={saving || !newRule.name}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm"
              aria-busy={saving}
            >
              {saving ? <ButtonLoader /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-2">
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t('rules.noRules') || 'Нет настроенных правил'}
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center justify-between p-4 rounded-xl transition-colors',
                (rule.isActive ?? rule.enabled)
                  ? 'bg-muted/50'
                  : 'bg-gray-100/50 dark:bg-gray-800/30 opacity-60'
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{rule.name}</p>
                  {rule.channels && Array.isArray(rule.channels) && (
                    <div className="flex gap-1 flex-wrap">
                      {rule.channels.includes('email') && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs rounded">
                          Email
                        </span>
                      )}
                      {rule.channels.includes('telegram') && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded">
                          Telegram
                        </span>
                      )}
                      {rule.channels.includes('app') && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded">
                          App
                        </span>
                      )}
                    </div>
                  )}
                  {!rule.channels && getNotificationTypeBadge(rule.notificationType)}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {getCategoryName(rule.category)} • {getDepartmentName(rule.departmentId)} •
                  <span className="font-medium">
                    {' '}
                    {t('rules.warning') || 'Предупреждение'}:{' '}
                    {rule.warning_days || rule.warningDays || 7} {t('rules.days') || 'дней'} |{' '}
                    {t('rules.critical') || 'Критично'}:{' '}
                    {rule.critical_days || rule.criticalDays || 3} {t('rules.days') || 'дней'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                  title={(rule.isActive ?? rule.enabled) ? 'Выключить' : 'Включить'}
                >
                  {(rule.isActive ?? rule.enabled) ? (
                    <ToggleRight className="w-6 h-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
                {/* Системные правила нельзя удалять */}
                {!rule.isSystemRule && (
                  <button
                    onClick={() => deleteRule(rule.id, rule.name)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

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
                  {t('rules.deleteTitle') || 'Удалить правило?'}
                </h3>
                <p className="text-sm text-muted-foreground">{deleteConfirm.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t('rules.deleteWarning') || 'Это действие нельзя отменить.'}
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
                aria-busy={deleting}
              >
                {deleting ? <ButtonLoader /> : <Trash2 className="w-4 h-4" />}
                {t('common.delete') || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
