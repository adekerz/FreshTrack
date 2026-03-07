/**
 * CreateDepartmentModal - Модальное окно создания департамента
 */

import { useEffect } from 'react'
import { X, Plus, Package, ClipboardList, ScanLine, Check } from 'lucide-react'
import { ButtonLoader } from '../..'
import { DEPARTMENT_CLASSIFICATIONS } from '../../../../utils/departmentClassifications'

// Рекомендуемые модули по типу отдела
const MODULE_PRESETS = {
  restaurant: ['inventory', 'task_planner'],
  bar: ['inventory', 'task_planner'],
  kitchen: ['inventory', 'task_planner'],
  minibar: ['inventory', 'task_planner'],
  room_service: ['inventory', 'task_planner', 'logbook_scanner'],
  storage: ['inventory'],
}

const ALL_MODULES = [
  {
    code: 'inventory',
    label: 'Инвентарь',
    icon: Package,
    desc: 'Учёт продуктов и сроков годности',
  },
  {
    code: 'task_planner',
    label: 'Task Planner',
    icon: ClipboardList,
    desc: 'Управление задачами',
  },
  {
    code: 'logbook_scanner',
    label: 'Logbook Scanner',
    icon: ScanLine,
    desc: 'Сканирование чеков гостей',
  },
]

export default function CreateDepartmentModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  creating,
}) {
  if (!isOpen) return null

  // Авто-выбор пресета при смене типа
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (formState.type && MODULE_PRESETS[formState.type]) {
      setFormState((prev) => ({
        ...prev,
        modules: MODULE_PRESETS[formState.type],
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.type])

  const selectedModules = formState.modules ?? []

  const toggleModule = (code) => {
    const next = selectedModules.includes(code)
      ? selectedModules.filter((m) => m !== code)
      : [...selectedModules, code]
    setFormState((prev) => ({ ...prev, modules: next }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">
            Создать департамент
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Название *
            </label>
            <input
              type="text"
              placeholder="Кухня"
              value={formState.name}
              onChange={(e) =>
                setFormState({ ...formState, name: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Код генерируется автоматически
            </p>
          </div>

          {/* Классификация */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Классификация
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DEPARTMENT_CLASSIFICATIONS.map(({ type, label, icon: Icon }) => {
                const selected = formState.type === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormState({ ...formState, type })}
                    className={[
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left',
                      selected
                        ? 'border-accent bg-accent/10 text-accent font-medium'
                        : 'border-border bg-background text-foreground hover:border-accent/50 hover:bg-muted',
                    ].join(' ')}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="leading-tight">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Модули */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-foreground">
                Модули
              </label>
              {formState.type && MODULE_PRESETS[formState.type] && (
                <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                  Рекомендовано для{' '}
                  {
                    DEPARTMENT_CLASSIFICATIONS.find(
                      (c) => c.type === formState.type
                    )?.label
                  }
                </span>
              )}
            </div>
            <div className="space-y-2">
              {ALL_MODULES.map(({ code, label, icon: Icon, desc }) => {
                const active = selectedModules.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleModule(code)}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                      active
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-background hover:border-accent/50 hover:bg-muted',
                    ].join(' ')}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-accent/20' : 'bg-muted'}`}
                    >
                      <Icon
                        className={`w-4 h-4 ${active ? 'text-accent' : 'text-muted-foreground'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${active ? 'text-accent' : 'text-foreground'}`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    {active && (
                      <Check className="w-4 h-4 text-accent shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Можно изменить позже в настройках
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Email
            </label>
            <input
              type="email"
              placeholder="department@example.com"
              value={formState.email}
              onChange={(e) =>
                setFormState({ ...formState, email: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Для рассылки отчётов по расписанию
            </p>
          </div>

          {/* Telegram Chat ID */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              placeholder="-1001234567890"
              value={formState.telegram_chat_id}
              onChange={(e) =>
                setFormState({ ...formState, telegram_chat_id: e.target.value })
              }
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Для отправки отчётов в Telegram
            </p>
          </div>

          <button
            onClick={onSubmit}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
            aria-busy={creating}
          >
            {creating ? <ButtonLoader /> : <Plus className="w-4 h-4" />}
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}
