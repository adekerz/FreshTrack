/**
 * ConfirmModal — универсальный модал подтверждения действия.
 *
 * Props:
 *   isOpen        {boolean}
 *   onClose       {() => void}
 *   onConfirm     {() => void}
 *   loading       {boolean}
 *   variant       {'danger' | 'warning'} — default 'danger'
 *   icon          {React.ComponentType} — Lucide icon (optional, default AlertTriangle)
 *   title         {string}
 *   description   {string}
 *   confirmLabel  {string} — default 'Удалить'
 *   cancelLabel   {string} — default 'Отмена'
 */

import { AlertTriangle, Trash2 } from 'lucide-react'
import { ButtonLoader } from '.'

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  variant = 'danger',
  icon: IconProp,
  title,
  description,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена'
}) {
  if (!isOpen) return null

  const Icon = IconProp ?? AlertTriangle
  const confirmIcon = variant === 'danger' ? <Trash2 className="w-4 h-4" /> : null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center animate-danger-pulse">
            <Icon className="w-7 h-7 text-danger animate-danger-shake" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50 flex items-center justify-center gap-2"
            aria-busy={loading}
          >
            {loading ? <ButtonLoader /> : confirmIcon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
