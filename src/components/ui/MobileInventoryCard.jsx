/**
 * MobileInventoryCard Component
 * Карточка товара для мобильного отображения
 * Заменяет таблицу на mobile breakpoint
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, MapPin, Tag, Clock, Package } from 'lucide-react'
import { cn } from '../../utils/classNames'
import ExpirationBadge from './ExpirationBadge'
import SwipeableCard from './SwipeableCard'
import { useTranslation } from '../../context/LanguageContext'

export default function MobileInventoryCard({
  item,
  onEdit,
  onDelete,
  onCollect,
  onClick,
  expanded: controlledExpanded,
  onToggle,
  className = '',
}) {
  const { t } = useTranslation()
  const [internalExpanded, setInternalExpanded] = useState(false)
  
  // Поддержка controlled и uncontrolled режимов
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const toggleExpanded = onToggle || (() => setInternalExpanded(!internalExpanded))

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  return (
    <SwipeableCard
      onEdit={onEdit}
      onDelete={onDelete}
      className={cn('mb-3', className)}
    >
      <div 
        className={cn(
          'bg-card border border-border rounded-xl overflow-hidden',
          'transition-shadow duration-200',
          expanded && 'shadow-md'
        )}
      >
        {/* Основная информация (всегда видима) */}
        <div
          className={cn(
            'p-4 flex items-center gap-3',
            'cursor-pointer touch-manipulation',
            'active:bg-muted/50 transition-colors'
          )}
          onClick={(e) => {
            if (onClick) {
              onClick(item)
            } else {
              toggleExpanded()
            }
          }}
          role="button"
          aria-expanded={expanded}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleExpanded()
            }
          }}
        >
          {/* Цветовой индикатор слева */}
          <div 
            className={cn(
              'w-1 h-12 rounded-full flex-shrink-0',
              getExpirationColorClass(item.expiration_date)
            )}
          />

          {/* Основная информация */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">
              {item.name}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <ExpirationBadge date={item.expiration_date} size="sm" />
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {item.quantity} {item.unit || 'шт'}
              </span>
            </div>
          </div>

          {/* Индикатор раскрытия */}
          <div className="flex-shrink-0 p-1">
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Расширенная информация (показывается при раскрытии) */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/30">
            {/* Детали в grid */}
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <DetailRow 
                icon={Tag} 
                label={t('product.category') || 'Категория'} 
                value={item.category_name || item.category || '—'} 
              />
              <DetailRow 
                icon={MapPin} 
                label={t('product.location') || 'Локация'} 
                value={item.location || '—'} 
              />
              <DetailRow 
                icon={Clock} 
                label={t('product.added') || 'Добавлен'} 
                value={formatDate(item.created_at)} 
              />
              <DetailRow 
                icon={Clock} 
                label={t('product.expires') || 'Истекает'} 
                value={formatDate(item.expiration_date)} 
              />
            </div>

            {/* Действия */}
            <div className="flex gap-2">
              {onCollect && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCollect(item)
                  }}
                  className={cn(
                    'flex-1 py-2.5 px-4 rounded-lg',
                    'bg-accent text-white font-medium text-sm',
                    'touch-manipulation active:scale-[0.98]',
                    'transition-transform'
                  )}
                >
                  {t('actions.collect') || 'Собрать'}
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(item)
                  }}
                  className={cn(
                    'flex-1 py-2.5 px-4 rounded-lg',
                    'border border-border text-foreground font-medium text-sm',
                    'touch-manipulation active:scale-[0.98]',
                    'transition-transform'
                  )}
                >
                  {t('actions.edit') || 'Редактировать'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </SwipeableCard>
  )
}

/**
 * DetailRow - строка с деталями
 */
function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground font-medium">{value}</p>
      </div>
    </div>
  )
}

/**
 * Возвращает класс цвета для индикатора на основе даты истечения
 */
function getExpirationColorClass(date) {
  if (!date) return 'bg-gray-300'
  
  const expirationDate = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expirationDate.setHours(0, 0, 0, 0)
  
  const diffTime = expirationDate.getTime() - today.getTime()
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (daysUntil <= 0) return 'bg-red-500'
  if (daysUntil <= 3) return 'bg-orange-500'
  if (daysUntil <= 7) return 'bg-yellow-500'
  return 'bg-green-500'
}

/**
 * MobileInventoryList - контейнер для списка карточек
 */
export function MobileInventoryList({ 
  items, 
  onEdit, 
  onDelete, 
  onCollect,
  emptyMessage,
  className = '' 
}) {
  const { t } = useTranslation()

  if (!items || items.length === 0) {
    return (
      <div className={cn('text-center py-12 text-muted-foreground', className)}>
        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{emptyMessage || t('inventory.empty') || 'Нет товаров'}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {items.map((item) => (
        <MobileInventoryCard
          key={item.id}
          item={item}
          onEdit={onEdit ? () => onEdit(item) : undefined}
          onDelete={onDelete ? () => onDelete(item) : undefined}
          onCollect={onCollect ? () => onCollect(item) : undefined}
        />
      ))}
    </div>
  )
}
