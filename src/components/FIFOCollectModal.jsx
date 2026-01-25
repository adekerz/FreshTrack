/**
 * FreshTrack FIFO Collection Modal
 * Позволяет списывать продукты по количеству с автоматическим FIFO
 *
 * Backend API:
 * - GET /api/fifo-collect/preview - Предпросмотр затрагиваемых партий
 * - POST /api/fifo-collect/collect - Выполнить списание
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Package,
  Minus,
  Plus,
  AlertTriangle,
  CheckCircle,
  ChefHat,
  Trash2,
  Users,
  RotateCcw,
  Clock,
  Zap,
  Calendar
} from 'lucide-react'
import { ButtonLoader, InlineLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiFetch } from '../services/api'
import { logError } from '../utils/logger'

// Причины списания (соответствуют backend CollectionReason)
const REASONS = [
  { id: 'expired', icon: Clock, color: 'text-danger' },
  { id: 'kitchen', icon: ChefHat, color: 'text-green-600' },
  { id: 'damaged', icon: Trash2, color: 'text-orange-500' },
  { id: 'return', icon: RotateCcw, color: 'text-accent' },
  { id: 'compliment', icon: Users, color: 'text-purple-500' },
  { id: 'other', icon: AlertTriangle, color: 'text-foreground' }
]

// Быстрые кнопки количества
const QUICK_AMOUNTS = [1, 5, 10, 25]

export default function FIFOCollectModal({
  isOpen,
  onClose,
  product, // { id, name, totalQuantity }
  onSuccess
}) {
  const { t } = useTranslation()
  const { addToast } = useToast()

  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('consumption')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Загрузить preview при изменении количества
  const fetchPreview = useCallback(async () => {
    if (!product?.id || quantity <= 0) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await apiFetch(
        `/fifo-collect/preview?productId=${product.id}&quantity=${quantity}`
      )
      setPreview(data)
    } catch (err) {
      logError('Preview fetch error:', err)
      setError(err.message)
      setPreview(null)
    } finally {
      setIsLoading(false)
    }
  }, [product?.id, quantity])

  useEffect(() => {
    if (isOpen && product?.id && quantity > 0) {
      const timer = setTimeout(fetchPreview, 300) // Debounce
      return () => clearTimeout(timer)
    }
  }, [isOpen, product?.id, quantity, fetchPreview])

  // Сброс при открытии
  useEffect(() => {
    if (isOpen) {
      setQuantity(1)
      setReason('consumption')
      setNotes('')
      setPreview(null)
      setError(null)
    }
  }, [isOpen])

  if (!isOpen || !product) return null

  const maxQuantity = product.totalQuantity || preview?.totalAvailable || 999
  const isValidQuantity = quantity > 0 && quantity <= maxQuantity

  const handleQuantityChange = (delta) => {
    const newQty = Math.max(1, Math.min(maxQuantity, quantity + delta))
    setQuantity(newQty)
  }

  const handleQuickAmount = (amount) => {
    const newQty = Math.min(maxQuantity, amount)
    setQuantity(newQty)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await apiFetch('/fifo-collect/collect', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          quantity,
          reason,
          notes: notes.trim() || undefined
        })
      })

      addToast(
        t('fifoCollect.success', { count: result.totalCollected || quantity }) ||
          `Успешно списано ${result.totalCollected || quantity} шт.`,
        'success'
      )

      onSuccess?.(result)
      onClose()
    } catch (err) {
      logError('Collection error:', err)
      setError(err.message)
      addToast(t('fifoCollect.error') || 'Ошибка при списании', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        <div className="relative bg-card rounded-t-2xl sm:rounded-2xl shadow-elevated w-full sm:max-w-md max-h-[90vh] flex flex-col animate-slide-up">
          {/* Drag handle for mobile */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border sm:pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold/10 rounded-lg">
                <Zap className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t('fifoCollect.title') || 'FIFO Списание'}
                </h2>
                <p className="text-sm text-muted-foreground">{product.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] p-2 hover:bg-muted rounded-lg transition-colors touch-manipulation"
              aria-label={t('common.close') || 'Закрыть'}
              type="button"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 overscroll-contain">
            {/* Информация о наличии */}
            <div className="bg-muted rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  {t('fifoCollect.inStock') || 'На складе'}:
                </span>
                <span className="font-semibold text-foreground">
                  {maxQuantity} {t('common.units') || 'шт.'}
                </span>
              </div>
            </div>

            {/* Быстрый выбор количества */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                <Zap className="w-4 h-4 inline mr-1 text-gold" />
                {t('fifoCollect.quickActions') || 'Быстрое списание'}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleQuickAmount(amount)}
                    disabled={amount > maxQuantity}
                    className={`
                      py-2 px-3 rounded-lg border transition-all text-sm font-medium
                      ${
                        quantity === amount
                          ? 'border-gold bg-gold/10 ring-2 ring-gold/30 text-foreground'
                          : 'border-border hover:border-gold/50 hover:bg-muted text-foreground'
                      }
                      ${amount > maxQuantity ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Количество */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                {t('fifoCollect.quantity') || 'Количество'}
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="w-12 h-12 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <Minus className="w-5 h-5 text-foreground" />
                </button>

                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))
                  }
                  className="w-24 text-center text-2xl font-bold border border-border rounded-lg py-2 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={1}
                  max={maxQuantity}
                />

                <button
                  type="button"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= maxQuantity}
                  className="w-12 h-12 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-5 h-5 text-foreground" />
                </button>
              </div>
            </div>

            {/* Причина списания */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                {t('fifoCollect.reason') || 'Причина списания'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {REASONS.map(({ id, icon: Icon, color }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setReason(id)}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg border transition-all
                      ${
                        reason === id
                          ? 'border-gold bg-gold/10 ring-2 ring-gold/30'
                          : 'border-border hover:border-gold/50 hover:bg-muted'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm text-foreground">
                      {t(`fifoCollect.reasons.${id}`) || id}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('fifoCollect.notes') || 'Комментарий'}
                <span className="text-muted-foreground font-normal ml-1">
                  ({t('common.optional') || 'необязательно'})
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('fifoCollect.notesPlaceholder') || 'Дополнительная информация...'}
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none h-20 bg-card text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* FIFO Preview */}
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <InlineLoader />
                <span className="ml-2">{t('common.loading') || 'Загрузка...'}</span>
              </div>
            ) : preview?.affectedBatches?.length > 0 ? (
              <div className="bg-muted rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {t('fifoCollect.preview') || 'Будет списано из партий (FIFO)'}:
                </div>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {preview.affectedBatches.map((batch, idx) => (
                    <div
                      key={batch.batchId || idx}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '—'}
                      </span>
                      <span className="font-medium text-warning">
                        -{batch.collectQuantity || batch.toCollect || 0}{' '}
                        {t('common.units') || 'шт.'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Ошибка */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-danger/10 text-danger rounded-lg text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </form>

          {/* Footer - Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 p-4 sm:p-6 border-t border-border safe-bottom">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 min-h-[48px] border border-border text-foreground rounded-xl hover:bg-muted transition-colors active:scale-[0.98]"
            >
              {t('common.cancel') || 'Отмена'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !isValidQuantity}
              className="flex-1 px-4 py-3 min-h-[48px] bg-warning text-white rounded-xl hover:bg-warning/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ButtonLoader />
                  <span className="hidden sm:inline">{t('common.processing') || 'Обработка...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {t('fifoCollect.submit') || 'Списать'} {quantity} {t('common.units') || 'шт.'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
