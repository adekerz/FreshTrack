import { useToast } from '../context/ToastContext'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { InlineLoader } from './ui'

// Компонент-обёртка для загрузочной иконки
const LoadingIcon = ({ className }) => (
  <span className={className}>
    <InlineLoader />
  </span>
)

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: LoadingIcon
}

const colors = {
  success: {
    bg: 'bg-success/10 border-success/30',
    icon: 'text-success',
    progress: 'bg-success'
  },
  error: {
    bg: 'bg-danger/10 border-danger/30',
    icon: 'text-danger',
    progress: 'bg-danger'
  },
  warning: {
    bg: 'bg-warning/10 border-warning/30',
    icon: 'text-warning',
    progress: 'bg-warning'
  },
  info: {
    bg: 'bg-accent/10 border-accent/30',
    icon: 'text-accent',
    progress: 'bg-accent'
  },
  loading: {
    bg: 'bg-gray-100 border-gray-300',
    icon: 'text-muted-foreground',
    progress: 'bg-muted-foreground'
  }
}

function ToastItem({ toast, onRemove }) {
  const Icon = icons[toast.type] || Info
  const color = colors[toast.type] || colors.info
  const isLoading = toast.type === 'loading'

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm
        animate-toast-in w-full sm:min-w-[300px] sm:max-w-[400px]
        ${color.bg}
        ${toast.type === 'success' ? 'animate-success-pop' : ''}
      `}
      role="alert"
    >
      {/* Иконка */}
      <div className={`flex-shrink-0 ${color.icon}`}>
        {isLoading ? (
          <InlineLoader />
        ) : (
          <Icon className={`w-5 h-5 ${toast.type === 'success' ? 'animate-success-pop' : ''}`} />
        )}
      </div>

      {/* Контент */}
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-medium text-foreground text-sm">{toast.title}</p>}
        {toast.message && <p className="text-muted-foreground text-sm mt-0.5">{toast.message}</p>}
      </div>

      {/* Кнопка закрытия */}
      {toast.type !== 'loading' && (
        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Прогресс бар */}
      {toast.duration && toast.type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl overflow-hidden">
          <div
            className={`h-full ${color.progress} animate-toast-progress`}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      )}
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-20 sm:bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2"
      aria-live="polite"
      aria-label="Уведомления"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}
