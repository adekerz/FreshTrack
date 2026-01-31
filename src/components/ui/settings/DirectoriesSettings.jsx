/**
 * DirectoriesSettings - Объединённое управление справочниками
 * Категории товаров и отделы в одной вкладке
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { useToast } from '../../../context/ToastContext'
import { useHotel } from '../../../context/HotelContext'
import { useProducts } from '../../../context/ProductContext'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'
import { GridLoader, ButtonSpinner } from '..'
import { Tags, Building2, Plus, X, Edit2, Trash2, Check, AlertTriangle, Users } from 'lucide-react'
import { cn } from '../../../utils/classNames'
import { apiFetch } from '../../../services/api'
import CategoriesSettings from './CategoriesSettings'
import DepartmentEmailVerification from './DepartmentEmailVerification'

const TABS = [
  { id: 'categories', icon: Tags, labelKey: 'settings.directories.categories' },
  { id: 'departments', icon: Building2, labelKey: 'settings.directories.departments' }
]

// Inline DepartmentsSettings component
function DepartmentsContent() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId, selectedHotel } = useHotel()
  const { refresh: refreshProducts } = useProducts()
  const queryClient = useQueryClient()

  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newDepartment, setNewDepartment] = useState({ name: '', description: '', email: '' })
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (selectedHotelId) {
      fetchDepartments()
    }
  }, [selectedHotelId])

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const hotelQuery = selectedHotelId ? `?hotel_id=${selectedHotelId}` : ''
      const data = await apiFetch(`/departments${hotelQuery}`)
      setDepartments(data.departments || [])
    } catch (error) {
      addToast(t('settings.departments.loadError') || 'Ошибка загрузки отделов', 'error')
    } finally {
      setLoading(false)
    }
  }

  const addDepartment = async () => {
    if (!newDepartment.name.trim()) {
      addToast(t('settings.departments.nameRequired') || 'Введите название отдела', 'warning')
      return
    }

    setAdding(true)
    try {
      await apiFetch('/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: newDepartment.name.trim(),
          description: newDepartment.description.trim() || null,
          email: newDepartment.email.trim() || null,
          hotel_id: selectedHotelId
        })
      })

      addToast(t('settings.departments.added') || 'Отдел добавлен', 'success')
      setNewDepartment({ name: '', description: '', email: '' })
      setShowAddForm(false)
      // Invalidate departments query to refresh inventory
      if (selectedHotelId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.departments(selectedHotelId) })
      }
      refreshProducts()
      fetchDepartments()
    } catch (error) {
      addToast(error.message || t('settings.departments.addError') || 'Ошибка добавления', 'error')
    } finally {
      setAdding(false)
    }
  }

  const startEditing = (dept) => {
    setEditingId(dept.id)
    setEditName(dept.name)
    setEditDescription(dept.description || '')
    setEditEmail(dept.email || '')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
    setEditEmail('')
  }

  const saveEdit = async (deptId) => {
    if (!editName.trim()) return

    try {
      await apiFetch(`/departments/${deptId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          email: editEmail.trim() || null
        })
      })

      addToast(t('settings.departments.updated') || 'Отдел обновлён', 'success')
      setEditingId(null)
      setEditName('')
      setEditDescription('')
      setEditEmail('')
      // Invalidate departments query to refresh inventory
      if (selectedHotelId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.departments(selectedHotelId) })
      }
      refreshProducts()
      fetchDepartments()
    } catch (error) {
      addToast(error.message || 'Ошибка обновления', 'error')
    }
  }

  const deleteDepartment = async () => {
    if (!deleteConfirm) return

    setDeleting(true)
    try {
      const response = await apiFetch(`/departments/${deleteConfirm.id}`, { method: 'DELETE' })
      
      // Success
      if (response.success !== false) {
        addToast(t('settings.departments.deleted') || 'Отдел удалён', 'success')
        setDeleteConfirm(null)
        // Invalidate departments query to refresh inventory
        if (selectedHotelId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.departments(selectedHotelId) })
        }
        refreshProducts()
        fetchDepartments()
      } else {
        // Check for active batches error
        if (response.activeBatches !== undefined && response.activeBatches > 0) {
          const errorMsg = t('settings.departments.hasActiveBatches', { count: response.activeBatches }) 
            || `В отделе есть ${response.activeBatches} активных партий. Сначала очистите отдел от партий.`
          addToast(errorMsg, 'error')
        } else {
          addToast(response.error || 'Ошибка удаления отдела', 'error')
        }
        setDeleteConfirm(null)
      }
    } catch (error) {
      // Handle network/API errors (400, 404, 500, etc.)
      // Check if error contains activeBatches info (from API response)
      if (error.activeBatches !== undefined && error.activeBatches > 0) {
        const errorMsg = t('settings.departments.hasActiveBatches', { count: error.activeBatches }) 
          || `В отделе есть ${error.activeBatches} активных партий. Сначала очистите отдел от партий.`
        addToast(errorMsg, 'error')
      } else {
        addToast(error.message || 'Ошибка удаления', 'error')
      }
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <GridLoader size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Кнопка добавления */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('settings.departments.add') || 'Добавить отдел'}
        </button>
      )}

      {/* Форма добавления */}
      {showAddForm && (
        <div className="p-4 border border-border rounded-lg bg-card space-y-4">
          <h3 className="font-medium text-foreground">
            {t('settings.departments.newDepartment') || 'Новый отдел'}
          </h3>

          <input
            type="text"
            value={newDepartment.name}
            onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
            placeholder={t('settings.departments.namePlaceholder') || 'Название отдела'}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
            disabled={adding}
            autoFocus
          />

          <input
            type="text"
            value={newDepartment.description}
            onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
            placeholder={t('settings.departments.descriptionPlaceholder') || 'Описание (например: Minibar, Other)'}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
            disabled={adding}
          />

          <input
            type="email"
            value={newDepartment.email}
            onChange={(e) => setNewDepartment({ ...newDepartment, email: e.target.value })}
            placeholder={t('settings.departments.emailPlaceholder') || 'Почта отдела (напр. kitchen@hotel.com)'}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
            disabled={adding}
            onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={addDepartment}
              disabled={adding || !newDepartment.name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
            >
              {adding ? <ButtonSpinner /> : <Plus className="w-4 h-4" />}
              {t('common.add') || 'Добавить'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                refreshProducts()
                setNewDepartment({ name: '', description: '', email: '' })
              }}
              className="px-4 py-2 text-muted-foreground hover:text-foreground"
            >
              {t('common.cancel') || 'Отмена'}
            </button>
          </div>
        </div>
      )}

      {/* Список отделов */}
      {departments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('settings.departments.noDepartments') || 'Отделы не найдены'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className={cn(
                'flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:border-accent/50 transition-colors',
                editingId === dept.id && 'ring-2 ring-accent/50'
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-accent" />
                </div>

                {editingId === dept.id ? (
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder={t('settings.departments.namePlaceholder') || 'Название отдела'}
                      className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder={t('settings.departments.descriptionPlaceholder') || 'Описание (например: Minibar, Other)'}
                      className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder={t('settings.departments.emailPlaceholder') || 'Почта отдела (напр. kitchen@hotel.com)'}
                      className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(dept.id)
                        if (e.key === 'Escape') cancelEditing()
                      }}
                    />
                    {editEmail && (
                      <DepartmentEmailVerification
                        departmentId={dept.id}
                        email={editEmail}
                        onVerified={() => fetchDepartments()}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{dept.name}</p>
                    {dept.description && (
                      <p className="text-sm text-muted-foreground truncate">{dept.description}</p>
                    )}
                    {dept.email && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground truncate">{dept.email}</p>
                        {dept.email_verified ? (
                          <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded">
                            ✓ Подтверждён
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded">
                            ⚠ Не подтверждён
                          </span>
                        )}
                      </div>
                    )}
                    {dept.user_count > 0 && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {dept.user_count} {t('settings.departments.users') || 'пользователей'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {editingId === dept.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(dept.id)}
                      className="p-2 text-success hover:bg-success/10 rounded-lg"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditing(dept)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(dept)}
                      className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное подтверждение удаления */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {t('settings.departments.deleteConfirmTitle') || 'Удалить отдел?'}
                </h3>
                <p className="text-sm text-muted-foreground">{deleteConfirm.name}</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-6">
              {t('settings.departments.deleteConfirmText') || 'Это действие нельзя отменить.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                onClick={deleteDepartment}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50"
              >
                {deleting ? <ButtonSpinner /> : <Trash2 className="w-4 h-4" />}
                {t('common.delete') || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DirectoriesSettings({ readOnly = false }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('categories')

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t('settings.directories.title') || 'Справочники'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.directories.description') || 'Управление категориями товаров и отделами'}
        </p>
      </div>

      {/* Внутренние табы */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {TABS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey) || (id === 'categories' ? 'Категории' : 'Отделы')}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="mt-4">
        {activeTab === 'categories' && <CategoriesSettings readOnly={readOnly} />}
        {activeTab === 'departments' && <DepartmentsContent />}
      </div>
    </div>
  )
}
