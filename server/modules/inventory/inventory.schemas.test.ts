/**
 * Inventory Validation Tests
 * 
 * Тесты для Zod схем валидации inventory модуля
 */

import { describe, it, expect } from 'vitest'
import {
  CreateProductSchema,
  CreateBatchSchema,
  CreateCategorySchema,
  CreateCollectionSchema,
  BatchFiltersSchema,
  validate
} from '../../modules/inventory/inventory.schemas.js'

describe('Inventory Validation Schemas', () => {

  describe('CreateProductSchema', () => {
    it('should validate product with minimal data', () => {
      const result = validate(CreateProductSchema, {
        name: 'Test Product'
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.name).toBe('Test Product')
      expect(result.data?.unit).toBe('pcs')
      expect(result.data?.storageType).toBe('room_temp')
    })

    it('should validate product with all fields', () => {
      const result = validate(CreateProductSchema, {
        name: 'Full Product',
        categoryId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // UUID вместо числа
        unit: 'kg',
        storageType: 'refrigerated',
        minStock: 10,
        barcode: '1234567890',
        description: 'Test description'
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.storageType).toBe('refrigerated')
    })

    it('should reject empty name', () => {
      const result = validate(CreateProductSchema, {
        name: ''
      })

      expect(result.isValid).toBe(false)
    })

    it('should reject invalid unit', () => {
      const result = validate(CreateProductSchema, {
        name: 'Product',
        unit: 'invalid'
      })

      expect(result.isValid).toBe(false)
    })
  })

  describe('CreateBatchSchema', () => {
    it('should validate batch with required fields', () => {
      const result = validate(CreateBatchSchema, {
        productId: 'a1b2c3d4-e5f6-4789-a012-bcdef1234567', // UUID вместо числа
        quantity: 100,
        expiryDate: '2025-12-31'
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.productId).toBe('a1b2c3d4-e5f6-4789-a012-bcdef1234567')
      expect(result.data?.quantity).toBe(100)
    })

    it('should validate batch with all fields', () => {
      const result = validate(CreateBatchSchema, {
        productId: 'a1b2c3d4-e5f6-4789-a012-bcdef1234567',
        quantity: 50,
        expiryDate: '2025-06-15',
        productionDate: '2025-01-01',
        supplierName: 'Test Supplier',
        batchNumber: 'BATCH-001',
        purchasePrice: 99.99,
        departmentId: 'b2c3d4e5-f6a7-4890-b123-cdef12345678', // UUID для departmentId
        notes: 'Test notes'
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.supplierName).toBe('Test Supplier')
    })

    it('should reject negative quantity', () => {
      const result = validate(CreateBatchSchema, {
        productId: 'a1b2c3d4-e5f6-4789-a012-bcdef1234567',
        quantity: -10,
        expiryDate: '2025-12-31'
      })

      expect(result.isValid).toBe(false)
    })

    it('should reject invalid date format', () => {
      const result = validate(CreateBatchSchema, {
        productId: 'a1b2c3d4-e5f6-4789-a012-bcdef1234567',
        quantity: 100,
        expiryDate: '31-12-2025' // Неверный формат
      })

      expect(result.isValid).toBe(false)
    })

    it('should coerce string quantity to number', () => {
      const result = validate(CreateBatchSchema, {
        productId: 'a1b2c3d4-e5f6-4789-a012-bcdef1234567',
        quantity: '100', // Строка конвертируется в число
        expiryDate: '2025-12-31'
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.quantity).toBe(100)
    })
  })

  describe('CreateCategorySchema', () => {
    it('should validate category', () => {
      const result = validate(CreateCategorySchema, {
        name: 'Test Category'
      })

      expect(result.isValid).toBe(true)
    })

    it('should validate color in HEX format', () => {
      const result = validate(CreateCategorySchema, {
        name: 'Category',
        color: '#FF5733'
      })

      expect(result.isValid).toBe(true)
    })

    it('should reject invalid color format', () => {
      const result = validate(CreateCategorySchema, {
        name: 'Category',
        color: 'red'
      })

      expect(result.isValid).toBe(false)
    })
  })

  describe('CreateCollectionSchema', () => {
    it('should validate collection', () => {
      const result = validate(CreateCollectionSchema, {
        batchId: 'c3d4e5f6-a7b8-4901-c234-def123456789', // UUID для batchId
        quantity: 10,
        type: 'used'
      })

      expect(result.isValid).toBe(true)
    })

    it('should default type to used', () => {
      const result = validate(CreateCollectionSchema, {
        batchId: 'c3d4e5f6-a7b8-4901-c234-def123456789',
        quantity: 10
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.type).toBe('used')
    })

    it('should reject invalid collection type', () => {
      const result = validate(CreateCollectionSchema, {
        batchId: 'c3d4e5f6-a7b8-4901-c234-def123456789',
        quantity: 10,
        type: 'invalid_type'
      })

      expect(result.isValid).toBe(false)
    })
  })

  describe('BatchFiltersSchema', () => {
    it('should validate filters with defaults', () => {
      const result = validate(BatchFiltersSchema, {})

      expect(result.isValid).toBe(true)
      expect(result.data?.page).toBe(1)
      expect(result.data?.limit).toBe(50)
      expect(result.data?.sortBy).toBe('expiryDate')
      expect(result.data?.sortOrder).toBe('asc')
    })

    it('should coerce query parameters', () => {
      const result = validate(BatchFiltersSchema, {
        productId: 'd4e5f6a7-b8c9-4012-d345-ef1234567890', // UUID вместо строки '5'
        page: '2',
        limit: '25',
        expiredOnly: 'true'
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.productId).toBe('d4e5f6a7-b8c9-4012-d345-ef1234567890')
      expect(result.data?.page).toBe(2)
      expect(result.data?.expiredOnly).toBe(true)
    })

    it('should reject limit over 200', () => {
      const result = validate(BatchFiltersSchema, {
        limit: 500
      })

      expect(result.isValid).toBe(false)
    })
  })
})
