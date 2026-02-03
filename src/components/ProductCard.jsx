/**
 * ProductCard - Компактная карточка товара
 * Оптимизирована для мобильных устройств
 */

import { TouchButton } from './ui'

// Цвета статусов
const statusColors = {
  expired: 'bg-danger',
  critical: 'bg-critical',
  warning: 'bg-warning',
  good: 'bg-success'
}

export default function ProductCard({
  product,
  categoryName,
  onProductClick,
  compact = false,
  t
}) {
  return (
    <TouchButton
      variant="ghost"
      onClick={() => onProductClick(product)}
      className={`
        w-full h-auto min-h-0 justify-start items-stretch
        bg-card border border-border rounded-lg
        text-left hover:shadow-md hover:border-accent group
        ${compact ? 'p-2.5' : 'p-3 sm:p-4'}
      `}
    >
      <div className={`flex flex-col w-full ${compact ? 'gap-1.5' : 'gap-2 sm:gap-3'}`}>
        {/* Заголовок с индикатором статуса */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3
              className={`
                font-medium text-foreground group-hover:text-accent
                transition-colors leading-tight line-clamp-2 break-words
                ${compact ? 'text-xs' : 'text-sm sm:text-base'}
              `}
            >
              {product.name}
            </h3>
          </div>
          {product.totalBatches > 0 && (
            <div
              className={`rounded-full flex-shrink-0 mt-0.5 ${statusColors[product.overallStatus]} ${
                compact ? 'w-2 h-2' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'
              }`}
              title={product.overallStatus}
            />
          )}
        </div>

        {/* Категория */}
        {categoryName && (
          <div className="flex">
            <span
              className={`
                text-muted-foreground bg-muted rounded
                inline-block line-clamp-1 break-words max-w-full
                ${compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'}
              `}
            >
              {categoryName}
            </span>
          </div>
        )}

        {/* Информация о партиях */}
        <div className={compact ? 'text-xs' : 'text-xs sm:text-sm text-muted-foreground'}>
          {product.totalBatches === 0 ? (
            <span className="text-muted-foreground/50 block">{t('inventory.noBatches')}</span>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span className="font-medium text-foreground">{product.totalBatches}</span>
                  <span>{t('inventory.batches')}</span>
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span className="font-medium text-foreground">{product.totalQuantity}</span>
                  <span>{t('inventory.units')}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Предупреждения */}
        {product.hasExpired && (
          <div className="flex items-start gap-1.5 text-xs text-danger">
            <span
              className={`rounded-full bg-danger flex-shrink-0 mt-1 ${compact ? 'w-1 h-1' : 'w-1.5 h-1.5'}`}
            />
            <span className="flex-1 leading-relaxed break-words">{t('inventory.hasExpired')}</span>
          </div>
        )}
        {!product.hasExpired && product.hasExpiringSoon && (
          <div className="flex items-start gap-1.5 text-xs text-warning">
            <span
              className={`rounded-full bg-warning flex-shrink-0 mt-1 ${compact ? 'w-1 h-1' : 'w-1.5 h-1.5'}`}
            />
            <span className="flex-1 leading-relaxed break-words">
              {t('inventory.expiringSoon')}
            </span>
          </div>
        )}
      </div>
    </TouchButton>
  )
}
