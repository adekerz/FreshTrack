/**
 * Collection History Page - История сборов
 * Страница для просмотра истории сборов товаров (только для admin)
 */

import { useState, useMemo } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { useDepartment } from '../context/DepartmentContext'
import { useHotel } from '../context/HotelContext'
import { SkeletonTable } from '../components/Skeleton'
import { Navigate } from 'react-router-dom'
import { Filter, RefreshCw, ChevronLeft, ChevronRight, ArchiveX, User, Package } from 'lucide-react'
import { useCollectionHistory, useCollectionStats } from '../hooks/useCollectionHistory'
import { formatDate } from '../utils/dateUtils'
import ExportButton from '../components/ExportButton'
import PageContainer from '../components/PageContainer'
import AnimatedPage from '../components/AnimatedPage'
import { AnimatedStack } from '../components/AnimatedList'
import EmptyState from '../components/EmptyState'
import ExportProgress from '../components/ExportProgress'
import { useExport } from '../hooks/useExport'

// Причины сбора (синхронизировано с CollectionService.CollectionReason)
const REASONS = {
  // Основные причины (новые)
  expired: { label: 'collectionHistory.reasons.expired', color: 'bg-red-100 text-red-800' },
  kitchen: { label: 'collectionHistory.reasons.kitchen', color: 'bg-green-100 text-green-800' },
  damaged: { label: 'collectionHistory.reasons.damaged', color: 'bg-orange-100 text-orange-800' },
  return: { label: 'collectionHistory.reasons.return', color: 'bg-blue-100 text-blue-800' },
  compliment: {
    label: 'collectionHistory.reasons.compliment',
    color: 'bg-purple-100 text-purple-800'
  },
  other: { label: 'collectionHistory.reasons.other', color: 'bg-gray-100 text-gray-800' },
  // Legacy reasons (для совместимости со старыми записями)
  consumption: {
    label: 'collectionHistory.reasons.consumption',
    color: 'bg-green-100 text-green-800'
  },
  minibar: { label: 'collectionHistory.reasons.minibar', color: 'bg-blue-100 text-blue-800' },
  sale: { label: 'collectionHistory.reasons.sale', color: 'bg-purple-100 text-purple-800' },
  manual: { label: 'collectionHistory.reasons.manual', color: 'bg-blue-100 text-blue-800' },
  disposed: { label: 'collectionHistory.reasons.disposed', color: 'bg-yellow-100 text-yellow-800' },
  staff: { label: 'collectionHistory.reasons.staff', color: 'bg-purple-100 text-purple-800' },
  returned: { label: 'collectionHistory.reasons.returned', color: 'bg-cyan-100 text-cyan-800' }
}

