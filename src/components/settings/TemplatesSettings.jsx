/**
 * TemplatesSettings - Управление шаблонами поставок
 * Создание, редактирование, удаление шаблонов
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useProducts } from '../../context/ProductContext'
import { useToast } from '../../context/ToastContext'
import { useHotel } from '../../context/HotelContext'
import { apiFetch } from '../../services/api'
import {
  Plus,
  X,
  FileBox,
  Edit2,
  Trash2,
  Package,
  Check,
  AlertTriangle
} from 'lucide-react'
import { ButtonLoader } from '../ui'
import SettingsLayout from './SettingsLayout'

export default function TemplatesSettings({ readOnly = false }) {
  const { t } = useTranslation()
  const { departments } = useProducts()
  const { addToast } = useToast()
  const { selectedHotelId } = useHotel()

  const [templates, setTemplates] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    items: []
  })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0].id)
    }
  }, [departments, selectedDepartment])

  useEffect(() => {
    if (selectedHotelId) fetchData()
  }, [selectedHotelId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const hotelQuery = selectedHotelId ? `?hotel_id=${selectedHotelId}` : ''
      const [templatesData, productsData] = await Promise.all([
        apiFetch(`/delivery-templates${hotelQuery}`),
        apiFetch(`/products/catalog${hotelQuery}`)
      ])
      const parsed = (templatesData.templates || templatesData || []).map((template) => ({
        ...template,
        items:
          typeof template.items === 'string'
            ? JSON.parse(template.items)
            : template.items || []
      }))
      setTemplates(parsed)
      setProducts(productsData.products || productsData || [])
    } catch {
      setTemplates([])
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const createTemplate = async () => {
    if (!newTemplate.name.trim() || newTemplate.items.length === 0) return
    setSaving(true)
    try {
      await apiFetch('/delivery-templates', {
        method: 'POST',
        body: JSON.stringify({
          ...newTemplate,
          department_id: selectedDepartment
        })
      })
      await fetchData()
      closeModal()
      addToast(t('toast.templateCreated'), 'success')
    } catch {
      addToast(t('toast.templateCreateError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateTemplate = async () => {
    if (!editingTemplate || !newTemplate.name.trim()) return
    setSaving(true)
    try {
      await apiFetch(`/delivery-templates/${editingTemplate.id}`, {
        method: 'PUT',
        body: JSON.stringify(newTemplate)
      })
      await fetchData()
      closeModal()
      addToast(t('toast.templateUpdated'), 'success')
    } catch {
      addToast(t('toast.templateUpdateError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = (id, name) => setDeleteConfirm({ id, name })

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await apiFetch(`/delivery-templates/${deleteConfirm.id}`, { method: 'DELETE' })
      await fetchData()
      addToast(t('toast.templateDeleted'), 'success')
      setDeleteConfirm(null)
    } catch {
      addToast(t('toast.templateDeleteError'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const openEditModal = (template) => {
    setEditingTemplate(template)
    setNewTemplate({
      name: template.name,
      description: template.description || '',
      items: template.items || []
    })
    setShowCreateModal(true)
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setEditingTemplate(null)
    setNewTemplate({ name: '', description: '', items: [] })
  }

  const addProductToTemplate = (product) => {
    if (newTemplate.items.some((item) => item.product_id === product.id)) return
    setNewTemplate({
      ...newTemplate,
      items: [
        ...newTemplate.items,
        {
          product_id: product.id,
          product_name: product.name,
          default_quantity: 1
        }
      ]
    })
  }

  const removeProductFromTemplate = (productId) => {
    setNewTemplate({
      ...newTemplate,
      items: newTemplate.items.filter((item) => item.product_id !== productId)
    })
  }

  const updateTemplateItem = (productId, field, value) => {
    setNewTemplate({
      ...newTemplate,
      items: newTemplate.items.map((item) =>
        item.product_id === productId
          ? { ...item, [field]: parseInt(value, 10) || 0 }
          : item
      )
    })
  }

  const headerActions = !readOnly ? (
    <button
      type="button"
      onClick={() => setShowCreateModal(true)}
      className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
    >
      <Plus className="w-4 h-4" aria-hidden="true" />
      {t('templates.create') || 'Создать'}
    </button>
  ) : null

  return (
    <>
      <SettingsLayout
        title={t('settings.templates.title') || 'Шаблоны поставок'}
        description={t('templates.description') || 'Быстрое добавление товаров по шаблону'}
        icon={FileBox}
        loading={loading}
        hideSaveButton
        headerActions={headerActions}
      >
        {templates.length === 0 ? (
          <div className="text-center py-12">
            <FileBox className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" aria-hidden="true" />
            <p className="text-muted-foreground">
              {t('templates.noTemplates') || 'Нет созданных шаблонов'}
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
              >
                {t('templates.createFirst') || 'Создать первый шаблон'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-5 border border-border rounded-xl bg-card hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{template.name}</h3>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Package className="w-4 h-4" aria-hidden="true" />
                        {template.items?.length || 0} {t('templates.products') || 'товаров'}
                      </span>
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(template)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                        aria-label={t('common.edit') || 'Редактировать'}
                      >
                        <Edit2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(template.id, template.name)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-danger/10 text-muted-foreground hover:text-red-600 dark:hover:text-danger transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
                        aria-label={t('common.delete') || 'Удалить'}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
                {template.items?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.items.slice(0, 5).map((item, idx) => (
                      <span
                        key={item.product_id ?? idx}
                        className="px-3 py-1 bg-muted/70 rounded-full text-sm text-foreground"
                      >
                        {item.product_name || item.name} × {item.default_quantity}
                      </span>
                    ))}
                    {template.items.length > 5 && (
                      <span className="px-3 py-1 bg-muted/70 rounded-full text-sm text-muted-foreground">
                        +{template.items.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsLayout>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
          <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 id="template-modal-title" className="text-lg font-semibold text-foreground">
                {editingTemplate
                  ? t('templates.editTemplate') || 'Редактировать шаблон'
                  : t('templates.create') || 'Создать шаблон'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={t('common.close') || 'Закрыть'}
              >
                <X className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label htmlFor="template-name" className="block text-sm font-medium text-foreground mb-2">
                  {t('templates.name') || 'Название шаблона'} *
                </label>
                <input
                  id="template-name"
                  type="text"
                  placeholder={t('templates.namePlaceholder') || 'Например: Ежедневная поставка'}
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                />
              </div>
              <div>
                <label htmlFor="template-desc" className="block text-sm font-medium text-foreground mb-2">
                  {t('templates.descriptionLabel') || 'Описание'}
                </label>
                <textarea
                  id="template-desc"
                  placeholder={t('templates.descriptionPlaceholder') || 'Описание шаблона (опционально)'}
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none bg-card"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('templates.selectProducts') || 'Выберите товары'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border border-border rounded-lg bg-muted/30">
                  {products.map((product) => {
                    const isSelected = newTemplate.items.some((i) => i.product_id === product.id)
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() =>
                          isSelected
                            ? removeProductFromTemplate(product.id)
                            : addProductToTemplate(product)
                        }
                        className={`p-2 rounded-lg text-left text-sm transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-accent ${
                          isSelected
                            ? 'bg-accent/20 text-accent border border-accent'
                            : 'bg-card border border-border hover:border-foreground'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        <span className="truncate">{product.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {newTemplate.items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('templates.selectedProducts') || 'Выбранные товары'} ({newTemplate.items.length})
                  </label>
                  <div className="space-y-2">
                    {newTemplate.items.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <span className="flex-1 font-medium text-foreground truncate">
                          {item.product_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div>
                            <label htmlFor={`qty-${item.product_id}`} className="text-xs text-muted-foreground">
                              {t('templates.quantity') || 'Кол-во'}
                            </label>
                            <input
                              id={`qty-${item.product_id}`}
                              type="number"
                              min={1}
                              value={item.default_quantity}
                              onChange={(e) =>
                                updateTemplateItem(
                                  item.product_id,
                                  'default_quantity',
                                  e.target.value
                                )
                              }
                              className="w-16 px-2 py-1 border border-border rounded text-center text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeProductFromTemplate(item.product_id)}
                            className="p-1 text-muted-foreground hover:text-danger transition-colors focus:outline-none focus:ring-2 focus:ring-accent rounded"
                            aria-label={t('common.remove') || 'Удалить'}
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border bg-muted/30">
              <button
                type="button"
                onClick={editingTemplate ? updateTemplate : createTemplate}
                disabled={saving || !newTemplate.name.trim() || newTemplate.items.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                aria-busy={saving}
              >
                {saving ? <ButtonLoader /> : <Check className="w-4 h-4" aria-hidden="true" />}
                {editingTemplate
                  ? t('common.save') || 'Сохранить'
                  : t('templates.create') || 'Создать шаблон'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-danger" aria-hidden="true" />
              </div>
              <div>
                <h3 id="delete-title" className="font-semibold text-foreground">
                  {t('templates.deleteTitle') || 'Удалить шаблон?'}
                </h3>
                <p className="text-sm text-muted-foreground">{deleteConfirm.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t('templates.deleteWarning') || 'Это действие нельзя отменить.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
                aria-busy={deleting}
              >
                {deleting ? <ButtonLoader /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
                {t('common.delete') || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
