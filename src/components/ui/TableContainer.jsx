/**
 * TableContainer Component
 * Responsive table wrapper with horizontal scroll on mobile
 * Prevents layout breaks on small screens
 */

/**
 * TableContainer - обертка для адаптивных таблиц
 * @param {React.Node} children - Table element
 * @param {string} className - Additional classes
 */
export default function TableContainer({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto -mx-4 sm:mx-0 ${className}`}>
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden border border-border sm:rounded-lg">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Table Component
 * Base table with mobile-optimized cells
 */
export function Table({ children, className = '' }) {
  return (
    <table className={`min-w-full divide-y divide-border ${className}`}>
      {children}
    </table>
  )
}

/**
 * TableHead Component
 */
export function TableHead({ children, className = '' }) {
  return (
    <thead className={`bg-muted ${className}`}>
      {children}
    </thead>
  )
}

/**
 * TableBody Component
 */
export function TableBody({ children, className = '' }) {
  return (
    <tbody className={`bg-card divide-y divide-border ${className}`}>
      {children}
    </tbody>
  )
}

/**
 * TableRow Component
 * With hover state
 */
export function TableRow({ children, onClick, className = '' }) {
  return (
    <tr
      onClick={onClick}
      className={`
        ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
        ${className}
      `}
    >
      {children}
    </tr>
  )
}

/**
 * TableHeader Component (th)
 * Compact on mobile
 */
export function TableHeader({ children, className = '' }) {
  return (
    <th
      className={`
        px-3 sm:px-6 py-2 sm:py-3
        text-left text-xs font-medium
        text-muted-foreground uppercase tracking-wider
        ${className}
      `}
    >
      {children}
    </th>
  )
}

/**
 * TableCell Component (td)
 * Compact on mobile
 */
export function TableCell({ children, className = '' }) {
  return (
    <td
      className={`
        px-3 sm:px-6 py-2 sm:py-4
        whitespace-nowrap text-xs sm:text-sm
        text-foreground
        ${className}
      `}
    >
      {children}
    </td>
  )
}

/**
 * EmptyState Component
 * For empty tables
 */
export function TableEmptyState({ icon: Icon, title, description }) {
  return (
    <tr>
      <td colSpan="100" className="px-6 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          {Icon && (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Icon className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
