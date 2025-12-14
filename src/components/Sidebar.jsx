import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Bell,
  Leaf,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  BarChart3,
  Settings,
  Calendar,
  FileText,
  X
} from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function Sidebar({ isOpen, onToggle, isMobile = false, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { getStats, getUnreadNotificationsCount } = useProducts()
  const { user } = useAuth()
  const { t } = useTranslation()
  const stats = getStats()

  // Количество непрочитанных уведомлений (или критичных + просроченных)
  const unreadCount =
    typeof getUnreadNotificationsCount === 'function'
      ? getUnreadNotificationsCount()
      : stats.critical + stats.expired

  // Основные пункты меню (убраны пункты связанные с отделами)
  const navItems = [
    {
      path: '/',
      icon: LayoutDashboard,
      label: t('nav.dashboard'),
      roles: ['admin', 'manager']
    },
    {
      path: '/inventory',
      icon: Package,
      label: t('nav.inventory'),
      roles: ['admin', 'manager']
    },
    {
      path: '/notifications',
      icon: Bell,
      label: t('nav.notifications'),
      badge: unreadCount > 0 ? unreadCount : null,
      roles: ['admin', 'manager']
    },
    {
      path: '/calendar',
      icon: Calendar,
      label: t('nav.calendar') || 'Календарь',
      roles: ['admin', 'manager']
    },
    {
      path: '/statistics',
      icon: BarChart3,
      label: t('nav.statistics'),
      roles: ['admin', 'manager']
    },
    {
      path: '/collection-history',
      icon: ClipboardList,
      label: t('nav.collectionHistory'),
      roles: ['admin'] // Только для админа
    },
    {
      path: '/audit-logs',
      icon: FileText,
      label: t('nav.auditLogs') || 'Журнал действий',
      roles: ['admin']
    },
    {
      path: '/settings',
      icon: Settings,
      label: t('nav.settings'),
      roles: ['admin', 'manager']
    }
  ]

  // Фильтруем пункты меню по роли пользователя
  const filteredNavItems = navItems.filter((item) => {
    if (!user) return false
    // Нормализуем роль для сравнения (admin/Administrator -> admin, manager/Manager -> manager)
    const normalizedRole = user.role?.toLowerCase().replace('istrator', '')
    return item.roles.includes(normalizedRole)
  })

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  // Обработчик клика по пункту меню
  const handleNavClick = (path) => {
    navigate(path)
    // На мобильных закрываем sidebar после перехода
    if (isMobile && onClose) {
      onClose()
    }
  }

  return (
    <>
      {/* Оверлей для мобильной версии */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 bg-charcoal/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'bg-charcoal text-cream transition-all duration-300 flex flex-col h-full',
          // Мобильная версия
          isMobile
            ? cn(
                'fixed left-0 top-0 bottom-0 z-50 w-72',
                isOpen ? 'translate-x-0' : '-translate-x-full'
              )
            : cn(
                // Десктопная версия
                isOpen ? 'w-64' : 'w-20'
              )
        )}
      >
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-accent flex items-center justify-center flex-shrink-0">
              <Leaf className="w-5 h-5 text-accent" />
            </div>
            {(isOpen || isMobile) && (
              <span className="font-serif text-xl tracking-wide">{t('common.appName')}</span>
            )}
          </div>

          {/* Кнопка закрытия для мобильной версии */}
          {isMobile && (
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => handleNavClick(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded transition-colors relative',
                    isActive(item.path) ? 'bg-white/10 text-accent' : 'hover:bg-white/5'
                  )}
                  title={!isOpen && !isMobile ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {(isOpen || isMobile) && <span className="flex-1 text-left">{item.label}</span>}
                  {/* Бейдж для уведомлений */}
                  {item.badge && (
                    <span
                      className={cn(
                        'bg-danger text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center',
                        !isOpen && !isMobile && 'absolute -top-1 -right-1 text-[10px] px-1.5'
                      )}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info (мобильная версия) */}
        {isMobile && user && (
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                <span className="text-accent font-medium">{user.name?.charAt(0) || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-warmgray truncate">{user.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button (только для десктопа) */}
        {!isMobile && (
          <div className="p-4 border-t border-white/10">
            <button
              onClick={onToggle}
              className="w-full flex items-center justify-center p-2 hover:bg-white/5 rounded transition-colors"
              title={isOpen ? t('sidebar.collapse') : t('sidebar.expand')}
            >
              {isOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
