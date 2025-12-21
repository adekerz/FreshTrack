import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNavigation from './BottomNavigation'
import NotificationPermissionBanner from './NotificationPermissionBanner'
import Breadcrumbs from './Breadcrumbs'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-cream flex overflow-x-hidden max-w-full">
      {/* Desktop Sidebar - скрыт на мобильных */}
      <div className="hidden sm:block">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </div>

      <main className="flex-1 overflow-auto pb-20 sm:pb-0">
        <Header />
        <div className="p-4 sm:p-8">
          <Breadcrumbs />
          {children}
        </div>
      </main>

      {/* Bottom Navigation - только на мобильных */}
      <BottomNavigation />

      {/* Push Notification Permission Banner */}
      <NotificationPermissionBanner />
    </div>
  )
}
