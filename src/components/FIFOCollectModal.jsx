/**
 * FreshTrack FIFO Collection Modal
 * Позволяет списывать продукты по количеству с автоматическим FIFO
 * 
 * Backend API:
 * - GET /api/fifo-collect/preview - Предпросмотр затрагиваемых партий
 * - POST /api/fifo-collect/collect - Выполнить списание
 */

import { useState, useEffect, useCallback } from 'react'
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
  Loader2,
  Zap
} from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiFetch } from '../services/api'
import { logError } from '../utils/logger'

// Причины списания (соответствуют backend CollectionReason)
const REASONS = [
  { id: 'consumption', icon: ChefHat, color: 'text-green-600' },
  { id: 'minibar', icon: Package, color: 'text-blue-500' },
  { id: 'sale', icon: Users, color: 'text-purple-500' },
  { id: 'damaged', icon: Trash2, color: 'text-danger' },
  { id: 'other', icon: RotateCcw, color: 'text-charcoal' }
]

// Быстрые кнопки количества
const QUICK_AMOUNTS = [1, 5, 10, 25]

export default function FIFOCollectModal({ 
  isOpen, 
  onClose, 
  product,  // { id, name, totalQuantity }
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
      const data = await apiFetch(`/fifo-collect/preview?productId=${product.id}&quantity=${quantity}`)
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

  const handleQuantityChange = (delta) => {
    const newQty = Math.max(1, Math.min(product.totalQuantity || 999, quantity + delta))
    setQuantity(newQty)
  }

  const handleQuickAmount = (amount) => {
    const newQty = Math.min(product.totalQuantity || 999, amount)
    setQuantity(newQty)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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

  const maxQuantity = product.totalQuantity || preview?.totalAvailable || 999
  const isValidQuantity = quantity > 0 && quantity <= maxQuantity

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-charcoal/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-dark-surface rounded-2xl shadow-elevated w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-taupe/10 dark:border-dark-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-charcoal dark:text-cream">
                  {t('fifoCollect.title') || 'FIFO Списание'}
                </h2>
                <p className="text-sm text-charcoal/60 dark:text-cream/60">
                  {product.name}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-sand dark:hover:bg-dark-border rounded-lg transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5 text-charcoal/60 dark:text-cream/60" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Информация о наличии */}
            <div className="flex items-center justify-between p-4 bg-sand/30 dark:bg-dark-border/50 rounded-xl">
              <span className="text-sm text-charcoal/70 dark:text-cream/70">
                {t('fifoCollect.inStock') || 'На складе'}:
              </span>
              <span className="font-semibold text-charcoal dark:text-cream">
                {maxQuantity} {t('common.units') || 'шт.'}
              </span>
            </div>

            {/* Quick Actions */}
            <div>
              <label className="block text-sm font-medium text-charcoal dark:text-cream mb-3">
                <Zap className="w-4 h-4 inline mr-1" />
                {t('fifoCollect.quickActions') || 'Быстрое списание'}
              </label>
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleQuickAmount(amount)}
                    disabled={amount > maxQuantity}
                    className={`
                      flex-1 py-3 px-4 rounded-xl font-medium transition-all
                      ${quantity === amount 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'bg-sand dark:bg-dark-border text-charcoal dark:text-cream hover:bg-primary/10'}
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
              <label className="block text-sm font-medium text-charcoal dark:text-cream mb-3">
                {t('fifoCollect.quantity') || 'Количество'}
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="w-12 h-12 rounded-xl border-2 border-taupe/20 dark:border-dark-border flex items-center justify-center hover:bg-sand dark:hover:bg-dark-border disabled:opacity-50 transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
                
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
                  className="w-28 text-center text-2xl font-bold border-2 border-taupe/20 dark:border-dark-border rounded-xl py-3 bg-transparent focus:border-primary focus:outline-none"
                  min={1}
                  max={maxQuantity}
                />
                
                <button
                  type="button"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= maxQuantity}
                  className="w-12 h-12 rounded-xl border-2 border-taupe/20 dark:border-dark-border flex items-center justify-center hover:bg-sand dark:hover:bg-dark-border disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Причина */}
            <div>
              <label className="block text-sm font-medium text-charcoal dark:text-cream mb-3">
                {t('fifoCollect.reason') || 'Причина списания'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {REASONS.map(({ id, icon: Icon, color }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setReason(id)}
                    className={`
                      flex items-center gap-2 p-3 rounded-xl border-2 transition-all
                      ${reason === id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-taupe/20 dark:border-dark-border hover:border-primary/50'}
                    `}
                  >
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm font-medium">
                      {t(`fifoCollect.reasons.${id}`) || id}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Комментарий */}
            <div>
              <label className="block text-sm font-medium text-charcoal dark:text-cream mb-2">
                {t('fifoCollect.notes') || 'Комментарий'} 
                <span className="text-charcoal/50 dark:text-cream/50 font-normal ml-1">
                  ({t('common.optional') || 'необязательно'})
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border-2 border-taupe/20 dark:border-dark-border rounded-xl p-3 text-sm bg-transparent focus:border-primary focus:outline-none resize-none"
                rows={2}
                placeholder={t('fifoCollect.notesPlaceholder') || 'Дополнительная информация...'}
              />
            </div>

            {/* FIFO Preview */}
            {isLoading ? (
              <div className="flex items-center justify-center py-4 text-charcoal/60 dark:text-cream/60">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t('common.loading') || 'Загрузка...'}
              </div>
            ) : preview?.affectedBatches?.length > 0 ? (
              <div className="border-t border-taupe/10 dark:border-dark-border pt-4">
                <div className="flex items-center gap-2 mb-3 text-sm text-charcoal/70 dark:text-cream/70">
                  <Clock className="w-4 h-4" />
                  {t('fifoCollect.preview') || 'Будет списано из партий (FIFO)'}:
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {preview.affectedBatches.map((batch, idx) => (
                    <div 
                      key={batch.batchId || idx}
                      className="flex justify-between items-center text-sm p-2 bg-sand/30 dark:bg-dark-border/50 rounded-lg"
                    >
                      <span className="text-charcoal/70 dark:text-cream/70">
                        {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : '—'}
                      </span>
                      <span className="font-medium text-primary">
                        -{batch.toCollect || batch.quantityToCollect} {t('common.units') || 'шт.'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Ошибка */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-danger/10 text-danger rounded-xl text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-taupe/10 dark:border-dark-border bg-sand/30 dark:bg-dark-border/30 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border-2 border-taupe/20 dark:border-dark-border rounded-xl font-medium hover:bg-sand dark:hover:bg-dark-border transition-colors"
            >
              {t('common.cancel') || 'Отмена'}
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || !isValidQuantity}
              className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {t('fifoCollect.submit') || 'Списать'} {quantity} {t('common.units') || 'шт.'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
