import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
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

// Определяем базовый путь для GitHub Pages
const basename = import.meta.env.BASE_URL

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
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
  </React.StrictMode>
)
