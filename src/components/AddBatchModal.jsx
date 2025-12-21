import { useState } from 'react'
import { X, ChevronRight, Wine, Coffee, Utensils, ChefHat, Warehouse, Package } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'

// Иконки для отделов - универсальный маппинг
const ICON_MAP = { Wine, Coffee, Utensils, ChefHat, Warehouse, Package }

const getDeptIcon = (dept) => {
  if (dept?.icon && ICON_MAP[dept.icon]) return ICON_MAP[dept.icon]
  const name = (dept?.name || dept?.code || '').toLowerCase()
  if (name.includes('bar')) return Wine
  if (name.includes('kitchen') || name.includes('кухня')) return ChefHat
  if (name.includes('restaurant') || name.includes('ресторан')) return Utensils
  if (name.includes('storage') || name.includes('склад')) return Warehouse
  if (name.includes('cafe') || name.includes('кафе')) return Coffee
  return Package
}

export default function AddBatchModal({ onClose, preselectedProduct = null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { catalog, addBatch, departments, categories } = useProducts()
  const toast = useToast()

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
    noQuantity: false
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Получить название категории
  const getCategoryName = (category) => {
    if (language === 'ru') return category.nameRu
    if (language === 'kk') return category.nameKz
    return category.name
  }

  // Получить доступные категории для отдела
  const getAvailableCategories = () => {
    if (!selectedDepartment) return []
    const deptCatalog = catalog[selectedDepartment] || {}
    return categories.filter((cat) => {
      const products = deptCatalog[cat.id] || []
      return products.length > 0
    })
  }

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
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedProduct || !batchData.expiryDate) return
    
    // Если не "нет количества" и количество пустое или <= 0
    if (!batchData.noQuantity && (!batchData.quantity || parseInt(batchData.quantity) <= 0)) return

    setIsSubmitting(true)

    try {
      await addBatch(
        selectedProduct.id,
        selectedDepartment,
        batchData.expiryDate,
        batchData.noQuantity ? null : parseInt(batchData.quantity)
      )
      toast.success(t('toast.batchAdded'), selectedProduct.name)
      onClose()
    } catch (error) {
      toast.error(t('toast.error'), error.message || t('toast.somethingWentWrong'))
      setIsSubmitting(false)
    }
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
      className="fixed inset-0 bg-charcoal/50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-cream dark:bg-dark-surface rounded-lg w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-sand dark:border-dark-border">
          <div>
            <h2 className="font-serif text-xl text-charcoal dark:text-cream">{t('batch.addBatch')}</h2>
            {/* Индикатор шагов */}
            {!preselectedProduct && (
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      s <= step ? 'bg-accent' : 'bg-sand'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-warmgray hover:text-charcoal dark:hover:text-cream transition-colors p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Контент */}
        <div className="p-6">
          {/* Шаг 1: Выбор отдела */}
          {step === 1 && (
            <div className="animate-fade-in">
              <p className="text-warmgray mb-4">{t('batch.selectDepartment')}</p>
              <div className="space-y-2">
                {departments.map((dept) => {
                  const Icon = getDeptIcon(dept)
                  return (
                    <button
                      key={dept.id}
                      onClick={() => handleDepartmentSelect(dept.id)}
                      className="w-full flex items-center justify-between p-4 bg-white dark:bg-dark-bg border border-sand dark:border-dark-border rounded-lg hover:border-accent transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${dept.color || '#C4A35A'}20` }}
                        >
                          <Icon className="w-5 h-5" style={{ color: dept.color || '#C4A35A' }} />
                        </div>
                        <span className="font-medium text-charcoal dark:text-cream">{dept.name}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-warmgray group-hover:text-accent transition-colors" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Шаг 2: Выбор категории */}
          {step === 2 && (
            <div className="animate-fade-in">
              <p className="text-warmgray mb-4">{t('batch.selectCategory')}</p>
              <div className="space-y-2">
                {getAvailableCategories().map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-dark-bg border border-sand dark:border-dark-border rounded-lg hover:border-accent transition-colors group"
                  >
                    <span className="font-medium text-charcoal dark:text-cream">{getCategoryName(cat)}</span>
                    <ChevronRight className="w-5 h-5 text-warmgray group-hover:text-accent transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Шаг 3: Выбор товара */}
          {step === 3 && (
            <div className="animate-fade-in">
              <p className="text-warmgray mb-4">{t('batch.selectProduct')}</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getProductsInCategory().map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-dark-bg border border-sand dark:border-dark-border rounded-lg hover:border-accent transition-colors group"
                  >
                    <span className="font-medium text-charcoal dark:text-cream">{product.name}</span>
                    <ChevronRight className="w-5 h-5 text-warmgray group-hover:text-accent transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Шаг 4: Данные партии */}
          {step === 4 && (
            <div className="animate-fade-in">
              {/* Выбранный товар */}
              <div className="bg-white dark:bg-dark-bg rounded-lg p-4 border border-sand dark:border-dark-border mb-6">
                <p className="text-sm text-warmgray">{t('batch.selectedProduct')}</p>
                <p className="font-medium text-charcoal dark:text-cream">{selectedProduct?.name}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-warmgray mb-1">
                    {t('product.expiryDate')} *
                  </label>
                  <input
                    type="date"
                    value={batchData.expiryDate}
                    onChange={(e) =>
                      setBatchData((prev) => ({ ...prev, expiryDate: e.target.value }))
                    }
                    className="w-full px-4 py-3 border border-sand rounded-lg focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-warmgray mb-1">
                    {t('product.quantity')} {!batchData.noQuantity && '*'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchData.quantity}
                    onChange={(e) =>
                      setBatchData((prev) => ({ ...prev, quantity: e.target.value }))
                    }
                    disabled={batchData.noQuantity}
                    className={`w-full px-4 py-3 border border-sand rounded-lg focus:outline-none focus:border-accent transition-colors ${
                      batchData.noQuantity ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                    }`}
                    required={!batchData.noQuantity}
                    placeholder={batchData.noQuantity ? t('batch.noQuantity') || 'Нет количества' : ''}
                  />
                  
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
                    <label htmlFor="noQuantity" className="text-sm text-warmgray cursor-pointer select-none">
                      {t('batch.noQuantityLabel') || 'Без учёта количества'}
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 py-3 border border-sand text-warmgray rounded-lg hover:border-charcoal hover:text-charcoal transition-colors"
                  >
                    {t('common.back')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {t('batch.addBatch')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Кнопка назад для шагов 2-3 */}
          {step > 1 && step < 4 && (
            <button
              onClick={handleBack}
              className="mt-4 text-sm text-warmgray hover:text-charcoal transition-colors"
            >
              ← {t('common.back')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
