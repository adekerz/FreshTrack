import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Wine, Coffee, Utensils, ChefHat, Warehouse, Package, ArrowLeft, Plus, FileBox } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import ProductModal from '../components/ProductModal'
import AddCustomProductModal from '../components/AddCustomProductModal'
import DeliveryTemplateModal from '../components/DeliveryTemplateModal'
import ExportButton from '../components/ExportButton'
import { EXPORT_COLUMNS } from '../utils/exportUtils'

// Иконки для отделов - универсальный маппинг
const ICON_MAP = {
  Wine,
  Coffee,
  Utensils,
  ChefHat,
  Warehouse,
  Package
}

// Получить иконку по имени или типу
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
  const { departmentId } = useParams()
  const { getProductsByDepartment, catalog, refresh, departments, categories } = useProducts()

  // Используем отдел из URL или первый доступный
  const selectedDepartment = departmentId || (departments.length > 0 ? departments[0].id : null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showAddCustomModal, setShowAddCustomModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  // Получить название категории в зависимости от языка
  const getCategoryName = (category) => {
    if (language === 'ru') return category.nameRu || category.name
    if (language === 'kk') return category.nameKz || category.name
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

  // Подготовка данных для экспорта (экспортируем отдельные партии, не агрегированные товары)
  const exportData = useMemo(() => {
    const products = getFilteredProducts()
    const dept = departments.find((d) => d.id === selectedDepartment)
    const exportRows = []

    // Функция для получения названия категории
    const getCategoryName = (categoryId) => {
      const cat = categories.find(c => c.id === categoryId)
      if (!cat) return '-'
      if (language === 'ru') return cat.nameRu || cat.name || '-'
      if (language === 'kk') return cat.nameKz || cat.name || '-'
      return cat.name || '-'
    }

    // Функция для получения текста статуса
    // Синхронизировано с dateUtils.js - пороги: expired(<0), today(0), critical(1-3), warning(4-7), good(>7)
    const getStatusLabel = (status) => {
      if (!status) return '-'
      const statusMap = {
        good: t('common.good') || 'В норме',
        ok: t('common.good') || 'В норме',
        warning: t('common.warning') || 'Внимание',
        critical: t('common.critical') || 'Критично',
        today: t('common.expired') || 'Истекает сегодня',
        expired: t('common.expired') || 'Просрочено'
      }
      return statusMap[status] || status || '-'
    }

    products.forEach((product) => {
      const categoryName = getCategoryName(product.categoryId) || product.category?.name || '-'
      
      // Если у товара есть партии, экспортируем каждую партию отдельно
      if (product.batches && product.batches.length > 0) {
        product.batches.forEach((batch) => {
          const status = batch.status?.status || batch.status
          exportRows.push({
            productName: product.name,
            category: categoryName,
            department: dept?.name || selectedDepartment,
            quantity: batch.quantity === null || batch.quantity === undefined ? '—' : batch.quantity,
            unit: product.unit || 'шт',
            formattedDate: batch.expiryDate
              ? new Date(batch.expiryDate).toLocaleDateString('ru-RU')
              : '-',
            daysLeft: batch.daysLeft ?? '-',
            statusLabel: getStatusLabel(status),
            status: status || 'good'
          })
        })
      } else {
        // Если партий нет, показываем "Нет партий"
        exportRows.push({
          productName: product.name,
          category: categoryName,
          department: dept?.name || selectedDepartment,
          quantity: 0,
          unit: product.unit || 'шт',
          formattedDate: '-',
          daysLeft: '-',
          statusLabel: t('inventory.noBatches') || 'Нет партий',
          status: 'noBatches'
        })
      }
    })

    return exportRows
  }, [selectedDepartment, getFilteredProducts, departments, categories, language, t])

  // Открыть модальное окно товара
  const handleProductClick = (product) => {
    setSelectedProduct(product)
    setShowProductModal(true)
  }

  // Вернуться к выбору отделов (deprecated - только один отдел)
  const handleBackToDepartments = () => {
    // Navigate to inventory page to select department
  }

  // Экран инвентаря отдела
  const department = departments.find((d) => d.id === selectedDepartment || d.code === selectedDepartment)
  const DeptIcon = getDeptIcon(department)
  const products = getFilteredProducts()
  const availableCategories = getAvailableCategories()

  // Если нет выбранного отдела, показываем сообщение
  if (!selectedDepartment && departments.length === 0) {
    return (
      <div className="p-8 animate-fade-in">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-warmgray mx-auto mb-4" />
          <h2 className="font-serif text-xl text-charcoal mb-2">{t('inventory.noDepartments') || 'No departments configured'}</h2>
          <p className="text-warmgray">{t('inventory.createDepartment') || 'Please create a department in Settings first.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${department?.color || '#C4A35A'}20` }}
            >
              {DeptIcon && <DeptIcon className="w-5 h-5" style={{ color: department?.color || '#C4A35A' }} />}
            </div>
            <h1 className="font-serif text-2xl">{t('inventory.title')} — {department?.name || selectedDepartment}</h1>
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