export default function CollectionHistoryPage() {
  const { t } = useTranslation()
  const { isHotelAdmin, hasPermission } = useAuth()
  const { departments, selectedDepartmentId } = useDepartment()
  const { selectedHotelId } = useHotel()
  const { exportProgress, dismissExportProgress } = useExport()
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    reason: '',
    startDate: '',
    endDate: ''
  })
  const [appliedFilters, setAppliedFilters] = useState({})
  const [page, setPage] = useState(1)

  // React Query hooks — мemoize queryFilters чтобы избежать лишних refetch
  const queryFilters = useMemo(() => ({
    limit: 20,
    offset: (page - 1) * 20,
    ...(selectedDepartmentId && { departmentId: selectedDepartmentId }),
    ...appliedFilters
  }), [page, selectedDepartmentId, appliedFilters])

  const { data: historyData, isLoading, isFetching, refetch: refetchHistory } = useCollectionHistory(selectedHotelId, queryFilters)
  const { data: stats = { today: 0, week: 0, month: 0, total: 0 }, refetch: refetchStats } = useCollectionStats(selectedHotelId)

  const logs = historyData?.history || []
  const loading = isFetching
  const total = historyData?.count || 0
  const totalPages = Math.ceil(total / 20) || 1

  // Проверка прав доступа (permission-based)
  const canAccessPage = isHotelAdmin() || hasPermission('collections:read')
  if (!canAccessPage) {
    return <Navigate to="/" replace />
  }

  // Применение фильтров
  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters })
    setPage(1)
    setShowFilters(false)
  }

  // Сброс фильтров
  const handleResetFilters = () => {
    setFilters({ reason: '', startDate: '', endDate: '' })
    setAppliedFilters({})
    setPage(1)
    setShowFilters(false)
  }

  // Получение причины
  const getReason = (reason) => {
    return REASONS[reason] || REASONS.other
  }

  const hasActiveFilters =
    appliedFilters.reason ||
    appliedFilters.startDate ||
    appliedFilters.endDate

  return (
    <AnimatedPage>
      <PageContainer
        title={t('collectionHistory.title')}
        subtitle={t('collectionHistory.subtitle')}
        stickyHeader={true}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <ExportButton
              exportType="collections"
              filters={appliedFilters}
              formats={['excel', 'csv', 'pdf']}
              showFilterCount={true}
              size="sm"
              compact={true}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border rounded-lg text-xs sm:text-sm transition-colors min-h-[44px] sm:min-h-0 ${hasActiveFilters
                ? 'border-accent text-accent bg-accent/5'
                : 'border-border text-muted-foreground hover:bg-muted'
                }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{t('collectionHistory.filters')}</span>
              {hasActiveFilters && <span className="w-2 h-2 bg-accent rounded-full" />}
            </button>
            <button
              onClick={() => {
                refetchHistory()
                refetchStats()
              }}
              disabled={loading}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-foreground text-background rounded-lg text-xs sm:text-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 min-h-[44px] sm:min-h-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 sm:space-y-6">
          {/* Статистика - Bento Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('collectionHistory.stats.today')}
              </p>
              <p className="text-xl sm:text-2xl font-light text-foreground">{stats.today}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('collectionHistory.stats.week')}
              </p>
              <p className="text-xl sm:text-2xl font-light text-foreground">{stats.week}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('collectionHistory.stats.month')}
              </p>
              <p className="text-xl sm:text-2xl font-light text-foreground">{stats.month}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('collectionHistory.stats.total')}
              </p>
              <p className="text-xl sm:text-2xl font-light text-foreground">{stats.total}</p>
            </div>
          </div>

          {/* Панель фильтров */}
          {showFilters && (
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <h3 className="font-medium text-foreground">{t('collectionHistory.filterOptions')}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Причина */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    {t('collectionHistory.filterReason')}
                  </label>
                  <select
                    value={filters.reason}
                    onChange={(e) => setFilters((prev) => ({ ...prev, reason: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-foreground"
                  >
                    <option value="">{t('collectionHistory.allReasons')}</option>
                    {Object.entries(REASONS).map(([key, { label }]) => (
                      <option key={key} value={key}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Дата начала */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    {t('collectionHistory.startDate')}
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-foreground"
                  />
                </div>

                {/* Дата конца */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    {t('collectionHistory.endDate')}
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('common.reset')}
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="px-4 py-2 bg-foreground text-background rounded-lg text-sm hover:opacity-90 transition-colors"
                >
                  {t('common.apply')}
                </button>
              </div>
            </div>
          )}

          {/* Таблица сборов / Карточки на мобильных */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-4 sm:p-6" role="status" aria-live="polite" aria-label={t('common.loading')}>
                <SkeletonTable rows={8} columns={6} />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={ArchiveX}
                title={t('collectionHistory.noLogs') || 'Нет записей о сборах'}
                description={
                  t('collectionHistory.noLogsHint') ||
                  'Здесь будет отображаться история сборов товаров'
                }
              />
            ) : (
              <>
                {/* Мобильный вид - карточки */}
                <AnimatedStack gap="space-y-0" className="sm:hidden divide-y divide-border" staggerDelay={40}>
                  {logs.map((log) => {
                    const reasonInfo = getReason(log.reason)
                    const dept = departments.find((d) => d.id === log.departmentId)
                    const department = dept || { name: log.departmentId || 'N/A', color: '#C4A35A' }

                    return (
                      <div key={log.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium text-foreground truncate">
                              {log.productName}
                            </span>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${reasonInfo.color}`}
                          >
                            {t(reasonInfo.label)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${department.color}20`,
                              color: department.color
                            }}
                          >
                            {department.name}
                          </span>
                          <span>
                            {log.quantity} {t('inventory.units')}
                          </span>
                          <span>•</span>
                          <span>{formatDate(log.collectedAt, true)}</span>
                        </div>

                        {log.comment && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{log.comment}</p>
                        )}

                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          {log.collectedByName || t('collectionHistory.system')}
                        </div>
                      </div>
                    )
                  })}
                </AnimatedStack>

                {/* Десктопный вид - таблица */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t('collectionHistory.columns.date')}
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t('collectionHistory.columns.product')}
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                          {t('collectionHistory.columns.department')}
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t('collectionHistory.columns.quantity')}
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                          {t('collectionHistory.columns.expiryDate')}
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {t('collectionHistory.columns.reason')}
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                          {t('collectionHistory.columns.comment')}
                        </th>
                        <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                          {t('collectionHistory.columns.collectedBy')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logs.map((log) => {
                        const reasonInfo = getReason(log.reason)
                        const dept = departments.find((d) => d.id === log.departmentId)
                        const department = dept || { name: log.departmentId || 'N/A', color: '#C4A35A' }

                        return (
                          <tr key={log.id} className="hover:bg-muted transition-colors">
                            <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-foreground">
                              {formatDate(log.collectedAt, true)}
                            </td>
                            <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs lg:text-sm text-foreground font-medium">
                                  {log.productName}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap hidden md:table-cell">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${department.color}20`,
                                  color: department.color
                                }}
                              >
                                {department.name}
                              </span>
                            </td>
                            <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-foreground">
                              {log.quantity} {t('inventory.units')}
                            </td>
                            <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-xs lg:text-sm text-foreground hidden lg:table-cell">
                              {formatDate(log.expiryDate, false)}
                            </td>
                            <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${reasonInfo.color}`}
                              >
                                {t(reasonInfo.label)}
                              </span>
                            </td>
                            <td
                              className="px-4 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm text-muted-foreground max-w-xs truncate hidden xl:table-cell"
                              title={log.comment || ''}
                            >
                              {log.comment || '-'}
                            </td>
                            <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap hidden lg:table-cell">
                              <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground">
                                <User className="w-4 h-4" />
                                {log.collectedByName || t('collectionHistory.system')}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Пагинация */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-border">
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                      {t('collectionHistory.showing', {
                        from: (page - 1) * 20 + 1,
                        to: Math.min(page * 20, total),
                        total
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      {page} / {totalPages}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page <= 1}
                        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <span className="text-sm text-foreground hidden sm:inline">
                        {page} / {totalPages}
                      </span>

                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= totalPages}
                        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Export Progress Notification */}
        {exportProgress.status && (
          <ExportProgress
            status={exportProgress.status}
            filename={exportProgress.filename}
            onDismiss={dismissExportProgress}
          />
        )}
      </PageContainer>
    </AnimatedPage>
  )
}
