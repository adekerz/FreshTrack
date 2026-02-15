/**
 * useKeyboardNav Hook
 * Centralized keyboard navigation and shortcuts
 * Supports common keyboard patterns for better UX
 */

import { useEffect, useCallback } from 'react'

/**
 * useKeyboardNav - добавляет глобальные горячие клавиши
 * @param {Object} callbacks - Объект с callback функциями
 * @param {Function} callbacks.onEscape - Вызывается при нажатии ESC (закрыть модалку)
 * @param {Function} callbacks.onSearch - Вызывается при Ctrl/Cmd+K (открыть поиск)
 * @param {Function} callbacks.onCreate - Вызывается при Ctrl/Cmd+N (создать новый)
 * @param {Function} callbacks.onSave - Вызывается при Ctrl/Cmd+S (сохранить)
 * @param {Function} callbacks.onExport - Вызывается при Ctrl/Cmd+E (экспорт)
 * @param {Function} callbacks.onHelp - Вызывается при ? (помощь)
 * @param {Function} callbacks.onRefresh - Вызывается при Ctrl/Cmd+R (обновить)
 * @param {boolean} enabled - Включить/выключить хук (по умолчанию true)
 */
export function useKeyboardNav(callbacks = {}, enabled = true) {
  const handleKeyDown = useCallback(
    (event) => {
      // Игнорируем если пользователь в input/textarea (кроме Escape)
      const isInputFocused =
        event.target.matches('input, textarea, select, [contenteditable="true"]')

      // ESC - всегда работает (даже в input для закрытия модалок)
      if (event.key === 'Escape' && callbacks.onEscape) {
        callbacks.onEscape()
        return
      }

      // Остальные shortcuts не работают в input/textarea
      if (isInputFocused) return

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifierKey = isMac ? event.metaKey : event.ctrlKey

      // Ctrl/Cmd + K - Поиск
      if (modifierKey && event.key === 'k') {
        event.preventDefault()
        callbacks.onSearch?.()
      }

      // Ctrl/Cmd + N - Создать новый
      else if (modifierKey && event.key === 'n') {
        event.preventDefault()
        callbacks.onCreate?.()
      }

      // Ctrl/Cmd + S - Сохранить
      else if (modifierKey && event.key === 's') {
        event.preventDefault()
        callbacks.onSave?.()
      }

      // Ctrl/Cmd + E - Экспорт
      else if (modifierKey && event.key === 'e') {
        event.preventDefault()
        callbacks.onExport?.()
      }

      // Ctrl/Cmd + R - Обновить (переопределяем браузерный refresh)
      else if (modifierKey && event.key === 'r') {
        event.preventDefault()
        callbacks.onRefresh?.()
      }

      // ? - Помощь (только если не в input)
      else if (event.key === '?' && !event.shiftKey) {
        callbacks.onHelp?.()
      }

      // / - Фокус на поиск (как в GitHub)
      else if (event.key === '/') {
        event.preventDefault()
        callbacks.onSearch?.()
      }
    },
    [callbacks]
  )

  useEffect(() => {
    if (!enabled) return undefined

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}

/**
 * useEscapeKey - простой хук для обработки ESC
 * @param {Function} onEscape - Callback при нажатии ESC
 * @param {boolean} enabled - Включить/выключить хук
 */
export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onEscape()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onEscape, enabled])
}

/**
 * useArrowKeys - навигация стрелками (для списков, меню)
 * @param {Function} onArrowUp - Стрелка вверх
 * @param {Function} onArrowDown - Стрелка вниз
 * @param {Function} onArrowLeft - Стрелка влево
 * @param {Function} onArrowRight - Стрелка вправо
 * @param {Function} onEnter - Enter (выбрать элемент)
 * @param {boolean} enabled - Включить/выключить хук
 */
export function useArrowKeys(
  { onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter },
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return undefined

    const handleKeyDown = (event) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          onArrowUp?.()
          break
        case 'ArrowDown':
          event.preventDefault()
          onArrowDown?.()
          break
        case 'ArrowLeft':
          event.preventDefault()
          onArrowLeft?.()
          break
        case 'ArrowRight':
          event.preventDefault()
          onArrowRight?.()
          break
        case 'Enter':
          onEnter?.()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter, enabled])
}

export default useKeyboardNav
