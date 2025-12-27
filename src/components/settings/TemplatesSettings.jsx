/**
 * TemplatesSettings - Управление шаблонами поставок
 * Создание, редактирование, удаление шаблонов
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useProducts } from '../../context/ProductContext'
import { useToast } from '../../context/ToastContext'
import { 
  Plus, 
  X, 
  RefreshCw, 
  FileBox, 
  Edit2, 
  Trash2,
  Package,
  Check
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('freshtrack_token')
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export default function TemplatesSettings() {
  const { t } = useTranslation()
  const { departments } = useProducts()
  const { addToast } = useToast()
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

  // Set default department when departments load
  useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0].id)
    }
  }, [departments, selectedDepartment])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [templatesData, productsData] = await Promise.all([
        apiFetch(`${API_URL}/delivery-templates`),
        apiFetch(`${API_URL}/products/catalog`)
      ])
      setTemplates(templatesData.templates || templatesData || [])
      setProducts(productsData.products || productsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
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
      await apiFetch(`${API_URL}/delivery-templates`, {
        method: 'POST',
        body: JSON.stringify({
          ...newTemplate,
          department_id: selectedDepartment
        })
      })
      fetchData()
      closeModal()
      addToast(t('toast.templateCreated'), 'success')
    } catch (error) {
      console.error('Error creating template:', error)
      addToast(t('toast.templateCreateError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateTemplate = async () => {
    if (!editingTemplate || !newTemplate.name.trim()) return
    
    setSaving(true)
    try {
      await apiFetch(`${API_URL}/delivery-templates/${editingTemplate.id}`, {
        method: 'PUT',
        body: JSON.stringify(newTemplate)
      })
      fetchData()
      closeModal()
      addToast(t('toast.templateUpdated'), 'success')
    } catch (error) {
      console.error('Error updating template:', error)
      addToast(t('toast.templateUpdateError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async (id, name) => {
    if (!confirm(`${t('templates.confirmDelete') || 'Удалить шаблон'} "${name}"?`)) return
    
    try {
      await apiFetch(`${API_URL}/delivery-templates/${id}`, {
        method: 'DELETE'
      })
      fetchData()
      addToast(t('toast.templateDeleted'), 'success')
    } catch (error) {
      console.error('Error deleting template:', error)
      addToast(t('toast.templateDeleteError'), 'error')
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
    if (newTemplate.items.some(item => item.product_id === product.id)) return
    
    setNewTemplate({
      ...newTemplate,
      items: [...newTemplate.items, {
        product_id: product.id,
        product_name: product.name,
        default_quantity: 10,
        shelf_life_days: 30
      }]
    })
  }

  const removeProductFromTemplate = (productId) => {
    setNewTemplate({
      ...newTemplate,
      items: newTemplate.items.filter(item => item.product_id !== productId)
    })
  }

  const updateTemplateItem = (productId, field, value) => {
    setNewTemplate({
      ...newTemplate,
      items: newTemplate.items.map(item => 
        item.product_id === productId 
          ? { ...item, [field]: parseInt(value) || 0 }
          : item
      )
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-warmgray" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-charcoal">{t('settings.templates.title') || 'Шаблоны поставок'}</h2>
          <p className="text-sm text-warmgray mt-1">{t('templates.description') || 'Быстрое добавление товаров по шаблону'}</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('templates.create') || 'Создать'}
        </button>
      </div>

      {/* Список шаблонов */}
      {templates.length === 0 ? (
        <div className="text-center py-12">
          <FileBox className="w-12 h-12 mx-auto mb-4 text-warmgray opacity-50" />
          <p className="text-warmgray">{t('templates.noTemplates') || 'Нет созданных шаблонов'}</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-accent hover:underline"
          >
            {t('templates.createFirst') || 'Создать первый шаблон'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map(template => (
            <div key={template.id} className="p-5 border border-sand rounded-xl bg-white hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-charcoal text-lg">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-warmgray mt-1">{template.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1 text-sm text-warmgray">
                      <Package className="w-4 h-4" />
                      {template.items?.length || 0} {t('templates.products') || 'товаров'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(template)}
                    className="p-2 rounded-lg hover:bg-cream text-warmgray hover:text-charcoal transition-colors"
                    title={t('common.edit')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteTemplate(template.id, template.name)}
                    className="p-2 rounded-lg hover:bg-red-50 text-warmgray hover:text-red-600 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Превью товаров */}
              {template.items?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {template.items.slice(0, 5).map((item, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-cream/70 rounded-full text-sm text-charcoal"
                    >
                      {item.product_name || item.name} × {item.default_quantity}
                    </span>
                  ))}
                  {template.items.length > 5 && (
                    <span className="px-3 py-1 bg-cream/70 rounded-full text-sm text-warmgray">
                      +{template.items.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Модалка создания/редактирования */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-sand">
              <h3 className="text-lg font-semibold text-charcoal">
                {editingTemplate 
                  ? (t('templates.editTemplate') || 'Редактировать шаблон')
                  : (t('templates.create') || 'Создать шаблон')
                }
              </h3>
              <button 
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-warmgray" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Название */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t('templates.name') || 'Название шаблона'} *
                </label>
                <input 
                  type="text"
                  placeholder={t('templates.namePlaceholder') || 'Например: Ежедневная поставка'}
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {/* Описание */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t('templates.descriptionLabel') || 'Описание'}
                </label>
                <textarea 
                  placeholder={t('templates.descriptionPlaceholder') || 'Описание шаблона (опционально)'}
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                  className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none h-20"
                />
              </div>

              {/* Выбор товаров */}
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">
                  {t('templates.selectProducts') || 'Выберите товары'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border border-sand rounded-lg bg-cream/30">
                  {products.map(product => {
                    const isSelected = newTemplate.items.some(item => item.product_id === product.id)
                    return (
                      <button 
                        key={product.id}
                        onClick={() => isSelected ? removeProductFromTemplate(product.id) : addProductToTemplate(product)}
                        className={`p-2 rounded-lg text-left text-sm transition-colors flex items-center gap-2 ${
                          isSelected 
                            ? 'bg-accent/20 text-accent border border-accent' 
                            : 'bg-white border border-sand hover:border-charcoal'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                        <span className="truncate">{product.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Выбранные товары с настройками */}
              {newTemplate.items.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-charcoal mb-2">
                    {t('templates.selectedProducts') || 'Выбранные товары'} ({newTemplate.items.length})
                  </label>
                  <div className="space-y-2">
                    {newTemplate.items.map(item => (
                      <div 
                        key={item.product_id} 
                        className="flex items-center gap-3 p-3 bg-cream/50 rounded-lg"
                      >
                        <span className="flex-1 font-medium text-charcoal truncate">
                          {item.product_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <div>
                            <label className="text-xs text-warmgray">{t('templates.quantity') || 'Кол-во'}</label>
                            <input 
                              type="number"
                              min="1"
                              value={item.default_quantity}
                              onChange={(e) => updateTemplateItem(item.product_id, 'default_quantity', e.target.value)}
                              className="w-16 px-2 py-1 border border-sand rounded text-center text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-warmgray">{t('templates.shelfLife') || 'Срок'}</label>
                            <input 
                              type="number"
                              min="1"
                              value={item.shelf_life_days}
                              onChange={(e) => updateTemplateItem(item.product_id, 'shelf_life_days', e.target.value)}
                              className="w-16 px-2 py-1 border border-sand rounded text-center text-sm"
                            />
                          </div>
                          <button 
                            onClick={() => removeProductFromTemplate(item.product_id)}
                            className="p-1 text-warmgray hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-sand bg-cream/30">
              <button 
                onClick={editingTemplate ? updateTemplate : createTemplate}
                disabled={saving || !newTemplate.name.trim() || newTemplate.items.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingTemplate 
                  ? (t('common.save') || 'Сохранить')
                  : (t('templates.create') || 'Создать шаблон')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
