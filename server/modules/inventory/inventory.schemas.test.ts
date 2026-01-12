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
        categoryId: 1,
        defaultShelfLife: 14,
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
        productId: 1,
        quantity: 100,
        expiryDate: '2025-12-31'
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data?.productId).toBe(1)
      expect(result.data?.quantity).toBe(100)
    })
    
    it('should validate batch with all fields', () => {
      const result = validate(CreateBatchSchema, {
        productId: 1,
        quantity: 50,
        expiryDate: '2025-06-15',
        productionDate: '2025-01-01',
        supplierName: 'Test Supplier',
        batchNumber: 'BATCH-001',
        purchasePrice: 99.99,
        departmentId: 2,
        notes: 'Test notes'
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data?.supplierName).toBe('Test Supplier')
    })
    
    it('should reject negative quantity', () => {
      const result = validate(CreateBatchSchema, {
        productId: 1,
        quantity: -10,
        expiryDate: '2025-12-31'
      })
      
      expect(result.isValid).toBe(false)
    })
    
    it('should reject invalid date format', () => {
      const result = validate(CreateBatchSchema, {
        productId: 1,
        quantity: 100,
        expiryDate: '31-12-2025'
      })
      
      expect(result.isValid).toBe(false)
    })
    
    it('should coerce string quantity to number', () => {
      const result = validate(CreateBatchSchema, {
        productId: '1',
        quantity: '100',
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
        batchId: 1,
        quantity: 10,
        type: 'used'
      })
      
      expect(result.isValid).toBe(true)
    })
    
    it('should default type to used', () => {
      const result = validate(CreateCollectionSchema, {
        batchId: 1,
        quantity: 10
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data?.type).toBe('used')
    })
    
    it('should reject invalid collection type', () => {
      const result = validate(CreateCollectionSchema, {
        batchId: 1,
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
        productId: '5',
        page: '2',
        limit: '25',
        expiredOnly: 'true'
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data?.productId).toBe(5)
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
