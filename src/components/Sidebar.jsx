import { useLocation, useNavigate } from 'react-router-dom'
import { Leaf, PanelLeftClose, PanelLeftOpen, X, LogOut, Globe } from 'lucide-react'
import TouchButton from './ui/TouchButton'
import Tooltip from './Tooltip'
import { useProducts } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useBranding } from '../context/BrandingContext'
import { getStaticUrl } from '../services/api'
import { cn } from '../utils/classNames'
import { mainNavItems, moreNavItems, filterNavByRole } from '../config/navigation'
import HotelSelector from './HotelSelector'
import HeaderDepartmentSelector from './HeaderDepartmentSelector'

export default function Sidebar({ isOpen, onToggle, isMobile = false, onClose, embedded = false }) {
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
  // Только отчёты - настройки убраны (доступны через dropdown в Header)
  const reportItems = filterNavByRole(moreNavItems, userRole, navOptions)
    .filter((item) => item.group === 'reports')
    .map((item) => ({
      path: item.path,
      icon: item.icon,
      label: t(item.labelKey) || item.fallbackLabel,
      onboardingId: item.id
    }))

  // Группируем для sidebar (без настроек - они в dropdown меню справа)
  const navGroups = [
    {
      label: null,
      items: mainItems
    },
    {
      label: t('nav.reports') || 'Отчёты',
      items: reportItems
    }
  ].filter((group) => group.items.length > 0)

  const isActive = (path) => {
    // Exact match for home page
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard'
    }
    // For other paths, check exact match or if pathname starts with path + '/'
    // This prevents '/' from matching '/inventory', '/settings', etc.
    return location.pathname === path || location.pathname.startsWith(path + '/')
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
      {/* Оверлей для мобильной версии (пропускаем при embedded — оверлей у MobileSidebar) */}
      {isMobile && isOpen && !embedded && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'bg-charcoal text-cream transition-all duration-300 flex flex-col h-full',
          embedded && 'relative w-full',
          // Мобильная версия (не embedded)
          isMobile && !embedded
            ? cn(
              'fixed left-0 top-0 bottom-0 z-50 w-72',
              isOpen ? 'translate-x-0' : '-translate-x-full'
            )
            : !embedded && cn(
              // Десктопная версия
              isOpen ? 'w-64' : 'w-20'
            )
        )}
      >
        {/* Logo */}
        {!embedded && (
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

            {/* Кнопка закрытия для мобильной версии (не показываем при embedded) */}
            {isMobile && !embedded && (
              <Tooltip content={t('common.close') || 'Закрыть меню'}>
                <span className="inline-flex">
                  <TouchButton
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded text-cream/80 hover:text-cream"
                    aria-label={t('common.close') || 'Закрыть меню'}
                    icon={X}
                  />
                </span>
              </Tooltip>
            )}
          </div>
        )}

        {/* Селекторы отеля и департамента (только мобильная версия) */}
        {isMobile && (
          <div className="px-3 pb-2 space-y-2">
            <HotelSelector className="w-full max-w-none" />
            <HeaderDepartmentSelector className="w-full max-w-none" />
          </div>
        )}

        {/* Main Navigation - Grouped */}
        <nav className={cn('flex-1 overflow-y-auto', embedded ? 'px-3 pt-2 pb-4' : 'px-3 py-4')}>
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
                      <TouchButton
                        variant="ghost"
                        onClick={() => handleNavClick(item.path)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group h-auto min-h-[44px] justify-start',
                          isActive(item.path)
                            ? 'bg-accent/10 text-accent border-l-4 border-accent -ml-px pl-[15px]'
                            : 'hover:bg-white/5 text-cream/80 hover:text-cream'
                        )}
                        title={!isOpen && !isMobile ? item.label : undefined}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                        data-onboarding={item.onboardingId || undefined}
                        icon={item.icon}
                        iconPosition="left"
                      >
                        {(isOpen || isMobile) && (
                          <span className="flex-1 text-left font-medium">{item.label}</span>
                        )}
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
                      </TouchButton>
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
                  <TouchButton
                    key={lang.code}
                    variant="ghost"
                    size="small"
                    onClick={() => changeLanguage(lang.code)}
                    className={cn(
                      'flex items-center justify-center gap-0.5 px-1.5 py-1.5 text-xs min-h-0 h-auto',
                      language === lang.code
                        ? 'bg-accent-button text-white font-medium'
                        : 'text-cream/60 hover:text-cream hover:bg-white/10'
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </TouchButton>
                ))}
              </div>
            </div>

            {/* Информация о пользователе */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                <span className="text-accent font-medium">{user.name?.charAt(0) || 'U'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-cream/60 truncate">{user.role}</p>
              </div>
            </div>

            {/* Кнопка выхода */}
            <TouchButton
              variant="ghost"
              onClick={() => {
                logout()
                if (onClose) onClose()
              }}
              className="w-full justify-start gap-3 px-2 py-3 mt-2 text-cream/60 hover:text-danger hover:bg-white/5 rounded h-auto min-h-[44px]"
              icon={LogOut}
              iconPosition="left"
            >
              {t('header.signOut')}
            </TouchButton>
          </div>
        )}

        {/* Toggle Button (только для десктопа, не при embedded) */}
        {!isMobile && !embedded && (
          <div className="p-4 border-t border-white/10">
            <Tooltip content={isOpen ? (t('sidebar.collapse') || 'Свернуть') : (t('sidebar.expand') || 'Развернуть')}>
              <span className="inline-flex w-full justify-center">
                <TouchButton
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="w-full rounded text-cream/80 hover:text-cream hover:bg-white/5"
                  aria-label={isOpen ? t('sidebar.collapse') : t('sidebar.expand')}
                  icon={isOpen ? PanelLeftClose : PanelLeftOpen}
                />
              </span>
            </Tooltip>
          </div>
        )}
      </aside>
    </>
  )
}
