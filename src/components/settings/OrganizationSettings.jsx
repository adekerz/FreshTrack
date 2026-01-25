/**
 * OrganizationSettings - Объединённое управление отелями, департаментами и пользователями
 * Для SUPER_ADMIN: полное управление всей структурой
 * Для HOTEL_ADMIN: управление пользователями своего отеля
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../services/api'
import { formatDate } from '../../utils/dateUtils'
import MarshaCodeSelector from '../MarshaCodeSelector'
import { ButtonLoader, SectionLoader } from '../ui'
import {
  Building2,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Users,
  User,
  UserPlus,
  Ban,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail
} from 'lucide-react'
import SettingsLayout from './SettingsLayout'

export default function OrganizationSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { user: currentUser, hasPermission } = useAuth()

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [hotels, setHotels] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedHotels, setExpandedHotels] = useState({})
  const [expandedDepts, setExpandedDepts] = useState({})
  const [activeView, setActiveView] = useState('hotels') // hotels | users (для не-SuperAdmin)

  // Create hotel modal
  const [showCreateHotel, setShowCreateHotel] = useState(false)
  const [newHotel, setNewHotel] = useState({
    name: '',
    description: '',
    address: '',
    marsha_code: '',
    marsha_code_id: null
  })
  const [creatingHotel, setCreatingHotel] = useState(false)

  // Create department modal
  const [showCreateDept, setShowCreateDept] = useState(null) // hotelId
  const [newDept, setNewDept] = useState({ name: '', description: '' })
  const [creatingDept, setCreatingDept] = useState(false)

  // Create user modal
  const [showCreateUser, setShowCreateUser] = useState(null) // { hotelId, departmentId? }
  const [newUser, setNewUser] = useState({
    login: '',
    password: '',
    name: '',
    email: '',
    role: 'STAFF'
  })
  const [creatingUser, setCreatingUser] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [userError, setUserError] = useState(null)
  const [generatePassword, setGeneratePassword] = useState(true) // Default: auto-generate password

  // Delete/Block confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [blockConfirm, setBlockConfirm] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [currentUser])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (isSuperAdmin) {
        // Fetch all hotels with departments and users
        const hotelsData = await apiFetch('/hotels')
        const usersData = await apiFetch('/auth/users?all=true')
        const users = usersData.users || usersData || []
        setAllUsers(users)

        const hotelsWithData = await Promise.all(
          (hotelsData.hotels || []).map(async (hotel) => {
            try {
              const deptData = await apiFetch(`/departments?hotel_id=${hotel.id}`)
              const hotelUsers = users.filter((u) => u.hotel_id === hotel.id)
              const departments = (deptData.departments || []).map((dept) => ({
                ...dept,
                users: users.filter((u) => u.department_id === dept.id)
              }))
              return { ...hotel, departments, users: hotelUsers }
            } catch {
              return { ...hotel, departments: [], users: [] }
            }
          })
        )
        setHotels(hotelsWithData)
      } else {
        // Fetch only users for current hotel
        const usersData = await apiFetch('/auth/users')
        setAllUsers(usersData.users || usersData || [])
      }
    } catch (error) {
      addToast('Ошибка загрузки данных', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Hotel CRUD
  const createHotel = async () => {
    if (!newHotel.marsha_code) {
      addToast('Выберите MARSHA код отеля Marriott', 'error')
      return
    }
    if (!newHotel.name.trim()) {
      addToast('Введите название отеля', 'error')
      return
    }
    setCreatingHotel(true)
    try {
      // Подготавливаем данные: пустые строки -> null
      const hotelData = {
        name: newHotel.name.trim(),
        description: newHotel.description?.trim() || null,
        address: newHotel.address?.trim() || null,
        marsha_code: newHotel.marsha_code || null,
        marsha_code_id: newHotel.marsha_code_id || null
      }

      const result = await apiFetch('/hotels', {
        method: 'POST',
        body: JSON.stringify(hotelData)
      })

      // Показываем MARSHA код если он был выбран
      const codeInfo = result.hotel.marsha_code ? ` Код: ${result.hotel.marsha_code}` : ''
      addToast(`Отель "${result.hotel.name}" создан.${codeInfo}`, 'success')
      setShowCreateHotel(false)
      setNewHotel({ name: '', description: '', address: '', marsha_code: '', marsha_code_id: null })
      fetchData()
    } catch (error) {
      addToast(error.message || 'Ошибка создания отеля', 'error')
    } finally {
      setCreatingHotel(false)
    }
  }

  // Department CRUD
  const createDepartment = async () => {
    if (!newDept.name.trim()) {
      addToast('Введите название департамента', 'error')
      return
    }
    setCreatingDept(true)
    try {
      const result = await apiFetch('/departments', {
        method: 'POST',
        headers: { 'X-Hotel-Id': showCreateDept },
        body: JSON.stringify(newDept)
      })
      addToast(
        `Департамент "${result.department.name}" создан. Код: ${result.department.code}`,
        'success'
      )
      setShowCreateDept(null)
      setNewDept({ name: '', description: '' })
      fetchData()
    } catch (error) {
      addToast(error.message || 'Ошибка создания департамента', 'error')
    } finally {
      setCreatingDept(false)
    }
  }

  // User CRUD
  const createUser = async () => {
    if (!newUser.login || !newUser.name) {
      setUserError('Заполните обязательные поля (логин, имя)')
      return
    }
    
    // If generatePassword is enabled, password is optional
    if (!generatePassword && !newUser.password) {
      setUserError('Укажите пароль или включите автоматическую генерацию')
      return
    }
    
    // Email is required if generating password (to send it)
    if (generatePassword && !newUser.email) {
      setUserError('Email обязателен для отправки временного пароля')
      return
    }
    
    setCreatingUser(true)
    setUserError(null)
    try {
      // На уровне отеля (без departmentId) - автоматически HOTEL_ADMIN
      const effectiveRole = showCreateUser?.departmentId ? newUser.role : 'HOTEL_ADMIN'

      const requestBody = {
        login: newUser.login,
        name: newUser.name,
        email: newUser.email,
        role: effectiveRole,
        hotel_id: showCreateUser?.hotelId,
        department_id: showCreateUser?.departmentId
      }
      
      // Only include password if manually set (not auto-generated)
      if (!generatePassword && newUser.password) {
        requestBody.password = newUser.password
      }

      const result = await apiFetch('/auth/users', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })
      
      if (generatePassword && newUser.email) {
        addToast(`Пользователь создан. Временный пароль отправлен на ${newUser.email}`, 'success')
      } else {
        addToast('Пользователь создан', 'success')
      }
      
      setShowCreateUser(null)
      setNewUser({ login: '', password: '', name: '', email: '', role: 'STAFF' })
      setGeneratePassword(true) // Reset to default
      setShowPassword(false)
      fetchData()
    } catch (error) {
      setUserError(error.message || 'Ошибка создания пользователя')
      addToast('Ошибка создания пользователя', 'error')
    } finally {
      setCreatingUser(false)
    }
  }
  
  // Resend password to user
  const resendPassword = async (userId, userEmail) => {
    if (!window.confirm(`Отправить новый временный пароль на ${userEmail}?`)) {
      return
    }
    
    try {
      const result = await apiFetch(`/auth/users/${userId}/resend-password`, {
        method: 'POST'
      })
      
      if (result.success || !result.error) {
        addToast(`Временный пароль отправлен на ${userEmail}`, 'success')
      } else {
        addToast('Ошибка отправки пароля', 'error')
      }
    } catch (error) {
      addToast(error.message || 'Ошибка отправки пароля', 'error')
    }
  }

  const toggleUserStatus = async (userId, isActive) => {
    setActionLoading(true)
    try {
      await apiFetch(`/auth/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive })
      })
      addToast(isActive ? 'Пользователь заблокирован' : 'Пользователь разблокирован', 'success')
      setBlockConfirm(null)
      fetchData()
    } catch (error) {
      addToast('Ошибка обновления', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setActionLoading(true)
    try {
      if (deleteConfirm.type === 'hotel') {
        await apiFetch(`/hotels/${deleteConfirm.id}`, { method: 'DELETE' })
        addToast('Отель удалён', 'success')
      } else if (deleteConfirm.type === 'department') {
        await apiFetch(`/departments/${deleteConfirm.id}`, {
          method: 'DELETE',
          headers: { 'X-Hotel-Id': deleteConfirm.hotelId }
        })
        addToast('Департамент удалён', 'success')
      } else if (deleteConfirm.type === 'user') {
        await apiFetch(`/auth/users/${deleteConfirm.id}`, { method: 'DELETE' })
        addToast('Пользователь удалён', 'success')
      }
      setDeleteConfirm(null)
      fetchData()
    } catch (error) {
      addToast(error.message || 'Ошибка удаления', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    addToast('Код скопирован', 'success')
  }

  const toggleHotel = (hotelId) => {
    setExpandedHotels((prev) => ({ ...prev, [hotelId]: !prev[hotelId] }))
  }

  const toggleDept = (deptId) => {
    setExpandedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  const getRoleBadge = (role) => {
    const styles = {
      SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      HOTEL_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      DEPARTMENT_MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      STAFF: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[role] || styles.STAFF}`}>
        {t(`users.roles.${role}`) || role}
      </span>
    )
  }

  // Render user row
  const renderUserRow = (user, showHotelInfo = false) => (
    <div
      key={user.id}
      className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{user.name}</span>
            {getRoleBadge(user.role)}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="truncate">{user.login}</span>
            {user.email && <span className="truncate">• {user.email}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-xs ${
            user.is_active !== false ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {user.is_active !== false ? 'Активен' : 'Заблок.'}
        </span>
        {user.email && user.is_active !== false && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              resendPassword(user.id, user.email)
            }}
            className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded transition-colors"
            title="Переотправить временный пароль"
          >
            <Mail className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() =>
            setBlockConfirm({
              userId: user.id,
              userName: user.name,
              isActive: user.is_active !== false
            })
          }
          className={`p-1.5 rounded transition-colors ${
            user.is_active !== false
              ? 'text-muted-foreground hover:text-danger hover:bg-danger/10'
              : 'text-muted-foreground hover:text-success hover:bg-success/10'
          }`}
          title={user.is_active !== false ? 'Заблокировать' : 'Разблокировать'}
        >
          <Ban className="w-4 h-4" />
        </button>
        {user.role !== 'SUPER_ADMIN' && (
          <button
            onClick={() => setDeleteConfirm({ type: 'user', id: user.id, name: user.name })}
            className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded transition-colors"
            title="Удалить"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )

  if (loading) {
    return <SectionLoader />
  }

  // For non-SuperAdmin - show only users table
  if (!isSuperAdmin) {
    return (
      <SettingsLayout
        title="Пользователи"
        description="Управление учётными записями"
        icon={Users}
        headerActions={
          <button
            onClick={() => setShowCreateUser({ hotelId: currentUser?.hotel_id })}
            className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Создать
          </button>
        }
      >

        <div className="space-y-2">
          {allUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Пользователи не найдены</div>
          ) : (
            allUsers.map((user) => renderUserRow(user))
          )}
        </div>

        {/* Modals */}
        {renderCreateUserModal()}
        {renderBlockConfirmModal()}
        {renderDeleteConfirmModal()}
      </SettingsLayout>
    )
  }

  // SuperAdmin view - hotels with departments and users
  return (
    <SettingsLayout
      title="Структура организации"
      description="Отели, департаменты и пользователи"
      icon={Building2}
      headerActions={
        <button
          onClick={() => setShowCreateHotel(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать отель
        </button>
      }
    >

      {/* Hotels list */}
      <div className="space-y-4">
        {hotels.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Нет отелей</p>
            <p className="text-sm mt-2">Создайте первый отель</p>
          </div>
        ) : (
          hotels.map((hotel) => (
            <div key={hotel.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Hotel header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleHotel(hotel.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedHotels[hotel.id] ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  <Building2 className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="font-medium text-foreground">{hotel.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {hotel.marsha_code && (
                        <>
                          <code className="text-xs bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded text-purple-700 dark:text-purple-400 font-mono">
                            {hotel.marsha_code}
                          </code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyCode(hotel.marsha_code)
                            }}
                            className="p-1 hover:bg-muted rounded"
                            title="Копировать MARSHA код"
                          >
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground">
                        • {hotel.departments?.length || 0} деп. • {hotel.users?.length || 0} польз.
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      hotel.is_active !== false
                        ? 'bg-success/10 text-success'
                        : 'bg-danger/10 text-danger'
                    }`}
                  >
                    {hotel.is_active !== false ? 'Активен' : 'Неактивен'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm({ type: 'hotel', id: hotel.id, name: hotel.name })
                    }}
                    className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded hotel content */}
              {expandedHotels[hotel.id] && (
                <div className="border-t border-border">
                  {/* Hotel-level users */}
                  <div className="p-4 bg-muted/10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Админы отеля
                      </h4>
                      <button
                        onClick={() => setShowCreateUser({ hotelId: hotel.id })}
                        className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                      >
                        <UserPlus className="w-3 h-3" />
                        Добавить
                      </button>
                    </div>
                    <div className="space-y-2">
                      {hotel.users?.filter((u) => !u.department_id).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          Нет пользователей на уровне отеля
                        </p>
                      ) : (
                        hotel.users
                          ?.filter((u) => !u.department_id)
                          .map((user) => renderUserRow(user))
                      )}
                    </div>
                  </div>

                  {/* Departments */}
                  <div className="p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Департаменты</h4>
                      <button
                        onClick={() => setShowCreateDept(hotel.id)}
                        className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                      >
                        <Plus className="w-3 h-3" />
                        Добавить
                      </button>
                    </div>

                    {hotel.departments?.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Нет департаментов
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {hotel.departments?.map((dept) => (
                          <div
                            key={dept.id}
                            className="bg-card rounded-lg border border-border overflow-hidden"
                          >
                            {/* Department header */}
                            <div
                              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => toggleDept(dept.id)}
                            >
                              <div className="flex items-center gap-2">
                                {expandedDepts[dept.id] ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className="text-foreground font-medium">{dept.name}</span>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-accent">
                                  {dept.code}
                                </code>
                                <span className="text-xs text-muted-foreground">
                                  • {dept.users?.length || 0} польз.
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowCreateUser({ hotelId: hotel.id, departmentId: dept.id })
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded transition-colors"
                                  title="Добавить пользователя"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteConfirm({
                                      type: 'department',
                                      id: dept.id,
                                      name: dept.name,
                                      hotelId: hotel.id
                                    })
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Department users */}
                            {expandedDepts[dept.id] && (
                              <div className="border-t border-border p-3 bg-muted/10 space-y-2">
                                {dept.users?.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-2">
                                    Нет пользователей
                                  </p>
                                ) : (
                                  dept.users?.map((user) => renderUserRow(user))
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {renderCreateHotelModal()}
      {renderCreateDeptModal()}
      {renderCreateUserModal()}
      {renderBlockConfirmModal()}
      {renderDeleteConfirmModal()}
    </SettingsLayout>
  )

  // Modal render functions
  function renderCreateHotelModal() {
    if (!showCreateHotel) return null
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-card rounded-xl p-6 w-full max-w-xl shadow-xl animate-slide-up min-h-[500px] max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Создать отель</h3>
            <button
              onClick={() => setShowCreateHotel(false)}
              className="p-2 hover:bg-muted rounded-lg"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-4">
            {/* MARSHA Code Selector - обязательный, идёт ПЕРВЫМ */}
            <MarshaCodeSelector
              hotelName={newHotel.name}
              selectedCode={newHotel.marsha_code}
              required={true}
              onSelect={(code, codeId) =>
                setNewHotel({
                  ...newHotel,
                  marsha_code: code,
                  marsha_code_id: codeId
                })
              }
              onSelectWithDetails={(marshaCode) => {
                // Автозаполняем название и адрес из MARSHA кода
                setNewHotel((prev) => ({
                  ...prev,
                  name: marshaCode.hotel_name,
                  marsha_code: marshaCode.code,
                  marsha_code_id: marshaCode.id,
                  // Автозаполняем адрес из города и страны
                  address: prev.address || `${marshaCode.city}, ${marshaCode.country}`
                }))
              }}
              onClear={() =>
                setNewHotel({
                  ...newHotel,
                  marsha_code: '',
                  marsha_code_id: null,
                  name: '',
                  address: ''
                })
              }
            />

            {/* Название отеля - показываем только после выбора MARSHA кода */}
            {newHotel.marsha_code && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Название отеля
                </label>
                <input
                  type="text"
                  value={newHotel.name}
                  readOnly
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-muted/50 text-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Заполняется автоматически из MARSHA кода
                </p>
              </div>
            )}

            {/* Адрес - можно редактировать */}
            {newHotel.marsha_code && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Адрес</label>
                <input
                  type="text"
                  placeholder="Уточните адрес"
                  value={newHotel.address}
                  onChange={(e) => setNewHotel({ ...newHotel, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                />
              </div>
            )}

            <button
              onClick={createHotel}
              disabled={creatingHotel}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
              aria-busy={creatingHotel}
            >
              {creatingHotel ? <ButtonLoader /> : <Plus className="w-4 h-4" />}
              Создать
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderCreateDeptModal() {
    if (!showCreateDept) return null
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Создать департамент</h3>
            <button
              onClick={() => setShowCreateDept(null)}
              className="p-2 hover:bg-muted rounded-lg"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Название *</label>
              <input
                type="text"
                placeholder="Кухня"
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              />
              <p className="text-xs text-muted-foreground mt-1">Код генерируется автоматически</p>
            </div>
            <button
              onClick={createDepartment}
              disabled={creatingDept}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
              aria-busy={creatingDept}
            >
              {creatingDept ? <ButtonLoader /> : <Plus className="w-4 h-4" />}
              Создать
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderCreateUserModal() {
    if (!showCreateUser) return null
    const hotelName = hotels.find((h) => h.id === showCreateUser.hotelId)?.name
    const deptName = hotels
      .find((h) => h.id === showCreateUser.hotelId)
      ?.departments?.find((d) => d.id === showCreateUser.departmentId)?.name

    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card rounded-xl p-6 w-full max-w-md mx-4 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Создать пользователя</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hotelName}
                {deptName ? ` → ${deptName}` : ''}
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateUser(null)
                setUserError(null)
                setNewUser({ login: '', password: '', name: '', email: '', role: 'STAFF' })
                setGeneratePassword(true)
                setShowPassword(false)
              }}
              className="p-2 hover:bg-muted rounded-lg"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {userError && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              {userError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Логин *</label>
              <input
                type="text"
                placeholder="username"
                value={newUser.login}
                onChange={(e) => setNewUser({ ...newUser, login: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="generatePassword"
                  checked={generatePassword}
                  onChange={(e) => {
                    setGeneratePassword(e.target.checked)
                    if (e.target.checked) {
                      setNewUser({ ...newUser, password: '' })
                    }
                  }}
                  className="rounded border-border"
                />
                <label htmlFor="generatePassword" className="text-sm font-medium text-foreground cursor-pointer">
                  Сгенерировать пароль автоматически
                </label>
              </div>
              {generatePassword ? (
                <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                  <p className="text-xs text-info">
                    <strong>Временный пароль будет сгенерирован и отправлен на email.</strong> Пользователь должен будет сменить его при первом входе.
                  </p>
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-foreground mb-1">Пароль *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Мин. 8 символов, заглавные, строчные буквы и цифры
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Имя *</label>
              <input
                type="text"
                placeholder="Иван Иванов"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email {generatePassword && <span className="text-danger">*</span>}
              </label>
              <input
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
              />
              {generatePassword && (
                <p className="text-xs text-muted-foreground mt-1">
                  Обязателен для отправки временного пароля
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Роль</label>
              {/* На уровне отеля (без departmentId) - только HOTEL_ADMIN */}
              {!showCreateUser.departmentId ? (
                <div className="w-full px-4 py-2.5 border border-border rounded-lg bg-muted/50 text-foreground">
                  {t('users.roles.HOTEL_ADMIN')}
                </div>
              ) : (
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                >
                  <option value="STAFF">{t('users.roles.STAFF')}</option>
                  <option value="DEPARTMENT_MANAGER">{t('users.roles.DEPARTMENT_MANAGER')}</option>
                </select>
              )}
            </div>
            <button
              onClick={createUser}
              disabled={creatingUser}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
              aria-busy={creatingUser}
            >
              {creatingUser ? <ButtonLoader /> : <UserPlus className="w-4 h-4" />}
              Создать
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderBlockConfirmModal() {
    if (!blockConfirm) return null
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center animate-danger-pulse ${
                blockConfirm.isActive ? 'bg-danger/10' : 'bg-success/10'
              }`}
            >
              <Ban
                className={`w-7 h-7 animate-danger-shake ${
                  blockConfirm.isActive ? 'text-danger' : 'text-success'
                }`}
              />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {blockConfirm.isActive ? 'Заблокировать?' : 'Разблокировать?'}
              </h3>
              <p className="text-sm text-muted-foreground">{blockConfirm.userName}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setBlockConfirm(null)}
              disabled={actionLoading}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={() => toggleUserStatus(blockConfirm.userId, blockConfirm.isActive)}
              disabled={actionLoading}
              className={`flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50 flex items-center justify-center gap-2 ${
                blockConfirm.isActive
                  ? 'bg-danger hover:bg-danger/90'
                  : 'bg-success hover:bg-success/90'
              }`}
              aria-busy={actionLoading}
            >
              {actionLoading && <ButtonLoader />}
              {blockConfirm.isActive ? 'Заблокировать' : 'Разблокировать'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderDeleteConfirmModal() {
    if (!deleteConfirm) return null
    const typeLabels = { hotel: 'отель', department: 'департамент', user: 'пользователя' }
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center animate-danger-pulse">
              <AlertTriangle className="w-7 h-7 text-danger animate-danger-shake" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Удалить {typeLabels[deleteConfirm.type]}?
              </h3>
              <p className="text-sm text-muted-foreground">{deleteConfirm.name}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            {deleteConfirm.type === 'hotel' &&
              'Все департаменты, пользователи и данные будут удалены.'}
            {deleteConfirm.type === 'department' && 'Все пользователи и данные будут удалены.'}
            {deleteConfirm.type === 'user' && 'Это действие нельзя отменить.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              disabled={actionLoading}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-50 flex items-center justify-center gap-2"
              aria-busy={actionLoading}
            >
              {actionLoading ? <ButtonLoader /> : <Trash2 className="w-4 h-4" />}
              Удалить
            </button>
          </div>
        </div>
      </div>
    )
  }
}
