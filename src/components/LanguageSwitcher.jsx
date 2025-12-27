import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function LanguageSwitcher() {
  const { language, languages, changeLanguage, currentLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Закрытие dropdown при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Закрытие dropdown при нажатии Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleSelect = (langCode) => {
    changeLanguage(langCode)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Кнопка переключателя */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded transition-all duration-200',
          'text-sm text-charcoal dark:text-cream hover:bg-sand dark:hover:bg-white/10',
          'border border-transparent hover:border-sand dark:hover:border-white/20',
          isOpen && 'bg-sand dark:bg-white/10 border-sand dark:border-white/20'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4 text-warmgray" />
        <span className="font-medium">{currentLanguage?.shortName}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-warmgray transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown меню */}
      <div
        className={cn(
          'absolute right-0 top-full mt-2 w-40 bg-white dark:bg-dark-surface rounded-lg shadow-lg border border-sand dark:border-dark-border',
          'overflow-hidden z-50',
          'transition-all duration-200 origin-top-right',
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        )}
        role="listbox"
        aria-label="Select language"
      >
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
              'text-sm hover:bg-sand/50 dark:hover:bg-white/10',
              language === lang.code ? 'bg-sand/30 dark:bg-white/10 text-charcoal dark:text-cream font-medium' : 'text-warmgray'
            )}
            role="option"
            aria-selected={language === lang.code}
          >
            <span
              className={cn(
                'w-6 h-6 flex items-center justify-center rounded text-xs font-medium',
                language === lang.code ? 'bg-accent text-white' : 'bg-sand dark:bg-white/20 text-warmgray'
              )}
            >
              {lang.shortName}
            </span>
            <span>{lang.name}</span>
            {language === lang.code && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
