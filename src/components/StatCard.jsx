/**
 * StatCard - Адаптивная карточка статистики
 * Компактный режим для мобильных устройств
 */

export default function StatCard({
  icon: Icon,
  title,
  value,
  color = 'text-foreground',
  bgColor = 'bg-muted',
  trend,
  trendLabel,
  compact = false
}) {
  return (
    <div
      className={`
        bg-card rounded-xl border border-border
        hover:shadow-md transition-shadow
        ${compact ? 'p-2.5' : 'p-3 sm:p-4'}
      `}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className={`${compact ? 'p-1' : 'p-1.5 sm:p-2'} rounded-lg ${bgColor}`}>
          <Icon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4 sm:w-5 sm:h-5'} ${color}`} />
        </div>
        {trend !== undefined && (
          <span
            className={`text-xs font-medium ${trend >= 50 ? 'text-success' : 'text-warning'}`}
          >
            {trend}
            {trendLabel}
          </span>
        )}
      </div>
      <p className={`font-light text-foreground ${compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}>
        {value}
      </p>
      <p className={`text-muted-foreground line-clamp-1 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
        {title}
      </p>
    </div>
  )
}
