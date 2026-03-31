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
        password: 'Password123!' // Добавлен спецсимвол и заглавная буква
      })

      expect(result.isValid).toBe(true)
      expect(result.data).toEqual({
        email: 'test@example.com',
        password: 'Password123!'
      })
    })

    it('should trim and lowercase email', () => {
      const result = validate(LoginRequestSchema, {
        email: '  TEST@Example.COM  ',
        password: 'Password123!'
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.email).toBe('test@example.com')
    })

    it('should reject missing email', () => {
      const result = validate(LoginRequestSchema, {
        password: 'Password123!'
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
        password: 'Password123!',
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
        password: 'Password123!'
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.field === 'login')).toBe(true)
    })

    it('should reject invalid email format', () => {
      const result = validate(RegisterRequestSchema, {
        login: 'testuser',
        email: 'not-an-email',
        password: 'Password123!'
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
        password: 'Password123!'
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
        password: 'Password123!',
        role: 'STAFF',
        hotelId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' // UUID вместо числа
      })

      expect(result.isValid).toBe(true)
      expect(result.data?.role).toBe('STAFF')
    })

    it('should reject invalid role', () => {
      const result = validate(CreateUserRequestSchema, {
        login: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
        role: 'INVALID_ROLE'
      })

      expect(result.isValid).toBe(false)
    })
  })

  describe('ChangePasswordSchema', () => {
    it('should validate password change', () => {
      const result = validate(ChangePasswordSchema, {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword123!'
      })

      expect(result.isValid).toBe(true)
    })

    it('should reject same password', () => {
      const result = validate(ChangePasswordSchema, {
        currentPassword: 'SamePassword1!',
        newPassword: 'SamePassword1!'
      })

      expect(result.isValid).toBe(false)
    })
  })

  describe('Role Hierarchy', () => {
    it('SUPER_ADMIN can assign any role', () => {
      expect(canAssignRole('SUPER_ADMIN', 'SUPER_ADMIN', true)).toBe(true) // is_owner=true
      expect(canAssignRole('SUPER_ADMIN', 'HOTEL_ADMIN')).toBe(true)
      expect(canAssignRole('SUPER_ADMIN', 'STAFF')).toBe(true)
    })

    it('HOTEL_ADMIN cannot assign SUPER_ADMIN or HOTEL_ADMIN', () => {
      expect(canAssignRole('HOTEL_ADMIN', 'SUPER_ADMIN')).toBe(false)
      expect(canAssignRole('HOTEL_ADMIN', 'HOTEL_ADMIN')).toBe(false)
      expect(canAssignRole('HOTEL_ADMIN', 'DEPARTMENT_MANAGER')).toBe(true)
      expect(canAssignRole('HOTEL_ADMIN', 'STAFF')).toBe(true)
    })

    it('DEPARTMENT_MANAGER can only assign STAFF', () => {
      expect(canAssignRole('DEPARTMENT_MANAGER', 'HOTEL_ADMIN')).toBe(false)
      expect(canAssignRole('DEPARTMENT_MANAGER', 'DEPARTMENT_MANAGER')).toBe(false)
      expect(canAssignRole('DEPARTMENT_MANAGER', 'STAFF')).toBe(true)
    })

    it('STAFF cannot assign any role', () => {
      expect(canAssignRole('STAFF', 'STAFF')).toBe(false)
    })

    it('getAllowedRolesForCreator returns correct roles', () => {
      expect(getAllowedRolesForCreator('SUPER_ADMIN')).toContain('HOTEL_ADMIN')
      expect(getAllowedRolesForCreator('DEPARTMENT_MANAGER')).toEqual(['STAFF'])
      expect(getAllowedRolesForCreator('STAFF')).toEqual([])
    })
  })
})
