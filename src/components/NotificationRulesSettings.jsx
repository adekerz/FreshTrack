import { useState, useEffect } from 'react'
import {
  Bell,
  Plus,
  Trash2,
  Save,
  ToggleLeft,
  ToggleRight,
  X,
  AlertTriangle
} from 'lucide-react'
import { ButtonLoader, TouchButton } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useProducts } from '../context/ProductContext'
import { logError } from '../utils/logger'
import { cn } from '../utils/classNames'
import { apiFetch } from '../services/api'
import { useDebouncedCallback } from '../hooks/useDebounce'
import SettingsLayout, { SettingsSection } from './ui/settings/SettingsLayout'

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

  const [newRule, setNewRule] = useState({
    name: '',
    departmentId: '',
    category: '',
    warningDays: 7,
    criticalDays: 3,
    notificationType: 'all',
    channels: ['app']
  })

  const debouncedUpdateNewRule = useDebouncedCallback((updates) => {
    setNewRule((prev) => ({ ...prev, ...updates }))
  }, 300)

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/notification-rules')
      setRules(data.rules || [])
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  const toggleRule = async (ruleId) => {
    try {
      const result = await apiFetch(`/notification-rules/${ruleId}/toggle`, { method: 'PATCH' })
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, isActive: result.isActive } : r))
      )
    } catch {
      // logged by apiFetch
    }
  }

  const deleteRule = (ruleId, ruleName) => setDeleteConfirm({ id: ruleId, name: ruleName })

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await apiFetch(`/notification-rules/${deleteConfirm.id}`, { method: 'DELETE' })
      setRules((prev) => prev.filter((r) => r.id !== deleteConfirm.id))
      setDeleteConfirm(null)
      addToast(t('rules.deleted') || 'Правило удалено', 'success')
    } catch (error) {
      addToast(error?.message || t('rules.deleteError') || 'Ошибка удаления правила', 'error')
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
      addToast(t('rules.added') || 'Правило добавлено', 'success')
    } catch (error) {
      logError('Error adding rule:', error)
      addToast(error?.message || t('rules.addError') || 'Ошибка добавления правила', 'error')
    } finally {
      setSaving(false)
    }
  }

  const getDepartmentName = (id) => {
    if (!id) return t('rules.allDepartments') || 'Все отделы'
    const d = departments.find((x) => x.id === id)
    return d ? d.name : id
  }

  const getCategoryName = (id) => {
    if (!id) return t('rules.allCategories') || 'Все категории'
    const c = categories.find((x) => x.id === id)
    return c ? (t(`categories.${c.id}`) || c.name) : id
  }

  const headerActions = (
    <TouchButton
      type="button"
      variant="primary"
      size="small"
      onClick={() => setShowAddForm(true)}
      icon={Plus}
      iconPosition="left"
    >
      {t('rules.add') || 'Добавить'}
    </TouchButton>
  )

  return (
    <>
      <SettingsLayout
        title={t('rules.title') || 'Правила уведомлений'}
        description={t('rules.description') || 'Настройка правил уведомлений для различных событий'}
        icon={Bell}
        loading={loading}
        hideSaveButton
        headerActions={headerActions}
      >
        {showAddForm && (
          <div className="p-6 border border-border rounded-xl bg-card space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-foreground">{t('rules.newRule') || 'Новое правило'}</h4>
              <TouchButton
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowAddForm(false)}
                className="p-1 min-w-0 min-h-0 text-muted-foreground hover:text-foreground"
                aria-label={t('common.close') || 'Закрыть'}
                icon={X}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rule-name" className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t('rules.name') || 'Название'}
                </label>
                <input
                  id="rule-name"
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="Напр.: Молочка — 3 дня"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label htmlFor="rule-warning-days" className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t('rules.warningDays') || 'Предупреждение за дней'}
                </label>
                <input
                  id="rule-warning-days"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={newRule.warningDays}
                  onChange={(e) =>
                    debouncedUpdateNewRule({ warningDays: parseInt(e.target.value, 10) || 7 })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label htmlFor="rule-critical-days" className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t('rules.criticalDays') || 'Критичный за дней'}
                </label>
                <input
                  id="rule-critical-days"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={newRule.criticalDays}
                  onChange={(e) =>
                    debouncedUpdateNewRule({ criticalDays: parseInt(e.target.value, 10) || 3 })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label htmlFor="rule-department" className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t('rules.department') || 'Отдел'}
                </label>
                <select
                  id="rule-department"
                  value={newRule.departmentId}
                  onChange={(e) => setNewRule({ ...newRule, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">{t('rules.allDepartments') || 'Все отделы'}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rule-category" className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t('rules.category') || 'Категория'}
                </label>
                <select
                  id="rule-category"
                  value={newRule.category}
                  onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">{t('rules.allCategories') || 'Все категории'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{t(`categories.${c.id}`) || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rule-type" className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  {t('rules.notificationType') || 'Тип уведомления'}
                </label>
                <select
                  id="rule-type"
                  value={newRule.notificationType}
                  onChange={(e) => {
                    const v = e.target.value
                    let ch = ['app']
                    if (v === 'all') ch = ['app', 'telegram', 'email']
                    else if (v === 'telegram') ch = ['app', 'telegram']
                    else if (v === 'email') ch = ['app', 'email']
                    else if (v === 'push') ch = ['app', 'push']
                    setNewRule({ ...newRule, notificationType: v, channels: ch })
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="all">{t('rules.allChannels') || 'Все каналы'}</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                  <option value="push">Push</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <TouchButton
                type="button"
                variant="ghost"
                size="small"
                onClick={() => setShowAddForm(false)}
              >
                {t('common.cancel') || 'Отмена'}
              </TouchButton>
              <TouchButton
                type="button"
                variant="primary"
                size="small"
                onClick={addRule}
                disabled={saving || !newRule.name}
                loading={saving}
                icon={Save}
                iconPosition="left"
              >
                {t('common.save') || 'Сохранить'}
              </TouchButton>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {rules.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {t('rules.noRules') || 'Нет настроенных правил'}
            </p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl transition-colors',
                  (rule.isActive ?? rule.enabled)
                    ? 'bg-muted/50'
                    : 'bg-muted/30 opacity-60'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{rule.name}</p>
                    {rule.channels && Array.isArray(rule.channels) && (
                      <div className="flex gap-1 flex-wrap">
                        {rule.channels.includes('email') && (
                          <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded">
                            Email
                          </span>
                        )}
                        {rule.channels.includes('telegram') && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                            Telegram
                          </span>
                        )}
                        {rule.channels.includes('app') && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded">
                            App
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getCategoryName(rule.category)} • {getDepartmentName(rule.departmentId)} •
                    <span className="font-medium text-foreground">
                      {' '}{t('rules.warning') || 'Предупреждение'}:{' '}
                      {rule.warning_days ?? rule.warningDays ?? 7} {t('rules.days') || 'дней'} |{' '}
                      {t('rules.critical') || 'Критично'}:{' '}
                      {rule.critical_days ?? rule.criticalDays ?? 3} {t('rules.days') || 'дней'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TouchButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleRule(rule.id)}
                    className={cn(
                      'p-2 min-w-0 min-h-0',
                      (rule.isActive ?? rule.enabled) && 'text-success'
                    )}
                    aria-label={(rule.isActive ?? rule.enabled) ? t('rules.disable') || 'Выключить' : t('rules.enable') || 'Включить'}
                    title={(rule.isActive ?? rule.enabled) ? t('rules.disable') || 'Выключить' : t('rules.enable') || 'Включить'}
                    icon={(rule.isActive ?? rule.enabled) ? ToggleRight : ToggleLeft}
                  />
                  {!rule.isSystemRule && (
                    <TouchButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRule(rule.id, rule.name)}
                      className="p-2 min-w-0 min-h-0 text-danger hover:bg-danger/10"
                      aria-label={t('common.delete') || 'Удалить'}
                      icon={Trash2}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsLayout>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" role="alertdialog" aria-modal="true" aria-labelledby="rules-delete-title">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-danger" aria-hidden="true" />
              </div>
              <div>
                <h3 id="rules-delete-title" className="font-semibold text-foreground">
                  {t('rules.deleteTitle') || 'Удалить правило?'}
                </h3>
                <p className="text-sm text-muted-foreground">{deleteConfirm.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t('rules.deleteWarning') || 'Это действие нельзя отменить.'}
            </p>
            <div className="flex gap-3">
              <TouchButton
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                {t('common.cancel') || 'Отмена'}
              </TouchButton>
              <TouchButton
                type="button"
                variant="danger"
                fullWidth
                onClick={handleConfirmDelete}
                disabled={deleting}
                loading={deleting}
                icon={Trash2}
                iconPosition="left"
              >
                {t('common.delete') || 'Удалить'}
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
