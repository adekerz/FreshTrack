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

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Calendar,
  Check,
  ArrowRight,
  History,
  Zap,
  Plus,
  Minus,
  MessageSquare,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { SectionLoader, ButtonLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useDepartment } from '../context/DepartmentContext'
import { useToast } from '../context/ToastContext'
import { useAddBatchesBulk } from '../hooks/useInventory'
import { useHotel } from '../context/HotelContext'
import { apiFetch } from '../services/api'

export default function FastIntakeModal({
  isOpen,
  templateId, // Template ID passed from parent
  onChangeTemplate, // () => void - opens SelectTemplateModal
  onClose, // () => void - full reset
  departmentId,
  onFastApply: _onFastApply, // (batches) => void - DEPRECATED: React Query handles updates automatically
}) {
  const { t } = useTranslation()
  const { departments } = useDepartment()
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
  const [_lastExpiryByProduct, setLastExpiryByProduct] = useState({})
  const [_globalLastExpiry, setGlobalLastExpiry] = useState('')
  const [comment, setComment] = useState('')
  const scrollContainerRef = useRef(null)

  // Per-product expiry dates from existing inventory batches: { [productId]: ISO[] }
  // Populated on template load, updated optimistically after save
  const [datesByProduct, setDatesByProduct] = useState({})
  // Which item row's date input is currently focused (for showing chips)
  const [focusedItemIndex, setFocusedItemIndex] = useState(null)

  // Undo state: stores pre-deletion items snapshot + label for the snackbar
  const [undoState, setUndoState] = useState(null) // { snapshot: items[], label: string }
  const undoTimerRef = useRef(null)
  const UNDO_DURATION = 4000

  // Keyboard toolbar: track visual viewport offset so toolbar sits above the keyboard on iOS
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  // Detect iOS for built-in keyboard navigation (hide custom toolbar on iOS)
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

  const targetDepartment =
    departmentId || (departments.length > 0 ? departments[0].id : null)

  // === Prepare items from template ===
  const prepareItems = useCallback((template) => {
    if (!template?.items) {
      setItems([])
      return
    }

    // Разворачиваем quantity в отдельные строки с группировкой
    const prepared = []
    template.items.forEach((item) => {
      const productId = item.productId || item.product_id
      const productName =
        item.productName || item.product_name || 'Неизвестный товар'
      // API возвращает default_quantity, а не quantity
      const qty = parseInt(item.default_quantity || item.quantity) || 1

      // Создаём qty строк для этого товара
      for (let i = 0; i < qty; i++) {
        prepared.push({
          productId,
          productName,
          quantity: 1, // Каждая строка = 1 единица товара
          expiryDate: null,
          _inputExpiry: undefined,
          _invalidYear: false,
          // Группировка для визуального отображения (если qty > 1)
          ...(qty > 1
            ? {
                _groupId: productId,
                _groupIndex: i,
                _groupTotal: qty,
              }
            : {}),
        })
      }
    })

    setItems(prepared)
  }, [])

  // === Load template when templateId changes ===
  const loadTemplate = useCallback(async () => {
    setLoading(true)
    try {
      // Load all templates to find the one we need
      const data = await apiFetch('/delivery-templates')
      const templates = (data.templates || []).map((t) => ({
        ...t,
        items:
          typeof t.items === 'string' ? JSON.parse(t.items) : t.items || [],
      }))

      const foundTemplate = templates.find((t) => t.id === templateId)
      if (!foundTemplate) {
        addToast('Шаблон не найден', 'error')
        onClose()
        return
      }

      setTemplate(foundTemplate)
      prepareItems(foundTemplate)

      // Load expiry date history from existing inventory batches (non-blocking)
      if (targetDepartment) {
        try {
          const batchData = await apiFetch(
            `/batches?departmentId=${targetDepartment}&limit=500&sortBy=createdAt&sortOrder=desc`
          )
          const batches = Array.isArray(batchData)
            ? batchData
            : batchData.batches || []
          const map = {}
          for (const b of batches) {
            const pid = b.product_id || b.productId
            const rawDate = b.expiry_date || b.expiryDate
            if (!pid || !rawDate) continue
            // Normalize to YYYY-MM-DD regardless of full ISO timestamp or date-only
            const date = String(rawDate).slice(0, 10)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
            if (!map[pid]) map[pid] = []
            if (!map[pid].includes(date)) map[pid].push(date)
          }
          setDatesByProduct(map)
        } catch {
          // Suggestions are non-critical, ignore errors silently
        }
      }
    } catch (error) {
      addToast('Ошибка загрузки шаблона', 'error')
    } finally {
      setLoading(false)
    }
  }, [templateId, targetDepartment, onClose, addToast, prepareItems])

  // Dependencies: ONLY templateId (not isOpen)
  // This ensures template reloads when user switches templates
  useEffect(() => {
    if (!templateId) return
    loadTemplate()
  }, [templateId, loadTemplate])

  // === Undo last deletion ===
  const handleUndo = useCallback(() => {
    if (!undoState) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setItems(undoState.snapshot)
    setUndoState(null)
    undoTimerRef.current = null
  }, [undoState])

  // Ctrl+Z / Cmd+Z — undo when snackbar is visible
  useEffect(() => {
    if (!undoState) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoState, handleUndo])

  // Clean up timer on unmount
  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    },
    []
  )

  // Track visual viewport to position keyboard toolbar above the software keyboard (iOS Safari)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () =>
      setKeyboardOffset(
        Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      )
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // Focus a specific date input by item index and scroll it into view
  const moveFocusTo = useCallback(
    (targetIndex) => {
      if (targetIndex < 0 || targetIndex >= items.length) return
      const inputs = scrollContainerRef.current?.querySelectorAll(
        'input[inputmode="numeric"]'
      )
      if (inputs?.[targetIndex]) {
        inputs[targetIndex].focus()
        inputs[targetIndex].select()
        inputs[targetIndex].scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      }
    },
    [items.length]
  )

  // === Update item in list ===
  const _updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  // === Remove item from list (с пересчётом группы) + undo support ===
  const removeItem = (index) => {
    const item = items[index]
    const keyboardWasOpen = focusedItemIndex !== null // keep keyboard if user was typing
    // Preserve the ORIGINAL snapshot from the first deletion in this undo window.
    // If snackbar is already visible, keep existing snapshot so undo restores ALL deletions.
    const baseSnapshot = undoState ? undoState.snapshot : [...items]
    const newCount = (undoState?.count || 0) + 1

    // Clear and restart the undo timer
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    const filtered = items.filter((_, i) => i !== index)

    // Если элемент был в группе — пересчитываем _groupIndex/_groupTotal
    if (item._groupId) {
      const groupId = item._groupId
      let groupCounter = 0
      const recalculated = filtered.map((it) => {
        if (it._groupId === groupId) {
          const newTotal = filtered.filter((x) => x._groupId === groupId).length
          const result = {
            ...it,
            _groupIndex: groupCounter,
            _groupTotal: newTotal,
          }
          groupCounter++
          // Если осталась 1 в группе — убираем метаданные группы
          if (newTotal === 1) {
            delete result._groupId
            delete result._groupIndex
            delete result._groupTotal
          }
          return result
        }
        return it
      })
      setItems(recalculated)
    } else {
      setItems(filtered)
    }

    // Show undo snackbar (preserve original snapshot for multi-delete)
    setUndoState({
      snapshot: baseSnapshot,
      count: newCount,
      label: item.productName || 'Товар',
    })
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null)
      undoTimerRef.current = null
    }, UNDO_DURATION)

    // If keyboard was open, refocus nearest remaining input so keyboard stays visible
    if (keyboardWasOpen && items.length > 1) {
      const targetIndex = Math.min(index, items.length - 2)
      setTimeout(() => {
        const inputs = scrollContainerRef.current?.querySelectorAll(
          'input[inputmode="numeric"]'
        )
        if (inputs?.[targetIndex]) {
          inputs[targetIndex].focus()
          inputs[targetIndex].select()
        }
      }, 30)
    }
  }

  // === Изменить размер группы (+1 или -1) ===
  // Принимает itemIndex — индекс первой (или любой) строки товара
  const changeGroupSize = (itemIndex, delta) => {
    const sourceItem = items[itemIndex]
    if (!sourceItem) return

    // Уникальный ключ группы — productId товара
    const productId = sourceItem.productId || sourceItem.product_id
    // Все текущие строки этого товара (по productId)
    const groupIndices = items.reduce(
      (acc, it, i) =>
        (it.productId || it.product_id) === productId ? [...acc, i] : acc,
      []
    )

    const currentSize = groupIndices.length
    const newSize = Math.max(1, currentSize + delta)
    if (newSize === currentSize) return

    let newItems = [...items]

    if (delta > 0) {
      // Вставляем новые строки после последней строки этого товара
      const lastIdx = groupIndices[groupIndices.length - 1]
      for (let d = 0; d < delta; d++) {
        newItems.splice(lastIdx + 1 + d, 0, {
          ...sourceItem,
          expiryDate: null, // новая строка — дату нужно ввести вручную
          _inputExpiry: undefined,
          _invalidYear: false,
        })
      }
    } else {
      // Удаляем последнюю строку этого товара
      for (let d = 0; d < Math.abs(delta); d++) {
        const currentGroupIdx = newItems.reduce(
          (acc, it, i) =>
            (it.productId || it.product_id) === productId ? [...acc, i] : acc,
          []
        )
        const lastIdx = currentGroupIdx[currentGroupIdx.length - 1]
        if (lastIdx >= 0) newItems.splice(lastIdx, 1)
      }
    }

    // Пересчитываем _groupIndex и _groupTotal для всех строк этого товара
    const finalGroup = newItems.reduce(
      (acc, it, i) =>
        (it.productId || it.product_id) === productId ? [...acc, i] : acc,
      []
    )
    const total = finalGroup.length

    let counter = 0
    newItems = newItems.map((it) => {
      if ((it.productId || it.product_id) !== productId) return it
      const copy = { ...it }
      if (total === 1) {
        delete copy._groupId
        delete copy._groupIndex
        delete copy._groupTotal
      } else {
        copy._groupId = productId
        copy._groupIndex = counter++
        copy._groupTotal = total
      }
      return copy
    })

    setItems(newItems)
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
        if (
          !isNaN(date.getTime()) &&
          date.getDate() === day &&
          date.getMonth() === month - 1 &&
          date.getFullYear() === year
        ) {
          const yearStr = String(year).padStart(4, '0')
          const monthStr = String(month).padStart(2, '0')
          const dayStr = String(day).padStart(2, '0')
          return `${yearStr}-${monthStr}-${dayStr}`
        }
      }
    }
    return null
  }, [])

  // Показываем ДД.ММ.ГГ (двузначный год) для быстрого ввода
  // null → пустая строка (плейсхолдер "--.--.--" покажется через placeholder)
  const formatDateForDisplay = (isoDate) => {
    if (!isoDate) return ''
    const [year, month, day] = isoDate.split('-')
    const shortYear = year.slice(2) // 2026 → 26
    return `${day}.${month}.${shortYear}`
  }

  // Форматирует ввод как ДД.ММ.ГГ (6 цифр максимум)
  const autoFormatDateInput = (value) => {
    const digits = value.replace(/\D/g, '')
    let formatted = ''
    for (let i = 0; i < digits.length && i < 6; i++) {
      if (i === 2 || i === 4) {
        formatted += '.'
      }
      formatted += digits[i]
    }
    return formatted
  }

  // === Date suggestion helpers ===

  // "+21д", "сегодня", "-3д"
  const getDaysLabel = (isoDate) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiry = new Date(isoDate + 'T00:00:00')
    const diff = Math.round((expiry - today) / 86400000)
    if (diff === 0) return 'сегодня'
    if (diff > 0) return `+${diff}д`
    return `${diff}д`
  }

  // Returns up to 4 suggested ISO dates for a given item.
  // Source: existing inventory batches for this product (loaded on modal open).
  // When typing, re-sorts by digit-prefix similarity so best match appears first.
  // Returns [] if no inventory history exists for this product.
  const getDateSuggestions = useCallback(
    (item) => {
      const productId = item.productId || item.product_id
      const history = datesByProduct[productId] || []
      if (history.length === 0) return []

      // Exclude the date that's already set on this row
      const available = history.filter((d) => d !== item.expiryDate)
      if (available.length === 0) return []

      // When typing: sort by how many leading digits match the input
      const typedDigits = (item._inputExpiry || '').replace(/\D/g, '')
      if (typedDigits.length > 0) {
        const scored = available.map((isoDate) => {
          const dateDigits = formatDateForDisplay(isoDate).replace(/\D/g, '')
          let score = 0
          for (
            let i = 0;
            i < typedDigits.length && i < dateDigits.length;
            i++
          ) {
            if (typedDigits[i] === dateDigits[i]) score++
            else break
          }
          return { isoDate, score }
        })
        scored.sort((a, b) => b.score - a.score)
        return scored.map(({ isoDate }) => isoDate).slice(0, 4)
      }

      return available.slice(0, 4)
    },
    [datesByProduct]
  )

  // Applies a suggested date and advances focus to next item
  const applyDateSuggestion = useCallback(
    (index, isoDate) => {
      const newItems = [...items]
      const item = newItems[index]
      const productId = item.productId || item.product_id
      newItems[index] = {
        ...item,
        expiryDate: isoDate,
        _inputExpiry: undefined,
        _invalidYear: false,
      }
      setItems(newItems)
      setLastExpiryByProduct((prev) => ({ ...prev, [productId]: isoDate }))
      setGlobalLastExpiry(isoDate)
      setFocusedItemIndex(null)
      setTimeout(() => {
        const inputs = scrollContainerRef.current?.querySelectorAll(
          'input[inputmode="numeric"]'
        )
        if (inputs?.[index + 1]) {
          inputs[index + 1].focus()
          inputs[index + 1].select()
        }
      }, 0)
    },
    [items]
  )

  // === Save and continue - resets form but keeps modal open ===
  const handleSaveAndContinue = () => {
    // Защита от множественных кликов
    if (isPending) return
    if (!targetDepartment || items.length === 0 || !template) return

    // Валидация: найти все строки без даты или с невалидной датой
    const invalidIndices = []
    const newItems = items.map((item, idx) => {
      const isEmpty = !item.expiryDate
      const year = parseInt(item.expiryDate?.split('-')[0], 10)
      const isBadYear = !isEmpty && year < 2026
      if (isEmpty || isBadYear) {
        invalidIndices.push(idx)
        return { ...item, _invalidYear: true }
      }
      return { ...item, _invalidYear: false }
    })

    if (invalidIndices.length > 0) {
      // Помечаем проблемные строки красным
      setItems(newItems)

      // Скроллим к первой проблемной строке
      const firstBadIdx = invalidIndices[0]
      const el = document.querySelector(`[data-item-index="${firstBadIdx}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Фокусируемся на поле даты
        setTimeout(() => {
          const dateInput = el.querySelector('input[type="text"]')
          if (dateInput) {
            dateInput.focus()
            dateInput.select()
          }
        }, 300)
      }

      const emptyCount = invalidIndices.length
      addToast(
        `${emptyCount} ${emptyCount === 1 ? 'товар' : 'товаров'}: укажите срок годности`,
        'error'
      )
      return
    }

    // Группируем items с одинаковым productId + expiryDate → суммируем quantity
    // Так один "быстрый ввод" с несколькими строками одного товара/срока → 1 batch в БД
    const groupedItems = Object.values(
      items.reduce((acc, item) => {
        const productId = item.productId || item.product_id
        const key = `${productId}__${item.expiryDate}`
        if (!acc[key]) {
          acc[key] = { productId, quantity: 0, expiryDate: item.expiryDate }
        }
        acc[key].quantity += parseInt(item.quantity) || 1
        return acc
      }, {})
    )

    // ✨ React Query mutation - автоматические оптимистичные обновления
    applyTemplate(
      {
        templateId: template.id,
        items: groupedItems,
        comment: comment.trim() || null,
      },
      {
        // Callbacks выполняются ПОСЛЕ mutation
        onSuccess: (_data) => {
          // 1. Save last expiry dates + update suggestion pool (optimistic, avoids reload)
          if (groupedItems.length > 0) {
            setGlobalLastExpiry(groupedItems[0].expiryDate)
            groupedItems.forEach((item) => {
              setLastExpiryByProduct((prev) => ({
                ...prev,
                [item.productId]: item.expiryDate,
              }))
            })
            // Prepend newly saved dates to datesByProduct so they appear in next intake
            setDatesByProduct((prev) => {
              const next = { ...prev }
              groupedItems.forEach((item) => {
                const existing = next[item.productId] || []
                if (!existing.includes(item.expiryDate)) {
                  next[item.productId] = [item.expiryDate, ...existing]
                }
              })
              return next
            })
          }

          // 2. Add to session history - используем groupedItems (уже схлопнуты по productId+expiryDate)
          const savedComment = comment.trim() || null

          // Для истории нужно productName — берём из исходных items
          const productNameById = items.reduce((acc, item) => {
            const productId = item.productId || item.product_id
            if (!acc[productId]) acc[productId] = item.productName
            return acc
          }, {})

          const newHistoryEntries = groupedItems.map((item, idx) => ({
            id: Date.now() + idx,
            productName: productNameById[item.productId] || item.productId,
            quantity: item.quantity,
            expiryDate: item.expiryDate,
            comment: savedComment,
            timestamp: new Date(),
          }))

          setSessionHistory((prev) => [...newHistoryEntries, ...prev])

          // 2a. Reset comment after successful save
          setComment('')

          // 3. Show notification
          const totalQty = groupedItems.reduce(
            (sum, it) => sum + it.quantity,
            0
          )
          addToast(
            t('fastIntake.totalAdded', { count: totalQty }) ||
              `Добавлено: ${totalQty} шт.`,
            'success'
          )

          // 4. Reset ONLY form data, NOT modal state
          // ✅ Resets: items, quantities, expiry dates
          // ❌ Keeps: template, sessionHistory, modal open, lastExpiry cache
          prepareItems(template)

          // Scroll to top
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
          }

          // 5. НЕ ВЫЗЫВАЕМ onFastApply - React Query автоматически обновит инвентарь!
          // Фоновая синхронизация происходит автоматически через 2 секунды (см. useInventory.js)
        },
        onError: (error) => {
          const errorMessage =
            error?.message ||
            t('toast.batchAddError') ||
            'Ошибка добавления партии'
          addToast(errorMessage, 'error')
        },
      }
    )
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Backdrop - don't close on click in fast mode */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          // Prevent accidental closing during fast input
          e.stopPropagation()
        }}
      />

      {/* Modal — mobile: slide-up bottom sheet; desktop: centered */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="relative bg-card rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header — sticky on mobile */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0 bg-card">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 shrink-0">
                <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {t('fastIntake.title') || 'Быстрый ввод'}
                </h2>
                {template && (
                  <p className="text-sm text-gray-500 truncate">
                    {template.name}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] p-2 hover:bg-muted rounded-lg transition-colors touch-manipulation shrink-0"
              aria-label={t('common.close') || 'Закрыть'}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content — scrollable */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"
          >
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
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const isGrouped = item._groupTotal > 1
                    const isFirstInGroup = isGrouped && item._groupIndex === 0
                    const isLastInGroup =
                      isGrouped && item._groupIndex === item._groupTotal - 1
                    // Показываем контрол кол-ва только у первой строки группы (или у одиночного)
                    const showQtyControl = !isGrouped || isFirstInGroup
                    const currentGroupSize = isGrouped ? item._groupTotal : 1
                    // Индекс первой строки группы для changeGroupSize
                    const firstInGroupIndex = isGrouped
                      ? items.findIndex(
                          (it) =>
                            it._groupId === item._groupId &&
                            it._groupIndex === 0
                        )
                      : index

                    // Вычисляем классы скругления отдельно
                    const roundingClass = isGrouped
                      ? isFirstInGroup
                        ? 'rounded-t-xl rounded-b-none'
                        : isLastInGroup
                          ? 'rounded-b-xl rounded-t-none'
                          : 'rounded-none'
                      : 'rounded-xl'
                    const borderClass = item._invalidYear
                      ? 'border-red-500/60 bg-red-500/5'
                      : isGrouped && !isLastInGroup
                        ? 'border-border/50 border-b-0'
                        : 'border-border/50'

                    return (
                      <div
                        key={index}
                        data-item-index={index}
                        className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 px-3 py-2.5 sm:p-4 bg-muted/50 border transition-colors ${roundingClass} ${borderClass}`}
                      >
                        {/* Product name */}
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {item.productName}
                            </p>
                            {isGrouped && (
                              <span className="text-xs text-amber-500 font-semibold shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                {item._groupIndex + 1}/{item._groupTotal}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expiry + remove */}
                        <div className="flex items-start gap-2 w-full sm:w-auto">
                          {/* Quantity control — только у первой строки группы */}
                          {showQtyControl ? (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  changeGroupSize(firstInGroupIndex, -1)
                                }
                                disabled={currentGroupSize <= 1}
                                className="p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors touch-manipulation active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Уменьшить количество"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium text-foreground tabular-nums">
                                {currentGroupSize}
                              </span>
                              <button
                                type="button"
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  changeGroupSize(firstInGroupIndex, 1)
                                }
                                className="p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors touch-manipulation active:scale-95"
                                aria-label="Увеличить количество"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            // Заглушка для выравнивания у дочерних строк группы (ширина = кнопка + цифра + кнопка)
                            <div className="w-[76px] shrink-0" />
                          )}

                          {/* Expiry date */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Calendar
                                className={`w-4 h-4 shrink-0 ${item._invalidYear ? 'text-red-500' : 'text-gray-400'}`}
                              />
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  item._inputExpiry !== undefined
                                    ? item._inputExpiry
                                    : formatDateForDisplay(item.expiryDate)
                                }
                                onChange={(e) => {
                                  const formatted = autoFormatDateInput(
                                    e.target.value
                                  )
                                  const newItems = [...items]
                                  newItems[index] = {
                                    ...newItems[index],
                                    _inputExpiry: formatted,
                                    _invalidYear: false,
                                  }
                                  setItems(newItems)
                                }}
                                onBlur={(e) => {
                                  setFocusedItemIndex(null)
                                  const parsed = parseExpiryInput(
                                    e.target.value
                                  )
                                  if (parsed) {
                                    const newItems = [...items]
                                    newItems[index] = {
                                      ...newItems[index],
                                      expiryDate: parsed,
                                      _inputExpiry: undefined,
                                      _invalidYear: false,
                                    }
                                    setItems(newItems)
                                    setGlobalLastExpiry(parsed)
                                    const productId =
                                      item.productId || item.product_id
                                    setLastExpiryByProduct((prev) => ({
                                      ...prev,
                                      [productId]: parsed,
                                    }))
                                  } else if (e.target.value.trim()) {
                                    const digits = e.target.value.replace(
                                      /\D/g,
                                      ''
                                    )
                                    if (digits.length >= 6) {
                                      const _day = parseInt(
                                        digits.slice(0, 2),
                                        10
                                      )
                                      const _month = parseInt(
                                        digits.slice(2, 4),
                                        10
                                      )
                                      let year = parseInt(
                                        digits.slice(4, 6),
                                        10
                                      )
                                      if (year < 100) year += 2000

                                      if (year < 2026 || year > 2099) {
                                        addToast(
                                          'Год должен быть от 2026 до 2099',
                                          'error'
                                        )
                                        const newItems = [...items]
                                        newItems[index] = {
                                          ...newItems[index],
                                          _invalidYear: true,
                                        }
                                        setItems(newItems)
                                        return
                                      }
                                    }
                                    const newItems = [...items]
                                    newItems[index] = {
                                      ...newItems[index],
                                      _inputExpiry: undefined,
                                      _invalidYear: false,
                                    }
                                    setItems(newItems)
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    const parsed = parseExpiryInput(
                                      e.target.value
                                    )
                                    if (parsed) {
                                      const newItems = [...items]
                                      newItems[index] = {
                                        ...newItems[index],
                                        expiryDate: parsed,
                                        _inputExpiry: undefined,
                                        _invalidYear: false,
                                      }
                                      setItems(newItems)
                                      setGlobalLastExpiry(parsed)
                                      const productId =
                                        item.productId || item.product_id
                                      setLastExpiryByProduct((prev) => ({
                                        ...prev,
                                        [productId]: parsed,
                                      }))
                                    }
                                    // Move to next item or save button
                                    const nextRow =
                                      e.target.closest(
                                        '.rounded-xl'
                                      )?.nextElementSibling
                                    if (nextRow) {
                                      const nextDateInput =
                                        nextRow.querySelector(
                                          'input[type="text"]'
                                        )
                                      if (nextDateInput) {
                                        nextDateInput.focus()
                                        nextDateInput.select()
                                      }
                                    } else {
                                      const saveButton = e.target
                                        .closest('.space-y-4')
                                        ?.querySelector(
                                          'button[aria-label*="Сохранить"]'
                                        )
                                      if (saveButton) saveButton.focus()
                                    }
                                  }
                                }}
                                onFocus={(e) => {
                                  e.target.select()
                                  setFocusedItemIndex(index)
                                }}
                                enterKeyHint={
                                  index < items.length - 1 ? 'next' : 'done'
                                }
                                placeholder={
                                  item._invalidYear ? '--.--.--' : 'ДД.ММ.ГГ'
                                }
                                className={`w-full min-w-0 text-center px-2 py-2 sm:py-1.5 border rounded-lg bg-card text-base sm:text-sm focus:outline-none focus:ring-2 ${
                                  item._invalidYear
                                    ? 'border-red-500 focus:ring-red-500/30 focus:border-red-500 text-red-400 placeholder-red-400'
                                    : 'border-border focus:ring-amber-500/30 focus:border-amber-500 text-foreground'
                                }`}
                              />
                            </div>
                            {/* Date suggestion chips — appear on focus if there are recent dates */}
                            {focusedItemIndex === index &&
                              getDateSuggestions(item).length > 0 && (
                                <div className="mt-1.5 ml-[22px] flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                  {getDateSuggestions(item).map((isoDate) => (
                                    <button
                                      key={isoDate}
                                      type="button"
                                      onPointerDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        applyDateSuggestion(index, isoDate)
                                      }}
                                      className="flex-none flex flex-col items-center px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 active:scale-95 transition-transform touch-manipulation select-none"
                                    >
                                      <span className="text-xs font-semibold tabular-nums leading-tight">
                                        {formatDateForDisplay(isoDate)}
                                      </span>
                                      <span className="text-[10px] opacity-60 tabular-nums leading-tight">
                                        {getDaysLabel(isoDate)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                          </div>

                          {/* Remove item */}
                          <button
                            type="button"
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => removeItem(index)}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg shrink-0 transition-colors touch-manipulation active:scale-95"
                            aria-label="Удалить товар"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Comment field — applies to all batches in this intake */}
                <div className="flex items-start gap-2 px-3 py-2.5 sm:p-4 bg-muted/30 border border-border/50 rounded-xl">
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-2.5 shrink-0" />
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      t('fastIntake.commentPlaceholder') ||
                      'Комментарий к партии (необязательно)'
                    }
                    rows={2}
                    maxLength={1000}
                    className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
                  />
                </div>

                {/* Save and continue button */}
                <button
                  onClick={handleSaveAndContinue}
                  disabled={isPending || items.length === 0}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-lg touch-manipulation active:scale-[0.98]"
                  aria-busy={isPending}
                  aria-label={
                    t('fastIntake.saveAndNext') || 'Сохранить и далее'
                  }
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
                      {t('fastIntake.sessionHistory') ||
                        'Добавлено в этой сессии'}{' '}
                      ({sessionHistory.length})
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {sessionHistory.slice(0, 10).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between py-1.5 px-2 bg-green-50 dark:bg-green-900/20 rounded text-xs"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Check className="w-3 h-3 text-green-600 shrink-0" />
                            <span className="truncate">
                              {entry.productName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                            <span>×{entry.quantity}</span>
                            <span>
                              {formatDateForDisplay(entry.expiryDate)}
                            </span>
                            {entry.comment && (
                              <span
                                className="text-amber-500 truncate max-w-[80px]"
                                title={entry.comment}
                              >
                                {entry.comment}
                              </span>
                            )}
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
                : 'Выберите товар'}
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

      {/* Undo snackbar — same visual style as site toasts */}
      {undoState && (
        <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:min-w-[300px] sm:max-w-[400px] z-[200] animate-toast-in">
          <div className="relative flex items-center gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm bg-warning/10 border-warning/30">
            <RotateCcw className="w-5 h-5 text-warning shrink-0" />
            <span className="flex-1 text-sm text-foreground min-w-0 truncate">
              {undoState.count > 1 ? (
                `Удалено ${undoState.count} ${undoState.count < 5 ? 'товара' : 'товаров'}`
              ) : (
                <>
                  Удалено:{' '}
                  <span className="font-semibold">{undoState.label}</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="shrink-0 text-warning font-semibold text-sm hover:opacity-80 active:scale-95 transition-all touch-manipulation"
            >
              Отмена
            </button>
            {/* Progress bar — reuses site's animate-toast-progress */}
            <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl overflow-hidden">
              <div
                className="h-full bg-warning animate-toast-progress"
                style={{ animationDuration: `${UNDO_DURATION}ms` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Keyboard navigation toolbar — mobile only (not iOS, which has built-in navigation) */}
      {!isIOS && focusedItemIndex !== null && items.length > 0 && (
        <div
          className="sm:hidden fixed left-0 right-0 z-[150]"
          style={{ bottom: keyboardOffset }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/95 backdrop-blur-sm border-t border-border">
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => moveFocusTo(focusedItemIndex - 1)}
              disabled={focusedItemIndex === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-30 transition-colors touch-manipulation active:scale-95"
            >
              <ChevronUp className="w-4 h-4" />
              Пред
            </button>
            <span className="text-xs text-muted-foreground tabular-nums select-none">
              {focusedItemIndex + 1} / {items.length}
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => moveFocusTo(focusedItemIndex + 1)}
              disabled={focusedItemIndex >= items.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted disabled:opacity-30 transition-colors touch-manipulation active:scale-95"
            >
              Далее
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
