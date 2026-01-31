/**
 * Offline Sync Service
 * 
 * Автоматическая синхронизация изменений при восстановлении интернета
 * Использует IndexedDB для хранения pending мутаций
 */

import { useState, useEffect } from 'react'
import { addPendingChange, getPendingChanges, removePendingChange } from '../utils/indexedDB'
import { apiFetch } from '../services/api'
import { logInfo, logError, logWarn } from '../utils/logger'

/**
 * Типы операций для синхронизации
 */
export const SyncOperationType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  COLLECT: 'COLLECT',
  WRITE_OFF: 'WRITE_OFF'
}

/**
 * Класс для управления offline синхронизацией
 */
class OfflineSyncManager {
  constructor() {
    this.isSyncing = false
    this.syncQueue = []
    this.listeners = new Set()
    this.maxRetries = 3
    this.retryDelay = 2000 // 2 секунды
  }

  /**
   * Подписаться на события синхронизации
   */
  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Уведомить слушателей
   */
  notify(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        logError('Sync listener error:', error)
      }
    })
  }

  /**
   * Добавить операцию в очередь синхронизации
   */
  async queueOperation(operation) {
    try {
      const pendingOp = {
        ...operation,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending'
      }

      await addPendingChange(pendingOp)
      
      logInfo('Operation queued for sync:', pendingOp.type, pendingOp.id)
      
      this.notify({
        type: 'operation_queued',
        operation: pendingOp
      })

      // Если онлайн - сразу пытаемся синхронизировать
      if (navigator.onLine) {
        this.sync()
      }

      return pendingOp.id
    } catch (error) {
      logError('Failed to queue operation:', error)
      throw error
    }
  }

  /**
   * Синхронизировать все pending операции
   */
  async sync() {
    if (this.isSyncing) {
      logWarn('Sync already in progress')
      return
    }

    if (!navigator.onLine) {
      logWarn('Cannot sync: offline')
      return
    }

    this.isSyncing = true
    this.notify({ type: 'sync_started' })

    try {
      const pending = await getPendingChanges()
      
      if (pending.length === 0) {
        logInfo('No pending changes to sync')
        this.notify({ type: 'sync_completed', synced: 0, failed: 0 })
        return
      }

      logInfo(`Syncing ${pending.length} pending operations...`)

      let synced = 0
      let failed = 0

      for (const operation of pending) {
        try {
          await this.syncOperation(operation)
          await removePendingChange(operation.id)
          synced++
          
          this.notify({
            type: 'operation_synced',
            operation
          })
        } catch (error) {
          failed++
          logError(`Failed to sync operation ${operation.id}:`, error)
          
          // Увеличиваем счетчик попыток
          const retryCount = (operation.retryCount || 0) + 1
          
          if (retryCount >= this.maxRetries) {
            // Превышен лимит попыток - помечаем как failed
            await addPendingChange({
              ...operation,
              retryCount,
              status: 'failed',
              lastError: error.message
            })
            
            this.notify({
              type: 'operation_failed',
              operation,
              error: error.message
            })
          } else {
            // Обновляем счетчик попыток
            await addPendingChange({
              ...operation,
              retryCount,
              lastError: error.message
            })
          }
        }
      }

      logInfo(`Sync completed: ${synced} synced, ${failed} failed`)
      
      this.notify({
        type: 'sync_completed',
        synced,
        failed
      })
    } catch (error) {
      logError('Sync error:', error)
      this.notify({
        type: 'sync_error',
        error: error.message
      })
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Синхронизировать одну операцию
   */
  async syncOperation(operation) {
    const { type, endpoint, method, data, hotelId } = operation

    logInfo(`Syncing ${type} operation:`, endpoint)

    switch (type) {
      case SyncOperationType.CREATE:
        return await apiFetch(endpoint, {
          method: method || 'POST',
          body: JSON.stringify(data)
        })

      case SyncOperationType.UPDATE:
        return await apiFetch(endpoint, {
          method: method || 'PUT',
          body: JSON.stringify(data)
        })

      case SyncOperationType.DELETE:
        return await apiFetch(endpoint, {
          method: 'DELETE'
        })

      case SyncOperationType.COLLECT:
        return await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(data)
        })

      case SyncOperationType.WRITE_OFF:
        return await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(data)
        })

      default:
        throw new Error(`Unknown operation type: ${type}`)
    }
  }

  /**
   * Получить количество pending операций
   */
  async getPendingCount() {
    try {
      const pending = await getPendingChanges()
      return pending.filter(op => op.status !== 'failed').length
    } catch {
      return 0
    }
  }

  /**
   * Очистить все failed операции
   */
  async clearFailedOperations() {
    try {
      const pending = await getPendingChanges()
      const failed = pending.filter(op => op.status === 'failed')
      
      for (const op of failed) {
        await removePendingChange(op.id)
      }
      
      logInfo(`Cleared ${failed.length} failed operations`)
      
      this.notify({
        type: 'failed_cleared',
        count: failed.length
      })
    } catch (error) {
      logError('Failed to clear failed operations:', error)
    }
  }
}

// Singleton instance
export const offlineSyncManager = new OfflineSyncManager()

/**
 * Hook для работы с offline sync
 */
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // Загружаем начальное количество
    offlineSyncManager.getPendingCount().then(setPendingCount)

    // Подписываемся на события
    const unsubscribe = offlineSyncManager.subscribe((event) => {
      switch (event.type) {
        case 'sync_started':
          setIsSyncing(true)
          break
        case 'sync_completed':
        case 'sync_error':
          setIsSyncing(false)
          offlineSyncManager.getPendingCount().then(setPendingCount)
          break
        case 'operation_queued':
        case 'operation_synced':
        case 'operation_failed':
          offlineSyncManager.getPendingCount().then(setPendingCount)
          break
      }
    })

    return unsubscribe
  }, [])

  return {
    pendingCount,
    isSyncing,
    sync: () => offlineSyncManager.sync(),
    queueOperation: (op) => offlineSyncManager.queueOperation(op),
    clearFailed: () => offlineSyncManager.clearFailedOperations()
  }
}

/**
 * Автоматическая синхронизация при восстановлении соединения
 */
export function setupAutoSync() {
  let syncTimeout = null

  const handleOnline = () => {
    logInfo('Connection restored - starting auto sync...')
    
    // Задержка перед синхронизацией (даем время на стабилизацию соединения)
    if (syncTimeout) clearTimeout(syncTimeout)
    
    syncTimeout = setTimeout(() => {
      offlineSyncManager.sync()
    }, 1000)
  }

  window.addEventListener('online', handleOnline)

  // Периодическая проверка pending операций (каждые 30 секунд если онлайн)
  const checkInterval = setInterval(async () => {
    if (navigator.onLine && !offlineSyncManager.isSyncing) {
      const count = await offlineSyncManager.getPendingCount()
      if (count > 0) {
        logInfo(`Found ${count} pending operations - syncing...`)
        offlineSyncManager.sync()
      }
    }
  }, 30000)

  return () => {
    window.removeEventListener('online', handleOnline)
    clearInterval(checkInterval)
    if (syncTimeout) clearTimeout(syncTimeout)
  }
}

export default offlineSyncManager
