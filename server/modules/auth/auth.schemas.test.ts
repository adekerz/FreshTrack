/**
 * Auth Validation Tests
 * 
 * Тесты для Zod схем валидации auth модуля
 */

import { describe, it, expect } from 'vitest'
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  CreateUserRequestSchema,
  ChangePasswordSchema,
  validate,
  canAssignRole,
  getAllowedRolesForCreator
} from '../../modules/auth/auth.schemas.js'

describe('Auth Validation Schemas', () => {
  
  describe('LoginRequestSchema', () => {
    it('should validate correct login data', () => {
      const result = validate(LoginRequestSchema, {
        email: 'test@example.com',
        password: 'password123'
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data).toEqual({
        email: 'test@example.com',
        password: 'password123'
      })
    })
    
    it('should trim and lowercase email', () => {
      const result = validate(LoginRequestSchema, {
        email: '  TEST@Example.COM  ',
        password: 'password123'
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data?.email).toBe('test@example.com')
    })
    
    it('should reject missing email', () => {
      const result = validate(LoginRequestSchema, {
        password: 'password123'
      })
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
    
    it('should reject missing password', () => {
      const result = validate(LoginRequestSchema, {
        email: 'test@example.com'
      })
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
  
  describe('RegisterRequestSchema', () => {
    it('should validate correct registration data', () => {
      const result = validate(RegisterRequestSchema, {
        login: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data).toMatchObject({
        login: 'testuser',
        email: 'test@example.com'
      })
    })
    
    it('should reject short login', () => {
      const result = validate(RegisterRequestSchema, {
        login: 'ab',
        email: 'test@example.com',
        password: 'password123'
      })
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.field === 'login')).toBe(true)
    })
    
    it('should reject invalid email format', () => {
      const result = validate(RegisterRequestSchema, {
        login: 'testuser',
        email: 'not-an-email',
        password: 'password123'
      })
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.field === 'email')).toBe(true)
    })
    
    it('should reject short password', () => {
      const result = validate(RegisterRequestSchema, {
        login: 'testuser',
        email: 'test@example.com',
        password: '12345'
      })
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.field === 'password')).toBe(true)
    })
    
    it('should reject login with special characters', () => {
      const result = validate(RegisterRequestSchema, {
        login: 'test@user!',
        email: 'test@example.com',
        password: 'password123'
      })
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.field === 'login')).toBe(true)
    })
  })
  
  describe('CreateUserRequestSchema', () => {
    it('should validate user creation with role', () => {
      const result = validate(CreateUserRequestSchema, {
        login: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        role: 'STAFF',
        hotelId: 1
      })
      
      expect(result.isValid).toBe(true)
      expect(result.data?.role).toBe('STAFF')
    })
    
    it('should reject invalid role', () => {
      const result = validate(CreateUserRequestSchema, {
        login: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        role: 'INVALID_ROLE'
      })
      
      expect(result.isValid).toBe(false)
    })
  })
  
  describe('ChangePasswordSchema', () => {
    it('should validate password change', () => {
      const result = validate(ChangePasswordSchema, {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      })
      
      expect(result.isValid).toBe(true)
    })
    
    it('should reject same password', () => {
      const result = validate(ChangePasswordSchema, {
        currentPassword: 'samepassword',
        newPassword: 'samepassword'
      })
      
      expect(result.isValid).toBe(false)
    })
  })
  
  describe('Role Hierarchy', () => {
    it('SUPER_ADMIN can assign any role', () => {
      expect(canAssignRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true)
      expect(canAssignRole('SUPER_ADMIN', 'HOTEL_ADMIN')).toBe(true)
      expect(canAssignRole('SUPER_ADMIN', 'STAFF')).toBe(true)
    })
    
    it('HOTEL_ADMIN cannot assign SUPER_ADMIN', () => {
      expect(canAssignRole('HOTEL_ADMIN', 'SUPER_ADMIN')).toBe(false)
      expect(canAssignRole('HOTEL_ADMIN', 'HOTEL_ADMIN')).toBe(true)
      expect(canAssignRole('HOTEL_ADMIN', 'STAFF')).toBe(true)
    })
    
    it('MANAGER can only assign DEPARTMENT_MANAGER and STAFF', () => {
      expect(canAssignRole('MANAGER', 'HOTEL_ADMIN')).toBe(false)
      expect(canAssignRole('MANAGER', 'MANAGER')).toBe(false)
      expect(canAssignRole('MANAGER', 'DEPARTMENT_MANAGER')).toBe(true)
      expect(canAssignRole('MANAGER', 'STAFF')).toBe(true)
    })
    
    it('STAFF cannot assign any role', () => {
      expect(canAssignRole('STAFF', 'STAFF')).toBe(false)
    })
    
    it('getAllowedRolesForCreator returns correct roles', () => {
      expect(getAllowedRolesForCreator('SUPER_ADMIN')).toContain('HOTEL_ADMIN')
      expect(getAllowedRolesForCreator('MANAGER')).toEqual(['DEPARTMENT_MANAGER', 'STAFF'])
      expect(getAllowedRolesForCreator('STAFF')).toEqual([])
    })
  })
})
