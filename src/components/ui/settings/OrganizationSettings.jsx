/**
 * OrganizationSettings - Объединённое управление отелями, департаментами и пользователями
 * Для SUPER_ADMIN: полное управление всей структурой
 * Для HOTEL_ADMIN: управление пользователями своего отеля
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { apiFetch } from '../../../services/api'
// formatDate removed - unused import
import { ButtonLoader, SectionLoader } from '..'
import {
  Building2,
  Plus,
  Users,
  UserPlus,
  Ban,
  AlertTriangle,
  Trash2,
  RefreshCw
} from 'lucide-react'
import SettingsLayout from './SettingsLayout'
import {
  UserRow,
  HotelCard,
  DepartmentsList,
  CreateHotelModal,
  CreateDepartmentModal,
  CreateUserModal
} from './organization'

/** Конвертация названия страны → ISO код для detect-timezone */
function getCountryCodeFromName(countryName) {
  if (!countryName || typeof countryName !== 'string') return null
  const name = countryName.trim()
  const map = {
    Kazakhstan: 'KZ', 'United Kingdom': 'GB', France: 'FR', Germany: 'DE',
    Spain: 'ES', Italy: 'IT', Netherlands: 'NL', Belgium: 'BE', Austria: 'AT',
    Switzerland: 'CH', Portugal: 'PT', 'Czech Republic': 'CZ', Poland: 'PL',
    Greece: 'GR', Turkey: 'TR', Sweden: 'SE', Denmark: 'DK', Norway: 'NO',
    Finland: 'FI', UAE: 'AE', 'Saudi Arabia': 'SA', Qatar: 'QA', Kuwait: 'KW',
    Bahrain: 'BH', Oman: 'OM', Jordan: 'JO', Israel: 'IL', Egypt: 'EG',
    'South Africa': 'ZA', Morocco: 'MA', Kenya: 'KE', Nigeria: 'NG', Ghana: 'GH',
    Australia: 'AU', 'New Zealand': 'NZ', USA: 'US', 'United States': 'US'
  }
  return map[name] || null
}

