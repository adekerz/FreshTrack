import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Check, Calendar, Package, User, Trash2, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { TouchButton, Switch } from './ui'
import Tooltip from './Tooltip'
import { useProducts, categories } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useHotel } from '../context/HotelContext'
import { useAddBatch, useDeleteBatch, useDeleteProduct } from '../hooks/useInventory'
import { format, parseISO } from 'date-fns'
import FIFOCollectModal from './FIFOCollectModal'
import { formatDate } from '../utils/dateUtils'
import { logError } from '../utils/logger'

// Цвета статусов для полоски слева (просрочка=red, критическое=orange, предупреждение=yellow, норма=green)
const statusBorderColors = {
  expired: 'border-l-danger',
  today: 'border-l-critical',
  critical: 'border-l-critical',
  warning: 'border-l-warning',
  good: 'border-l-success'
}

// Helper for DD.MM.YYYY input masking
const autoFormatDateInput = (value) => {
  // Remove non-digits
  const digits = value.replace(/\D/g, '')
  // Limit to 8 digits (DDMMYYYY)
  const truncated = digits.slice(0, 8)

  let formatted = ''
  for (let i = 0; i < truncated.length; i++) {
    if (i === 2 || i === 4) {
      formatted += '.'
    }
    formatted += truncated[i]
  }
  return formatted
}

// Helper to parse DD.MM.YYYY to YYYY-MM-DD
const parseExpiryInput = (input) => {
  if (!input) return null

  // Clean input
  const cleaned = input.replace(/[^\d./-]/g, '')

  // Match DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY
  const match = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)

  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10)
    const year = parseInt(match[3], 10)

    // Basic validation
    if (month < 1 || month > 12) return null
    // Check days in month
    const daysInMonth = new Date(year, month, 0).getDate()
    if (day < 1 || day > daysInMonth) return null

    // Check year range (reasonable bounds)
    if (year < 2000 || year > 2100) return null

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return null
}

