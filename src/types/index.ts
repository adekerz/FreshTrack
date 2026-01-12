/**
 * FreshTrack - Основные типы данных
 * 
 * Этот файл содержит базовые интерфейсы для всех сущностей системы.
 * Используется как на frontend, так и на backend.
 */

// ========================================
// Базовые типы
// ========================================

export type ID = number

export interface Timestamps {
  createdAt: string | Date
  updatedAt: string | Date
}

export interface SoftDelete {
  deletedAt?: string | Date | null
}

// ========================================
// Пользователи и авторизация
// ========================================

export type UserRole = 
  | 'SUPER_ADMIN'
  | 'HOTEL_ADMIN'
  | 'MANAGER'
  | 'DEPARTMENT_MANAGER'
  | 'STAFF'

export interface User extends Timestamps {
  id: ID
  login: string
  email: string
  name: string | null
  role: UserRole
  hotelId: ID | null
  departmentId: ID | null
  isActive: boolean
  lastLoginAt: string | Date | null
  telegramChatId: string | null
}

export interface UserWithPermissions extends User {
  permissions: Permission[]
  hotel?: Hotel | null
  department?: Department | null
}

export interface Permission {
  id: ID
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'manage'
}

export interface AuthTokenPayload {
  userId: ID
  login: string
  role: UserRole
  hotelId: ID | null
  departmentId: ID | null
  iat: number
  exp: number
}

// ========================================
// Организационная структура
// ========================================

export interface Hotel extends Timestamps {
  id: ID
  name: string
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  isActive: boolean
  settings: HotelSettings
}

export interface HotelSettings {
  branding?: {
    logo?: string
    primaryColor?: string
    secondaryColor?: string
  }
  notifications?: {
    emailEnabled: boolean
    telegramEnabled: boolean
  }
  expiryThresholds?: {
    warning: number  // дней до истечения для warning
    critical: number // дней до истечения для critical
  }
}

export interface Department extends Timestamps {
  id: ID
  hotelId: ID
  name: string
  description: string | null
  isActive: boolean
}

// ========================================
// Инвентарь
// ========================================

export type StorageType = 
  | 'refrigerated'
  | 'frozen'
  | 'dry'
  | 'room_temp'

export type Unit = 
  | 'kg'
  | 'g'
  | 'l'
  | 'ml'
  | 'pcs'
  | 'pack'

export interface Category extends Timestamps {
  id: ID
  hotelId: ID
  name: string
  description: string | null
  color: string | null
  icon: string | null
  parentId: ID | null
  sortOrder: number
}

export interface Product extends Timestamps {
  id: ID
  hotelId: ID
  categoryId: ID | null
  name: string
  description: string | null
  defaultShelfLife: number
  unit: Unit
  storageType: StorageType
  minStock: number
  barcode: string | null
  imageUrl: string | null
}

export interface ProductWithCategory extends Product {
  category?: Category | null
}

// ========================================
// Партии (Batches)
// ========================================

export type BatchStatus = 
  | 'fresh'
  | 'expiring'
  | 'expired'
  | 'collected'

export interface Batch extends Timestamps {
  id: ID
  hotelId: ID
  departmentId: ID | null
  productId: ID
  quantity: number
  originalQuantity: number
  expiryDate: string
  productionDate: string | null
  supplierName: string | null
  batchNumber: string | null
  purchasePrice: number | null
  status: BatchStatus
  notes: string | null
  createdById: ID
}

export interface BatchWithProduct extends Batch {
  product: Product
  department?: Department | null
  createdBy?: Pick<User, 'id' | 'name' | 'login'>
}

export interface BatchWithDetails extends BatchWithProduct {
  daysUntilExpiry: number
  statusLabel: string
  statusColor: string
}

// ========================================
// Сборы (Collections)
// ========================================

export type CollectionType = 
  | 'write_off'
  | 'sold'
  | 'used'
  | 'donated'
  | 'returned'
  | 'transferred'

export interface Collection extends Timestamps {
  id: ID
  batchId: ID
  quantity: number
  type: CollectionType
  reason: string | null
  notes: string | null
  collectedById: ID
}

export interface CollectionWithDetails extends Collection {
  batch: BatchWithProduct
  collectedBy: Pick<User, 'id' | 'name' | 'login'>
}

// ========================================
// Уведомления
// ========================================

export type NotificationType = 
  | 'expiry_warning'
  | 'expiry_critical'
  | 'low_stock'
  | 'collection_reminder'
  | 'report_ready'
  | 'system'

export type NotificationChannel = 
  | 'in_app'
  | 'email'
  | 'telegram'
  | 'push'

export type NotificationPriority = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'

export type NotificationStatus = 
  | 'unread'
  | 'read'
  | 'archived'
  | 'dismissed'

export interface Notification extends Timestamps {
  id: ID
  userId: ID
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  status: NotificationStatus
  channel: NotificationChannel
  readAt: string | Date | null
  metadata: Record<string, unknown>
}

export interface NotificationRule extends Timestamps {
  id: ID
  hotelId: ID
  name: string
  type: NotificationType
  isActive: boolean
  conditions: NotificationConditions
  channels: NotificationChannel[]
  schedule: NotificationSchedule
  recipients: NotificationRecipients
  messageTemplate: string | null
  priority: NotificationPriority
}

export interface NotificationConditions {
  daysBeforeExpiry?: number
  minStockThreshold?: number
  categoryIds?: ID[]
  productIds?: ID[]
  departmentIds?: ID[]
}

export interface NotificationSchedule {
  sendAt?: string  // HH:MM
  daysOfWeek?: number[]  // 0-6
  frequencyMinutes?: number
}

export interface NotificationRecipients {
  userIds?: ID[]
  roles?: UserRole[]
  allDepartmentUsers?: boolean
  allHotelUsers?: boolean
}

// ========================================
// Аудит
// ========================================

export type AuditAction = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'COLLECT'
  | 'EXPORT'
  | 'IMPORT'

export interface AuditLog extends Timestamps {
  id: ID
  userId: ID
  hotelId: ID | null
  action: AuditAction
  resource: string
  resourceId: ID | null
  details: Record<string, unknown>
  ipAddress: string | null
  userAgent: string | null
}

// ========================================
// API Response типы
// ========================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

export interface ValidationError {
  field: string
  message: string
  code?: string
}

export interface ApiError {
  error: string
  message?: string
  details?: ValidationError[]
  statusCode: number
}

// ========================================
// Статистика
// ========================================

export interface DashboardStats {
  totalProducts: number
  totalBatches: number
  expiringToday: number
  expiringThisWeek: number
  expired: number
  lowStock: number
  recentCollections: number
}

export interface ExpiryStats {
  fresh: number
  expiring: number
  expired: number
  collected: number
}

export interface CategoryStats {
  categoryId: ID
  categoryName: string
  totalBatches: number
  totalQuantity: number
  expiringCount: number
}

// ========================================
// Формы и фильтры
// ========================================

export interface BatchFilters {
  productId?: ID
  categoryId?: ID
  departmentId?: ID
  status?: BatchStatus
  expiringWithin?: number
  expiredOnly?: boolean
  minQuantity?: number
  search?: string
  sortBy?: 'expiryDate' | 'quantity' | 'createdAt' | 'productName'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ProductFilters {
  categoryId?: ID
  search?: string
  hasStock?: boolean
  storageType?: StorageType
  sortBy?: 'name' | 'createdAt' | 'stock'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface UserFilters {
  hotelId?: ID
  departmentId?: ID
  role?: UserRole
  isActive?: boolean
  search?: string
  page?: number
  limit?: number
}
