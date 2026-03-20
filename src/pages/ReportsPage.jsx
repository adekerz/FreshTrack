/**
 * ReportsPage — Professional Analytics Reports
 * Tabs: Health Summary | Expiry Forecast | Collections | Departments | Turnover | Weekly
 *
 * Route: /reports
 */

import { useState, useCallback, useEffect } from 'react'
import { apiFetch } from '../services/api'
import {
  HeartPulse,
  CalendarClock,
  ClipboardList,
  TrendingUp,
  BarChart3,
  PieChart,
  Layers,
  LayoutDashboard,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronUp,
  ChevronDown,
  Minus,
  Filter,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  EXPORT_COLUMNS,
} from '../utils/exportUtils'
import PageContainer from '../components/PageContainer'
import AnimatedPage from '../components/AnimatedPage'
import { Loader } from '../components/ui'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateInput(d) {
  return d ? new Date(d).toISOString().split('T')[0] : ''
}

function ago(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDateInput(d)
}

function today() {
  return formatDateInput(new Date())
}

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  good: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  critical: 'bg-orange-50 text-orange-700 border border-orange-200',
  today: 'bg-orange-50 text-orange-700 border border-orange-200',
  expired: 'bg-red-50 text-red-700 border border-red-200',
}

const STATUS_LABELS = {
  good: 'Хорошо',
  warning: 'Внимание',
  critical: 'Критично',
  today: 'Сегодня',
  expired: 'Просрочено',
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || 'bg-muted text-muted-foreground'}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}

// ── Health Score Ring ─────────────────────────────────────────────────────────

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

// ── Delta Chip ───────────────────────────────────────────────────────────────

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

// ── Export Toolbar ───────────────────────────────────────────────────────────

function ExportToolbar({ data, columns, title, filename, disabled }) {
  if (!data || data.length === 0) return null
  const cols = typeof columns === 'function' ? columns() : columns
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

// ── useReport hook ───────────────────────────────────────────────────────────

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
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [endpoint, JSON.stringify(params)])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, reload: load }
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message = 'Нет данных' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="w-10 h-10 text-muted-foreground mb-3 opacity-40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-8 h-8 text-warning mb-2" />
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-accent underline">
          Повторить
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB PANELS
// ════════════════════════════════════════════════════════════════════════════

// ── Health Summary ───────────────────────────────────────────────────────────

function HealthSummaryPanel() {
  const { data, loading, error, reload } = useReport('health-summary')
  const rows = Array.isArray(data) ? data : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Текущее состояние инвентаря по каждому отделу
        </p>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.healthSummary}
            title="Здоровье инвентаря"
            filename="health_summary"
          />
          <button
            onClick={reload}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="Нет данных об инвентаре" />
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Отдел
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Всего
                </th>
                <th className="text-center px-3 py-3 font-medium text-emerald-600">
                  Хорошие
                </th>
                <th className="text-center px-3 py-3 font-medium text-amber-600">
                  Внимание
                </th>
                <th className="text-center px-3 py-3 font-medium text-orange-600">
                  Критично
                </th>
                <th className="text-center px-3 py-3 font-medium text-red-600">
                  Просрочено
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Health Score
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

// ── Expiry Forecast ──────────────────────────────────────────────────────────

