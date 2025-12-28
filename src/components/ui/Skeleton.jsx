/**
 * Skeleton Components
 * Loading placeholders with shimmer effect
 * Reduces perceived load time
 */

// Base skeleton with shimmer
export function Skeleton({ className = '', animate = true }) {
  return (
    <div 
      className={`
        bg-muted rounded
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `}
    />
  )
}

// Text skeleton
export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  )
}

// Avatar skeleton
export function SkeletonAvatar({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  return <Skeleton className={`${sizes[size]} rounded-full ${className}`} />
}

// Card skeleton
export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-card rounded-xl border border-border p-4 md:p-6 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <SkeletonAvatar />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/3 mb-2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}

// Table row skeleton
export function SkeletonTableRow({ columns = 4, className = '' }) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

// Table skeleton
export function SkeletonTable({ rows = 5, columns = 4, className = '' }) {
  return (
    <div className={`bg-card rounded-xl border border-border overflow-hidden ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Stat card skeleton
export function SkeletonStat({ className = '' }) {
  return (
    <div className={`bg-card rounded-xl border border-border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-8 w-20 mb-1" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}

// List skeleton
export function SkeletonList({ items = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonAvatar size="sm" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton
