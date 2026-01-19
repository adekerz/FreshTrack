/**
 * Header Component
 * Responsive header with search, notifications, and user menu
 * Mobile-first design with collapsible search
 */

import { useState, useEffect } from 'react'
import { Menu, Search, X, Bell, Moon, Sun, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useProducts } from '../context/ProductContext'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import HotelSelector from './HotelSelector'
import Sidebar from './Sidebar'
import { cn } from '../utils/classNames'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const { getStats } = useProducts()
  
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  
  const stats = getStats()
  const alertCount = stats.critical + stats.expired

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
    <>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6">
          {/* Left section - Mobile menu + Hotel selector */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="sm:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label={t('nav.openMenu') || 'Open menu'}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Hotel Selector */}
            <div className="hidden xs:block">
              <HotelSelector />
            </div>
          </div>

          {/* Center - Search (desktop) */}
          <div className="hidden sm:flex flex-1 justify-center max-w-md mx-4">
            <GlobalSearch />
          </div>

          {/* Right section - Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile search toggle */}
            <button
              onClick={() => setShowMobileSearch(true)}
              className="sm:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label={t('search.open') || 'Search'}
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* User menu (desktop) */}
            <div className="relative hidden sm:block" data-user-menu>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                  <span className="text-accent font-medium text-sm">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground hidden md:inline max-w-[100px] truncate">
                  {user?.name?.split(' ')[0]}
                </span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform',
                  showUserMenu && 'rotate-180'
                )} />
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-lg border border-border py-2 animate-fade-in z-50">
                  {/* User info */}
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        navigate('/settings')
                        setShowUserMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      {t('nav.settings') || 'Settings'}
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-border pt-1">
                    <button
                      onClick={() => {
                        logout()
                        setShowUserMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('header.signOut') || 'Sign out'}
                    </button>
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
              <button
                onClick={() => setShowMobileSearch(false)}
                className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg"
                aria-label={t('common.close') || 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
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

      {/* Mobile Sidebar */}
      {showMobileSidebar && (
        <Sidebar 
          isOpen={showMobileSidebar} 
          onToggle={() => {}} 
          isMobile 
          onClose={() => setShowMobileSidebar(false)} 
        />
      )}
    </>
  )
}
