import { useState } from 'react'
import { X } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useHotel } from '../context/HotelContext'
import { useAddProduct } from '../hooks/useInventory'
import { getDepartmentIcon } from '../utils/departmentUtils'

export default function AddCustomProductModal({ onClose, departmentId = null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { selectedHotelId } = useHotel()
  const { departments, categories } = useProducts()
  const { addToast } = useToast()
  
  // === REACT QUERY MUTATION ===
  const { mutate: addProductMutation, mutateAsync: addProductAsync, isPending: isSubmitting } =
    useAddProduct(selectedHotelId)

  const [selectedDepartment, setSelectedDepartment] = useState(departmentId)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [productName, setProductName] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [productNamesText, setProductNamesText] = useState('')
  const [batchProgress, setBatchProgress] = useState(null)
  const [error, setError] = useState('')

  // Получить название категории
  const getCategoryName = (category) => {
    if (language === 'ru') return category.nameRu || category.name
    if (language === 'kk') return category.nameKz || category.name
    return category.name || category.nameRu || 'Категория'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedDepartment) {
      setError(t('customProduct.errorSelectDepartment'))
      return
    }
    if (!selectedCategory) {
      setError(t('customProduct.errorSelectCategory'))
      return
    }

    setError('')

    if (batchMode) {
      const names = productNamesText
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (names.length === 0) {
        setError(t('customProduct.errorEnterName'))
        return
      }

      setBatchProgress({ done: 0, total: names.length })
      let added = 0
      let failed = 0
      for (let i = 0; i < names.length; i++) {
        try {
          await addProductAsync({
            name: names[i],
            categoryId: selectedCategory,
            departmentId: selectedDepartment
          })
          added += 1
        } catch {
          failed += 1
        }
        setBatchProgress({ done: i + 1, total: names.length })
      }
      setBatchProgress(null)
      if (added > 0) {
        addToast(
          failed > 0
            ? t('customProduct.batchAddedPartial', { added, failed })
            : t('customProduct.batchAdded', { count: added }),
          failed > 0 ? 'warning' : 'success'
        )
        onClose()
      }
      if (failed > 0 && added === 0) {
        setError(t('customProduct.batchAddError'))
        addToast(t('toast.productAddError'), 'error')
      }
      return
    }

    if (!productName.trim()) {
      setError(t('customProduct.errorEnterName'))
      return
    }

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
                const Icon = getDepartmentIcon(dept)
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

          {/* Режим: один товар / несколько */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBatchMode(false)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                !batchMode ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('customProduct.singleProduct')}
            </button>
            <button
              type="button"
              onClick={() => setBatchMode(true)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                batchMode ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('customProduct.multipleProducts')}
            </button>
          </div>

          {/* Название товара (один) или список (несколько) */}
          {batchMode ? (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                {t('customProduct.productNamesLabel')} *
              </label>
              <textarea
                value={productNamesText}
                onChange={(e) => setProductNamesText(e.target.value)}
                placeholder={t('customProduct.productNamesPlaceholder')}
                rows={5}
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-accent bg-card text-foreground resize-y min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('customProduct.onePerLine')}</p>
            </div>
          ) : (
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
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={batchProgress !== null}
              className="flex-1 py-3 border border-border text-muted-foreground rounded-lg hover:border-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || batchProgress !== null}
              className="flex-1 py-3 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {batchProgress
                ? t('customProduct.addingCount', { done: batchProgress.done, total: batchProgress.total })
                : batchMode
                  ? t('customProduct.addMultipleToCatalog')
                  : t('customProduct.addToCatalog')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
