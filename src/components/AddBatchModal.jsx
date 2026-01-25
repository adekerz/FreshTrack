import { useState, useCallback, useMemo } from 'react'
import { X, ChevronRight, Wine, Coffee, Utensils, ChefHat, Warehouse, Package } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useHotel } from '../context/HotelContext'
import { useAddBatch } from '../hooks/useInventory'
import { getDepartmentIcon } from '../utils/departmentUtils'
import { TouchInput, TouchSelect, TouchButton } from './ui'

// Иконки для отделов - универсальный маппинг
const ICON_MAP = { Wine, Coffee, Utensils, ChefHat, Warehouse, Package }

// Using centralized getDepartmentIcon from utils
const getDeptIcon = (dept) => {
  return getDepartmentIcon(dept)
}

export default function AddBatchModal({ onClose, preselectedProduct = null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { selectedHotelId } = useHotel()
  const { catalog, departments, categories } = useProducts()
  const toast = useToast()
  
  // === REACT QUERY MUTATION ===
  const { mutate: addBatchMutation, isPending: isSubmitting } = useAddBatch(selectedHotelId)

  // Шаги мастера
  const [step, setStep] = useState(preselectedProduct ? 4 : 1)
  const [selectedDepartment, setSelectedDepartment] = useState(
    preselectedProduct?.departmentId || null
  )
  const [selectedCategory, setSelectedCategory] = useState(preselectedProduct?.categoryId || null)
  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct || null)

  // Данные партии
  const [batchData, setBatchData] = useState({
    expiryDate: '',
    quantity: '',
    noQuantity: false,
    unit: 'шт',
    price: ''
  })

  // Получить название категории
  const getCategoryName = useCallback(
    (category) => {
      if (language === 'ru') return category.nameRu
      if (language === 'kk') return category.nameKz
      return category.name
    },
    [language]
  )

  // Получить доступные категории для отдела
  // Показываем ВСЕ категории, даже пустые (для создания новых товаров в новых отделах)
  const availableCategories = useMemo(() => {
    if (!selectedDepartment) return []
    return categories
  }, [selectedDepartment, categories])


  // Получить товары категории
  const getProductsInCategory = () => {
    if (!selectedDepartment || !selectedCategory) return []
    return catalog[selectedDepartment]?.[selectedCategory] || []
  }

  // Выбор отдела
  const handleDepartmentSelect = (deptId) => {
    setSelectedDepartment(deptId)
    setSelectedCategory(null)
    setSelectedProduct(null)
    setStep(2)
  }

  // Выбор категории
  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId)
    setSelectedProduct(null)
    setStep(3)
  }

  // Выбор товара
  const handleProductSelect = (product) => {
    setSelectedProduct(product)
    setStep(4)
  }

  // Отправка формы
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedProduct || !batchData.expiryDate) return

    // Защита от старых дат: год должен быть >= 2026
    const year = parseInt(batchData.expiryDate.split('-')[0], 10)
    if (year < 2026) {
      toast.addToast('Год должен быть 2026 или позже', 'error')
      return
    }

    // Если не "нет количества" и количество пустое или <= 0
    if (!batchData.noQuantity && (!batchData.quantity || parseInt(batchData.quantity) <= 0)) return

    // ✨ React Query mutation with optimistic update
    addBatchMutation(
      {
        productName: selectedProduct.name,
        department: selectedDepartment,
        category: selectedCategory,
        quantity: batchData.noQuantity ? null : parseInt(batchData.quantity),
        expiryDate: batchData.expiryDate
      },
      {
        onSuccess: () => {
          toast.success(t('toast.batchAdded'), selectedProduct.name)
          onClose()
          // React Query автоматически обновит инвентарь
        },
        onError: (error) => {
          toast.error(t('toast.error'), error.message || t('toast.somethingWentWrong'))
        }
      }
    )
  }

  // Назад
  const handleBack = () => {
    if (preselectedProduct) {
      onClose()
      return
    }
    if (step > 1) {
      setStep(step - 1)
    }
  }

  // Закрытие по оверлею
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-charcoal/50 dark:bg-black/60 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-card rounded-t-2xl sm:rounded-lg w-full sm:max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-slide-up flex flex-col">
        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
          <div>
            <h2 className="text-lg sm:text-xl font-medium text-foreground">{t('batch.addBatch')}</h2>
            {/* Индикатор шагов */}
            {!preselectedProduct && (
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      s <= step ? 'bg-accent' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <TouchButton
            variant="ghost"
            size="small"
            onClick={onClose}
            className="min-w-0 min-h-0 p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
            aria-label={t('common.close') || 'Закрыть'}
          >
            <X className="w-5 h-5" />
          </TouchButton>
        </div>

        {/* Контент */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
          {/* Шаг 1: Выбор отдела */}
          {step === 1 && (
            <div className="animate-fade-in">
              <p className="text-muted-foreground mb-4">{t('batch.selectDepartment')}</p>
              <div className="space-y-2">
                {departments.map((dept) => {
                  const Icon = getDeptIcon(dept)
                  return (
                    <TouchButton
                      key={dept.id}
                      variant="ghost"
                      onClick={() => handleDepartmentSelect(dept.id)}
                      className="w-full flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:border-accent transition-colors group h-auto min-h-[44px]"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${dept.color || '#C4A35A'}20` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: dept.color || '#C4A35A' }} />
                        </div>
                        <span className="font-medium text-foreground">{dept.name}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                    </TouchButton>
                  )
                })}
              </div>
            </div>
          )}

          {/* Шаг 2: Выбор категории */}
          {step === 2 && (
            <div className="animate-fade-in">
              <p className="text-muted-foreground mb-4">{t('batch.selectCategory')}</p>
              <div className="space-y-2">
                {availableCategories.map((cat) => (
                  <TouchButton
                    key={cat.id}
                    variant="ghost"
                    onClick={() => handleCategorySelect(cat.id)}
                    className="w-full flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:border-accent transition-colors group h-auto min-h-[44px]"
                  >
                    <span className="font-medium text-foreground">{getCategoryName(cat)}</span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </TouchButton>
                ))}
              </div>
            </div>
          )}

          {/* Шаг 3: Выбор товара */}
          {step === 3 && (
            <div className="animate-fade-in">
              <p className="text-muted-foreground mb-4">{t('batch.selectProduct')}</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getProductsInCategory().map((product) => (
                  <TouchButton
                    key={product.id}
                    variant="ghost"
                    onClick={() => handleProductSelect(product)}
                    className="w-full flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:border-accent transition-colors group h-auto min-h-[44px]"
                  >
                    <span className="font-medium text-foreground">{product.name}</span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </TouchButton>
                ))}
              </div>
            </div>
          )}

          {/* Шаг 4: Данные партии */}
          {step === 4 && (
            <div className="animate-fade-in">
              {/* Выбранный товар */}
              <div className="bg-background rounded-lg p-4 border border-border mb-6">
                <p className="text-sm text-muted-foreground">{t('batch.selectedProduct')}</p>
                <p className="font-medium text-foreground">{selectedProduct?.name}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <TouchInput
                  type="date"
                  label={`${t('product.expiryDate')} *`}
                  value={batchData.expiryDate}
                  min="2026-01-01"
                  onChange={(e) =>
                    setBatchData((prev) => ({ ...prev, expiryDate: e.target.value }))
                  }
                  required
                />

                <div>
                  <TouchInput
                    type="number"
                    inputMode="numeric"
                    label={`${t('product.quantity')} ${!batchData.noQuantity ? '*' : ''}`}
                    min="1"
                    value={batchData.quantity}
                    onChange={(e) =>
                      setBatchData((prev) => ({ ...prev, quantity: e.target.value }))
                    }
                    disabled={batchData.noQuantity}
                    required={!batchData.noQuantity}
                    placeholder={
                      batchData.noQuantity ? t('batch.noQuantity') || 'Нет количества' : ''
                    }
                    containerClassName="mb-2"
                  />
                  <div className="flex gap-2 flex-wrap mb-2">
                    <TouchSelect
                      label={t('product.unit') || 'Ед.'}
                      value={batchData.unit}
                      onChange={(v) => setBatchData((prev) => ({ ...prev, unit: v }))}
                      disabled={batchData.noQuantity}
                      options={[
                        { value: 'шт', label: t('units.pcs') || 'шт' },
                        { value: 'кг', label: t('units.kg') || 'кг' },
                        { value: 'л', label: t('units.l') || 'л' },
                        { value: 'г', label: t('units.g') || 'г' },
                        { value: 'мл', label: t('units.ml') || 'мл' },
                        { value: 'уп', label: t('units.pack') || 'уп' },
                      ]}
                      className="w-28"
                    />
                  </div>

                  {/* Переключатель "Нет количества" */}
                  <div className="flex items-center gap-3 mt-3">
                    <input
                      type="checkbox"
                      id="noQuantity"
                      checked={batchData.noQuantity}
                      onChange={(e) =>
                        setBatchData((prev) => ({
                          ...prev,
                          noQuantity: e.target.checked,
                          quantity: e.target.checked ? '' : prev.quantity
                        }))
                      }
                      className="quantity-toggle"
                    />
                    <label
                      htmlFor="noQuantity"
                      className="text-sm text-muted-foreground cursor-pointer select-none"
                    >
                      {t('batch.noQuantityLabel') || 'Без учёта количества'}
                    </label>
                  </div>
                </div>

                <TouchInput
                  type="number"
                  inputMode="decimal"
                  label={`${t('product.price') || 'Цена'} (${t('common.optional') || 'необязательно'})`}
                  min="0"
                  step="0.01"
                  value={batchData.price}
                  onChange={(e) => setBatchData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00 ₸"
                />

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                  <TouchButton
                    type="button"
                    variant="secondary"
                    onClick={handleBack}
                    fullWidth
                  >
                    {t('common.back')}
                  </TouchButton>
                  <TouchButton
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    fullWidth
                  >
                    {t('batch.addBatch')}
                  </TouchButton>
                </div>
              </form>
            </div>
          )}

          {/* Кнопка назад для шагов 2-3 */}
          {step > 1 && step < 4 && (
            <TouchButton
              variant="ghost"
              size="small"
              onClick={handleBack}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t('common.back')}
            </TouchButton>
          )}
        </div>
      </div>
    </div>
  )
}
