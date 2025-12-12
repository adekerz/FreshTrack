import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Bell, Calendar, Settings } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function BottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { getStats } = useProducts()
  const { t } = useTranslation()
  const stats = getStats()

  const unreadCount = stats.critical + stats.expired

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
    },
    {
      path: '/settings',
      icon: Settings,
      label: t('nav.settings') || 'Настройки'
    }
  ]

  // Найти индекс активного элемента
  const activeIndex = navItems.findIndex(item => 
    location.pathname === item.path || 
    (item.path !== '/' && location.pathname.startsWith(item.path))
  )

  const handleNavClick = (path) => {
    navigate(path)
    // Haptic feedback на поддерживаемых устройствах
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-taupe/10 shadow-elevated z-40 sm:hidden safe-bottom">
      {/* Анимированный индикатор сверху */}
      {activeIndex >= 0 && (
        <div 
          className="absolute top-0 h-0.5 bg-accent transition-all duration-300 ease-out"
          style={{ 
            width: `${100 / navItems.length}%`,
            left: `${(activeIndex * 100) / navItems.length}%`
          }}
        />
      )}
      
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ path, icon: Icon, label, badge }, index) => {
          const isActive = index === activeIndex

          return (
            <button
              key={path}
              onClick={() => handleNavClick(path)}
              className={cn(
                'flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-lg transition-all no-select relative',
                isActive ? 'text-accent' : 'text-charcoal/60 active:bg-sand/50'
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  'w-6 h-6 transition-all duration-300', 
                  isActive && 'scale-110 -translate-y-0.5'
                )} />

                {badge && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  'text-[10px] mt-1 font-medium transition-all',
                  isActive ? 'opacity-100' : 'opacity-70'
                )}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
