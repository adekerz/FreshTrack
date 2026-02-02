/**
 * BaseAdapter - базовый класс для адаптеров экспорта
 * Обеспечивает нормализацию и валидацию данных перед экспортом
 */
export class BaseAdapter {
  constructor(translations = {}) {
    this.translations = translations
  }

  /**
   * Нормализует сырые данные в единый формат
   * @param {Array} rawData - данные с backend
   * @returns {Array} нормализованные данные
   */
  normalize(rawData) {
    throw new Error('Subclass must implement normalize()')
  }

  /**
   * Валидирует структуру данных
   * @throws {ValidationError} если данные невалидны
   */
  validate(data) {
    if (!Array.isArray(data)) {
      throw new ValidationError('Data must be an array')
    }

    if (data.length === 0) {
      throw new ValidationError('No data to export')
    }

    const requiredFields = this.getRequiredFields()
    if (requiredFields.length > 0) {
      const firstItem = data[0]

      for (const field of requiredFields) {
        if (!(field in firstItem)) {
          throw new ValidationError(`Missing required field: ${field}`)
        }
      }
    }
  }

  /**
   * Возвращает список обязательных полей
   * @returns {Array<string>}
   */
  getRequiredFields() {
    return []
  }

  // ============================================
  // УТИЛИТЫ ФОРМАТИРОВАНИЯ
  // ============================================

  /**
   * Форматирует дату
   * @param {string|Date} dateString - дата для форматирования
   * @returns {string}
   */
  formatDate(dateString) {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return date.toLocaleDateString('ru-RU')
    } catch {
      return dateString
    }
  }

  /**
   * Форматирует дату и время
   * @param {string|Date} dateString - дата для форматирования
   * @returns {string}
   */
  formatDateTime(dateString) {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })}`
    } catch {
      return dateString
    }
  }

  /**
   * Переводит ключ используя translations или возвращает fallback
   * @param {string} key - ключ перевода
   * @param {string} fallback - значение по умолчанию
   * @returns {string}
   */
  t(key, fallback) {
    return this.translations[key] || fallback
  }

  /**
   * Безопасно получает вложенное значение объекта
   * @param {Object} obj - объект
   * @param {string} path - путь (например, 'user.name')
   * @param {any} defaultValue - значение по умолчанию
   * @returns {any}
   */
  safeGet(obj, path, defaultValue = '-') {
    try {
      const keys = path.split('.')
      let result = obj
      for (const key of keys) {
        if (result === null || result === undefined) {
          return defaultValue
        }
        result = result[key]
      }
      return result !== null && result !== undefined ? result : defaultValue
    } catch {
      return defaultValue
    }
  }
}

/**
 * ValidationError - ошибка валидации данных
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}