export default function OrganizationSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { user: currentUser } = useAuth()

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const [hotels, setHotels] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedHotels, setExpandedHotels] = useState({})
  const [expandedDepts, setExpandedDepts] = useState({})

  // Create hotel modal
  const [showCreateHotel, setShowCreateHotel] = useState(false)
  const [newHotel, setNewHotel] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    country: '',
    timezone: 'Asia/Qostanay',
    latitude: null,
    longitude: null,
    timezone_auto_detected: false,
    marsha_code: '',
    marsha_code_id: null
  })
  const [_timezoneDetected, setTimezoneDetected] = useState(false)
  const [_creatingHotel, setCreatingHotel] = useState(false)

  // Create department modal
  const [showCreateDept, setShowCreateDept] = useState(null) // hotelId
  const [newDept, setNewDept] = useState({ name: '', description: '', email: '', telegram_chat_id: '' })
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
  const [_showPassword, setShowPassword] = useState(false)
  const [userError, setUserError] = useState(null)
  const [generatePassword, setGeneratePassword] = useState(true) // Default: auto-generate password

  // Delete/Block confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [blockConfirm, setBlockConfirm] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
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
  }, [isSuperAdmin, addToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

    let timezoneToUse = newHotel.timezone || 'Asia/Qostanay'
    let latToUse = newHotel.latitude ?? null
    let lngToUse = newHotel.longitude ?? null
    let autoDetected = newHotel.timezone_auto_detected

    if (newHotel.country?.trim() === 'Kazakhstan') {
      timezoneToUse = 'Asia/Qostanay'
      autoDetected = true
    } else if (newHotel.city?.trim() && !newHotel.timezone_auto_detected) {
      try {
        const data = await apiFetch('/hotels/detect-timezone', {
          method: 'POST',
          body: JSON.stringify({
            city: newHotel.city.trim(),
            countryCode: getCountryCodeFromName(newHotel.country)
          })
        })
        if (data.success && data.timezone) {
          timezoneToUse = data.timezone
          latToUse = data.coordinates?.lat ?? null
          lngToUse = data.coordinates?.lng ?? null
          autoDetected = true
        }
      } catch {
        // оставляем текущие значения
      }
    }

    setCreatingHotel(true)
    try {
      const hotelData = {
        name: newHotel.name.trim(),
        description: newHotel.description?.trim() || null,
        address: newHotel.address?.trim() || null,
        city: newHotel.city?.trim() || null,
        country: newHotel.country?.trim() || null,
        timezone: timezoneToUse,
        latitude: latToUse,
        longitude: lngToUse,
        timezone_auto_detected: autoDetected,
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
      setNewHotel({
        name: '',
        description: '',
        address: '',
        city: '',
        country: '',
        timezone: 'Asia/Qostanay',
        latitude: null,
        longitude: null,
        timezone_auto_detected: false,
        marsha_code: '',
        marsha_code_id: null
      })
      setTimezoneDetected(false)
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
      setNewDept({ name: '', description: '', email: '', telegram_chat_id: '' })
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
      // На уровне отеля (без departmentId) - HOTEL_ADMIN или SUPER_ADMIN (если выбран)
      // На уровне департамента - выбранная роль (STAFF или DEPARTMENT_MANAGER)
      const effectiveRole = showCreateUser?.departmentId
        ? newUser.role
        : (newUser.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOTEL_ADMIN')

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

      await apiFetch('/auth/users', {
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

  const renderUserRow = (user) => (
    <UserRow
      key={user.id}
      user={user}
      currentUserId={currentUser?.id}
      onResendPassword={resendPassword}
      onToggleStatus={(userId, isActive) =>
        setBlockConfirm({ userId, userName: user.name, isActive })
      }
      onDelete={(userId, userName) =>
        setDeleteConfirm({ type: 'user', id: userId, name: userName })
      }
      getRoleBadge={getRoleBadge}
      t={t}
    />
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
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title={t('common.refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateUser({ hotelId: currentUser?.hotel_id })}
              className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Создать
            </button>
          </div>
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
        <CreateUserModal
          isOpen={!!showCreateUser}
          onClose={() => {
            setShowCreateUser(null)
            setUserError(null)
            setNewUser({ login: '', password: '', name: '', email: '', role: 'STAFF' })
            setGeneratePassword(true)
            setShowPassword(false)
          }}
          onSubmit={createUser}
          formState={newUser}
          setFormState={setNewUser}
          hotels={[]}
          departments={[]}
          hotelId={currentUser?.hotel_id}
          departmentId={null}
          creating={creatingUser}
          error={userError}
          t={t}
          canCreateSuperAdmin={currentUser?.capabilities?.canCreateSuperAdmin || false}
        />
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
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateHotel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать отель
          </button>
        </div>
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
            <HotelCard
              key={hotel.id}
              hotel={hotel}
              isExpanded={expandedHotels[hotel.id]}
              onToggle={() => toggleHotel(hotel.id)}
              onDelete={(id, name) => setDeleteConfirm({ type: 'hotel', id, name })}
              onCopyCode={copyCode}
            >
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
              <DepartmentsList
                departments={hotel.departments}
                hotelId={hotel.id}
                expandedDepts={expandedDepts}
                onToggleDept={toggleDept}
                onAddDepartment={(hotelId) => setShowCreateDept(hotelId)}
                onAddUser={(hotelId, departmentId) =>
                  setShowCreateUser({ hotelId, departmentId })
                }
                onDeleteDepartment={(deptId, deptName, hotelId) =>
                  setDeleteConfirm({ type: 'department', id: deptId, name: deptName, hotelId })
                }
                renderUserRow={renderUserRow}
              />
            </HotelCard>
          ))
        )}
      </div>

      {/* Modals */}
      <CreateHotelModal
        isOpen={showCreateHotel}
        onClose={() => {
          setShowCreateHotel(false)
          setNewHotel({
            name: '',
            description: '',
            address: '',
            city: '',
            country: '',
            timezone: 'Asia/Qostanay',
            latitude: null,
            longitude: null,
            timezone_auto_detected: false,
            marsha_code: '',
            marsha_code_id: null
          })
          setTimezoneDetected(false)
        }}
        onSubmit={createHotel}
        formState={newHotel}
        setFormState={setNewHotel}
        t={t}
      />
      <CreateDepartmentModal
        isOpen={!!showCreateDept}
        onClose={() => {
          setShowCreateDept(null)
          setNewDept({ name: '', description: '', email: '', telegram_chat_id: '' })
        }}
        onSubmit={createDepartment}
        formState={newDept}
        setFormState={setNewDept}
        creating={creatingDept}
      />
      <CreateUserModal
        isOpen={!!showCreateUser}
        onClose={() => {
          setShowCreateUser(null)
          setUserError(null)
          setNewUser({ login: '', password: '', name: '', email: '', role: 'STAFF' })
          setGeneratePassword(true)
          setShowPassword(false)
        }}
        onSubmit={createUser}
        formState={newUser}
        setFormState={setNewUser}
        hotels={hotels}
        departments={hotels.find((h) => h.id === showCreateUser?.hotelId)?.departments}
        hotelId={showCreateUser?.hotelId}
        departmentId={showCreateUser?.departmentId}
        creating={creatingUser}
        error={userError}
        t={t}
        canCreateSuperAdmin={currentUser?.capabilities?.canCreateSuperAdmin || false}
      />
      {renderBlockConfirmModal()}
      {renderDeleteConfirmModal()}
    </SettingsLayout>
  )

  // Modal render functions
  function renderBlockConfirmModal() {
    if (!blockConfirm) return null
    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center animate-danger-pulse ${blockConfirm.isActive ? 'bg-danger/10' : 'bg-success/10'
                }`}
            >
              <Ban
                className={`w-7 h-7 animate-danger-shake ${blockConfirm.isActive ? 'text-danger' : 'text-success'
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
              className={`flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50 flex items-center justify-center gap-2 ${blockConfirm.isActive
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
