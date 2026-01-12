/**
 * Auth Module - Validation Schemas
 * 
 * Zod-подобные схемы валидации для auth эндпоинтов.
 * Используется для валидации входящих данных.
 */

/**
 * Валидация данных для логина
 */
export function validateLogin(data) {
  const errors = []
  
  if (!data.email || typeof data.email !== 'string') {
    errors.push({ field: 'email', message: 'Email/login is required' })
  }
  
  if (!data.password || typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      email: data.email.trim().toLowerCase(),
      password: data.password
    } : null
  }
}

/**
 * Валидация данных для регистрации
 */
export function validateRegister(data) {
  const errors = []
  
  // Login validation
  if (!data.login || typeof data.login !== 'string') {
    errors.push({ field: 'login', message: 'Login is required' })
  } else if (data.login.length < 3) {
    errors.push({ field: 'login', message: 'Login must be at least 3 characters' })
  } else if (data.login.length > 50) {
    errors.push({ field: 'login', message: 'Login must be less than 50 characters' })
  } else if (!/^[a-zA-Z0-9_]+$/.test(data.login)) {
    errors.push({ field: 'login', message: 'Login can only contain letters, numbers and underscore' })
  }
  
  // Email validation
  if (!data.email || typeof data.email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' })
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' })
  }
  
  // Password validation
  if (!data.password || typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' })
  } else if (data.password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters' })
  }
  
  // Name validation (optional)
  if (data.name && typeof data.name === 'string' && data.name.length > 100) {
    errors.push({ field: 'name', message: 'Name must be less than 100 characters' })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      login: data.login.trim().toLowerCase(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      name: data.name?.trim() || null
    } : null
  }
}

/**
 * Валидация данных для создания пользователя (админом)
 */
export function validateCreateUser(data, creatorRole) {
  const errors = []
  
  // Login validation
  if (!data.login || typeof data.login !== 'string') {
    errors.push({ field: 'login', message: 'Login is required' })
  } else if (data.login.length < 3) {
    errors.push({ field: 'login', message: 'Login must be at least 3 characters' })
  }
  
  // Email validation
  if (!data.email || typeof data.email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' })
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' })
  }
  
  // Password validation
  if (!data.password || typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' })
  } else if (data.password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters' })
  }
  
  // Role validation
  const allowedRoles = getAllowedRolesForCreator(creatorRole)
  if (!data.role) {
    errors.push({ field: 'role', message: 'Role is required' })
  } else if (!allowedRoles.includes(data.role.toUpperCase())) {
    errors.push({ field: 'role', message: `You can only create users with roles: ${allowedRoles.join(', ')}` })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      login: data.login.trim().toLowerCase(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      name: data.name?.trim() || null,
      role: data.role.toUpperCase(),
      hotel_id: data.hotel_id || null,
      department_id: data.department_id || null
    } : null
  }
}

/**
 * Валидация данных для обновления пользователя
 */
export function validateUpdateUser(data) {
  const errors = []
  
  // Email validation (if provided)
  if (data.email !== undefined) {
    if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push({ field: 'email', message: 'Invalid email format' })
    }
  }
  
  // Password validation (if provided)
  if (data.password !== undefined) {
    if (typeof data.password !== 'string' || data.password.length < 6) {
      errors.push({ field: 'password', message: 'Password must be at least 6 characters' })
    }
  }
  
  // Name validation (if provided)
  if (data.name !== undefined && data.name !== null) {
    if (typeof data.name !== 'string' || data.name.length > 100) {
      errors.push({ field: 'name', message: 'Name must be less than 100 characters' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      email: data.email?.trim().toLowerCase(),
      password: data.password,
      name: data.name?.trim(),
      role: data.role?.toUpperCase(),
      department_id: data.department_id,
      is_active: data.is_active
    } : null
  }
}

/**
 * Получение разрешённых ролей для создания пользователей
 */
export function getAllowedRolesForCreator(creatorRole) {
  const role = creatorRole?.toUpperCase()
  
  switch (role) {
    case 'SUPER_ADMIN':
      return ['SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER', 'STAFF']
    case 'HOTEL_ADMIN':
      return ['HOTEL_ADMIN', 'DEPARTMENT_MANAGER', 'STAFF']
    case 'DEPARTMENT_MANAGER':
      return ['STAFF']
    default:
      return []
  }
}

/**
 * Проверка может ли пользователь редактировать другого
 */
export function canEditUser(editorRole, targetRole) {
  const roleHierarchy = {
    'SUPER_ADMIN': 100,
    'HOTEL_ADMIN': 80,
    'DEPARTMENT_MANAGER': 50,
    'STAFF': 10
  }
  
  const editorLevel = roleHierarchy[editorRole?.toUpperCase()] || 0
  const targetLevel = roleHierarchy[targetRole?.toUpperCase()] || 0
  
  return editorLevel > targetLevel
}
