/**
 * MarshaCodeSelector - Компонент для выбора MARSHA кода отеля Marriott
 * Поддерживает fuzzy search по названию отеля
 * Автоматически предлагает код при вводе названия отеля
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { apiFetch } from '../services/api'
import { Search, Check, X, ChevronDown, Building2, MapPin, Globe, AlertCircle } from 'lucide-react'
import { InlineLoader } from './ui'

/**
 * @param {Object} props
 * @param {string} props.hotelName - Название отеля для автоподсказок
 * @param {string} props.selectedCode - Выбранный MARSHA код
 * @param {function} props.onSelect - Callback при выборе кода (code, codeId)
 * @param {function} props.onSelectWithDetails - Callback при выборе кода с полными данными (marshaCodeObject)
 * @param {function} props.onClear - Callback при очистке выбора
 * @param {boolean} props.disabled - Отключить компонент
 * @param {boolean} props.required - Обязательное поле
 * @param {string} props.className - Дополнительные CSS классы
 */
export default function MarshaCodeSelector({
  hotelName = '',
  selectedCode = null,
  onSelect,
  onSelectWithDetails,
  onClear,
  disabled = false,
  required = false,
  className = ''
}) {
  const { t } = useTranslation()

  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDetails, setSelectedDetails] = useState(null)

  const containerRef = useRef(null)
  const searchInputRef = useRef(null)

  // Debounce для поиска
  const debounceRef = useRef(null)

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Автоподсказки при изменении названия отеля
  useEffect(() => {
    if (hotelName && hotelName.length >= 3 && !selectedCode) {
      fetchSuggestions(hotelName)
    }
  }, [hotelName, selectedCode])

  // Загрузка деталей выбранного кода
  useEffect(() => {
    if (selectedCode) {
      fetchCodeDetails(selectedCode)
    } else {
      setSelectedDetails(null)
    }
  }, [selectedCode])

  const fetchSuggestions = async (name) => {
    try {
      const data = await apiFetch(`/marsha-codes/suggest?hotelName=${encodeURIComponent(name)}`)
      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
    }
  }

  const fetchCodeDetails = async (code) => {
    try {
      const data = await apiFetch(`/marsha-codes/${code}`)
      setSelectedDetails(data.marshaCode || null)
    } catch (error) {
      console.error('Failed to fetch code details:', error)
      setSelectedDetails(null)
    }
  }

  const handleSearch = useCallback((query) => {
    setSearch(query)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (query.length < 2) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        console.log('[MarshaCodeSelector] Searching for:', query)
        const data = await apiFetch(`/marsha-codes/search?q=${encodeURIComponent(query)}&limit=10`)
        console.log('[MarshaCodeSelector] Search results:', data)
        setSearchResults(data.results || [])
      } catch (error) {
        console.error('[MarshaCodeSelector] Search failed:', error)
        setSearchResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const handleSelect = (code) => {
    onSelect?.(code.code, code.id)
    // Передаём все данные MARSHA кода для автозаполнения
    onSelectWithDetails?.(code)
    setIsOpen(false)
    setSearch('')
    setSearchResults([])
  }

  const handleClear = () => {
    onClear?.()
    setSelectedDetails(null)
  }

  const getBrandLabel = (brand) => {
    const brands = {
      RZ: 'Ritz-Carlton',
      XR: 'St. Regis',
      WH: 'W Hotels',
      ED: 'EDITION',
      LC: 'Luxury Collection',
      MC: 'Marriott Hotels',
      SI: 'Sheraton',
      WI: 'Westin',
      MD: 'Le Méridien',
      BR: 'Renaissance',
      AK: 'Autograph Collection',
      TX: 'Tribute Portfolio',
      DE: 'Design Hotels',
      CY: 'Courtyard',
      FN: 'Four Points',
      AR: 'Aloft',
      EL: 'Element',
      XY: 'Moxy',
      FP: 'Fairfield',
      RI: 'Residence Inn',
      TH: 'Marriott Executive',
      MV: 'Marriott Vacation'
    }
    return brands[brand] || brand
  }

  const renderCodeItem = (code, showSimilarity = false) => (
    <button
      key={code.id || code.code}
      onClick={() => handleSelect(code)}
      disabled={code.is_assigned}
      className={`
        w-full text-left p-3 rounded-lg transition-colors
        ${
          code.is_assigned
            ? 'bg-muted/50 cursor-not-allowed opacity-60'
            : 'hover:bg-accent/10 cursor-pointer'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-accent">{code.code}</span>
            <span className="text-xs px-1.5 py-0.5 bg-accent/10 rounded text-accent">
              {getBrandLabel(code.brand)}
            </span>
            {showSimilarity && code.similarity && (
              <span className="text-xs text-muted-foreground">
                {Math.round(code.similarity * 100)}% match
              </span>
            )}
          </div>
          <div className="text-sm text-foreground mt-1 truncate">{code.hotel_name}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <MapPin className="w-3 h-3" />
            <span>
              {code.city}, {code.country}
            </span>
          </div>
        </div>
        {code.is_assigned && (
          <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded">
            {t('marshaCode.assigned') || 'Занят'}
          </span>
        )}
      </div>
    </button>
  )

  // Если код уже выбран - показываем его
  if (selectedCode && selectedDetails) {
    return (
      <div className={`relative ${className}`}>
        <label className="block text-sm font-medium text-foreground mb-1">
          {t('marshaCode.label') || 'MARSHA код'}
        </label>
        <div className="flex items-center gap-2 p-3 bg-success/5 border border-success/30 rounded-lg">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-success">{selectedDetails.code}</span>
              <span className="text-xs px-1.5 py-0.5 bg-accent/10 rounded text-accent">
                {getBrandLabel(selectedDetails.brand)}
              </span>
            </div>
            <div className="text-sm text-foreground mt-1">{selectedDetails.hotel_name}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3 h-3" />
              <span>
                {selectedDetails.city}, {selectedDetails.country}
              </span>
            </div>
          </div>
          {!disabled && (
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
              title={t('common.remove') || 'Удалить'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-foreground mb-1">
        {t('marshaCode.label') || 'Код MARSHA (Marriott)'}
        {required ? (
          <span className="text-danger ml-1">*</span>
        ) : (
          <span className="text-muted-foreground font-normal ml-1">
            ({t('marshaCode.optional') || 'опционально'})
          </span>
        )}
      </label>

      {/* Триггер */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5
          border border-border rounded-lg bg-card
          text-left transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent/50 cursor-pointer'}
          ${isOpen ? 'ring-2 ring-accent/20 border-accent' : ''}
        `}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Building2 className="w-4 h-4" />
          <span>{t('marshaCode.selectCode') || 'Выбрать код Marriott'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Подсказки на основе названия отеля */}
      {suggestions.length > 0 && !isOpen && !selectedCode && (
        <div className="mt-2 p-3 bg-accent/5 border border-accent/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-accent mb-2">
            <AlertCircle className="w-4 h-4" />
            {t('marshaCode.suggestionsFound') || 'Найдены похожие коды:'}
          </div>
          <div className="space-y-1">
            {suggestions.slice(0, 3).map((code) => (
              <button
                key={code.code}
                onClick={() => handleSelect(code)}
                disabled={code.is_assigned}
                className={`
                  w-full text-left p-2 rounded text-sm transition-colors
                  ${code.is_assigned ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/10'}
                `}
              >
                <span className="font-mono font-bold text-accent">{code.code}</span>
                <span className="text-muted-foreground ml-2">— {code.hotel_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-96 overflow-hidden">
          {/* Поиск */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={
                  t('marshaCode.searchPlaceholder') || 'Поиск по названию, городу или коду...'
                }
                className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                autoFocus
              />
              {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <InlineLoader />
                </span>
              )}
            </div>
          </div>

          {/* Результаты */}
          <div className="overflow-y-auto max-h-72 p-2">
            {/* Результаты поиска */}
            {search.length >= 2 && searchResults.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                  {t('marshaCode.searchResults') || 'Результаты поиска'}
                </div>
                {searchResults.map((code) => renderCodeItem(code, true))}
              </div>
            )}

            {/* Подсказки если нет поиска */}
            {search.length < 2 && suggestions.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                  {t('marshaCode.suggestedCodes') || 'Рекомендуемые коды'}
                </div>
                {suggestions.map((code) => renderCodeItem(code, true))}
              </div>
            )}

            {/* Пустое состояние */}
            {search.length >= 2 && searchResults.length === 0 && !loading && (
              <div className="p-8 text-center text-muted-foreground">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('marshaCode.noResults') || 'Ничего не найдено'}</p>
                <p className="text-xs mt-1">
                  {t('marshaCode.tryDifferent') || 'Попробуйте другой запрос'}
                </p>
              </div>
            )}

            {/* Начальное состояние */}
            {search.length < 2 && suggestions.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {t('marshaCode.startTyping') || 'Начните вводить для поиска'}
                </p>
                <p className="text-xs mt-1">
                  {t('marshaCode.searchHint') || 'Название отеля, город или код'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
