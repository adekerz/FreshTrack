/**
 * ImportExportSettings - Импорт и экспорт данных
 * Массовый импорт товаров, экспорт отчётов
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { useToast } from '../../../context/ToastContext'
import { useExport } from '../../../hooks/useExport'
import { EXPORT_TYPES } from '../../../config/exportConfig'
import { Loader } from '..'
import { API_BASE_URL } from '../../../services/api'
import {
  Upload,
  Download,
  FileSpreadsheet,
  Package,
  History,
  FileText,
  Check,
  AlertCircle,
  RefreshCw,
  FolderTree,
  Tags
} from 'lucide-react'
import SettingsLayout, { SettingsSection } from './SettingsLayout'

export default function ImportExportSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { exportData, exporting: exportingType } = useExport()
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

  // Детектор размера экрана для compact режима
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE_URL}/import/batches`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      const result = await response.json()
      setImportResult({
        success: response.ok,
        message: result.message || (response.ok ? 'Импорт завершён' : 'Ошибка импорта'),
        imported: result.imported,
        errors: result.errors
      })
      if (response.ok) {
        addToast(t('toast.importSuccess'), 'success')
      } else {
        addToast(t('toast.importError'), 'error')
      }
    } catch (error) {
      // Import error logged
      setImportResult({
        success: false,
        message: t('import.error') || 'Ошибка импорта',
        errors: [error.message]
      })
      addToast(t('toast.importError'), 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleExport = async (type, format = 'excel') => {
    await exportData(type, format)
  }

  // Icon mapping for export types
  const exportIcons = {
    inventory: Package,
    batches: FileSpreadsheet,
    collections: History,
    audit: FileText,
    products: Package,
    categories: Tags,
    departments: FolderTree
  }

  // Get export options from centralized config (все 7 отчётов)
  const exportOptions = Object.values(EXPORT_TYPES).map(type => ({
      type: type.id,
      icon: exportIcons[type.id] || FileText,
      label: t(type.labelKey) || type.title,
      desc: type.subtitle
    }))

  return (
    <SettingsLayout
      title={t('settings.importExport.title') || 'Импорт/Экспорт'}
      description={t('import.description') || 'Массовые операции с данными'}
      icon={RefreshCw}
    >
      {/* Импорт - компактный для мобильных */}
      <SettingsSection title={t('import.title') || 'Импорт данных'} icon={Upload}>

        <div className="space-y-3 sm:space-y-4">
          <div className={`
            border-2 border-dashed border-border rounded-xl
            text-center hover:border-accent/50 transition-colors
            ${isMobile ? 'p-6' : 'p-8'}
          `}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <label htmlFor="import-file" className="cursor-pointer">
              <div className={`
                mx-auto mb-3 sm:mb-4 bg-muted rounded-full
                flex items-center justify-center
                ${isMobile ? 'w-14 h-14' : 'w-16 h-16'}
              `}>
                {importing ? (
                  <Loader size="medium" />
                ) : (
                  <FileSpreadsheet className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} text-accent`} />
                )}
              </div>
              <p className={`text-foreground font-medium mb-1 ${isMobile ? 'text-sm' : 'text-base'}`}>
                {importing
                  ? t('import.processing') || 'Обработка...'
                  : t('import.selectFile') || 'Выберите файл для импорта'}
              </p>
              <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                {t('import.formats') || 'Поддерживаемые форматы'}: Excel (.xlsx, .xls), CSV
              </p>
            </label>
          </div>

          <a
            href="/templates/import-template.xlsx"
            download
            className={`inline-flex items-center gap-2 text-accent hover:underline ${isMobile ? 'text-xs' : 'text-sm'}`}
          >
            <Download className="w-4 h-4" />
            {t('import.downloadTemplate') || 'Скачать шаблон для импорта'}
          </a>
        </div>

        {importResult && (
          <div
            className={`
              mt-4 sm:mt-6 rounded-lg
              ${isMobile ? 'p-3' : 'p-4'}
              ${importResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
              }
            `}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              {importResult.success ? (
                <Check className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-green-600 shrink-0 mt-0.5`} />
              ) : (
                <AlertCircle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-600 shrink-0 mt-0.5`} />
              )}
              <div className="flex-1 min-w-0">
                <p className={`${isMobile ? 'text-sm' : 'text-base'} ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {importResult.message}
                </p>
                {importResult.imported !== undefined && (
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-700 mt-1`}>
                    {t('import.imported') || 'Импортировано'}: {importResult.imported}
                  </p>
                )}
                {importResult.errors?.length > 0 && (
                  <ul className={`${isMobile ? 'text-xs' : 'text-sm'} text-red-600 mt-2 space-y-1`}>
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="break-words">• {err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...и ещё {importResult.errors.length - 5} ошибок</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* Экспорт - компактный для мобильных */}
      <SettingsSection title={t('export.title') || 'Экспорт данных'} icon={Download}>
        <div className="space-y-3 sm:space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t('export.description') || 'Экспортируйте данные в Excel для анализа и отчётности'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {exportOptions.map(({ type, icon: Icon, label, desc }) => (
              <button
                key={type}
                onClick={() => handleExport(type, 'excel')}
                disabled={exportingType === type}
                className={`
                  flex items-start gap-3 sm:gap-4
                  border border-border rounded-xl
                  hover:border-accent hover:bg-accent/5
                  active:bg-accent/10
                  transition-colors text-left
                  disabled:opacity-50 disabled:cursor-not-allowed
                  group
                  ${isMobile ? 'p-3' : 'p-4'}
                `}
              >
                <div className={`
                  bg-muted rounded-lg flex items-center justify-center shrink-0
                  group-hover:bg-accent/10 transition-colors
                  ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}
                `}>
                  {exportingType === type ? (
                    <Loader size="medium" />
                  ) : (
                    <Icon className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-foreground group-hover:text-accent transition-colors`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`
                    font-medium text-foreground group-hover:text-accent transition-colors
                    ${isMobile ? 'text-sm' : 'text-base'}
                  `}>
                    {label}
                  </p>
                  <p className={`
                    text-muted-foreground mt-0.5
                    ${isMobile ? 'text-xs line-clamp-1' : 'text-sm'}
                  `}>
                    {desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>
    </SettingsLayout>
  )
}
