/**
 * ModulesSettings — Управление модулями по отделам
 *
 * Позволяет администратору:
 * - Видеть список всех отделов с назначенными модулями
 * - Включать/отключать модули для каждого отдела
 * - Core-модули нельзя отключить (визуально заблокированы)
 * - Перед отключением показывается диалог подтверждения
 */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../../services/api'
import { useToast } from '../../../context/ToastContext'
import { useDepartment } from '../../../context/DepartmentContext'
import { useModules } from '../../../context/ModuleContext'
import { logError } from '../../../utils/logger'
import ConfirmDialog from '../ConfirmDialog'
import {
  Blocks,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Building2,
  Lock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'

// Иконки и описания для модулей
const MODULE_META = {
  dashboard: { emoji: '📊', color: '#4A90D9' },
  task_planner: { emoji: '📋', color: '#7C3AED' },
  notifications: { emoji: '🔔', color: '#F59E0B' },
  inventory: { emoji: '📦', color: '#10B981' },
  calendar: { emoji: '📅', color: '#3B82F6' },
  analytics: { emoji: '📈', color: '#8B5CF6' },
  audit_logs: { emoji: '📜', color: '#6B7280' },
  logbook_scanner: { emoji: '📷', color: '#EC4899' },
}

export default function ModulesSettings() {
  const { addToast } = useToast()
  const { departments } = useDepartment()
  const { refetchModules, recentlyEnabledModule, clearEnabledEvent } =
    useModules()

  const [allModules, setAllModules] = useState([])
  const [departmentModules, setDepartmentModules] = useState({})
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState({}) // { `${deptId}-${moduleCode}`: true }
  const [expandedDept, setExpandedDept] = useState(null)
  const [error, setError] = useState(null)

  // Confirm dialog state for disabling a module
  const [confirmDisable, setConfirmDisable] = useState(null) // { departmentId, moduleCode, departmentName, moduleName }
  const [confirmLoading, setConfirmLoading] = useState(false)

  /**
   * Загрузить все модули и модули каждого отдела
   */
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const myModules = await apiFetch('/modules/all')

      const deptModulesMap = {}
      for (const dept of departments) {
        try {
          const data = await apiFetch(`/modules/department/${dept.id}`)
          if (data.success) {
            deptModulesMap[dept.id] = data.modules || []
          }
        } catch {
          deptModulesMap[dept.id] = []
        }
      }

      if (myModules.success && myModules.modules) {
        setAllModules(myModules.modules)
      }

      setDepartmentModules(deptModulesMap)

      if (departments.length > 0 && !expandedDept) {
        setExpandedDept(departments[0].id)
      }
    } catch (err) {
      logError('[ModulesSettings] Failed to fetch:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [departments, expandedDept])

  useEffect(() => {
    if (departments.length > 0) {
      fetchData()
    }
  }, [departments.length]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Выполнить фактическое переключение модуля
   */
  const doToggleModule = async (departmentId, moduleCode, currentlyEnabled) => {
    const key = `${departmentId}-${moduleCode}`
    setToggling((prev) => ({ ...prev, [key]: true }))

    try {
      let result
      if (currentlyEnabled) {
        result = await apiFetch(
          `/modules/department/${departmentId}/${moduleCode}`,
          {
            method: 'DELETE',
          }
        )
      } else {
        result = await apiFetch(`/modules/department/${departmentId}/enable`, {
          method: 'POST',
          body: JSON.stringify({ module_code: moduleCode }),
        })
      }

      if (result.success) {
        setDepartmentModules((prev) => {
          const updated = { ...prev }
          updated[departmentId] = (updated[departmentId] || []).map((m) =>
            m.code === moduleCode ? { ...m, is_enabled: !currentlyEnabled } : m
          )
          return updated
        })

        addToast(
          currentlyEnabled
            ? `Модуль "${moduleCode}" отключён`
            : `Модуль "${moduleCode}" включён`,
          'success'
        )

        refetchModules()
      }
    } catch (err) {
      addToast(err.message || 'Ошибка при переключении модуля', 'error')
    } finally {
      setToggling((prev) => ({ ...prev, [key]: false }))
    }
  }

  /**
   * Обработчик клика по переключателю
   * При отключении открывает диалог подтверждения; при включении — сразу применяет
   */
  const handleToggleClick = (departmentId, moduleCode, currentlyEnabled) => {
    if (currentlyEnabled) {
      const dept = departments.find((d) => d.id === departmentId)
      const mod = allModules.find((m) => m.code === moduleCode)
      setConfirmDisable({
        departmentId,
        moduleCode,
        departmentName: dept?.name || departmentId,
        moduleName: mod?.name || moduleCode,
      })
    } else {
      doToggleModule(departmentId, moduleCode, false)
    }
  }

  const handleConfirmDisable = async () => {
    if (!confirmDisable) return
    setConfirmLoading(true)
    try {
      await doToggleModule(
        confirmDisable.departmentId,
        confirmDisable.moduleCode,
        true
      )
    } finally {
      setConfirmLoading(false)
      setConfirmDisable(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Blocks className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-medium text-foreground">Модули</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
          <span className="ml-3 text-muted-foreground">
            Загрузка модулей...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Blocks className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-medium text-foreground">Модули</h3>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Ошибка загрузки</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="ml-auto px-3 py-1.5 text-sm rounded-lg border border-danger/30 hover:bg-danger/20 transition-colors"
          >
            Повторить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Blocks className="w-5 h-5 text-accent" />
          <div>
            <h3 className="text-lg font-medium text-foreground">Модули</h3>
            <p className="text-sm text-muted-foreground">
              Управление доступными модулями для каждого отдела
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Обновить"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Inactivity banner — shown when module re-enabled after >7 days */}
      {recentlyEnabledModule && recentlyEnabledModule.inactive_days > 7 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-foreground">
              Модуль был неактивен {recentlyEnabledModule.inactive_days}{' '}
              {recentlyEnabledModule.inactive_days === 1
                ? 'день'
                : recentlyEnabledModule.inactive_days < 5
                  ? 'дня'
                  : 'дней'}
            </p>
            <p className="text-muted-foreground mt-0.5">
              Рекомендуем проверить актуальность данных — они могли устареть за
              время отключения.
            </p>
          </div>
          <button
            onClick={clearEnabledEvent}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -mt-1 -mr-1"
            title="Закрыть"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-accent/5 border border-accent/20">
        <Lock className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p>
            Все модули можно включать и отключать для каждого отдела отдельно.
          </p>
          <p className="mt-1">
            Данные не удаляются при отключении — модуль можно включить обратно в
            любой момент.
          </p>
        </div>
      </div>

      {/* Departments list */}
      {departments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Нет отделов для настройки модулей</p>
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) => {
            const isExpanded = expandedDept === dept.id
            const deptMods = departmentModules[dept.id] || []
            const enabledCodes = new Set(
              deptMods.filter((m) => m.is_enabled).map((m) => m.code)
            )
            const enabledCount = enabledCodes.size
            const totalCount = allModules.length

            return (
              <div
                key={dept.id}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all"
              >
                {/* Department header */}
                <button
                  type="button"
                  onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-medium"
                      style={{ backgroundColor: dept.color || '#6B7280' }}
                    >
                      {dept.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{dept.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {enabledCount} / {totalCount} модулей активно
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Mini badges for enabled modules only */}
                    <div className="hidden sm:flex items-center gap-1">
                      {deptMods
                        .filter((m) => m.is_enabled)
                        .slice(0, 5)
                        .map((m) => (
                          <span key={m.code} className="text-xs" title={m.name}>
                            {MODULE_META[m.code]?.emoji || '📦'}
                          </span>
                        ))}
                      {enabledCount > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{enabledCount - 5}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded modules grid */}
                {isExpanded && (
                  <div className="border-t border-border p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {allModules.map((mod) => {
                        const isEnabled = enabledCodes.has(mod.code)
                        const isCore = mod.is_core
                        const isTogglingThis =
                          toggling[`${dept.id}-${mod.code}`]
                        const meta = MODULE_META[mod.code] || {}

                        return (
                          <div
                            key={mod.code}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                              isEnabled
                                ? 'border-accent/30 bg-accent/5'
                                : 'border-border bg-muted/30'
                            } ${isCore ? 'opacity-75' : ''}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xl flex-shrink-0">
                                {meta.emoji || '📦'}
                              </span>
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    isEnabled
                                      ? 'text-foreground'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {mod.name}
                                </p>
                                {mod.description && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {mod.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {isCore && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  Core
                                </span>
                              )}
                              {isEnabled && (
                                <CheckCircle2 className="w-4 h-4 text-success" />
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleClick(
                                    dept.id,
                                    mod.code,
                                    isEnabled
                                  )
                                }
                                disabled={isCore || isTogglingThis}
                                className={`p-1 rounded-lg transition-all ${
                                  isCore
                                    ? 'cursor-not-allowed opacity-40'
                                    : 'hover:bg-muted cursor-pointer'
                                } ${isTogglingThis ? 'animate-pulse' : ''}`}
                                title={
                                  isCore
                                    ? 'Core-модуль нельзя отключить'
                                    : isEnabled
                                      ? 'Отключить модуль'
                                      : 'Включить модуль'
                                }
                              >
                                {isTogglingThis ? (
                                  <RefreshCw className="w-5 h-5 text-accent animate-spin" />
                                ) : isEnabled ? (
                                  <ToggleRight className="w-6 h-6 text-accent" />
                                ) : (
                                  <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm disable dialog */}
      <ConfirmDialog
        isOpen={!!confirmDisable}
        onClose={() => setConfirmDisable(null)}
        onConfirm={handleConfirmDisable}
        loading={confirmLoading}
        variant="warning"
        title="Отключить модуль?"
        description={
          confirmDisable
            ? `Модуль «${confirmDisable.moduleName}» будет отключён для отдела «${confirmDisable.departmentName}». Активные пользователи потеряют доступ в течение нескольких секунд. Данные не удаляются — модуль можно включить обратно.`
            : ''
        }
        confirmLabel="Отключить"
        cancelLabel="Отмена"
      />
    </div>
  )
}
