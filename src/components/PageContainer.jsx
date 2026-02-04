/**
 * PageContainer - Универсальный контейнер для страниц
 * Обеспечивает консистентные отступы и структуру на всех страницах
 * headerClassName - доп. классы для шапки (напр. градиент)
 * titleIcon - компонент иконки (Lucide), отображается слева от заголовка
 */

export default function PageContainer({
  children,
  title,
  subtitle,
  actions,
  className = '',
  stickyHeader = false,
  headerClassName = '',
  titleIcon: TitleIcon
}) {
  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-background ${className}`}>
      {title && (
        <div
          className={`
            bg-transparent border-b border-border
            ${stickyHeader ? 'sticky top-0 z-10' : ''}
            ${headerClassName}
          `}
        >
          <div className="px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-light text-foreground flex items-start sm:items-center gap-2">
                  {TitleIcon && (
                    <TitleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0 break-words whitespace-normal sm:truncate sm:whitespace-nowrap">
                    {title}
                  </span>
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 min-w-0 break-words whitespace-normal sm:truncate sm:whitespace-nowrap">
                    {subtitle}
                  </p>
                )}
              </div>

              {actions && <div className="flex-shrink-0 w-full sm:w-auto">{actions}</div>}
            </div>
          </div>
        </div>
      )}

      <div className="w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 overflow-x-auto">{children}</div>
    </div>
  )
}
