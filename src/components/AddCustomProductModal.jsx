import { useState } from 'react'
import { X, Wine, Coffee, Utensils, ChefHat, Warehouse, Package } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useHotel } from '../context/HotelContext'
import { useAddProduct } from '../hooks/useInventory'

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

export default function AddCustomProductModal({ onClose, departmentId = null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { selectedHotelId } = useHotel()
  const { departments, categories } = useProducts()
  const { addToast } = useToast()
  
  // === REACT QUERY MUTATION ===
  const { mutate: addProductMutation, isPending: isSubmitting } = useAddProduct(selectedHotelId)

  const [selectedDepartment, setSelectedDepartment] = useState(departmentId)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [productName, setProductName] = useState('')
  const [error, setError] = useState('')

  // Получить название категории
  const getCategoryName = (category) => {
    if (language === 'ru') return category.nameRu || category.name
    if (language === 'kk') return category.nameKz || category.name
    return category.name || category.nameRu || 'Категория'
  }

  // Отправка формы
  const handleSubmit = (e) => {
    e.preventDefault()

    if (!selectedDepartment) {
      setError(t('customProduct.errorSelectDepartment'))
      return
    }
    if (!selectedCategory) {
      setError(t('customProduct.errorSelectCategory'))
      return
    }
    if (!productName.trim()) {
      setError(t('customProduct.errorEnterName'))
      return
    }

    setError('')

    // ✨ React Query mutation with optimistic update
    addProductMutation(
      {
        name: productName.trim(),
        categoryId: selectedCategory,
        departmentId: selectedDepartment
      },
      {
        onSuccess: () => {
          addToast(t('toast.productAdded'), 'success')
          onClose()
          // React Query автоматически обновит каталог
        },
        onError: (err) => {
          setError(err.message || 'Error adding product')
          addToast(t('toast.productAddError'), 'error')
        }
      }
    )
  }

  // Закрытие по оверлею
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-card rounded-lg w-full max-w-md overflow-hidden animate-slide-up">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-medium text-foreground">{t('customProduct.title')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Контент */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Выбор отдела */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              {t('customProduct.department')} *
            </label>
            <div className="flex gap-2 flex-wrap">
              {departments.map((dept) => {
                const Icon = getDeptIcon(dept)
                const isSelected = selectedDepartment === dept.id
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setSelectedDepartment(dept.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isSelected ? dept.color || '#C4A35A' : undefined }}
                    />
                    <span className="text-sm">{dept.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Выбор категории */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              {t('customProduct.category')} *
            </label>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {getCategoryName(cat)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Название товара */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              {t('customProduct.productName')} *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t('customProduct.productNamePlaceholder')}
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-accent bg-card text-foreground"
              autoFocus
            />
          </div>

          {/* Ошибка */}
          {error && <p className="text-sm text-danger">{error}</p>}

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border text-muted-foreground rounded-lg hover:border-foreground hover:text-foreground transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {t('customProduct.addToCatalog')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
