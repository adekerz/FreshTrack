import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, LogOut, Send, ChevronDown, Package, FolderPlus, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import AddBatchModal from './AddBatchModal'
import AddCustomProductModal from './AddCustomProductModal'
import LanguageSwitcher from './LanguageSwitcher'
import GlobalSearch from './GlobalSearch'
import { sendTestTelegramNotification } from '../services/api'

export default function Header({ onMenuClick }) {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddBatchModal, setShowAddBatchModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [telegramStatus, setTelegramStatus] = useState(null)
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
      <header className="bg-cream border-b border-sand px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        {/* Левая часть: гамбургер меню (мобильный) + заголовок */}
        <div className="flex items-center gap-4">
          {/* Гамбургер меню для мобильных */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 hover:bg-sand rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-charcoal" />
          </button>

          <div>
            <h1 className="font-serif text-xl lg:text-2xl">{getPageTitle()}</h1>
            <p className="text-xs lg:text-sm text-warmgray hidden sm:block">{getLocalizedDate()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Глобальный поиск (скрыт на маленьких экранах) */}
          <div className="hidden md:block">
            <GlobalSearch />
          </div>

          {/* Dropdown меню для добавления */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 text-sm text-charcoal hover:text-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('header.addBatch')}
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

          <button
            onClick={handleTestTelegram}
            disabled={telegramStatus === 'sending'}
            className={`flex items-center gap-2 text-sm transition-colors ${
              telegramStatus === 'success'
                ? 'text-success'
                : telegramStatus === 'error'
                  ? 'text-danger'
                  : 'text-charcoal hover:text-accent'
            }`}
            title={t('header.testTelegram')}
          >
            <Send className="w-4 h-4" />
            {telegramStatus === 'sending' ? '...' : t('header.testTelegram')}
          </button>

          <div className="h-8 w-px bg-sand" />

          <LanguageSwitcher />

          <div className="h-8 w-px bg-sand" />

          <div className="flex items-center gap-3">
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

      {showAddBatchModal && <AddBatchModal onClose={() => setShowAddBatchModal(false)} />}

      {showAddProductModal && (
        <AddCustomProductModal onClose={() => setShowAddProductModal(false)} />
      )}
    </>
  )
}
