/**
 * Export Button Component
 * Компонент кнопки экспорта с выпадающим меню
 */

import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import { logError } from '../utils/logger'

export default function ExportButton({
  data,
  columns,
  filename = 'report',
  title = 'Отчёт',
  subtitle = '',
  summary = null,
  disabled = false
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [exporting, setExporting] = useState(null)
  const dropdownRef = useRef(null)

  // Закрытие меню при клике вне его
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (type) => {
    if (!data || data.length === 0) {
      alert(t('export.noData'))
      return
    }

    setExporting(type)

    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const exportFilename = `${filename}_${timestamp}`

      switch (type) {
        case 'excel':
          exportToExcel(data, columns, exportFilename, title)
          break
        case 'pdf':
          exportToPDF(title, data, columns, {
            subtitle,
            summary,
            companyName: 'FreshTrack'
          })
          break
        default:
          break
      }
    } catch (error) {
      logError('Export error:', error)
      alert(t('export.error'))
    } finally {
      setExporting(null)
      setIsOpen(false)
    }
  }

  const exportOptions = [
    {
      id: 'excel',
      label: t('export.excel'),
      description: t('export.excelDescription'),
      icon: FileSpreadsheet,
      color: 'text-green-700'
    },
    {
      id: 'pdf',
      label: t('export.pdf'),
      description: t('export.pdfDescription'),
      icon: FileText,
      color: 'text-red-600'
    }
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || !data || data.length === 0}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${
            disabled || !data || data.length === 0
              ? 'bg-sand/50 text-warmgray/50 cursor-not-allowed'
              : 'bg-charcoal text-white hover:bg-charcoal/90 active:scale-[0.98]'
          }
        `}
      >
        <Download className="w-4 h-4" />
        <span>{t('export.button')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-sand z-50 overflow-hidden animate-fadeIn">
          <div className="p-3 bg-cream/50 border-b border-sand">
            <p className="text-xs font-medium text-warmgray uppercase tracking-wide">
              {t('export.selectFormat')}
            </p>
          </div>

          <div className="p-2">
            {exportOptions.map((option) => {
              const Icon = option.icon
              const isExporting = exporting === option.id

              return (
                <button
                  key={option.id}
                  onClick={() => handleExport(option.id)}
                  disabled={isExporting}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-sand/50 transition-colors text-left group"
                >
                  <div className={`p-2 rounded-lg bg-sand/50 group-hover:bg-sand ${option.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">{option.label}</p>
                    <p className="text-xs text-warmgray truncate">{option.description}</p>
                  </div>
                  {isExporting && (
                    <div className="w-4 h-4 border-2 border-charcoal border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="p-3 bg-cream/30 border-t border-sand">
            <p className="text-xs text-warmgray text-center">
              {data?.length || 0} {t('export.recordsToExport')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
