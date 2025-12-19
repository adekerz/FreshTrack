import { useState } from 'react'
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
import { useTranslation } from '../context/LanguageContext'
import { departments } from '../context/ProductContext'

const reasons = [
  { id: 'kitchen', icon: ChefHat, color: 'text-green-600' },
  { id: 'disposed', icon: Trash2, color: 'text-danger' },
  { id: 'staff', icon: Users, color: 'text-blue-500' },
  { id: 'returned', icon: RotateCcw, color: 'text-purple-500' },
  { id: 'expired', icon: AlertTriangle, color: 'text-warning' },
  { id: 'damaged', icon: Package, color: 'text-yellow-500' },
  { id: 'other', icon: MessageSquare, color: 'text-charcoal' }
]

export default function CollectModal({ isOpen, onClose, batch, onConfirm }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('expired')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !batch) return null

  const getDepartmentName = (id) => {
    const dept = departments.find((d) => d.id === id)
    return dept ? dept.name : id
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
      onClose()
    } catch (error) {
      console.error('Error collecting batch:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-md transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-taupe/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Package className="w-5 h-5 text-warning" />
              </div>
              <h2 className="text-lg font-semibold text-charcoal">
                {t('collect.title') || 'Сбор товара'}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-sand rounded-lg transition-colors">
              <X className="w-5 h-5 text-charcoal/60" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Информация о товаре */}
            <div className="bg-sand/30 rounded-xl p-4">
              <h3 className="font-medium text-charcoal">{batch.productName}</h3>
              <div className="mt-2 space-y-1 text-sm text-charcoal/70">
                <p>📍 {getDepartmentName(batch.department)}</p>
                <p>
                  📦 {t('common.quantity')}: {batch.quantity} {t('common.units')}
                </p>
                <p>
                  📅 {t('product.expiryDate') || 'Срок годности'}: {batch.expiryDate}
                </p>
                <p
                  className={`font-medium ${
                    batch.status === 'expired'
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
              <label className="block text-sm font-medium text-charcoal mb-3">
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
                        ${
                          reason === r.id
                            ? 'border-gold bg-gold/10 ring-2 ring-gold/30'
                            : 'border-taupe/20 hover:border-gold/50 hover:bg-sand/30'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 ${r.color}`} />
                      <span className="text-sm text-charcoal">
                        {t(`collect.reasons.${r.id}`) || r.id}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {t('collect.comment') || 'Комментарий'}
                <span className="text-charcoal/40 font-normal ml-1">
                  ({t('common.optional') || 'необязательно'})
                </span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  t('collect.commentPlaceholder') || 'Добавьте заметку о причине сбора...'
                }
                className="w-full px-4 py-3 border border-taupe/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none h-24"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-taupe/30 text-charcoal rounded-xl hover:bg-sand/50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-warning text-white rounded-xl hover:bg-warning/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
