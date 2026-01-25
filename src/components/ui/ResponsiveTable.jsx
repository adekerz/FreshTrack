import { cn } from '../../utils/classNames'

/**
 * Responsive table:
 * - Mobile (< md): card layout
 * - Desktop (>= md): table layout
 * - Optional custom mobileCardRenderer, emptyState
 */
export default function ResponsiveTable({
  data = [],
  columns = [],
  mobileCardRenderer,
  emptyState,
  className = '',
  tableClassName = '',
  cardClassName = '',
}) {
  if (data.length === 0 && emptyState) {
    return emptyState
  }

  return (
    <div className={cn(className)}>
      {/* Mobile: card layout */}
      <div className={cn('space-y-3 md:hidden', cardClassName)}>
        {data.map((item, index) =>
          mobileCardRenderer ? (
            mobileCardRenderer(item, index)
          ) : (
            <MobileCard key={index} item={item} columns={columns} />
          )
        )}
      </div>

      {/* Desktop: table layout */}
      <div className={cn('hidden md:block overflow-x-auto rounded-xl border border-border', tableClassName)}>
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 font-medium text-foreground first:rounded-tl-xl last:rounded-tr-xl"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIdx) => (
              <tr
                key={rowIdx}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors',
                  'hover:bg-muted/20'
                )}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-4 py-3 text-foreground">
                    {col.render ? col.render(item) : item[col.accessor]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MobileCard({ item, columns }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {columns.map((col, idx) => (
        <div
          key={idx}
          className={cn(
            'flex justify-between gap-3 py-2 first:pt-0 last:pb-0',
            idx > 0 && 'border-t border-border/60'
          )}
        >
          <span className="text-muted-foreground shrink-0">{col.header}</span>
          <span className="text-foreground text-right font-medium">
            {col.render ? col.render(item) : item[col.accessor]}
          </span>
        </div>
      ))}
    </div>
  )
}
