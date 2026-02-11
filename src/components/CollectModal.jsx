import { useState, useCallback } from 'react'
import {
  X,
  Package,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  ChefHat,
  Trash2,
  Users,
  RotateCcw
} from 'lucide-react'
import { ButtonLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useProducts } from '../context/ProductContext'
import { useToast } from '../context/ToastContext'
import { logError } from '../utils/logger'

const reasons = [
  { id: 'kitchen', icon: ChefHat, color: 'text-green-600' },
  { id: 'disposed', icon: Trash2, color: 'text-danger' },
  { id: 'staff', icon: Users, color: 'text-accent' },
  { id: 'returned', icon: RotateCcw, color: 'text-purple-500' },
  { id: 'expired', icon: AlertTriangle, color: 'text-warning' },
  { id: 'damaged', icon: Package, color: 'text-yellow-500' },
  { id: 'other', icon: MessageSquare, color: 'text-foreground' }
]

export default function CollectModal({ isOpen, onClose, batch, onConfirm }) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { departments } = useProducts()
  const [reason, setReason] = useState('expired')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const getDepartmentName = useCallback((id) => {
    const dept = departments.find((d) => d.id === id)
    return dept ? dept.name : id
  }, [departments])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    // Защита от множественных кликов
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      await onConfirm({
        batchId: batch.id,
        reason,
        comment: comment.trim() || null
      })

      // Сброс формы
      setReason('expired')
      setComment('')
      addToast(t('toast.batchCollected'), 'success')
      onClose()
    } catch (error) {
      logError('CollectModal.handleSubmit', error)
      addToast(t('toast.batchCollectError'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }, [batch?.id, reason, comment, onConfirm, addToast, t, onClose])

  if (!isOpen || !batch) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal — mobile: slide-up; desktop: centered */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header — sticky on mobile */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0 bg-card">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 bg-warning/10 rounded-lg shrink-0">
                <Package className="w-5 h-5 text-warning" />
              </div>
              <h2 className="text-lg font-semibold text-foreground truncate">
                {t('collect.title') || 'Сбор товара'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] p-2 hover:bg-muted rounded-lg transition-colors touch-manipulation shrink-0"
              aria-label={t('common.close') || 'Закрыть'}
              type="button"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content — scrollable */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
            {/* Информация о товаре */}
            <div className="bg-muted rounded-xl p-4">
              <h3 className="font-medium text-foreground">{batch.productName}</h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>📍 {getDepartmentName(batch.department)}</p>
                <p>
                  📦 {t('common.quantity')}: {batch.quantity} {t('common.units')}
                </p>
                <p>
                  📅 {t('product.expiryDate') || 'Срок годности'}: {batch.expiryDate}
                </p>
                <p
                  className={`font-medium ${batch.status === 'expired'
                      ? 'text-danger'
                      : batch.status === 'critical'
                        ? 'text-warning'
                        : 'text-yellow-600'
                    }`}
                >
                  ⚡ {batch.daysLeft} {t('common.days')}{' '}
                  {batch.daysLeft < 0
                    ? t('collect.overdue') || 'просрочено'
                    : t('collect.left') || 'осталось'}
                </p>
              </div>
            </div>

            {/* Причина сбора */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                {t('collect.reason') || 'Причина сбора'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {reasons.map((r) => {
                  const Icon = r.icon
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReason(r.id)}
                      className={`
                        flex items-center gap-2 p-3 rounded-lg border transition-all
                        ${reason === r.id
                          ? 'border-gold bg-gold/10 ring-2 ring-gold/30'
                          : 'border-border hover:border-gold/50 hover:bg-muted'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 ${r.color}`} />
                      <span className="text-sm text-foreground">
                        {t(`collect.reasons.${r.id}`) || r.id}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('collect.comment') || 'Комментарий'}
                <span className="text-muted-foreground font-normal ml-1">
                  ({t('common.optional') || 'необязательно'})
                </span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  t('collect.commentPlaceholder') || 'Добавьте заметку о причине сбора...'
                }
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none h-24 bg-card text-foreground placeholder-muted-foreground"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-border text-foreground rounded-xl hover:bg-muted transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-warning text-white rounded-xl hover:bg-warning/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <ButtonLoader />
                    {t('common.processing') || 'Обработка...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {t('collect.confirm') || 'Подтвердить сбор'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
