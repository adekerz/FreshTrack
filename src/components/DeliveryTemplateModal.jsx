import { useState, useEffect } from 'react'
import { X, Package, Plus, Minus, Calendar, Check } from 'lucide-react'
import { SectionLoader, ButtonLoader } from './ui'
import { useTranslation } from '../context/LanguageContext'
import { useProducts } from '../context/ProductContext'
import { apiFetch } from '../services/api'

export default function DeliveryTemplateModal({ isOpen, onClose, onApply, departmentId }) {
  const { t } = useTranslation()
  const { departments } = useProducts()
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  // Используем переданный departmentId или первый доступный отдел
  const targetDepartment = departmentId || (departments.length > 0 ? departments[0].id : null)

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/delivery-templates')
      setTemplates(data.templates || [])
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setLoading(false)
    }
  }

  const selectTemplate = (template) => {
    setSelectedTemplate(template)
    // Подготавливаем items с датами
    const today = new Date()
    const preparedItems = template.items.map((item) => {
      const expiryDate = new Date(today)
      expiryDate.setDate(expiryDate.getDate() + (item.defaultShelfLife || 30))

      return {
        ...item,
        quantity: item.defaultQuantity || 1,
        expiryDate: expiryDate.toISOString().split('T')[0],
        shelfLife: item.defaultShelfLife || 30
      }
    })
    setItems(preparedItems)
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleApply = async () => {
    if (!targetDepartment || items.length === 0) return

    setApplying(true)
    try {
      const result = await apiFetch(`/delivery-templates/${selectedTemplate.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({
            ...item,
            quantity: parseInt(item.quantity)
          })),
          departmentId: targetDepartment
        })
      })

      if (result.success) {
        onApply?.(result.batches)
        onClose()
      }
    } catch (error) {
      // Error logged by apiFetch
    } finally {
      setApplying(false)
    }
  }

  const getDepartmentName = (id) => {
    const dept = departments.find((d) => d.id === id)
    return dept ? dept.name : id
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
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {t('templates.title') || 'Шаблоны поставок'}
                </h2>
                {selectedTemplate && (
                  <p className="text-sm text-gray-500">{selectedTemplate.name}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {loading ? (
              <SectionLoader />
            ) : !selectedTemplate ? (
              /* Template Selection */
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  {t('templates.selectTemplate') || 'Выберите шаблон для применения:'}
                </p>

                {templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {t('templates.noTemplates') || 'Нет доступных шаблонов'}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => selectTemplate(template)}
                        className="flex items-center justify-between p-4 border border-border rounded-xl hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors text-left"
                      >
                        <div>
                          <h3 className="font-medium text-foreground">{template.name}</h3>
                          <p className="text-sm text-gray-500">
                            {template.items.length} {t('templates.items') || 'позиций'}
                            {template.departmentId &&
                              ` • ${getDepartmentName(template.departmentId)}`}
                          </p>
                        </div>
                        <Package className="w-5 h-5 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Items Configuration */
              <div className="space-y-6">
                {/* Department info */}
                <div className="p-3 bg-accent/10 rounded-lg">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">
                      {t('templates.targetDepartment') || 'Целевой отдел'}:
                    </span>{' '}
                    {departments.find((d) => d.id === targetDepartment)?.name || targetDepartment}
                  </p>
                </div>

                {/* Items list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-foreground">
                      {t('templates.products') || 'Товары'}
                    </h3>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      {t('templates.changeTemplate') || 'Сменить шаблон'}
                    </button>
                  </div>

                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap md:flex-nowrap items-center gap-3 p-4 bg-muted/50 rounded-xl"
                    >
                      <div className="flex-1 min-w-[150px]">
                        <p className="font-medium text-foreground text-sm">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.category}</p>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(index, 'quantity', Math.max(1, item.quantity - 1))
                          }
                          className="p-1 rounded bg-muted hover:bg-muted/80"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                          className="w-16 text-center px-2 py-1 border border-border rounded bg-card text-foreground text-sm"
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(index, 'quantity', item.quantity + 1)}
                          className="p-1 rounded bg-muted hover:bg-muted/80"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Expiry Date */}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => updateItem(index, 'expiryDate', e.target.value)}
                          className="px-2 py-1 border border-border rounded bg-card text-foreground text-sm"
                        />
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedTemplate && (
            <div className="flex items-center justify-between gap-4 p-6 border-t border-border bg-muted">
              <div className="text-sm text-muted-foreground">
                {items.length} {t('templates.itemsToAdd') || 'позиций будет добавлено'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying || items.length === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-busy={applying}
                >
                  {applying ? <ButtonLoader /> : <Check className="w-4 h-4" />}
                  {t('templates.apply') || `Добавить ${items.length} позиций`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
