/**
 * FreshTrack API Service
 * Клиент для взаимодействия с backend API
 */

import { logError } from '../utils/logger'

// Базовый URL API - использует переменную окружения или localhost для разработки
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Базовый URL сервера (без /api) - для статических файлов
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '')

/**
 * Получить полный URL для статического файла (uploads и т.д.)
 * @param {string} path - относительный путь (e.g., '/uploads/logos/logo.png')
 * @returns {string} - полный URL
 */
export function getStaticUrl(path) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path // уже полный URL
  }
  return `${SERVER_BASE_URL}${path}`
}

/**
 * Обработка ответа от сервера
 */
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }
  return response.json()
}

/**
 * Базовый fetch с обработкой ошибок
 * @param {string} endpoint - API endpoint (e.g., '/products')
 * @param {object} options - fetch options
 * @returns {Promise<any>} - response data
 */
export async function apiFetch(endpoint, options = {}) {
  let url = `${API_BASE_URL}${endpoint}`

  // Добавляем hotel_id для SUPER_ADMIN (из localStorage)
  // Проверяем что hotel_id ещё не в URL чтобы избежать дублирования
  const selectedHotelId = localStorage.getItem('freshtrack_selected_hotel')
  if (selectedHotelId && !url.includes('hotel_id=')) {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}hotel_id=${encodeURIComponent(selectedHotelId)}`
  }

  // Базовые заголовки
  const defaultHeaders = {
    'Content-Type': 'application/json'
  }

  // Добавляем токен авторизации если есть
  const token = localStorage.getItem('freshtrack_token')
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  // Правильно мержим headers: default + пользовательские
  const mergedOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  }

  try {
    const response = await fetch(url, mergedOptions)
    return handleResponse(response)
  } catch (error) {
    logError(`API [${endpoint}]`, error)
    throw error
  }
}

// ============================================
// Products API
// ============================================

/**
 * Получить все продукты
 */
export async function getProducts() {
  return apiFetch('/products')
}

/**
 * Получить продукт по ID
 */
export async function getProductById(id) {
  return apiFetch(`/products/${id}`)
}

/**
 * Добавить новый продукт
 */
export async function addProduct(product) {
  return apiFetch('/products', {
    method: 'POST',
    body: JSON.stringify(product)
  })
}

/**
 * Обновить продукт
 */
export async function updateProduct(id, updates) {
  return apiFetch(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  })
}

/**
 * Обновить категорию
 */
export async function updateCategory(id, updates) {
  return apiFetch(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  })
}

/**
 * Удалить продукт
 */
export async function deleteProduct(id) {
  return apiFetch(`/products/${id}`, {
    method: 'DELETE'
  })
}

/**
 * Получить просроченные продукты
 */
export async function getExpiredProducts() {
  return apiFetch('/products/status/expired')
}

/**
 * Получить продукты, истекающие скоро
 */
export async function getExpiringSoonProducts(days = 3) {
  return apiFetch(`/products/status/expiring-soon?days=${days}`)
}

// ============================================
// Auth API
// ============================================

/**
 * Авторизация
 */
export async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })

  if (data.token) {
    localStorage.setItem('freshtrack_token', data.token)
  }

  return data
}

/**
 * Регистрация
 */
export async function register(userData) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  })

  if (data.token) {
    localStorage.setItem('freshtrack_token', data.token)
  }

  return data
}

/**
 * Получить текущего пользователя
 */
export async function getCurrentUser() {
  return apiFetch('/auth/me')
}

/**
 * Выход из системы
 */
export function logout() {
  localStorage.removeItem('freshtrack_token')
}

// ============================================
// Notifications API
// ============================================

/**
 * Отправить тестовое уведомление в Telegram
 * @param {string} hotelId - ID отеля для отправки (опционально, для SUPER_ADMIN)
 */
export async function sendTestTelegramNotification(hotelId) {
  const body = hotelId ? { hotel_id: hotelId } : {}
  return apiFetch('/notifications/test-telegram', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

/**
 * Отправить ежедневное уведомление
 */
export async function sendDailyNotification() {
  return apiFetch('/notifications/send-daily')
}

/**
 * Получить сводку по уведомлениям
 */
export async function getNotificationSummary() {
  return apiFetch('/notifications/summary')
}

/**
 * Получить логи уведомлений
 */
export async function getNotificationLogs(limit = 50) {
  return apiFetch(`/notifications/logs?limit=${limit}`)
}

/**
 * Получить статус планировщика
 */
export async function getSchedulerStatus() {
  return apiFetch('/notifications/status')
}

// ============================================
// Health Check
// ============================================

/**
 * Проверить состояние API
 */
export async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`)
    return response.ok
  } catch {
    return false
  }
}

// ============================================
// Grouped API exports
// ============================================

export const authAPI = {
  login,
  register,
  getCurrentUser,
  logout
}

export const productsAPI = {
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getExpiredProducts,
  getExpiringSoonProducts
}

export const notificationsAPI = {
  sendTestTelegramNotification,
  sendDailyNotification,
  getNotificationSummary,
  getNotificationLogs,
  getSchedulerStatus
}

export default {
  // Products
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getExpiredProducts,
  getExpiringSoonProducts,

  // Auth
  login,
  register,
  getCurrentUser,
  logout,

  // Notifications
  sendTestTelegramNotification,
  sendDailyNotification,
  getNotificationSummary,
  getNotificationLogs,
  getSchedulerStatus,

  // Health
  checkApiHealth
}
