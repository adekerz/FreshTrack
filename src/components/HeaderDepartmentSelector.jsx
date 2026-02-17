/**
 * HeaderDepartmentSelector — компактный dropdown-селектор отдела в хедере
 *
 * Паттерн аналогичен HotelSelector.
 * Читает и пишет selectedDepartmentId через useDepartment().
 * Все страницы автоматически реагируют на смену отдела.
 *
 * Показывается только если > 1 отдела (showDepartmentSelector).
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { InlineLoader } from './ui'
import { useDepartment } from '../context/DepartmentContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function HeaderDepartmentSelector({ className = '' }) {
    const {
        departments,
        selectedDepartmentId,
        selectedDepartment,
        selectDepartment,
        showDepartmentSelector,
        getDepartmentIcon,
        loading
    } = useDepartment()
    const { t } = useTranslation()
    const { language } = useLanguage()

    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    // Закрытие при клике вне
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Получить название отдела в зависимости от языка
    const getDeptName = (dept) => {
        if (!dept) return ''
        if (language === 'ru') return dept.name || dept.name_en
        if (language === 'kk') return dept.name_kk || dept.name || dept.name_en
        return dept.name_en || dept.name
    }

    // Не показываем если нечего выбирать
    if (!showDepartmentSelector) return null

    const compactCls = 'min-w-0 max-w-[120px] sm:max-w-none flex-1 sm:flex-initial'

    // Загрузка
    if (loading) {
        return (
            <div className={cn('flex items-center gap-2 px-2 sm:px-3 py-2 bg-muted/50 rounded-lg', compactCls, className)}>
                <InlineLoader />
                <span className="text-sm text-muted-foreground truncate">
                    {t('departments.loading') || 'Загрузка...'}
                </span>
            </div>
        )
    }

    // Текущий отдел — иконка
    const CurrentIcon = selectedDepartment ? getDepartmentIcon(selectedDepartment) : null
    const deptColor = selectedDepartment?.color || '#6366f1'

    return (
        <div ref={dropdownRef} className={cn('relative min-w-0 flex-1 max-w-[140px] sm:max-w-none sm:flex-initial', className)}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-label={
                    selectedDepartment
                        ? getDeptName(selectedDepartment)
                        : t('departments.select') || 'Выберите отдел'
                }
                className="flex items-center gap-2 px-2 sm:px-3 py-2 min-h-[44px] bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors min-w-0 w-full sm:min-w-[160px] touch-manipulation"
            >
                {/* Иконка отдела */}
                {CurrentIcon && (
                    <CurrentIcon
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: deptColor }}
                    />
                )}
                <span className="text-sm font-medium text-foreground flex-1 min-w-0 text-left truncate">
                    {selectedDepartment ? getDeptName(selectedDepartment) : (t('departments.select') || 'Выберите отдел')}
                </span>
                <ChevronDown
                    className={cn(
                        'w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto min-w-[200px]">
                    {departments.map((dept) => {
                        const Icon = getDepartmentIcon(dept)
                        const isSelected = selectedDepartmentId === dept.id
                        const color = dept.color || '#6366f1'

                        return (
                            <button
                                type="button"
                                key={dept.id}
                                onClick={() => {
                                    selectDepartment(dept.id)
                                    setIsOpen(false)
                                }}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] text-left hover:bg-muted transition-colors touch-manipulation',
                                    isSelected && 'bg-accent/10'
                                )}
                            >
                                <Icon
                                    className="w-4 h-4 flex-shrink-0"
                                    style={{ color }}
                                />
                                <span
                                    className={cn(
                                        'text-sm font-medium truncate flex-1 min-w-0',
                                        isSelected ? 'text-accent' : 'text-foreground'
                                    )}
                                >
                                    {getDeptName(dept)}
                                </span>
                                {isSelected && (
                                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
