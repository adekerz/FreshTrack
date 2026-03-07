/**
 * AnalyticsPage — Unified professional analytics dashboard
 * Replaces both StatisticsPage and AnalyticsPage
 * Tabs: Overview | Inventory | Trends | Departments
 *
 * Route: /analytics (redirect /statistics → /analytics)
 */

import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useHotel } from '../context/HotelContext'
import { useProducts } from '../context/ProductContext'
import { useDepartment } from '../context/DepartmentContext'
import { useThresholds } from '../hooks/useThresholds'
import {
  useAnalyticsTimeseries,
  useAnalyticsSummary,
} from '../hooks/useAnalyticsData'
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Building2,
  LayoutDashboard,
  X,
  RefreshCw,
  ChevronRight,
  Activity,
  Layers,
} from 'lucide-react'
import PageContainer from '../components/PageContainer'
import AnimatedPage from '../components/AnimatedPage'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'inventory', label: 'Инвентарь', icon: Layers },
  { id: 'trends', label: 'Тренды', icon: Activity },
  { id: 'departments', label: 'Отделы', icon: Building2 },
]

const STATUS_CONFIG = {
  good: {
    label: 'В норме',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    hex: '#10b981',
    dot: 'bg-emerald-500',
  },
  warning: {
    label: 'Внимание',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    hex: '#eab308',
    dot: 'bg-yellow-500',
  },
  critical: {
    label: 'Срочно',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    hex: '#f97316',
    dot: 'bg-orange-500',
  },
  expired: {
    label: 'Просрочено',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    hex: '#ef4444',
    dot: 'bg-red-500',
  },
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getBatchStatus(batch, thresholds) {
  if (batch.daysLeft < 0) return 'expired'
  if (batch.daysLeft <= thresholds.critical) return 'critical'
  if (batch.daysLeft <= thresholds.warning) return 'warning'
  return 'good'
}

function calcHealthScore(batches, thresholds) {
  if (!batches.length) return 0
  const weights = { good: 1, warning: 0.5, critical: 0.2, expired: 0 }
  const total = batches.reduce((sum, b) => {
    return sum + (weights[getBatchStatus(b, thresholds)] || 0)
  }, 0)
  return Math.round((total / batches.length) * 100)
}

function getDeltaIcon(delta) {
  if (delta > 0) return <TrendingUp className="w-3 h-3" />
  if (delta < 0) return <TrendingDown className="w-3 h-3" />
  return <Minus className="w-3 h-3" />
}

function getDeltaColor(delta, inverseGood = false) {
  if (delta === 0) return 'text-muted-foreground'
  const isGood = inverseGood ? delta < 0 : delta > 0
  return isGood ? 'text-emerald-500' : 'text-red-500'
}

function formatDaysLabel(daysLeft) {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}д назад`
  if (daysLeft === 0) return 'Сегодня'
  if (daysLeft === 1) return 'Завтра'
  return `${daysLeft}д`
}

// Generate 30-day expiration timeline from real batches
function buildExpirationTimeline(batches) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const map = {}
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const key = d.toISOString().split('T')[0]
    map[key] = {
      date: key,
      label: i === 0 ? 'Сег' : `+${i}д`,
      count: 0,
      critical: 0,
      warning: 0,
    }
  }
  batches.forEach((b) => {
    if (b.daysLeft < 0 || b.daysLeft > 30) return
    const d = new Date(today)
    d.setDate(today.getDate() + b.daysLeft)
    const key = d.toISOString().split('T')[0]
    if (map[key]) {
      map[key].count++
      if (b.daysLeft <= 3) map[key].critical++
      else map[key].warning++
    }
  })
  return Object.values(map).filter((d) => d.count > 0 || d.label === 'Сег')
}

// ─────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: p.color || p.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// KPI CARD — with delta comparison
// ─────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  title,
  value,
  delta,
  deltaLabel,
  color,
  bg,
  border,
  suffix,
  description,
}) {
  const deltaColor = getDeltaColor(
    delta,
    title.includes('Просрочено') ||
      title.includes('Срочно') ||
      title.includes('Внимание')
  )
  return (
    <div
      className={`bg-card rounded-2xl border ${border || 'border-border'} p-4 sm:p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}
        >
          <Icon
            className={`w-4.5 h-4.5 ${color}`}
            style={{ width: '18px', height: '18px' }}
          />
        </div>
        {delta !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${deltaColor}`}
          >
            {getDeltaIcon(delta)}
            <span>
              {delta > 0 ? '+' : ''}
              {delta}
              {suffix || ''}
            </span>
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
          {value}
          {suffix && (
            <span className="text-base font-medium text-muted-foreground ml-0.5">
              {suffix}
            </span>
          )}
        </div>
        <div className="text-xs font-medium text-muted-foreground mt-0.5">
          {title}
        </div>
        {description && (
          <div className="text-[11px] text-muted-foreground/70 mt-1">
            {description}
          </div>
        )}
      </div>
      {deltaLabel && delta !== undefined && (
        <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
          {deltaLabel}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// HEALTH SCORE RING
// ─────────────────────────────────────────────
function HealthScoreRing({ score, size = 80 }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444'
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-sm font-bold text-foreground tabular-nums">
          {score}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// EXPIRATION TIMELINE CHART
// ─────────────────────────────────────────────
function ExpirationTimeline({ batches }) {
  const data = useMemo(() => buildExpirationTimeline(batches), [batches])
  if (!data.some((d) => d.count > 0))
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <CheckCircle className="w-8 h-8 mb-2 text-emerald-500 opacity-60" />
        <p className="text-sm">Нет истечений в ближайшие 30 дней</p>
      </div>
    )
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          className="text-border/40"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'currentColor' }}
          className="text-muted-foreground"
        />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="critical"
          name="Срочно"
          stackId="a"
          fill="#f97316"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="warning"
          name="Внимание"
          stackId="a"
          fill="#eab308"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────
// STATUS DONUT
// ─────────────────────────────────────────────
function StatusDonut({ stats }) {
  const data = [
    { name: 'В норме', value: stats.good, color: '#10b981' },
    { name: 'Внимание', value: stats.warning, color: '#eab308' },
    { name: 'Срочно', value: stats.critical, color: '#f97316' },
    { name: 'Просрочено', value: stats.expired, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  if (!data.length)
    return (
      <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">
        Нет данных
      </div>
    )

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─────────────────────────────────────────────
// TOP ALERTS LIST
// ─────────────────────────────────────────────
function TopAlertsList({ batches, departments, thresholds, limit = 8 }) {
  const alerts = useMemo(
    () =>
      batches
        .filter((b) => b.daysLeft <= thresholds.warning)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, limit),
    [batches, thresholds.warning, limit]
  )

  if (!alerts.length)
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <CheckCircle className="w-8 h-8 mb-2 text-emerald-500 opacity-60" />
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Всё в порядке
        </p>
        <p className="text-xs mt-1">Нет товаров, требующих внимания</p>
      </div>
    )

  return (
    <div className="space-y-1">
      {alerts.map((batch, i) => {
        const dept = departments.find((d) => d.id === batch.departmentId)
        const status = getBatchStatus(batch, thresholds)
        const cfg = STATUS_CONFIG[status]
        return (
          <div
            key={batch.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors group"
          >
            <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {batch.productName || batch.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {dept?.name} · {batch.quantity} шт.
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold whitespace-nowrap px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} flex-shrink-0`}
            >
              {formatDaysLabel(batch.daysLeft)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────
function OverviewTab({ stats, batches, departments, thresholds, summary }) {
  const healthScore = useMemo(
    () => calcHealthScore(batches, thresholds),
    [batches, thresholds]
  )

  // Real deltas from API summary (null if no snapshots yet)
  const deltas = summary?.delta ?? null

  const kpiCards = [
    {
      icon: Package,
      title: 'Всего партий',
      value: stats.total,
      delta: deltas?.total,
      deltaLabel: deltas ? 'vs прошлая неделя' : undefined,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-border',
    },
    {
      icon: CheckCircle,
      title: 'В норме',
      value: stats.good,
      delta: deltas?.good,
      deltaLabel: deltas ? 'vs прошлая неделя' : undefined,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      icon: Clock,
      title: 'Внимание',
      value: stats.warning,
      delta: deltas?.warning,
      deltaLabel: deltas ? 'vs прошлая неделя' : undefined,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
    },
    {
      icon: AlertTriangle,
      title: 'Срочно',
      value: stats.critical,
      delta: deltas?.critical,
      deltaLabel: deltas ? 'vs прошлая неделя' : undefined,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
    },
    {
      icon: AlertTriangle,
      title: 'Просрочено',
      value: stats.expired,
      delta: deltas?.expired,
      deltaLabel: deltas ? 'vs прошлая неделя' : undefined,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
  ]

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card, i) => (
          <KpiCard key={i} {...card} />
        ))}
      </div>

      {/* Main charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health score + donut */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Здоровье инвентаря
          </h3>
          <div className="flex items-center gap-5 mb-4">
            <HealthScoreRing score={healthScore} size={80} />
            <div>
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {healthScore}
              </div>
              <div className="text-xs text-muted-foreground">из 100</div>
              <div
                className={`text-xs font-medium mt-1 ${healthScore >= 80 ? 'text-emerald-500' : healthScore >= 50 ? 'text-yellow-500' : 'text-red-500'}`}
              >
                {healthScore >= 80
                  ? '✓ Хорошо'
                  : healthScore >= 50
                    ? '⚠ Требует внимания'
                    : '✕ Критично'}
              </div>
            </div>
          </div>
          <StatusDonut stats={stats} />
        </div>

        {/* Expiration timeline */}
        <div className="md:col-span-2 bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Истечения — ближайшие 30 дней
            </h3>
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {
                batches.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 30)
                  .length
              }{' '}
              партий
            </span>
          </div>
          <ExpirationTimeline batches={batches} />
        </div>
      </div>

      {/* Bottom row: top alerts + category breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top alerts */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Требуют внимания
            </h3>
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Топ 8
            </span>
          </div>
          <TopAlertsList
            batches={batches}
            departments={departments}
            thresholds={thresholds}
          />
        </div>

        {/* Per-department quick view */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            По отделам
          </h3>
          <DepartmentMiniList
            batches={batches}
            departments={departments}
            thresholds={thresholds}
          />
        </div>
      </div>
    </div>
  )
}

