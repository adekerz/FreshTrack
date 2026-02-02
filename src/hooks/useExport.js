/**
 * useExport Hook
 * Централизованный хук для экспорта данных
 * Поддерживает экспорт с backend и клиентский экспорт
 */

import { useState } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { API_BASE_URL } from '../services/api'
import { exportToExcel, exportToPDF, EXPORT_COLUMNS } from '../utils/exportUtils'
import { logError } from '../utils/logger'

/**
 * Типы экспорта с конфигурацией
 */
const EXPORT_TYPES = {
  inventory: {
    endpoint: '/export/inventory',
    filename: 'inventory',
    title: 'Инвентарь',
    subtitle: 'Текущие товары и статусы',
    columnsKey: 'inventory'
  },
  batches: {
    endpoint: '/export/batches',
    filename: 'batches',
    title: 'Все партии',
    subtitle: 'Полная история партий',
    columnsKey: 'inventory'
  },
  collections: {
    endpoint: '/export/collections',
    filename: 'collections',
    title: 'История сборов',
    subtitle: 'Журнал сборов товаров',
    columnsKey: 'collections'
  },
  audit: {
    endpoint: '/export/audit',
    filename: 'audit_logs',
    title: 'Журнал действий',
    subtitle: 'Лог всех действий в системе',
    columnsKey: 'auditLogs'
  },
  products: {
    endpoint: '/export/products',
    filename: 'products',
    title: 'Продукты',
    subtitle: 'Справочник продуктов',
    columnsKey: 'inventory'
  },
  categories: {
    endpoint: '/export/categories',
    filename: 'categories',
    title: 'Категории',
    subtitle: 'Справочник категорий',
    columnsKey: 'inventory'
  },
  departments: {
    endpoint: '/export/departments',
    filename: 'departments',
    title: 'Отделы',
    subtitle: 'Справочник отделов',
    columnsKey: 'inventory'
  },
  writeOffs: {
    endpoint: '/export/write-offs',
    filename: 'write_offs',
    title: 'Списания',
    subtitle: 'Журнал списаний товаров',
    columnsKey: 'collections'
  }
}

/**
 * Форматирование данных для экспорта
 */
function formatDataForExport(data, type, t) {
  if (!Array.isArray(data) || data.length === 0) {
    return []
  }

  // Форматирование дат
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('ru-RU')
    } catch {
      return dateString
    }
  }

  // Форматирование времени
  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    } catch {
      return dateString
    }
  }

  // Статус лейблы
  const statusLabels = {
    good: t?.('common.good') || 'Хорошо',
    warning: t?.('common.warning') || 'Внимание',
    critical: t?.('common.critical') || 'Критично',
    expired: t?.('common.expired') || 'Просрочено',
    today: t?.('common.today') || 'Сегодня',
    active: t?.('common.active') || 'Активно',
    collected: t?.('common.collected') || 'Собрано'
  }

  switch (type) {
    case 'inventory':
    case 'batches':
      return data.map((item) => ({
        ...item,
        productName: item.product_name || item.name || '-',
        category: item.category_name || '-',
        department: item.department_name || item.department || '-',
        formattedDate: formatDate(item.expiry_date || item.nearest_expiry),
        statusLabel: statusLabels[item.status] || item.status || '-',
        daysLeft: item.days_until_expiry ?? item.daysLeft ?? '-',
        quantity: item.quantity || item.total_quantity || 0,
        unit: item.unit || 'шт'
      }))

    case 'collections':
      return data.map((item) => ({
        ...item,
        timestamp: formatDateTime(item.collected_at || item.timestamp),
        productName: item.product_name || '-',
        department: item.department_name || '-',
        quantity: item.quantity || 0,
        reason: item.reason || item.type || '-',
        collectedBy: item.collected_by_name || item.user_name || '-'
      }))

    case 'audit':
      return data.map((item) => ({
        ...item,
        timestamp: formatDateTime(item.created_at || item.timestamp),
        user_name: item.user_name || '-',
        action: item.action || '-',
        entity_type: item.entity_type || '-',
        details: typeof item.details === 'object'
          ? JSON.stringify(item.details)
          : item.details || '-',
        ip_address: item.ip_address || '-'
      }))

    default:
      return data
  }
}

