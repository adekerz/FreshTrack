/**
 * Test Utilities
 * 
 * Хелперы для тестирования React компонентов
 */

import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// ========================================
// Custom Render с Providers
// ========================================

interface WrapperProps {
  children: ReactNode
}

/**
 * Обёртка со всеми необходимыми провайдерами
 */
function AllProviders({ children }: WrapperProps) {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  )
}

/**
 * Кастомный render с провайдерами
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// ========================================
// Mock Data Factories
// ========================================

export function createMockUser(overrides = {}) {
  return {
    id: 1,
    login: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    role: 'STAFF' as const,
    hotelId: 1,
    departmentId: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

export function createMockProduct(overrides = {}) {
  return {
    id: 1,
    hotelId: 1,
    categoryId: 1,
    name: 'Test Product',
    description: null,
    defaultShelfLife: 7,
    unit: 'pcs' as const,
    storageType: 'room_temp' as const,
    minStock: 0,
    barcode: null,
    imageUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

export function createMockBatch(overrides = {}) {
  const today = new Date()
  const expiryDate = new Date(today)
  expiryDate.setDate(today.getDate() + 7)
  
  return {
    id: 1,
    hotelId: 1,
    departmentId: 1,
    productId: 1,
    quantity: 100,
    originalQuantity: 100,
    expiryDate: expiryDate.toISOString().split('T')[0],
    productionDate: null,
    supplierName: null,
    batchNumber: null,
    purchasePrice: null,
    status: 'fresh' as const,
    notes: null,
    createdById: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

export function createMockCategory(overrides = {}) {
  return {
    id: 1,
    hotelId: 1,
    name: 'Test Category',
    description: null,
    color: '#3B82F6',
    icon: null,
    parentId: null,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

export function createMockNotification(overrides = {}) {
  return {
    id: 1,
    userId: 1,
    type: 'expiry_warning' as const,
    title: 'Test Notification',
    message: 'This is a test notification',
    priority: 'medium' as const,
    status: 'unread' as const,
    channel: 'in_app' as const,
    readAt: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

// ========================================
// API Mock Helpers
// ========================================

export function mockFetch(data: unknown, options: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = options
  
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  })
}

export function mockFetchError(error: string, status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
    text: () => Promise.resolve(JSON.stringify({ error }))
  })
}

// ========================================
// Async Helpers
// ========================================

export function waitForLoadingToFinish() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ========================================
// Re-export everything from testing-library
// ========================================

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Override render
export { customRender as render }
