/**
 * ImportExportSettings - Импорт и экспорт данных
 * Массовый импорт товаров, экспорт отчётов
 */

import { useState, useRef } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { Loader } from '../ui'
import { API_BASE_URL } from '../../services/api'
import {
  Upload,
  Download,
  FileSpreadsheet,
  Package,
  History,
  FileText,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import SettingsLayout, { SettingsSection } from './SettingsLayout'

export default function ImportExportSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [exporting, setExporting] = useState(null)
  const fileInputRef = useRef(null)

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
        headers: {
          Authorization: `Bearer ${localStorage.getItem('freshtrack_token')}`
        },
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

  const handleExport = async (type) => {
    setExporting(type)

    try {
      const response = await fetch(`${API_BASE_URL}/export/${type}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('freshtrack_token')}`
        }
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `freshtrack-${type}-${new Date().toISOString().split('T')[0]}.xls`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      addToast(t('toast.exportSuccess'), 'success')
    } catch {
      // Export error
      addToast(t('toast.exportError'), 'error')
    } finally {
      setExporting(null)
    }
  }

  const exportOptions = [
    {
      type: 'inventory',
      icon: Package,
      label: t('export.inventory') || 'Инвентарь',
      desc: 'Текущие товары и статусы'
    },
    {
      type: 'batches',
      icon: FileSpreadsheet,
      label: t('export.batches') || 'Все партии',
      desc: 'Полная история партий'
    },
    {
      type: 'collections',
      icon: History,
      label: t('export.collections') || 'История сборов',
      desc: 'Журнал сборов товаров'
    },
    {
      type: 'audit',
      icon: FileText,
      label: t('export.auditLog') || 'Журнал действий',
      desc: 'Лог всех действий'
    }
  ]

  return (
    <SettingsLayout
      title={t('settings.importExport.title') || 'Импорт/Экспорт'}
      description={t('import.description') || 'Массовые операции с данными'}
      icon={RefreshCw}
    >
      {/* Импорт */}
      <SettingsSection title={t('import.title') || 'Импорт данных'} icon={Upload}>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <label htmlFor="import-file" className="cursor-pointer">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                {importing ? (
                  <Loader size="medium" />
                ) : (
                  <FileSpreadsheet className="w-8 h-8 text-accent" />
                )}
              </div>
              <p className="text-foreground font-medium mb-1">
                {importing
                  ? t('import.processing') || 'Обработка...'
                  : t('import.selectFile') || 'Выберите файл для импорта'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('import.formats') || 'Поддерживаемые форматы'}: Excel (.xlsx, .xls), CSV
              </p>
            </label>
          </div>

          <a
            href="/templates/import-template.xlsx"
            download
            className="inline-flex items-center gap-2 text-accent hover:underline text-sm"
          >
            <Download className="w-4 h-4" />
            {t('import.downloadTemplate') || 'Скачать шаблон для импорта'}
          </a>
        </div>

        {importResult && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              importResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {importResult.success ? (
                <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={importResult.success ? 'text-green-800' : 'text-red-800'}>
                  {importResult.message}
                </p>
                {importResult.imported !== undefined && (
                  <p className="text-sm text-green-700 mt-1">
                    {t('import.imported') || 'Импортировано'}: {importResult.imported}
                  </p>
                )}
                {importResult.errors?.length > 0 && (
                  <ul className="text-sm text-red-600 mt-2 space-y-1">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
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

      {/* Экспорт */}
      <SettingsSection title={t('export.title') || 'Экспорт данных'} icon={Download}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {exportOptions.map(({ type, icon: Icon, label, desc }) => (
              <button
                key={type}
                onClick={() => handleExport(type)}
                disabled={exporting === type}
                className="flex items-start gap-4 p-4 border border-border rounded-xl hover:border-accent hover:bg-accent/5 transition-colors text-left disabled:opacity-50 group"
              >
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0 group-hover:bg-accent/10 transition-colors">
                {exporting === type ? (
                  <Loader size="medium" />
                ) : (
                  <Icon className="w-6 h-6 text-foreground group-hover:text-accent transition-colors" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground group-hover:text-accent transition-colors">
                  {label}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>
        </div>
      </SettingsSection>
    </SettingsLayout>
  )
}
