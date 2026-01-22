/**
 * FastIntakeModal - Stateful fast intake component
 * 
 * RESPONSIBILITY:
 * - Fast repetitive intake of batches using ONE selected template
 * - MUST own all state needed for fast intake
 * 
 * STATE IT OWNS:
 * - selectedTemplateId (from prop, but manages template data)
 * - preparedItems (products, quantities, expiry dates)
 * - loading / saving state
 * - sessionHistory
 * 
 * RULES:
 * - MUST NOT unmount after saving
 * - MUST NOT reset selectedTemplateId after save
 * - "Save and continue" resets ONLY the form fields, NOT the modal
 * - "Change template" is an explicit user action (calls onChangeTemplate)
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Package, Plus, Minus, Calendar, Check, ArrowRight, History, Zap } from 'lucide-react'
import { SectionLoader, ButtonLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useProducts } from '../context/ProductContext'
import { useToast } from '../context/ToastContext'
import { useAddBatchesBulk } from '../hooks/useInventory'
import { useHotel } from '../context/HotelContext'
import { apiFetch } from '../services/api'

export default function FastIntakeModal({
  isOpen,
  templateId,           // Template ID passed from parent
  onChangeTemplate,     // () => void - opens SelectTemplateModal
  onClose,             // () => void - full reset
  departmentId,
  onFastApply          // (batches) => void - DEPRECATED: React Query handles updates automatically
}) {
  const { t } = useTranslation()
  const { departments } = useProducts()
  const { selectedHotelId } = useHotel()
  const { addToast } = useToast()
  
  // === REACT QUERY MUTATION ===
  // Заменяет ручной API вызов - автоматические оптимистичные обновления
  const { mutate: applyTemplate, isPending } = useAddBatchesBulk(
    selectedHotelId, 
    departmentId
  )
  
  // === STATE OWNED BY THIS COMPONENT ===
  const [template, setTemplate] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  
  // UI-only history for current intake session
  // Resets on modal close, NOT persisted
  // If you need persistent history → move to backend (audit) or InventoryPage
  const [sessionHistory, setSessionHistory] = useState([])
  const [lastExpiryByProduct, setLastExpiryByProduct] = useState({})
  const [globalLastExpiry, setGlobalLastExpiry] = useState('')
  
  const targetDepartment = departmentId || (departments.length > 0 ? departments[0].id : null)

  // === Load template when templateId changes ===
  // Dependencies: ONLY templateId (not isOpen)
  // This ensures template reloads when user switches templates
  useEffect(() => {
    if (!templateId) return
    loadTemplate()
  }, [templateId])

  // Reset session history when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSessionHistory([])
      setLastExpiryByProduct({})
      setGlobalLastExpiry('')
    }
  }, [isOpen])

  const loadTemplate = async () => {
    setLoading(true)
    try {
      // Load all templates to find the one we need
      const data = await apiFetch('/delivery-templates')
      const templates = (data.templates || []).map(t => ({
        ...t,
        items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items || []
      }))
      
      const foundTemplate = templates.find(t => t.id === templateId)
      if (!foundTemplate) {
        addToast('Шаблон не найден', 'error')
        onClose()
        return
      }
      
      setTemplate(foundTemplate)
      prepareItems(foundTemplate)
    } catch (error) {
      addToast('Ошибка загрузки шаблона', 'error')
    } finally {
      setLoading(false)
    }
  }

  const prepareItems = (template) => {
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

  // === Update item in list ===
  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  // === Remove item from list ===
  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // === Date parsing utilities ===
  const parseExpiryInput = useCallback((input) => {
    if (!input) return null
    
    const cleaned = input.replace(/[^\d./-]/g, '')
    const patterns = [
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/,
      /^(\d{1,2})[./-](\d{1,2})$/,
    ]
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern)
      if (match) {
        let day = parseInt(match[1], 10)
        let month = parseInt(match[2], 10)
        let year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear()
        
        if (year < 100) year += 2000
        
        if (month < 1 || month > 12) return null
        if (year < 2026 || year > 2099) return null
        
        const daysInMonth = new Date(year, month, 0).getDate()
        if (day < 1 || day > daysInMonth) return null
        
        const date = new Date(year, month - 1, day)
        if (!isNaN(date.getTime()) && 
            date.getDate() === day && 
            date.getMonth() === month - 1 && 
            date.getFullYear() === year) {
          const yearStr = String(year).padStart(4, '0')
          const monthStr = String(month).padStart(2, '0')
          const dayStr = String(day).padStart(2, '0')
          return `${yearStr}-${monthStr}-${dayStr}`
        }
      }
    }
    return null
  }, [])

  const formatDateForDisplay = (isoDate) => {
    if (!isoDate) return ''
    const [year, month, day] = isoDate.split('-')
    return `${day}.${month}.${year.slice(-2)}`
  }

  const autoFormatDateInput = (value) => {
    const digits = value.replace(/\D/g, '')
    let formatted = ''
    for (let i = 0; i < digits.length && i < 8; i++) {
      if (i === 2 || i === 4) {
        formatted += '.'
      }
      formatted += digits[i]
    }
    return formatted
  }

  // === Save and continue - resets form but keeps modal open ===
  const handleSaveAndContinue = () => {
    if (!targetDepartment || items.length === 0 || !template) return
    
    // Validate dates
    const invalidItems = items.filter(item => {
      const year = parseInt(item.expiryDate?.split('-')[0], 10)
      return year < 2026
    })
    
    if (invalidItems.length > 0) {
      addToast(`${invalidItems.length} товар(ов) с годом до 2026. Исправьте даты.`, 'error')
      return
    }
    
    // ✨ React Query mutation - автоматические оптимистичные обновления
    applyTemplate(
      {
        templateId: template.id,
        items: items.map((item) => ({
          productId: item.productId || item.product_id,
          quantity: parseInt(item.quantity) || 1,
          expiryDate: item.expiryDate
        }))
      },
      {
        // Callbacks выполняются ПОСЛЕ mutation
        onSuccess: (data) => {
          // 1. Save last expiry dates for autocomplete
          if (items.length > 0) {
            setGlobalLastExpiry(items[0].expiryDate)
            items.forEach(item => {
              const productId = item.productId || item.product_id
              setLastExpiryByProduct(prev => ({ ...prev, [productId]: item.expiryDate }))
            })
          }
          
          // 2. Add to session history
          const newHistoryEntries = items.map((item, idx) => ({
            id: Date.now() + idx,
            productName: item.productName,
            quantity: parseInt(item.quantity) || 1,
            expiryDate: item.expiryDate,
            timestamp: new Date()
          }))
          setSessionHistory(prev => [...newHistoryEntries, ...prev])
          
          // 3. Show notification
          addToast(
            t('fastIntake.totalAdded', { count: items.length }) || 
            `Добавлено: ${items.length} позиций`,
            'success'
          )
          
          // 4. Reset ONLY form data, NOT modal state
          // ✅ Resets: items, quantities, expiry dates
          // ❌ Keeps: template, sessionHistory, modal open, lastExpiry cache
          prepareItems(template)
          
          // 5. НЕ ВЫЗЫВАЕМ onFastApply - React Query автоматически обновит инвентарь!
          // Фоновая синхронизация происходит автоматически через 2 секунды (см. useInventory.js)
        },
        onError: (error) => {
          const errorMessage = error?.message || t('toast.batchAddError') || 'Ошибка добавления партии'
          addToast(errorMessage, 'error')
        }
      }
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - don't close on click in fast mode */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          // Prevent accidental closing during fast input
          e.stopPropagation()
        }}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t('fastIntake.title') || 'Быстрый ввод'}
                </h2>
                {template && (
                  <p className="text-sm text-gray-500">{template.name}</p>
                )}
              </div>
            </div>
            
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <SectionLoader />
            ) : !template ? (
              <div className="text-center py-8 text-gray-500">
                Шаблон не найден
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header with change template button */}
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">
                    {t('templates.products') || 'Товары'} ({items.length})
                  </h3>
                  <button
                    onClick={onChangeTemplate}
                    className="text-sm text-red-500 hover:text-red-600 hover:underline transition-colors"
                  >
                    {t('templates.changeTemplate') || 'Сменить шаблон'}
                  </button>
                </div>

                {/* Items list - inline editing */}
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 sm:p-4 bg-muted/50 rounded-xl border border-border/50"
                    >
                      {/* Product name */}
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <p className="font-medium text-foreground text-base sm:text-sm truncate">
                          {item.productName}
                        </p>
                      </div>

                      {/* Quantity and expiry */}
                      <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                        {/* Quantity with +/- */}
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

                        {/* Expiry date */}
                        <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-[120px]">
                          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item._inputExpiry !== undefined ? item._inputExpiry : formatDateForDisplay(item.expiryDate)}
                            onChange={(e) => {
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
                              } else if (e.target.value.trim()) {
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
                                const newItems = [...items]
                                newItems[index] = { ...newItems[index], _inputExpiry: undefined, _invalidYear: false }
                                setItems(newItems)
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
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
                                // Move to next item or save button
                                const nextRow = e.target.closest('.rounded-xl')?.nextElementSibling
                                if (nextRow) {
                                  const nextDateInput = nextRow.querySelector('input[type="text"]')
                                  if (nextDateInput) {
                                    nextDateInput.focus()
                                    nextDateInput.select()
                                  }
                                } else {
                                  const saveButton = e.target.closest('.space-y-4')?.querySelector('button[aria-label*="Сохранить"]')
                                  if (saveButton) saveButton.focus()
                                }
                              }
                            }}
                            onFocus={(e) => {
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

                        {/* Remove item */}
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

                {/* Save and continue button */}
                <button
                  onClick={handleSaveAndContinue}
                  disabled={isPending || items.length === 0}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-lg touch-manipulation active:scale-[0.98]"
                  aria-busy={isPending}
                  aria-label={t('fastIntake.saveAndNext') || 'Сохранить и далее'}
                >
                  {isPending ? <ButtonLoader /> : <Check className="w-6 h-6" />}
                  {t('fastIntake.saveAndNext') || 'Сохранить и далее'}
                  <ArrowRight className="w-5 h-5" />
                </button>

                {/* Session history */}
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
            )}
          </div>

          {/* Footer */}
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
        </div>
      </div>
    </div>
  )
}