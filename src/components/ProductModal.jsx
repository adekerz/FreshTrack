import { useState } from 'react'
import { X, Plus, Check, Calendar, Package, User, Trash2, AlertTriangle, Zap } from 'lucide-react'
import { useProducts, categories } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { format, parseISO } from 'date-fns'
import CollectModal from './CollectModal'
import FIFOCollectModal from './FIFOCollectModal'

// Цвета статусов для полоски слева
const statusBorderColors = {
  expired: 'border-l-danger',
  today: 'border-l-danger',
  critical: 'border-l-danger',
  warning: 'border-l-warning',
  good: 'border-l-success'
}

export default function ProductModal({ product, onClose }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { hasPermission } = useAuth()
  const { getBatchesByProduct, collectBatch, deleteBatch, addBatch, deleteProduct } = useProducts()
  const { addToast } = useToast()

  const [showAddForm, setShowAddForm] = useState(false)
  const [collectModalOpen, setCollectModalOpen] = useState(false)
  const [batchToCollect, setBatchToCollect] = useState(null)
  const [showFIFOModal, setShowFIFOModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newBatch, setNewBatch] = useState({
    expiryDate: '',
    quantity: '',
    noQuantity: false
  })

  // Получить партии товара (по имени товара и отделу)
  const batches = getBatchesByProduct(product.name, product.departmentId)
  const activeBatches = batches.filter((b) => !b.isCollected)
  const collectedBatches = batches.filter((b) => b.isCollected)

  // Форматирование даты в DD.MM.YYYY
  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return format(parseISO(dateString), 'dd.MM.yyyy')
    } catch {
      return 'Invalid date'
    }
  }

  // Форматирование даты и времени
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A'
    try {
      return format(new Date(isoString), 'dd.MM.yyyy HH:mm')
    } catch {
      return 'Invalid date'
    }
  }

  // Получить название категории
  const getCategoryName = () => {
    const category = categories.find((c) => c.id === product.categoryId)
    if (!category) return ''
    if (language === 'ru') return category.nameRu
    if (language === 'kk') return category.nameKz
    return category.name
  }

  // Обработка добавления партии
  const handleAddBatch = async (e) => {
    e.preventDefault()
    if (!newBatch.expiryDate) return
    if (!newBatch.noQuantity && (!newBatch.quantity || parseInt(newBatch.quantity) <= 0)) return

    try {
      await addBatch(
        product.id || product.name, // productId или имя
        product.departmentId,
        newBatch.expiryDate,
        newBatch.noQuantity ? null : parseInt(newBatch.quantity)
      )

      setNewBatch({ expiryDate: '', quantity: '', noQuantity: false })
      setShowAddForm(false)
      addToast(t('toast.batchAdded'), 'success')
    } catch (error) {
      console.error('Error adding batch:', error)
      addToast(t('toast.batchAddError'), 'error')
    }
  }

  // Закрытие по клику на оверлей
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Проверка прав на удаление (permission-based, не hardcoded roles)
  const canDeleteProduct = hasPermission('products:delete')

  // Удаление товара
  const handleDeleteProduct = async () => {
    if (!product.id) return
    
    setDeleting(true)
    try {
      await deleteProduct(product.id)
      addToast(t('toast.productDeleted'), 'success')
      onClose()
    } catch (error) {
      console.error('Error deleting product:', error)
      addToast(t('toast.productDeleteError'), 'error')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-charcoal/50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-cream dark:bg-dark-surface rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-sand dark:border-dark-border">
          <div>
            <h2 className="font-serif text-2xl text-charcoal dark:text-cream">{product.name}</h2>
            <span className="text-sm text-warmgray bg-sand/50 dark:bg-dark-border px-2 py-0.5 rounded mt-1 inline-block">
              {getCategoryName()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* FIFO Quick Collection Button */}
            {activeBatches.length > 0 && (
              <button
                onClick={() => setShowFIFOModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                title={t('fifoCollect.title') || 'FIFO Списание'}
              >
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">{t('fifoCollect.title') || 'FIFO'}</span>
              </button>
            )}
            {canDeleteProduct && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-warmgray hover:text-danger transition-colors p-2"
                title={t('product.delete') || 'Удалить товар'}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-warmgray hover:text-charcoal dark:hover:text-cream transition-colors p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Контент со скроллом */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Статистика */}
          <div className="flex gap-4 mb-6">
            <div className="bg-white dark:bg-dark-bg rounded-lg p-4 flex-1 border border-sand dark:border-dark-border">
              <div className="text-2xl font-medium text-charcoal dark:text-cream">{activeBatches.length}</div>
              <div className="text-sm text-warmgray">{t('product.activeBatches')}</div>
            </div>
            <div className="bg-white dark:bg-dark-bg rounded-lg p-4 flex-1 border border-sand dark:border-dark-border">
              <div className="text-2xl font-medium text-charcoal dark:text-cream">
                {activeBatches.reduce((sum, b) => sum + b.quantity, 0)}
              </div>
              <div className="text-sm text-warmgray">{t('product.totalUnits')}</div>
            </div>
          </div>

          {/* Список активных партий */}
          {activeBatches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-warmgray mb-3">
                {t('product.activeBatches')}
              </h3>
              <div className="space-y-3">
                {activeBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`bg-white dark:bg-dark-bg rounded-lg p-4 border-l-4 ${statusBorderColors[batch.status.status]} border border-sand dark:border-dark-border`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Дата истечения срока */}
                        <div className="flex items-center gap-2 text-charcoal dark:text-cream mb-1">
                          <Calendar className="w-4 h-4 text-warmgray" />
                          <span className="font-medium">
                            {formatDateDisplay(batch.expiryDate)}
                          </span>
                        </div>

                        {/* Количество */}
                        <div className="flex items-center gap-2 text-sm text-warmgray mb-2">
                          <Package className="w-4 h-4" />
                          <span>
                            {t('product.quantity')}:{' '}
                            <strong className="text-charcoal">
                              {batch.quantity === null || batch.quantity === undefined 
                                ? t('product.noQuantity') || 'Без учёта'
                                : `${batch.quantity} ${t('inventory.units')}`}
                            </strong>
                          </span>
                        </div>

                        {/* Кто добавил */}
                        {batch.addedBy && (
                          <div className="flex items-center gap-2 text-sm text-warmgray mb-2">
                            <User className="w-4 h-4" />
                            <span>
                              {t('product.addedBy') || 'Добавил'}:{' '}
                              <strong className="text-charcoal dark:text-cream">{batch.addedBy}</strong>
                            </span>
                          </div>
                        )}

                        {/* Статус */}
                        <div
                          className={`mt-2 text-xs font-medium ${
                            batch.status.status === 'expired' ||
                            batch.status.status === 'critical' ||
                            batch.status.status === 'today'
                              ? 'text-danger'
                              : batch.status.status === 'warning' ||
                                  batch.status.status === 'attention'
                                ? 'text-warning'
                                : 'text-success'
                          }`}
                        >
                          {batch.daysLeft < 0
                            ? t('status.expiredDaysAgo', { days: Math.abs(batch.daysLeft) })
                            : batch.daysLeft === 0
                              ? t('status.expiresToday')
                              : t('status.expiresInDays', { days: batch.daysLeft })}
                        </div>
                      </div>

                      {/* Кнопки действий */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setBatchToCollect(batch)
                            setCollectModalOpen(true)
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-success text-success rounded hover:bg-success hover:text-white transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          {t('product.collect')}
                        </button>
                        <button
                          onClick={() => deleteBatch(batch.id)}
                          className="p-1.5 text-warmgray hover:text-danger transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Собранные партии */}
          {collectedBatches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-warmgray mb-3">
                {t('product.collectedBatches')}
              </h3>
              <div className="space-y-2">
                {collectedBatches.slice(0, 5).map((batch) => (
                  <div
                    key={batch.id}
                    className="bg-sand/30 dark:bg-dark-border/30 rounded-lg p-3 border border-sand/50 dark:border-dark-border opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-warmgray">
                        <Check className="w-4 h-4 text-success" />
                        <span>
                          {formatDateDisplay(batch.expiryDate)}
                        </span>
                        <span>•</span>
                        <span>
                          {batch.quantity === null ? t('product.noQuantity') || 'Без учёта' : `${batch.quantity} ${t('inventory.units')}`}
                        </span>
                      </div>
                      <div className="text-xs text-warmgray">
                        {t('product.collectedAt')}: {formatDateTime(batch.collectedAt)}
                      </div>
                    </div>
                  </div>
                ))}
                {collectedBatches.length > 5 && (
                  <p className="text-xs text-warmgray text-center">
                    +{collectedBatches.length - 5} {t('product.moreBatches')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Пустое состояние */}
          {activeBatches.length === 0 && collectedBatches.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-sand mx-auto mb-3" />
              <p className="text-warmgray">{t('product.noBatches')}</p>
              <p className="text-sm text-warmgray/70">{t('product.addFirstBatch')}</p>
            </div>
          )}

          {/* Форма добавления партии */}
          {showAddForm && (
            <div className="bg-white dark:bg-dark-bg rounded-lg p-4 border border-accent mb-4">
              <h4 className="font-medium text-charcoal dark:text-cream mb-4">{t('product.addNewBatch')}</h4>
              <form onSubmit={handleAddBatch} className="space-y-4">
                <div>
                  <label className="block text-sm text-warmgray mb-1">
                    {t('product.expiryDate')} *
                  </label>
                  <input
                    type="date"
                    value={newBatch.expiryDate}
                    onChange={(e) =>
                      setNewBatch((prev) => ({ ...prev, expiryDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-sand dark:border-dark-border rounded focus:outline-none focus:border-accent bg-white dark:bg-dark-surface dark:text-cream"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-warmgray mb-1">
                    {t('product.quantity')} {!newBatch.noQuantity && '*'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newBatch.quantity}
                    onChange={(e) =>
                      setNewBatch((prev) => ({ ...prev, quantity: e.target.value }))
                    }
                    disabled={newBatch.noQuantity}
                    className={`w-full px-3 py-2 border border-sand rounded focus:outline-none focus:border-accent transition-colors ${
                      newBatch.noQuantity ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                    }`}
                    required={!newBatch.noQuantity}
                    placeholder={newBatch.noQuantity ? t('batch.noQuantity') || 'Нет количества' : ''}
                  />
                  
                  {/* Переключатель "Нет количества" */}
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="checkbox"
                      id="noQuantityProduct"
                      checked={newBatch.noQuantity}
                      onChange={(e) =>
                        setNewBatch((prev) => ({ 
                          ...prev, 
                          noQuantity: e.target.checked,
                          quantity: e.target.checked ? '' : prev.quantity
                        }))
                      }
                      className="quantity-toggle"
                    />
                    <label htmlFor="noQuantityProduct" className="text-sm text-warmgray cursor-pointer select-none">
                      {t('batch.noQuantityLabel') || 'Без учёта количества'}
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-sm text-warmgray hover:text-charcoal dark:hover:text-cream transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                  >
                    {t('common.add')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="p-6 border-t border-sand dark:border-dark-border bg-sand/30 dark:bg-dark-border/30">
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('product.addBatch')}
            </button>
          )}
        </div>
      </div>

      {/* Модалка сбора */}
      <CollectModal
        isOpen={collectModalOpen}
        batch={batchToCollect}
        onClose={() => {
          setCollectModalOpen(false)
          setBatchToCollect(null)
        }}
        onConfirm={async ({ batchId, reason, comment }) => {
          await collectBatch(batchId, reason, comment)
          setCollectModalOpen(false)
          setBatchToCollect(null)
        }}
      />

      {/* FIFO Collection Modal */}
      <FIFOCollectModal
        isOpen={showFIFOModal}
        product={{
          id: product.id,
          name: product.name,
          totalQuantity: activeBatches.reduce((sum, b) => sum + (b.quantity || 0), 0)
        }}
        onClose={() => setShowFIFOModal(false)}
        onSuccess={() => {
          setShowFIFOModal(false)
          // Refresh will happen via ProductContext
        }}
      />

      {/* Модалка подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-charcoal/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-danger" />
              </div>
              <div>
                <h3 className="font-semibold text-charcoal">
                  {t('product.deleteConfirmTitle') || 'Удалить товар?'}
                </h3>
                <p className="text-sm text-warmgray">
                  {product.name}
                </p>
              </div>
            </div>
            
            <p className="text-sm text-warmgray mb-6">
              {t('product.deleteConfirmMessage') || 'Это действие нельзя отменить. Все партии этого товара также будут удалены.'}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-sand rounded-lg text-charcoal hover:bg-sand/50 transition-colors disabled:opacity-50"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {t('common.delete') || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
