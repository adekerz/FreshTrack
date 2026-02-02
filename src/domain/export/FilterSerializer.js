/**
 * FilterSerializer - сериализация и обработка фильтров для экспорта
 * Преобразует фильтры UI в query params для API и обратно
 */
export class FilterSerializer {
  /**
   * Преобразует фильтры UI в query params для API
   * @param {Object} filters - объект с фильтрами
   * @returns {URLSearchParams}
   */
  static toQueryParams(filters) {
    const params = new URLSearchParams()

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        // Санитизация значения
        const sanitized = this.sanitize(value)
        params.append(key, sanitized)
      }
    })

    return params
  }

  /**
   * Генерирует человекочитаемое описание фильтров
   * @param {Object} filters - объект с фильтрами
   * @param {Object} translations - объект с переводами
   * @returns {Object|null} - { count, description, filters } или null если фильтров нет
   */
  static toHumanReadable(filters, translations = {}) {
    const activeFilters = Object.entries(filters).filter(
      ([_, value]) => value !== null && value !== undefined && value !== ''
    )

    if (activeFilters.length === 0) {
      return null
    }

    const filterDescriptions = activeFilters.map(([key, value]) => {
      const label = translations[`filter.${key}`] || this.humanizeKey(key)
      const displayValue = this.formatFilterValue(key, value, translations)
      return `${label}: ${displayValue}`
    })

    return {
      count: activeFilters.length,
      description: filterDescriptions.join(', '),
      filters: Object.fromEntries(activeFilters)
    }
  }

  /**
   * Защита от XSS и инъекций
   * @param {any} value - значение для санитизации
   * @returns {string|number|boolean}
   */
  static sanitize(value) {
    if (typeof value === 'string') {
      return value
        .replace(/[<>"']/g, '') // Убираем опасные символы
        .trim()
        .slice(0, 255) // Ограничиваем длину
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value
    }

    if (value instanceof Date) {
      return value.toISOString()
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.sanitize(v)).join(',')
    }

    return String(value)
  }

  /**
   * Форматирует значение фильтра для отображения
   * @param {string} key - ключ фильтра
   * @param {any} value - значение
   * @param {Object} translations - переводы
   * @returns {string}
   */
  static formatFilterValue(key, value, translations = {}) {
    // Даты
    if (value instanceof Date) {
      return value.toLocaleDateString('ru-RU')
    }

    // Попытка распарсить дату из строки
    if (
      typeof value === 'string' &&
      (key.includes('date') || key.includes('Date') || key.includes('_at'))
    ) {
      try {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('ru-RU')
        }
      } catch {
        // Игнорируем ошибки парсинга
      }
    }

    // Массивы
    if (Array.isArray(value)) {
      return value
        .map((v) => translations[`filter.value.${v}`] || String(v))
        .join(', ')
    }

    // Попытка перевести значение
    const translationKey = `filter.value.${value}`
    const translated = translations[translationKey]
    if (translated) {
      return translated
    }

    // Специальные значения
    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет'
    }

    return String(value)
  }

  /**
   * Преобразует ключ в человекочитаемый формат
   * @param {string} key - ключ фильтра
   * @returns {string}
   */
  static humanizeKey(key) {
    // Преобразование snake_case и camelCase в читаемый формат
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  /**
   * Валидирует фильтры перед отправкой
   * @param {Object} filters - объект с фильтрами
   * @param {Object} schema - схема валидации
   * @throws {Error} если фильтры невалидны
   */
  static validate(filters, schema = {}) {
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') {
        continue
      }

      if (schema[key]) {
        const fieldSchema = schema[key]

        // Проверка типа
        if (fieldSchema.type) {
          switch (fieldSchema.type) {
            case 'date':
              if (!(value instanceof Date) && isNaN(Date.parse(value))) {
                throw new Error(`Filter ${key} must be a valid date`)
              }
              break

            case 'number':
              if (typeof value !== 'number' && isNaN(Number(value))) {
                throw new Error(`Filter ${key} must be a number`)
              }
              break

            case 'string':
              if (typeof value !== 'string') {
                throw new Error(`Filter ${key} must be a string`)
              }
              break

            case 'array':
              if (!Array.isArray(value)) {
                throw new Error(`Filter ${key} must be an array`)
              }
              break
          }
        }

        // Проверка enum
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          throw new Error(
            `Filter ${key} has invalid value: ${value}. Allowed values: ${fieldSchema.enum.join(', ')}`
          )
        }

        // Проверка min/max для чисел
        if (typeof value === 'number') {
          if (fieldSchema.min !== undefined && value < fieldSchema.min) {
            throw new Error(`Filter ${key} must be >= ${fieldSchema.min}`)
          }
          if (fieldSchema.max !== undefined && value > fieldSchema.max) {
            throw new Error(`Filter ${key} must be <= ${fieldSchema.max}`)
          }
        }

        // Проверка minLength/maxLength для строк
        if (typeof value === 'string') {
          if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
            throw new Error(`Filter ${key} must be at least ${fieldSchema.minLength} characters`)
          }
          if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
            throw new Error(`Filter ${key} must be at most ${fieldSchema.maxLength} characters`)
          }
        }
      }
    }
  }

  /**
   * Парсит query params обратно в объект фильтров
   * @param {URLSearchParams|string} params - query params
   * @returns {Object}
   */
  static fromQueryParams(params) {
    const searchParams = typeof params === 'string' ? new URLSearchParams(params) : params

    const filters = {}
    for (const [key, value] of searchParams.entries()) {
      // Пропускаем технические параметры
      if (['page', 'limit', 'sort', 'order'].includes(key)) {
        continue
      }

      filters[key] = value
    }

    return filters
  }
}

/**
 * Типичные схемы валидации для общих фильтров
 */
export const CommonFilterSchemas = {
  status: {
    type: 'string',
    enum: ['good', 'warning', 'critical', 'expired', 'today']
  },
  startDate: {
    type: 'date'
  },
  endDate: {
    type: 'date'
  },
  department: {
    type: 'string',
    minLength: 1
  },
  category: {
    type: 'string',
    minLength: 1
  },
  search: {
    type: 'string',
    maxLength: 255
  },
  limit: {
    type: 'number',
    min: 1,
    max: 10000
  }
}
