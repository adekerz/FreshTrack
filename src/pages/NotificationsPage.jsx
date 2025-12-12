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

export default function NotificationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getActiveBatches, collectBatch, findProduct } = useProducts()

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

  // Компонент секции
  const BatchSection = ({ title, icon: Icon, batches, colorClass, bgClass }) => {
    if (batches.length === 0) return null

    return (
      <div className="mb-8 animate-fade-in">
        <div className={`flex items-center gap-2 mb-4 ${colorClass}`}>
          <Icon className="w-5 h-5" />
          <h2 className="font-serif text-xl">{title}</h2>
          <span className={`ml-2 px-2 py-0.5 text-sm rounded-full ${bgClass} ${colorClass}`}>
            {batches.length}
          </span>
        </div>

        <div className="space-y-3">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className={`bg-white rounded-lg p-4 border-l-4 ${
                batch.daysLeft < 0
                  ? 'border-l-danger'
                  : batch.daysLeft <= 3
                    ? 'border-l-danger'
                    : 'border-l-warning'
              } border border-sand`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Название товара */}
                  <h3 className="font-medium text-charcoal mb-1">{batch.productName}</h3>

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

                  {/* Даты */}
                  <div className="flex items-center gap-2 text-sm text-warmgray">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDate(batch.manufacturingDate)} — {formatDate(batch.expiryDate)}
                    </span>
                  </div>

                  {/* Количество */}
                  <div className="flex items-center gap-2 text-sm text-warmgray mt-1">
                    <Package className="w-4 h-4" />
                    <span>
                      {batch.quantity} {t('inventory.units')}
                    </span>
                  </div>

                  {/* Статус */}
                  <div
                    className={`mt-2 text-sm font-medium ${
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
                  className="flex items-center gap-1 px-4 py-2 text-sm border border-success text-success rounded-lg hover:bg-success hover:text-white transition-colors"
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
    <div className="p-8">
      {/* Заголовок */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-charcoal mb-2">{t('notifications.title')}</h1>
          <p className="text-warmgray">{t('notifications.description')}</p>
        </div>

        {/* Кнопка истории уведомлений */}
        <button
          onClick={() => navigate('/notifications/history')}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-sand text-warmgray rounded-lg hover:bg-sand/50 hover:text-charcoal transition-colors"
        >
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">{t('notificationHistory.title')}</span>
        </button>
      </div>

      {!hasAnyAlerts ? (
        // Пустое состояние
        <div className="text-center py-16 animate-fade-in">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bell className="w-10 h-10 text-success" />
          </div>
          <h2 className="font-serif text-2xl text-charcoal mb-2">{t('notifications.allGood')}</h2>
          <p className="text-warmgray">{t('notifications.noAlerts')}</p>
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
