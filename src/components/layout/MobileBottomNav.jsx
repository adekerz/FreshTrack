import { Home, Package, Bell, Settings, BarChart3 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../../context/LanguageContext'
import { cn } from '../../utils/classNames'

/**
 * Bottom navigation bar for mobile (iOS/Android style).
 * Only visible on screens < lg.
 */
export default function MobileBottomNav() {
  const location = useLocation()
  const { t } = useTranslation()

  const navItems = [
    { path: '/', icon: Home, labelKey: 'nav.dashboard', fallback: 'Главная' },
    { path: '/inventory', icon: Package, labelKey: 'nav.inventory', fallback: 'Инвентарь' },
    { path: '/notifications', icon: Bell, labelKey: 'nav.notifications', fallback: 'Уведомления' },
    { path: '/statistics', icon: BarChart3, labelKey: 'nav.statistics', fallback: 'Статистика' },
    { path: '/settings', icon: Settings, labelKey: 'nav.settings', fallback: 'Настройки' },
  ]

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 lg:hidden',
        'bg-card border-t border-border shadow-soft',
        'transition-colors duration-300'
      )}
      role="navigation"
      aria-label={t('nav.mobileNav') || 'Mobile navigation'}
    >
      <div
        className="flex items-center justify-around gap-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
          const Icon = item.icon
          const label = t(item.labelKey) || item.fallback

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center',
                'min-w-[60px] min-h-[48px] rounded-lg py-2 px-3',
                'transition-colors touch-manipulation active:scale-95',
                '[&::-webkit-tap-highlight-color]:transparent',
                isActive
                  ? 'text-accent bg-accent/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
              <span className="text-[10px] mt-1 font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
