import { useState } from 'react'
import { X, Wine, Coffee, Martini } from 'lucide-react'
import { useProducts, departments, categories } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'

// Иконки для отделов
const departmentIcons = {
  'honor-bar': Wine,
  'mokki-bar': Coffee,
  'ozen-bar': Martini
}

export default function AddCustomProductModal({ onClose, departmentId = null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { addCustomProduct } = useProducts()

  const [selectedDepartment, setSelectedDepartment] = useState(departmentId)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [productName, setProductName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Получить название категории
  const getCategoryName = (category) => {
    if (language === 'ru') return category.nameRu
    if (language === 'kk') return category.nameKz
    return category.name
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

    setIsSubmitting(true)
    setError('')

    addCustomProduct(selectedDepartment, selectedCategory, productName.trim())
    onClose()
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
      <div className="bg-cream rounded-lg w-full max-w-md overflow-hidden animate-slide-up">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-sand">
          <h2 className="font-serif text-xl text-charcoal">{t('customProduct.title')}</h2>
          <button
            onClick={onClose}
            className="text-warmgray hover:text-charcoal transition-colors p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Контент */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Выбор отдела */}
          <div>
            <label className="block text-sm text-warmgray mb-2">
              {t('customProduct.department')} *
            </label>
            <div className="flex gap-2 flex-wrap">
              {departments.map((dept) => {
                const Icon = departmentIcons[dept.id]
                const isSelected = selectedDepartment === dept.id
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setSelectedDepartment(dept.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-accent bg-accent/10 text-charcoal'
                        : 'border-sand bg-white text-warmgray hover:border-charcoal'
                    }`}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isSelected ? dept.color : undefined }}
                    />
                    <span className="text-sm">{dept.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Выбор категории */}
          <div>
            <label className="block text-sm text-warmgray mb-2">
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
                        ? 'border-accent bg-accent/10 text-charcoal'
                        : 'border-sand bg-white text-warmgray hover:border-charcoal'
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
            <label className="block text-sm text-warmgray mb-2">
              {t('customProduct.productName')} *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={t('customProduct.productNamePlaceholder')}
              className="w-full px-4 py-3 border border-sand rounded-lg focus:outline-none focus:border-accent"
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
              className="flex-1 py-3 border border-sand text-warmgray rounded-lg hover:border-charcoal hover:text-charcoal transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-50"
            >
              {t('customProduct.addToCatalog')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
