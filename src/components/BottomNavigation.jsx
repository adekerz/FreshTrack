import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Bell, MoreHorizontal, X, BarChart3, ClipboardList, FileText, Calendar, Settings } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function BottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { getStats } = useProducts()
  const { user } = useAuth()
  const { t } = useTranslation()
  const stats = getStats()
  const [showMore, setShowMore] = useState(false)

  const unreadCount = stats.critical + stats.expired
  const isAdmin = ['SUPER_ADMIN', 'HOTEL_ADMIN'].includes(user?.role?.toUpperCase())

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
        <div className="fixed bottom-16 left-4 right-4 bg-white rounded-xl shadow-xl z-50 sm:hidden overflow-hidden animate-slide-up safe-bottom">
          <div className="p-2">
            {moreItems.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path || 
                (path !== '/' && location.pathname.startsWith(path))
              
              return (
                <button
                  key={path}
                  onClick={() => handleNavClick(path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive ? 'bg-accent/10 text-accent' : 'text-charcoal hover:bg-sand/50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-taupe/10 shadow-elevated z-40 sm:hidden safe-bottom">
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
        
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ path, icon: Icon, label, badge }, index) => {
            const isActive = index === activeIndex && !isMoreActive

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

          {/* Кнопка "Ещё" */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-lg transition-all no-select relative',
              (showMore || isMoreActive) ? 'text-accent' : 'text-charcoal/60 active:bg-sand/50'
            )}
          >
            <div className="relative">
              {showMore ? (
                <X className="w-6 h-6 transition-all duration-300" />
              ) : (
                <MoreHorizontal className={cn(
                  'w-6 h-6 transition-all duration-300',
                  isMoreActive && 'scale-110 -translate-y-0.5'
                )} />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] mt-1 font-medium transition-all',
                (showMore || isMoreActive) ? 'opacity-100' : 'opacity-70'
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
