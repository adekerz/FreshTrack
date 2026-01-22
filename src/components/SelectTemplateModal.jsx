/**
 * SelectTemplateModal - Stateless template selector
 * 
 * RESPONSIBILITY:
 * - ONLY select a delivery template
 * - NO batch creation
 * - NO fast mode logic
 * - NO form state
 * - NO side effects except onSelect
 * 
 * BEHAVIOR:
 * - User selects a template
 * - Call onSelect(templateId)
 * - Close immediately
 * - This component should NOT stay mounted after selection
 */

import { useState, useEffect } from 'react'
import { X, Package, Zap } from 'lucide-react'
import { SectionLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useProducts } from '../context/ProductContext'
import { apiFetch } from '../services/api'

export default function SelectTemplateModal({ 
  isOpen, 
  onSelect,  // (templateId) => void
  onClose    // () => void
}) {
  const { t } = useTranslation()
  const { departments } = useProducts()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/delivery-templates')
      const templates = (data.templates || []).map(template => ({
        ...template,
        items: typeof template.items === 'string' 
          ? JSON.parse(template.items) 
          : template.items || []
      }))
      setTemplates(templates)
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setLoading(false)
    }
  }

  const getDepartmentName = (id) => {
    const dept = departments.find((d) => d.id === id)
    return dept ? dept.name : id
  }

  const handleTemplateSelect = (template) => {
    // Call onSelect - parent will handle closing and opening FastIntakeModal
    onSelect(template.id)
    // DON'T call onClose() here - parent handles modal state transitions
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t('templates.title') || 'Шаблоны поставок'}
                </h2>
                <p className="text-sm text-gray-500">
                  {t('templates.selectTemplate') || 'Выберите шаблон для применения'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <SectionLoader />
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {t('templates.noTemplates') || 'Нет доступных шаблонов'}
              </div>
            ) : (
              <div className="grid gap-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-2 p-3 border border-border rounded-xl hover:border-primary-500 transition-colors"
                  >
                    {/* Template info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{template.name}</h3>
                      <p className="text-xs text-gray-500">
                        {template.items.length} позиций
                        {template.departmentId && ` • ${getDepartmentName(template.departmentId)}`}
                      </p>
                    </div>
                    
                    {/* Fast mode button - main action */}
                    <button
                      onClick={() => handleTemplateSelect(template)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium touch-manipulation"
                    >
                      <Zap className="w-4 h-4" />
                      <span className="hidden sm:inline">Быстрый</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}