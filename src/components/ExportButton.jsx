/**
 * ExportButton Component
 * Universal export button with dropdown menu for format selection
 * Supports Excel, CSV, and PDF exports with backend integration
 */

import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, FileType, Loader2, ChevronDown } from 'lucide-react'
import { useExport } from '../hooks/useExport'
import { useTranslation } from '../context/LanguageContext'

/**
 * Format configurations with icons and descriptions
 */
const FORMAT_CONFIG = {
  excel: {
    id: 'excel',
    label: 'Excel',
    icon: FileSpreadsheet,
    description: 'Таблица с форматированием',
    color: 'text-green-700'
  },
  csv: {
    id: 'csv',
    label: 'CSV',
    icon: FileText,
    description: 'Простой текстовый формат',
    color: 'text-blue-600'
  },
  pdf: {
    id: 'pdf',
    label: 'PDF',
    icon: FileType,
    description: 'Документ для печати',
    color: 'text-red-600'
  }
}

/**
 * ExportButton Component
 * @param {Object} props
 * @param {string} props.exportType - Type of export (inventory, collections, audit, etc.)
 * @param {Object} props.filters - Active filters to pass to export
 * @param {Array} props.formats - Available formats (default: ['excel', 'csv', 'pdf'])
 * @param {string} props.variant - Button variant ('primary' | 'secondary')
 * @param {string} props.size - Button size ('sm' | 'md' | 'lg')
 * @param {boolean} props.showFilterCount - Show active filter count badge
 * @param {boolean} props.disabled - Disable button
 * @param {Function} props.onExportComplete - Callback after successful export
 */
export default function ExportButton({
  exportType,
  filters = {},
  formats = ['excel', 'csv', 'pdf'],
  variant = 'primary',
  size = 'md',
  showFilterCount = true,
  disabled = false,
  onExportComplete
}) {
  const { t } = useTranslation()
  const { exportData, exporting, isExporting } = useExport()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Calculate active filter count
  const activeFilterCount = showFilterCount
    ? Object.keys(filters).filter(key => {
        const value = filters[key]
        return value !== null && value !== undefined && value !== ''
      }).length
    : 0

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Handle export action
  const handleExport = async (format) => {
    setIsDropdownOpen(false)

    try {
      await exportData(exportType, format, { filters })
      onExportComplete?.()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Toggle dropdown
  const handleToggleDropdown = () => {
    if (!disabled && !isExporting) {
      setIsDropdownOpen(!isDropdownOpen)
    }
  }

  // Button size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  // Button variant classes
  const variantClasses = {
    primary: 'bg-foreground text-background hover:bg-foreground/90',
    secondary: 'bg-muted text-foreground hover:bg-muted/80'
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Main Export Button */}
      <button
        onClick={handleToggleDropdown}
        disabled={disabled || isExporting}
        className={`
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          rounded-lg font-medium
          flex items-center gap-2
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          active:scale-[0.98]
          relative
        `}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('export.exporting') || 'Экспорт...'}</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>{t('export.button') || 'Экспорт'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            {/* Filter count badge */}
            {activeFilterCount > 0 && showFilterCount && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Dropdown Menu with Backdrop */}
      {isDropdownOpen && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden animate-fadeIn">
            <div className="p-3 bg-muted border-b border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('export.selectFormat') || 'Выберите формат'}
              </p>
            </div>

            <div className="p-2">
              {formats.map((formatId) => {
                const format = FORMAT_CONFIG[formatId]
                if (!format) return null

                const Icon = format.icon

                return (
                  <button
                    key={formatId}
                    onClick={() => handleExport(formatId)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors text-left group"
                  >
                    <div
                      className={`p-2 rounded-lg bg-muted group-hover:bg-muted/80 ${format.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {format.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {format.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Active filters info */}
            {activeFilterCount > 0 && showFilterCount && (
              <div className="p-3 bg-muted border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  {t('export.activeFilters') || 'Активных фильтров'}: {activeFilterCount}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
