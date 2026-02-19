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
  CalendarDays,
  CalendarRange,
  Building2,
  Send,
  Mail,
  Smartphone,
  BellRing,
} from 'lucide-react'
import { TouchButton } from './ui'
import { useToast } from '../context/ToastContext'
import { useDepartment } from '../context/DepartmentContext'
import { logError } from '../utils/logger'
import { cn } from '../utils/classNames'
import { apiFetch } from '../services/api'
import { useDebouncedCallback } from '../hooks/useDebounce'
import SettingsLayout from './ui/settings/SettingsLayout'

const CHANNEL_META = {
  telegram: {
    label: 'Telegram',
    icon: Send,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  },
  email: {
    label: 'Email',
    icon: Mail,
    color:
      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  },
  in_app: {
    label: 'Приложение',
    icon: Smartphone,
    color:
      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  },
  push: {
    label: 'Push',
    icon: BellRing,
    color:
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
}

const DEFAULT_RULE = {
  name: '',
  departmentId: '',
  category: '',
  notificationMode: 'daily',
  warningDays: 7,
  criticalDays: 3,
  warningMonths: 2,
  notificationType: 'all',
  channels: ['in_app', 'telegram', 'email'],
}

export default function NotificationRulesSettings() {
  const { addToast } = useToast()
  const { departments } = useDepartment()

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [newRule, setNewRule] = useState(DEFAULT_RULE)

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
      const result = await apiFetch(`/notification-rules/${ruleId}/toggle`, {
        method: 'PATCH',
      })
      setRules((prev) =>
        prev.map((r) =>
          r.id === ruleId ? { ...r, isActive: result.isActive } : r
        )
      )
    } catch {
      /* logged by apiFetch */
    }
  }

  const deleteRule = (ruleId, ruleName) =>
    setDeleteConfirm({ id: ruleId, name: ruleName })

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await apiFetch(`/notification-rules/${deleteConfirm.id}`, {
        method: 'DELETE',
      })
      setRules((prev) => prev.filter((r) => r.id !== deleteConfirm.id))
      setDeleteConfirm(null)
      addToast('Правило удалено', 'success')
    } catch (error) {
      addToast(error?.message || 'Ошибка удаления правила', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const addRule = async () => {
    if (!newRule.name) return
    if (newRule.notificationMode === 'daily' && !newRule.warningDays) return
    setSaving(true)
    try {
      await apiFetch('/notification-rules/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: newRule.name,
          departmentId: newRule.departmentId || null,
          type: 'expiry',
          notificationMode: newRule.notificationMode,
          warningDays:
            newRule.notificationMode === 'monthly' ? null : newRule.warningDays,
          criticalDays:
            newRule.notificationMode === 'monthly'
              ? null
              : newRule.criticalDays,
          warningMonths:
            newRule.notificationMode === 'monthly'
              ? newRule.warningMonths
              : null,
          channels: newRule.channels,
          recipientRoles: ['HOTEL_ADMIN', 'STAFF'],
          enabled: true,
        }),
      })
      await loadRules()
      setShowAddForm(false)
      setNewRule(DEFAULT_RULE)
      addToast('Правило добавлено', 'success')
    } catch (error) {
      logError('Error adding rule:', error)
      addToast(error?.message || 'Ошибка добавления правила', 'error')
    } finally {
      setSaving(false)
    }
  }

  const getDepartmentName = (id) => {
    if (!id) return 'Все отделы'
    const d = departments.find((x) => x.id === id)
    return d ? d.name : id
  }

  const isMonthly = newRule.notificationMode === 'monthly'

  const headerActions = (
    <TouchButton
      type="button"
      variant="primary"
      size="small"
      onClick={() => setShowAddForm(true)}
      icon={Plus}
      iconPosition="left"
    >
      Добавить правило
    </TouchButton>
  )

  return (
    <>
      <SettingsLayout
        title="Правила уведомлений"
        description="Когда и куда отправлять уведомления об истекающих сроках"
        icon={Bell}
        loading={loading}
        hideSaveButton
        headerActions={headerActions}
      >
        {/* ── Форма добавления ── */}
        {showAddForm && (
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            {/* Заголовок формы */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h4 className="font-semibold text-foreground">Новое правило</h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1 rounded-md"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* ── Шаг 1: Режим ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  1. Как уведомлять?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* По дням */}
                  <button
                    type="button"
                    onClick={() =>
                      setNewRule({ ...newRule, notificationMode: 'daily' })
                    }
                    className={cn(
                      'text-left p-4 rounded-xl border-2 transition-all',
                      newRule.notificationMode === 'daily'
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-muted/30 hover:border-accent/50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarDays
                        className={cn(
                          'w-4 h-4',
                          newRule.notificationMode === 'daily'
                            ? 'text-accent'
                            : 'text-muted-foreground'
                        )}
                      />
                      <span className="font-medium text-foreground text-sm">
                        По дням
                      </span>
                      {newRule.notificationMode === 'daily' && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Каждый день — список товаров у которых срок истекает в
                      ближайшие N дней
                    </p>
                  </button>

                  {/* По месяцам */}
                  <button
                    type="button"
                    onClick={() =>
                      setNewRule({ ...newRule, notificationMode: 'monthly' })
                    }
                    className={cn(
                      'text-left p-4 rounded-xl border-2 transition-all',
                      newRule.notificationMode === 'monthly'
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-muted/30 hover:border-accent/50'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarRange
                        className={cn(
                          'w-4 h-4',
                          newRule.notificationMode === 'monthly'
                            ? 'text-accent'
                            : 'text-muted-foreground'
                        )}
                      />
                      <span className="font-medium text-foreground text-sm">
                        По месяцам
                      </span>
                      {newRule.notificationMode === 'monthly' && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Дайджест сгруппированный по месяцу — удобно для
                      планирования сбора
                    </p>
                  </button>
                </div>
              </div>

              {/* ── Шаг 2: Порог ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  2.{' '}
                  {isMonthly
                    ? 'Сколько месяцев вперёд показывать?'
                    : 'За сколько дней предупреждать?'}
                </p>

                {isMonthly ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border">
                    <CalendarRange className="w-8 h-8 text-accent shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Горизонт планирования
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        В отчёт попадут товары со сроком истечения в ближайшие
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        defaultValue={newRule.warningMonths}
                        onChange={(e) =>
                          debouncedUpdateNewRule({
                            warningMonths: parseInt(e.target.value, 10) || 2,
                          })
                        }
                        className="w-16 text-center px-2 py-2 border border-border rounded-lg bg-card text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <span className="text-sm text-muted-foreground">
                        мес.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/5 border border-warning/20">
                      <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                        <span className="text-warning text-sm font-bold">
                          !
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Предупреждение
                        </p>
                        <p className="text-xs text-muted-foreground">
                          за дней до истечения
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          defaultValue={newRule.warningDays}
                          onChange={(e) =>
                            debouncedUpdateNewRule({
                              warningDays: parseInt(e.target.value, 10) || 7,
                            })
                          }
                          className="w-14 text-center px-2 py-1.5 border border-border rounded-lg bg-card text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <span className="text-xs text-muted-foreground">
                          дн.
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/5 border border-danger/20">
                      <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
                        <span className="text-danger text-sm font-bold">
                          !!
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          Критично
                        </p>
                        <p className="text-xs text-muted-foreground">
                          за дней до истечения
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          defaultValue={newRule.criticalDays}
                          onChange={(e) =>
                            debouncedUpdateNewRule({
                              criticalDays: parseInt(e.target.value, 10) || 3,
                            })
                          }
                          className="w-14 text-center px-2 py-1.5 border border-border rounded-lg bg-card text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <span className="text-xs text-muted-foreground">
                          дн.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Шаг 3: Куда отправлять ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  3. Куда отправлять?
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(CHANNEL_META).map(([key, meta]) => {
                    const active = newRule.channels.includes(key)
                    const Icon = meta.icon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const channels = active
                            ? newRule.channels.filter((c) => c !== key)
                            : [...newRule.channels, key]
                          if (channels.length === 0) return // хотя бы один канал
                          setNewRule({ ...newRule, channels })
                        }}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium',
                          active
                            ? 'border-accent bg-accent/5 text-foreground'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-accent/40'
                        )}
                      >
                        <Icon
                          className={cn('w-4 h-4', active ? 'text-accent' : '')}
                        />
                        {meta.label}
                        {active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Шаг 4: Детали ── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  4. Название и отдел
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="rule-name"
                      className="block text-xs text-muted-foreground mb-1"
                    >
                      Название правила
                    </label>
                    <input
                      id="rule-name"
                      type="text"
                      value={newRule.name}
                      onChange={(e) =>
                        setNewRule({ ...newRule, name: e.target.value })
                      }
                      placeholder={
                        isMonthly
                          ? 'Напр.: Молочка — дайджест'
                          : 'Напр.: Молочка — 7 дней'
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rule-department"
                      className="block text-xs text-muted-foreground mb-1"
                    >
                      Отдел
                    </label>
                    <select
                      id="rule-department"
                      value={newRule.departmentId}
                      onChange={(e) =>
                        setNewRule({ ...newRule, departmentId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">Все отделы</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Футер */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
              <TouchButton
                type="button"
                variant="ghost"
                size="small"
                onClick={() => setShowAddForm(false)}
              >
                Отмена
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
                Сохранить
              </TouchButton>
            </div>
          </div>
        )}

        {/* ── Список правил ── */}
        <div className="space-y-2">
          {rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Нет настроенных правил</p>
              <p className="text-xs mt-1">
                Нажмите «Добавить правило» чтобы создать первое
              </p>
            </div>
          ) : (
            rules.map((rule) => {
              const active = rule.isActive ?? rule.enabled
              const mode =
                rule.notification_mode ?? rule.notificationMode ?? 'daily'
              const channels = Array.isArray(rule.channels) ? rule.channels : []

              return (
                <div
                  key={rule.id}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-xl border transition-colors',
                    active
                      ? 'bg-card border-border'
                      : 'bg-muted/20 border-border/50 opacity-60'
                  )}
                >
                  {/* Иконка режима */}
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      mode === 'monthly' ? 'bg-accent/10' : 'bg-warning/10'
                    )}
                  >
                    {mode === 'monthly' ? (
                      <CalendarRange className="w-4 h-4 text-accent" />
                    ) : (
                      <CalendarDays className="w-4 h-4 text-warning" />
                    )}
                  </div>

                  {/* Основная информация */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {rule.name}
                      </span>
                      {!active && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          выключено
                        </span>
                      )}
                    </div>

                    {/* Режим + порог */}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {mode === 'monthly' ? (
                        <span className="text-xs text-muted-foreground">
                          Дайджест по месяцам •{' '}
                          <span className="text-foreground font-medium">
                            горизонт{' '}
                            {rule.warning_months ?? rule.warningMonths ?? 2}{' '}
                            мес.
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          По дням •{' '}
                          <span className="text-warning font-medium">
                            предупреждение{' '}
                            {rule.warning_days ?? rule.warningDays ?? 7} дн.
                          </span>{' '}
                          •{' '}
                          <span className="text-danger font-medium">
                            критично{' '}
                            {rule.critical_days ?? rule.criticalDays ?? 3} дн.
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Отдел + каналы */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        {getDepartmentName(
                          rule.department_id ?? rule.departmentId
                        )}
                      </span>
                      {channels.map((ch) => {
                        const meta = CHANNEL_META[ch]
                        if (!meta) return null
                        const Icon = meta.icon
                        return (
                          <span
                            key={ch}
                            className={cn(
                              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                              meta.color
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Кнопки управления */}
                  <div className="flex items-center gap-1 shrink-0">
                    <TouchButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleRule(rule.id)}
                      className={cn(
                        'p-2 min-w-0 min-h-0',
                        active && 'text-success'
                      )}
                      aria-label={active ? 'Выключить' : 'Включить'}
                      title={active ? 'Выключить' : 'Включить'}
                      icon={active ? ToggleRight : ToggleLeft}
                    />
                    {!rule.isSystemRule && (
                      <TouchButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRule(rule.id, rule.name)}
                        className="p-2 min-w-0 min-h-0 text-danger hover:bg-danger/10"
                        aria-label="Удалить"
                        icon={Trash2}
                      />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </SettingsLayout>

      {/* ── Диалог удаления ── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="rules-delete-title"
        >
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
                <AlertTriangle
                  className="w-7 h-7 text-danger"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3
                  id="rules-delete-title"
                  className="font-semibold text-foreground"
                >
                  Удалить правило?
                </h3>
                <p className="text-sm text-muted-foreground">
                  {deleteConfirm.name}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <TouchButton
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Отмена
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
                Удалить
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
