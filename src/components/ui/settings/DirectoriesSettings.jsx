/**
 * DirectoriesSettings - Объединённое управление справочниками
 * Категории товаров и отделы в одной вкладке
 */

import { useState } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { useToast } from '../../../context/ToastContext'
import { useHotel } from '../../../context/HotelContext'
import { useProducts } from '../../../context/ProductContext'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../lib/queryKeys'
import { useDepartments } from '../../../hooks/useInventory'
import { GridLoader, ButtonSpinner, ConfirmModal } from '..'
import { Tags, Building2, Plus, X, Edit2, Trash2, Check, Users } from 'lucide-react'
import { cn } from '../../../utils/classNames'
import { apiFetch } from '../../../services/api'
import CategoriesSettings from './CategoriesSettings'
import DepartmentEmailVerification from './DepartmentEmailVerification'
import { CreateDepartmentModal } from './organization'
import { getDepartmentIconComponent, CLASSIFICATION_BY_TYPE } from '../../../utils/departmentClassifications'

const TABS = [
  { id: 'categories', icon: Tags, labelKey: 'settings.directories.categories' },
  { id: 'departments', icon: Building2, labelKey: 'settings.directories.departments' }
]

const EMPTY_DEPT_FORM = { name: '', type: '', email: '', telegram_chat_id: '' }

