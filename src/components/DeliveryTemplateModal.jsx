/**
 * DeliveryTemplateModal - Применение шаблонов поставок
 * 
 * Два режима работы:
 * 1. Стандартный режим - редактирование всех позиций шаблона с подтверждением
 * 2. Fast Intake Mode - потоковый ввод для быстрого начального занесения остатков
 * 
 * Fast Intake Mode оптимизирован для:
 * - Клавиатурного ввода (Tab/Enter навигация)
 * - Минимума кликов мышью
 * - Потокового ввода сотен товаров
 * - Мобильного использования
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Package, Plus, Minus, Calendar, Check, Zap, ArrowRight, History } from 'lucide-react'
import { SectionLoader, ButtonLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useProducts } from '../context/ProductContext'
import { useToast } from '../context/ToastContext'
import { apiFetch } from '../services/api'

/**
 * DeliveryTemplateModal Props Contract:
 * 
 * onApplyAndClose - для стандартного режима: применяет шаблон И закрывает модалку
 * onFastApply - для быстрого режима: применяет шаблон БЕЗ закрытия модалки (только обновление данных)
 * onClose - явное закрытие пользователем (кнопка X или backdrop в стандартном режиме)
 */
export default function DeliveryTemplateModal({ 
  isOpen, 
  onClose, 
  onApplyAndClose,  // Стандартный режим: apply + close
  onFastApply,      // Быстрый режим: apply без close
  departmentId 
}) {
  const { t } = useTranslation()
  const { departments } = useProducts()
  const { addToast } = useToast()
  
  // === Основные состояния ===
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  
  // === Fast Intake Mode состояния ===
  // Состояние управляется внутри модалки, без синхронизации с родителем
  // Для восстановления после перерендеринга используем sessionStorage (если нужно)
  const [fastIntakeMode, setFastIntakeMode] = useState(false)
  const [sessionHistory, setSessionHistory] = useState([]) // История добавленных в этой сессии
  const [lastExpiryByProduct, setLastExpiryByProduct] = useState({}) // Последний срок годности по продукту
  const [globalLastExpiry, setGlobalLastExpiry] = useState('') // Последний введённый срок годности
  
  // Refs для управления фокусом (если понадобятся в будущем)
  
  // Ref для сохранения быстрого режима при перерендерингах (только для внутреннего использования)
  const fastModeRef = useRef(false)
  
  // Синхронизируем ref с state (для внутреннего использования в обработчиках)
  useEffect(() => {
    fastModeRef.current = fastIntakeMode
  }, [fastIntakeMode])
  
  // Целевой отдел
  const targetDepartment = departmentId || (departments.length > 0 ? departments[0].id : null)

  // === Эффекты ===
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      // Сбрасываем состояние Fast Intake только при ПЕРВОМ открытии
      // Если уже есть история сессии - не сбрасываем (конвейерный режим)
      if (sessionHistory.length === 0) {
        setSessionHistory([])
        setLastExpiryByProduct({})
        setGlobalLastExpiry('')
      }
    }
  }, [isOpen])
  
  // При закрытии модалки сбрасываем состояние быстрого режима
  useEffect(() => {
    if (!isOpen) {
      setFastIntakeMode(false)
      fastModeRef.current = false
    }
  }, [isOpen])


  // === Загрузка данных ===
  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/delivery-templates')
      const templates = (data.templates || []).map(template => ({
        ...template,
        items: typeof template.items === 'string' 
          ? JSON.parse(template.items) 
          : template.items || []
      }))
      setTemplates(templates)
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setLoading(false)
    }
  }

  // === Выбор шаблона ===
  const selectTemplate = (template) => {
    setSelectedTemplate(template)
    
    // Подготавливаем items с датами
    const today = new Date()
    const templateItems = typeof template.items === 'string' 
      ? JSON.parse(template.items) 
      : template.items || []
    
    const preparedItems = templateItems.map((item) => {
      const shelfLife = item.shelf_life_days || item.defaultShelfLife || 30
      const expiryDate = new Date(today)
      expiryDate.setDate(expiryDate.getDate() + shelfLife)

      const defaultQty = item.default_quantity !== undefined && item.default_quantity !== null 
        ? item.default_quantity 
        : (item.defaultQuantity !== undefined && item.defaultQuantity !== null 
          ? item.defaultQuantity 
          : 1)

      return {
        ...item,
        productId: item.product_id || item.productId,
        productName: item.product_name || item.productName || 'Без названия',
        quantity: parseInt(defaultQty) || 1,
        expiryDate: expiryDate.toISOString().split('T')[0],
        shelfLife: shelfLife
      }
    })
    setItems(preparedItems)
  }

  // === Стандартный режим: обновление позиции ===
  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // === Стандартный режим: применение шаблона ===
  const handleApply = async () => {
    if (!targetDepartment || items.length === 0) return

    // Проверка на старые даты (год < 2026)
    const invalidItems = items.filter(item => {
      const year = parseInt(item.expiryDate?.split('-')[0], 10)
      return year < 2026
    })
    
    if (invalidItems.length > 0) {
      addToast(`${invalidItems.length} товар(ов) с годом до 2026. Исправьте даты.`, 'error')
      return
    }

    setApplying(true)
    try {
      const result = await apiFetch(`/delivery-templates/${selectedTemplate.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId || item.product_id,
            quantity: parseInt(item.quantity) || 1,
            expiryDate: item.expiryDate
          })),
          departmentId: targetDepartment
        })
      })

      if (result.success) {
        // Стандартный режим: применяем шаблон И закрываем модалку
        onApplyAndClose?.(result.batches)
      }
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setApplying(false)
    }
  }


  // === Fast Intake: Парсинг даты из различных форматов ===
  const parseExpiryInput = useCallback((input) => {
    if (!input) return null
    
    const cleaned = input.replace(/[^\d./-]/g, '')
    
    // Форматы: DD.MM.YY, DD.MM.YYYY, DD/MM/YY, DD-MM-YY
    const patterns = [
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/, // DD.MM.YY или DD.MM.YYYY
      /^(\d{1,2})[./-](\d{1,2})$/, // DD.MM (текущий год)
    ]
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern)
      if (match) {
        let day = parseInt(match[1], 10)
        let month = parseInt(match[2], 10) // Не уменьшаем сразу
        let year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear()
        
        // Если год двузначный, добавляем 2000
        if (year < 100) {
          year += 2000
        }
        
        // Валидация: месяц должен быть от 1 до 12
        if (month < 1 || month > 12) {
          return null
        }
        
        // Валидация: год должен быть >= 2026 и <= 2099
        if (year < 2026 || year > 2099) {
          return null
        }
        
        // Валидация: день должен быть валидным для месяца
        const daysInMonth = new Date(year, month, 0).getDate() // 0 день = последний день предыдущего месяца
        if (day < 1 || day > daysInMonth) {
          return null
        }
        
        // Создаем дату в локальном времени (месяц в JS 0-based)
        const date = new Date(year, month - 1, day)
        
        // Проверяем что дата валидна и соответствует введенным значениям
        if (!isNaN(date.getTime()) && 
            date.getDate() === day && 
            date.getMonth() === month - 1 && 
            date.getFullYear() === year) {
          // Форматируем в YYYY-MM-DD вручную для избежания проблем с часовыми поясами
          const yearStr = String(year).padStart(4, '0')
          const monthStr = String(month).padStart(2, '0')
          const dayStr = String(day).padStart(2, '0')
          return `${yearStr}-${monthStr}-${dayStr}`
        }
      }
    }
    
    return null
  }, [])

  // === Fast Intake: Форматирование даты для отображения ===
  const formatDateForDisplay = (isoDate) => {
    if (!isoDate) return ''
    const [year, month, day] = isoDate.split('-')
    return `${day}.${month}.${year.slice(-2)}`
  }

  // === Fast Intake: Автоформатирование даты при вводе (ДД.ММ.ГГ) ===
  const autoFormatDateInput = (value) => {
    // Убираем всё кроме цифр
    const digits = value.replace(/\D/g, '')
    
    // Форматируем с точками
    let formatted = ''
    for (let i = 0; i < digits.length && i < 8; i++) {
      if (i === 2 || i === 4) {
        formatted += '.'
      }
      formatted += digits[i]
    }
    
    return formatted
  }


  // === Получение названия отдела ===
  const getDepartmentName = (id) => {
    const dept = departments.find((d) => d.id === id)
    return dept ? dept.name : id
  }

  // === Последний добавленный товар (для быстрого +1) ===
  const lastAddedItem = sessionHistory[0]

  // === Рендер: закрытое состояние ===
  if (!isOpen) return null

  // Защита от закрытия в быстром режиме через backdrop
  const handleBackdropClick = (e) => {
    // В быстром режиме не закрываем модалку при клике на backdrop
    // (предотвращает случайное закрытие во время быстрого ввода)
    if (fastIntakeMode || fastModeRef.current) {
      return
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${fastIntakeMode ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-primary-100 dark:bg-primary-900/30'}`}>
                {fastIntakeMode ? (
                  <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {fastIntakeMode 
                    ? (t('fastIntake.title') || 'Быстрый ввод')
                    : (t('templates.title') || 'Шаблоны поставок')
                  }
                </h2>
                {selectedTemplate && (
                  <p className="text-sm text-gray-500">{selectedTemplate.name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Переключатель Fast Intake Mode - только иконка на мобильных */}
              {selectedTemplate && (
                <button
                  onClick={() => {
                    const newMode = !fastIntakeMode
                    setFastIntakeMode(newMode)
                    fastModeRef.current = newMode
                    // При переключении сбрасываем форму
                    if (newMode) {
                      resetFastIntakeForm()
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    fastIntakeMode 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline text-xs">
                    {fastIntakeMode ? 'Быстрый' : 'Стандарт'}
                  </span>
                </button>
              )}
              
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <SectionLoader />
            ) : !selectedTemplate ? (
              /* ===== ВЫБОР ШАБЛОНА ===== */
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  {t('templates.selectTemplate') || 'Выберите шаблон:'}
                </p>

                {templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {t('templates.noTemplates') || 'Нет доступных шаблонов'}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center gap-2 p-3 border border-border rounded-xl"
                      >
                        {/* Инфо о шаблоне */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">{template.name}</h3>
                          <p className="text-xs text-gray-500">
                            {template.items.length} позиций
                          </p>
                        </div>
                        
                        {/* Быстрый режим - главная кнопка */}
                        <button
                          onClick={() => {
                            selectTemplate(template)
                            setFastIntakeMode(true)
                            fastModeRef.current = true
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium touch-manipulation"
                        >
                          <Zap className="w-4 h-4" />
                          <span className="hidden sm:inline">Быстрый</span>
                        </button>
                        
                        {/* Стандартный режим */}
                        <button
                          onClick={() => selectTemplate(template)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm touch-manipulation"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : fastIntakeMode ? (
              /* ===== FAST INTAKE MODE - Конвейер быстрого ввода =====
               * Дизайн: Все товары из шаблона в одном списке.
               * Каждый товар: Название → Количество → Срок → Удалить
               * Внизу: "Сохранить и далее" для применения всех изменений
               */
              <div className="space-y-4">
                {/* Заголовок списка */}
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">
                    {t('templates.products') || 'Товары'} ({items.length})
                  </h3>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-sm text-red-500 hover:text-red-600 hover:underline transition-colors"
                  >
                    {t('templates.changeTemplate') || 'Сменить шаблон'}
                  </button>
                </div>

                {/* Список товаров из шаблона - редактирование в строке */}
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 sm:p-4 bg-muted/50 rounded-xl border border-border/50"
                    >
                      {/* Название товара - слева */}
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <p className="font-medium text-foreground text-base sm:text-sm truncate">
                          {item.productName}
                        </p>
                      </div>

                      {/* Количество и срок - в центре/справа */}
                      <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                        {/* Количество с +/- кнопками */}
                        <div className="flex items-center gap-1 sm:gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                            className="p-2 sm:p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors touch-manipulation active:scale-95"
                            aria-label="Уменьшить количество"
                          >
                            <Minus className="w-5 h-5 sm:w-4 sm:h-4" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1
                              updateItem(index, 'quantity', Math.max(1, value))
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                // Переходим к полю даты этого товара
                                const dateInput = e.target.closest('.rounded-xl')?.querySelector('input[type="text"]')
                                if (dateInput) {
                                  dateInput.focus()
                                  dateInput.select()
                                }
                              }
                            }}
                            className="w-16 sm:w-14 text-center px-1 py-2 sm:py-1.5 border border-border rounded-lg bg-card text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                            min="1"
                          />
                          <button
                            type="button"
                            onClick={() => updateItem(index, 'quantity', item.quantity + 1)}
                            className="p-2 sm:p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors touch-manipulation active:scale-95"
                            aria-label="Увеличить количество"
                          >
                            <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
                          </button>
                        </div>

                        {/* Срок годности */}
                        <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[120px]">
                          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item._inputExpiry !== undefined ? item._inputExpiry : formatDateForDisplay(item.expiryDate)}
                            onChange={(e) => {
                              // Автоформатируем дату с точками
                              const formatted = autoFormatDateInput(e.target.value)
                              const newItems = [...items]
                              newItems[index] = { 
                                ...newItems[index], 
                                _inputExpiry: formatted, 
                                _invalidYear: false 
                              }
                              setItems(newItems)
                            }}
                            onBlur={(e) => {
                              const parsed = parseExpiryInput(e.target.value)
                              if (parsed) {
                                // Парсинг успешен - сохраняем дату
                                const newItems = [...items]
                                newItems[index] = { 
                                  ...newItems[index], 
                                  expiryDate: parsed, 
                                  _inputExpiry: undefined, 
                                  _invalidYear: false 
                                }
                                setItems(newItems)
                                // Сохраняем последний срок для автозаполнения
                                setGlobalLastExpiry(parsed)
                                const productId = item.productId || item.product_id
                                setLastExpiryByProduct(prev => ({ ...prev, [productId]: parsed }))
                              } else if (e.target.value.trim()) {
                                // Проверяем причину ошибки
                                const digits = e.target.value.replace(/\D/g, '')
                                if (digits.length >= 6) {
                                  const day = parseInt(digits.slice(0, 2), 10)
                                  const month = parseInt(digits.slice(2, 4), 10)
                                  let year = parseInt(digits.slice(4, 6), 10)
                                  if (year < 100) year += 2000
                                  
                                  if (year < 2026 || year > 2099) {
                                    addToast('Год должен быть от 2026 до 2099', 'error')
                                    const newItems = [...items]
                                    newItems[index] = { ...newItems[index], _invalidYear: true }
                                    setItems(newItems)
                                    return
                                  }
                                }
                                // Парсинг не удался - возвращаем отформатированную дату
                                const newItems = [...items]
                                newItems[index] = { ...newItems[index], _inputExpiry: undefined, _invalidYear: false }
                                setItems(newItems)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                // Сохраняем текущую дату если валидна
                                const parsed = parseExpiryInput(e.target.value)
                                if (parsed) {
                                  const newItems = [...items]
                                  newItems[index] = { 
                                    ...newItems[index], 
                                    expiryDate: parsed, 
                                    _inputExpiry: undefined, 
                                    _invalidYear: false 
                                  }
                                  setItems(newItems)
                                  setGlobalLastExpiry(parsed)
                                  const productId = item.productId || item.product_id
                                  setLastExpiryByProduct(prev => ({ ...prev, [productId]: parsed }))
                                }
                                // Переходим к следующему товару или кнопке сохранения
                                const nextRow = e.target.closest('.rounded-xl')?.nextElementSibling
                                if (nextRow) {
                                  const nextDateInput = nextRow.querySelector('input[type="text"]')
                                  if (nextDateInput) {
                                    nextDateInput.focus()
                                    nextDateInput.select()
                                  }
                                } else {
                                  // Последний товар - фокус на кнопку сохранения
                                  const saveButton = e.target.closest('.space-y-4')?.querySelector('button[aria-label*="Сохранить"]')
                                  if (saveButton) saveButton.focus()
                                }
                              }
                            }}
                            onFocus={(e) => {
                              // При фокусе выделяем весь текст для быстрой замены
                              e.target.select()
                            }}
                            placeholder="ДД.ММ.ГГ"
                            className={`flex-1 sm:w-24 text-center px-2 py-2 sm:py-1.5 border rounded-lg bg-card text-foreground text-base sm:text-sm focus:outline-none focus:ring-2 ${
                              item._invalidYear 
                                ? 'border-red-500 focus:ring-red-500/30 focus:border-red-500' 
                                : 'border-border focus:ring-amber-500/30 focus:border-amber-500'
                            }`}
                          />
                        </div>

                        {/* Удалить товар */}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 sm:p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg shrink-0 transition-colors touch-manipulation active:scale-95"
                          aria-label="Удалить товар"
                        >
                          <X className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Кнопка "Сохранить и далее" - большая, янтарная */}
                <button
                  onClick={async () => {
                    if (!targetDepartment || items.length === 0) return
                    
                    // Проверка на старые даты (год < 2026)
                    const invalidItems = items.filter(item => {
                      const year = parseInt(item.expiryDate?.split('-')[0], 10)
                      return year < 2026
                    })
                    
                    if (invalidItems.length > 0) {
                      addToast(`${invalidItems.length} товар(ов) с годом до 2026. Исправьте даты.`, 'error')
                      return
                    }
                    
                    // Сохраняем состояние ПЕРЕД началом операции (для восстановления формы после сохранения)
                    const currentTemplate = selectedTemplate
                    const wasFastMode = fastModeRef.current || fastIntakeMode
                    
                    // ЯВНО сохраняем быстрый режим в ref для надежности
                    fastModeRef.current = true
                    setFastIntakeMode(true)
                    
                    setApplying(true)
                    try {
                      const result = await apiFetch(`/delivery-templates/${selectedTemplate.id}/apply`, {
                        method: 'POST',
                        body: JSON.stringify({
                          items: items.map((item) => ({
                            productId: item.productId || item.product_id,
                            quantity: parseInt(item.quantity) || 1,
                            expiryDate: item.expiryDate
                          })),
                          departmentId: targetDepartment
                        })
                      })

                      if (result.success) {
                        // 1. Сохраняем последний срок годности для автозаполнения
                        if (items.length > 0) {
                          setGlobalLastExpiry(items[0].expiryDate)
                        }
                        
                        // 2. Добавляем товары в историю сессии
                        const newHistoryEntries = items.map((item, idx) => ({
                          id: Date.now() + idx,
                          productName: item.productName,
                          quantity: parseInt(item.quantity) || 1,
                          expiryDate: item.expiryDate,
                          timestamp: new Date()
                        }))
                        setSessionHistory(prev => [...newHistoryEntries, ...prev])
                        
                        // 3. Показываем уведомление
                        addToast(
                          t('fastIntake.totalAdded', { count: items.length }) || 
                          `Добавлено: ${items.length} позиций`,
                          'success'
                        )
                        
                        // 4. Перезагружаем шаблон для следующей итерации
                        if (currentTemplate && wasFastMode) {
                          fastModeRef.current = true
                          setFastIntakeMode(true)
                          selectTemplate(currentTemplate)
                        }
                        
                        // 5. Обновляем инвентарь БЕЗ закрытия модалки
                        onFastApply?.(result.batches)
                      }
                    } catch (error) {
                      const errorMessage = error?.message || t('toast.batchAddError') || 'Ошибка добавления партии'
                      addToast(errorMessage, 'error')
                      if (fastIntakeMode || fastModeRef.current) {
                        setFastIntakeMode(true)
                        fastModeRef.current = true
                      }
                    } finally {
                      setApplying(false)
                    }
                  }}
                  disabled={applying || items.length === 0}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-lg touch-manipulation active:scale-[0.98]"
                  aria-busy={applying}
                  aria-label={t('fastIntake.saveAndNext') || 'Сохранить и далее'}
                >
                  {applying ? <ButtonLoader /> : <Check className="w-6 h-6" />}
                  {t('fastIntake.saveAndNext') || 'Сохранить и далее'}
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* История сессии - компактная, без редактирования */}
                {sessionHistory.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <History className="w-3 h-3" />
                      {t('fastIntake.sessionHistory') || 'Добавлено в этой сессии'} ({sessionHistory.length})
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {sessionHistory.slice(0, 10).map((entry) => (
                        <div 
                          key={entry.id}
                          className="flex items-center justify-between py-1.5 px-2 bg-green-50 dark:bg-green-900/20 rounded text-xs"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Check className="w-3 h-3 text-green-600 shrink-0" />
                            <span className="truncate">{entry.productName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                            <span>×{entry.quantity}</span>
                            <span>{formatDateForDisplay(entry.expiryDate)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ===== СТАНДАРТНЫЙ РЕЖИМ ===== */
              <div className="space-y-6">
                {/* Информация об отделе */}
                <div className="p-3 bg-accent/10 rounded-lg">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">
                      {t('templates.targetDepartment') || 'Целевой отдел'}:
                    </span>{' '}
                    {departments.find((d) => d.id === targetDepartment)?.name || targetDepartment}
                  </p>
                </div>

                {/* Список товаров */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground">
                      {t('templates.products') || 'Товары'}
                    </h3>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      {t('templates.changeTemplate') || 'Сменить шаблон'}
                    </button>
                  </div>

                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-muted/50 rounded-xl"
                    >
                      <div className="flex-1 min-w-[150px]">
                        <p className="font-medium text-foreground text-sm">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>

                      {/* Количество */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(index, 'quantity', Math.max(1, item.quantity - 1))
                          }
                          className="p-1 rounded bg-muted hover:bg-muted/80"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                          className="w-16 text-center px-2 py-1 border border-border rounded bg-card text-foreground text-sm"
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(index, 'quantity', item.quantity + 1)}
                          className="p-1 rounded bg-muted hover:bg-muted/80"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Срок годности */}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={item.expiryDate}
                          min="2026-01-01"
                          onChange={(e) => updateItem(index, 'expiryDate', e.target.value)}
                          className="px-2 py-1 border border-border rounded bg-card text-foreground text-sm"
                        />
                      </div>

                      {/* Удалить */}
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer (только для стандартного режима) */}
          {selectedTemplate && !fastIntakeMode && (
            <div className="flex items-center justify-between gap-4 p-6 border-t border-border bg-muted">
              <div className="text-sm text-muted-foreground">
                {items.length} {t('templates.itemsToAdd') || 'позиций будет добавлено'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying || items.length === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-busy={applying}
                >
                  {applying ? <ButtonLoader /> : <Check className="w-4 h-4" />}
                  {t('templates.apply') || `Добавить ${items.length} позиций`}
                </button>
              </div>
            </div>
          )}

          {/* Footer для Fast Intake Mode - минимальный, только закрыть */}
          {selectedTemplate && fastIntakeMode && (
            <div className="flex items-center justify-between gap-4 p-3 border-t border-border bg-muted/50">
              <div className="text-sm text-muted-foreground">
                {sessionHistory.length > 0 
                  ? `✓ ${sessionHistory.length} добавлено`
                  : 'Выберите товар'
                }
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
