/**
 * Per-route Error Boundary
 * Catches errors within route content without hiding navigation.
 * Global ErrorBoundary remains as final fallback.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // In production: send to Sentry via global captureException (if loaded)
    if (import.meta.env.PROD && typeof window !== 'undefined' && window.__SENTRY__) {
      try {
        window.__SENTRY__.hub?.getClient()?.captureException(error, {
          extra: { componentStack: errorInfo?.componentStack }
        })
      } catch {
        // Sentry SDK not properly initialized — safe to ignore
      }
    }

    if (import.meta.env.DEV) {
      console.error('RouteErrorBoundary caught error:', error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="bg-card rounded-2xl shadow-elevated p-8 max-w-md w-full text-center border border-border">
            <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-danger" />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">
              Что-то пошло не так
            </h2>

            <p className="text-muted-foreground mb-6">
              Произошла ошибка при загрузке страницы. Попробуйте снова или вернитесь на главную.
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 transition-colors min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4" />
                Попробовать снова
              </button>

              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors min-h-[44px]"
              >
                <Home className="w-4 h-4" />
                На главную
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default RouteErrorBoundary
