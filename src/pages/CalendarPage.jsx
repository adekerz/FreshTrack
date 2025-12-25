import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, Clock, Package } from 'lucide-react'
import { useProducts, departments } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isToday
} from 'date-fns'
import { ru, enUS, kk } from 'date-fns/locale'

const locales = { ru, en: enUS, kk }

export default function CalendarPage() {
  const { t, language } = useTranslation()
  const { batches } = useProducts()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [filterDepartment, setFilterDepartment] = useState('')

  const locale = locales[language] || locales.ru

  // Группируем партии по датам истечения срока
  const batchesByDate = useMemo(() => {
    const grouped = {}

    batches.forEach((batch) => {
      if (!batch.expiryDate) return
      if (filterDepartment && batch.department !== filterDepartment) return

      const dateKey = batch.expiryDate.split('T')[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(batch)
    })

    return grouped
  }, [batches, filterDepartment])

  // Дни текущего месяца
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Первый день недели (понедельник = 1)
  const startDayOfWeek = (monthStart.getDay() + 6) % 7 // Преобразуем воскресенье (0) в 6

  // Дни недели
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const weekDaysEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weekDaysKk = ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс']

  const localizedWeekDays =
    language === 'en' ? weekDaysEn : language === 'kk' ? weekDaysKk : weekDays

  // Навигация по месяцам
  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Получить статус дня
  // Uses backend enriched data (expiryStatus) for consistency
  const getDayStatus = useCallback(
    (date) => {
      const dateKey = format(date, 'yyyy-MM-dd')
      const dayBatches = batchesByDate[dateKey] || []

      if (dayBatches.length === 0) return null

      // Use expiryStatus from backend (Single Source of Truth)
      // Fallback to status.status for object format or direct status string
      const getStatus = (b) => b.expiryStatus || b.status?.status || b.status
      
      const hasExpired = dayBatches.some((b) => getStatus(b) === 'expired')
      const hasCritical = dayBatches.some((b) => getStatus(b) === 'critical' || getStatus(b) === 'today')
      const hasWarning = dayBatches.some((b) => getStatus(b) === 'warning')

      if (hasExpired) return 'expired'
      if (hasCritical) return 'critical'
      if (hasWarning) return 'warning'
      return 'good'
    },
    [batchesByDate]
  )

  // Получить цвет статуса (matches backend StatusCssClass)
  const getStatusColor = (status) => {
    switch (status) {
      case 'expired':
        return 'bg-danger text-white'
      case 'critical':
      case 'today':
        return 'bg-warning text-white'
      case 'warning':
        return 'bg-yellow-400 text-charcoal'
      case 'good':
        return 'bg-success text-white'
      default:
        return ''
    }
  }

  // Партии для выбранного дня
  const selectedDayBatches = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return batchesByDate[dateKey] || []
  }, [selectedDate, batchesByDate])

  // Статистика месяца
  const monthStats = useMemo(() => {
    let expired = 0,
      critical = 0,
      warning = 0,
      good = 0

    daysInMonth.forEach((day) => {
      const status = getDayStatus(day)
      if (status === 'expired') expired++
      else if (status === 'critical') critical++
      else if (status === 'warning') warning++
      else if (status === 'good') good++
    })

    return { expired, critical, warning, good }
  }, [daysInMonth, getDayStatus])

  // Название отдела
  const getDepartmentName = (id) => {
    const dept = departments.find((d) => d.id === id)
    return dept ? dept.name : id
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-1 sm:p-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-playfair text-charcoal dark:text-cream">
            {t('nav.calendar') || 'Календарь'}
          </h1>
          <p className="text-charcoal/60 dark:text-cream/60 text-xs sm:text-sm">
            {t('calendar.description') || 'Визуализация сроков годности'}
          </p>
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-2 sm:px-3 py-1.5 sm:py-2 border border-taupe/30 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 bg-white dark:bg-dark-surface dark:text-cream text-xs sm:text-sm flex-1 sm:flex-none"
          >
            <option value="">{t('common.allDepartments') || 'Все отделы'}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          <button
            onClick={goToToday}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gold text-white rounded-lg hover:bg-gold/90 transition-colors text-xs sm:text-sm"
          >
            {t('calendar.today') || 'Сегодня'}
          </button>
        </div>
      </div>

      {/* Статистика месяца - Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-dark-surface rounded-xl p-3 sm:p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-danger/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-danger" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-charcoal/60 dark:text-cream/60 truncate">
                {t('calendar.expiredDays') || 'С просрочкой'}
              </p>
              <p className="text-lg sm:text-xl font-semibold text-danger">{monthStats.expired}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-3 sm:p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-warning/10 rounded-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-charcoal/60 dark:text-cream/60 truncate">
                {t('calendar.criticalDays') || 'Критических'}
              </p>
              <p className="text-lg sm:text-xl font-semibold text-warning">{monthStats.critical}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-3 sm:p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-charcoal/60 dark:text-cream/60 truncate">
                {t('calendar.warningDays') || 'Внимание'}
              </p>
              <p className="text-lg sm:text-xl font-semibold text-yellow-600">{monthStats.warning}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-3 sm:p-4 shadow-card border border-taupe/10 dark:border-dark-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-success/10 rounded-lg">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-charcoal/60 dark:text-cream/60 truncate">{t('calendar.goodDays') || 'В норме'}</p>
              <p className="text-lg sm:text-xl font-semibold text-success">{monthStats.good}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Календарь */}
        <div className="lg:col-span-2 bg-white dark:bg-dark-surface rounded-xl shadow-card border border-taupe/10 dark:border-dark-border p-3 sm:p-6">
          {/* Навигация месяца */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <button
              onClick={goToPreviousMonth}
              className="p-1.5 sm:p-2 hover:bg-sand dark:hover:bg-dark-border rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-charcoal dark:text-cream" />
            </button>

            <h2 className="text-base sm:text-xl font-semibold text-charcoal dark:text-cream capitalize">
              {format(currentDate, 'LLLL yyyy', { locale })}
            </h2>

            <button
              onClick={goToNextMonth}
              className="p-1.5 sm:p-2 hover:bg-sand dark:hover:bg-dark-border rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-charcoal dark:text-cream" />
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
            {localizedWeekDays.map((day, index) => (
              <div
                key={day}
                className={`text-center text-xs sm:text-sm font-medium py-1 sm:py-2 ${index >= 5 ? 'text-charcoal/50 dark:text-cream/50' : 'text-charcoal dark:text-cream'}`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Дни месяца */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {/* Пустые ячейки до первого дня */}
            {Array.from({ length: startDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {/* Дни */}
            {daysInMonth.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayBatches = batchesByDate[dateKey] || []
              const status = getDayStatus(day)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isTodayDate = isToday(day)

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    aspect-square p-0.5 sm:p-1 rounded-lg relative transition-all
                    ${isSelected ? 'ring-2 ring-gold ring-offset-1 sm:ring-offset-2' : ''}
                    ${isTodayDate ? 'bg-gold/20' : 'hover:bg-sand/50 dark:hover:bg-dark-border'}
                    ${status ? 'cursor-pointer' : 'cursor-default'}
                  `}
                >
                  <span
                    className={`
                    text-xs sm:text-sm font-medium
                    ${isTodayDate ? 'text-gold font-bold' : 'text-charcoal dark:text-cream'}
                  `}
                  >
                    {format(day, 'd')}
                  </span>

                  {dayBatches.length > 0 && (
                    <div
                      className={`
                      absolute bottom-0.5 sm:bottom-1 left-1/2 -translate-x-1/2
                      text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 sm:py-0.5 rounded-full
                      ${getStatusColor(status)}
                    `}
                    >
                      {dayBatches.length}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Легенда */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-taupe/10 dark:border-dark-border">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-danger" />
              <span className="text-xs sm:text-sm text-charcoal/70 dark:text-cream/70">
                {t('status.expired') || 'Просрочено'}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-warning" />
              <span className="text-xs sm:text-sm text-charcoal/70 dark:text-cream/70">{t('status.critical') || 'Критично'}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-400" />
              <span className="text-xs sm:text-sm text-charcoal/70 dark:text-cream/70">{t('status.warning') || 'Внимание'}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-success" />
              <span className="text-xs sm:text-sm text-charcoal/70 dark:text-cream/70">{t('status.good') || 'Норма'}</span>
            </div>
          </div>
        </div>

        {/* Детали выбранного дня */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-card border border-taupe/10 dark:border-dark-border p-3 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-charcoal dark:text-cream mb-3 sm:mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gold" />
            {selectedDate
              ? format(selectedDate, 'd MMMM yyyy', { locale })
              : t('calendar.selectDate') || 'Выберите дату'}
          </h3>

          {selectedDate ? (
            selectedDayBatches.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 max-h-[300px] sm:max-h-[500px] overflow-y-auto">
                {selectedDayBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`
                      p-3 sm:p-4 rounded-lg border-l-4
                      ${
                        batch.status === 'expired'
                          ? 'border-danger bg-danger/5'
                          : batch.status === 'critical'
                            ? 'border-warning bg-warning/5'
                            : batch.status === 'warning'
                              ? 'border-yellow-400 bg-yellow-50'
                              : 'border-success bg-success/5'
                      }
                    `}
                  >
                    <h4 className="font-medium text-charcoal text-sm sm:text-base">{batch.productName}</h4>
                    <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-charcoal/70">
                      <p>📍 {getDepartmentName(batch.department)}</p>
                      <p>
                        📦 {t('common.quantity')}: {batch.quantity} {t('common.units')}
                      </p>
                      <p>
                        ⏱️ {t('common.daysLeft')}: {batch.daysLeft} {t('common.days')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-charcoal/50">
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
                <p className="text-xs sm:text-sm">{t('calendar.noProducts') || 'Нет товаров с истечением в этот день'}</p>
              </div>
            )
          ) : (
            <div className="text-center py-6 sm:py-8 text-charcoal/50">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
              <p className="text-xs sm:text-sm">{t('calendar.clickToSelect') || 'Нажмите на дату для просмотра деталей'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
