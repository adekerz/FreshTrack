/**
 * CacheManagement Component
 * 
 * Управление offline кэшем React Query
 * Показывает статистику и позволяет очистить кэш
 */

import { useState, useEffect } from 'react'
import { Database, Trash2, RefreshCw, HardDrive, CheckCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import {
  getPersistedCacheInfo,
  clearPersistedCache
} from '../../lib/queryPersistence'

export default function CacheManagement() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [cacheInfo, setCacheInfo] = useState(null)
  const [isClearing, setIsClearing] = useState(false)

  // Загружаем информацию о кэше
  const loadCacheInfo = () => {
    const info = getPersistedCacheInfo()
    const activeQueries = queryClient.getQueryCache().getAll().length
    
    setCacheInfo({
      ...info,
      activeQueries
    })
  }

  useEffect(() => {
    loadCacheInfo()
  }, [])

  // Очистка кэша
  const handleClearCache = async () => {
    if (!confirm(t('settings.cache.confirmClear') || 'Очистить весь кэш? Данные будут перезагружены при следующем запуске.')) {
      return
    }

    setIsClearing(true)
    try {
      // Очищаем persisted кэш
      clearPersistedCache()
      
      // Очищаем текущий query кэш
      queryClient.clear()
      
      addToast(
        t('settings.cache.cleared') || 'Кэш очищен',
        'success'
      )
      
      // Обновляем информацию
      setTimeout(() => {
        loadCacheInfo()
        setIsClearing(false)
      }, 500)
    } catch (error) {
      addToast(
        t('settings.cache.clearError') || 'Ошибка очистки кэша',
        'error'
      )
      setIsClearing(false)
    }
  }

  // Принудительное обновление всех queries
  const handleRefreshAll = () => {
    queryClient.invalidateQueries()
    addToast(
      t('settings.cache.refreshing') || 'Обновление данных...',
      'info'
    )
    
    setTimeout(() => {
      loadCacheInfo()
    }, 1000)
  }

  if (!cacheInfo) {
    return (
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">
              {t('settings.cache.title') || 'Управление кэшем'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('settings.cache.description') || 'Offline кэш для работы без интернета'}
            </p>
          </div>
        </div>
      </div>

      {/* Статистика кэша */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Размер кэша */}
        <div className="bg-background rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('settings.cache.size') || 'Размер'}
            </span>
          </div>
          <div className="text-2xl font-semibold text-foreground">
            {cacheInfo.sizeFormatted || '0 KB'}
          </div>
        </div>

        {/* Количество queries */}
        <div className="bg-background rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('settings.cache.storedQueries') || 'Сохранено'}
            </span>
          </div>
          <div className="text-2xl font-semibold text-foreground">
            {cacheInfo.queries}
          </div>
        </div>

        {/* Активные queries */}
        <div className="bg-background rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('settings.cache.activeQueries') || 'Активные'}
            </span>
          </div>
          <div className="text-2xl font-semibold text-foreground">
            {cacheInfo.activeQueries}
          </div>
        </div>
      </div>

      {/* Статус */}
      {cacheInfo.exists ? (
        <div className="flex items-center gap-2 mb-6 p-3 bg-success/10 border border-success/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-success" />
          <span className="text-sm text-success">
            {t('settings.cache.enabled') || 'Offline режим активен - данные доступны без интернета'}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-6 p-3 bg-muted border border-border rounded-lg">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t('settings.cache.empty') || 'Кэш пуст - используйте приложение для создания кэша'}
          </span>
        </div>
      )}

      {/* Действия */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleRefreshAll}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{t('settings.cache.refreshAll') || 'Обновить все'}</span>
        </button>

        <button
          onClick={handleClearCache}
          disabled={isClearing || !cacheInfo.exists}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-danger text-danger rounded-lg hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isClearing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t('settings.cache.clearing') || 'Очистка...'}</span>
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              <span>{t('settings.cache.clear') || 'Очистить кэш'}</span>
            </>
          )}
        </button>
      </div>

      {/* Информация */}
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>{t('settings.cache.infoTitle') || 'Как это работает:'}</strong><br />
          {t('settings.cache.info') || 
            'React Query автоматически сохраняет данные в localStorage. ' +
            'При потере соединения вы продолжаете видеть последние загруженные данные. ' +
            'Изменения синхронизируются автоматически при восстановлении интернета.'}
        </p>
      </div>
    </div>
  )
}
