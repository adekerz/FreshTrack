import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  ArrowRight,
  Award,
  Target,
  BarChart3
} from 'lucide-react'
import { useProducts, departments } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'

export default function DepartmentRankingPage() {
  const { t } = useTranslation()
  const { batches } = useProducts()
  const [sortBy, setSortBy] = useState('efficiency')

  // Рассчитать статистику по отделам
  const departmentStats = departments.map((dept) => {
    const deptBatches = batches.filter((b) => b.department === dept.id)

    const total = deptBatches.length
    const expired = deptBatches.filter((b) => b.status === 'expired').length
    const critical = deptBatches.filter((b) => b.status === 'critical').length
    const warning = deptBatches.filter((b) => b.status === 'warning').length
    const good = deptBatches.filter((b) => b.status === 'good').length

    // Эффективность = % товаров в норме
    const efficiency = total > 0 ? Math.round((good / total) * 100) : 100

    // Оценка риска = просроченные + критичные
    const riskScore = expired * 3 + critical * 2 + warning

    return {
      ...dept,
      total,
      expired,
      critical,
      warning,
      good,
      efficiency,
      riskScore,
      needsAttention: expired + critical
    }
  })

  // Сортировка
  const sortedDepartments = [...departmentStats].sort((a, b) => {
    if (sortBy === 'efficiency') return b.efficiency - a.efficiency
    if (sortBy === 'risk') return b.riskScore - a.riskScore
    if (sortBy === 'total') return b.total - a.total
    return 0
  })

  // Медали для топ-3
  const getMedal = (index) => {
    if (index === 0) return { icon: '🥇', color: 'text-yellow-500' }
    if (index === 1) return { icon: '🥈', color: 'text-gray-400' }
    if (index === 2) return { icon: '🥉', color: 'text-amber-600' }
    return null
  }

  // Общая статистика
  const totalStats = {
    totalBatches: departmentStats.reduce((sum, d) => sum + d.total, 0),
    totalExpired: departmentStats.reduce((sum, d) => sum + d.expired, 0),
    avgEfficiency:
      departmentStats.length > 0
        ? Math.round(
            departmentStats.reduce((sum, d) => sum + d.efficiency, 0) / departmentStats.length
          )
        : 0,
    bestDepartment: sortedDepartments[0]?.name || '-'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-playfair text-charcoal flex items-center gap-2">
            <Trophy className="w-6 h-6 text-gold" />
            {t('ranking.title') || 'Рейтинг отделов'}
          </h1>
          <p className="text-charcoal/60">
            {t('ranking.description') || 'Сравнение эффективности отделов'}
          </p>
        </div>

        {/* Сортировка */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-taupe/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 bg-white text-sm"
          >
            <option value="efficiency">{t('ranking.byEfficiency') || 'По эффективности'}</option>
            <option value="risk">{t('ranking.byRisk') || 'По уровню риска'}</option>
            <option value="total">{t('ranking.byTotal') || 'По количеству'}</option>
          </select>
        </div>
      </div>

      {/* Общая статистика */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-card border border-taupe/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-charcoal/10 rounded-lg">
              <Package className="w-5 h-5 text-charcoal" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60">
                {t('ranking.totalBatches') || 'Всего партий'}
              </p>
              <p className="text-xl font-semibold text-charcoal">{totalStats.totalBatches}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-card border border-taupe/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60">
                {t('ranking.totalExpired') || 'Просрочено'}
              </p>
              <p className="text-xl font-semibold text-danger">{totalStats.totalExpired}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-card border border-taupe/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <Target className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60">
                {t('ranking.avgEfficiency') || 'Ср. эффективность'}
              </p>
              <p className="text-xl font-semibold text-success">{totalStats.avgEfficiency}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-card border border-taupe/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/10 rounded-lg">
              <Award className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-charcoal/60">{t('ranking.leader') || 'Лидер'}</p>
              <p className="text-lg font-semibold text-charcoal truncate">
                {totalStats.bestDepartment}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Список отделов */}
      <div className="bg-white rounded-xl shadow-card border border-taupe/10 overflow-hidden">
        <div className="p-4 border-b border-taupe/10">
          <h3 className="font-semibold text-charcoal flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gold" />
            {t('ranking.departments') || 'Отделы'}
          </h3>
        </div>

        <div className="divide-y divide-taupe/10">
          {sortedDepartments.map((dept, index) => {
            const medal = getMedal(index)

            return (
              <Link
                key={dept.id}
                to={`/department/${dept.id}`}
                className="flex items-center justify-between p-4 hover:bg-sand/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Позиция */}
                  <div className="w-8 h-8 flex items-center justify-center">
                    {medal ? (
                      <span className="text-2xl">{medal.icon}</span>
                    ) : (
                      <span className="text-lg font-bold text-charcoal/40">#{index + 1}</span>
                    )}
                  </div>

                  {/* Информация об отделе */}
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                    <div>
                      <p className="font-medium text-charcoal">
                        {dept.name}
                      </p>
                      <p className="text-sm text-charcoal/60">
                        {dept.total} {t('common.items')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Статусы */}
                  <div className="hidden sm:flex items-center gap-3">
                    {dept.expired > 0 && (
                      <span className="px-2 py-1 bg-danger/10 text-danger text-xs rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {dept.expired}
                      </span>
                    )}
                    {dept.needsAttention > 0 && (
                      <span className="px-2 py-1 bg-warning/10 text-warning text-xs rounded-full">
                        ⚠️ {dept.critical}
                      </span>
                    )}
                  </div>

                  {/* Эффективность */}
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-lg font-bold ${
                          dept.efficiency >= 80
                            ? 'text-success'
                            : dept.efficiency >= 50
                              ? 'text-warning'
                              : 'text-danger'
                        }`}
                      >
                        {dept.efficiency}%
                      </span>
                      {dept.efficiency >= 80 ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-danger" />
                      )}
                    </div>
                    <p className="text-xs text-charcoal/50">
                      {t('ranking.efficiency') || 'эффективность'}
                    </p>
                  </div>

                  <ArrowRight className="w-5 h-5 text-charcoal/30" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Легенда */}
      <div className="bg-sand/30 rounded-xl p-4">
        <h4 className="font-medium text-charcoal mb-2">
          {t('ranking.howCalculated') || 'Как рассчитывается:'}
        </h4>
        <p className="text-sm text-charcoal/70">
          {t('ranking.efficiencyFormula') ||
            'Эффективность = процент товаров с нормальным сроком годности. Чем выше процент, тем лучше отдел контролирует сроки.'}
        </p>
      </div>
    </div>
  )
}
