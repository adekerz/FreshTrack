/**
 * StatusBadge Component
 * Visual indicator for product/batch status
 * Follows Von Restorff Effect - distinct visual for attention
 */

import { Check, AlertTriangle, AlertCircle, X, Clock } from 'lucide-react'

const statusConfig = {
  good: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    icon: Check,
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-accent/10',
    text: 'text-accent',
    border: 'border-accent/20',
    icon: AlertCircle,
  },
  expired: {
    bg: 'bg-danger/10',
    text: 'text-danger',
    border: 'border-danger/20',
    icon: X,
  },
  today: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: Clock,
  },
  attention: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    icon: AlertTriangle,
  },
}

const sizes = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
}

export default function StatusBadge({ 
  status = 'good', 
  size = 'md',
  showIcon = true,
  daysLeft,
  children,
  className = '',
}) {
  const config = statusConfig[status] || statusConfig.good
  const Icon = config.icon

  const getDaysText = () => {
    if (daysLeft === undefined || daysLeft === null) return null
    if (daysLeft === 0) return 'Today'
    if (daysLeft > 0) return `+${daysLeft}d`
    return `${daysLeft}d`
  }

  const daysText = getDaysText()

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${config.bg} ${config.text} ${config.border}
        ${sizes[size]}
        ${className}
      `}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {children || daysText}
    </span>
  )
}
