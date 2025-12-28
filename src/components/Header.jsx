import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, LogOut, Send, ChevronDown, Package, FolderPlus, Leaf, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useBranding } from '../context/BrandingContext'
import AddBatchModal from './AddBatchModal'
import AddCustomProductModal from './AddCustomProductModal'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import { sendTestTelegramNotification } from '../services/api'

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, hotelName } = useAuth()
  const { getExpiringBatches } = useProducts()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { siteName } = useBranding()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState(null)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const dropdownRef = useRef(null)

  // Count of expiring items for notification badge
  const expiringCount = getExpiringBatches?.()?.length || 0

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getPageTitle = () => {
    if (location.pathname === '/') return t('nav.dashboard')
    if (location.pathname.startsWith('/inventory')) return t('nav.inventory')
    if (location.pathname === '/notifications/history') return t('notificationHistory.title')
    if (location.pathname === '/notifications') return t('nav.notifications')
    if (location.pathname === '/collection-history') return t('nav.collectionHistory')
    if (location.pathname === '/statistics') return t('nav.statistics')
    if (location.pathname === '/analytics') return t('nav.analytics')
    if (location.pathname === '/settings') return t('nav.settings')
    return siteName || 'FreshTrack'
  }

  // Форматирование даты в зависимости от языка
  const getLocalizedDate = () => {
    const localeMap = {
      en: 'en-US',
      ru: 'ru-RU',
      kk: 'kk-KZ'
    }
    return new Date().toLocaleDateString(localeMap[language] || 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Тестовая отправка уведомления в Telegram
  const handleTestTelegram = async () => {
    try {
      setTelegramStatus('sending')
      await sendTestTelegramNotification()
      setTelegramStatus('success')
      setTimeout(() => setTelegramStatus(null), 3000)
    } catch (error) {
      setTelegramStatus('error')
      setTimeout(() => setTelegramStatus(null), 3000)
    }
  }

  return (
    <>
      <header className="bg-card border-b border-border px-4 lg:px-8 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10 transition-colors duration-300">
        {/* Left side: logo on mobile + title */}
        <div className="flex items-center gap-3">
          {/* Logo - mobile only */}
          <div className="sm:hidden flex items-center gap-2">
            <div className="w-8 h-8 border border-accent flex items-center justify-center flex-shrink-0">
              <Leaf className="w-4 h-4 text-accent" />
            </div>
          </div>
          
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-lg sm:text-xl lg:text-2xl">{getPageTitle()}</h1>
              {hotelName && (
                <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full hidden lg:inline-block">
                  {hotelName}
                </span>
              )}
            </div>
            <p className="text-xs lg:text-sm text-muted-foreground">{getLocalizedDate()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {/* Mobile search button */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="sm:hidden p-2 hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('search.placeholder')}
          >
            <Search className={`w-5 h-5 ${showMobileSearch ? 'text-accent' : 'text-foreground'}`} />
          </button>

          {/* Global search - desktop only */}
          <div className="hidden sm:flex items-center">
            <GlobalSearch />
          </div>

          {/* Theme switcher */}
          <ThemeSwitcher variant="toggle" />

          {/* Real-time Notification bell with SSE */}
          <NotificationBell />

          {/* Add dropdown menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1 sm:gap-2 text-sm text-foreground hover:text-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.addBatch')}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
                <button
                  onClick={() => {
                    setShowAddBatchModal(true)
                    setShowDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <Package className="w-4 h-4 text-accent" />
                  <div>
                    <p className="font-medium">{t('header.addBatch')}</p>
                    <p className="text-xs text-muted-foreground">{t('header.addBatchDesc')}</p>
                  </div>
                </button>
                <div className="h-px bg-border mx-3 my-1" />
                <button
                  onClick={() => {
                    setShowAddProductModal(true)
                    setShowDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                >
                  <FolderPlus className="w-4 h-4 text-success" />
                  <div>
                    <p className="font-medium">{t('header.newProduct')}</p>
                    <p className="text-xs text-muted-foreground">{t('header.newProductDesc')}</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Telegram test */}
          <button
            onClick={handleTestTelegram}
            disabled={telegramStatus === 'sending'}
            className={`flex items-center gap-1 sm:gap-2 text-sm transition-colors ${
              telegramStatus === 'success'
                ? 'text-success'
                : telegramStatus === 'error'
                  ? 'text-danger'
                  : 'text-foreground hover:text-accent'
            }`}
            title={t('header.testTelegram')}
          >
            <Send className="w-4 h-4" />
            <span className="hidden lg:inline">{telegramStatus === 'sending' ? '...' : t('header.testTelegram')}</span>
          </button>

          <div className="hidden sm:block h-8 w-px bg-border" />

          {/* Language switcher - только на десктопе */}
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

          <div className="hidden sm:block h-8 w-px bg-border" />

          {/* User info - скрыто на мобильных, доступно через More меню */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-muted rounded transition-colors"
              title={t('header.signOut')}
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Мобильный поиск - раскрывается под хедером */}
      {showMobileSearch && (
        <div className="sm:hidden bg-card border-b border-border px-4 py-3 sticky top-[57px] z-10">
          <GlobalSearch 
            onSearch={() => setShowMobileSearch(false)} 
            autoFocus 
            fullWidth 
          />
        </div>
      )}

      {showAddBatchModal && <AddBatchModal onClose={() => setShowAddBatchModal(false)} />}

      {showAddProductModal && (
        <AddCustomProductModal onClose={() => setShowAddProductModal(false)} />
      )}
    </>
  )
}
