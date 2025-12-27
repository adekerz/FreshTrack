import { useState } from 'react'
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  Check,
  Bell,
  Calendar,
  Package,
  History
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProducts, departments } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'
import { format, parseISO } from 'date-fns'
import CollectModal from '../components/CollectModal'
import { SkeletonNotifications, Skeleton } from '../components/Skeleton'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getActiveBatches, collectBatch, findProduct, loading } = useProducts()

  // Состояние для модала сбора
  const [collectModalOpen, setCollectModalOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)

  // Получить все активные партии с информацией
  const getBatchesWithInfo = () => {
    return getActiveBatches().map((batch) => {
      const product = findProduct(batch.productId)
      const department = departments.find((d) => d.id === batch.departmentId)
      return {
        ...batch,
        productName: product?.name || 'Unknown',
        departmentName: department?.name || 'Unknown',
        departmentColor: department?.color || '#666'
      }
    })
  }

  const allBatches = getBatchesWithInfo()

  // Группировка по статусу
  const expiredBatches = allBatches.filter((b) => b.daysLeft < 0)
  const criticalBatches = allBatches.filter((b) => b.daysLeft >= 0 && b.daysLeft <= 3)
  const warningBatches = allBatches.filter((b) => b.daysLeft > 3 && b.daysLeft <= 7)

  // Форматирование даты
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return format(parseISO(dateString), 'dd.MM.yyyy')
    } catch {
      return 'Invalid'
    }
  }

  // Показываем скелетон при загрузке
  if (loading) {
    return (
      <div className="p-4 sm:p-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <SkeletonNotifications count={5} />
      </div>
    )
  }

  // Компонент секции
  const BatchSection = ({ title, icon: Icon, batches, colorClass, bgClass }) => {
    if (batches.length === 0) return null

    return (
      <div className="mb-6 sm:mb-8 animate-fade-in">
        <div className={`flex items-center gap-2 mb-3 sm:mb-4 ${colorClass}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          <h2 className="font-serif text-lg sm:text-xl">{title}</h2>
          <span className={`ml-2 px-2 py-0.5 text-xs sm:text-sm rounded-full ${bgClass} ${colorClass}`}>
            {batches.length}
          </span>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className={`bg-white dark:bg-dark-surface rounded-lg p-3 sm:p-4 border-l-4 ${
                batch.daysLeft < 0
                  ? 'border-l-danger'
                  : batch.daysLeft <= 3
                    ? 'border-l-danger'
                    : 'border-l-warning'
              } border border-sand dark:border-dark-border`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Название товара */}
                  <h3 className="font-medium text-charcoal dark:text-cream mb-1 text-sm sm:text-base truncate">{batch.productName}</h3>

                  {/* Отдел */}
                  <div
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded mb-2"
                    style={{
                      backgroundColor: `${batch.departmentColor}20`,
                      color: batch.departmentColor
                    }}
                  >
                    {batch.departmentName}
                  </div>

                  {/* Даты и количество - горизонтально на мобильных */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-warmgray">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>
                        {formatDate(batch.expiryDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>
                        {batch.quantity} {t('inventory.units')}
                      </span>
                    </div>
                  </div>

                  {/* Статус */}
                  <div
                    className={`mt-2 text-xs sm:text-sm font-medium ${
                      batch.daysLeft < 0
                        ? 'text-danger'
                        : batch.daysLeft <= 3
                          ? 'text-danger'
                          : 'text-warning'
                    }`}
                  >
                    {batch.daysLeft < 0
                      ? t('status.expiredDaysAgo', { days: Math.abs(batch.daysLeft) })
                      : batch.daysLeft === 0
                        ? t('status.expiresToday')
                        : t('status.expiresInDays', { days: batch.daysLeft })}
                  </div>
                </div>

                {/* Кнопка собрать */}
                <button
                  onClick={() => {
                    setSelectedBatch(batch)
                    setCollectModalOpen(true)
                  }}
                  className="flex items-center justify-center gap-1 px-3 sm:px-4 py-2 text-xs sm:text-sm border border-success text-success rounded-lg hover:bg-success hover:text-white transition-colors w-full sm:w-auto flex-shrink-0"
                >
                  <Check className="w-4 h-4" />
                  {t('product.collect')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Пустое состояние
  const hasAnyAlerts =
    expiredBatches.length > 0 || criticalBatches.length > 0 || warningBatches.length > 0

  return (
    <div className="p-3 sm:p-4 md:p-8">
      {/* Заголовок */}
      <div className="mb-4 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl text-charcoal dark:text-cream mb-1 sm:mb-2">{t('notifications.title')}</h1>
          <p className="text-warmgray dark:text-warmgray/80 text-xs sm:text-sm">{t('notifications.description')}</p>
        </div>

        {/* Кнопка истории уведомлений */}
        <button
          onClick={() => navigate('/notifications/history')}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm border border-sand dark:border-dark-border text-warmgray dark:text-cream/70 rounded-lg hover:bg-sand/50 dark:hover:bg-dark-border hover:text-charcoal dark:hover:text-cream transition-colors w-full sm:w-auto"
        >
          <History className="w-4 h-4" />
          <span>{t('notificationHistory.title')}</span>
        </button>
      </div>

      {!hasAnyAlerts ? (
        // Пустое состояние
        <div className="text-center py-12 sm:py-16 animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Bell className="w-8 h-8 sm:w-10 sm:h-10 text-success" />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl text-charcoal dark:text-cream mb-2">{t('notifications.allGood')}</h2>
          <p className="text-warmgray dark:text-warmgray/80 text-sm">{t('notifications.noAlerts')}</p>
        </div>
      ) : (
        <>
          {/* Просрочено */}
          <BatchSection
            title={t('notifications.expired')}
            icon={AlertCircle}
            batches={expiredBatches}
            colorClass="text-danger"
            bgClass="bg-danger/10"
          />

          {/* Срочно (до 3 дней) */}
          <BatchSection
            title={t('notifications.critical')}
            icon={AlertTriangle}
            batches={criticalBatches}
            colorClass="text-danger"
            bgClass="bg-danger/10"
          />

          {/* Внимание (до 7 дней) */}
          <BatchSection
            title={t('notifications.warning')}
            icon={Clock}
            batches={warningBatches}
            colorClass="text-warning"
            bgClass="bg-warning/10"
          />
        </>
      )}

      {/* Модал сбора */}
      <CollectModal
        isOpen={collectModalOpen}
        onClose={() => {
          setCollectModalOpen(false)
          setSelectedBatch(null)
        }}
        batch={selectedBatch}
        onConfirm={async ({ batchId, reason, comment }) => {
          await collectBatch(batchId, reason, comment)
        }}
      />
    </div>
  )
}
