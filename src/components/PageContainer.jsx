/**
 * PageContainer - Универсальный контейнер для страниц
 * Обеспечивает консистентные отступы и структуру на всех страницах
 */

export default function PageContainer({
  children,
  title,
  subtitle,
  actions,
  className = '',
  stickyHeader = false
}) {
  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {title && (
        <div
          className={`
            bg-card border-b border-border
            ${stickyHeader ? 'sticky top-0 z-10' : ''}
          `}
        >
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-light text-foreground truncate">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                    {subtitle}
                  </p>
                )}
              </div>

              {actions && <div className="flex-shrink-0">{actions}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
    </div>
  )
}
