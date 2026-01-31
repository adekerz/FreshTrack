import { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  ToggleLeft,
  ToggleRight,
  Building2,
  UserCog
} from 'lucide-react'
import { useTranslation } from '../../../context/LanguageContext'
import { useAuth } from '../../../context/AuthContext'
import { cn } from '../../../utils/classNames'
import { formatDate } from '../../../utils/dateUtils'
import { apiFetch, API_BASE_URL } from '../../../services/api'
import ExportButton from '../../ExportButton'
import { useToast } from '../../../context/ToastContext'

const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  HOTEL_ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MANAGER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DEPARTMENT_MANAGER: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  STAFF: 'bg-muted text-muted-foreground'
}

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  HOTEL_ADMIN: 'Hotel Admin',
  MANAGER: 'Manager',
  DEPARTMENT_MANAGER: 'Dept Manager',
  STAFF: 'Staff'
}

/**
 * AccountsSettings - компонент для вкладки "Аккаунты" в настройках
 * Используется в SettingsPage для управления пользователями
 */
export default function AccountsSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { user: currentUser, isSuperAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    hotelId: '',
    role: '',
    isActive: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  const [showFilters, setShowFilters] = useState(false)
  const [hotels, setHotels] = useState([])
  const [toggling, setToggling] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  useEffect(() => {
    loadUsers()
    if (isSuperAdmin()) {
      loadHotels()
    }
  }, [filters, pagination.page])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(filters.hotelId && { hotelId: filters.hotelId }),
        ...(filters.role && { role: filters.role }),
        ...(filters.isActive !== '' && { isActive: filters.isActive })
      })

      const data = await apiFetch(`/auth/users?${params}`)
      setUsers(data.users || [])
      setPagination((prev) => ({
        ...prev,
        total: data.total ?? 0
      }))
    } catch {
      setUsers([])
      addToast(t('accounts.loadError') || 'Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadHotels = async () => {
    try {
      const data = await apiFetch('/hotels')
      setHotels(data.hotels || [])
    } catch {
      setHotels([])
    }
  }

  const handleToggleStatus = async (userId) => {
    setToggling(userId)
    try {
      const data = await apiFetch(`/auth/users/${userId}/toggle`, { method: 'PATCH' })
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_active: data.isActive } : u
        )
      )
      addToast(
        data.isActive
          ? t('accounts.activated') || 'User activated'
          : t('accounts.deactivated') || 'User deactivated',
        'success'
      )
    } catch (error) {
      addToast(error.message || t('accounts.toggleError') || 'Failed to toggle status', 'error')
    } finally {
      setToggling(null)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination((prev) => ({ ...prev, page: 1 }))
    loadUsers()
  }

  const resetFilters = () => {
    setFilters({
      hotelId: '',
      role: '',
      isActive: ''
    })
    setSearchQuery('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const params = new URLSearchParams()
      params.set('format', 'pdf')
      if (searchQuery) params.set('search', searchQuery)
      if (filters.hotelId) params.set('hotelId', filters.hotelId)
      if (filters.role) params.set('role', filters.role)
      if (filters.isActive !== '') params.set('isActive', filters.isActive)

      const token = localStorage.getItem('freshtrack_token')
      const url = `${API_BASE_URL}/auth/users/export?${params}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const blob = await res.blob()
      const filename = `users_export_${Date.now()}.pdf`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
      addToast(t('toast.exportSuccess') || 'Export successful', 'success')
    } catch (err) {
      addToast(err.message || t('toast.exportError') || 'Export failed', 'error')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      const params = new URLSearchParams()
      params.set('format', 'xlsx')
      if (searchQuery) params.set('search', searchQuery)
      if (filters.hotelId) params.set('hotelId', filters.hotelId)
      if (filters.role) params.set('role', filters.role)
      if (filters.isActive !== '') params.set('isActive', filters.isActive)

      const token = localStorage.getItem('freshtrack_token')
      const url = `${API_BASE_URL}/auth/users/export?${params}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const blob = await res.blob()
      const filename = `users_export_${Date.now()}.xlsx`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
      addToast(t('toast.exportSuccess') || 'Export successful', 'success')
    } catch (err) {
      addToast(err.message || t('toast.exportError') || 'Export failed', 'error')
    } finally {
      setExportingExcel(false)
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)
  const hasActiveFilters =
    filters.hotelId || filters.role || filters.isActive !== '' || searchQuery
  const activeFiltersCount = [
    filters.hotelId,
    filters.role,
    filters.isActive !== '' && filters.isActive
  ].filter(Boolean).length

  const exportData = users.map((user) => ({
    name: user.name,
    login: user.login,
    email: user.email || '',
    role: ROLE_LABELS[user.role] || user.role,
    hotel: user.hotel?.name || '',
    department: user.department?.name || '',
    status: user.is_active ? 'Active' : 'Inactive',
    lastLogin: user.lastLogin ? formatDate(user.lastLogin, true) : '',
    createdAt: formatDate(user.createdAt)
  }))

  const exportColumns = [
    { key: 'name', header: t('accounts.table.name') || 'Name' },
    { key: 'login', header: t('accounts.table.login') || 'Login' },
    { key: 'email', header: t('accounts.table.email') || 'Email' },
    { key: 'role', header: t('accounts.table.role') || 'Role' },
    { key: 'hotel', header: t('accounts.table.hotel') || 'Hotel' },
    { key: 'department', header: t('accounts.table.department') || 'Department' },
    { key: 'status', header: t('accounts.table.status') || 'Status' },
    { key: 'lastLogin', header: t('accounts.table.lastLogin') || 'Last Login' },
    { key: 'createdAt', header: t('accounts.table.createdAt') || 'Created' }
  ]

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">
            {t('accounts.title') || 'User Accounts'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('accounts.subtitle') || 'Manage user accounts and access'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPagination((prev) => ({ ...prev, page: 1 }))
              loadUsers()
            }}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <ExportButton
            data={exportData}
            columns={exportColumns}
            filename="users_export"
            title={t('accounts.title') || 'User Accounts'}
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportExcel}
            exportingPdf={exportingPdf}
            exportingExcel={exportingExcel}
            exportRecordCount={pagination.total}
          />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-muted/50 rounded-lg border border-border p-3">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('accounts.searchPlaceholder') || 'Search by name, login, email...'}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              aria-label={t('common.search')}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm"
            >
              {t('common.search') || 'Search'}
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm',
                showFilters || activeFiltersCount > 0
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              <Filter className="w-4 h-4" />
              {t('common.filters') || 'Filters'}
              {activeFiltersCount > 0 && (
                <span className="ml-1 w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-2 px-4 py-2 text-danger hover:bg-danger/10 rounded-lg text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                {t('common.reset') || 'Reset'}
              </button>
            )}
          </div>
        </form>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSuperAdmin() && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('accounts.filters.hotel') || 'Hotel'}
                </label>
                <select
                  value={filters.hotelId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, hotelId: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">{t('common.all') || 'All'}</option>
                  {hotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('accounts.filters.role') || 'Role'}
              </label>
              <select
                value={filters.role}
                onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all') || 'All'}</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="HOTEL_ADMIN">Hotel Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="DEPARTMENT_MANAGER">Department Manager</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('accounts.filters.status') || 'Status'}
              </label>
              <select
                value={filters.isActive}
                onChange={(e) => setFilters((prev) => ({ ...prev, isActive: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all') || 'All'}</option>
                <option value="true">{t('accounts.active') || 'Active'}</option>
                <option value="false">{t('accounts.inactive') || 'Inactive'}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        {t('accounts.totalRecords', { count: pagination.total }) || `Total: ${pagination.total}`}
      </div>

      {/* Users Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('accounts.noUsers') || 'No users found'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('accounts.table.name') || 'Name'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('accounts.table.login') || 'Login'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('accounts.table.email') || 'Email'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('accounts.table.role') || 'Role'}
                    </th>
                    {isSuperAdmin() && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {t('accounts.table.hotel') || 'Hotel'}
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('accounts.table.status') || 'Status'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('accounts.table.lastLogin') || 'Last Login'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                      {t('common.actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserCog className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{user.login}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{user.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                            ROLE_COLORS[user.role] || ROLE_COLORS.STAFF
                          )}
                        >
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      {isSuperAdmin() && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">
                              {user.hotel?.name || '—'}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                            user.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          )}
                        >
                          {user.is_active
                            ? t('accounts.active') || 'Active'
                            : t('accounts.inactive') || 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {user.lastLogin ? formatDate(user.lastLogin, true) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.id !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user.id)}
                            disabled={toggling === user.id}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors mx-auto flex items-center justify-center',
                              user.is_active
                                ? 'hover:bg-red-100 text-red-600 dark:hover:bg-red-900/30'
                                : 'hover:bg-green-100 text-green-600 dark:hover:bg-green-900/30',
                              toggling === user.id && 'opacity-50 cursor-not-allowed'
                            )}
                            title={
                              user.is_active
                                ? t('accounts.action.deactivate') || 'Deactivate'
                                : t('accounts.action.activate') || 'Activate'
                            }
                          >
                            {toggling === user.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : user.is_active ? (
                              <ToggleRight className="w-5 h-5" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border bg-card">
              {users.map((user) => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{user.name}</span>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                        user.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {user.is_active ? t('accounts.active') || 'Active' : t('accounts.inactive') || 'Inactive'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                        ROLE_COLORS[user.role] || ROLE_COLORS.STAFF
                      )}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                    {isSuperAdmin() && user.hotel?.name && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {user.hotel.name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span>{user.login}</span>
                    {user.email && <span className="ml-2">{user.email}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {user.lastLogin
                        ? formatDate(user.lastLogin, true)
                        : t('accounts.neverLoggedIn') || 'Never logged in'}
                    </span>
                    {user.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(user.id)}
                        disabled={toggling === user.id}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm transition-colors',
                          user.is_active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50',
                          toggling === user.id && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {toggling === user.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : user.is_active ? (
                          t('accounts.action.deactivate') || 'Deactivate'
                        ) : (
                          t('accounts.action.activate') || 'Activate'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
            <div className="text-sm text-muted-foreground">
              {(pagination.page - 1) * pagination.limit + 1}—{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} {t('common.of') || 'of'}{' '}
              {pagination.total}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('common.back') || 'Previous'}
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(totalPages, prev.page + 1)
                  }))
                }
                disabled={pagination.page === totalPages}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={t('common.next') || 'Next'}
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
