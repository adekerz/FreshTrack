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
import { EXPORT_COLUMNS } from '../utils/exportUtils'
import { SkeletonInventory, Skeleton } from '../components/Skeleton'
import { Loader, ConfirmDialog, TouchButton } from '../components/ui'
import { usePullToRefresh } from '../hooks/usePullToRefresh'

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
  const navigate = useNavigate()
  const { getProductsByDepartment, catalog, refresh, departments, categories, loading } =
    useProducts()
  const { selectedHotelId } = useHotel()
  const { isRefreshing, pullDistance } = usePullToRefresh(refresh)
  const { user, isStaff, isSuperAdmin } = useAuth()
  const { addToast } = useToast()
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

  // Подготовка данных для экспорта (экспортируем отдельные партии, не агрегированные товары)
  const exportData = useMemo(() => {
    const products = getFilteredProducts()
    const dept = departments.find((d) => d.id === selectedDeptId)
    const exportRows = []

    // Функция для получения названия категории
    const getCategoryName = (categoryId) => {
      const cat = categories.find((c) => c.id === categoryId)
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
      // Используем categoryName с бэкенда (single source of truth), fallback на локальный поиск
      const categoryName =
        product.categoryName || getCategoryName(product.categoryId) || product.category?.name || '-'

      // Если у товара есть партии, экспортируем каждую партию отдельно
      if (product.batches && product.batches.length > 0) {
        product.batches.forEach((batch) => {
          const status = batch.status?.status || batch.status
          exportRows.push({
            productName: product.name,
            category: categoryName,
            department: dept?.name || selectedDeptId,
            quantity:
              batch.quantity === null || batch.quantity === undefined ? '—' : batch.quantity,
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
          department: dept?.name || selectedDeptId,
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
  }, [selectedDeptId, getFilteredProducts, departments, categories, language, t])

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
      <div className="p-4 sm:p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        <SkeletonInventory rows={6} />
      </div>
    )
  }

  // Если нет данных и идёт загрузка - показываем анимацию подключения к БД
  if (loading && departments.length === 0) {
    return (
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
    )
  }

  // Если нет отделов после загрузки - показываем empty state
  if (!loading && departments.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16 sm:py-24 animate-fade-in">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {t('inventory.noDepartments') || 'Нет отделов'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              {t('inventory.noDepartmentsDescription') ||
                'Для этого отеля ещё не созданы отделы. Создайте отдел в настройках.'}
            </p>
          </div>
          <TouchButton
            variant="primary"
            onClick={() => navigate('/settings')}
            className="mt-2"
          >
            {t('common.goToSettings') || 'Перейти в настройки'}
          </TouchButton>
        </div>
      </div>
    )
  }

  // Если отдел не выбран и есть несколько отделов - показываем выбор
  if (!selectedDeptId && departments.length > 1) {
    return (
      <div className="animate-fade-in">
        <DepartmentSelector
          departments={departments}
          selectedDepartment={selectedDeptId}
          onSelect={handleSelectDepartment}
          title={t('inventory.selectDepartment') || 'Выберите отдел'}
        />
      </div>
    )
  }

  // Если отдел не выбран но есть только один - автовыбор
  if (!selectedDeptId && departments.length === 1) {
    setSelectedDeptId(departments[0].id)
    return null
  }

  return (
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
      <div className="p-3 sm:p-4 md:p-8 animate-fade-in">
        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Кнопка назад если несколько отделов */}
          {departments.length > 1 && (
            <TouchButton
              variant="ghost"
              size="icon"
              onClick={handleBackToDepartments}
              className="rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              title={t('common.back') || 'Назад'}
              aria-label={t('common.back') || 'Назад'}
              icon={ArrowLeft}
            />
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${department?.color || '#C4A35A'}20` }}
            >
              {DeptIcon && (
                <DeptIcon
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  style={{ color: department?.color || '#C4A35A' }}
                />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-light text-foreground truncate">
              {t('inventory.title')} — {department?.name || selectedDeptId}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <ExportButton
            data={exportData}
            columns={EXPORT_COLUMNS.inventory(t)}
            filename={`inventory_${selectedDeptId}`}
            title={`${t('inventory.title')} - ${department?.name}`}
            subtitle={
              selectedCategory !== 'all'
                ? `${t('common.category')}: ${categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}`
                : ''
            }
          />
          <TouchButton
            variant="ghost"
            size="small"
            onClick={() => setShowSelectTemplateModal(true)}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-accent min-h-0 h-auto"
            title={t('inventory.applyTemplate')}
            icon={FileBox}
            iconPosition="left"
          >
            <span className="hidden sm:inline">{t('inventory.applyTemplate')}</span>
          </TouchButton>
          {/* Clear All Batches - DEVELOPMENT ONLY - SUPER ADMIN */}
          {isDevelopment && userIsSuperAdmin && (
            <TouchButton
              variant="ghost"
              size="small"
              onClick={() => setShowClearAllConfirm(true)}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-accent min-h-0 h-auto"
              title={t('inventory.clearAll') || 'Очистить все партии'}
              icon={Trash2}
              iconPosition="left"
            >
              <span className="hidden sm:inline">{t('inventory.clearAll') || 'Очистить все'}</span>
            </TouchButton>
          )}
          {/* Добавление товара - только для админов и менеджеров (не STAFF) */}
          {!userIsStaff && (
            <TouchButton
              variant="ghost"
              size="small"
              onClick={() => setShowAddCustomModal(true)}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-accent min-h-0 h-auto"
              title={t('inventory.addNewProduct')}
              icon={Plus}
              iconPosition="left"
            >
              <span className="hidden sm:inline">{t('inventory.addNewProduct')}</span>
            </TouchButton>
          )}
        </div>
      </div>

      {/* Фильтры категорий и сортировка */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-8">
        {/* Категории */}
        <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 flex-1">
          <TouchButton
            variant="ghost"
            size="small"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm whitespace-nowrap flex-shrink-0 min-h-0 h-auto ${
              selectedCategory === 'all'
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-transparent border border-border text-muted-foreground hover:border-foreground hover:text-foreground'
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
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm whitespace-nowrap flex-shrink-0 min-h-0 h-auto ${
                selectedCategory === cat.id
                  ? 'bg-foreground text-background hover:bg-foreground/90'
                  : 'bg-transparent border border-border text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {getCategoryName(cat)}
            </TouchButton>
          ))}
        </div>

        {/* Сортировка */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
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
        <div className="text-center py-12 sm:py-16">
          <Package className="w-12 h-12 sm:w-16 sm:h-16 text-muted mx-auto mb-4" />
          <p className="text-muted-foreground text-base sm:text-lg">{t('inventory.noProducts')}</p>
          <p className="text-muted-foreground/70 text-xs sm:text-sm mt-2">
            {t('inventory.addBatchToStart')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 px-1 sm:px-0">
          {products.map((product) => {
            // Используем categoryName с бэкенда (single source of truth), fallback на локальный поиск
            const category = categories.find((c) => c.id === product.categoryId)
            const displayCategoryName =
              product.categoryName || (category ? getCategoryName(category) : null)
            return (
              <TouchButton
                key={product.id}
                variant="ghost"
                onClick={() => handleProductClick(product)}
                className="w-full h-auto min-h-0 justify-start items-stretch bg-card border border-border rounded-lg p-2.5 sm:p-4 text-left hover:shadow-md hover:border-accent group overflow-hidden"
              >
                {/* Статус индикатор */}
                <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h3 className="font-medium text-foreground group-hover:text-accent transition-colors text-sm sm:text-base truncate">
                      {product.name}
                    </h3>
                    {displayCategoryName && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded mt-1 inline-block truncate max-w-full">
                        {displayCategoryName}
                      </span>
                    )}
                  </div>
                  {product.totalBatches > 0 && (
                    <div
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${statusColors[product.overallStatus]}`}
                      title={product.overallStatus}
                    />
                  )}
                </div>

                {/* Информация о партиях */}
                <div className="text-xs sm:text-sm text-muted-foreground overflow-hidden">
                  {product.totalBatches === 0 ? (
                    <span className="text-muted-foreground/50">{t('inventory.noBatches')}</span>
                  ) : (
                    <div className="flex flex-wrap gap-x-1.5 items-center">
                      <span className="whitespace-nowrap">
                        <span className="font-medium text-foreground">{product.totalBatches}</span>{' '}
                        {t('inventory.batches')}
                      </span>
                      <span className="flex-shrink-0">•</span>
                      <span className="whitespace-nowrap">
                        <span className="font-medium text-foreground">{product.totalQuantity}</span>{' '}
                        {t('inventory.units')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Предупреждения */}
                {product.hasExpired && (
                  <div className="mt-2 text-xs text-danger flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0 mt-0.5" />
                    <span className="flex-1 leading-relaxed">{t('inventory.hasExpired')}</span>
                  </div>
                )}
                {!product.hasExpired && product.hasExpiringSoon && (
                  <div className="mt-2 text-xs text-warning flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0 mt-0.5" />
                    <span className="flex-1 leading-relaxed">{t('inventory.expiringSoon')}</span>
                  </div>
                )}
              </TouchButton>
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
    </>
  )
}