function DepartmentMiniList({ batches, departments, thresholds }) {
  const deptData = departments
    .map((dept) => {
      const db = batches.filter((b) => b.departmentId === dept.id)
      const score = calcHealthScore(db, thresholds)
      const expired = db.filter((b) => b.daysLeft < 0).length
      const critical = db.filter(
        (b) => b.daysLeft >= 0 && b.daysLeft <= thresholds.critical
      ).length
      return { ...dept, total: db.length, score, expired, critical }
    })
    .sort((a, b) => a.score - b.score)

  if (!deptData.length)
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Нет отделов
      </p>
    )

  return (
    <div className="space-y-3">
      {deptData.map((dept) => (
        <div key={dept.id}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: dept.color }}
              />
              <span className="text-xs font-medium text-foreground">
                {dept.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {dept.expired > 0 && (
                <span className="text-red-500 font-medium">
                  {dept.expired} просроч.
                </span>
              )}
              {dept.critical > 0 && (
                <span className="text-orange-500 font-medium">
                  {dept.critical} срочно
                </span>
              )}
              <span
                className="font-semibold"
                style={{
                  color:
                    dept.score >= 80
                      ? '#10b981'
                      : dept.score >= 50
                        ? '#eab308'
                        : '#ef4444',
                }}
              >
                {dept.score}%
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${dept.score}%`,
                backgroundColor:
                  dept.score >= 80
                    ? '#10b981'
                    : dept.score >= 50
                      ? '#eab308'
                      : '#ef4444',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// INVENTORY TAB — sortable, filterable table
// ─────────────────────────────────────────────
function InventoryTab({ batches, departments, thresholds }) {
  const [sortField, setSortField] = useState('daysLeft')
  const [sortDir, setSortDir] = useState('asc')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const handleSort = useCallback(
    (field) => {
      if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setSortField(field)
        setSortDir('asc')
      }
      setPage(1)
    },
    [sortField]
  )

  const filtered = useMemo(() => {
    let result = batches.map((b) => ({
      ...b,
      _status: getBatchStatus(b, thresholds),
    }))
    if (filterStatus !== 'all')
      result = result.filter((b) => b._status === filterStatus)
    if (filterDept !== 'all')
      result = result.filter((b) => b.departmentId === filterDept)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (b) =>
          (b.productName || b.name || '').toLowerCase().includes(q) ||
          (b.categoryName || '').toLowerCase().includes(q)
      )
    }
    result.sort((a, b) => {
      let av = a[sortField],
        bv = b[sortField]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return result
  }, [
    batches,
    filterStatus,
    filterDept,
    search,
    sortField,
    sortDir,
    thresholds,
  ])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const SortButton = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
    >
      {children}
      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
        {sortField === field ? (
          sortDir === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </span>
    </button>
  )

  const activeFilters =
    (filterStatus !== 'all' ? 1 : 0) +
    (filterDept !== 'all' ? 1 : 0) +
    (search ? 1 : 0)

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="bg-card rounded-2xl border border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Поиск товара..."
              className="w-full pl-3 pr-8 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none min-w-[130px]"
          >
            <option value="all">Все статусы</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>

          {/* Department filter */}
          <select
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none min-w-[130px]"
          >
            <option value="all">Все отделы</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {activeFilters > 0 && (
            <button
              onClick={() => {
                setFilterStatus('all')
                setFilterDept('all')
                setSearch('')
                setPage(1)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Сбросить ({activeFilters})
            </button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {filtered.length} из {batches.length} партий
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3">
                  <SortButton field="productName">Товар</SortButton>
                </th>
                <th className="text-left px-4 py-3">
                  <SortButton field="departmentId">Отдел</SortButton>
                </th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">
                  <SortButton field="categoryName">Категория</SortButton>
                </th>
                <th className="text-left px-4 py-3">
                  <SortButton field="quantity">Кол-во</SortButton>
                </th>
                <th className="text-left px-4 py-3">
                  <SortButton field="daysLeft">Срок</SortButton>
                </th>
                <th className="text-left px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((batch) => {
                const dept = departments.find(
                  (d) => d.id === batch.departmentId
                )
                const cfg = STATUS_CONFIG[batch._status]
                return (
                  <tr
                    key={batch.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-sm truncate max-w-[180px]">
                        {batch.productName || batch.name}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {dept?.color && (
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dept.color }}
                          />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {dept?.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {batch.categoryName || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {batch.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        шт.
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${cfg.color}`}>
                        {formatDaysLabel(batch.daysLeft)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                        />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-12 text-center text-muted-foreground text-sm"
                  >
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Нет данных для отображения
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Страница {page} из {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5 rotate-90" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                return (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors
                      ${page === n ? 'bg-accent text-white' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    {n}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// TRENDS TAB
// ─────────────────────────────────────────────
function TrendsTab({ batches, thresholds, hotelId }) {
  const [trendPeriod, setTrendPeriod] = useState(30)

  const { data: rawTimeseries = [], isLoading: timeseriesLoading } =
    useAnalyticsTimeseries(hotelId, 90)

  const hasRealData = rawTimeseries.length >= 2
  const displayData = hasRealData ? rawTimeseries.slice(-trendPeriod) : []

  // Category breakdown bar chart
  const categoryData = useMemo(() => {
    const map = {}
    batches.forEach((b) => {
      const cat = b.categoryName || 'Другое'
      if (!map[cat]) map[cat] = { name: cat, total: 0, expired: 0, warning: 0 }
      map[cat].total++
      const status = getBatchStatus(b, thresholds)
      if (status === 'expired') map[cat].expired++
      if (status === 'warning' || status === 'critical') map[cat].warning++
    })
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [batches, thresholds])

  // Expiration heatmap data (days 1-30 counts)
  const expirationData = useMemo(() => {
    const buckets = [
      { name: 'Сегодня', min: 0, max: 0 },
      { name: '1-3 дн.', min: 1, max: 3 },
      { name: '4-7 дн.', min: 4, max: 7 },
      { name: '8-14 дн.', min: 8, max: 14 },
      { name: '15-30 дн.', min: 15, max: 30 },
      { name: '>30 дн.', min: 31, max: 9999 },
    ]
    return buckets.map((bucket) => ({
      name: bucket.name,
      count: batches.filter(
        (b) => b.daysLeft >= bucket.min && b.daysLeft <= bucket.max
      ).length,
    }))
  }, [batches])

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">
          Период:
        </span>
        <div className="flex items-center bg-card rounded-xl border border-border p-0.5">
          {[7, 30, 90].map((p) => (
            <button
              key={p}
              onClick={() => setTrendPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${trendPeriod === p ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {p}д
            </button>
          ))}
        </div>
        {timeseriesLoading ? (
          <span className="ml-2 text-[11px] text-muted-foreground px-2 py-0.5">
            Загрузка...
          </span>
        ) : hasRealData ? (
          <span className="ml-2 text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
            ✓ Реальные данные · {rawTimeseries.length} снапшотов
          </span>
        ) : (
          <span className="ml-2 text-[11px] text-muted-foreground bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full border border-yellow-500/20">
            ⚠ Данные ещё накапливаются. Тренды появятся через 2 дня.
          </span>
        )}
      </div>

      {/* Графики трендов — только при наличии данных */}
      {!hasRealData && !timeseriesLoading ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Activity className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Недостаточно данных для отображения трендов
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Снапшоты создаются ежедневно — графики появятся через 2 дня
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Health score trend */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Health Score — тренд
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart
                data={displayData}
                margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
              >
                <defs>
                  <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  interval={Math.floor(displayData.length / 6)}
                />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="health"
                  name="Health Score"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#healthGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Expired trend */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Просроченные — динамика
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={displayData}
                margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  interval={Math.floor(displayData.length / 6)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="expired"
                  name="Просрочено"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="warning"
                  name="Внимание"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Категории и распределение — всегда на реальных батчах */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category breakdown */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            По категориям
          </h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={categoryData}
                margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border/40"
                  vertical={false}
                />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="total"
                  name="Всего"
                  fill="#6366f1"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="expired"
                  name="Просрочено"
                  fill="#ef4444"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Нет данных по категориям
            </p>
          )}
        </div>

        {/* Expiration distribution */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Распределение по срокам
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={expirationData}
              margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border/40"
                vertical={false}
              />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Партий" radius={[3, 3, 0, 0]}>
                {expirationData.map((entry, i) => {
                  const colors = [
                    '#ef4444',
                    '#f97316',
                    '#eab308',
                    '#6366f1',
                    '#10b981',
                    '#3b82f6',
                  ]
                  return <Cell key={i} fill={colors[i] || '#6366f1'} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// DEPARTMENTS TAB
// ─────────────────────────────────────────────
function DepartmentsTab({ batches, departments, thresholds }) {
  const [sortBy, setSortBy] = useState('score')

  const deptStats = useMemo(() => {
    return departments
      .map((dept, idx) => {
        const db = batches.filter((b) => b.departmentId === dept.id)
        const score = calcHealthScore(db, thresholds)
        const expired = db.filter((b) => b.daysLeft < 0)
        const critical = db.filter(
          (b) => b.daysLeft >= 0 && b.daysLeft <= thresholds.critical
        )
        const warning = db.filter(
          (b) =>
            b.daysLeft > thresholds.critical && b.daysLeft <= thresholds.warning
        )
        const good = db.filter((b) => b.daysLeft > thresholds.warning)
        const totalQty = db.reduce((s, b) => s + (b.quantity || 0), 0)

        // Category breakdown per department
        const catMap = {}
        db.forEach((b) => {
          const cat = b.categoryName || 'Другое'
          catMap[cat] = (catMap[cat] || 0) + 1
        })
        const topCategories = Object.entries(catMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)

        return {
          id: dept.id,
          name: dept.name,
          color: dept.color || COLUMN_COLORS[idx % 8],
          total: db.length,
          totalQty,
          score,
          expired: expired.length,
          critical: critical.length,
          warning: warning.length,
          good: good.length,
          topCategories,
          urgentItems: db
            .filter((b) => b.daysLeft >= 0 && b.daysLeft <= 3)
            .slice(0, 3),
        }
      })
      .sort((a, b) =>
        sortBy === 'score' ? a.score - b.score : b.total - a.total
      )
  }, [batches, departments, thresholds, sortBy])

  const COLUMN_COLORS = [
    '#6366f1',
    '#f59e0b',
    '#10b981',
    '#ec4899',
    '#3b82f6',
    '#8b5cf6',
    '#14b8a6',
    '#FF8D6B',
  ]

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Сортировать:</span>
        <div className="flex items-center bg-card rounded-xl border border-border p-0.5">
          {[
            ['score', 'По health score'],
            ['total', 'По кол-ву партий'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${sortBy === id ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Department cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deptStats.map((dept) => {
          const total = dept.total || 1
          return (
            <div
              key={dept.id}
              className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-all"
            >
              {/* Department header */}
              <div className="h-1.5" style={{ backgroundColor: dept.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: dept.color }}
                    >
                      {dept.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {dept.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {dept.total} партий · {dept.totalQty} шт.
                      </p>
                    </div>
                  </div>
                  <HealthScoreRing score={dept.score} size={52} />
                </div>

                {/* Status bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden flex mb-2">
                  {[
                    { pct: (dept.good / total) * 100, color: '#10b981' },
                    { pct: (dept.warning / total) * 100, color: '#eab308' },
                    { pct: (dept.critical / total) * 100, color: '#f97316' },
                    { pct: (dept.expired / total) * 100, color: '#ef4444' },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="h-full transition-all duration-700"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                  ))}
                </div>

                {/* Status legend */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
                  {[
                    { v: dept.good, label: 'Норма', color: 'bg-emerald-500' },
                    {
                      v: dept.warning,
                      label: 'Внимание',
                      color: 'bg-yellow-500',
                    },
                    {
                      v: dept.critical,
                      label: 'Срочно',
                      color: 'bg-orange-500',
                    },
                    {
                      v: dept.expired,
                      label: 'Просрочено',
                      color: 'bg-red-500',
                    },
                  ].map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                      {s.v} {s.label}
                    </span>
                  ))}
                </div>

                {/* Urgent items */}
                {dept.urgentItems.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-[11px] font-semibold text-orange-500 mb-1.5">
                      ⚡ Срочно ({dept.urgentItems.length}):
                    </p>
                    {dept.urgentItems.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between py-0.5"
                      >
                        <span className="text-[11px] text-foreground truncate flex-1">
                          {b.productName || b.name}
                        </span>
                        <span className="text-[11px] font-medium text-orange-500 ml-2">
                          {formatDaysLabel(b.daysLeft)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top categories */}
                {dept.topCategories.length > 0 && (
                  <div className="border-t border-border pt-3 mt-3">
                    <p className="text-[11px] text-muted-foreground mb-1">
                      Топ категории:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {dept.topCategories.map(([cat, count]) => (
                        <span
                          key={cat}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {cat} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary matrix */}
      {deptStats.length > 1 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Сводная матрица
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    Отдел
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                    Партий
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-emerald-500">
                    В норме
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-yellow-500">
                    Внимание
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-orange-500">
                    Срочно
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-red-500">
                    Просрочено
                  </th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                    Health
                  </th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((dept) => (
                  <tr
                    key={dept.id}
                    className="border-b border-border/50 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: dept.color }}
                        />
                        <span className="font-medium text-foreground">
                          {dept.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-foreground">
                      {dept.total}
                    </td>
                    <td className="px-3 py-2.5 text-center text-emerald-500 font-medium">
                      {dept.good}
                    </td>
                    <td className="px-3 py-2.5 text-center text-yellow-500 font-medium">
                      {dept.warning}
                    </td>
                    <td className="px-3 py-2.5 text-center text-orange-500 font-medium">
                      {dept.critical}
                    </td>
                    <td className="px-3 py-2.5 text-center text-red-500 font-medium">
                      {dept.expired}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className="font-bold"
                        style={{
                          color:
                            dept.score >= 80
                              ? '#10b981'
                              : dept.score >= 50
                                ? '#eab308'
                                : '#ef4444',
                        }}
                      >
                        {dept.score}%
                      </span>
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

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user, isHotelAdmin } = useAuth()
  const { selectedHotelId } = useHotel()
  const { getActiveBatches, getStats } = useProducts()
  const { departments } = useDepartment()
  const { thresholds } = useThresholds()

  const [activeTab, setActiveTab] = useState('overview')
  const [period, setPeriod] = useState('week')
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Real analytics data from API
  const { data: analyticsSummary } = useAnalyticsSummary(
    selectedHotelId,
    period
  )

  const stats = getStats()
  const allBatches = getActiveBatches()

  // Permission filter
  const userDepartments = useMemo(() => {
    if (isHotelAdmin()) return departments
    return departments.filter((d) => user?.departments?.includes(d.id))
  }, [user, departments, isHotelAdmin])

  const batches = useMemo(() => {
    if (isHotelAdmin()) return allBatches
    return allBatches.filter((b) => user?.departments?.includes(b.departmentId))
  }, [allBatches, user, isHotelAdmin])

  // Фильтр по периоду — батчи по createdAt
  const filteredBatches = useMemo(() => {
    if (period === 'all') return batches
    const cutoff = new Date()
    if (period === 'week') cutoff.setDate(cutoff.getDate() - 7)
    if (period === 'month') cutoff.setDate(cutoff.getDate() - 30)
    // For now filter by createdAt if available, else return all
    return batches.filter(
      (b) => !b.createdAt || new Date(b.createdAt) >= cutoff
    )
  }, [batches, period])

  const refresh = () => setLastUpdated(new Date())

  const healthScore = useMemo(
    () => calcHealthScore(filteredBatches, thresholds),
    [filteredBatches, thresholds]
  )

  return (
    <AnimatedPage>
      <PageContainer
        title="Аналитика"
        subtitle="Комплексный анализ инвентаря и трендов"
        stickyHeader
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Refresh */}
            <button
              onClick={refresh}
              className="w-8 h-8 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
              title="Обновить"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Period selector */}
            <div className="flex items-center bg-card rounded-lg border border-border p-0.5">
              {[
                ['week', 'Неделя'],
                ['month', 'Месяц'],
                ['all', 'Всё время'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPeriod(id)}
                  className={`px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md transition-colors
                    ${period === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Tab bar + Health score badge */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center bg-card rounded-xl border border-border p-0.5 overflow-x-auto flex-shrink-0">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                      ${activeTab === tab.id ? 'bg-accent text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Live health score badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-xl border border-border text-xs">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  backgroundColor:
                    healthScore >= 80
                      ? '#10b981'
                      : healthScore >= 50
                        ? '#eab308'
                        : '#ef4444',
                }}
              />
              <span className="text-muted-foreground">Health Score:</span>
              <span
                className="font-bold text-foreground tabular-nums"
                style={{
                  color:
                    healthScore >= 80
                      ? '#10b981'
                      : healthScore >= 50
                        ? '#eab308'
                        : '#ef4444',
                }}
              >
                {healthScore}%
              </span>
              <span className="text-[10px] text-muted-foreground">
                ·{' '}
                {lastUpdated.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <OverviewTab
              stats={stats}
              batches={filteredBatches}
              departments={userDepartments}
              thresholds={thresholds}
              summary={analyticsSummary}
            />
          )}
          {activeTab === 'inventory' && (
            <InventoryTab
              batches={filteredBatches}
              departments={userDepartments}
              thresholds={thresholds}
            />
          )}
          {activeTab === 'trends' && (
            <TrendsTab
              batches={filteredBatches}
              thresholds={thresholds}
              hotelId={selectedHotelId}
            />
          )}
          {activeTab === 'departments' && (
            <DepartmentsTab
              batches={filteredBatches}
              departments={userDepartments}
              thresholds={thresholds}
            />
          )}
        </div>
      </PageContainer>
    </AnimatedPage>
  )
}