export default function ProductModal({ product, onClose }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { hasPermission, isStaff } = useAuth()
  const { selectedHotelId } = useHotel()
  const { getBatchesByProduct, refresh } = useProducts()
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
  const [expandedExpiry, setExpandedExpiry] = useState(() => new Set())
  const addFormRef = useRef(null)

  const toggleExpiry = (key) => {
    setExpandedExpiry((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const [newBatch, setNewBatch] = useState({
    expiryDate: '',
    expiryInputValue: '',
    quantity: '',
    noQuantity: false
  })

  // Прокрутка к форме «Добавить новую партию» при открытии
  useEffect(() => {
    if (showAddForm && addFormRef.current) {
      addFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [showAddForm])

  // Получить партии товара (по имени товара и отделу)
  const batches = getBatchesByProduct(product.name, product.departmentId)
  const activeBatches = batches.filter((b) => !b.isCollected)
  const collectedBatches = batches.filter((b) => b.isCollected)

  // Общее количество для FIFO (партии с учётом количества + без учёта считаем как 1 ед.)
  const totalAvailableQuantity = activeBatches.reduce(
    (sum, b) => sum + (b.quantity != null ? b.quantity : 1),
    0
  )

  // Форматирование даты в DD.MM.YYYY
  const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return format(parseISO(dateString), 'dd.MM.yyyy')
    } catch {
      return 'Invalid date'
    }
  }

  // Форматирование даты/времени добавления


  // Группировка активных партий по сроку годности (один срок — несколько партий)
  const activeBatchesByExpiry = activeBatches.reduce((acc, batch) => {
    const key = batch.expiryDate || batch.expiry_date || ''
    if (!acc[key]) acc[key] = []
    acc[key].push(batch)
    return acc
  }, {})
  const sortedExpiryKeys = Object.keys(activeBatchesByExpiry).sort()

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
    // Защита от множественных кликов
    if (isAddingBatch) return
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
          setNewBatch({ expiryDate: '', expiryInputValue: '', quantity: '', noQuantity: false })
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
          refresh()
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
            {/* FIFO Quick Collection Button — если есть активные партии (с количеством или без) */}
            {totalAvailableQuantity > 0 && (
              <TouchButton
                variant="primary"
                size="small"
                onClick={() => setShowFIFOModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-warning text-white hover:bg-warning/90 shadow-sm"
                title={t('fifoCollect.title') || 'FIFO Списание'}
                icon={Zap}
                iconPosition="left"
              >
                <span className="hidden sm:inline">
                  {t('fifoCollect.title') || 'FIFO Списание'}
                </span>
              </TouchButton>
            )}
            {canDeleteProduct && (
              <Tooltip content={t('product.delete') || 'Удалить товар'}>
                <span className="inline-flex">
                  <TouchButton
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-muted-foreground hover:text-danger p-2 min-w-0 min-h-0"
                    aria-label={t('product.delete') || 'Удалить товар'}
                    icon={Trash2}
                  />
                </span>
              </Tooltip>
            )}
            <Tooltip content={t('common.close') || 'Закрыть'}>
              <span className="inline-flex">
                <TouchButton
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground p-2 min-w-0 min-h-0"
                  aria-label={t('common.close') || 'Закрыть'}
                  icon={X}
                />
              </span>
            </Tooltip>
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
                {activeBatches.reduce(
                  (sum, b) => sum + (b.quantity != null ? b.quantity : 1),
                  0
                )}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">{t('product.totalUnits')}</div>
            </div>
          </div>

          {/* Список активных партий: по сроку годности, сводка + развертываемый список */}
          {activeBatches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t('product.activeBatches')}
              </h3>
              <div className="space-y-4">
                {sortedExpiryKeys.map((expiryKey) => {
                  const group = activeBatchesByExpiry[expiryKey]
                  const first = group[0]
                  const totalQty = group.reduce(
                    (s, b) => s + (b.quantity != null ? b.quantity : 1),
                    0
                  )
                  const isMulti = group.length > 1
                  const isExpanded = expandedExpiry.has(expiryKey)
                  // По умолчанию показываем детали только если одна партия, или если развернуто
                  const showDetails = group.length === 1 || isExpanded
                  const statusCls = statusBorderColors[first.status?.status] || 'border-l-muted'
                  return (
                    <div
                      key={expiryKey}
                      className={`bg-background rounded-lg border-l-4 ${statusCls} border border-border overflow-hidden`}
                    >
                      <div className="p-3">
                        {/* Строка 1: дата срока */}
                        <div className="text-base font-medium text-foreground">
                          {formatDateDisplay(expiryKey)}
                        </div>
                        {/* Строка 2: N партия, X шт. */}
                        <div className="text-sm text-muted-foreground mt-1">
                          {group.length}{' '}
                          {group.length === 1
                            ? t('product.batchOne') || 'партия'
                            : t('product.batchesCount') || 'партий'}
                          , {totalQty} {t('inventory.units')}
                        </div>

                        {/* Кнопка развернуть/свернуть - ПЕРЕД деталями */}
                        {isMulti && (
                          <button
                            type="button"
                            onClick={() => toggleExpiry(expiryKey)}
                            className="mt-2 flex items-center gap-1 text-sm text-accent hover:underline"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                {t('product.collapse') || 'Свернуть'}
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                {t('product.expandDetails') || 'Показать детали партий'}
                              </>
                            )}
                          </button>
                        )}

                        {/* Развертываемый блок: по каждой партии — Добавлено / кол-во / кто */}
                        {showDetails && (
                          <div className={`${isMulti ? 'mt-3 pt-3 border-t border-border' : 'mt-3'} space-y-3`}>
                            {group.map((batch, idx) => (
                              <div
                                key={batch.id}
                                className={`flex items-start justify-between gap-2 ${isMulti ? 'pl-3 border-l-2 border-muted' : ''
                                  }`}
                              >
                                <div className="flex-1 min-w-0">
                                  {/* Номер партии - только если несколько */}
                                  {isMulti && (
                                    <div className="text-xs font-medium text-accent mb-1">
                                      {t('product.batchNumber', { num: idx + 1 }) || `${idx + 1} партия`}
                                    </div>
                                  )}
                                  {/* Количество */}
                                  <div className="text-sm text-foreground">
                                    {batch.quantity === null || batch.quantity === undefined
                                      ? t('product.noQuantity') || 'Без учёта'
                                      : `${batch.quantity} ${t('inventory.units')}`}
                                  </div>
                                  {/* Дата добавления */}
                                  <div className="text-sm text-muted-foreground mt-0.5">
                                    {t('product.addedAt') || 'Добавлено'}:{' '}
                                    {formatDate(batch.created_at || batch.createdAt, true)}
                                  </div>
                                  {/* Кем добавлено */}
                                  {batch.addedBy && (
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                                      <User className="w-3.5 h-3.5 flex-shrink-0" />
                                      {batch.addedBy}
                                    </div>
                                  )}
                                </div>
                                {!userIsStaff && (
                                  <TouchButton
                                    variant="ghost"
                                    size="small"
                                    onClick={() => {
                                      deleteBatchMutation(batch.id, {
                                        onSuccess: () => {
                                          addToast(t('toast.batchDeleted') || 'Партия удалена', 'success')
                                          refresh()
                                        },
                                        onError: () => {
                                          addToast(t('toast.batchDeleteError') || 'Ошибка удаления', 'error')
                                        }
                                      })
                                    }}
                                    className="p-1.5 min-w-0 min-h-0 text-muted-foreground hover:text-danger flex-shrink-0"
                                    title={t('common.delete')}
                                    icon={Trash2}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Одна строка внизу: Истекает через N дн. */}
                        <div
                          className={`mt-2 text-xs font-medium ${first.status?.status === 'expired' ||
                            first.status?.status === 'critical' ||
                            first.status?.status === 'today'
                            ? 'text-danger'
                            : first.status?.status === 'warning' ||
                              first.status?.status === 'attention'
                              ? 'text-warning'
                              : 'text-success'
                            }`}
                        >
                          {first.daysLeft < 0
                            ? t('status.expiredDaysAgo', { days: Math.abs(first.daysLeft) })
                            : first.daysLeft === 0
                              ? t('status.expiresToday')
                              : t('status.expiresInDays', { days: first.daysLeft })}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
                        {t('product.collectedAt')}: {formatDate(batch.collectedAt, true)}
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
            <div ref={addFormRef} className="bg-background rounded-lg p-4 border border-accent mb-4">
              <h4 className="font-medium text-foreground mb-4">{t('product.addNewBatch')}</h4>
              <form onSubmit={handleAddBatch} className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    {t('product.expiryDate')} *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="ДД.ММ.ГГГГ"
                      value={newBatch.expiryInputValue || ''}
                      onChange={(e) => {
                        const formatted = autoFormatDateInput(e.target.value)
                        const parsed = parseExpiryInput(formatted)

                        setNewBatch((prev) => ({
                          ...prev,
                          expiryInputValue: formatted,
                          expiryDate: parsed || ''
                        }))
                      }}
                      onBlur={(e) => {
                        const parsed = parseExpiryInput(e.target.value)
                        if (parsed) {
                          setNewBatch((prev) => ({ ...prev, expiryDate: parsed }))
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded focus:outline-none focus:border-accent bg-card text-foreground ${newBatch.expiryInputValue && !newBatch.expiryDate
                        ? 'border-danger focus:border-danger'
                        : 'border-border'
                        }`}
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
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
                    className={`w-full px-3 py-2 border border-border rounded focus:outline-none focus:border-accent transition-colors ${newBatch.noQuantity
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-card text-foreground'
                      }`}
                    required={!newBatch.noQuantity}
                    placeholder={
                      newBatch.noQuantity ? t('batch.noQuantity') || 'Нет количества' : ''
                    }
                  />

                  {/* Переключатель "Нет количества" */}
                  <div
                    className="flex items-center gap-3 mt-2 cursor-pointer"
                    onClick={() =>
                      setNewBatch((prev) => ({
                        ...prev,
                        noQuantity: !prev.noQuantity,
                        quantity: prev.noQuantity ? prev.quantity : ''
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setNewBatch((prev) => ({
                          ...prev,
                          noQuantity: !prev.noQuantity,
                          quantity: prev.noQuantity ? prev.quantity : ''
                        }))
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <Switch
                      checked={newBatch.noQuantity}
                      onChange={(v) =>
                        setNewBatch((prev) => ({
                          ...prev,
                          noQuantity: v,
                          quantity: v ? '' : prev.quantity
                        }))
                      }
                      aria-label={t('batch.noQuantityLabel') || 'Без учёта количества'}
                    />
                    <span className="text-sm text-muted-foreground select-none">
                      {t('batch.noQuantityLabel') || 'Без учёта количества'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <TouchButton
                    type="button"
                    variant="ghost"
                    size="small"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t('common.cancel')}
                  </TouchButton>
                  <TouchButton
                    type="submit"
                    variant="primary"
                    size="small"
                    disabled={isAddingBatch}
                    loading={isAddingBatch}
                    className="px-4 py-2 text-sm"
                  >
                    {t('common.add')}
                  </TouchButton>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="p-4 sm:p-6 border-t border-border bg-muted safe-bottom">
          {!showAddForm && (
            <TouchButton
              variant="primary"
              fullWidth
              onClick={() => setShowAddForm(true)}
              className="bg-accent-button text-white hover:bg-accent-button/90 shadow-md"
              icon={Plus}
              iconPosition="left"
            >
              {t('product.addBatch')}
            </TouchButton>
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
              <TouchButton
                variant="secondary"
                fullWidth
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingProduct}
              >
                {t('common.cancel') || 'Отмена'}
              </TouchButton>
              <TouchButton
                variant="danger"
                fullWidth
                onClick={handleDeleteProduct}
                disabled={isDeletingProduct}
                loading={isDeletingProduct}
                icon={Trash2}
                iconPosition="left"
              >
                {t('common.delete') || 'Удалить'}
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
