/**
 * useFocusTrap Hook
 * Traps focus within a container (modal, dropdown, etc.)
 * WCAG 2.1.2 - keyboard navigation within modals
 */

import { useEffect, useRef } from 'react'

/**
 * useFocusTrap - удерживает фокус внутри контейнера
 * @param {boolean} isActive - Включить/выключить trap
 * @param {Object} options - Опции
 * @param {boolean} options.autoFocus - Автоматически фокусировать первый элемент
 * @param {boolean} options.returnFocus - Возвращать фокус на предыдущий элемент при деактивации
 * @returns {React.RefObject} - Ref для контейнера
 */
export function useFocusTrap(isActive = false, options = {}) {
  const {
    autoFocus = true,
    returnFocus = true
  } = options

  const containerRef = useRef(null)
  const previouslyFocusedElement = useRef(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return undefined

    const container = containerRef.current

    // Сохраняем текущий focused элемент
    if (returnFocus) {
      previouslyFocusedElement.current = document.activeElement
    }

    // Селектор для focusable элементов
    const focusableSelector = `
      a[href],
      button:not([disabled]),
      textarea:not([disabled]),
      input:not([disabled]),
      select:not([disabled]),
      [tabindex]:not([tabindex="-1"])
    `

    const getFocusableElements = () => {
      return Array.from(container.querySelectorAll(focusableSelector)).filter(
        (el) => {
          // Проверяем видимость элемента
          return (
            el.offsetWidth > 0 &&
            el.offsetHeight > 0 &&
            window.getComputedStyle(el).visibility !== 'hidden'
          )
        }
      )
    }

    // Фокусируем первый элемент
    if (autoFocus) {
      const focusableElements = getFocusableElements()
      const firstElement = focusableElements[0]
      if (firstElement) {
        // Небольшая задержка для корректной работы с анимациями
        setTimeout(() => {
          firstElement.focus()
        }, 100)
      }
    }

    // Обработка Tab для циклического перемещения
    const handleTab = (event) => {
      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        // Shift + Tab - движение назад
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab - движение вперед
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTab)

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleTab)

      // Возвращаем фокус на предыдущий элемент
      if (returnFocus && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus()
      }
    }
  }, [isActive, autoFocus, returnFocus])

  return containerRef
}

/**
 * useFocusLock - простая версия focus trap без циклического перемещения
 * Просто блокирует фокус вне контейнера
 */
export function useFocusLock(isActive = false) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return undefined

    const container = containerRef.current

    const handleFocus = (event) => {
      // Если фокус ушел за пределы контейнера, возвращаем его обратно
      if (!container.contains(event.target)) {
        event.preventDefault()
        event.stopPropagation()

        // Фокусируем первый focusable элемент в контейнере
        const focusable = container.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable) {
          focusable.focus()
        }
      }
    }

    document.addEventListener('focusin', handleFocus, true)

    return () => {
      document.removeEventListener('focusin', handleFocus, true)
    }
  }, [isActive])

  return containerRef
}

export default useFocusTrap
