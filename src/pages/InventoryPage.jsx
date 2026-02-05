import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Wine,
  Coffee,
  Utensils,
  ChefHat,
  Warehouse,
  Package,
  Plus,
  FileBox,
  ArrowUpDown,
  ArrowLeft,
  Trash2
} from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useHotel } from '../context/HotelContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { apiFetch } from '../services/api'
import ProductModal from '../components/ProductModal'
import AddCustomProductModal from '../components/AddCustomProductModal'
import SelectTemplateModal from '../components/SelectTemplateModal'
import FastIntakeModal from '../components/FastIntakeModal'
import DepartmentSelector from '../components/DepartmentSelector'
import ExportButton from '../components/ExportButton'
import ProductCard from '../components/ProductCard'
import { SkeletonInventory, Skeleton } from '../components/Skeleton'
import { Loader, ConfirmDialog, TouchButton } from '../components/ui'
import PageContainer from '../components/PageContainer'
import AnimatedPage from '../components/AnimatedPage'
import { AnimatedGrid } from '../components/AnimatedList'
import EmptyState from '../components/EmptyState'
import ExportProgress from '../components/ExportProgress'
import Tooltip from '../components/Tooltip'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useExport } from '../hooks/useExport'

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

export default function InventoryPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { departmentId } = useParams()
  const navigate = useNavigate()
  const { getProductsByDepartment, catalog, refresh, departments, categories, loading } =
    useProducts()
  const { selectedHotelId } = useHotel()
  const { isRefreshing, pullDistance } = usePullToRefresh(refresh)
  const { user, isStaff, isSuperAdmin } = useAuth()
  const { addToast } = useToast()
  const { exportProgress, dismissExportProgress } = useExport()
  const prevHotelIdRef = useRef(selectedHotelId)

  // Проверка роли STAFF через helper функцию
  const userIsStaff = isStaff()
  const userIsSuperAdmin = isSuperAdmin()
  
  // Check if running in development mode
  const isDevelopment = import.meta.env.MODE === 'development'

  // Состояние выбранного отдела (из URL или null для показа селектора)
  const [selectedDeptId, setSelectedDeptId] = useState(departmentId || null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('expiry') // expiry, name, quantity
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showAddCustomModal, setShowAddCustomModal] = useState(false)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)
  const [clearingBatches, setClearingBatches] = useState(false)
  // === Template modal state management ===
  // Two separate modals with clear separation of concerns:
  // 1. SelectTemplateModal - only selects template (stateless)
  // 2. FastIntakeModal - fast intake with selected template (stateful)
  const [showSelectTemplateModal, setShowSelectTemplateModal] = useState(false)
  const [showFastIntakeModal, setShowFastIntakeModal] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

  // Детектор размера экрана для compact режима
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle template selection - closes selector, opens fast intake
  const handleTemplateSelect = useCallback((templateId) => {
    setSelectedTemplateId(templateId)
    setShowSelectTemplateModal(false)
    // Use setTimeout to ensure state updates complete before opening next modal
    setTimeout(() => {
      setShowFastIntakeModal(true)
    }, 0)
  }, [])
  
  // Handle "change template" - opens selector, keeps fast intake state
  const handleChangeTemplate = useCallback(() => {
    setShowFastIntakeModal(false)
    setShowSelectTemplateModal(true)
    // DON'T reset selectedTemplateId here - will be set on new selection
  }, [])
  
  // Handle fast intake close - full reset
  const handleFastIntakeClose = useCallback(() => {
    setShowFastIntakeModal(false)
    setSelectedTemplateId(null)
  }, [])
  
  // DEPRECATED: React Query автоматически обновляет инвентарь через invalidation
  // Этот callback больше не нужен, но оставлен для обратной совместимости
  const handleFastApply = useCallback((batches) => {
    // React Query автоматически обновит данные через фоновую синхронизацию
    // refresh() больше не нужен - данные обновятся через 2 секунды автоматически
  }, [])
  
  // Handle template selector close - full reset
  const handleSelectTemplateClose = useCallback(() => {
    setShowSelectTemplateModal(false)
    setSelectedTemplateId(null)
  }, [])

  // Если в URL есть departmentId, используем его
  useEffect(() => {
    if (departmentId) {
      setSelectedDeptId(departmentId)
    }
  }, [departmentId])

  // Сбрасываем выбранный отдел при смене отеля
  useEffect(() => {
    if (prevHotelIdRef.current !== selectedHotelId && prevHotelIdRef.current !== null) {
      // Отель сменился — сбрасываем отдел и возвращаемся к списку
      setSelectedDeptId(null)
      setSelectedCategory('all')
    }
    prevHotelIdRef.current = selectedHotelId
  }, [selectedHotelId])

  // Выбор отдела
  const handleSelectDepartment = (deptId) => {
    setSelectedDeptId(deptId)
    // Можно добавить навигацию в URL: navigate(`/inventory/${deptId}`)
  }

  // Вернуться к списку отделов
  const handleBackToDepartments = () => {
    setSelectedDeptId(null)
    setSelectedCategory('all')
  }

  // Автоматический retry когда нет данных (БД ещё загружается)
  // Делаем retry только если не loading и прошло достаточно времени
  useEffect(() => {
    // Не делаем retry если уже идёт загрузка или достигнут лимит
    if (loading || retryCount >= 5) return

    // Если данные есть - сбрасываем счётчик
    if (departments.length > 0) {
      if (retryCount > 0) setRetryCount(0)
      return
    }

    // Retry с увеличивающимся интервалом (3s, 6s, 9s...)
    const delay = (retryCount + 1) * 3000
    const timer = setTimeout(() => {
      setRetryCount((prev) => prev + 1)
      refresh()
    }, delay)

    return () => clearTimeout(timer)
  }, [loading, departments.length, retryCount, refresh])

  // Получить название категории в зависимости от языка
  const getCategoryName = (category) => {
    if (language === 'ru') return category.nameRu || category.name
    if (language === 'kk') return category.nameKz || category.name
    return category.name
  }

  // Получить доступные категории для отдела
  // Показываем все категории отеля (не только с продуктами) для возможности фильтрации
  const getAvailableCategories = () => {
    if (!selectedDeptId) return []

    // Возвращаем все категории отеля
    // Backend уже фильтрует categories по hotel_id
    return categories
  }

  // Clear all batches (DEVELOPMENT ONLY - SUPER ADMIN)
  const handleClearAllBatches = async () => {
    if (!isDevelopment || !userIsSuperAdmin) return
    
    setClearingBatches(true)
    try {
      // Use hotel_id from context or localStorage
      const hotelId = selectedHotelId || localStorage.getItem('freshtrack_selected_hotel')
      
      if (!hotelId) {
        addToast('Не указан отель', 'error')
        setClearingBatches(false)
        return
      }
      
      const url = `/batches/clear-all?hotel_id=${hotelId}`
      
      console.log('[Clear All Batches] Request:', {
        url,
        hotelId,
        isDevelopment,
        userIsSuperAdmin,
        userRole: user?.role
      })
      
      const response = await apiFetch(url, {
        method: 'DELETE'
      })
      
      console.log('[Clear All Batches] Response:', response)
      
      addToast(
        t('inventory.allBatchesCleared', { count: response.deleted || 0 }) || 
        `Удалено ${response.deleted || 0} партий`,
        'success'
      )
      refresh()
      setShowClearAllConfirm(false)
    } catch (error) {
      console.error('[Clear All Batches] Error:', error)
      const errorMessage = error.message || error.error || 'Ошибка очистки партий'
      addToast(errorMessage, 'error')
    } finally {
      setClearingBatches(false)
    }
  }

  // Получить отфильтрованные и отсортированные товары
  const getFilteredProducts = useCallback(() => {
    if (!selectedDeptId) return []
    let products = getProductsByDepartment(selectedDeptId)
    if (selectedCategory !== 'all') {
      products = products.filter((p) => p.categoryId === selectedCategory)
    }

    // Сортировка
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '')
        case 'quantity':
          const qtyA = a.batches?.reduce((sum, b) => sum + (b.quantity || 0), 0) || 0
          const qtyB = b.batches?.reduce((sum, b) => sum + (b.quantity || 0), 0) || 0
          return qtyB - qtyA
        case 'expiry':
        default:
          // Сортировка по ближайшему сроку годности
          const getMinExpiry = (product) => {
            if (!product.batches?.length) return Infinity
            return Math.min(...product.batches.map((b) => b.daysLeft ?? Infinity))
          }
          return getMinExpiry(a) - getMinExpiry(b)
      }
    })
  }, [selectedDeptId, selectedCategory, sortBy, getProductsByDepartment])

  // Подготовка фильтров для экспорта
  const exportFilters = useMemo(() => {
    const filters = {
      department_id: selectedDeptId
    }

    // Добавляем фильтр по категории если выбрана
    if (selectedCategory !== 'all') {
      filters.category_id = selectedCategory
    }

    return filters
  }, [selectedDeptId, selectedCategory])

  // Открыть модальное окно товара
  const handleProductClick = (product) => {
    setSelectedProduct(product)
    setShowProductModal(true)
  }

  // Экран инвентаря отдела
  const department = departments.find((d) => d.id === selectedDeptId || d.code === selectedDeptId)
  const DeptIcon = getDeptIcon(department)
  const products = getFilteredProducts()
  const availableCategories = getAvailableCategories()

  // Показываем скелетон при загрузке (когда уже есть отделы)
  if (loading && departments.length > 0) {
    return (
      <AnimatedPage>
      <PageContainer
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle') || ''}
        stickyHeader={true}
      >
        <div className="animate-fade-in">
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
            ))}
          </div>
          <SkeletonInventory rows={6} />
        </div>
      </PageContainer>
      </AnimatedPage>
    )
  }

  // Если нет данных и идёт загрузка - показываем анимацию подключения к БД
  if (loading && departments.length === 0) {
    return (
      <AnimatedPage>
      <PageContainer
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle') || ''}
        stickyHeader={true}
      >
        <div className="flex-1 flex items-center justify-center py-16 sm:py-24 animate-fade-in">
          <div className="flex flex-col items-center gap-6" role="status" aria-live="polite">
            <Loader size="large" aria-label={t('common.loading') || 'Загрузка'} />
            <div className="text-center">
              <p className="text-foreground font-medium mb-1">
                {t('common.loading') || 'Загрузка...'}
              </p>
              {retryCount > 0 && (
                <p className="text-muted-foreground text-sm">
                  {`${t('common.attempt') || 'Попытка'} ${retryCount}/10`}
                </p>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
      </AnimatedPage>
    )
  }

  // Если нет отделов после загрузки - показываем empty state
  if (!loading && departments.length === 0) {
    return (
      <AnimatedPage>
      <PageContainer
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle') || ''}
        stickyHeader={true}
      >
        <EmptyState
          icon={Package}
          title={t('inventory.noDepartments') || 'Нет отделов'}
          description={
            t('inventory.noDepartmentsDescription') ||
            'Для этого отеля ещё не созданы отделы. Создайте отдел в настройках.'
          }
          action={{
            label: t('common.goToSettings') || 'Перейти в настройки',
            onClick: () => navigate('/settings')
          }}
        />
      </PageContainer>
      </AnimatedPage>
    )
  }

  // Если отдел не выбран и есть несколько отделов - показываем выбор
  if (!selectedDeptId && departments.length > 1) {
    return (
      <AnimatedPage>
      <PageContainer
        title={t('inventory.title')}
        subtitle={t('inventory.selectDepartment') || 'Выберите отдел'}
        stickyHeader={true}
      >
        <div className="animate-fade-in">
          <DepartmentSelector
            departments={departments}
            selectedDepartment={selectedDeptId}
            onSelect={handleSelectDepartment}
            title={t('inventory.selectDepartment') || 'Выберите отдел'}
          />
        </div>
      </PageContainer>
      </AnimatedPage>
    )
  }

  // Если отдел не выбран но есть только один - автовыбор
  if (!selectedDeptId && departments.length === 1) {
    setSelectedDeptId(departments[0].id)
    return null
  }

  return (
    <AnimatedPage>
    <>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed left-0 right-0 top-0 z-30 flex items-center justify-center py-4 bg-card/95 backdrop-blur-sm border-b border-border transition-opacity"
          style={{ height: Math.min(pullDistance, 80) }}
          role="status"
          aria-live="polite"
        >
          {pullDistance >= 80 ? (
            <Loader className="w-6 h-6 text-accent" />
          ) : (
            <span className="text-sm text-muted-foreground">
              {t('common.pullToRefresh') || 'Потяните для обновления'}
            </span>
          )}
        </div>
      )}
      <PageContainer
        title={`${t('inventory.title')} — ${department?.name || selectedDeptId}`}
        subtitle=""
        stickyHeader={true}
        actions={
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {departments.length > 1 && (
              <Tooltip content={t('common.back') || 'Назад'}>
                <span className="inline-flex">
                  <TouchButton
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToDepartments}
                    className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label={t('common.back') || 'Назад'}
                    icon={ArrowLeft}
                  />
                </span>
              </Tooltip>
            )}
            <ExportButton
              exportType="inventory"
              filters={exportFilters}
              formats={['excel', 'csv', 'pdf']}
              showFilterCount={true}
              compact={true}
            />
            <TouchButton
              variant="ghost"
              size="small"
              onClick={() => setShowSelectTemplateModal(true)}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-accent min-h-0 h-auto"
              title={t('inventory.applyTemplate')}
              aria-label={t('inventory.applyTemplate')}
              icon={FileBox}
              iconPosition="left"
            >
              <span className="hidden sm:inline">{t('inventory.applyTemplate')}</span>
            </TouchButton>
            {isDevelopment && userIsSuperAdmin && (
              <TouchButton
                variant="ghost"
                size="small"
                onClick={() => setShowClearAllConfirm(true)}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-accent min-h-0 h-auto"
                title={t('inventory.clearAll') || 'Очистить все партии'}
                aria-label={t('inventory.clearAll') || 'Очистить все партии'}
                icon={Trash2}
                iconPosition="left"
              >
                <span className="hidden sm:inline">{t('inventory.clearAll') || 'Очистить все'}</span>
              </TouchButton>
            )}
            {!userIsStaff && (
<TouchButton
              variant="ghost"
              size="small"
              onClick={() => setShowAddCustomModal(true)}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-accent min-h-0 h-auto"
              title={t('inventory.addNewProduct')}
              aria-label={t('inventory.addNewProduct')}
              icon={Plus}
              iconPosition="left"
            >
              <span className="hidden sm:inline">{t('inventory.addNewProduct')}</span>
            </TouchButton>
            )}
          </div>
        }
      >
      <div className="animate-fade-in">
      {/* Фильтры категорий и сортировка */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-8">
        {/* Категории */}
        <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 flex-1">
          <TouchButton
            variant="ghost"
            size="small"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 sm:px-4 py-2 rounded-full text-sm whitespace-nowrap flex-shrink-0 min-h-0 h-auto font-medium transition-all duration-200 ${
              selectedCategory === 'all'
                ? 'bg-accent-button text-white hover:bg-accent-button/90 shadow-sm border-0'
                : 'bg-card border border-border text-foreground hover:bg-muted/80 hover:border-muted-foreground/30'
            }`}
          >
            {t('common.all')}
          </TouchButton>
          {availableCategories.map((cat) => (
            <TouchButton
              key={cat.id}
              variant="ghost"
              size="small"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 sm:px-4 py-2 rounded-full text-sm whitespace-nowrap flex-shrink-0 min-h-0 h-auto font-medium transition-all duration-200 ${
                selectedCategory === cat.id
                  ? 'bg-accent-button text-white hover:bg-accent-button/90 shadow-sm border-0'
                  : 'bg-card border border-border text-foreground hover:bg-muted/80 hover:border-muted-foreground/30'
              }`}
            >
              {getCategoryName(cat)}
            </TouchButton>
          ))}
        </div>

        {/* Сортировка */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label={t('inventory.sortOrder') || 'Сортировка'}
            className="text-xs sm:text-sm bg-card border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="expiry">{t('inventory.sortByExpiry') || 'По сроку'}</option>
            <option value="name">{t('inventory.sortByName') || 'По названию'}</option>
            <option value="quantity">{t('inventory.sortByQuantity') || 'По количеству'}</option>
          </select>
        </div>
      </div>

      {/* Сетка товаров */}
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('inventory.noProducts') || 'Нет товаров'}
          description={t('inventory.addBatchToStart') || 'Добавьте партии товаров чтобы начать работу'}
          action={{
            label: t('inventory.applyTemplate') || 'Применить шаблон',
            onClick: () => setShowSelectTemplateModal(true),
            icon: FileBox
          }}
        />
      ) : (
        <AnimatedGrid
          columns="grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
          gap="gap-2 sm:gap-4"
          staggerDelay={40}
          className="px-1 sm:px-0"
        >
          {products.map((product) => {
            const category = categories.find((c) => c.id === product.categoryId)
            const displayCategoryName =
              product.categoryName || (category ? getCategoryName(category) : null)
            return (
              <ProductCard
                key={product.id}
                product={product}
                categoryName={displayCategoryName}
                onProductClick={handleProductClick}
                compact={isMobile}
                t={t}
              />
            )
          })}
        </AnimatedGrid>
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
          departmentId={selectedDeptId}
          onClose={() => setShowAddCustomModal(false)}
        />
      )}

      {/* Template Selection Modal - stateless */}
      {showSelectTemplateModal && (
        <SelectTemplateModal
          isOpen={true}
          onSelect={handleTemplateSelect}
          onClose={handleSelectTemplateClose}
        />
      )}

      {/* Fast Intake Modal - stateful with selected template */}
      {showFastIntakeModal && selectedTemplateId && (
        <FastIntakeModal
          isOpen={true}
          templateId={selectedTemplateId}
          departmentId={selectedDeptId}
          onChangeTemplate={handleChangeTemplate}
          onClose={handleFastIntakeClose}
          onFastApply={handleFastApply}
        />
      )}

      {/* Clear All Batches Confirmation Dialog */}
      {isDevelopment && userIsSuperAdmin && (
        <ConfirmDialog
          isOpen={showClearAllConfirm}
          onClose={() => setShowClearAllConfirm(false)}
          onConfirm={handleClearAllBatches}
          title={t('inventory.clearAll') || 'Очистить все партии'}
          description={t('inventory.confirmClearAll') || 'ВНИМАНИЕ! Это удалит ВСЕ активные партии из инвентаря. Это действие нельзя отменить.'}
          confirmLabel={t('common.confirm') || 'Подтвердить'}
          cancelLabel={t('common.cancel') || 'Отмена'}
          variant="danger"
          loading={clearingBatches}
        />
      )}
      </div>
      </PageContainer>

      {/* Export Progress Notification */}
      {exportProgress.status && (
        <ExportProgress
          status={exportProgress.status}
          filename={exportProgress.filename}
          onDismiss={dismissExportProgress}
        />
      )}
    </>
    </AnimatedPage>
  )
}
