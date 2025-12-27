/**
 * EmptyState Component
 * Shown when there's no data to display
 * Clear CTA for next action
 */

import { Package } from 'lucide-react'
import Button from './Button'

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
      <div className="w-16 h-16 rounded-full bg-sand/50 dark:bg-white/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-warmgray" />
      </div>
      
      <h3 className="text-lg font-medium text-charcoal dark:text-cream mb-1">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-warmgray dark:text-warmgray/80 max-w-sm mb-6">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
