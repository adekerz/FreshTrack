import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Check, Calendar, Package, User, Trash2, AlertTriangle, Zap } from 'lucide-react'
import { ButtonLoader } from './ui'
import { useProducts, categories } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useHotel } from '../context/HotelContext'
import { useAddBatch, useDeleteBatch, useDeleteProduct } from '../hooks/useInventory'
import { format, parseISO } from 'date-fns'
import FIFOCollectModal from './FIFOCollectModal'
import { logError } from '../utils/logger'

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
  const { hasPermission, user, isStaff } = useAuth()
  const { selectedHotelId } = useHotel()
  const { getBatchesByProduct } = useProducts()
  const { addToast } = useToast()

  // === REACT QUERY MUTATIONS ===
  const { mutate: addBatchMutation, isPending: isAddingBatch } = useAddBatch(selectedHotelId)
  const { mutate: deleteBatchMutation } = useDeleteBatch(selectedHotelId)
  const { mutate: deleteProductMutation, isPending: isDeletingProduct } = useDeleteProduct(selectedHotelId)

  // Проверка роли STAFF через helper функцию
  const userIsStaff = isStaff()

  const [showAddForm, setShowAddForm] = useState(false)
  const [showFIFOModal, setShowFIFOModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newBatch, setNewBatch] = useState({
    expiryDate: '',
    quantity: '',
    noQuantity: false
  })

  // Получить партии товара (по имени товара и отделу)
  const batches = getBatchesByProduct(product.name, product.departmentId)
  const activeBatches = batches.filter((b) => !b.isCollected)
  const collectedBatches = batches.filter((b) => b.isCollected)

  // Общее количество для FIFO списания (только партии с учётом количества)
  const totalAvailableQuantity = activeBatches.reduce((sum, b) => sum + (b.quantity || 0), 0)

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
  const handleAddBatch = (e) => {
    e.preventDefault()
    if (!newBatch.expiryDate) return
    
    // Защита от старых дат: год должен быть >= 2026
    const year = parseInt(newBatch.expiryDate.split('-')[0], 10)
    if (year < 2026) {
      addToast('Год должен быть 2026 или позже', 'error')
      return
    }
    
    if (!newBatch.noQuantity && (!newBatch.quantity || parseInt(newBatch.quantity) <= 0)) return

    // ✨ React Query mutation with optimistic update
    addBatchMutation(
      {
        productName: product.name,
        department: product.departmentId,
        category: product.categoryId,
        quantity: newBatch.noQuantity ? null : parseInt(newBatch.quantity),
        expiryDate: newBatch.expiryDate
      },
      {
        onSuccess: () => {
          setNewBatch({ expiryDate: '', quantity: '', noQuantity: false })
          setShowAddForm(false)
          addToast(t('toast.batchAdded'), 'success')
          // React Query автоматически обновит список партий
        },
        onError: (error) => {
          logError('Error adding batch:', error)
          addToast(t('toast.batchAddError'), 'error')
        }
      }
    )
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
  const handleDeleteProduct = () => {
    if (!product.id) return

    // ✨ React Query mutation with optimistic update
    deleteProductMutation(product.id, {
      onSuccess: () => {
        addToast(t('toast.productDeleted'), 'success')
        setShowDeleteConfirm(false)
        onClose()
        // React Query автоматически обновит каталог и удалит связанные партии
      },
      onError: (error) => {
        logError('Error deleting product:', error)
        addToast(t('toast.productDeleteError'), 'error')
        setShowDeleteConfirm(false)
      }
    })
  }

  // Если открыт FIFO модал - рендерим только его
  if (showFIFOModal) {
    return (
      <FIFOCollectModal
        isOpen={showFIFOModal}
        product={product}
        batches={activeBatches}
        totalQuantity={totalAvailableQuantity}
        onClose={() => setShowFIFOModal(false)}
        onSuccess={() => {
          setShowFIFOModal(false)
          // React Query автоматически обновит данные через invalidation в FIFOCollectModal
        }}
      />
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-charcoal/50 dark:bg-black/60 flex items-end sm:items-center justify-center z-[55] sm:p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-card rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up relative z-[55]">
        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border sm:pt-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-medium text-foreground truncate">{product.name}</h2>
            <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded mt-1 inline-block">
              {getCategoryName()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* FIFO Quick Collection Button - только если есть партии с количеством */}
            {totalAvailableQuantity > 0 && (
              <button
                onClick={() => setShowFIFOModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors shadow-sm"
                title={t('fifoCollect.title') || 'FIFO Списание'}
              >
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {t('fifoCollect.title') || 'FIFO Списание'}
                </span>
              </button>
            )}
            {canDeleteProduct && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-muted-foreground hover:text-danger transition-colors p-2"
                title={t('product.delete') || 'Удалить товар'}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Контент со скроллом */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Статистика */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-background rounded-lg p-3 sm:p-4 border border-border">
              <div className="text-xl sm:text-2xl font-medium text-foreground">{activeBatches.length}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">{t('product.activeBatches')}</div>
            </div>
            <div className="bg-background rounded-lg p-3 sm:p-4 border border-border">
              <div className="text-xl sm:text-2xl font-medium text-foreground">
                {activeBatches.reduce((sum, b) => sum + b.quantity, 0)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">{t('product.totalUnits')}</div>
            </div>
          </div>

          {/* Список активных партий */}
          {activeBatches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t('product.activeBatches')}
              </h3>
              <div className="space-y-3">
                {activeBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`bg-background rounded-lg p-4 border-l-4 ${statusBorderColors[batch.status.status]} border border-border`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Дата истечения срока */}
                        <div className="flex items-center gap-2 text-foreground mb-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{formatDateDisplay(batch.expiryDate)}</span>
                        </div>

                        {/* Количество */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Package className="w-4 h-4" />
                          <span>
                            {t('product.quantity')}:{' '}
                            <strong className="text-foreground">
                              {batch.quantity === null || batch.quantity === undefined
                                ? t('product.noQuantity') || 'Без учёта'
                                : `${batch.quantity} ${t('inventory.units')}`}
                            </strong>
                          </span>
                        </div>

                        {/* Кто добавил */}
                        {batch.addedBy && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <User className="w-4 h-4" />
                            <span>
                              {t('product.addedBy') || 'Добавил'}:{' '}
                              <strong className="text-foreground">{batch.addedBy}</strong>
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

                      {/* Кнопка удаления - только для админов и менеджеров (не STAFF) */}
                      {!userIsStaff && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // ✨ React Query mutation with optimistic update
                              deleteBatchMutation(batch.id, {
                                onSuccess: () => {
                                  addToast(t('toast.batchDeleted') || 'Партия удалена', 'success')
                                  // React Query автоматически обновит список
                                },
                                onError: (error) => {
                                  addToast(t('toast.batchDeleteError') || 'Ошибка удаления', 'error')
                                }
                              })
                            }}
                            className="p-1.5 text-muted-foreground hover:text-danger transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Собранные партии */}
          {collectedBatches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t('product.collectedBatches')}
              </h3>
              <div className="space-y-2">
                {collectedBatches.slice(0, 5).map((batch) => (
                  <div
                    key={batch.id}
                    className="bg-muted rounded-lg p-3 border border-border opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-success" />
                        <span>{formatDateDisplay(batch.expiryDate)}</span>
                        <span>•</span>
                        <span>
                          {batch.quantity === null
                            ? t('product.noQuantity') || 'Без учёта'
                            : `${batch.quantity} ${t('inventory.units')}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('product.collectedAt')}: {formatDateTime(batch.collectedAt)}
                      </div>
                    </div>
                  </div>
                ))}
                {collectedBatches.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{collectedBatches.length - 5} {t('product.moreBatches')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Пустое состояние */}
          {activeBatches.length === 0 && collectedBatches.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-muted-foreground">{t('product.noBatches')}</p>
              <p className="text-sm text-muted-foreground/70">{t('product.addFirstBatch')}</p>
            </div>
          )}

          {/* Форма добавления партии */}
          {showAddForm && (
            <div className="bg-background rounded-lg p-4 border border-accent mb-4">
              <h4 className="font-medium text-foreground mb-4">{t('product.addNewBatch')}</h4>
              <form onSubmit={handleAddBatch} className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    {t('product.expiryDate')} *
                  </label>
                  <input
                    type="date"
                    value={newBatch.expiryDate}
                    min="2026-01-01"
                    onChange={(e) =>
                      setNewBatch((prev) => ({ ...prev, expiryDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:border-accent bg-card text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    {t('product.quantity')} {!newBatch.noQuantity && '*'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newBatch.quantity}
                    onChange={(e) => setNewBatch((prev) => ({ ...prev, quantity: e.target.value }))}
                    disabled={newBatch.noQuantity}
                    className={`w-full px-3 py-2 border border-border rounded focus:outline-none focus:border-accent transition-colors ${
                      newBatch.noQuantity
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-card text-foreground'
                    }`}
                    required={!newBatch.noQuantity}
                    placeholder={
                      newBatch.noQuantity ? t('batch.noQuantity') || 'Нет количества' : ''
                    }
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
                    <label
                      htmlFor="noQuantityProduct"
                      className="text-sm text-muted-foreground cursor-pointer select-none"
                    >
                      {t('batch.noQuantityLabel') || 'Без учёта количества'}
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="p-4 sm:p-6 border-t border-border bg-muted safe-bottom">
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('product.addBatch')}
            </button>
          )}
        </div>
      </div>

      {/* Модалка подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center animate-danger-pulse">
                <AlertTriangle className="w-7 h-7 text-danger animate-danger-shake" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('product.deleteConfirmTitle') || 'Удалить товар?'}
                </h3>
                <p className="text-sm text-muted-foreground">{product.name}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              {t('product.deleteConfirmMessage') ||
                'Это действие нельзя отменить. Все партии этого товара также будут удалены.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingProduct}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={isDeletingProduct}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                aria-busy={isDeletingProduct}
              >
                {isDeletingProduct ? <ButtonLoader /> : <Trash2 className="w-4 h-4" />}
                {t('common.delete') || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