function ExpiryForecastPanel() {
  const [days, setDays] = useState(7)
  const { data, loading, error, reload } = useReport('expiry-forecast', {
    days,
  })
  const rows = Array.isArray(data) ? data : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Товары с истекающим сроком в ближайшие
          </p>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${days === d ? 'bg-accent text-white border-accent' : 'border-border hover:bg-muted'}`}
              >
                {d} дн.
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.expiryForecast}
            title={`Прогноз истечения (${days} дн.)`}
            filename="expiry_forecast"
          />
          <button
            onClick={reload}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="Нет товаров с истекающим сроком" />
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Продукт
                </th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                  Отдел
                </th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                  Категория
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Дата истечения
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Дней
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Кол-во
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Статус
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

// ── Collection Activity ──────────────────────────────────────────────────────

function CollectionActivityPanel() {
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(today())
  const [applied, setApplied] = useState({ from: ago(30), to: today() })

  const { data, loading, error, reload } = useReport(
    'collection-activity',
    applied
  )
  const rows = Array.isArray(data) ? data : []

  const apply = () => setApplied({ from, to })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">С</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">По</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          onClick={apply}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Применить
        </button>
        <div className="flex-1 flex items-center justify-end gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.collectionActivity}
            title="Активность сборов"
            filename="collection_activity"
          />
          <button
            onClick={reload}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="Нет данных о сборах за выбранный период" />
      )}

      {!loading && rows.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{rows.length} записей</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Дата
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    Продукт
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    Отдел
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    Кто собрал
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    Кол-во
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                    Причина
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    Срок годности
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

// ── Department Scorecard ─────────────────────────────────────────────────────

function DepartmentScorecardPanel() {
  const { data, loading, error, reload } = useReport('department-scorecard')
  const rows = Array.isArray(data) ? data : []

  const ranked = [...rows].sort(
    (a, b) => (Number(b.health_score) || 0) - (Number(a.health_score) || 0)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Рейтинг отделов по качеству управления инвентарём
        </p>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.departmentScorecard}
            title="Рейтинг отделов"
            filename="department_scorecard"
          />
          <button
            onClick={reload}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && ranked.length === 0 && (
        <EmptyState message="Нет данных по отделам" />
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
                      {row.total_batches} партий
                    </span>
                    <span className="text-xs text-red-500">
                      {row.expired_count} просрочено ({row.expiry_rate_pct}%)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ср. {row.avg_days_to_expiry} дн.
                    </span>
                    <span className="text-xs text-emerald-600">
                      {row.collections_this_month} сборов
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

// ── Product Turnover ─────────────────────────────────────────────────────────

function ProductTurnoverPanel() {
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(today())
  const [applied, setApplied] = useState({ from: ago(30), to: today() })

  const { data, loading, error, reload } = useReport(
    'product-turnover',
    applied
  )
  const rows = Array.isArray(data) ? data : []

  const apply = () => setApplied({ from, to })

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">С</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">По</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          onClick={apply}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Применить
        </button>
        <div className="flex-1 flex items-center justify-end gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.productTurnover}
            title="Оборот продуктов"
            filename="product_turnover"
          />
          <button
            onClick={reload}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="Нет данных о продуктах" />
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Продукт
                </th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground">
                  Категория
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Партий
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Остаток
                </th>
                <th className="text-center px-3 py-3 font-medium text-emerald-600">
                  Собрано
                </th>
                <th className="text-center px-3 py-3 font-medium text-red-500">
                  Просрочено
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Доля потребл. %
                </th>
                <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                  Оборот
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
                    {row.turnover_ratio != null ? row.turnover_ratio : '—'}
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

// ── Collection Reasons ───────────────────────────────────────────────────────

const REASON_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
]

function CollectionReasonsPanel() {
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(today())
  const [applied, setApplied] = useState({ from: ago(30), to: today() })

  const { data, loading, error, reload } = useReport(
    'collection-reasons',
    applied
  )
  const rows = Array.isArray(data) ? data : []

  const apply = () => setApplied({ from, to })
  const maxQty = Math.max(...rows.map((r) => Number(r.total_quantity) || 0), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">С</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">По</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          onClick={apply}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Применить
        </button>
        <div className="flex-1 flex items-center justify-end gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.collectionReasons}
            title="Причины сборов"
            filename="collection_reasons"
          />
          <button
            onClick={reload}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="Нет данных о причинах" />
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              По количеству
            </h3>
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">
                      {row.reason || 'Не указано'}
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

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Причина
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    Транз.
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    Кол-во
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                    Доля
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
                          {row.reason || 'Не указано'}
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

// ── Batch Age Distribution ───────────────────────────────────────────────────

const AGE_COLORS = {
  Expired: '#ef4444',
  '0-2 days': '#f97316',
  '3-7 days': '#f59e0b',
  '8-30 days': '#3b82f6',
  '31-90 days': '#10b981',
  '90+ days': '#6b7280',
}

function BatchAgePanel() {
  const { data, loading, error, reload } = useReport('batch-age-distribution')
  const rows = Array.isArray(data) ? data : []
  const maxCount = Math.max(...rows.map((r) => Number(r.batch_count) || 0), 1)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Распределение активных партий по остатку срока годности
        </p>
        <div className="flex items-center gap-2">
          <ExportToolbar
            data={rows}
            columns={EXPORT_COLUMNS.batchAgeDistribution}
            title="Распределение по возрасту"
            filename="batch_age_distribution"
          />
          <button
            onClick={reload}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message="Нет активных партий" />
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Visual bars */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              По количеству партий
            </h3>
            <div className="space-y-4">
              {rows.map((row, i) => {
                const color = AGE_COLORS[row.age_range] || '#6b7280'
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium" style={{ color }}>
                        {row.age_range}
                      </span>
                      <span className="text-muted-foreground">
                        {row.batch_count} партий · {row.percentage}%
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
                      {row.total_quantity} ед. общего количества
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cards */}
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
                    {row.age_range}
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {row.batch_count}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.percentage}% · {row.total_quantity} ед.
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

// ── Weekly Summary ───────────────────────────────────────────────────────────

function WeeklySummaryPanel() {
  const { data, loading, error, reload } = useReport('weekly-summary')
  const summary =
    data && typeof data === 'object' && !Array.isArray(data)
      ? data
      : Array.isArray(data)
        ? data[0]
        : null

  const kpiCards = summary
    ? [
        {
          label: 'Всего партий',
          value: summary.total_batches,
          icon: Layers,
          color: 'text-foreground',
        },
        {
          label: 'Хорошие',
          value: summary.good,
          icon: CheckCircle,
          color: 'text-emerald-600',
        },
        {
          label: 'Просрочено',
          value: summary.expired,
          icon: XCircle,
          color: 'text-red-500',
        },
        {
          label: 'Health Score',
          value: summary.health_score,
          icon: HeartPulse,
          color: 'text-accent',
          delta: summary.health_delta,
          isScore: true,
        },
        {
          label: 'Сборов за неделю',
          value: summary.collections,
          icon: ClipboardList,
          color: 'text-blue-500',
        },
        {
          label: 'Собрано единиц',
          value: summary.collected_qty,
          icon: TrendingUp,
          color: 'text-emerald-600',
        },
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Сводка ключевых KPI за последние 7 дней
        </p>
        <button
          onClick={reload}
          disabled={loading}
          className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !summary && (
        <EmptyState message="Нет данных за неделю" />
      )}

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
                  <div className={`p-2 rounded-lg bg-muted`}>
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
                        Пред. {summary.prev_health_score}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {summary.prev_health_score != null && (
            <div className="bg-muted/30 rounded-xl p-4 border border-border">
              <p className="text-sm text-muted-foreground">
                Health Score изменился на{' '}
                <strong>
                  <Delta value={summary.health_delta} />
                </strong>{' '}
                по сравнению с прошлой неделей (было:{' '}
                {summary.prev_health_score}, стало: {summary.health_score})
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

const TABS = [
  {
    id: 'health',
    label: 'Здоровье',
    icon: HeartPulse,
    panel: HealthSummaryPanel,
  },
  {
    id: 'expiry',
    label: 'Прогноз истечения',
    icon: CalendarClock,
    panel: ExpiryForecastPanel,
  },
  {
    id: 'collections',
    label: 'Сборы',
    icon: ClipboardList,
    panel: CollectionActivityPanel,
  },
  {
    id: 'departments',
    label: 'Рейтинг отделов',
    icon: BarChart3,
    panel: DepartmentScorecardPanel,
  },
  {
    id: 'turnover',
    label: 'Оборот',
    icon: TrendingUp,
    panel: ProductTurnoverPanel,
  },
  {
    id: 'reasons',
    label: 'Причины',
    icon: PieChart,
    panel: CollectionReasonsPanel,
  },
  { id: 'age', label: 'Возраст партий', icon: Layers, panel: BatchAgePanel },
  {
    id: 'weekly',
    label: 'Неделя',
    icon: LayoutDashboard,
    panel: WeeklySummaryPanel,
  },
]

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('health')
  const tab = TABS.find((t) => t.id === activeTab) || TABS[0]
  const Panel = tab.panel

  return (
    <AnimatedPage>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Аналитические отчёты
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Детальная аналитика инвентаря, сборов, отделов и KPI
            </p>
          </div>

          {/* Tabs */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-max min-w-full sm:min-w-0">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = t.id === activeTab
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      active
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panel */}
          <div className="bg-card border border-border rounded-2xl p-5 min-h-[300px]">
            <Panel key={activeTab} />
          </div>
        </div>
      </PageContainer>
    </AnimatedPage>
  )
}
