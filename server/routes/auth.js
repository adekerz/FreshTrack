/**
 * FreshTrack Auth API - PostgreSQL Async Version
 */

import express from 'express'
import { 
  getUserByLoginOrEmail, 
  getUserById,
  createUser, 
  updateUser,
  verifyPassword, 
  getAllUsers,
  updateLastLogin,
  logAudit,
  getHotelById
} from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation,
  generateToken,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'
import { PermissionService } from '../services/PermissionService.js'

const router = express.Router()

/**
 * Helper: Get user permissions as string array
 * Format: 'resource:action' (e.g., 'products:delete', 'batches:read')
 */
async function getUserPermissionsArray(user) {
  try {
    const permissions = await PermissionService.getUserPermissions(user)
    // Convert to 'resource:action' format
    return permissions.map(p => `${p.resource}:${p.action}`)
  } catch (error) {
    console.error('Error loading permissions:', error)
    // Fallback based on role for resilience
    const role = user.role?.toUpperCase()
    if (role === 'SUPER_ADMIN') return ['*']
    if (role === 'HOTEL_ADMIN') return ['*']
    return []
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Login/email and password are required' })
    }
    
    const user = await getUserByLoginOrEmail(email)
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }
    
    const isValidPassword = verifyPassword(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' })
    }
    
    await updateLastLogin(user.id)
    const token = generateToken(user)
    
    let hotel = null
    if (user.hotel_id) {
      hotel = await getHotelById(user.hotel_id)
    }
    
    await logAudit({
      hotel_id: user.hotel_id,
      user_id: user.id,
      user_name: user.name || user.login,
      action: 'login',
      entity_type: 'user',
      entity_id: user.id,
      details: { method: 'password' },
      ip_address: req.ip
    })
    
    // Get user permissions from database
    const permissions = await getUserPermissionsArray(user)
    
    res.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        role: user.role,
        hotel_id: user.hotel_id,
        department_id: user.department_id,
        hotel: hotel ? { id: hotel.id, name: hotel.name, code: hotel.code } : null,
        telegram_chat_id: user.telegram_chat_id,
        permissions // NEW: Array of 'resource:action' strings
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ success: false, error: 'Authentication failed' })
  }
})

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await logAudit({
      hotel_id: req.user.hotel_id,
      user_id: req.user.id,
      user_name: req.user.name || req.user.login,
      action: 'logout',
      entity_type: 'user',
      entity_id: req.user.id,
      ip_address: req.ip
    })
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ success: false, error: 'Logout failed' })
  }
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    let hotel = null
    if (user.hotel_id) {
      hotel = await getHotelById(user.hotel_id)
    }
    
    // Get user permissions from database
    const permissions = await getUserPermissionsArray(user)
    
    res.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        role: user.role,
        hotel_id: user.hotel_id,
        department_id: user.department_id,
        hotel: hotel ? { id: hotel.id, name: hotel.name, code: hotel.code } : null,
        telegram_chat_id: user.telegram_chat_id,
        permissions // NEW: Array of 'resource:action' strings
      }
    })
  } catch (error) {
    console.error('Get me error:', error)
    res.status(500).json({ success: false, error: 'Failed to get user info' })
  }
})

// GET /api/auth/users
router.get('/users', authMiddleware, hotelIsolation, requirePermission(PermissionResource.USERS, PermissionAction.READ), async (req, res) => {
  try {
    const users = await getAllUsers(req.hotelId)
    const safeUsers = users.map(u => ({
      id: u.id, login: u.login, name: u.name, email: u.email, role: u.role,
      hotel_id: u.hotel_id, department_id: u.department_id, telegram_chat_id: u.telegram_chat_id,
      is_active: u.is_active, created_at: u.created_at
    }))
    res.json({ success: true, users: safeUsers })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ success: false, error: 'Failed to get users' })
  }
})

