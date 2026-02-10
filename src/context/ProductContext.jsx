/**
 * FreshTrack Enterprise Product Context
 * Data loaded from API - NO hardcoded data
 * 
 * MIGRATED TO REACT QUERY (v5)
 * - Uses React Query for server state management
 * - Maintains backward compatibility through wrapper API
 * - Optimistic updates for better UX
 * - Automatic caching and synchronization
 */

import { createContext, useContext, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getBatchStatus } from '../utils/dateUtils'
import { logDebug, logWarn, logError } from '../utils/logger'
import { useHotel } from './HotelContext'
import { useAuth } from './AuthContext'
import { invalidateInventoryQueries } from '../lib/queryClient'
import {
  useInventoryData,
  useAddBatch as useAddBatchMutation,
  useAddBatchesBulk as useAddBatchesBulkMutation,
  useCollectBatch as useCollectBatchMutation,
  useDeleteBatch as useDeleteBatchMutation,
  useAddProduct as useAddProductMutation,
  useDeleteProduct as useDeleteProductMutation
} from '../hooks/useInventory'

const ProductContext = createContext(null)

// Legacy exports for backwards compatibility - will be populated from state
export let departments = []
export let categories = []

// Default department icon mapping (can be customized per department in DB)
const DEFAULT_DEPARTMENT_ICONS = {
  restaurant: 'Utensils',
  bar: 'Wine',
  kitchen: 'ChefHat',
  storage: 'Warehouse',
  minibar: 'Coffee',
  cafe: 'Coffee',
  default: 'Package'
}

