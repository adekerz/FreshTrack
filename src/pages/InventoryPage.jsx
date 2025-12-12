import { useState, useMemo, useCallback } from 'react'
import { Wine, Coffee, Martini, ArrowLeft, Plus, Package, FileBox } from 'lucide-react'
import { useProducts, departments, categories } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import ProductModal from '../components/ProductModal'
import AddCustomProductModal from '../components/AddCustomProductModal'
import DeliveryTemplateModal from '../components/DeliveryTemplateModal'
import ExportButton from '../components/ExportButton'
import { EXPORT_COLUMNS } from '../utils/exportUtils'

// Иконки для отделов
const departmentIcons = {
  'honor-bar': Wine,
  'mokki-bar': Coffee,
  'ozen-bar': Martini
}

// Цвета статусов
const statusColors = {
  expired: 'bg-danger',
  critical: 'bg-danger',
  warning: 'bg-warning',
  good: 'bg-success'
}

export default function InventoryPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { getProductsByDepartment, catalog, refresh } = useProducts()

  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showAddCustomModal, setShowAddCustomModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  // Получить название категории в зависимости от языка
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

  // Получить отфильтрованные товары
  const getFilteredProducts = useCallback(() => {
    if (!selectedDepartment) return []
    const products = getProductsByDepartment(selectedDepartment)
    if (selectedCategory === 'all') return products
    return products.filter((p) => p.categoryId === selectedCategory)
  }, [selectedDepartment, selectedCategory, getProductsByDepartment])

  // Подготовка данных для экспорта
  const exportData = useMemo(() => {
    const products = getFilteredProducts()
    const dept = departments.find((d) => d.id === selectedDepartment)

    return products.map((product) => ({
      productName: product.name,
      category: product.category?.name || '-',
      department: dept?.name || selectedDepartment,
      quantity: product.quantity || 1,
      unit: product.unit || 'шт',
      formattedDate: product.expiryDate
        ? new Date(product.expiryDate).toLocaleDateString('ru-RU')
        : '-',
      daysLeft: product.daysLeft ?? '-',
      statusLabel: product.status
        ? {
            good: t('common.good') || 'Хорошо',
            warning: t('common.warning') || 'Внимание',
            critical: t('common.critical') || 'Критично',
            expired: t('common.expired') || 'Просрочено'
          }[product.status]
        : '-',
      status: product.status
    }))
  }, [selectedDepartment, getFilteredProducts, t])

  // Открыть модальное окно товара
  const handleProductClick = (product) => {
    setSelectedProduct(product)
    setShowProductModal(true)
  }

  // Вернуться к выбору отделов
  const handleBackToDepartments = () => {
    setSelectedDepartment(null)
    setSelectedCategory('all')
  }

  // Экран выбора отдела
  if (!selectedDepartment) {
    return (
      <div className="p-8 animate-fade-in">
        <div className="text-center mb-12">
          <h1 className="font-serif text-3xl mb-2">{t('inventory.selectDepartment')}</h1>
          <p className="text-warmgray">{t('inventory.selectDepartmentDesc')}</p>
        </div>

        <div className="flex justify-center gap-8 flex-wrap">
          {departments.map((dept, index) => {
            const Icon = departmentIcons[dept.id]
            return (
              <button
                key={dept.id}
                onClick={() => setSelectedDepartment(dept.id)}
                className={`
                  group bg-white border border-sand rounded-lg p-8 w-64
                  transition-all duration-300 hover:shadow-lg hover:-translate-y-1
                  hover:border-accent focus:outline-none focus:border-accent
                  animate-slide-up stagger-${index + 1}
                `}
                style={{ animationFillMode: 'backwards' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors"
                  style={{ backgroundColor: `${dept.color}20` }}
                >
                  <Icon className="w-8 h-8 transition-colors" style={{ color: dept.color }} />
                </div>
                <h3 className="font-serif text-xl text-charcoal group-hover:text-accent transition-colors">
                  {dept.name}
                </h3>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Экран инвентаря отдела
  const department = departments.find((d) => d.id === selectedDepartment)
  const DeptIcon = departmentIcons[selectedDepartment]
  const products = getFilteredProducts()
  const availableCategories = getAvailableCategories()

  return (
    <div className="p-8 animate-fade-in">
      {/* Заголовок с кнопкой назад */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToDepartments}
            className="flex items-center gap-2 text-warmgray hover:text-charcoal transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('inventory.backToDepartments')}</span>
          </button>
          <div className="h-6 w-px bg-sand" />
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${department.color}20` }}
            >
              <DeptIcon className="w-5 h-5" style={{ color: department.color }} />
            </div>
            <h1 className="font-serif text-2xl">{department.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ExportButton
            data={exportData}
            columns={EXPORT_COLUMNS.inventory(t)}
            filename={`inventory_${selectedDepartment}`}
            title={`${t('inventory.title')} - ${department?.name}`}
            subtitle={
              selectedCategory !== 'all'
                ? `${t('common.category')}: ${categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}`
                : ''
            }
          />
          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-2 text-sm text-warmgray hover:text-accent transition-colors"
          >
            <FileBox className="w-4 h-4" />
            {t('inventory.applyTemplate')}
          </button>
          <button
            onClick={() => setShowAddCustomModal(true)}
            className="flex items-center gap-2 text-sm text-warmgray hover:text-accent transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('inventory.addNewProduct')}
          </button>
        </div>
      </div>

      {/* Фильтры категорий */}
      <div className="flex gap-2 mb-8 flex-wrap">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-full text-sm transition-all ${
            selectedCategory === 'all'
              ? 'bg-charcoal text-white'
              : 'bg-transparent border border-sand text-warmgray hover:border-charcoal hover:text-charcoal'
          }`}
        >
          {t('common.all')}
        </button>
        {availableCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-sm transition-all ${
              selectedCategory === cat.id
                ? 'bg-charcoal text-white'
                : 'bg-transparent border border-sand text-warmgray hover:border-charcoal hover:text-charcoal'
            }`}
          >
            {getCategoryName(cat)}
          </button>
        ))}
      </div>

      {/* Сетка товаров */}
      {products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-sand mx-auto mb-4" />
          <p className="text-warmgray text-lg">{t('inventory.noProducts')}</p>
          <p className="text-warmgray/70 text-sm mt-2">{t('inventory.addBatchToStart')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const category = categories.find((c) => c.id === product.categoryId)
            return (
              <button
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="bg-white border border-sand rounded-lg p-4 text-left transition-all hover:shadow-md hover:border-accent group"
              >
                {/* Статус индикатор */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-charcoal group-hover:text-accent transition-colors">
                      {product.name}
                    </h3>
                    {category && (
                      <span className="text-xs text-warmgray bg-sand/50 px-2 py-0.5 rounded mt-1 inline-block">
                        {getCategoryName(category)}
                      </span>
                    )}
                  </div>
                  {product.totalBatches > 0 && (
                    <div
                      className={`w-3 h-3 rounded-full ${statusColors[product.overallStatus]}`}
                      title={product.overallStatus}
                    />
                  )}
                </div>

                {/* Информация о партиях */}
                <div className="text-sm text-warmgray">
                  {product.totalBatches === 0 ? (
                    <span className="text-warmgray/50">{t('inventory.noBatches')}</span>
                  ) : (
                    <>
                      <span className="font-medium text-charcoal">{product.totalBatches}</span>{' '}
                      {t('inventory.batches')} •{' '}
                      <span className="font-medium text-charcoal">{product.totalQuantity}</span>{' '}
                      {t('inventory.units')}
                    </>
                  )}
                </div>

                {/* Предупреждения */}
                {product.hasExpired && (
                  <div className="mt-2 text-xs text-danger flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                    {t('inventory.hasExpired')}
                  </div>
                )}
                {!product.hasExpired && product.hasExpiringSoon && (
                  <div className="mt-2 text-xs text-warning flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                    {t('inventory.expiringSoon')}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Модальные окна */}
      {showProductModal && selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => {
            setShowProductModal(false)
            setSelectedProduct(null)
          }}
        />
      )}

      {showAddCustomModal && (
        <AddCustomProductModal
          departmentId={selectedDepartment}
          onClose={() => setShowAddCustomModal(false)}
        />
      )}

      {showTemplateModal && (
        <DeliveryTemplateModal
          isOpen={true}
          departmentId={selectedDepartment}
          onClose={() => setShowTemplateModal(false)}
          onApply={() => {
            refresh()
            setShowTemplateModal(false)
          }}
        />
      )}
    </div>
  )
}
