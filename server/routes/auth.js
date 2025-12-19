/**
 * FreshTrack Auth API
 * Multi-hotel authentication with role-based access
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
  hotelAdminOnly, 
  hotelIsolation,
  generateToken 
} from '../middleware/auth.js'

const router = express.Router()

/**
 * POST /api/auth/login - User authentication
 * Supports login by email OR username
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Login/email and password are required' 
      })
    }
    
    // Find user by login or email
    const user = getUserByLoginOrEmail(email)
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      })
    }
    
    // Verify password
    const isValidPassword = verifyPassword(password, user.password)
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      })
    }
    
    // Update last login
    updateLastLogin(user.id)
    
    // Generate JWT token
    const token = generateToken(user)
    
    // Get hotel info if user has hotel_id
    let hotel = null
    if (user.hotel_id) {
      hotel = getHotelById(user.hotel_id)
    }
    
    // Log action
    logAudit({
      hotel_id: user.hotel_id,
      user_id: user.id,
      user_name: user.name || user.login,
      action: 'login',
      entity_type: 'user',
      entity_id: user.id,
      details: { method: 'password' },
      ip_address: req.ip
    })
    
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
        telegram_chat_id: user.telegram_chat_id
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed' 
    })
  }
})

/**
 * POST /api/auth/logout - Logout (for logging)
 */
router.post('/logout', authMiddleware, (req, res) => {
  try {
    // Log action
    logAudit({
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

/**
 * GET /api/auth/me - Get current user by token
 */
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = getUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    
    // Get hotel info
    let hotel = null
    if (user.hotel_id) {
      hotel = getHotelById(user.hotel_id)
    }
    
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
        telegram_chat_id: user.telegram_chat_id
      }
    })
  } catch (error) {
    console.error('Get me error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get user info' 
    })
  }
})

/**
 * GET /api/auth/users - Get all users (with hotel isolation)
 * SUPER_ADMIN: all users
 * HOTEL_ADMIN: users from own hotel
 */
router.get('/users', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const users = getAllUsers(req.hotelId)
    
    // Remove passwords
    const safeUsers = users.map(u => ({
      id: u.id,
      login: u.login,
      name: u.name,
      email: u.email,
      role: u.role,
      hotel_id: u.hotel_id,
      department_id: u.department_id,
      telegram_chat_id: u.telegram_chat_id,
      is_active: u.is_active,
      created_at: u.created_at
    }))
    
    res.json({ success: true, users: safeUsers })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ success: false, error: 'Failed to get users' })
  }
})

/**
 * POST /api/auth/users - Create new user
 * SUPER_ADMIN: can create any user
 * HOTEL_ADMIN: can create users for own hotel only
 */
router.post('/users', authMiddleware, hotelAdminOnly, hotelIsolation, (req, res) => {
  try {
    const { login, name, email, password, role, department_id } = req.body
    
    // Validation
    if (!login || !name || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Login, name and password are required' 
      })
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 6 characters' 
      })
    }
    
    // Check if login exists
    const existingUser = getUserByLoginOrEmail(login)
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this login already exists' 
      })
    }
    
    // Validate role assignment
    let assignedRole = role || 'STAFF'
    
    // HOTEL_ADMIN cannot create SUPER_ADMIN
    if (req.user.role === 'HOTEL_ADMIN' && assignedRole === 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot create Super Admin user' 
      })
    }
    
    // HOTEL_ADMIN can only create HOTEL_ADMIN or STAFF for their hotel
    if (req.user.role === 'HOTEL_ADMIN' && !['HOTEL_ADMIN', 'STAFF'].includes(assignedRole)) {
      assignedRole = 'STAFF'
    }
    
    // Determine hotel_id
    let userHotelId = req.hotelId
    if (req.user.role === 'SUPER_ADMIN') {
      userHotelId = req.body.hotel_id || null
    }
    
    // Create user
    const newUser = createUser({
      login,
      name,
      email,
      password,
      role: assignedRole,
      hotel_id: userHotelId,
      department_id
    })
    
    // Log action
    logAudit({
      hotel_id: userHotelId,
      user_id: req.user.id,
      user_name: req.user.name,
      action: 'create',
      entity_type: 'user',
      entity_id: newUser.id,
      details: { login, name, role: assignedRole },
      ip_address: req.ip
    })
    
    res.status(201).json({
      success: true,
      user: newUser
    })
  } catch (error) {
    console.error('Create user error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user' 
    })
  }
})

/**
 * PUT /api/auth/users/:id - Update user
 */
router.put('/users/:id', authMiddleware, hotelAdminOnly, (req, res) => {
  try {
    const { id } = req.params
    const { name, email, password, role, department_id, is_active } = req.body
    
    // Get user to update
    const user = getUserById(id)
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    
    // Check hotel access
    if (req.user.role !== 'SUPER_ADMIN' && user.hotel_id !== req.user.hotel_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      })
    }
    
    // HOTEL_ADMIN cannot update SUPER_ADMIN
    if (req.user.role === 'HOTEL_ADMIN' && user.role === 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot update Super Admin user' 
      })
    }
    
    // Build updates
    const updates = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (password) updates.password = password
    if (department_id !== undefined) updates.department_id = department_id
    if (is_active !== undefined) updates.is_active = is_active
    
    // Role update with restrictions
    if (role !== undefined) {
      if (req.user.role === 'HOTEL_ADMIN' && role === 'SUPER_ADMIN') {
        // Cannot promote to SUPER_ADMIN
      } else {
        updates.role = role
      }
    }
    
    const success = updateUser(id, updates)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: user.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update',
        entity_type: 'user',
        entity_id: id,
        details: { updates: Object.keys(updates) },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user' 
    })
  }
})

/**
 * PUT /api/auth/profile - Update own profile
 */
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { name, email, password, telegram_chat_id } = req.body
    
    const updates = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (password) updates.password = password
    if (telegram_chat_id !== undefined) updates.telegram_chat_id = telegram_chat_id
    
    const success = updateUser(req.user.id, updates)
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: req.user.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'update_profile',
        entity_type: 'user',
        entity_id: req.user.id,
        details: { fields: Object.keys(updates) },
        ip_address: req.ip
      })
    }
    
    res.json({ success })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile' 
    })
  }
})

/**
 * POST /api/auth/change-password - Change own password
 */
router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current and new password are required' 
      })
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 6 characters' 
      })
    }
    
    // Get user with password
    const user = getUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    
    // Verify current password
    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(401).json({ 
        success: false, 
        error: 'Current password is incorrect' 
      })
    }
    
    // Update password
    const success = updateUser(req.user.id, { password: newPassword })
    
    if (success) {
      // Log action
      logAudit({
        hotel_id: req.user.hotel_id,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'change_password',
        entity_type: 'user',
        entity_id: req.user.id,
        ip_address: req.ip
      })
    }
    
    res.json({ success, message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to change password' 
    })
  }
})

export default router