/**
 * Хук для экспорта данных
 */
export function useExport() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [exporting, setExporting] = useState(null)

  /**
   * Экспорт данных с backend
   * @param {string} type - Тип экспорта (inventory, batches, collections, audit)
   * @param {string} format - Формат экспорта (excel, pdf)
   * @param {object} options - Дополнительные опции (filters, etc.)
   */
  const exportData = async (type, format = 'excel', options = {}) => {
    const exportConfig = EXPORT_TYPES[type]

    if (!exportConfig) {
      logError('Unknown export type:', type)
      addToast(t('toast.exportError') || 'Ошибка экспорта', 'error')
      return
    }

    setExporting(type)

    try {
      // Строим URL с фильтрами
      const url = new URL(`${API_BASE_URL}${exportConfig.endpoint}`)
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            url.searchParams.append(key, value)
          }
        })
      }

      // Запрос к backend
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('freshtrack_token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Export failed')
      }

      const data = await response.json()

      // Проверяем данные
      if (!data || !Array.isArray(data) || data.length === 0) {
        addToast(t('export.noData') || 'Нет данных для экспорта', 'warning')
        return
      }

      // Форматируем данные
      const formattedData = formatDataForExport(data, type, t)

      // Получаем конфигурацию колонок
      const columns = EXPORT_COLUMNS[exportConfig.columnsKey]?.(t) || []

      // Генерируем имя файла
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${exportConfig.filename}_${timestamp}`

      // Экспорт в нужном формате
      if (format === 'excel') {
        exportToExcel(formattedData, columns, filename, exportConfig.title)
      } else if (format === 'pdf') {
        exportToPDF(exportConfig.title, formattedData, columns, {
          subtitle: exportConfig.subtitle,
          companyName: 'FreshTrack'
        })
      }

      addToast(t('toast.exportSuccess') || 'Экспорт завершен', 'success')
    } catch (error) {
      logError('Export error:', error)
      addToast(
        error.message || t('toast.exportError') || 'Ошибка экспорта',
        'error'
      )
    } finally {
      setExporting(null)
    }
  }

  /**
   * Клиентский экспорт данных (без backend)
   * Используется когда данные уже загружены на клиенте
   */
  const exportClientData = async (data, type, format = 'excel', options = {}) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      addToast(t('export.noData') || 'Нет данных для экспорта', 'warning')
      return
    }

    const exportConfig = EXPORT_TYPES[type] || {
      filename: 'export',
      title: options.title || 'Отчет',
      subtitle: options.subtitle || '',
      columnsKey: type
    }

    setExporting(type)

    try {
      // Форматируем данные
      const formattedData = options.skipFormatting
        ? data
        : formatDataForExport(data, type, t)

      // Получаем конфигурацию колонок
      const columns = options.columns || EXPORT_COLUMNS[exportConfig.columnsKey]?.(t) || []

      // Генерируем имя файла
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `${exportConfig.filename}_${timestamp}`

      // Экспорт в нужном формате
      if (format === 'excel') {
        exportToExcel(formattedData, columns, filename, exportConfig.title)
      } else if (format === 'pdf') {
        exportToPDF(exportConfig.title, formattedData, columns, {
          subtitle: exportConfig.subtitle,
          summary: options.summary,
          companyName: 'FreshTrack'
        })
      }

      addToast(t('toast.exportSuccess') || 'Экспорт завершен', 'success')
    } catch (error) {
      logError('Client export error:', error)
      addToast(t('toast.exportError') || 'Ошибка экспорта', 'error')
    } finally {
      setExporting(null)
    }
  }

  return {
    exportData,
    exportClientData,
    exporting,
    isExporting: !!exporting,
    EXPORT_TYPES
  }
}

export default useExport
