/**
 * CreateDepartmentModal - Модальное окно создания департамента
 */

import { X, Plus } from 'lucide-react'
import { ButtonLoader } from '../..'

export default function CreateDepartmentModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  creating
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Создать департамент</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Название *</label>
            <input
              type="text"
              placeholder="Кухня"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-xs text-muted-foreground mt-1">Код генерируется автоматически</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Описание</label>
            <input
              type="text"
              placeholder="Описание департамента"
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              type="email"
              placeholder="department@example.com"
              value={formState.email}
              onChange={(e) => setFormState({ ...formState, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-xs text-muted-foreground mt-1">Для рассылки отчётов по расписанию</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Telegram Chat ID</label>
            <input
              type="text"
              placeholder="-1001234567890"
              value={formState.telegram_chat_id}
              onChange={(e) => setFormState({ ...formState, telegram_chat_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-xs text-muted-foreground mt-1">Для отправки отчётов в Telegram</p>
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
