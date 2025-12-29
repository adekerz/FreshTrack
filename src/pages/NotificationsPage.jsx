import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Clock,
  AlertCircle,
  Bell,
  Calendar,
  Package,
  History,
  Zap
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProducts, departments } from '../context/ProductContext'
import { useTranslation } from '../context/LanguageContext'
import { format, parseISO } from 'date-fns'
import { SkeletonNotifications, Skeleton } from '../components/Skeleton'
import FIFOCollectModal from '../components/FIFOCollectModal'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { getActiveBatches, findProduct, loading, refreshProducts, refresh, departments: depts } = useProducts()
  const [retryCount, setRetryCount] = useState(0)
  
  // Состояние для FIFO модала
  const [fifoModalOpen, setFifoModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Автоматический retry когда нет данных
  // Делаем retry только если не loading и прошло достаточно времени
  useEffect(() => {
    // Не делаем retry если уже идёт загрузка или достигнут лимит
    if (loading || retryCount >= 5) return
    
    // Если данные есть - сбрасываем счётчик
    if (depts.length > 0) {
      if (retryCount > 0) setRetryCount(0)
      return
    }
    
    // Retry с увеличивающимся интервалом (3s, 6s, 9s...)
    const delay = (retryCount + 1) * 3000
    const timer = setTimeout(() => {
      setRetryCount(prev => prev + 1)
      refresh()
    }, delay)
    
    return () => clearTimeout(timer)
  }, [loading, depts.length, retryCount, refresh])

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

  // Показываем скелетон при загрузке (когда есть данные)
  if (loading && depts.length > 0) {
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

  // Загрузка БД (нет данных)
  if (depts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-16 sm:py-24 animate-fade-in">
        <div className="flex flex-col items-center gap-6">
          <div className="loader loader-lg">
            <div className="cell d-0" />
            <div className="cell d-1" />
            <div className="cell d-2" />
            <div className="cell d-1" />
            <div className="cell d-2" />
            <div className="cell d-3" />
            <div className="cell d-2" />
            <div className="cell d-3" />
            <div className="cell d-4" />
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium mb-1">
              {loading ? t('common.loading') : t('inventory.connectingDatabase') || 'Подключение к базе данных...'}
            </p>
            <p className="text-muted-foreground text-sm animate-pulse">
              {retryCount > 0 && `${t('common.attempt') || 'Попытка'} ${retryCount}/10`}
            </p>
          </div>
        </div>
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
              className={`bg-card rounded-lg p-3 sm:p-4 border-l-4 ${
                batch.daysLeft < 0
                  ? 'border-l-danger'
                  : batch.daysLeft <= 3
                    ? 'border-l-danger'
                    : 'border-l-warning'
              } border border-border`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Название товара */}
                  <h3 className="font-medium text-foreground mb-1 text-sm sm:text-base truncate">{batch.productName}</h3>

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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
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

                {/* Кнопка FIFO сбора */}
                <button
                  onClick={() => {
                    const product = findProduct(batch.productId)
                    if (product) {
                      setSelectedProduct({
                        id: product.id,
                        name: product.name,
                        totalQuantity: product.totalQuantity || batch.quantity
                      })
                      setFifoModalOpen(true)
                    }
                  }}
                  className="flex items-center justify-center gap-1 px-3 sm:px-4 py-2 text-xs sm:text-sm border border-accent text-accent rounded-lg hover:bg-accent hover:text-white transition-colors w-full sm:w-auto flex-shrink-0"
                  title={t('fifoCollect.title')}
                >
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('fifoCollect.title')}</span>
                  <span className="sm:hidden">{t('fifoCollect.short') || 'FIFO'}</span>
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
          <h1 className="font-serif text-xl sm:text-2xl text-foreground mb-1 sm:mb-2">{t('notifications.title')}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">{t('notifications.description')}</p>
        </div>

        {/* Кнопка истории уведомлений */}
        <button
          onClick={() => navigate('/notifications/history')}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm border border-border text-muted-foreground rounded-lg hover:bg-muted hover:text-foreground transition-colors w-full sm:w-auto"
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
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">{t('notifications.allGood')}</h2>
          <p className="text-muted-foreground text-sm">{t('notifications.noAlerts')}</p>
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

      {/* FIFO модал сбора */}
      <FIFOCollectModal
        isOpen={fifoModalOpen}
        onClose={() => {
          setFifoModalOpen(false)
          setSelectedProduct(null)
        }}
        product={selectedProduct}
        onSuccess={() => {
          refreshProducts()
          setFifoModalOpen(false)
          setSelectedProduct(null)
        }}
      />
    </div>
  )
}
