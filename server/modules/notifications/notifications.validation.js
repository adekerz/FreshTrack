/**
 * Notifications Module - Validation Schemas
 * 
 * Валидация для уведомлений и правил уведомлений.
 */

/**
 * Валидация правила уведомлений
 */
export function validateNotificationRule(data) {
  const errors = []
  
  // Name validation
  if (!data.name || typeof data.name !== 'string') {
    errors.push({ field: 'name', message: 'Rule name is required' })
  } else if (data.name.length < 2) {
    errors.push({ field: 'name', message: 'Rule name must be at least 2 characters' })
  } else if (data.name.length > 100) {
    errors.push({ field: 'name', message: 'Rule name must be less than 100 characters' })
  }
  
  // Type validation
  const validTypes = ['expiry_warning', 'expiry_critical', 'expired', 'daily_report', 'custom']
  if (!data.type || !validTypes.includes(data.type)) {
    errors.push({ field: 'type', message: `Rule type must be one of: ${validTypes.join(', ')}` })
  }
  
  // Days before validation (for expiry rules)
  if (data.type?.includes('expiry') && data.days_before !== undefined) {
    if (typeof data.days_before !== 'number' || data.days_before < 0 || data.days_before > 365) {
      errors.push({ field: 'days_before', message: 'Days before must be between 0 and 365' })
    }
  }
  
  // Channels validation
  const validChannels = ['email', 'telegram', 'push', 'in_app']
  if (data.channels) {
    if (!Array.isArray(data.channels)) {
      errors.push({ field: 'channels', message: 'Channels must be an array' })
    } else {
      const invalidChannels = data.channels.filter(c => !validChannels.includes(c))
      if (invalidChannels.length > 0) {
        errors.push({ field: 'channels', message: `Invalid channels: ${invalidChannels.join(', ')}` })
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      name: data.name.trim(),
      type: data.type,
      days_before: data.days_before || 0,
      channels: data.channels || ['in_app'],
      is_active: data.is_active !== false,
      schedule: data.schedule || null,
      template: data.template?.trim() || null,
      department_ids: data.department_ids || null
    } : null
  }
}

/**
 * Валидация настроек уведомлений пользователя
 */
export function validateUserNotificationSettings(data) {
  const errors = []
  
  // Email notifications
  if (data.email_enabled !== undefined && typeof data.email_enabled !== 'boolean') {
    errors.push({ field: 'email_enabled', message: 'Email enabled must be a boolean' })
  }
  
  // Telegram notifications
  if (data.telegram_enabled !== undefined && typeof data.telegram_enabled !== 'boolean') {
    errors.push({ field: 'telegram_enabled', message: 'Telegram enabled must be a boolean' })
  }
  
  // Push notifications
  if (data.push_enabled !== undefined && typeof data.push_enabled !== 'boolean') {
    errors.push({ field: 'push_enabled', message: 'Push enabled must be a boolean' })
  }
  
  // Quiet hours
  if (data.quiet_hours_start !== undefined) {
    if (typeof data.quiet_hours_start !== 'string' || !/^\d{2}:\d{2}$/.test(data.quiet_hours_start)) {
      errors.push({ field: 'quiet_hours_start', message: 'Quiet hours start must be in HH:MM format' })
    }
  }
  
  if (data.quiet_hours_end !== undefined) {
    if (typeof data.quiet_hours_end !== 'string' || !/^\d{2}:\d{2}$/.test(data.quiet_hours_end)) {
      errors.push({ field: 'quiet_hours_end', message: 'Quiet hours end must be in HH:MM format' })
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      email_enabled: data.email_enabled,
      telegram_enabled: data.telegram_enabled,
      push_enabled: data.push_enabled,
      quiet_hours_start: data.quiet_hours_start,
      quiet_hours_end: data.quiet_hours_end,
      digest_frequency: data.digest_frequency || 'realtime'
    } : null
  }
}

/**
 * Валидация отправки тестового уведомления
 */
export function validateTestNotification(data) {
  const errors = []
  
  // Channel validation
  const validChannels = ['email', 'telegram', 'push']
  if (!data.channel || !validChannels.includes(data.channel)) {
    errors.push({ field: 'channel', message: `Channel must be one of: ${validChannels.join(', ')}` })
  }
  
  // Message validation (optional)
  if (data.message && typeof data.message !== 'string') {
    errors.push({ field: 'message', message: 'Message must be a string' })
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? {
      channel: data.channel,
      message: data.message?.trim() || 'Test notification from FreshTrack'
    } : null
  }
}

/**
 * Валидация фильтров для истории уведомлений
 */
export function validateNotificationFilters(query) {
  const filters = {
    type: query.type || null,
    channel: query.channel || null,
    is_read: query.is_read === 'true' ? true : (query.is_read === 'false' ? false : null),
    from_date: query.from_date || null,
    to_date: query.to_date || null,
    page: parseInt(query.page) || 1,
    limit: Math.min(parseInt(query.limit) || 50, 200)
  }
  
  // Validate dates
  if (filters.from_date) {
    const date = new Date(filters.from_date)
    if (isNaN(date.getTime())) {
      filters.from_date = null
    }
  }
  
  if (filters.to_date) {
    const date = new Date(filters.to_date)
    if (isNaN(date.getTime())) {
      filters.to_date = null
    }
  }
  
  return filters
}
