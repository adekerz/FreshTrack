/**
 * FreshTrack Validation Utilities
 * Centralized input validation for backend
 */

import { validate as uuidValidate } from 'uuid'

/**
 * Validate password strength
 * @param {string} password 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' }
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' }
  }
  return { valid: true }
}

/**
 * Validate UUID format
 * @param {string} id 
 * @returns {boolean}
 */
export function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false
  return uuidValidate(id)
}

/**
 * Validate string length
 * @param {string} value 
 * @param {number} maxLength 
 * @param {string} fieldName 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateStringLength(value, maxLength, fieldName) {
  if (value && typeof value === 'string' && value.length > maxLength) {
    return { valid: false, error: `${fieldName} is too long (max ${maxLength} characters)` }
  }
  return { valid: true }
}

/**
 * Validate required fields
 * @param {object} body 
 * @param {string[]} requiredFields 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRequired(body, requiredFields) {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return { valid: false, error: `${field} is required` }
    }
  }
  return { valid: true }
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Sanitize string input (trim, remove null bytes)
 * @param {string} value 
 * @returns {string}
 */
export function sanitizeString(value) {
  if (!value || typeof value !== 'string') return value
  return value.trim().replace(/\0/g, '')
}

/**
 * Field length limits
 */
export const FIELD_LIMITS = {
  NAME: 255,
  DESCRIPTION: 2000,
  EMAIL: 320,
  LOGIN: 100,
  SKU: 100,
  BARCODE: 100,
  NOTES: 1000
}

export default {
  validatePassword,
  isValidUUID,
  validateStringLength,
  validateRequired,
  isValidEmail,
  sanitizeString,
  FIELD_LIMITS
}
