import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import MobileSidebar from './layout/MobileSidebar'
import Header from './Header'
import HelpCenter from './HelpCenter'
import NotificationPermissionBanner from './NotificationPermissionBanner'
import MFAGracePeriodBanner from './MFAGracePeriodBanner'
import Breadcrumbs from './Breadcrumbs'
import OnboardingTour from './OnboardingTour'
import { OfflineIndicator } from './ui'
import { useTranslation } from '../context/LanguageContext'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { t } = useTranslation()

  // Горячая клавиша ? — открыть центр помощи
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        setHelpOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden max-w-full transition-colors duration-300">
      {/* Offline Indicator - показывается когда нет сети */}
      <OfflineIndicator />

      {/* Skip Link for Keyboard Navigation (A11Y) */}
      <a 
        href="#main-content" 
        className="skip-link"
        tabIndex={0}
      >
        {t('a11y.skipToContent') || 'Skip to main content'}
      </a>

      {/* Mobile Sidebar - hamburger, slide-in, swipe-to-close */}
      <MobileSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onOpen={() => setMobileSidebarOpen(true)}
      >
        <Sidebar
          isMobile
          embedded
          isOpen
          onClose={() => setMobileSidebarOpen(false)}
        />
      </MobileSidebar>

      {/* Desktop Sidebar - скрыт на мобильных */}
      <div className="hidden sm:block">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </div>

      {/* Область контента: Header (banner) и main — отдельные landmarks (axe: banner is top-level) */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <Header
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          isMobileMenuOpen={mobileSidebarOpen}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <main id="main-content" className="flex-1 min-w-0 overflow-auto min-h-0" role="main">
          <div className="min-w-0 p-4 sm:p-8">
            <MFAGracePeriodBanner />
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      {/* Push Notification Permission Banner */}
      <NotificationPermissionBanner />

      {/* Onboarding Tour for New Users */}
      <OnboardingTour />

      {/* Центр помощи (модальное окно) */}
      <HelpCenter isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ARIA Live Region for dynamic announcements */}
      <div 
        id="aria-live-region" 
        aria-live="polite" 
        aria-atomic="true" 
        className="aria-live-polite"
      />
    </div>
  )
}
