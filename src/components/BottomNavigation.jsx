import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal, X, LogOut, User, Globe } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { cn } from '../utils/classNames'
import { mainNavItems, moreNavItems, filterNavByRole } from '../config/navigation'

export default function BottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { getStats } = useProducts()
  const { user, logout, hasPermission, getCapabilities } = useAuth()
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()
  const stats = getStats()
  const [showMore, setShowMore] = useState(false)

  const unreadCount = stats.critical + stats.expired
  const userRole = user?.role
  const capabilities = getCapabilities()
  const navOptions = {
    capabilities,
    permissions: user?.permissions || [],
    hasPermission
  }

  // Основные пункты навигации (4 пункта + "Ещё") - из централизованной конфигурации
  const navItems = mainNavItems.map((item) => ({
    path: item.path,
    icon: item.icon,
    label: t(item.labelKey) || item.fallbackLabel,
    badge: item.hasBadge && unreadCount > 0 ? unreadCount : null
  }))

  // Дополнительные пункты меню - фильтруем по роли/permissions из централизованной конфигурации
  const moreItems = filterNavByRole(moreNavItems, userRole, navOptions).map((item) => ({
    path: item.path,
    icon: item.icon,
    label: t(item.labelKey) || item.fallbackLabel
  }))

  // Найти индекс активного элемента (включая moreItems)
  const activeIndex = navItems.findIndex(
    (item) =>
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path))
  )

  // Проверяем, активен ли какой-то из пунктов "Ещё"
  const isMoreActive = moreItems.some(
    (item) =>
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path))
  )

  const handleNavClick = (path) => {
    navigate(path)
    setShowMore(false)
    // Haptic feedback на поддерживаемых устройствах
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
  }

  return (
    <>
      {/* Overlay для меню "Ещё" */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* Меню "Ещё" */}
      {showMore && (
        <div className="fixed bottom-16 left-4 right-4 bg-card rounded-xl shadow-xl z-50 sm:hidden overflow-hidden animate-slide-up safe-bottom transition-colors duration-300">
          <div className="p-2">
            {/* Профиль пользователя */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border mb-2">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <User className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.roleLabel || user?.role}</p>
              </div>
            </div>


            {/* Переключатель языка - все 8 языков */}
            <div className="px-4 py-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('header.language') || 'Язык'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { code: 'ru', label: 'RU', flag: '🇷🇺' },
                  { code: 'en', label: 'EN', flag: '🇺🇸' },
                  { code: 'kk', label: 'KZ', flag: '🇰🇿' },
                  { code: 'de', label: 'DE', flag: '🇩🇪' },
                  { code: 'fr', label: 'FR', flag: '🇫🇷' },
                  { code: 'es', label: 'ES', flag: '🇪🇸' },
                  { code: 'it', label: 'IT', flag: '🇮🇹' },
                  { code: 'ar', label: 'AR', flag: '🇸🇦' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={cn(
                      'flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium rounded-lg transition-all min-h-[40px]',
                      language === lang.code 
                        ? 'bg-accent text-white shadow-sm' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Навигационные пункты */}
            {moreItems.map(({ path, icon: Icon, label }) => {
              const isActive =
                location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

              return (
                <button
                  key={path}
                  onClick={() => handleNavClick(path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              )
            })}

            {/* Кнопка выхода */}
            <button
              onClick={() => {
                setShowMore(false)
                logout()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-danger hover:bg-danger/10 mt-2 border-t border-border pt-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">{t('header.signOut') || 'Выйти'}</span>
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-soft z-40 sm:hidden transition-colors duration-300"
        role="navigation"
        aria-label={t('nav.mobileNav') || 'Mobile navigation'}
      >
        {/* Анимированный индикатор сверху */}
        {activeIndex >= 0 && !isMoreActive && (
          <div
            className="absolute top-0 h-0.5 bg-accent transition-all duration-300 ease-out"
            style={{
              width: `${100 / (navItems.length + 1)}%`,
              left: `${(activeIndex * 100) / (navItems.length + 1)}%`
            }}
          />
        )}
        {isMoreActive && (
          <div
            className="absolute top-0 h-0.5 bg-accent transition-all duration-300 ease-out"
            style={{
              width: `${100 / (navItems.length + 1)}%`,
              left: `${(navItems.length * 100) / (navItems.length + 1)}%`
            }}
          />
        )}

        {/* Safe area padding for iOS - using env() with fallback */}
        <div
          className="flex items-center justify-around"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          {navItems.map(({ path, icon: Icon, label, badge }, index) => {
            const isActive = index === activeIndex && !isMoreActive

            return (
              <button
                key={path}
                onClick={() => handleNavClick(path)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={badge ? `${label}, ${badge} ${t('notifications.new') || 'new'}` : label}
                className={cn(
                  'flex flex-col items-center justify-center',
                  'min-w-[64px] min-h-[56px] py-2 px-3', // Fitts's Law: 48px+ touch targets
                  'rounded-lg transition-all',
                  'active:scale-95 touch-manipulation',
                  '-webkit-tap-highlight-color-transparent',
                  isActive ? 'text-accent' : 'text-muted-foreground active:bg-muted'
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn('w-6 h-6 transition-all duration-200', isActive && 'scale-110')}
                    strokeWidth={isActive ? 2.5 : 2}
                  />

                  {badge && (
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] 
                        flex items-center justify-center 
                        bg-danger text-white text-[10px] font-bold 
                        rounded-full px-1 animate-pulse-soft"
                      aria-hidden="true"
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>

                <span
                  className={cn(
                    'text-[10px] mt-1 font-medium transition-colors',
                    isActive ? 'text-accent' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}

          {/* Кнопка "Ещё" */}
          <button
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            aria-haspopup="true"
            aria-label={t('nav.more') || 'More options'}
            className={cn(
              'flex flex-col items-center justify-center',
              'min-w-[64px] min-h-[56px] py-2 px-3',
              'rounded-lg transition-all',
              'active:scale-95 tap-highlight-transparent',
              showMore || isMoreActive ? 'text-accent' : 'text-muted-foreground active:bg-muted'
            )}
          >
            <div className="relative">
              {showMore ? (
                <X className="w-6 h-6 transition-all duration-200" strokeWidth={2.5} />
              ) : (
                <MoreHorizontal
                  className={cn('w-6 h-6 transition-all duration-200', isMoreActive && 'scale-110')}
                  strokeWidth={isMoreActive ? 2.5 : 2}
                />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] mt-1 font-medium transition-colors',
                showMore || isMoreActive ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              {t('nav.more') || 'Ещё'}
            </span>
          </button>
        </div>
      </nav>
    </>
  )}