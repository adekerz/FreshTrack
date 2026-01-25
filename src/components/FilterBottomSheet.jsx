/**
 * FilterBottomSheet Component
 * Мобильный фильтр товаров в виде bottom sheet
 * Заменяет dropdown фильтры на мобильных устройствах
 */

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import BottomSheet, { BottomSheetActions, FilterChips } from './ui/BottomSheet'
import { TouchButton, TouchSelect } from './ui'
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
            <TouchSelect
              label={null}
              placeholder={t('common.all') || 'Все'}
              value={localFilters.category || ''}
              onChange={(v) =>
                setLocalFilters((prev) => ({ ...prev, category: v || null }))
              }
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
            />
          </FilterSection>
        )}

        {/* Отдел */}
        {departments.length > 0 && (
          <FilterSection title={t('common.department') || 'Отдел'}>
            <TouchSelect
              label={null}
              placeholder={t('common.allDepartments') || 'Все отделы'}
              value={localFilters.department || ''}
              onChange={(v) =>
                setLocalFilters((prev) => ({ ...prev, department: v || null }))
              }
              options={departments.map((dept) => ({ value: dept.id, label: dept.name }))}
            />
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
          <TouchButton
            variant="secondary"
            onClick={handleClear}
            disabled={!hasActiveFilters}
            fullWidth
          >
            {t('common.reset') || 'Сбросить'}
          </TouchButton>
          <TouchButton variant="primary" onClick={handleApply} fullWidth>
            {t('common.apply') || 'Применить'}
          </TouchButton>
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
export function FilterButton({ onClick, activeCount = 0, className = '' }) {
  const { t } = useTranslation()

  return (
    <div className={cn('relative', className)}>
      <TouchButton
        variant="ghost"
        size="icon"
        onClick={onClick}
        className={cn(
          'h-12 w-12 rounded-xl bg-card border border-border text-foreground',
          activeCount > 0 && 'border-accent bg-accent/5'
        )}
        aria-label={t('common.filters') || 'Фильтры'}
        icon={Filter}
      />
      {activeCount > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-[18px] h-[18px]',
            'flex items-center justify-center bg-accent-button text-white text-xs font-bold rounded-full px-1'
          )}
        >
          {activeCount}
        </span>
      )}
    </div>
  )
}
