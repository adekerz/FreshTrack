import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Импортируем файлы локализации
import en from '../locales/en.json'
import ru from '../locales/ru.json'
import kk from '../locales/kk.json'
import fr from '../locales/fr.json'
import de from '../locales/de.json'
import es from '../locales/es.json'
import it from '../locales/it.json'
import ar from '../locales/ar.json'

const LanguageContext = createContext(null)

// Доступные языки (на основе MARSHA кодов отелей)
export const languages = [
  { code: 'en', name: 'English', shortName: 'EN' },
  { code: 'ru', name: 'Русский', shortName: 'RU' },
  { code: 'kk', name: 'Қазақша', shortName: 'KZ' },
  { code: 'fr', name: 'Français', shortName: 'FR' },
  { code: 'de', name: 'Deutsch', shortName: 'DE' },
  { code: 'es', name: 'Español', shortName: 'ES' },
  { code: 'it', name: 'Italiano', shortName: 'IT' },
  { code: 'ar', name: 'العربية', shortName: 'AR', rtl: true }
]

// Словари переводов
const translations = { en, ru, kk, fr, de, es, it, ar }

// Ключ для localStorage
const STORAGE_KEY = 'freshtrack_language'

export function LanguageProvider({ children }) {
  // Инициализация языка из localStorage или браузера
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && translations[saved]) {
      return saved
    }
    // Определяем язык браузера
    const browserLang = navigator.language.split('-')[0]
    if (translations[browserLang]) {
      return browserLang
    }
    return 'en' // По умолчанию английский
  })

  // Сохраняем выбор языка в localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
    // RTL отключён: при dir=rtl (арабский) ломалась вёрстка (flex/fixed) → чёрный экран.
    // Оставляем ltr; арабский текст отображается нормально, layout не переворачивается.
    document.documentElement.dir = 'ltr'
  }, [language])

  // Функция смены языка
  const changeLanguage = useCallback((newLang) => {
    if (translations[newLang]) {
      setLanguage(newLang)
    }
  }, [])

  // Функция получения перевода по ключу
  // Поддерживает вложенные ключи: 'header.title'
  const t = useCallback(
    (key, params = {}) => {
      const keys = key.split('.')
      let value = translations[language]

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k]
        } else {
          // Если перевод не найден, возвращаем ключ
          console.warn(`Translation not found: ${key}`)
          return key
        }
      }

      // Замена параметров {{param}}
      if (typeof value === 'string' && Object.keys(params).length > 0) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
          return params[param] !== undefined ? params[param] : match
        })
      }

      return value
    },
    [language]
  )

  // Получить текущий язык
  const currentLanguage = languages.find((l) => l.code === language)

  const value = {
    language,
    currentLanguage,
    languages,
    changeLanguage,
    t
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// Hook для доступа к контексту языка
export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

// Hook для доступа к функции перевода
export function useTranslation() {
  const { t } = useLanguage()
  return { t }
}
