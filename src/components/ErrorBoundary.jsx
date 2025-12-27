/**
 * FreshTrack Error Boundary
 * Catches React rendering errors and displays fallback UI
 */

import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    
    // Log error in development only
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught error:', error, errorInfo)
    }
    
    // TODO: Send to error monitoring service in production
    // e.g., Sentry.captureException(error, { extra: errorInfo })
  }

  handleRefresh = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-cream dark:bg-dark-bg flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-elevated p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-danger" />
            </div>
            
            <h1 className="text-xl font-semibold text-charcoal dark:text-cream mb-2">
              Что-то пошло не так
            </h1>
            
            <p className="text-warmgray dark:text-dark-text mb-6">
              Произошла непредвиденная ошибка. Попробуйте обновить страницу.
            </p>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-warmgray hover:text-charcoal">
                  Подробности ошибки
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-dark-bg rounded-lg text-xs overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Обновить
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 border border-sand dark:border-dark-border text-charcoal dark:text-cream rounded-lg hover:bg-sand/20 transition-colors"
              >
                <Home className="w-4 h-4" />
                На главную
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
