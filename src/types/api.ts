/**
 * Типы для API запросов и ответов
 * Инферированы из Zod схем на сервере
 */

import type { z } from 'zod'

// ========================================
// Auth API Types (server/modules/auth/auth.schemas.js)
// ========================================

// Эти типы соответствуют Zod схемам на сервере
// При изменении схем — обновите типы здесь

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    login: string
    email: string
    name: string | null
    role: string
    hotelId: number | null
    departmentId: number | null
  }
}

export interface RegisterRequest {
  login: string
  email: string
  password: string
  name?: string | null
  hotelId?: number
  departmentId?: number
}

export interface CreateUserRequest {
  login: string
  email: string
  password: string
  name?: string | null
  role: 'SUPER_ADMIN' | 'HOTEL_ADMIN' | 'MANAGER' | 'DEPARTMENT_MANAGER' | 'STAFF'
  hotelId?: number | null
  departmentId?: number | null
  isActive?: boolean
}

export interface UpdateUserRequest {
  login?: string
  email?: string
  password?: string
  name?: string | null
  role?: 'SUPER_ADMIN' | 'HOTEL_ADMIN' | 'MANAGER' | 'DEPARTMENT_MANAGER' | 'STAFF'
  hotelId?: number | null
  departmentId?: number | null
  isActive?: boolean
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// ========================================
// Inventory API Types (server/modules/inventory/inventory.schemas.js)
// ========================================

export interface CreateProductRequest {
  name: string
  categoryId?: number | null
  defaultShelfLife?: number
  unit?: 'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'pack'
  storageType?: 'refrigerated' | 'frozen' | 'dry' | 'room_temp'
  minStock?: number
  barcode?: string | null
  description?: string | null
  imageUrl?: string | null
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

export interface CreateBatchRequest {
  productId: number
  quantity: number
  expiryDate: string  // YYYY-MM-DD
  productionDate?: string | null
  supplierName?: string | null
  batchNumber?: string | null
  purchasePrice?: number | null
  departmentId?: number | null
  notes?: string | null
}

export interface UpdateBatchRequest {
  quantity?: number
  expiryDate?: string
  productionDate?: string | null
  supplierName?: string | null
  batchNumber?: string | null
  purchasePrice?: number | null
  departmentId?: number | null
  notes?: string | null
  status?: 'fresh' | 'expiring' | 'expired' | 'collected'
}

export interface CreateCategoryRequest {
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  parentId?: number | null
  sortOrder?: number
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface CollectBatchRequest {
  batchId: number
  quantity: number
  type?: 'write_off' | 'sold' | 'used' | 'donated' | 'returned' | 'transferred'
  reason?: string | null
  notes?: string | null
}

export interface QuickCollectRequest {
  quantity: number
  type?: 'write_off' | 'sold' | 'used' | 'donated' | 'returned' | 'transferred'
  reason?: string | null
}

// ========================================
// Notifications API Types (server/modules/notifications/notifications.schemas.js)
// ========================================

export interface CreateNotificationRuleRequest {
  name: string
  type: 'expiry_warning' | 'expiry_critical' | 'low_stock' | 'collection_reminder' | 'report_ready' | 'system'
  isActive?: boolean
  conditions?: {
    daysBeforeExpiry?: number
    minStockThreshold?: number
    categoryIds?: number[]
    productIds?: number[]
    departmentIds?: number[]
  }
  channels: ('in_app' | 'email' | 'telegram' | 'push')[]
  schedule?: {
    sendAt?: string  // HH:MM
    daysOfWeek?: number[]
    frequencyMinutes?: number
  }
  recipients?: {
    userIds?: number[]
    roles?: string[]
    allDepartmentUsers?: boolean
    allHotelUsers?: boolean
  }
  messageTemplate?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface UpdateNotificationRuleRequest extends Partial<CreateNotificationRuleRequest> {}

export interface UserNotificationSettingsRequest {
  enabledChannels?: ('in_app' | 'email' | 'telegram' | 'push')[]
  typeSettings?: Record<string, {
    enabled: boolean
    channels?: ('in_app' | 'email' | 'telegram' | 'push')[]
  }>
  notificationEmail?: string | null
  telegramChatId?: string | null
  quietHours?: {
    enabled: boolean
    start?: string
    end?: string
  }
  digestMode?: {
    enabled: boolean
    frequency?: 'hourly' | 'daily' | 'weekly'
    sendAt?: string
  }
}

export interface SendTestNotificationRequest {
  type?: 'expiry_warning' | 'expiry_critical' | 'low_stock' | 'collection_reminder' | 'report_ready' | 'system'
  channel: 'in_app' | 'email' | 'telegram' | 'push'
  title: string
  message: string
  userId?: number
}

export interface MarkNotificationsRequest {
  notificationIds: number[]
  status: 'read' | 'archived' | 'dismissed'
}

// ========================================
// Query Parameters Types
// ========================================

export interface BatchFiltersQuery {
  productId?: number
  categoryId?: number
  departmentId?: number
  status?: 'fresh' | 'expiring' | 'expired' | 'collected'
  expiringWithin?: number
  expiredOnly?: boolean
  minQuantity?: number
  search?: string
  sortBy?: 'expiryDate' | 'quantity' | 'createdAt' | 'productName'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ProductFiltersQuery {
  categoryId?: number
  search?: string
  hasStock?: boolean
  storageType?: 'refrigerated' | 'frozen' | 'dry' | 'room_temp'
  sortBy?: 'name' | 'createdAt' | 'stock'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface NotificationFiltersQuery {
  type?: 'expiry_warning' | 'expiry_critical' | 'low_stock' | 'collection_reminder' | 'report_ready' | 'system'
  status?: 'unread' | 'read' | 'archived' | 'dismissed'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  unreadOnly?: boolean
  from?: string
  to?: string
  search?: string
  sortBy?: 'createdAt' | 'priority' | 'type'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface UsersFiltersQuery {
  hotelId?: number
  departmentId?: number
  role?: 'SUPER_ADMIN' | 'HOTEL_ADMIN' | 'MANAGER' | 'DEPARTMENT_MANAGER' | 'STAFF'
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
}

// ========================================
// Utility type для типизации Zod схем
// ========================================

/**
 * Хелпер для извлечения типа из Zod схемы
 * Используется на сервере: type LoginRequest = InferSchema<typeof LoginRequestSchema>
 */
export type InferSchema<T extends z.ZodTypeAny> = z.infer<T>

/**
 * Тип для результата валидации
 */
export interface ValidationResult<T> {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    code?: string
  }>
  data: T | null
}
