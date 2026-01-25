/**
 * EmptyState Component
 * Shown when there's no data to display
 * Clear CTA for next action
 */

import { Package } from 'lucide-react'
import TouchButton from './TouchButton'

export default function EmptyState({
  icon: Icon = Package,
  title = 'No data',
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-medium text-foreground mb-1">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <TouchButton onClick={onAction} variant="primary">
          {actionLabel}
        </TouchButton>
      )}
    </div>
  )
}
