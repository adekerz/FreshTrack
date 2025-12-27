/**
 * UsersSettings - Управление пользователями
 * Создание, блокировка, удаление пользователей
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { 
  UserPlus, 
  User, 
  Ban, 
  Trash2, 
  Check, 
  X, 
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'
import { formatDate } from '../../utils/dateUtils'
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
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export default function UsersSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [newUser, setNewUser] = useState({
    login: '',
    password: '',
    name: '',
    email: '',
    role: 'STAFF'
  })
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`${API_URL}/auth/users`)
      setUsers(data.users || data || [])
    } catch (error) {
      logError('Error fetching users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }
  const createUser = async () => {
    if (!newUser.login || !newUser.password || !newUser.name) {
      setError(t('users.fillRequired') || 'Заполните обязательные поля')
      return
    }
    
    setCreating(true)
    setError(null)
    try {
      await apiFetch(`${API_URL}/auth/users`, {
        method: 'POST',
        body: JSON.stringify(newUser)
      })
      fetchUsers()
      setShowCreateModal(false)
      setNewUser({ login: '', password: '', name: '', email: '', role: 'STAFF' })
      addToast(t('toast.userCreated'), 'success')
    } catch (error) {
      setError(error.message)
      addToast(t('toast.userCreateError'), 'error')
    } finally {
      setCreating(false)
    }
  }

  const toggleUserStatus = async (userId, isActive) => {
    try {
      await apiFetch(`${API_URL}/auth/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive })
      })
      fetchUsers()
      addToast(t('toast.userUpdated'), 'success')
    } catch (error) {
      logError('Error toggling user status:', error)
      addToast(t('toast.userUpdateError'), 'error')
    }
  }

  const deleteUser = async (userId, userName) => {
    if (!confirm(`${t('users.confirmDelete') || 'Удалить пользователя'} ${userName}?`)) return
    
    try {
      await apiFetch(`${API_URL}/auth/users/${userId}`, {
        method: 'DELETE'
      })
      fetchUsers()
      addToast(t('toast.userDeleted'), 'success')
    } catch (error) {
      logError('Error deleting user:', error)
      addToast(t('toast.userDeleteError'), 'error')
    }
  }

  const getRoleBadge = (role) => {
    const normalizedRole = role?.toLowerCase()?.replace('istrator', '') || 'staff'
    const styles = {
      admin: 'bg-purple-100 text-purple-700',
      manager: 'bg-blue-100 text-blue-700',
      staff: 'bg-gray-100 text-gray-700'
    }
    const labels = {
      admin: t('users.roleAdmin') || 'Администратор',
      manager: t('users.roleManager') || 'Менеджер',
      staff: t('users.roleStaff') || 'Сотрудник'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[normalizedRole] || styles.staff}`}>
        {labels[normalizedRole] || role}
      </span>
    )
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
          <h2 className="text-xl font-semibold text-charcoal">{t('settings.users.title') || 'Пользователи'}</h2>
          <p className="text-sm text-warmgray mt-1">{t('users.description') || 'Управление учётными записями'}</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          {t('users.create') || 'Создать'}
        </button>
      </div>

      {/* Таблица пользователей */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-sand">
              <th className="text-left py-3 px-4 text-sm font-medium text-warmgray">{t('users.login') || 'Логин'}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-warmgray">{t('users.name') || 'Имя'}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-warmgray">{t('users.role') || 'Роль'}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-warmgray">{t('users.status') || 'Статус'}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-warmgray">{t('users.lastLogin') || 'Последний вход'}</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-warmgray">{t('common.actions') || 'Действия'}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-sand/50 hover:bg-cream/30">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-charcoal/10 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-charcoal" />
                    </div>
                    <span className="font-medium text-charcoal">{user.login}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-charcoal">{user.name}</td>
                <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                <td className="py-3 px-4">
                  <span className={`flex items-center gap-1 text-sm ${user.is_active !== false ? 'text-green-600' : 'text-red-500'}`}>
                    {user.is_active !== false ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t('users.active') || 'Активен'}
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4" />
                        {t('users.blocked') || 'Заблокирован'}
                      </>
                    )}
                  </span>
                </td>
                <td className="py-3 px-4 text-warmgray text-sm">
                  {user.last_login ? formatDate(user.last_login) : '—'}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => toggleUserStatus(user.id, user.is_active !== false)}
                      className={`p-2 rounded-lg transition-colors ${
                        user.is_active !== false 
                          ? 'hover:bg-red-50 text-warmgray hover:text-red-600' 
                          : 'hover:bg-green-50 text-warmgray hover:text-green-600'
                      }`}
                      title={user.is_active !== false ? t('users.block') : t('users.unblock')}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                    {!['SUPER_ADMIN'].includes(user.role?.toUpperCase()) && (
                      <button 
                        onClick={() => deleteUser(user.id, user.name)}
                        className="p-2 rounded-lg hover:bg-red-50 text-warmgray hover:text-red-600 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-warmgray">
            {t('users.noUsers') || 'Пользователи не найдены'}
          </div>
        )}
      </div>

      {/* Модалка создания пользователя */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-charcoal">{t('users.create') || 'Создать пользователя'}</h3>
              <button 
                onClick={() => {
                  setShowCreateModal(false)
                  setError(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-warmgray" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  {t('users.login') || 'Логин'} *
                </label>
                <input 
                  type="text"
                  placeholder={t('users.loginPlaceholder') || 'Введите логин'}
                  value={newUser.login}
                  onChange={(e) => setNewUser({...newUser, login: e.target.value})}
                  className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  {t('users.password') || 'Пароль'} *
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent pr-10"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-warmgray hover:text-charcoal"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  {t('users.name') || 'Имя'} *
                </label>
                <input 
                  type="text"
                  placeholder={t('users.namePlaceholder') || 'Введите имя'}
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  Email
                </label>
                <input 
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">
                  {t('users.role') || 'Роль'}
                </label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full px-4 py-2.5 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
                >
                  <option value="STAFF">{t('users.roleStaff') || 'Сотрудник'}</option>
                  <option value="HOTEL_ADMIN">{t('users.roleAdmin') || 'Администратор отеля'}</option>
                </select>
              </div>

              <button 
                onClick={createUser}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-charcoal text-white rounded-lg hover:bg-charcoal/90 transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {t('users.create') || 'Создать пользователя'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