export function ProductProvider({ children }) {
  // Получаем выбранный отель из HotelContext
  const { selectedHotelId, loading: hotelLoading } = useHotel()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const prevHotelIdRef = useRef(null)

  // === REACT QUERY DATA LOADING ===
  // Заменяет старый fetchAllData - React Query управляет загрузкой, кэшированием и синхронизацией
  const {
    batches: batchesData,
    stats: statsData,
    departments: departmentsData,
    categories: categoriesData,
    products: productsData,
    loading: queryLoading,
    error: queryError
  } = useInventoryData(selectedHotelId)

  // === MUTATIONS ===
  const addBatchMutation = useAddBatchMutation(selectedHotelId)
  const addBatchesBulkMutation = useAddBatchesBulkMutation(selectedHotelId)
  const collectBatchMutation = useCollectBatchMutation(selectedHotelId)
  const deleteBatchMutation = useDeleteBatchMutation(selectedHotelId)
  const addProductMutation = useAddProductMutation(selectedHotelId)
  const deleteProductMutation = useDeleteProductMutation(selectedHotelId)

  // Очистка кэша при смене отеля (React Query автоматически перезагрузит данные)
  useEffect(() => {
    // Ждём пока HotelContext загрузится
    if (hotelLoading) return

    // Не обрабатываем для pending пользователей
    const isPending =
      user?.status === 'pending' || (!user?.hotel_id && user?.role !== 'SUPER_ADMIN')
    if (isPending) return

    // Для SUPER_ADMIN ждём пока selectedHotelId будет установлен
    if (user?.role === 'SUPER_ADMIN' && !selectedHotelId) {
      logDebug('⏳ Waiting for hotel selection (SUPER_ADMIN)...')
      return
    }

    // Если отель изменился, инвалидируем все queries
    if (prevHotelIdRef.current !== selectedHotelId && prevHotelIdRef.current !== null) {
      logDebug('🏨 Hotel changed, invalidating queries for new hotel:', selectedHotelId)

      // React Query автоматически перезагрузит данные благодаря invalidation
      invalidateInventoryQueries(queryClient, selectedHotelId)
    }

    prevHotelIdRef.current = selectedHotelId
  }, [selectedHotelId, hotelLoading, user?.status, queryClient])

  // === BUILD CATALOG from React Query data ===
  // Построение каталога из загруженных данных (мемоизировано для оптимизации)
  const catalog = useMemo(() => {
    if (!departmentsData || !categoriesData || !productsData) return {}
    if (departmentsData.length === 0) return {}

    logDebug('📦 Building catalog from React Query data')
    logDebug('🏢 Departments:', departmentsData.length)
    logDebug('📂 Categories:', categoriesData.length)
    logDebug('🛍️ Products:', productsData.length)

    const newCatalog = {}

    departmentsData.forEach((dept) => {
      newCatalog[dept.id] = {}

      // Фильтруем товары ТОЛЬКО для этого отдела
      const deptProducts = productsData.filter((p) => {
        const pDeptId = p.departmentId || p.department_id
        return pDeptId === dept.id
      })

      categoriesData.forEach((cat) => {
        // Добавляем товары этой категории И этого отдела
        const categoryProducts = deptProducts.filter((p) => {
          const pCatId = p.categoryId || p.category_id
          return pCatId === cat.id
        })

        if (categoryProducts.length > 0) {
          newCatalog[dept.id][cat.id] = categoryProducts.map((product) => ({
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            defaultShelfLife: product.defaultShelfLife || product.default_shelf_life,
            unit: product.unit || 'шт',
            departmentId: product.departmentId || product.department_id
          }))
        }
      })

      // Также добавляем товары без категории
      const uncategorizedProducts = deptProducts.filter((p) => {
        const pCatId = p.categoryId || p.category_id
        return !pCatId
      })
      if (uncategorizedProducts.length > 0) {
        newCatalog[dept.id]['uncategorized'] = uncategorizedProducts.map((product) => ({
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          defaultShelfLife: product.defaultShelfLife || product.default_shelf_life,
          unit: product.unit || 'шт',
          departmentId: product.departmentId || product.department_id
        }))
      }
    })

    return newCatalog
  }, [departmentsData, categoriesData, productsData])

  // === WRAPPER METHODS for backward compatibility ===
  // Обертки над React Query mutations, сохраняющие старый API

  /**
   * Обновить данные (инвалидация queries)
   * DEPRECATED: React Query автоматически обновляет данные после мутаций
   */
  const refresh = useCallback(() => {
    logDebug('🔄 Manual refresh called (invalidating queries)')
    return invalidateInventoryQueries(queryClient, selectedHotelId)
  }, [queryClient, selectedHotelId])

  /**
   * Добавить партию товара
   * @deprecated Используйте addBatchMutation напрямую для лучшего контроля
   */
  const addBatch = useCallback(
    async (productIdOrName, departmentId, expiryDate, quantity) => {
      try {
        // Найти название продукта в каталоге (если передан id) или использовать напрямую
        let productName = productIdOrName
        let category = 'other'

        const deptCatalog = catalog[departmentId] || {}
        for (const [catId, products] of Object.entries(deptCatalog)) {
          const product = products.find(
            (p) => p.id === productIdOrName || p.name === productIdOrName
          )
          if (product) {
            productName = product.name
            category = catId
            break
          }
        }

        // Используем React Query mutation
        const result = await addBatchMutation.mutateAsync({
          productName,
          department: departmentId,
          category,
          quantity,
          expiryDate
        })

        return result
      } catch (err) {
        logError('Error adding batch:', err)
        throw err
      }
    },
    [catalog, addBatchMutation]
  )

  /**
   * Отметить партию как собранную
   */
  const collectBatch = useCallback(
    async (batchId, reason = 'manual', comment = '') => {
      try {
        await collectBatchMutation.mutateAsync({ batchId, reason, comment })
        return true
      } catch (err) {
        logError('Error collecting batch:', err)
        throw err
      }
    },
    [collectBatchMutation]
  )

  /**
   * Удалить партию
   */
  const deleteBatch = useCallback(
    async (batchId) => {
      try {
        await deleteBatchMutation.mutateAsync(batchId)
        return true
      } catch (err) {
        logError('Error deleting batch:', err)
        throw err
      }
    },
    [deleteBatchMutation]
  )

  /**
   * Добавить новый товар в каталог (сохраняет в БД на сервере)
   */
  const addCustomProduct = useCallback(
    async (departmentId, categoryId, name) => {
      try {
        const result = await addProductMutation.mutateAsync({
          name,
          categoryId,
          departmentId
        })
        return result
      } catch (error) {
        logError('Error adding custom product:', error)
        throw error
      }
    },
    [addProductMutation]
  )

  /**
   * Получить партии по ID продукта
   */
  const getBatchesByProduct = useCallback(
    (productName, departmentId = null) => {
      return batchesData
        .filter((b) => {
          // Проверяем совпадение имени продукта (productName или name)
          const batchName = b.productName || b.name || b.product_name
          const nameMatch =
            batchName === productName || batchName?.toLowerCase() === productName?.toLowerCase()
          // Проверяем совпадение отдела (department или departmentId)
          const batchDept = b.department || b.departmentId
          const deptMatch = !departmentId || batchDept === departmentId
          return nameMatch && deptMatch
        })
        .map((b) => {
          const statusInfo = getBatchStatus(b)
          return {
            ...b,
            daysLeft: statusInfo.daysLeft,
            status: statusInfo
          }
        })
        .sort((a, b) => a.daysLeft - b.daysLeft)
    },
    [batchesData]
  )

  /**
   * Получить товары отдела с информацией о партиях
   * Включает как товары из каталога, так и custom товары из батчей
   * ВАЖНО: Показываем только товары, у которых есть партии в этом отделе
   */
  const getProductsByDepartment = useCallback(
    (departmentId) => {
      const departmentCatalog = catalog[departmentId] || {}
      const products = []
      const addedProductNames = new Set()

      // 1. Добавляем товары из каталога с их батчами
      // ТОЛЬКО если у товара есть партии в этом отделе
      Object.entries(departmentCatalog).forEach(([categoryId, categoryProducts]) => {
        categoryProducts.forEach((product) => {
          const productBatches = batchesData
            .filter((b) => {
              // Проверяем совпадение имени продукта
              const nameMatch = b.productName === product.name
              // Проверяем совпадение отдела (поддержка обоих форматов: department и departmentId)
              const batchDeptId = b.departmentId || b.department
              const deptMatch = batchDeptId === departmentId
              return nameMatch && deptMatch
            })
            .map((b) => {
              const statusInfo = getBatchStatus(b)
              return {
                ...b,
                daysLeft: statusInfo.daysLeft,
                status: statusInfo
              }
            })

          // Определяем общий статус товара
          let overallStatus = 'good'
          let totalQuantity = 0
          let hasNoQuantity = false

          productBatches.forEach((batch) => {
            if (batch.quantity === null || batch.quantity === undefined) {
              hasNoQuantity = true
            } else {
              totalQuantity += batch.quantity
            }
            const status = batch.status?.status || batch.status
            if (status === 'expired') {
              overallStatus = 'expired'
            } else if (status === 'critical' && overallStatus !== 'expired') {
              overallStatus = 'critical'
            } else if (
              status === 'warning' &&
              overallStatus !== 'expired' &&
              overallStatus !== 'critical'
            ) {
              overallStatus = 'warning'
            }
          })

          // ✅ ИСПРАВЛЕНО: Показываем товар ТОЛЬКО если у него есть партии
          if (productBatches.length > 0) {
            products.push({
              ...product,
              categoryId,
              departmentId,
              batches: productBatches,
              totalBatches: productBatches.length,
              totalQuantity: hasNoQuantity && totalQuantity === 0 ? '—' : totalQuantity,
              overallStatus,
              hasExpired: productBatches.some((b) => (b.status?.status || b.status) === 'expired'),
              hasExpiringSoon: productBatches.some((b) =>
                ['critical', 'warning', 'today'].includes(b.status?.status || b.status)
              )
            })

            addedProductNames.add(product.name)
          }
        })
      })

      // 2. Добавляем custom товары из батчей, которых нет в каталоге
      const departmentBatches = batchesData.filter((b) => {
        const batchDeptId = b.departmentId || b.department
        return batchDeptId === departmentId && !addedProductNames.has(b.productName)
      })

      // Группируем батчи по имени продукта
      const customProductsMap = new Map()
      departmentBatches.forEach((b) => {
        if (!customProductsMap.has(b.productName)) {
          customProductsMap.set(b.productName, [])
        }
        const statusInfo = getBatchStatus(b)
        customProductsMap.get(b.productName).push({
          ...b,
          daysLeft: statusInfo.daysLeft,
          status: statusInfo
        })
      })

      // Добавляем custom товары
      customProductsMap.forEach((productBatches, productName) => {
        let overallStatus = 'good'
        let totalQuantity = 0
        let hasNoQuantity = false

        productBatches.forEach((batch) => {
          if (batch.quantity === null || batch.quantity === undefined) {
            hasNoQuantity = true
          } else {
            totalQuantity += batch.quantity
          }
          const status = batch.status?.status || batch.status
          if (status === 'expired') {
            overallStatus = 'expired'
          } else if (status === 'critical' && overallStatus !== 'expired') {
            overallStatus = 'critical'
          } else if (
            status === 'warning' &&
            overallStatus !== 'expired' &&
            overallStatus !== 'critical'
          ) {
            overallStatus = 'warning'
          }
        })

        products.push({
          // ✅ ИСПРАВЛЕНО: Используем настоящий product_id из БД вместо синтетического ID
          id: productBatches[0]?.product_id || productBatches[0]?.productId || `custom-${productName}`,
          name: productName,
          // Используем categoryId или category_id с бэкенда
          categoryId: productBatches[0]?.categoryId || productBatches[0]?.category_id || 'other',
          // Сохраняем categoryName с бэкенда для отображения (single source of truth)
          categoryName: productBatches[0]?.categoryName || productBatches[0]?.category_name || null,
          departmentId,
          batches: productBatches,
          totalBatches: productBatches.length,
          totalQuantity: hasNoQuantity && totalQuantity === 0 ? '—' : totalQuantity,
          overallStatus,
          hasExpired: productBatches.some((b) => (b.status?.status || b.status) === 'expired'),
          hasExpiringSoon: productBatches.some((b) =>
            ['critical', 'warning', 'today'].includes(b.status?.status || b.status)
          ),
          isCustomProduct: true
        })
      })

      return products
    },
    [catalog, batchesData]
  )

  /**
   * Получить все категории отдела
   */
  const getCategoriesForDepartment = useCallback(
    (departmentId) => {
      const departmentCatalog = catalog[departmentId] || {}
      return categoriesData.filter(
        (cat) => departmentCatalog[cat.id] && departmentCatalog[cat.id].length > 0
      )
    },
    [catalog, categoriesData]
  )

  /**
   * Получить все активные партии
   */
  const getActiveBatches = useCallback(() => {
    return batchesData
      .map((b) => {
        const statusInfo = getBatchStatus(b)
        return {
          ...b,
          daysLeft: statusInfo.daysLeft,
          status: statusInfo
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [batchesData])

  /**
   * Получить партии по статусу
   * Использует expiryStatus с backend (Single Source of Truth)
   * Статусы: EXPIRED, CRITICAL, WARNING, GOOD (определяются на backend через SettingsService)
   */
  const getBatchesByStatus = useCallback(
    (statusFilter) => {
      return getActiveBatches().filter((b) => {
        // Используем статус с backend (приоритет) или fallback на локальный
        const status = (b.expiryStatus || b.status?.status || '').toUpperCase()
        const daysLeft = b.daysLeft

        if (statusFilter === 'expired') return status === 'EXPIRED' || daysLeft < 0
        if (statusFilter === 'critical')
          return status === 'CRITICAL' || (status !== 'EXPIRED' && daysLeft >= 0 && daysLeft <= 3)
        if (statusFilter === 'warning')
          return (
            status === 'WARNING' ||
            (status !== 'CRITICAL' && status !== 'EXPIRED' && daysLeft > 3 && daysLeft <= 7)
          )
        if (statusFilter === 'attention')
          return ['CRITICAL', 'WARNING'].includes(status) || (daysLeft >= 0 && daysLeft <= 14)
        if (statusFilter === 'good') return status === 'GOOD' || status === 'OK' || daysLeft > 7
        return true
      })
    },
    [getActiveBatches]
  )

  /**
   * Получить статистику
   */
  const getStats = useCallback(() => {
    return statsData
  }, [statsData])

  /**
   * Получить количество непрочитанных уведомлений
   */
  const getUnreadNotificationsCount = useCallback(() => {
    return statsData.needsAttention || 0
  }, [statsData])

  /**
   * Получить алерты (партии требующие внимания)
   * Использует статус с backend вместо hardcoded порога
   */
  const getAlerts = useCallback(() => {
    return getActiveBatches()
      .filter((b) => {
        const status = (b.expiryStatus || b.status?.status || '').toUpperCase()
        // Алерты: EXPIRED, CRITICAL, WARNING (из backend)
        return ['EXPIRED', 'CRITICAL', 'WARNING'].includes(status) || b.daysLeft <= 7
      })
      .map((b) => ({
        ...b,
        productName: b.productName,
        categoryId: b.category,
        department: departmentsData.find((d) => d.id === b.department)
      }))
  }, [getActiveBatches, departmentsData])

  /**
   * Найти продукт по ID в каталоге
   */
  const findProduct = useCallback(
    (productId) => {
      for (const [deptId, deptCatalog] of Object.entries(catalog)) {
        for (const [catId, products] of Object.entries(deptCatalog)) {
          const product = products.find((p) => p.id === productId)
          if (product) {
            return { ...product, departmentId: deptId, categoryId: catId }
          }
        }
      }
      return null
    },
    [catalog]
  )

  /**
   * Удалить товар из каталога (только для SUPER_ADMIN и HOTEL_ADMIN)
   */
  const deleteProduct = useCallback(
    async (productId) => {
      try {
        await deleteProductMutation.mutateAsync(productId)
        return true
      } catch (error) {
        logError('Error deleting product:', error)
        throw error
      }
    },
    [deleteProductMutation]
  )

  // Обновляем legacy exports для обратной совместимости
  useEffect(() => {
    departments = departmentsData
    categories = categoriesData
  }, [departmentsData, categoriesData])

  const getDepartmentIcon = useCallback((deptId) => {
    const dept = departmentsData.find((d) => d.id === deptId || d.code === deptId)
    return dept?.icon || DEFAULT_DEPARTMENT_ICONS[dept?.type] || DEFAULT_DEPARTMENT_ICONS.default
  }, [departmentsData])

  const mutations = useMemo(() => ({
    addBatch: addBatchMutation,
    addBatchesBulk: addBatchesBulkMutation,
    collectBatch: collectBatchMutation,
    deleteBatch: deleteBatchMutation,
    addProduct: addProductMutation,
    deleteProduct: deleteProductMutation
  }), [addBatchMutation, addBatchesBulkMutation, collectBatchMutation, deleteBatchMutation, addProductMutation, deleteProductMutation])

  const value = useMemo(() => ({
    // Данные (из React Query)
    catalog,
    batches: batchesData,
    departments: departmentsData,
    categories: categoriesData,
    loading: queryLoading,
    error: queryError,
    stats: statsData,

    // Операции с партиями (обертки над mutations)
    addBatch,
    collectBatch,
    deleteBatch,
    refresh,

    // Операции с каталогом
    addCustomProduct,
    deleteProduct,

    // Получение данных
    getBatchesByProduct,
    getProductsByDepartment,
    getCategoriesForDepartment,
    getActiveBatches,
    getBatchesByStatus,
    getStats,
    getUnreadNotificationsCount,
    getAlerts,
    findProduct,

    // Хелпер для иконок отделов
    getDepartmentIcon,

    // React Query mutations (для прямого использования в компонентах)
    mutations
  }), [
    catalog, batchesData, departmentsData, categoriesData, queryLoading, queryError, statsData,
    addBatch, collectBatch, deleteBatch, refresh,
    addCustomProduct, deleteProduct,
    getBatchesByProduct, getProductsByDepartment, getCategoriesForDepartment,
    getActiveBatches, getBatchesByStatus, getStats, getUnreadNotificationsCount, getAlerts, findProduct,
    getDepartmentIcon, mutations
  ])

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export function useProducts() {
  const context = useContext(ProductContext)
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider')
  }
  return context
}
