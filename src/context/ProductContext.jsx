/**
 * FreshTrack Enterprise Product Context
 * Data loaded from API - NO hardcoded data
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getBatchStatus } from '../utils/dateUtils'
import { logDebug, logWarn, logError } from '../utils/logger'
import { apiFetch } from '../services/api'
import { useHotel } from './HotelContext'
import { useAuth } from './AuthContext'

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
  const prevHotelIdRef = useRef(null)
  const initialLoadDoneRef = useRef(false)
  const fetchingRef = useRef(false) // Предотвращает параллельные вызовы
  const currentFetchHotelRef = useRef(null) // Какой отель сейчас загружается

  // Каталог товаров (только в памяти, без localStorage - данные загружаются с сервера)
  const [catalog, setCatalog] = useState({})

  // Динамические отделы и категории с сервера
  const [departmentList, setDepartmentList] = useState([])
  const [categoryList, setCategoryList] = useState([])

  // Партии с сервера
  const [batches, setBatches] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    expired: 0,
    critical: 0,
    warning: 0,
    good: 0,
    needsAttention: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Загрузка данных с сервера при монтировании и при смене отеля
  useEffect(() => {
    const token = localStorage.getItem('freshtrack_token')

    // Ждём пока HotelContext загрузится
    if (hotelLoading) return

    // Не загружаем данные для pending пользователей (проверяем status и hotel_id)
    const isPending =
      user?.status === 'pending' || (!user?.hotel_id && user?.role !== 'SUPER_ADMIN')
    if (isPending) {
      setLoading(false)
      return
    }

    if (!token) {
      setLoading(false)
      return
    }

    // Для SUPER_ADMIN ждём пока selectedHotelId будет установлен
    // Это предотвращает запросы без hotel_id
    if (user?.role === 'SUPER_ADMIN' && !selectedHotelId) {
      logDebug('⏳ Waiting for hotel selection (SUPER_ADMIN)...')
      return
    }

    // Первая загрузка - всегда выполняем
    if (!initialLoadDoneRef.current) {
      logDebug('🚀 Initial data load for hotel:', selectedHotelId || 'default')
      initialLoadDoneRef.current = true
      prevHotelIdRef.current = selectedHotelId
      fetchAllData(selectedHotelId)
      return
    }

    // Повторные загрузки - только если отель изменился
    if (prevHotelIdRef.current !== selectedHotelId) {
      logDebug('🏨 Hotel changed, reloading data for hotel:', selectedHotelId)

      // ВАЖНО: Очищаем данные СРАЗУ при смене отеля, чтобы не показывать старые
      setCatalog({})
      setDepartmentList([])
      setCategoryList([])
      setBatches([])
      setStats({ total: 0, expired: 0, critical: 0, warning: 0, good: 0, needsAttention: 0 })

      prevHotelIdRef.current = selectedHotelId
      fetchAllData(selectedHotelId)
    }
  }, [selectedHotelId, hotelLoading, user?.status])

  /**
   * Загрузить все данные с сервера
   * @param {number} hotelId - ID выбранного отеля (для SUPER_ADMIN)
   */
  const fetchAllData = async (hotelId = null) => {
    // Запоминаем для какого отеля загружаем
    currentFetchHotelRef.current = hotelId

    // Если уже идёт загрузка для другого отеля - она станет неактуальной
    // Не блокируем, просто предупреждаем
    if (fetchingRef.current) {
      logDebug('⏳ fetchAllData already in progress, will override with new hotel:', hotelId)
    }

    fetchingRef.current = true

    try {
      setLoading(true)
      setError(null)

      // Формируем query strings
      // limit=200 (максимум сервера) чтобы загрузить больше партий и продуктов (по умолчанию 50)
      const baseQuery = hotelId ? `?hotel_id=${hotelId}` : ''
      const paginatedQuery = hotelId ? `?hotel_id=${hotelId}&limit=200` : '?limit=200'

      // Загружаем батчи, статистику, отделы, категории и продукты параллельно
      const [batchesRes, statsRes, departmentsRes, categoriesRes, productsRes] = await Promise.all([
        apiFetch(`/batches${paginatedQuery}`),
        apiFetch(`/batches/stats${baseQuery}`),
        apiFetch(`/departments${baseQuery}`).catch(() => ({ departments: [] })),
        apiFetch(`/categories${baseQuery}`).catch(() => ({ categories: [] })),
        apiFetch(`/products${paginatedQuery}`).catch(() => [])
      ])

      // ВАЖНО: Проверяем что отель не сменился пока шёл запрос
      if (currentFetchHotelRef.current !== hotelId) {
        logDebug('🔄 Hotel changed during fetch, discarding stale data for:', hotelId)
        return // Не применяем устаревшие данные
      }

      // API возвращает { success: true, batches: [...] } или массив
      const batchesRaw = Array.isArray(batchesRes) ? batchesRes : batchesRes.batches || []

      // Contract validation: проверяем что backend возвращает enriched данные
      const validateBatchContract = (batch) => {
        const requiredFields = ['expiryStatus', 'statusColor', 'daysLeft']
        const missingFields = requiredFields.filter((field) => batch[field] === undefined)
        if (missingFields.length > 0 && batch.expiry_date) {
          console.warn(
            `⚠️ Backend contract warning: Missing enriched fields [${missingFields.join(', ')}] for batch ${batch.id}. Falling back to local calculation.`
          )
        }
        return missingFields.length === 0
      }

      // Нормализация snake_case → camelCase для совместимости
      // Backend enriches batches with expiryStatus, statusColor, daysLeft, statusText
      const batchesData = batchesRaw.map((b) => {
        const expiryDate = b.expiry_date || b.expiryDate

        // Validate contract (warning only, not blocking)
        const hasEnrichedData = validateBatchContract(b)

        // Use getBatchStatus which prefers backend data, falls back to local calculation
        const statusInfo = getBatchStatus(b)
        return {
          ...b,
          productId: b.product_id || b.productId,
          productName: b.product_name || b.productName,
          departmentId: b.department_id || b.departmentId,
          departmentName: b.department_name || b.departmentName,
          categoryId: b.category_id || b.categoryId,
          categoryName: b.category_name || b.categoryName,
          expiryDate,
          addedBy: b.added_by_name || b.added_by || b.addedBy,
          collectedAt: b.collected_at || b.collectedAt,
          collectedBy: b.collected_by || b.collectedBy,
          hotelId: b.hotel_id || b.hotelId,
          batchNumber: b.batch_number || b.batchNumber,
          // Backend Single Source of Truth for expiry data
          daysLeft: statusInfo.daysLeft,
          status: statusInfo,
          expiryStatus: statusInfo.status,
          statusColor: statusInfo.color,
          statusText: statusInfo.statusText,
          isExpired: statusInfo.isExpired,
          isUrgent: statusInfo.isUrgent,
          // Flag for debugging
          _hasEnrichedData: hasEnrichedData
        }
      })
      setBatches(batchesData)

      // API возвращает { success: true, stats: {...} } или объект
      const statsData = statsRes.stats || statsRes || {}
      setStats(statsData)

      // Обновляем динамические отделы (API возвращает { departments: [...] } или массив)
      const deptData = Array.isArray(departmentsRes)
        ? departmentsRes
        : departmentsRes.departments || []
      if (Array.isArray(deptData)) {
        setDepartmentList(deptData)
        // Обновляем legacy export для обратной совместимости
        departments = deptData
      }

      // Обновляем динамические категории (API возвращает { categories: [...] })
      const catData = Array.isArray(categoriesRes) ? categoriesRes : categoriesRes.categories || []
      if (Array.isArray(catData)) {
        setCategoryList(catData)
        categories = catData
      }

      // Обновляем каталог продуктов из API
      // API возвращает { items: [...], page, limit } или массив
      const productsData = Array.isArray(productsRes)
        ? productsRes
        : productsRes.items || productsRes.products || []
      logDebug('📦 Products from API:', productsData.length)
      logDebug('🏢 Departments:', deptData.length)
      logDebug('📂 Categories:', catData.length)

      if (productsData.length > 0 && deptData.length > 0) {
        // Строим каталог: department -> category -> products
        // Продукты в БД не привязаны к отделам, поэтому показываем их во всех отделах
        const newCatalog = {}

        deptData.forEach((dept) => {
          newCatalog[dept.id] = {}
          catData.forEach((cat) => {
            // Добавляем продукты этой категории для каждого отдела
            const categoryProducts = productsData.filter((p) => {
              const pCatId = p.categoryId || p.category_id
              return pCatId === cat.id
            })

            newCatalog[dept.id][cat.id] = categoryProducts.map((product) => ({
              id: product.id,
              name: product.name,
              barcode: product.barcode,
              defaultShelfLife: product.defaultShelfLife || product.default_shelf_life,
              unit: product.unit || 'шт'
            }))
          })
        })

        logDebug('📋 New catalog built')
        setCatalog(newCatalog)
      } else {
        logWarn('⚠️ No products or departments loaded')
      }
    } catch (err) {
      logError('fetchAllData', err)
      setError(err.message)
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }

  /**
   * Обновить данные (вызывать после изменений)
   */
  const refresh = useCallback(() => {
    return fetchAllData(selectedHotelId)
  }, [selectedHotelId])

  /**
   * Добавить партию товара
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

        const newBatchRes = await apiFetch('/batches', {
          method: 'POST',
          body: JSON.stringify({
            productName,
            department: departmentId,
            category,
            quantity: quantity === null || quantity === undefined ? null : parseInt(quantity),
            expiryDate
          })
        })

        // Нормализация ответа сервера
        const batchData = newBatchRes.batch || newBatchRes
        const newBatch = {
          ...batchData,
          productId: batchData.product_id || batchData.productId,
          productName: batchData.product_name || batchData.productName || productName,
          departmentId: batchData.department_id || batchData.departmentId || departmentId,
          expiryDate: batchData.expiry_date || batchData.expiryDate || expiryDate
        }

        // Обновить локальные данные (используем getBatchStatus для временного отображения)
        const statusInfo = getBatchStatus(newBatch)
        setBatches((prev) => [
          ...prev,
          {
            ...newBatch,
            daysLeft: statusInfo.daysLeft,
            status: statusInfo,
            expiryStatus: statusInfo.status,
            statusColor: statusInfo.color,
            statusText: statusInfo.statusText,
            isExpired: statusInfo.isExpired,
            isUrgent: statusInfo.isUrgent
          }
        ])

        // Обновить статистику
        await fetchAllData()

        return newBatch
      } catch (err) {
        logError('Error adding batch:', err)
        throw err
      }
    },
    [catalog]
  )

  /**
   * Отметить партию как собранную
   */
  const collectBatch = useCallback(async (batchId, reason = 'manual', comment = '') => {
    try {
      await apiFetch(`/batches/${batchId}/collect`, {
        method: 'POST',
        body: JSON.stringify({ reason, comment })
      })

      // Удалить из локального списка
      setBatches((prev) => prev.filter((b) => b.id !== batchId))

      // Обновить статистику
      await fetchAllData()

      return true
    } catch (err) {
      logError('Error collecting batch:', err)
      throw err
    }
  }, [])

  /**
   * Удалить партию
   */
  const deleteBatch = useCallback(async (batchId) => {
    try {
      await apiFetch(`/batches/${batchId}`, {
        method: 'DELETE'
      })

      // Удалить из локального списка
      setBatches((prev) => prev.filter((b) => b.id !== batchId))

      // Обновить статистику
      await fetchAllData()

      return true
    } catch (err) {
      logError('Error deleting batch:', err)
      throw err
    }
  }, [])

  /**
   * Добавить новый товар в каталог (сохраняет в БД на сервере)
   */
  const addCustomProduct = useCallback(async (departmentId, categoryId, name) => {
    try {
      // Создать продукт на сервере
      const response = await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          categoryId: categoryId || null,
          departmentId: departmentId || null
        })
      })

      const newProduct = response.product || response

      // Обновить локальный каталог
      setCatalog((prev) => {
        const updated = { ...prev }
        if (!updated[departmentId]) {
          updated[departmentId] = {}
        }
        if (!updated[departmentId][categoryId]) {
          updated[departmentId][categoryId] = []
        }
        updated[departmentId][categoryId] = [
          ...updated[departmentId][categoryId],
          {
            id: newProduct.id,
            name: newProduct.name,
            isCustom: true
          }
        ]
        return updated
      })

      return newProduct
    } catch (error) {
      logError('Error adding custom product:', error)

      // Fallback: добавить только в локальный каталог
      const productId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      const newProduct = { id: productId, name, isCustom: true }

      setCatalog((prev) => {
        const updated = { ...prev }
        if (!updated[departmentId]) {
          updated[departmentId] = {}
        }
        if (!updated[departmentId][categoryId]) {
          updated[departmentId][categoryId] = []
        }
        updated[departmentId][categoryId] = [...updated[departmentId][categoryId], newProduct]
        return updated
      })

      return newProduct
    }
  }, [])

  /**
   * Получить партии по ID продукта
   */
  const getBatchesByProduct = useCallback(
    (productName, departmentId = null) => {
      return batches
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
    [batches]
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
          const productBatches = batches
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
        })
      })

      // 2. Добавляем custom товары из батчей, которых нет в каталоге
      const departmentBatches = batches.filter((b) => {
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
          id: `custom-${productName}`,
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
    [catalog, batches]
  )

  /**
   * Получить все категории отдела
   */
  const getCategoriesForDepartment = useCallback(
    (departmentId) => {
      const departmentCatalog = catalog[departmentId] || {}
      return categories.filter(
        (cat) => departmentCatalog[cat.id] && departmentCatalog[cat.id].length > 0
      )
    },
    [catalog]
  )

  /**
   * Получить все активные партии
   */
  const getActiveBatches = useCallback(() => {
    return batches
      .map((b) => {
        const statusInfo = getBatchStatus(b)
        return {
          ...b,
          daysLeft: statusInfo.daysLeft,
          status: statusInfo
        }
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [batches])

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
    return stats
  }, [stats])

  /**
   * Получить количество непрочитанных уведомлений
   */
  const getUnreadNotificationsCount = useCallback(() => {
    return stats.needsAttention || 0
  }, [stats])

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
        department: departments.find((d) => d.id === b.department)
      }))
  }, [getActiveBatches])

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
  const deleteProduct = useCallback(async (productId) => {
    try {
      await apiFetch(`/products/${productId}`, {
        method: 'DELETE'
      })

      // Удалить из локального каталога
      setCatalog((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((deptId) => {
          Object.keys(updated[deptId]).forEach((catId) => {
            updated[deptId][catId] = updated[deptId][catId].filter(
              (product) => product.id !== productId
            )
          })
        })
        return updated
      })

      // Удалить связанные партии из локального состояния
      setBatches((prev) =>
        prev.filter((b) => b.productId !== productId && b.product_id !== productId)
      )

      return true
    } catch (error) {
      logError('Error deleting product:', error)
      throw error
    }
  }, [])

  const value = {
    // Данные
    catalog,
    batches,
    departments: departmentList,
    categories: categoryList,
    loading,
    error,

    // Операции с партиями
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
    getDepartmentIcon: (deptId) => {
      const dept = departmentList.find((d) => d.id === deptId || d.code === deptId)
      return dept?.icon || DEFAULT_DEPARTMENT_ICONS[dept?.type] || DEFAULT_DEPARTMENT_ICONS.default
    }
  }

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export function useProducts() {
  const context = useContext(ProductContext)
  if (!context) {
    throw new Error('useProducts must be used within a ProductProvider')
  }
  return context
}
