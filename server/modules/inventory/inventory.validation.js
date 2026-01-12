/**
 * Inventory Module - Validation Schemas
 * 
 * Валидация для продуктов, партий, категорий.
 */

/**
 * Валидация данных для создания партии
 */
export function validateCreateBatch(data) {
  const errors = []
  
  // Product validation
  if (!data.product_id && !data.product_name) {
    errors.push({ field: 'product', message: 'Product ID or name is required' })
  }
  
  // Quantity validation
  if (data.quantity !== undefined) {
    if (typeof data.quantity !== 'number' || data.quantity < 0) {
      errors.push({ field: 'quantity', message: 'Quantity must be a positive number' })
    }
  }
  
  // Expiry date validation
  if (!data.expiry_date) {
    errors.push({ field: 'expiry_date', message: 'Expiry date is required' })
  } else {
    const expiryDate = new Date(data.expiry_date)
    if (isNaN(expiryDate.getTime())) {
      errors.push({ field: 'expiry_date', message: 'Invalid expiry date format' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      product_id: data.product_id,
      product_name: data.product_name?.trim(),
      quantity: data.quantity || 1,
      unit: data.unit?.trim() || 'шт',
      expiry_date: data.expiry_date,
      department_id: data.department_id,
      notes: data.notes?.trim() || null
    } : null
  }
}

/**
 * Валидация данных для обновления партии
 */
export function validateUpdateBatch(data) {
  const errors = []
  
  // Quantity validation (if provided)
  if (data.quantity !== undefined) {
    if (typeof data.quantity !== 'number' || data.quantity < 0) {
      errors.push({ field: 'quantity', message: 'Quantity must be a positive number' })
    }
  }
  
  // Expiry date validation (if provided)
  if (data.expiry_date !== undefined) {
    const expiryDate = new Date(data.expiry_date)
    if (isNaN(expiryDate.getTime())) {
      errors.push({ field: 'expiry_date', message: 'Invalid expiry date format' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      quantity: data.quantity,
      unit: data.unit?.trim(),
      expiry_date: data.expiry_date,
      notes: data.notes?.trim(),
      status: data.status
    } : null
  }
}

/**
 * Валидация данных для создания продукта
 */
export function validateCreateProduct(data) {
  const errors = []
  
  // Name validation
  if (!data.name || typeof data.name !== 'string') {
    errors.push({ field: 'name', message: 'Product name is required' })
  } else if (data.name.length < 2) {
    errors.push({ field: 'name', message: 'Product name must be at least 2 characters' })
  } else if (data.name.length > 100) {
    errors.push({ field: 'name', message: 'Product name must be less than 100 characters' })
  }
  
  // Category validation (optional)
  if (data.category_id !== undefined && data.category_id !== null) {
    if (typeof data.category_id !== 'number' && typeof data.category_id !== 'string') {
      errors.push({ field: 'category_id', message: 'Invalid category ID' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      name: data.name.trim(),
      category_id: data.category_id || null,
      default_unit: data.default_unit?.trim() || 'шт',
      barcode: data.barcode?.trim() || null,
      description: data.description?.trim() || null
    } : null
  }
}

/**
 * Валидация данных для создания категории
 */
export function validateCreateCategory(data) {
  const errors = []
  
  // Name validation
  if (!data.name || typeof data.name !== 'string') {
    errors.push({ field: 'name', message: 'Category name is required' })
  } else if (data.name.length < 2) {
    errors.push({ field: 'name', message: 'Category name must be at least 2 characters' })
  } else if (data.name.length > 50) {
    errors.push({ field: 'name', message: 'Category name must be less than 50 characters' })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      color: data.color || null,
      icon: data.icon || null
    } : null
  }
}

/**
 * Валидация данных для сбора (collection)
 */
export function validateCollection(data) {
  const errors = []
  
  // Batch ID validation
  if (!data.batch_id) {
    errors.push({ field: 'batch_id', message: 'Batch ID is required' })
  }
  
  // Quantity validation
  if (data.quantity === undefined || data.quantity === null) {
    errors.push({ field: 'quantity', message: 'Quantity is required' })
  } else if (typeof data.quantity !== 'number' || data.quantity <= 0) {
    errors.push({ field: 'quantity', message: 'Quantity must be a positive number' })
  }
  
  // Reason validation
  if (!data.reason || typeof data.reason !== 'string') {
    errors.push({ field: 'reason', message: 'Collection reason is required' })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      batch_id: data.batch_id,
      quantity: data.quantity,
      reason: data.reason.trim(),
      notes: data.notes?.trim() || null
    } : null
  }
}

/**
 * Валидация фильтров для списка партий
 */
export function validateBatchFilters(query) {
  const filters = {
    department_id: query.department_id || null,
    category_id: query.category_id || null,
    status: query.status || null,
    expiry_from: query.expiry_from || null,
    expiry_to: query.expiry_to || null,
    search: query.search?.trim() || null,
    page: parseInt(query.page) || 1,
    limit: Math.min(parseInt(query.limit) || 50, 200) // Max 200
  }
  
  // Validate dates
  if (filters.expiry_from) {
    const date = new Date(filters.expiry_from)
    if (isNaN(date.getTime())) {
      filters.expiry_from = null
    }
  }
  
  if (filters.expiry_to) {
    const date = new Date(filters.expiry_to)
    if (isNaN(date.getTime())) {
      filters.expiry_to = null
    }
  }
  
  return filters
}
