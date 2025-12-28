/**
 * FilterBottomSheet Component
 * Мобильный фильтр товаров в виде bottom sheet
 * Заменяет dropdown фильтры на мобильных устройствах
 */

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import BottomSheet, { BottomSheetActions, FilterChips } from './ui/BottomSheet'
import { Button } from './ui'
import { cn } from '../utils/classNames'
import { useTranslation } from '../context/LanguageContext'

export default function FilterBottomSheet({
  isOpen,
  onClose,
  filters,
  setFilters,
  categories = [],
  departments = [],
  locations = [],
  onApply,
  onClear,
}) {
  const { t } = useTranslation()
  const [localFilters, setLocalFilters] = useState(filters)

  const handleApply = () => {
    setFilters(localFilters)
    onApply?.(localFilters)
    onClose()
  }

  const handleClear = () => {
    const cleared = {
      status: null,
      category: null,
      department: null,
      location: null,
      dateRange: null,
    }
    setLocalFilters(cleared)
    setFilters(cleared)
    onClear?.()
    onClose()
  }

  // Статусы для фильтрации
  const statusOptions = [
    { value: 'expired', label: t('status.expired') || 'Истёк' },
    { value: 'critical', label: t('status.critical') || 'Критично' },
    { value: 'warning', label: t('status.warning') || 'Скоро' },
    { value: 'fresh', label: t('status.fresh') || 'Свежий' },
  ]

  // Периоды для фильтрации
  const dateRangeOptions = [
    { value: 'today', label: t('common.today') || 'Сегодня' },
    { value: 'week', label: '7 дней' },
    { value: 'month', label: '30 дней' },
  ]

  const hasActiveFilters = Object.values(localFilters).some(v => v !== null && v !== '')

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t('common.filters') || 'Фильтры'}
    >
      <div className="p-4 space-y-6">
        {/* Статус */}
        <FilterSection title={t('common.status') || 'Статус'}>
          <FilterChips
            options={statusOptions}
            value={localFilters.status}
            onChange={(value) => setLocalFilters(prev => ({ ...prev, status: value }))}
          />
        </FilterSection>

        {/* Категория */}
        {categories.length > 0 && (
          <FilterSection title={t('common.category') || 'Категория'}>
            <select
              value={localFilters.category || ''}
              onChange={(e) => setLocalFilters(prev => ({ 
                ...prev, 
                category: e.target.value || null 
              }))}
              className={cn(
                'w-full h-12 px-4 rounded-xl border border-border',
                'bg-card text-foreground',
                'focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none',
                'text-base' // Предотвращает zoom на iOS
              )}
            >
              <option value="">{t('common.all') || 'Все'}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </FilterSection>
        )}

        {/* Отдел */}
        {departments.length > 0 && (
          <FilterSection title={t('common.department') || 'Отдел'}>
            <select
              value={localFilters.department || ''}
              onChange={(e) => setLocalFilters(prev => ({ 
                ...prev, 
                department: e.target.value || null 
              }))}
              className={cn(
                'w-full h-12 px-4 rounded-xl border border-border',
                'bg-card text-foreground',
                'focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none',
                'text-base'
              )}
            >
              <option value="">{t('common.allDepartments') || 'Все отделы'}</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </FilterSection>
        )}

        {/* Период истечения */}
        <FilterSection title={t('filters.expirationPeriod') || 'Период истечения'}>
          <FilterChips
            options={dateRangeOptions}
            value={localFilters.dateRange}
            onChange={(value) => setLocalFilters(prev => ({ ...prev, dateRange: value }))}
          />
        </FilterSection>
      </div>

      {/* Sticky actions */}
      <BottomSheetActions>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleClear}
            disabled={!hasActiveFilters}
            fullWidth
          >
            {t('common.reset') || 'Сбросить'}
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            fullWidth
          >
            {t('common.apply') || 'Применить'}
          </Button>
        </div>
      </BottomSheetActions>
    </BottomSheet>
  )
}

/**
 * FilterSection - секция фильтра с заголовком
 */
function FilterSection({ title, children }) {
  return (
    <div>
      <h4 className="font-medium text-foreground mb-3">{title}</h4>
      {children}
    </div>
  )
}

/**
 * FilterButton - кнопка открытия фильтров (для header)
 */
export function FilterButton({ 
  onClick, 
  activeCount = 0,
  className = '' 
}) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center',
        'h-12 w-12 rounded-xl',
        'bg-card border border-border',
        'text-foreground',
        'touch-manipulation active:scale-95',
        'transition-all duration-200',
        activeCount > 0 && 'border-accent bg-accent/5',
        className
      )}
      aria-label={t('common.filters') || 'Фильтры'}
    >
      <Filter className="w-5 h-5" />
      
      {activeCount > 0 && (
        <span className={cn(
          'absolute -top-1 -right-1',
          'min-w-[18px] h-[18px]',
          'flex items-center justify-center',
          'bg-accent text-white text-xs font-bold',
          'rounded-full px-1'
        )}>
          {activeCount}
        </span>
      )}
    </button>
  )
}
