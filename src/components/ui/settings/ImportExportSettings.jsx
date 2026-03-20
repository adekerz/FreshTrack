/**
 * ImportExportSettings - Импорт, экспорт и аналитические отчёты
 * Объединяет: импорт товаров, экспорт данных, интерактивная аналитика
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from '../../../context/LanguageContext'
import { useToast } from '../../../context/ToastContext'
import { useExport } from '../../../hooks/useExport'
import { EXPORT_TYPES } from '../../../config/exportConfig'
import { Loader } from '..'
import { API_BASE_URL, apiFetch } from '../../../services/api'
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  EXPORT_COLUMNS,
} from '../../../utils/exportUtils'
import {
  Upload,
  Download,
  FileSpreadsheet,
  Package,
  History,
  FileText,
  Check,
  AlertCircle,
  RefreshCw,
  FolderTree,
  Tags,
  HeartPulse,
  CalendarClock,
  ClipboardList,
  TrendingUp,
  BarChart3,
  PieChart,
  Layers,
  LayoutDashboard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronUp,
  ChevronDown,
  Minus,
  Filter,
} from 'lucide-react'
import SettingsLayout, { SettingsSection } from './SettingsLayout'

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(d, locale) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale || undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtDateInput(d) {
  return d ? new Date(d).toISOString().split('T')[0] : ''
}

function ago(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return fmtDateInput(d)
}

function today() {
  return fmtDateInput(new Date())
}

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  good: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  critical: 'bg-orange-50 text-orange-700 border border-orange-200',
  today: 'bg-orange-50 text-orange-700 border border-orange-200',
  expired: 'bg-red-50 text-red-700 border border-red-200',
}

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const label = t(`analyticsReports.status.${status}`) || status
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}
    >
      {label}
    </span>
  )
}

// ── Health Ring ───────────────────────────────────────────────────────────────

function HealthRing({ score, size = 56 }) {
  const s = Math.round(Number(score) || 0)
  const color = s >= 80 ? '#059669' : s >= 50 ? '#d97706' : '#dc2626'
  const r = size / 2 - 4
  const circ = 2 * Math.PI * r
  const offset = circ - (s / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={size < 56 ? 9 : 11}
        fontWeight="700"
        fill={color}
      >
        {s}
      </text>
    </svg>
  )
}

// ── Delta Chip ────────────────────────────────────────────────────────────────

function Delta({ value }) {
  const v = Number(value) || 0
  if (v === 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />0
      </span>
    )
  const pos = v > 0
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${pos ? 'text-emerald-600' : 'text-red-500'}`}
    >
      {pos ? (
        <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )}
      {Math.abs(v).toFixed(1)}
    </span>
  )
}

// ── Export Toolbar ────────────────────────────────────────────────────────────

function ExportToolbar({ data, columns, title, filename, disabled, t }) {
  if (!data || data.length === 0) return null
  const cols = typeof columns === 'function' ? columns(t) : columns
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => exportToExcel(data, cols, filename)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Excel
      </button>
      <button
        onClick={() => exportToCSV(data, cols, filename)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        <FileText className="w-3.5 h-3.5" />
        CSV
      </button>
      <button
        onClick={() => exportToPDF(title, data, cols, { subtitle: filename })}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5" />
        PDF
      </button>
    </div>
  )
}

// ── useReport hook ────────────────────────────────────────────────────────────

function useReport(endpoint, params = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v != null && v !== '')
        )
      ).toString()
      const url = `/reports/${endpoint}${qs ? `?${qs}` : ''}`
      const res = await apiFetch(url)
      setData(res.data ?? res)
    } catch (e) {
      setError(e?.message || 'Loading error')
    } finally {
      setLoading(false)
    }
  }, [endpoint, JSON.stringify(params)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, reload: load }
}

// ── Reload button ─────────────────────────────────────────────────────────────

function ReloadBtn({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
    </button>
  )
}

// ── Empty / Error states ──────────────────────────────────────────────────────

function EmptyState({ message }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="w-10 h-10 text-muted-foreground mb-3 opacity-40" />
      <p className="text-sm text-muted-foreground">
        {message || t('analyticsReports.noData')}
      </p>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-8 h-8 text-warning mb-2" />
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-accent underline">
          {t('analyticsReports.retry')}
        </button>
      )}
    </div>
  )
}

// ── Date filter row ───────────────────────────────────────────────────────────

function DateFilter({ from, to, onFromChange, onToChange, onApply, children }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          {t('collectionHistory.from') || 'С'}
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          {t('collectionHistory.to') || 'По'}
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <button
        onClick={onApply}
        className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
      >
        <Filter className="w-3.5 h-3.5" />
        {t('analyticsReports.apply')}
      </button>
      <div className="flex-1 flex items-center justify-end gap-2">
        {children}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS PANELS
// ════════════════════════════════════════════════════════════════════════════

function HealthSummaryPanel() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useReport('health-summary')
  const rows = Array.isArray(data) ? data : []
  const ar = t('analyticsReports.health')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{ar?.description}</p>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.healthSummary}
            title={t('analyticsReports.tabs.health')}
            filename="health_summary"
            t={t}
          />
          <ReloadBtn onClick={reload} loading={loading} />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message={ar?.noData} />
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {ar?.colDept}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colTotal}
                </th>
                <th className="text-center px-3 py-3 font-medium text-emerald-600">
                  {ar?.colGood}
                </th>
                <th className="text-center px-3 py-3 font-medium text-amber-600">
                  {ar?.colWarning}
                </th>
                <th className="text-center px-3 py-3 font-medium text-orange-600">
                  {ar?.colCritical}
                </th>
                <th className="text-center px-3 py-3 font-medium text-red-600">
                  {ar?.colExpired}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colScore}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.department}
                  </td>
                  <td className="text-center px-3 py-3">{row.total_batches}</td>
                  <td className="text-center px-3 py-3 text-emerald-600 font-medium">
                    {row.good}
                  </td>
                  <td className="text-center px-3 py-3 text-amber-600 font-medium">
                    {row.warning}
                  </td>
                  <td className="text-center px-3 py-3 text-orange-600 font-medium">
                    {row.critical}
                  </td>
                  <td className="text-center px-3 py-3 text-red-600 font-medium">
                    {row.expired}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center">
                      <HealthRing score={row.health_score} size={44} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ExpiryForecastPanel() {
  const { t } = useTranslation()
  const [days, setDays] = useState(7)
  const { data, loading, error, reload } = useReport('expiry-forecast', {
    days,
  })
  const rows = Array.isArray(data) ? data : []
  const ar = t('analyticsReports.expiry')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">{ar?.description}</p>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${days === d ? 'bg-accent text-white border-accent' : 'border-border hover:bg-muted'}`}
              >
                {d} {t('analyticsReports.departments.daysUnit')}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.expiryForecast}
            title={`${t('analyticsReports.tabs.expiry')} (${days})`}
            filename="expiry_forecast"
            t={t}
          />
          <ReloadBtn onClick={reload} loading={loading} />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message={ar?.noData} />
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {ar?.colProduct}
                </th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colDept}
                </th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colCategory}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colExpiryDate}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colDaysLeft}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colQty}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colStatus}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.product}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.department || '—'}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.category || '—'}
                  </td>
                  <td className="text-center px-3 py-3">
                    {formatDate(row.expiry_date)}
                  </td>
                  <td className="text-center px-3 py-3 font-medium">
                    {row.days_left}
                  </td>
                  <td className="text-center px-3 py-3">
                    {row.quantity} {row.unit}
                  </td>
                  <td className="text-center px-3 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CollectionActivityPanel() {
  const { t } = useTranslation()
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(today())
  const [applied, setApplied] = useState({ from: ago(30), to: today() })
  const { data, loading, error, reload } = useReport(
    'collection-activity',
    applied
  )
  const rows = Array.isArray(data) ? data : []
  const ar = t('analyticsReports.collections')

  return (
    <div className="space-y-4">
      <DateFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => setApplied({ from, to })}
      >
        <ExportToolbar
          data={rows}
          columns={EXPORT_COLUMNS.collectionActivity}
          title={t('analyticsReports.tabs.collections')}
          filename="collection_activity"
          t={t}
        />
        <ReloadBtn onClick={reload} loading={loading} />
      </DateFilter>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message={ar?.noData} />
      )}

      {!loading && rows.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {rows.length} {t('analyticsReports.records')}
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {ar?.colDate}
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colProduct}
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colDept}
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colCollectedBy}
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colQty}
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colReason}
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colExpiry}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.collected_at)}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">
                      {row.product_name}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.department || '—'}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.collected_by || '—'}
                    </td>
                    <td className="text-center px-3 py-3 font-medium">
                      {row.quantity_collected}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                        {row.collection_reason || '—'}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3 text-muted-foreground">
                      {formatDate(row.expiry_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function DepartmentScorecardPanel() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useReport('department-scorecard')
  const rows = Array.isArray(data) ? data : []
  const ranked = [...rows].sort(
    (a, b) => (Number(b.health_score) || 0) - (Number(a.health_score) || 0)
  )
  const ar = t('analyticsReports.departments')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{ar?.description}</p>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.departmentScorecard}
            title={t('analyticsReports.tabs.departments')}
            filename="department_scorecard"
            t={t}
          />
          <ReloadBtn onClick={reload} loading={loading} />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && ranked.length === 0 && (
        <EmptyState message={ar?.noData} />
      )}

      {!loading && ranked.length > 0 && (
        <div className="space-y-3">
          {ranked.map((row, i) => {
            const score = Number(row.health_score) || 0
            return (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold text-foreground shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {row.department}
                  </p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {row.total_batches} {ar?.batches}
                    </span>
                    <span className="text-xs text-red-500">
                      {row.expired_count} {ar?.expiredLabel} (
                      {row.expiry_rate_pct}%)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ar?.avgDays} {row.avg_days_to_expiry} {ar?.daysUnit}
                    </span>
                    <span className="text-xs text-emerald-600">
                      {row.collections_this_month} {ar?.collectionsLabel}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${score}%`,
                        backgroundColor:
                          score >= 80
                            ? '#059669'
                            : score >= 50
                              ? '#d97706'
                              : '#dc2626',
                      }}
                    />
                  </div>
                </div>
                <HealthRing score={score} size={52} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProductTurnoverPanel() {
  const { t } = useTranslation()
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(today())
  const [applied, setApplied] = useState({ from: ago(30), to: today() })
  const { data, loading, error, reload } = useReport(
    'product-turnover',
    applied
  )
  const rows = Array.isArray(data) ? data : []
  const ar = t('analyticsReports.turnover')

  return (
    <div className="space-y-4">
      <DateFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => setApplied({ from, to })}
      >
        <ExportToolbar
          data={rows}
          columns={EXPORT_COLUMNS.productTurnover}
          title={t('analyticsReports.tabs.turnover')}
          filename="product_turnover"
          t={t}
        />
        <ReloadBtn onClick={reload} loading={loading} />
      </DateFilter>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message={ar?.noData} />
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {ar?.colProduct}
                </th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colCategory}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colBatches}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colStock}
                </th>
                <th className="text-center px-3 py-3 font-medium text-emerald-600">
                  {ar?.colCollected}
                </th>
                <th className="text-center px-3 py-3 font-medium text-red-500">
                  {ar?.colExpired}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colConsumption}
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  {ar?.colTurnover}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {row.product}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {row.category || '—'}
                  </td>
                  <td className="text-center px-3 py-3">{row.total_batches}</td>
                  <td className="text-center px-3 py-3">{row.current_stock}</td>
                  <td className="text-center px-3 py-3 text-emerald-600 font-medium">
                    {row.total_collected}
                  </td>
                  <td className="text-center px-3 py-3 text-red-500 font-medium">
                    {row.expired_batches}
                  </td>
                  <td className="text-center px-3 py-3">
                    {row.consumption_rate_pct != null ? (
                      <span
                        className={
                          Number(row.consumption_rate_pct) >= 80
                            ? 'text-emerald-600 font-medium'
                            : ''
                        }
                      >
                        {row.consumption_rate_pct}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-center px-3 py-3">
                    {row.turnover_ratio ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const REASON_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
]

function CollectionReasonsPanel() {
  const { t } = useTranslation()
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(today())
  const [applied, setApplied] = useState({ from: ago(30), to: today() })
  const { data, loading, error, reload } = useReport(
    'collection-reasons',
    applied
  )
  const rows = Array.isArray(data) ? data : []
  const maxQty = Math.max(...rows.map((r) => Number(r.total_quantity) || 0), 1)
  const ar = t('analyticsReports.reasons')

  return (
    <div className="space-y-4">
      <DateFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => setApplied({ from, to })}
      >
        <ExportToolbar
          data={rows}
          columns={EXPORT_COLUMNS.collectionReasons}
          title={t('analyticsReports.tabs.reasons')}
          filename="collection_reasons"
          t={t}
        />
        <ReloadBtn onClick={reload} loading={loading} />
      </DateFilter>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message={ar?.noData} />
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              {ar?.byQuantity}
            </h3>
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">
                      {row.reason || t('analyticsReports.unspecified')}
                    </span>
                    <span className="text-muted-foreground">
                      {row.total_quantity} ({row.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(Number(row.total_quantity) / maxQty) * 100}%`,
                        backgroundColor:
                          REASON_COLORS[i % REASON_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {ar?.colReason}
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colTransactions}
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colQty}
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    {ar?.colShare}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              REASON_COLORS[i % REASON_COLORS.length],
                          }}
                        />
                        <span className="font-medium text-foreground">
                          {row.reason || t('analyticsReports.unspecified')}
                        </span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-3">
                      {row.transaction_count}
                    </td>
                    <td className="text-center px-3 py-3 font-medium">
                      {row.total_quantity}
                    </td>
                    <td className="text-center px-3 py-3 text-accent font-medium">
                      {row.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const AGE_COLORS = {
  Expired: '#ef4444',
  '0-2 days': '#f97316',
  '3-7 days': '#f59e0b',
  '8-30 days': '#3b82f6',
  '31-90 days': '#10b981',
  '90+ days': '#6b7280',
}

function translateAgeRange(range, t) {
  const map = {
    Expired: t?.('analyticsReports.ageRanges.expired') || 'Просрочено',
    '0-2 days': t?.('analyticsReports.ageRanges.0_2days') || '0-2 дня',
    '3-7 days': t?.('analyticsReports.ageRanges.3_7days') || '3-7 дней',
    '8-30 days': t?.('analyticsReports.ageRanges.8_30days') || '8-30 дней',
    '31-90 days': t?.('analyticsReports.ageRanges.31_90days') || '31-90 дней',
    '90+ days': t?.('analyticsReports.ageRanges.90plus') || '90+ дней',
  }
  return map[range] || range
}

function BatchAgePanel() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useReport('batch-age-distribution')
  const rows = Array.isArray(data) ? data : []
  const maxCount = Math.max(...rows.map((r) => Number(r.batch_count) || 0), 1)
  const ar = t('analyticsReports.batchAge')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{ar?.description}</p>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.batchAgeDistribution}
            title={t('analyticsReports.tabs.batchAge')}
            filename="batch_age_distribution"
            t={t}
          />
          <ReloadBtn onClick={reload} loading={loading} />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message={ar?.noData} />
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              {ar?.byBatchCount}
            </h3>
            <div className="space-y-4">
              {rows.map((row, i) => {
                const color = AGE_COLORS[row.age_range] || '#6b7280'
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium" style={{ color }}>
                        {translateAgeRange(row.age_range, t)}
                      </span>
                      <span className="text-muted-foreground">
                        {row.batch_count} {ar?.batchesUnit} · {row.percentage}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(Number(row.batch_count) / maxCount) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.total_quantity} {ar?.unitsLabel}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 content-start">
            {rows.map((row, i) => {
              const color = AGE_COLORS[row.age_range] || '#6b7280'
              return (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-4 space-y-1"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <p className="text-xs font-medium" style={{ color }}>
                    {translateAgeRange(row.age_range, t)}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {row.batch_count}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.percentage}% · {row.total_quantity}{' '}
                    {
                      t('analyticsReports.batchAge.unitsLabel')
                        ?.split(' ')
                        .slice(-1)[0]
                    }
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function WeeklySummaryPanel() {
  const { t } = useTranslation()
  const { data, loading, error, reload } = useReport('weekly-summary')
  const summary =
    data && typeof data === 'object' && !Array.isArray(data)
      ? data
      : Array.isArray(data)
        ? data[0]
        : null
  const ar = t('analyticsReports.weekly')

  const kpiCards = summary
    ? [
        {
          label: ar?.totalBatches,
          value: summary.total_batches,
          icon: Layers,
          color: 'text-foreground',
        },
        {
          label: ar?.good,
          value: summary.good,
          icon: CheckCircle,
          color: 'text-emerald-600',
        },
        {
          label: ar?.expired,
          value: summary.expired,
          icon: XCircle,
          color: 'text-red-500',
        },
        {
          label: ar?.healthScore,
          value: summary.health_score,
          icon: HeartPulse,
          color: 'text-accent',
          delta: summary.health_delta,
          isScore: true,
        },
        {
          label: ar?.weeklyCollections,
          value: summary.collections,
          icon: ClipboardList,
          color: 'text-blue-500',
        },
        {
          label: ar?.collectedQty,
          value: summary.collected_qty,
          icon: TrendingUp,
          color: 'text-emerald-600',
        },
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{ar?.description}</p>
        <ReloadBtn onClick={reload} loading={loading} />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !summary && <EmptyState message={ar?.noData} />}

      {!loading && summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {kpiCards.map((card, i) => {
              const Icon = card.icon
              return (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {card.label}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xl font-bold ${card.color}`}>
                        {card.isScore ? (
                          <HealthRing score={card.value} size={36} />
                        ) : (
                          (card.value ?? '—')
                        )}
                      </p>
                      {card.delta != null && <Delta value={card.delta} />}
                    </div>
                    {card.isScore && summary.prev_health_score != null && (
                      <p className="text-xs text-muted-foreground">
                        {ar?.prev} {summary.prev_health_score}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {summary.prev_health_score != null && (
            <div className="bg-muted/30 rounded-xl p-4 border border-border">
              <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                {ar?.healthChanged}{' '}
                <strong>
                  <Delta value={summary.health_delta} />
                </strong>{' '}
                {ar?.compared}({ar?.was}: {summary.prev_health_score},{' '}
                {ar?.became}: {summary.health_score})
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Analytics Tabs config ─────────────────────────────────────────────────────

const ANALYTICS_TABS = [
  { id: 'health', icon: HeartPulse, panel: HealthSummaryPanel },
  { id: 'expiry', icon: CalendarClock, panel: ExpiryForecastPanel },
  { id: 'collections', icon: ClipboardList, panel: CollectionActivityPanel },
  { id: 'departments', icon: BarChart3, panel: DepartmentScorecardPanel },
  { id: 'turnover', icon: TrendingUp, panel: ProductTurnoverPanel },
  { id: 'reasons', icon: PieChart, panel: CollectionReasonsPanel },
  { id: 'batchAge', icon: Layers, panel: BatchAgePanel },
  { id: 'weekly', icon: LayoutDashboard, panel: WeeklySummaryPanel },
]

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function ImportExportSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { exportData, exporting: exportingType } = useExport()
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  const [activeTab, setActiveTab] = useState('health')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const response = await fetch(`${API_BASE_URL}/import/batches`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const result = await response.json()
      setImportResult({
        success: response.ok,
        message:
          result.message ||
          (response.ok ? t('import.success') : t('import.error')),
        imported: result.imported,
        errors: result.errors,
      })
      addToast(
        t(response.ok ? 'toast.importSuccess' : 'toast.importError'),
        response.ok ? 'success' : 'error'
      )
    } catch (error) {
      setImportResult({
        success: false,
        message: t('import.error') || 'Ошибка импорта',
        errors: [error.message],
      })
      addToast(t('toast.importError'), 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const exportIcons = {
    inventory: Package,
    batches: FileSpreadsheet,
    collections: History,
    audit: FileText,
    products: Package,
    categories: Tags,
    departments: FolderTree,
  }

  const exportOptions = Object.values(EXPORT_TYPES)
    .filter((type) => !type.isReport)
    .map((type) => ({
      type: type.id,
      icon: exportIcons[type.id] || FileText,
      label: type.title,
      desc: type.subtitle,
    }))

  const activeTabConfig =
    ANALYTICS_TABS.find((tab) => tab.id === activeTab) || ANALYTICS_TABS[0]
  const ActivePanel = activeTabConfig.panel

  return (
    <SettingsLayout
      title={t('settings.importExport.title') || 'Импорт/Экспорт'}
      description={t('import.description') || 'Массовые операции с данными'}
      icon={RefreshCw}
    >
      {/* ── Импорт ── */}
      <SettingsSection
        title={t('import.title') || 'Импорт данных'}
        icon={Upload}
      >
        <div className="space-y-3 sm:space-y-4">
          <div
            className={`border-2 border-dashed border-border rounded-xl text-center hover:border-accent/50 transition-colors ${isMobile ? 'p-6' : 'p-8'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <label htmlFor="import-file" className="cursor-pointer">
              <div
                className={`mx-auto mb-3 sm:mb-4 bg-muted rounded-full flex items-center justify-center ${isMobile ? 'w-14 h-14' : 'w-16 h-16'}`}
              >
                {importing ? (
                  <Loader size="medium" />
                ) : (
                  <FileSpreadsheet
                    className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} text-accent`}
                  />
                )}
              </div>
              <p
                className={`text-foreground font-medium mb-1 ${isMobile ? 'text-sm' : 'text-base'}`}
              >
                {importing ? t('import.processing') : t('import.selectFile')}
              </p>
              <p
                className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}
              >
                {t('import.formats')}: Excel (.xlsx, .xls), CSV
              </p>
            </label>
          </div>
          <a
            href="/templates/import-template.xlsx"
            download
            className={`inline-flex items-center gap-2 text-accent hover:underline ${isMobile ? 'text-xs' : 'text-sm'}`}
          >
            <Download className="w-4 h-4" />
            {t('import.downloadTemplate')}
          </a>
        </div>

        {importResult && (
          <div
            className={`mt-4 sm:mt-6 rounded-lg ${isMobile ? 'p-3' : 'p-4'} ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              {importResult.success ? (
                <Check
                  className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-green-600 shrink-0 mt-0.5`}
                />
              ) : (
                <AlertCircle
                  className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-600 shrink-0 mt-0.5`}
                />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`${isMobile ? 'text-sm' : 'text-base'} ${importResult.success ? 'text-green-800' : 'text-red-800'}`}
                >
                  {importResult.message}
                </p>
                {importResult.imported !== undefined && (
                  <p
                    className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-700 mt-1`}
                  >
                    {t('import.imported')}: {importResult.imported}
                  </p>
                )}
                {importResult.errors?.length > 0 && (
                  <ul
                    className={`${isMobile ? 'text-xs' : 'text-sm'} text-red-600 mt-2 space-y-1`}
                  >
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="break-words">
                        • {err}
                      </li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>
                        {t('import.moreErrors', {
                          count: importResult.errors.length - 5,
                        })}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* ── Экспорт данных ── */}
      <SettingsSection
        title={t('export.title') || 'Экспорт данных'}
        icon={Download}
      >
        <div className="space-y-3 sm:space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t('export.description')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {exportOptions.map(({ type, icon: Icon, label, desc }) => (
              <button
                key={type}
                onClick={() => exportData(type, 'excel')}
                disabled={exportingType === type}
                className={`flex items-start gap-3 sm:gap-4 border border-border rounded-xl hover:border-accent hover:bg-accent/5 active:bg-accent/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group ${isMobile ? 'p-3' : 'p-4'}`}
              >
                <div
                  className={`bg-muted rounded-lg flex items-center justify-center shrink-0 group-hover:bg-accent/10 transition-colors ${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}
                >
                  {exportingType === type ? (
                    <Loader size="medium" />
                  ) : (
                    <Icon
                      className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-foreground group-hover:text-accent transition-colors`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-foreground group-hover:text-accent transition-colors ${isMobile ? 'text-sm' : 'text-base'}`}
                  >
                    {label}
                  </p>
                  <p
                    className={`text-muted-foreground mt-0.5 ${isMobile ? 'text-xs line-clamp-1' : 'text-sm'}`}
                  >
                    {desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* ── Аналитические отчёты ── */}
      <SettingsSection
        title={t('export.reportsTitle') || 'Аналитические отчёты'}
        icon={BarChart3}
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t('export.reportsDescription')}
          </p>

          {/* Tab bar */}
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-max min-w-full sm:min-w-0">
              {ANALYTICS_TABS.map((tab) => {
                const Icon = tab.icon
                const active = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      active
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {t(`analyticsReports.tabs.${tab.id}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active panel */}
          <div className="bg-card border border-border rounded-2xl p-5 min-h-[300px]">
            <ActivePanel key={activeTab} />
          </div>
        </div>
      </SettingsSection>
    </SettingsLayout>
  )
}
