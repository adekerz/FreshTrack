/**
 * FreshTrack Product Context
 * Управление данными товаров и партий через API сервера
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getDaysUntilExpiry, getExpiryStatus } from '../utils/dateUtils'

const ProductContext = createContext(null)

// Базовый URL API
const API_URL = 'http://localhost:3001/api'

// Отделы
export const departments = [
  { id: 'honor-bar', name: 'Honor Bar', icon: 'Wine', color: '#8B7355' },
  { id: 'mokki-bar', name: 'Mokki Bar', icon: 'Coffee', color: '#6B8E7A' },
  { id: 'ozen-bar', name: 'Ozen Bar', icon: 'Martini', color: '#7B6B8D' }
]

// Категории
export const categories = [
  {
    id: 'soft-drinks',
    name: 'Soft Drinks',
    nameRu: 'Безалкогольные напитки',
    nameKz: 'Алкогольсіз сусындар'
  },
  {
    id: 'alcohol-drinks',
    name: 'Alcohol Drinks',
    nameRu: 'Алкогольные напитки',
    nameKz: 'Алкогольді сусындар'
  },
  { id: 'food', name: 'Food', nameRu: 'Еда', nameKz: 'Тамақ' },
  { id: 'other', name: 'Other', nameRu: 'Другое', nameKz: 'Басқа' }
]

// Начальный каталог товаров (статический, для выбора при добавлении)
const initialCatalog = {
  'honor-bar': {
    'soft-drinks': [
      { id: 'pepsi', name: 'Pepsi' },
      { id: 'cola-original', name: 'Cola Original' },
      { id: 'fanta', name: 'Fanta' },
      { id: 'sprite', name: 'Sprite' },
      { id: '7up', name: '7 Up' },
      { id: 'mirinda', name: 'Mirinda' },
      { id: 'pago-apple', name: 'Pago Apple' },
      { id: 'pago-orange', name: 'Pago Orange' },
      { id: 'red-bull', name: 'Red Bull' },
      { id: 'san-pellegrino', name: 'San Pellegrino Sparkling' },
      { id: 'aqua-panna', name: 'Aqua Panna Still' },
      { id: 'cola-zero', name: 'Cola Zero' }
    ],
    'alcohol-drinks': [
      { id: 'budweiser', name: 'Budweiser' },
      { id: 'corona', name: 'Corona' }
    ],
    food: [
      { id: 'kz-chocolate', name: 'Kazakhstan Chocolate' },
      { id: 'snickers', name: 'Snickers' },
      { id: 'mars', name: 'Mars' },
      { id: 'chewing-gum', name: 'Chewing Gum' },
      { id: 'ritter-sport', name: 'Ritter Sport' },
      { id: 'pistachio', name: 'Pistachio' },
      { id: 'cashew', name: 'Cashew' },
      { id: 'chocolate-peanuts', name: 'Chocolate Peanuts' },
      { id: 'gummy-bear', name: 'Gummy Bear' },
      { id: 'potato-chips', name: 'Potato Chips' },
      { id: 'fruit-chips', name: 'Fruit Chips' }
    ],
    other: [{ id: 'feminine-pack', name: 'Feminine Pack' }]
  },
  'mokki-bar': {
    'soft-drinks': [],
    'alcohol-drinks': [],
    food: [],
    other: []
  },
  'ozen-bar': {
    'soft-drinks': [],
    'alcohol-drinks': [],
    food: [],
    other: []
  }
}

// Ключ для localStorage (только для каталога)
const CATALOG_STORAGE_KEY = 'freshtrack_catalog'

/**
 * Хелпер для API запросов
 */
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('freshtrack_token')

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, { ...defaultOptions, ...options })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

