import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Hook для debounce значения
 * @param {any} value - Значение для debounce
 * @param {number} delay - Задержка в ms (по умолчанию 500)
 * @returns {any} - Debounced значение
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook для debounce callback функции
 * @param {Function} callback - Функция для debounce
 * @param {number} delay - Задержка в ms (по умолчанию 500)
 * @returns {Function} - Debounced callback
 */
export function useDebouncedCallback(callback, delay = 500) {
  const timeoutRef = useRef(null)

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}