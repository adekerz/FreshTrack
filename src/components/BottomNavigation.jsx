import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Bell, MoreHorizontal, X, BarChart3, ClipboardList, FileText, Calendar, Settings, LogOut, User, Globe } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function BottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { getStats } = useProducts()
  const { user, logout, isHotelAdmin } = useAuth()
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()
  const stats = getStats()
  const [showMore, setShowMore] = useState(false)

  const unreadCount = stats.critical + stats.expired
  const isAdmin = isHotelAdmin()

  // Основные пункты навигации (4 пункта + "Ещё")
  const navItems = [
    {
      path: '/',
      icon: LayoutDashboard,
      label: t('nav.dashboard') || 'Главная'
    },
    {
      path: '/inventory',
      icon: Package,
      label: t('nav.inventory') || 'Инвентарь'
    },
    {
      path: '/notifications',
      icon: Bell,
      label: t('nav.notifications') || 'Уведомления',
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      path: '/calendar',
      icon: Calendar,
      label: t('nav.calendar') || 'Календарь'
    }
  ]

  // Дополнительные пункты меню (доступны через "Ещё")
  const moreItems = [
    {
      path: '/statistics',
      icon: BarChart3,
      label: t('nav.statistics') || 'Статистика',
      adminOnly: true
    },
    {
      path: '/collection-history',
      icon: ClipboardList,
      label: t('nav.collectionHistory') || 'История сборов',
      adminOnly: true
    },
    {
      path: '/audit-logs',
      icon: FileText,
      label: t('nav.auditLogs') || 'Журнал действий',
      adminOnly: true
    },
    {
      path: '/settings',
      icon: Settings,
      label: t('nav.settings') || 'Настройки',
      adminOnly: false
    }
  ].filter(item => !item.adminOnly || isAdmin)

  // Найти индекс активного элемента (включая moreItems)
  const activeIndex = navItems.findIndex(item => 
    location.pathname === item.path || 
    (item.path !== '/' && location.pathname.startsWith(item.path))
  )
  
  // Проверяем, активен ли какой-то из пунктов "Ещё"
  const isMoreActive = moreItems.some(item => 
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
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </div>
            </div>

            {/* Переключатель языка */}
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <Globe className="w-5 h-5 text-foreground" />
              <span className="text-sm font-medium text-foreground flex-1">{t('header.language') || 'Язык'}</span>
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => changeLanguage('ru')}
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                    language === 'ru' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  RU
                </button>
                <button
                  onClick={() => changeLanguage('kk')}
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                    language === 'kk' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  KZ
                </button>
                <button
                  onClick={() => changeLanguage('en')}
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                    language === 'en' ? 'bg-card text-accent shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Навигационные пункты */}
            {moreItems.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path || 
                (path !== '/' && location.pathname.startsWith(path))
              
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
                    className={cn(
                      'w-6 h-6 transition-all duration-200', 
                      isActive && 'scale-110'
                    )}
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
              (showMore || isMoreActive) ? 'text-accent' : 'text-muted-foreground active:bg-muted'
            )}
          >
            <div className="relative">
              {showMore ? (
                <X className="w-6 h-6 transition-all duration-200" strokeWidth={2.5} />
              ) : (
                <MoreHorizontal 
                  className={cn(
                    'w-6 h-6 transition-all duration-200',
                    isMoreActive && 'scale-110'
                  )}
                  strokeWidth={isMoreActive ? 2.5 : 2}
                />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] mt-1 font-medium transition-colors',
                (showMore || isMoreActive) ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              {t('nav.more') || 'Ещё'}
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
