import { createContext, useContext, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  // Добавить тост - поддерживает два формата:
  // 1. addToast({ type, title, message }) - объект с опциями
  // 2. addToast(title, type) - простой формат (title: string, type: 'success'|'error'|etc)
  const addToast = useCallback((optionsOrTitle, typeArg) => {
    const id = uuidv4()
    
    // Если первый аргумент - строка, используем простой формат
    let options
    if (typeof optionsOrTitle === 'string') {
      options = {
        title: optionsOrTitle,
        type: typeArg || 'info',
        message: ''
      }
    } else {
      options = optionsOrTitle
    }
    
    const toast = {
      id,
      type: options.type || 'info', // success, error, warning, info, loading
      title: options.title || '',
      message: options.message || '',
      duration: options.duration ?? (options.type === 'loading' ? null : 4000),
      ...options
    }

    setToasts((prev) => [...prev, toast])

    // Автоматическое удаление (если не loading)
    if (toast.duration) {
      setTimeout(() => {
        removeToast(id)
      }, toast.duration)
    }

    return id
  }, [])

  // Удалить тост
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Обновить тост (для loading -> success/error)
  const updateToast = useCallback((id, options) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...options }
          // Если тип изменился с loading, добавляем таймаут удаления
          if (t.type === 'loading' && options.type !== 'loading') {
            setTimeout(() => {
              removeToast(id)
            }, options.duration ?? 4000)
          }
          return updated
        }
        return t
      })
    )
  }, [removeToast])

  // Хелперы
  const success = useCallback((title, message) => {
    return addToast({ type: 'success', title, message })
  }, [addToast])

  const error = useCallback((title, message) => {
    return addToast({ type: 'error', title, message, duration: 6000 })
  }, [addToast])

  const warning = useCallback((title, message) => {
    return addToast({ type: 'warning', title, message })
  }, [addToast])

  const info = useCallback((title, message) => {
    return addToast({ type: 'info', title, message })
  }, [addToast])

  const loading = useCallback((title, message) => {
    return addToast({ type: 'loading', title, message })
  }, [addToast])

  // Promise wrapper
  const promise = useCallback(async (promiseFn, options) => {
    const id = loading(
      options.loading?.title || 'Загрузка...',
      options.loading?.message || ''
    )

    try {
      const result = await promiseFn
      updateToast(id, {
        type: 'success',
        title: options.success?.title || 'Успешно!',
        message: options.success?.message || ''
      })
      return result
    } catch (err) {
      updateToast(id, {
        type: 'error',
        title: options.error?.title || 'Ошибка',
        message: options.error?.message || err.message || 'Что-то пошло не так'
      })
      throw err
    }
  }, [loading, updateToast])

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        updateToast,
        success,
        error,
        warning,
        info,
        loading,
        promise
      }}
    >
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export default ToastContext
