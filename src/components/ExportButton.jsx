/**
 * Export Button Component
 * Компонент кнопки экспорта с выпадающим меню
 */

import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { InlineLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import { logError } from '../utils/logger'

export default function ExportButton({
  data,
  columns,
  filename = 'report',
  title = 'Отчёт',
  subtitle = '',
  summary = null,
  disabled = false,
  /** Кастомные обработчики (backend-экспорт). Если заданы — в меню вызываются они вместо клиентского экспорта. */
  onExportPdf,
  onExportExcel,
  /** Состояние загрузки при использовании onExportPdf/onExportExcel */
  exportingPdf = false,
  exportingExcel = false,
  /** Количество записей для экспорта (например pagination.total), когда экспорт идёт с бэкенда */
  exportRecordCount
}) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [exporting, setExporting] = useState(null)
  const dropdownRef = useRef(null)
  const useCustomExport = Boolean(onExportPdf || onExportExcel)

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
    if (type === 'pdf' && onExportPdf) {
      try {
        await onExportPdf()
        setIsOpen(false)
      } catch {
        // ошибка уже обработана в родителе
      }
      return
    }
    if (type === 'excel' && onExportExcel) {
      try {
        await onExportExcel()
        setIsOpen(false)
      } catch {
        // ошибка уже обработана в родителе
      }
      return
    }

    if (!data || data.length === 0) {
      addToast(t('export.noData'), 'warning')
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
      addToast(t('export.error'), 'error')
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
        disabled={
          disabled ||
          (!useCustomExport && (!data || data.length === 0)) ||
          (useCustomExport && exportingPdf && exportingExcel)
        }
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${
            disabled ||
            (!useCustomExport && (!data || data.length === 0)) ||
            (useCustomExport && exportingPdf && exportingExcel)
              ? 'bg-muted text-muted-foreground/50 cursor-not-allowed'
              : 'bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]'
          }
        `}
      >
        <Download className="w-4 h-4" />
        <span>{t('export.button')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl shadow-lg border border-border z-50 overflow-hidden animate-fadeIn">
          <div className="p-3 bg-muted border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('export.selectFormat')}
            </p>
          </div>

          <div className="p-2">
            {exportOptions.map((option) => {
              const Icon = option.icon
              const isExporting =
                useCustomExport && option.id === 'pdf'
                  ? exportingPdf
                  : useCustomExport && option.id === 'excel'
                    ? exportingExcel
                    : exporting === option.id

              return (
                <button
                  key={option.id}
                  onClick={() => handleExport(option.id)}
                  disabled={isExporting}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors text-left group"
                >
                  <div
                    className={`p-2 rounded-lg bg-muted group-hover:bg-muted/80 ${option.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                  </div>
                  {isExporting && <InlineLoader />}
                </button>
              )
            })}
          </div>

          <div className="p-3 bg-muted border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {exportRecordCount ?? data?.length ?? 0} {t('export.recordsToExport')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
