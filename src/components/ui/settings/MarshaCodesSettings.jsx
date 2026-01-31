import { useState, useEffect } from 'react'
import {
  Database,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Link,
  Unlink,
  MapPin,
  Globe,
  Tag
} from 'lucide-react'
import { useTranslation } from '../../../context/LanguageContext'
import { cn } from '../../../utils/classNames'
import { formatDate } from '../../../utils/dateUtils'
import { apiFetch, API_BASE_URL } from '../../../services/api'
import ExportButton from '../../ExportButton'
import { useToast } from '../../../context/ToastContext'
import Modal from '../Modal'

/**
 * MarshaCodesSettings - компонент для вкладки "Марша коды" в настройках
 * Используется в SettingsPage для управления MARSHA кодами (только для SUPER_ADMIN)
 */
export default function MarshaCodesSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    country: '',
    region: '',
    brand: '',
    isAssigned: ''
  })
  const [filterOptions, setFilterOptions] = useState({
    countries: [],
    regions: [],
    brands: []
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })
  const [showFilters, setShowFilters] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [selectedCode, setSelectedCode] = useState(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [hotels, setHotels] = useState([])
  const [selectedHotelId, setSelectedHotelId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [releasing, setReleasing] = useState(null)

  useEffect(() => {
    loadCodes()
    loadFilterOptions()
    loadHotels()
  }, [filters, pagination.page])

  const loadCodes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(filters.country && { country: filters.country }),
        ...(filters.region && { region: filters.region }),
        ...(filters.brand && { brand: filters.brand }),
        ...(filters.isAssigned !== '' && { isAssigned: filters.isAssigned })
      })

      const data = await apiFetch(`/marsha-codes/all?${params}`)
      setCodes(data.codes || [])
      setPagination((prev) => ({
        ...prev,
        total: data.total ?? 0
      }))
    } catch (error) {
      setCodes([])
      addToast(error.message || t('marshaCodes.loadError') || 'Failed to load MARSHA codes', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadFilterOptions = async () => {
    try {
      const data = await apiFetch('/marsha-codes/filters')
      setFilterOptions(data.filters || { countries: [], regions: [], brands: [] })
    } catch {
      setFilterOptions({ countries: [], regions: [], brands: [] })
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

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination((prev) => ({ ...prev, page: 1 }))
    loadCodes()
  }

  const resetFilters = () => {
    setFilters({
      country: '',
      region: '',
      brand: '',
      isAssigned: ''
    })
    setSearchQuery('')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleAssign = async () => {
    if (!selectedCode || !selectedHotelId) return

    setAssigning(true)
    try {
      await apiFetch('/marsha-codes/assign', {
        method: 'POST',
        body: JSON.stringify({
          hotelId: selectedHotelId,
          marshaCodeId: selectedCode.id
        })
      })
      addToast(t('marshaCodes.assignSuccess') || 'MARSHA code assigned successfully', 'success')
      setShowAssignModal(false)
      setSelectedCode(null)
      setSelectedHotelId('')
      loadCodes()
    } catch (error) {
      addToast(error.message || t('marshaCodes.assignError') || 'Failed to assign code', 'error')
    } finally {
      setAssigning(false)
    }
  }

  const handleRelease = async (code) => {
    if (!code.assignedHotel?.id) return

    setReleasing(code.id)
    try {
      await apiFetch(`/marsha-codes/release/${code.assignedHotel.id}`, {
        method: 'DELETE'
      })
      addToast(t('marshaCodes.releaseSuccess') || 'MARSHA code released successfully', 'success')
      loadCodes()
    } catch (error) {
      addToast(error.message || t('marshaCodes.releaseError') || 'Failed to release code', 'error')
    } finally {
      setReleasing(null)
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const params = new URLSearchParams()
      params.set('format', 'pdf')
      if (searchQuery) params.set('search', searchQuery)
      if (filters.country) params.set('country', filters.country)
      if (filters.region) params.set('region', filters.region)
      if (filters.brand) params.set('brand', filters.brand)
      if (filters.isAssigned !== '') params.set('isAssigned', filters.isAssigned)

      const token = localStorage.getItem('freshtrack_token')
      const url = `${API_BASE_URL}/marsha-codes/export?${params}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const blob = await res.blob()
      const filename = `marsha_codes_export_${Date.now()}.pdf`
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
      if (filters.country) params.set('country', filters.country)
      if (filters.region) params.set('region', filters.region)
      if (filters.brand) params.set('brand', filters.brand)
      if (filters.isAssigned !== '') params.set('isAssigned', filters.isAssigned)

      const token = localStorage.getItem('freshtrack_token')
      const url = `${API_BASE_URL}/marsha-codes/export?${params}`
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      const blob = await res.blob()
      const filename = `marsha_codes_export_${Date.now()}.xlsx`
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
    filters.country || filters.region || filters.brand || filters.isAssigned !== '' || searchQuery
  const activeFiltersCount = [
    filters.country,
    filters.region,
    filters.brand,
    filters.isAssigned !== '' && filters.isAssigned
  ].filter(Boolean).length

  const exportData = codes.map((code) => ({
    code: code.code,
    hotelName: code.hotelName,
    city: code.city,
    country: code.country,
    region: code.region,
    brand: code.brand,
    isAssigned: code.isAssigned ? 'Yes' : 'No',
    assignedTo: code.assignedHotel?.name || '',
    assignedAt: code.assignedAt ? formatDate(code.assignedAt) : ''
  }))

  const exportColumns = [
    { key: 'code', header: t('marshaCodes.table.code') || 'Code' },
    { key: 'hotelName', header: t('marshaCodes.table.hotelName') || 'Hotel Name' },
    { key: 'city', header: t('marshaCodes.table.city') || 'City' },
    { key: 'country', header: t('marshaCodes.table.country') || 'Country' },
    { key: 'region', header: t('marshaCodes.table.region') || 'Region' },
    { key: 'brand', header: t('marshaCodes.table.brand') || 'Brand' },
    { key: 'isAssigned', header: t('marshaCodes.table.assigned') || 'Assigned' },
    { key: 'assignedTo', header: t('marshaCodes.table.assignedTo') || 'Assigned To' },
    { key: 'assignedAt', header: t('marshaCodes.table.assignedAt') || 'Assigned At' }
  ]

  // Filter hotels that don't have MARSHA code yet for assignment
  const availableHotels = hotels.filter((h) => !h.marsha_code)

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">
            {t('marshaCodes.title') || 'MARSHA Codes Database'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('marshaCodes.subtitle') || 'Marriott property codes management'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPagination((prev) => ({ ...prev, page: 1 }))
              loadCodes()
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
            filename="marsha_codes_export"
            title={t('marshaCodes.title') || 'MARSHA Codes'}
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
              placeholder={t('marshaCodes.searchPlaceholder') || 'Search by code, hotel name, city...'}
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
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('marshaCodes.filters.country') || 'Country'}
              </label>
              <select
                value={filters.country}
                onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all') || 'All'}</option>
                {filterOptions.countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('marshaCodes.filters.region') || 'Region'}
              </label>
              <select
                value={filters.region}
                onChange={(e) => setFilters((prev) => ({ ...prev, region: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all') || 'All'}</option>
                {filterOptions.regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('marshaCodes.filters.brand') || 'Brand'}
              </label>
              <select
                value={filters.brand}
                onChange={(e) => setFilters((prev) => ({ ...prev, brand: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all') || 'All'}</option>
                {filterOptions.brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('marshaCodes.filters.assigned') || 'Assignment Status'}
              </label>
              <select
                value={filters.isAssigned}
                onChange={(e) => setFilters((prev) => ({ ...prev, isAssigned: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('common.all') || 'All'}</option>
                <option value="true">{t('marshaCodes.assigned') || 'Assigned'}</option>
                <option value="false">{t('marshaCodes.available') || 'Available'}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        {t('marshaCodes.totalRecords', { count: pagination.total }) || `Total: ${pagination.total}`}
      </div>

      {/* Codes Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {codes.length === 0 ? (
          <div className="p-8 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('marshaCodes.noCodes') || 'No MARSHA codes found'}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('marshaCodes.table.code') || 'Code'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('marshaCodes.table.hotelName') || 'Hotel Name'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('marshaCodes.table.city') || 'City'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('marshaCodes.table.country') || 'Country'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('marshaCodes.table.brand') || 'Brand'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('marshaCodes.table.assigned') || 'Assigned'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                      {t('common.actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {codes.map((code) => (
                    <tr key={code.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-accent">{code.code}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">
                        {code.hotelName}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-foreground">{code.city}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-foreground">{code.country}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs">
                          <Tag className="w-3 h-3" />
                          {code.brand}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {code.isAssigned ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <Building2 className="w-3 h-3" />
                              {code.assignedHotel?.name || 'Assigned'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            {t('marshaCodes.available') || 'Available'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {code.isAssigned ? (
                          <button
                            type="button"
                            onClick={() => handleRelease(code)}
                            disabled={releasing === code.id}
                            className={cn(
                              'p-1.5 rounded-lg hover:bg-red-100 text-red-600 dark:hover:bg-red-900/30 transition-colors mx-auto flex items-center justify-center',
                              releasing === code.id && 'opacity-50 cursor-not-allowed'
                            )}
                            title={t('marshaCodes.action.release') || 'Release'}
                          >
                            {releasing === code.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlink className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCode(code)
                              setShowAssignModal(true)
                            }}
                            className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 dark:hover:bg-green-900/30 transition-colors mx-auto flex items-center justify-center"
                            title={t('marshaCodes.action.assign') || 'Assign'}
                          >
                            <Link className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-border bg-card">
              {codes.map((code) => (
                <div key={code.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium text-accent text-lg">{code.code}</span>
                    {code.isAssigned ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Building2 className="w-3 h-3" />
                        Assigned
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        Available
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground font-medium line-clamp-2">{code.hotelName}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {code.city}, {code.country}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {code.brand}
                    </span>
                  </div>
                  {code.isAssigned && code.assignedHotel && (
                    <p className="text-xs text-muted-foreground">
                      {t('marshaCodes.assignedTo') || 'Assigned to'}: {code.assignedHotel.name}
                    </p>
                  )}
                  <div className="flex justify-end">
                    {code.isAssigned ? (
                      <button
                        type="button"
                        onClick={() => handleRelease(code)}
                        disabled={releasing === code.id}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 transition-colors',
                          releasing === code.id && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {releasing === code.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          t('marshaCodes.action.release') || 'Release'
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCode(code)
                          setShowAssignModal(true)
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 transition-colors"
                      >
                        {t('marshaCodes.action.assign') || 'Assign'}
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

      {/* Assign Modal */}
      {showAssignModal && selectedCode && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false)
            setSelectedCode(null)
            setSelectedHotelId('')
          }}
          title={t('marshaCodes.assignModal.title') || 'Assign MARSHA Code'}
        >
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">MARSHA Code</p>
              <p className="font-mono font-medium text-accent text-lg">{selectedCode.code}</p>
              <p className="text-sm text-foreground mt-2">{selectedCode.hotelName}</p>
              <p className="text-xs text-muted-foreground">
                {selectedCode.city}, {selectedCode.country}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('marshaCodes.assignModal.selectHotel') || 'Select Hotel'}
              </label>
              <select
                value={selectedHotelId}
                onChange={(e) => setSelectedHotelId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                <option value="">{t('marshaCodes.assignModal.chooseHotel') || 'Choose a hotel...'}</option>
                {availableHotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </select>
              {availableHotels.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t('marshaCodes.assignModal.noAvailableHotels') ||
                    'No hotels available for assignment (all hotels already have MARSHA codes)'}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedCode(null)
                  setSelectedHotelId('')
                }}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedHotelId || assigning}
                className={cn(
                  'px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors',
                  (!selectedHotelId || assigning) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {assigning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  t('marshaCodes.action.assign') || 'Assign'
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