// ─── Inline Departments Content ──────────────────────────────────────────────
function DepartmentsContent() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { selectedHotelId } = useHotel()
  const { refresh: refreshProducts } = useProducts()
  const queryClient = useQueryClient()

  const { data: departments = [], isLoading: loading } = useDepartments(selectedHotelId)

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDept, setNewDept] = useState(EMPTY_DEPT_FORM)
  const [creating, setCreating] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(null) // dept object
  const [deleting, setDeleting] = useState(false)

  // ── helpers ────────────────────────────────────────────────────────────────
  function invalidate() {
    if (selectedHotelId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments(selectedHotelId) })
    }
    refreshProducts()
  }

  // ── create ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newDept.name.trim()) {
      addToast(t('settings.departments.nameRequired') || 'Введите название отдела', 'warning')
      return
    }
    setCreating(true)
    try {
      await apiFetch('/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: newDept.name.trim(),
          type: newDept.type || null,
          email: newDept.email.trim() || null,
          telegram_chat_id: newDept.telegram_chat_id.trim() || null,
          hotel_id: selectedHotelId
        })
      })
      addToast(t('settings.departments.added') || 'Отдел добавлен', 'success')
      setNewDept(EMPTY_DEPT_FORM)
      setShowCreateModal(false)
      invalidate()
    } catch (error) {
      addToast(error.message || t('settings.departments.addError') || 'Ошибка добавления', 'error')
    } finally {
      setCreating(false)
    }
  }

  // ── edit ───────────────────────────────────────────────────────────────────
  const startEditing = (dept) => {
    setEditingId(dept.id)
    setEditName(dept.name)
    setEditType(dept.type || '')
    setEditEmail(dept.email || '')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditName('')
    setEditType('')
    setEditEmail('')
  }

  const saveEdit = async (deptId) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await apiFetch(`/departments/${deptId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          type: editType || null,
          email: editEmail.trim() || null
        })
      })
      addToast(t('settings.departments.updated') || 'Отдел обновлён', 'success')
      cancelEditing()
      invalidate()
    } catch (error) {
      addToast(error.message || 'Ошибка обновления', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── delete ─────────────────────────────────────────────────────────────────
  const deleteDepartment = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const response = await apiFetch(`/departments/${deleteConfirm.id}`, { method: 'DELETE' })

      if (response.success !== false) {
        addToast(t('settings.departments.deleted') || 'Отдел удалён', 'success')
        setDeleteConfirm(null)
        invalidate()
      } else if (response.activeBatches > 0) {
        addToast(
          t('settings.departments.hasActiveBatches', { count: response.activeBatches }) ||
            `В отделе есть ${response.activeBatches} активных партий. Сначала очистите отдел.`,
          'error'
        )
        setDeleteConfirm(null)
      } else {
        addToast(response.error || 'Ошибка удаления отдела', 'error')
        setDeleteConfirm(null)
      }
    } catch (error) {
      if (error.activeBatches > 0) {
        addToast(
          t('settings.departments.hasActiveBatches', { count: error.activeBatches }) ||
            `В отделе есть ${error.activeBatches} активных партий. Сначала очистите отдел.`,
          'error'
        )
      } else {
        addToast(error.message || 'Ошибка удаления', 'error')
      }
      setDeleteConfirm(null)
    } finally {
      setDeleting(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <GridLoader size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      <button
        onClick={() => {
          setNewDept(EMPTY_DEPT_FORM)
          setShowCreateModal(true)
        }}
        className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {t('settings.departments.add') || 'Добавить отдел'}
      </button>

      {/* Departments list */}
      {departments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('settings.departments.noDepartments') || 'Отделы не найдены'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.map((dept) => {
            const DeptIcon = getDepartmentIconComponent(dept)
            const classification = CLASSIFICATION_BY_TYPE[dept.type]

            return (
              <div
                key={dept.id}
                className={cn(
                  'flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:border-accent/50 transition-colors',
                  editingId === dept.id && 'ring-2 ring-accent/50'
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <DeptIcon className="w-5 h-5 text-accent" />
                  </div>

                  {editingId === dept.id ? (
                    /* ── inline edit form ── */
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t('settings.departments.namePlaceholder') || 'Название отдела'}
                        className="w-full px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
                        autoFocus
                      />
                      {/* Classification mini-picker */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {Object.values(CLASSIFICATION_BY_TYPE).map(({ type, label, icon: CIcon }) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setEditType(type)}
                            className={cn(
                              'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-colors text-left',
                              editType === type
                                ? 'border-accent bg-accent/10 text-accent font-medium'
                                : 'border-border bg-background text-foreground hover:border-accent/50 hover:bg-muted'
                            )}
                          >
                            <CIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="leading-tight truncate">{label}</span>
                          </button>
                        ))}
                      </div>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder={t('settings.departments.emailPlaceholder') || 'Почта отдела'}
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
                          onVerified={() =>
                            queryClient.invalidateQueries({ queryKey: queryKeys.departments(selectedHotelId) })
                          }
                        />
                      )}
                    </div>
                  ) : (
                    /* ── display mode ── */
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{dept.name}</p>
                      {classification && (
                        <p className="text-xs text-muted-foreground">{classification.label}</p>
                      )}
                      {dept.email && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm text-muted-foreground truncate">{dept.email}</p>
                          {dept.email_confirmed ? (
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
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" />
                          {dept.user_count} {t('settings.departments.users') || 'пользователей'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  {editingId === dept.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(dept.id)}
                        disabled={saving}
                        className="p-2 text-success hover:bg-success/10 rounded-lg disabled:opacity-50"
                        title="Сохранить"
                      >
                        {saving ? <ButtonSpinner /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                        title="Отмена"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditing(dept)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                        title="Редактировать"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(dept)}
                        className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal — reuses the same modal as OrganizationSettings */}
      <CreateDepartmentModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setNewDept(EMPTY_DEPT_FORM)
        }}
        onSubmit={handleCreate}
        formState={newDept}
        setFormState={setNewDept}
        creating={creating}
      />

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={deleteDepartment}
        loading={deleting}
        title={t('settings.departments.deleteConfirmTitle') || 'Удалить отдел?'}
        description={deleteConfirm?.name}
        confirmLabel={t('common.delete') || 'Удалить'}
        cancelLabel={t('common.cancel') || 'Отмена'}
      />
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function DirectoriesSettings({ readOnly = false }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('categories')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Tags className="w-5 h-5 text-accent" aria-hidden="true" />
          {t('settings.directories.title') || 'Справочники'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.directories.description') || 'Управление категориями товаров и отделами'}
        </p>
      </div>

      {/* Tabs */}
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

      <div className="mt-4">
        {activeTab === 'categories' && <CategoriesSettings readOnly={readOnly} />}
        {activeTab === 'departments' && <DepartmentsContent />}
      </div>
    </div>
  )
}
