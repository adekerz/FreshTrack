/**
 * PageContainer - Универсальный контейнер для страниц
 * Использует PageHeader для единообразного заголовка (design system)
 * headerClassName - доп. классы для шапки (напр. градиент)
 * titleIcon - компонент иконки (Lucide), отображается слева от заголовка
 */

import PageHeader from './PageHeader'

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
        <PageHeader
          title={title}
          subtitle={subtitle}
          icon={TitleIcon}
          actions={actions}
          sticky={stickyHeader}
          className={headerClassName}
          animate={true}
        />
      )}

      <div className="w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 overflow-x-auto">{children}</div>
    </div>
  )
}
