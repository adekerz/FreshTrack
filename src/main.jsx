import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/queryClient'
import { setupPersistence } from './lib/queryPersistence'
import { setupAutoSync } from './lib/offlineSync'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ProductProvider } from './context/ProductContext'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { BrandingProvider } from './context/BrandingContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { HotelProvider } from './context/HotelContext'
import ToastContainer from './components/Toast'
import './styles/index.css'
import './styles/loader.css'

// Initialize Axe accessibility testing in development
if (import.meta.env.MODE === 'development') {
  import('./utils/axeAccessibility').then(({ initAxe }) => {
    initAxe()
  })
}

// Setup query persistence for offline support
setupPersistence(queryClient)

// Setup auto sync for offline mutations
setupAutoSync()

// Определяем базовый путь для GitHub Pages
const basename = import.meta.env.BASE_URL

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        basename={basename}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <AuthProvider>
                <HotelProvider>
                  <BrandingProvider>
                    <NotificationsProvider>
                      <ProductProvider>
                        <OnboardingProvider>
                          <App />
                          <ToastContainer />
                        </OnboardingProvider>
                      </ProductProvider>
                    </NotificationsProvider>
                  </BrandingProvider>
                </HotelProvider>
              </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
      {/* React Query DevTools - только в development */}
      {import.meta.env.MODE === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
      )}
    </QueryClientProvider>
  </React.StrictMode>
)
