/**
 * ConfirmDialog Component
 * Confirmation modal for destructive actions
 * Focus on cancel by default (safe choice)
 */

import { useRef, useEffect } from 'react'
import { AlertTriangle, Trash2, Info } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

const icons = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info,
}

const iconColors = {
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-accent/10 text-accent',
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  const cancelRef = useRef(null)
  const Icon = icons[variant] || icons.info

  // Focus cancel button on open (safe choice - Hick's Law)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleConfirm = async () => {
    await onConfirm?.()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
    >
      <div className="text-center">
        <div className={`
          w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4
          ${iconColors[variant]}
        `}>
          <Icon className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h3>

        {description && (
          <p className="text-sm text-muted-foreground mb-6">
            {description}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={onClose}
            fullWidth
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            fullWidth
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
