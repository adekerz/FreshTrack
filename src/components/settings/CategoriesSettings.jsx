/**
 * CategoriesSettings - Управление категориями товаров
 * Создание, редактирование, удаление категорий
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { Plus, X, RefreshCw, Tag, Palette } from 'lucide-react'
import { logError } from '../../utils/logger'

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

const defaultColors = [
  '#FF8D6B', '#6B8DFF', '#6BFF8D', '#FF6B8D', '#8D6BFF',
  '#FFB86B', '#6BFFB8', '#B86BFF', '#FF6BB8', '#6BB8FF'
]

export default function CategoriesSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCategory, setNewCategory] = useState({ name: '', color: '#FF8D6B' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`${API_URL}/categories`)
      setCategories(data.categories || data || [])
    } catch (error) {
      logError('Error fetching categories:', error)
      // Показываем стандартные категории, если API не отвечает
      setCategories([
        { id: 1, name: 'Wine', color: '#722F37' },
        { id: 2, name: 'Spirits', color: '#8B4513' },
        { id: 3, name: 'Beverages', color: '#4169E1' },
        { id: 4, name: 'Mixers', color: '#32CD32' },
        { id: 5, name: 'snacks', color: '#FF8C00' }
      ])
    } finally {
      setLoading(false)
    }
  }
  const addCategory = async () => {
    if (!newCategory.name.trim()) return
    
    setAdding(true)
    try {
      await apiFetch(`${API_URL}/categories`, {
        method: 'POST',
        body: JSON.stringify(newCategory)
      })
      fetchCategories()
      setNewCategory({ name: '', color: defaultColors[Math.floor(Math.random() * defaultColors.length)] })
      addToast(t('toast.categoryAdded'), 'success')
    } catch (error) {
      logError('Error adding category:', error)
      addToast(t('toast.categoryAddError'), 'error')
    } finally {
      setAdding(false)
    }
  }

  const deleteCategory = async (id, name) => {
    if (!confirm(`${t('categories.confirmDelete') || 'Удалить категорию'} "${name}"?`)) return
    
    try {
      await apiFetch(`${API_URL}/categories/${id}`, {
        method: 'DELETE'
      })
      fetchCategories()
      addToast(t('toast.categoryDeleted'), 'success')
    } catch (error) {
      logError('Error deleting category:', error)
      addToast(t('toast.categoryDeleteError'), 'error')
    }
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
      <div>
        <h2 className="text-xl font-semibold text-charcoal">{t('settings.categories.title') || 'Категории'}</h2>
        <p className="text-sm text-warmgray mt-1">{t('categorySettings.description') || 'Управление категориями товаров'}</p>
      </div>

      {/* Форма добавления */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-cream/50 rounded-xl">
        <div className="flex-1">
          <input 
            type="text"
            placeholder={t('categorySettings.name') || 'Название категории'}
            value={newCategory.name}
            onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
            className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            onKeyPress={(e) => e.key === 'Enter' && addCategory()}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="color"
              value={newCategory.color}
              onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
              className="w-12 h-10 rounded-lg border border-sand cursor-pointer"
              title={t('categorySettings.selectColor') || 'Выберите цвет'}
            />
          </div>
          
          <button 
            onClick={addCategory}
            disabled={adding || !newCategory.name.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-50"
          >
            {adding ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t('common.add') || 'Добавить'}
          </button>
        </div>
      </div>

      {/* Предустановленные цвета */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-warmgray mr-2">{t('categories.quickColors') || 'Быстрый выбор:'}:</span>
        {defaultColors.map(color => (
          <button
            key={color}
            onClick={() => setNewCategory({...newCategory, color})}
            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
              newCategory.color === color ? 'border-charcoal ring-2 ring-offset-2 ring-charcoal' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Список категорий */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div 
            key={cat.id} 
            className="flex items-center justify-between p-4 rounded-xl border-2 bg-white hover:shadow-md transition-shadow"
            style={{ borderColor: cat.color }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: cat.color + '20' }}
              >
                <Tag className="w-5 h-5" style={{ color: cat.color }} />
              </div>
              <div>
                <span className="font-medium text-charcoal">
                  {cat.name}
                </span>
                <p className="text-xs text-warmgray">{cat.color}</p>
              </div>
            </div>
            <button 
              onClick={() => deleteCategory(cat.id, cat.name)}
              className="p-2 rounded-lg hover:bg-red-50 text-warmgray hover:text-red-600 transition-colors"
              title={t('common.delete')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 text-warmgray">
          <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('categories.noCategories') || 'Категории не найдены'}</p>
        </div>
      )}
    </div>
  )
}
