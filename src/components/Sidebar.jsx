import { useLocation, useNavigate } from 'react-router-dom'
import { Leaf, PanelLeftClose, PanelLeftOpen, X, LogOut, Globe } from 'lucide-react'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useBranding } from '../context/BrandingContext'
import { getStaticUrl } from '../services/api'
import { cn } from '../utils/classNames'
import { mainNavItems, moreNavItems, filterNavByRole } from '../config/navigation'

export default function Sidebar({ isOpen, onToggle, isMobile = false, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { getStats, getUnreadNotificationsCount } = useProducts()
  const { user, logout, hasPermission, getCapabilities } = useAuth()
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()
  const { siteName, logoUrl } = useBranding()
  const stats = getStats()

  // Количество непрочитанных уведомлений (или критичных + просроченных)
  const unreadCount =
    typeof getUnreadNotificationsCount === 'function'
      ? getUnreadNotificationsCount()
      : stats.critical + stats.expired

  const userRole = user?.role
  const capabilities = getCapabilities()
  const navOptions = {
    capabilities,
    permissions: user?.permissions || [],
    hasPermission
  }

  // Основные пункты навигации из централизованной конфигурации
  const mainItems = mainNavItems.map((item) => ({
    path: item.path,
    icon: item.icon,
    label: t(item.labelKey) || item.fallbackLabel,
    badge: item.hasBadge && unreadCount > 0 ? unreadCount : null,
    onboardingId: item.id
  }))

  // Дополнительные пункты - фильтруем по роли/permissions из централизованной конфигурации
  const reportItems = filterNavByRole(moreNavItems, userRole, navOptions)
    .filter((item) => item.group === 'reports')
    .map((item) => ({
      path: item.path,
      icon: item.icon,
      label: t(item.labelKey) || item.fallbackLabel,
      onboardingId: item.id
    }))

  const settingsItem = filterNavByRole(moreNavItems, userRole, navOptions)
    .filter((item) => item.group === 'system')
    .map((item) => ({
      path: item.path,
      icon: item.icon,
      label: t(item.labelKey) || item.fallbackLabel
    }))

  // Группируем для sidebar
  const navGroups = [
    {
      label: null,
      items: mainItems
    },
    {
      label: t('nav.reports') || 'Отчёты',
      items: reportItems
    },
    {
      label: null,
      items: settingsItem
    }
  ].filter((group) => group.items.length > 0)

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
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
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
            <div className="w-10 h-10 border border-accent flex items-center justify-center flex-shrink-0 overflow-hidden">
              {logoUrl ? (
                <img
                  src={getStaticUrl(logoUrl)}
                  alt={siteName || 'Logo'}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'block'
                  }}
                />
              ) : null}
              <Leaf className={`w-5 h-5 text-accent ${logoUrl ? 'hidden' : ''}`} />
            </div>
            {(isOpen || isMobile) && (
              <span className="font-serif text-xl tracking-wide">
                {siteName || t('common.appName')}
              </span>
            )}
          </div>

          {/* Кнопка закрытия для мобильной версии */}
          {isMobile && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded transition-colors"
              aria-label={t('common.close') || 'Close menu'}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Main Navigation - Grouped */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navGroups.map((group, groupIndex) => {
            // Элементы уже отфильтрованы по роли из централизованной конфигурации
            const items = group.items
            if (items.length === 0) return null

            return (
              <div key={groupIndex} className={groupIndex > 0 ? 'mt-6' : ''}>
                {/* Group label */}
                {group.label && (isOpen || isMobile) && (
                  <p className="px-4 mb-2 text-xs font-medium text-cream/60 uppercase tracking-wider">
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
                        data-onboarding={item.onboardingId || undefined}
                      >
                        <item.icon
                          className={cn(
                            'w-5 h-5 flex-shrink-0 transition-transform duration-200',
                            isActive(item.path) ? '' : 'group-hover:scale-110'
                          )}
                        />
                        {(isOpen || isMobile) && (
                          <span className="flex-1 text-left font-medium">{item.label}</span>
                        )}
                        {/* Badge for notifications */}
                        {item.badge && (
                          <span
                            className={cn(
                              'bg-danger text-white text-xs font-medium rounded-full min-w-[20px] flex items-center justify-center',
                              isOpen || isMobile
                                ? 'px-2 py-0.5 h-5'
                                : 'absolute -top-1 -right-1 text-[10px] px-1.5 h-4 min-w-[16px]'
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
            {/* Переключатель языка - все 8 языков */}
            <div className="px-2 py-2 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-cream/60" />
                <span className="text-xs text-cream/60 uppercase tracking-wide">
                  {t('header.language') || 'Язык'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
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
                      'flex items-center justify-center gap-0.5 px-1.5 py-1.5 text-xs rounded transition-colors',
                      language === lang.code
                        ? 'bg-accent text-white font-medium'
                        : 'text-cream/60 hover:text-cream hover:bg-white/10'
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
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
                <p className="text-xs text-cream/60 truncate">{user.role}</p>
              </div>
            </div>

            {/* Кнопка выхода */}
            <button
              onClick={() => {
                logout()
                if (onClose) onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 mt-2 text-cream/60 hover:text-danger hover:bg-white/5 rounded transition-colors"
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