// POST /api/auth/users
router.post('/users', authMiddleware, hotelIsolation, requirePermission(PermissionResource.USERS, PermissionAction.CREATE), async (req, res) => {
  try {
    const { login, name, email, password, role, department_id } = req.body
    
    if (!login || !name || !password) {
      return res.status(400).json({ success: false, error: 'Login, name and password are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
    }
    
    const existingUser = await getUserByLoginOrEmail(login)
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User with this login already exists' })
    }
    
    let assignedRole = role || 'STAFF'
    if (req.user.role === 'HOTEL_ADMIN' && assignedRole === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Cannot create Super Admin user' })
    }
    if (req.user.role === 'HOTEL_ADMIN' && !['HOTEL_ADMIN', 'STAFF'].includes(assignedRole)) {
      assignedRole = 'STAFF'
    }
    
    let userHotelId = req.hotelId
    if (req.user.role === 'SUPER_ADMIN') {
      userHotelId = req.body.hotel_id || null
    }
    
    const newUser = await createUser({ login, name, email, password, role: assignedRole, hotel_id: userHotelId, department_id })
    
    await logAudit({
      hotel_id: userHotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'user', entity_id: newUser.id,
      details: { login, name, role: assignedRole }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, user: newUser })
  } catch (error) {
    console.error('Create user error:', error)
    res.status(500).json({ success: false, error: 'Failed to create user' })
  }
})

// PUT /api/auth/users/:id
router.put('/users/:id', authMiddleware, requirePermission(PermissionResource.USERS, PermissionAction.UPDATE, {
  getTargetHotelId: async (req) => {
    const user = await getUserById(req.params.id)
    return user ? user.hotel_id : null
  }
}), async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, password, role, department_id, is_active } = req.body
    
    const user = await getUserById(id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    if (req.user.role !== 'SUPER_ADMIN' && user.hotel_id !== req.user.hotel_id) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // canManageUser: prevent managing users at same or higher level
    if (req.user.role === 'HOTEL_ADMIN' && user.role === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Cannot update Super Admin user' })
    }
    if (req.user.role === 'HOTEL_ADMIN' && user.role === 'HOTEL_ADMIN' && user.id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Cannot manage other hotel admins' })
    }
    
    const updates = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (password) updates.password = password
    if (department_id !== undefined) updates.department_id = department_id
    if (is_active !== undefined) updates.is_active = is_active
    if (role !== undefined && !(req.user.role === 'HOTEL_ADMIN' && role === 'SUPER_ADMIN')) {
      updates.role = role
    }
    
    const success = await updateUser(id, updates)
    if (success) {
      await logAudit({
        hotel_id: user.hotel_id, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'user', entity_id: id,
        details: { updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ success: false, error: 'Failed to update user' })
  }
})

// PATCH /api/auth/users/:id - Partial update (alias for PUT)
router.patch('/users/:id', authMiddleware, requirePermission(PermissionResource.USERS, PermissionAction.UPDATE, {
  getTargetHotelId: async (req) => {
    const user = await getUserById(req.params.id)
    return user ? user.hotel_id : null
  }
}), async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, password, role, department_id, is_active } = req.body
    
    const user = await getUserById(id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    if (req.user.role !== 'SUPER_ADMIN' && user.hotel_id !== req.user.hotel_id) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // SECURITY: HOTEL_ADMIN cannot manage SUPER_ADMIN or other HOTEL_ADMINs
    if (req.user.role === 'HOTEL_ADMIN' && user.role === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Cannot update Super Admin user' })
    }
    if (req.user.role === 'HOTEL_ADMIN' && user.role === 'HOTEL_ADMIN' && user.id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Cannot manage other hotel admins' })
    }
    
    const updates = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (password) updates.password = password
    if (department_id !== undefined) updates.department_id = department_id
    if (is_active !== undefined) updates.is_active = is_active
    if (role !== undefined) updates.role = role
    
    const success = await updateUser(id, updates)
    if (success) {
      await logAudit({
        hotel_id: user.hotel_id, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'user', entity_id: id,
        details: { updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Patch user error:', error)
    res.status(500).json({ success: false, error: 'Failed to update user' })
  }
})

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, password, telegram_chat_id } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (password) updates.password = password
    if (telegram_chat_id !== undefined) updates.telegram_chat_id = telegram_chat_id
    
    const success = await updateUser(req.user.id, updates)
    if (success) {
      await logAudit({
        hotel_id: req.user.hotel_id, user_id: req.user.id, user_name: req.user.name,
        action: 'update_profile', entity_type: 'user', entity_id: req.user.id,
        details: { fields: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ success: false, error: 'Failed to update profile' })
  }
})

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' })
    }
    
    const user = await getUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' })
    }
    
    const success = await updateUser(req.user.id, { password: newPassword })
    if (success) {
      await logAudit({
        hotel_id: req.user.hotel_id, user_id: req.user.id, user_name: req.user.name,
        action: 'change_password', entity_type: 'user', entity_id: req.user.id, ip_address: req.ip
      })
    }
    res.json({ success, message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ success: false, error: 'Failed to change password' })
  }
})

export default router
