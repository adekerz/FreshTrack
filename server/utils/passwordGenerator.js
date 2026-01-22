import crypto from 'crypto'

/**
 * Generate secure temporary password
 * Requirements:
 * - 12-16 characters
 * - At least 1 uppercase, 1 lowercase, 1 number, 1 special char
 * - Easy to read (avoid ambiguous chars: 0/O, 1/l/I)
 */
export function generateTemporaryPassword(length = 12) {
  // Character sets (excluding ambiguous characters)
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // без I, O
  const lowercase = 'abcdefghijkmnpqrstuvwxyz' // без l, o
  const numbers = '23456789' // без 0, 1
  const special = '!@#$%^&*-_=+'
  
  const allChars = uppercase + lowercase + numbers + special
  
  // Ensure at least one char from each set
  let password = ''
  password += uppercase[crypto.randomInt(uppercase.length)]
  password += lowercase[crypto.randomInt(lowercase.length)]
  password += numbers[crypto.randomInt(numbers.length)]
  password += special[crypto.randomInt(special.length)]
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(2) - 0.5).join('')
}

/**
 * Validate password meets requirements
 */
export function validatePassword(password) {
  const minLength = 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[!@#$%^&*\-_=+]/.test(password)
  
  return {
    isValid: password.length >= minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial,
    errors: {
      length: password.length < minLength ? `Минимум ${minLength} символов` : null,
      uppercase: !hasUppercase ? 'Требуется хотя бы одна заглавная буква' : null,
      lowercase: !hasLowercase ? 'Требуется хотя бы одна строчная буква' : null,
      number: !hasNumber ? 'Требуется хотя бы одна цифра' : null,
      special: !hasSpecial ? 'Требуется хотя бы один спецсимвол (!@#$%^&*-_=+)' : null
    }
  }
}
