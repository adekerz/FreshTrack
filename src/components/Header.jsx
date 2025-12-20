import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, LogOut, Send, ChevronDown, Package, FolderPlus, Leaf, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import AddBatchModal from './AddBatchModal'
import AddCustomProductModal from './AddCustomProductModal'
import LanguageSwitcher from './LanguageSwitcher'
import GlobalSearch from './GlobalSearch'
import { sendTestTelegramNotification } from '../services/api'

export default function Header() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState(null)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const dropdownRef = useRef(null)

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
    return 'FreshTrack'
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
      <header className="bg-cream border-b border-sand px-4 lg:px-8 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10">
        {/* Левая часть: лого на мобилке + заголовок */}
        <div className="flex items-center gap-3">
          {/* Лого - только на мобильных */}
          <div className="sm:hidden flex items-center gap-2">
            <div className="w-8 h-8 border border-accent flex items-center justify-center flex-shrink-0">
              <Leaf className="w-4 h-4 text-accent" />
            </div>
          </div>
          
          <div className="hidden sm:block">
            <h1 className="font-serif text-lg sm:text-xl lg:text-2xl">{getPageTitle()}</h1>
            <p className="text-xs lg:text-sm text-warmgray">{getLocalizedDate()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Кнопка поиска - только на мобильных */}
          <button
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="sm:hidden p-2 hover:bg-sand rounded transition-colors"
            aria-label={t('search.placeholder')}
          >
            <Search className={`w-5 h-5 ${showMobileSearch ? 'text-accent' : 'text-charcoal'}`} />
          </button>

          {/* Глобальный поиск - только на десктопе */}
          <div className="hidden sm:block">
            <GlobalSearch />
          </div>

          {/* Dropdown меню для добавления */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1 sm:gap-2 text-sm text-charcoal hover:text-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.addBatch')}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-cream border border-sand rounded-lg shadow-lg py-2 z-50">
                <button
                  onClick={() => {
                    setShowAddBatchModal(true)
                    setShowDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-charcoal hover:bg-sand/50 transition-colors text-left"
                >
                  <Package className="w-4 h-4 text-accent" />
                  <div>
                    <p className="font-medium">{t('header.addBatch')}</p>
                    <p className="text-xs text-warmgray">{t('header.addBatchDesc')}</p>
                  </div>
                </button>
                <div className="h-px bg-sand mx-3 my-1" />
                <button
                  onClick={() => {
                    setShowAddProductModal(true)
                    setShowDropdown(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-charcoal hover:bg-sand/50 transition-colors text-left"
                >
                  <FolderPlus className="w-4 h-4 text-success" />
                  <div>
                    <p className="font-medium">{t('header.newProduct')}</p>
                    <p className="text-xs text-warmgray">{t('header.newProductDesc')}</p>
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
                  : 'text-charcoal hover:text-accent'
            }`}
            title={t('header.testTelegram')}
          >
            <Send className="w-4 h-4" />
            <span className="hidden lg:inline">{telegramStatus === 'sending' ? '...' : t('header.testTelegram')}</span>
          </button>

          <div className="hidden sm:block h-8 w-px bg-sand" />

          {/* Language switcher - только на десктопе */}
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>

          <div className="hidden sm:block h-8 w-px bg-sand" />

          {/* User info - скрыто на мобильных, доступно через More меню */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-warmgray">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-sand rounded transition-colors"
              title={t('header.signOut')}
            >
              <LogOut className="w-4 h-4 text-warmgray" />
            </button>
          </div>
        </div>
      </header>

      {/* Мобильный поиск - раскрывается под хедером */}
      {showMobileSearch && (
        <div className="sm:hidden bg-cream border-b border-sand px-4 py-3 sticky top-[57px] z-10">
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