export function ProductProvider({ children }) {
  // Каталог товаров (локальный, для UI выбора)
  const [catalog, setCatalog] = useState(() => {
    const saved = localStorage.getItem(CATALOG_STORAGE_KEY)
    return saved ? JSON.parse(saved) : initialCatalog
  })

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

  // Сохранение каталога в localStorage
  useEffect(() => {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog))
  }, [catalog])

  // Загрузка данных с сервера при монтировании (только если есть токен)
  useEffect(() => {
    const token = localStorage.getItem('freshtrack_token')
    if (token) {
      fetchAllData()
    } else {
      setLoading(false)
    }
  }, [])

  /**
   * Загрузить все данные с сервера
   */
  const fetchAllData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [batchesRes, statsRes] = await Promise.all([
        apiFetch('/batches'),
        apiFetch('/batches/stats')
      ])

      setBatches(batchesRes)
      setStats(statsRes)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Обновить данные (вызывать после изменений)
   */
  const refresh = useCallback(() => {
    return fetchAllData()
  }, [])

  /**
   * Добавить партию товара
   */
  const addBatch = useCallback(
    async (productIdOrName, departmentId, manufacturingDate, expiryDate, quantity) => {
      try {
        // Найти название продукта в каталоге (если передан id) или использовать напрямую
        let productName = productIdOrName
        let category = 'other'
        
        const deptCatalog = catalog[departmentId] || {}
        for (const [catId, products] of Object.entries(deptCatalog)) {
          const product = products.find((p) => p.id === productIdOrName || p.name === productIdOrName)
          if (product) {
            productName = product.name
            category = catId
            break
          }
        }

        const newBatch = await apiFetch('/batches', {
          method: 'POST',
          body: JSON.stringify({
            productName,
            department: departmentId,
            category,
            quantity: parseInt(quantity),
            expiryDate,
            manufacturingDate
          })
        })

        // Обновить локальные данные
        setBatches((prev) => [
          ...prev,
          {
            ...newBatch,
            daysLeft: getDaysUntilExpiry(expiryDate),
            status: getExpiryStatus(getDaysUntilExpiry(expiryDate)).status
          }
        ])

        // Обновить статистику
        await fetchAllData()

        return newBatch
      } catch (err) {
        console.error('Error adding batch:', err)
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
        method: 'PATCH',
        body: JSON.stringify({ reason, comment })
      })

      // Удалить из локального списка
      setBatches((prev) => prev.filter((b) => b.id !== batchId))

      // Обновить статистику
      await fetchAllData()

      return true
    } catch (err) {
      console.error('Error collecting batch:', err)
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
      console.error('Error deleting batch:', err)
      throw err
    }
  }, [])

  /**
   * Добавить новый товар в каталог
   */
  const addCustomProduct = useCallback((departmentId, categoryId, name) => {
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
  }, [])

  /**
   * Получить партии по ID продукта
   */
  const getBatchesByProduct = useCallback(
    (productName, departmentId = null) => {
      return batches
        .filter(
          (b) => {
            // Проверяем совпадение имени продукта (productName или name)
            const batchName = b.productName || b.name || b.product_name
            const nameMatch = batchName === productName || 
                             batchName?.toLowerCase() === productName?.toLowerCase()
            // Проверяем совпадение отдела (department или departmentId)
            const batchDept = b.department || b.departmentId
            const deptMatch = !departmentId || batchDept === departmentId
            return nameMatch && deptMatch
          }
        )
        .map((b) => ({
          ...b,
          daysLeft: b.daysLeft ?? getDaysUntilExpiry(b.expiryDate),
          status: getExpiryStatus(b.daysLeft ?? getDaysUntilExpiry(b.expiryDate))
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
    },
    [batches]
  )

  /**
   * Получить товары отдела с информацией о партиях
   */
  const getProductsByDepartment = useCallback(
    (departmentId) => {
      const departmentCatalog = catalog[departmentId] || {}
      const products = []

      Object.entries(departmentCatalog).forEach(([categoryId, categoryProducts]) => {
        categoryProducts.forEach((product) => {
          const productBatches = batches
            .filter((b) => b.productName === product.name && b.department === departmentId)
            .map((b) => ({
              ...b,
              daysLeft: b.daysLeft ?? getDaysUntilExpiry(b.expiryDate),
              status: getExpiryStatus(b.daysLeft ?? getDaysUntilExpiry(b.expiryDate))
            }))

          // Определяем общий статус товара
          let overallStatus = 'good'
          let totalQuantity = 0

          productBatches.forEach((batch) => {
            totalQuantity += batch.quantity
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
            totalQuantity,
            overallStatus,
            hasExpired: productBatches.some((b) => (b.status?.status || b.status) === 'expired'),
            hasExpiringSoon: productBatches.some((b) =>
              ['critical', 'warning', 'today'].includes(b.status?.status || b.status)
            )
          })
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
      .map((b) => ({
        ...b,
        daysLeft: b.daysLeft ?? getDaysUntilExpiry(b.expiryDate),
        status: getExpiryStatus(b.daysLeft ?? getDaysUntilExpiry(b.expiryDate))
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [batches])

  /**
   * Получить партии по статусу
   */
  const getBatchesByStatus = useCallback(
    (statusFilter) => {
      return getActiveBatches().filter((b) => {
        const daysLeft = b.daysLeft
        if (statusFilter === 'expired') return daysLeft < 0
        if (statusFilter === 'critical') return daysLeft >= 0 && daysLeft <= 3
        if (statusFilter === 'warning') return daysLeft > 3 && daysLeft <= 7
        if (statusFilter === 'attention') return daysLeft > 7 && daysLeft <= 14
        if (statusFilter === 'good') return daysLeft > 14
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
   */
  const getAlerts = useCallback(() => {
    return getActiveBatches()
      .filter((b) => b.daysLeft <= 7)
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

  const value = {
    // Данные
    catalog,
    batches,
    departments,
    categories,
    loading,
    error,

    // Операции с партиями
    addBatch,
    collectBatch,
    deleteBatch,
    refresh,

    // Операции с каталогом
    addCustomProduct,

    // Получение данных
    getBatchesByProduct,
    getProductsByDepartment,
    getCategoriesForDepartment,
    getActiveBatches,
    getBatchesByStatus,
    getStats,
    getUnreadNotificationsCount,
    getAlerts,
    findProduct
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
