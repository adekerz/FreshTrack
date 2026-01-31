/**
 * CityAutocomplete — подсказки городов и автоопределение timezone (GeoNames).
 * Используется в форме создания/редактирования отеля.
 */

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { apiFetch } from '../../services/api'
import { cn } from '../../utils/classNames'

export function CityAutocomplete({ value, onChange, onTimezoneDetected }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const timeoutRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(
          `/hotels/city-suggestions?q=${encodeURIComponent(query)}`
        )
        setSuggestions(data.suggestions || [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [query])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectCity = async (city) => {
    setQuery(city.displayName)
    onChange(city.name)
    setShowSuggestions(false)

    try {
      setLoading(true)
      const data = await apiFetch('/hotels/detect-timezone', {
        method: 'POST',
        body: JSON.stringify({
          city: city.name,
          countryCode: city.countryCode
        })
      })
      if (data.success && onTimezoneDetected) {
        onTimezoneDetected({
          timezone: data.timezone,
          city: data.city,
          country: data.country,
          coordinates: data.coordinates
        })
      }
    } catch {
      onTimezoneDetected?.(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={t('hotels.cityPlaceholder')}
          className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent min-h-[48px]"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showSuggestions && suggestions.length > 0}
        />
        {loading && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin"
            aria-hidden
          />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((city, index) => (
            <li key={`${city.name}-${city.countryCode}-${index}`} role="option">
              <button
                type="button"
                onClick={() => handleSelectCity(city)}
                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3 min-h-[48px]"
              >
                <MapPin className="w-4 h-4 text-accent flex-shrink-0" aria-hidden />
                <div>
                  <div className="font-medium text-foreground">{city.name}</div>
                  <div className="text-xs text-muted-foreground">{city.country}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showSuggestions && suggestions.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
          {t('hotels.cityNotFound')}
        </div>
      )}
    </div>
  )
}
