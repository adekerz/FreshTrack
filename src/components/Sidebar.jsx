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
  X,
  LogOut,
  Globe
} from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function Sidebar({ isOpen, onToggle, isMobile = false, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { getStats, getUnreadNotificationsCount } = useProducts()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()
  const stats = getStats()

  // Количество непрочитанных уведомлений (или критичных + просроченных)
  const unreadCount =
    typeof getUnreadNotificationsCount === 'function'
      ? getUnreadNotificationsCount()
      : stats.critical + stats.expired

  // Menu items grouped by category (Miller's Law - chunking)
  const navGroups = [
    {
      label: null, // Main navigation - no label
      items: [
        {
          path: '/',
          icon: LayoutDashboard,
          label: t('nav.dashboard'),
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'STAFF']
        },
        {
          path: '/inventory',
          icon: Package,
          label: t('nav.inventory'),
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'STAFF']
        },
        {
          path: '/notifications',
          icon: Bell,
          label: t('nav.notifications'),
          badge: unreadCount > 0 ? unreadCount : null,
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'STAFF']
        },
        {
          path: '/calendar',
          icon: Calendar,
          label: t('nav.calendar') || 'Calendar',
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN', 'STAFF']
        }
      ]
    },
    {
      label: t('nav.reports') || 'Reports',
      items: [
        {
          path: '/statistics',
          icon: BarChart3,
          label: t('nav.statistics'),
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN']
        },
        {
          path: '/collection-history',
          icon: ClipboardList,
          label: t('nav.collectionHistory'),
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN']
        },
        {
          path: '/audit-logs',
          icon: FileText,
          label: t('nav.auditLogs') || 'Audit Log',
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN']
        }
      ]
    },
    {
      label: null,
      items: [
        {
          path: '/settings',
          icon: Settings,
          label: t('nav.settings'),
          roles: ['SUPER_ADMIN', 'HOTEL_ADMIN']
        }
      ]
    }
  ]

  // Filter menu items by user role
  const filterByRole = (items) => {
    if (!user) return []
    const userRole = user.role?.toUpperCase()
    return items.filter(item => item.roles.includes(userRole))
  }

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

        {/* Main Navigation - Grouped */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navGroups.map((group, groupIndex) => {
            const items = filterByRole(group.items)
            if (items.length === 0) return null
            
            return (
              <div key={groupIndex} className={groupIndex > 0 ? 'mt-6' : ''}>
                {/* Group label */}
                {group.label && (isOpen || isMobile) && (
                  <p className="px-4 mb-2 text-xs font-medium text-warmgray uppercase tracking-wider">
                    {group.label}
                  </p>
                )}
                {group.label && !isOpen && !isMobile && (
                  <div className="h-px bg-white/10 mx-4 my-2" />
                )}
                
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.path}>
                      <button
                        onClick={() => handleNavClick(item.path)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group',
                          isActive(item.path) 
                            ? 'bg-accent/10 text-accent border-l-4 border-accent -ml-px pl-[15px]' 
                            : 'hover:bg-white/5 text-cream/80 hover:text-cream'
                        )}
                        title={!isOpen && !isMobile ? item.label : undefined}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                      >
                        <item.icon className={cn(
                          'w-5 h-5 flex-shrink-0 transition-transform duration-200',
                          isActive(item.path) ? '' : 'group-hover:scale-110'
                        )} />
                        {(isOpen || isMobile) && (
                          <span className="flex-1 text-left font-medium">{item.label}</span>
                        )}
                        {/* Badge for notifications */}
                        {item.badge && (
                          <span
                            className={cn(
                              'bg-danger text-white text-xs font-medium rounded-full min-w-[20px] text-center',
                              isOpen || isMobile 
                                ? 'px-2 py-0.5' 
                                : 'absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5'
                            )}
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* User info (мобильная версия) */}
        {isMobile && user && (
          <div className="px-4 py-4 border-t border-white/10">
            {/* Переключатель языка */}
            <div className="flex items-center gap-2 px-4 py-2 mb-2">
              <Globe className="w-4 h-4 text-warmgray" />
              <div className="flex gap-1">
                {['ru', 'en', 'kk'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-colors',
                      language === lang
                        ? 'bg-accent text-charcoal font-medium'
                        : 'text-warmgray hover:text-cream'
                    )}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Информация о пользователе */}
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                <span className="text-accent font-medium">{user.name?.charAt(0) || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-warmgray truncate">{user.role}</p>
              </div>
            </div>
            
            {/* Кнопка выхода */}
            <button
              onClick={() => {
                logout()
                if (onClose) onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 mt-2 text-warmgray hover:text-danger hover:bg-white/5 rounded transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>{t('header.signOut')}</span>
            </button>
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
