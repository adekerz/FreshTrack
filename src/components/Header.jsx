/**
 * Header Component
 * Responsive header with search, notifications, and user menu.
 * Mobile: Hamburger (opens MobileSidebar) + hotel selector + search + theme toggle.
 * Desktop: Hotel selector + search + notifications + user menu.
 */

import { useState, useEffect } from 'react'
import { Search, X, Moon, Sun, LogOut, Settings, ChevronDown, Menu, Building2, Users, HelpCircle, Accessibility } from 'lucide-react'
import Tooltip from './Tooltip'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import GlobalSearch from './GlobalSearch'
import HotelSelector from './HotelSelector'
import HeaderDepartmentSelector from './HeaderDepartmentSelector'
import { TouchButton } from './ui'
import { cn } from '../utils/classNames'

export default function Header({ onOpenMobileMenu, isMobileMenuOpen = false, onOpenHelp }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { theme, toggleTheme, highContrast, toggleHighContrast } = useTheme()

  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-user-menu]')) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Close mobile search on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowMobileSearch(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border" role="banner">
      <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6">

        {/* Left section - Hamburger (mobile) + selectors */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          {typeof onOpenMobileMenu === 'function' && (
            <Tooltip content={t('nav.openMenu') || 'Открыть меню'}>
              <span className="inline-flex sm:hidden">
                <TouchButton
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onOpenMobileMenu}
                  className="-ml-1 flex-shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={t('nav.openMenu') || 'Открыть меню'}
                  aria-expanded={isMobileMenuOpen}
                  aria-haspopup="true"
                  icon={Menu}
                />
              </span>
            </Tooltip>
          )}

          {/* Selectors hidden on mobile — they are in sidebar */}
          <div className="hidden sm:flex items-center gap-2">
            <HotelSelector />
            <span className="w-px h-5 bg-border flex-shrink-0" aria-hidden="true" />
            <HeaderDepartmentSelector />
          </div>
        </div>

        {/* Center - Search (desktop) */}
        <div className="hidden sm:flex flex-1 justify-center max-w-md mx-4">
          <GlobalSearch />
        </div>

        {/* Right section - Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Mobile search toggle */}
          <Tooltip content={t('search.open') || 'Поиск'}>
            <span className="inline-flex sm:hidden">
              <TouchButton
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileSearch(true)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t('search.open') || 'Поиск'}
                icon={Search}
              />
            </span>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip content={theme === 'dark' ? (t('theme.switchToLight') || 'Светлая тема') : (t('theme.switchToDark') || 'Тёмная тема')}>
            <span className="inline-flex">
              <TouchButton
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-muted-foreground hover:text-foreground"
                aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
                icon={theme === 'dark' ? Sun : Moon}
              />
            </span>
          </Tooltip>

          <Tooltip content={highContrast ? (t('theme.highContrastOff') || 'Выключить высокий контраст') : (t('theme.highContrast') || 'Высокий контраст')}>
            <span className="inline-flex">
              <TouchButton
                variant="ghost"
                size="icon"
                onClick={toggleHighContrast}
                className={highContrast ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}
                aria-label={highContrast ? (t('theme.highContrastOff') || 'Выключить высокий контраст') : (t('theme.highContrast') || 'Высокий контраст')}
                aria-pressed={highContrast}
                icon={Accessibility}
              />
            </span>
          </Tooltip>

          {/* Help center */}
          {typeof onOpenHelp === 'function' && (
            <Tooltip content={t('nav.helpCenter') || 'Помощь (?)'}>
              <span className="inline-flex">
                <TouchButton
                  variant="ghost"
                  size="icon"
                  onClick={onOpenHelp}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t('nav.helpCenter') || 'Помощь'}
                  icon={HelpCircle}
                />
              </span>
            </Tooltip>
          )}

          {/* User menu */}
          <div className="relative" data-user-menu>
            <TouchButton
              variant="ghost"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-1.5 px-2 py-2 min-h-[44px] rounded-lg hover:bg-muted"
              aria-expanded={showUserMenu}
              data-testid="user-menu-button"
              aria-haspopup="menu"
            >
              <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-medium text-sm">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground hidden md:inline max-w-[100px] truncate">
                {user?.name?.split(' ')[0]}
              </span>
              <ChevronDown className={cn(
                'w-4 h-4 text-muted-foreground transition-transform flex-shrink-0',
                showUserMenu && 'rotate-180'
              )} />
            </TouchButton>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] sm:w-72 bg-card rounded-xl shadow-lg border border-border py-2 animate-fade-in z-50 max-h-[min(80vh,400px)] overflow-y-auto">
                {/* User info */}
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{user?.roleLabel || user?.role}</p>

                  {user?.hotel && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-foreground truncate">{user.hotel.name}</span>
                      {user.hotel.marsha_code && (
                        <span className="text-xs text-muted-foreground">({user.hotel.marsha_code})</span>
                      )}
                    </div>
                  )}

                  {user?.department && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-foreground truncate">{user.department.name}</span>
                    </div>
                  )}
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <TouchButton
                    variant="ghost"
                    onClick={() => { navigate('/settings'); setShowUserMenu(false) }}
                    className="w-full justify-start gap-3 px-4 py-2 text-sm h-auto min-h-[44px] rounded-none"
                    icon={Settings}
                    iconPosition="left"
                  >
                    {t('nav.settings') || 'Настройки'}
                  </TouchButton>

                  <TouchButton
                    variant="ghost"
                    onClick={() => { navigate('/faq'); setShowUserMenu(false) }}
                    className="w-full justify-start gap-3 px-4 py-2 text-sm h-auto min-h-[44px] rounded-none"
                    icon={HelpCircle}
                    iconPosition="left"
                  >
                    {t('nav.faq') || 'Помощь'}
                  </TouchButton>
                </div>

                {/* Logout */}
                <div className="border-t border-border pt-1">
                  <TouchButton
                    variant="ghost"
                    onClick={() => {
                      logout()
                      setShowUserMenu(false)
                      navigate('/login')
                    }}
                    className="w-full justify-start gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10 h-auto min-h-[44px] rounded-none"
                    icon={LogOut}
                    iconPosition="left"
                    data-testid="logout-button"
                  >
                    {t('header.signOut') || 'Выйти'}
                  </TouchButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-50 bg-background sm:hidden animate-fade-in">
          <div className="flex items-center gap-3 p-3 border-b border-border">
            <Tooltip content={t('common.close') || 'Закрыть'}>
              <span className="inline-flex">
                <TouchButton
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileSearch(false)}
                  className="-ml-2 text-muted-foreground hover:text-foreground"
                  aria-label={t('common.close') || 'Закрыть'}
                  icon={X}
                />
              </span>
            </Tooltip>
            <div className="flex-1">
              <GlobalSearch
                autoFocus
                fullWidth
                onSearch={() => setShowMobileSearch(false)}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
