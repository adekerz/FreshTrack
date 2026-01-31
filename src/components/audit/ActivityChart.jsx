import { useMemo } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export function ActivityChart({ data }) {
  const { t } = useTranslation()

  const chartData = useMemo(() => {
    const labels = (data || []).map((d) => {
      const date = new Date(d.date)
      return date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })
    })

    return {
      labels,
      datasets: [
        {
          label: t('auditLogs.statsTotal'),
          data: (data || []).map((d) => parseInt(d.count, 10)),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: t('auditLogs.statsCritical'),
          data: (data || []).map((d) => parseInt(d.critical_count || 0, 10)),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    }
  }, [data, t])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }),
    []
  )

  const totalActions = (data || []).reduce((sum, d) => sum + parseInt(d.count, 10), 0)
  const criticalActions = (data || []).reduce(
    (sum, d) => sum + parseInt(d.critical_count || 0, 10),
    0
  )
  const importantActions = (data || []).reduce(
    (sum, d) => sum + parseInt(d.important_count || 0, 10),
    0
  )

  if (!data || data.length === 0) return null

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4 sm:mb-6">
      <h2 className="text-base sm:text-lg font-medium text-foreground mb-4">
        {t('auditLogs.activityTitle')}
      </h2>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 sm:gap-6 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-light text-foreground">{totalActions}</span>
          <span className="text-sm text-muted-foreground">{t('auditLogs.statsTotal')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-light text-red-600 dark:text-red-400">
            {criticalActions}
          </span>
          <span className="text-sm text-muted-foreground">{t('auditLogs.statsCritical')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-light text-yellow-600 dark:text-yellow-400">
            {importantActions}
          </span>
          <span className="text-sm text-muted-foreground">{t('auditLogs.statsImportant')}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 sm:h-56">
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
