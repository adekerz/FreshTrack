/**
 * Skeleton loading components for FreshTrack
 * Based on Flowbite design with FreshTrack color palette
 */

import { cn } from '../utils/classNames'

/**
 * Base Skeleton component
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      role="status"
      aria-label="Loading..."
      className={cn(
        'animate-pulse bg-warmgray/20 rounded',
        className
      )}
      {...props}
    />
  )
}

/**
 * Text line skeleton
 */
export function SkeletonText({ lines = 1, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

/**
 * Circle/Avatar skeleton
 */
export function SkeletonAvatar({ size = 'md', className }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }
  
  return (
    <Skeleton className={cn('rounded-full', sizes[size], className)} />
  )
}

/**
 * Card skeleton - matches StatCard layout
 */
export function SkeletonCard({ className }) {
  return (
    <div className={cn(
      'bg-white rounded-2xl p-6 border border-sand shadow-soft',
      className
    )}>
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  )
}

/**
 * Table row skeleton
 */
export function SkeletonTableRow({ columns = 5, className }) {
  return (
    <tr className={cn('animate-pulse', className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

/**
 * Product/Batch row skeleton - matches batch list layout
 */
export function SkeletonBatchRow({ className }) {
  return (
    <div className={cn(
      'flex items-center gap-4 p-4 bg-white rounded-xl border border-sand animate-pulse',
      className
    )}>
      {/* Product name */}
      <div className="flex-1">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
      
      {/* Department */}
      <Skeleton className="h-6 w-20 rounded-full" />
      
      {/* Expiry date */}
      <Skeleton className="h-4 w-24" />
      
      {/* Quantity */}
      <Skeleton className="h-4 w-12" />
      
      {/* Status */}
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

/**
 * Dashboard grid skeleton
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      
      {/* Chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-sand">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl p-6 border border-sand">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/**
 * Inventory list skeleton
 */
export function SkeletonInventory({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBatchRow key={i} />
      ))}
    </div>
  )
}

/**
 * Modal content skeleton
 */
export function SkeletonModal() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-4">
        <SkeletonAvatar size="lg" />
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="border-t border-sand pt-4">
        <SkeletonText lines={3} />
      </div>
    </div>
  )
}

/**
 * Notification item skeleton
 */
export function SkeletonNotification({ className }) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 bg-white rounded-xl border border-sand animate-pulse',
      className
    )}>
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

/**
 * Notifications list skeleton
 */
export function SkeletonNotifications({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonNotification key={i} />
      ))}
    </div>
  )
}

export default Skeleton
