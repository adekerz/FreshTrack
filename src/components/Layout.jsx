import { useState } from 'react'
import Sidebar from './Sidebar'
import MobileSidebar from './layout/MobileSidebar'
import MobileBottomNav from './layout/MobileBottomNav'
import Header from './Header'
import NotificationPermissionBanner from './NotificationPermissionBanner'
import Breadcrumbs from './Breadcrumbs'
import OnboardingTour from './OnboardingTour'
import { OfflineIndicator } from './ui'
import { useTranslation } from '../context/LanguageContext'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { t } = useTranslation()

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

      <main id="main-content" className="flex-1 overflow-auto pb-20 sm:pb-0" role="main">
        <Header />
        <div className="p-4 sm:p-8">
          <Breadcrumbs />
          {children}
        </div>
      </main>

      {/* Mobile bottom nav - только < lg (Phase 4) */}
      <MobileBottomNav />

      {/* Push Notification Permission Banner */}
      <NotificationPermissionBanner />

      {/* Onboarding Tour for New Users */}
      <OnboardingTour />

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
