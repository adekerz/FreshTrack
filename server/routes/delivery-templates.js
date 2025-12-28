/**
 * FreshTrack Delivery Templates API - PostgreSQL Async Version
 */

import express from 'express'
import { logError } from '../utils/logger.js'
import {
  getAllDeliveryTemplates,
  getDeliveryTemplateById,
  createDeliveryTemplate,
  updateDeliveryTemplate,
  deleteDeliveryTemplate,
  logAudit
} from '../db/database.js'
import { 
  authMiddleware, 
  hotelIsolation, 
  departmentIsolation,
  requirePermission,
  PermissionResource,
  PermissionAction
} from '../middleware/auth.js'

const router = express.Router()

// GET /api/delivery-templates
router.get('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.DELIVERY_TEMPLATES, PermissionAction.READ), async (req, res) => {
  try {
    const { department_id } = req.query
    // Use department from isolation middleware unless user can access all departments
    const deptId = req.canAccessAllDepartments ? (department_id || null) : req.departmentId
    const templates = await getAllDeliveryTemplates(req.hotelId, deptId)
    res.json({ success: true, templates })
  } catch (error) {
    logError('Get delivery templates error', error)
    res.status(500).json({ success: false, error: 'Failed to get delivery templates' })
  }
})

// GET /api/delivery-templates/:id
router.get('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.DELIVERY_TEMPLATES, PermissionAction.READ), async (req, res) => {
  try {
    const template = await getDeliveryTemplateById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, error: 'Delivery template not found' })
    }
    if (template.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && template.department_id && template.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    res.json({ success: true, template })
  } catch (error) {
    logError('Get delivery template error', error)
    res.status(500).json({ success: false, error: 'Failed to get delivery template' })
  }
})

// POST /api/delivery-templates
router.post('/', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.DELIVERY_TEMPLATES, PermissionAction.CREATE), async (req, res) => {
  try {
    const { name, description, supplier, department_id, items, schedule, notes } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Template name is required' })
    }
    
    // Use provided department_id or fall back to user's department
    const templateDeptId = department_id || req.departmentId
    
    // Non-admin users can only create templates for their department
    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot create template for another department' })
    }
    
    const template = await createDeliveryTemplate({
      hotel_id: req.hotelId,
      name, description, supplier,
      department_id: templateDeptId,
      items: items ? JSON.stringify(items) : null,
      schedule: schedule ? JSON.stringify(schedule) : null,
      notes
    })
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'create', entity_type: 'delivery_template', entity_id: template.id,
      details: { name, supplier }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, template })
  } catch (error) {
    logError('Create delivery template error', error)
    res.status(500).json({ success: false, error: 'Failed to create delivery template' })
  }
})

// PUT /api/delivery-templates/:id
router.put('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.DELIVERY_TEMPLATES, PermissionAction.UPDATE), async (req, res) => {
  try {
    const template = await getDeliveryTemplateById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, error: 'Delivery template not found' })
    }
    if (template.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && template.department_id && template.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const { name, description, supplier, department_id, items, schedule, notes, is_active } = req.body
    
    // Non-admin users cannot change department to another department
    if (!req.canAccessAllDepartments && department_id && department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot move template to another department' })
    }
    
    const updates = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (supplier !== undefined) updates.supplier = supplier
    if (department_id !== undefined) updates.department_id = department_id
    if (items !== undefined) updates.items = JSON.stringify(items)
    if (schedule !== undefined) updates.schedule = JSON.stringify(schedule)
    if (notes !== undefined) updates.notes = notes
    if (is_active !== undefined) updates.is_active = is_active
    
    const success = await updateDeliveryTemplate(req.params.id, updates)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'update', entity_type: 'delivery_template', entity_id: req.params.id,
        details: { name: template.name, updates: Object.keys(updates) }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Update delivery template error', error)
    res.status(500).json({ success: false, error: 'Failed to update delivery template' })
  }
})

// POST /api/delivery-templates/:id/apply - Apply template to create batches
router.post('/:id/apply', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.BATCHES, PermissionAction.CREATE), async (req, res) => {
  try {
    const template = await getDeliveryTemplateById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, error: 'Delivery template not found' })
    }
    if (template.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { items, departmentId } = req.body
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Items array is required' })
    }
    
    // Use provided departmentId or fall back to user's department
    const targetDeptId = departmentId || req.departmentId
    
    // Non-admin users can only create batches for their department
    if (!req.canAccessAllDepartments && departmentId && departmentId !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Cannot create batches for another department' })
    }
    
    // Import createBatch from database
    const { createBatch, getProductById } = await import('../db/database.js')
    
    const createdBatches = []
    
    for (const item of items) {
      // Get product to verify it exists
      const product = await getProductById(item.productId)
      if (!product) {
        console.warn(`Product ${item.productId} not found, skipping`)
        continue
      }
      
      const batch = await createBatch({
        hotel_id: req.hotelId,
        department_id: targetDeptId,
        product_id: item.productId,
        quantity: item.quantity || 1,
        expiry_date: item.expiryDate,
        created_by: req.user.id
      })
      
      createdBatches.push(batch)
    }
    
    await logAudit({
      hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
      action: 'apply_template', entity_type: 'delivery_template', entity_id: req.params.id,
      details: { template_name: template.name, batches_created: createdBatches.length }, ip_address: req.ip
    })
    
    res.status(201).json({ success: true, batches: createdBatches })
  } catch (error) {
    logError('Apply delivery template error', error)
    res.status(500).json({ success: false, error: 'Failed to apply delivery template' })
  }
})

// DELETE /api/delivery-templates/:id
router.delete('/:id', authMiddleware, hotelIsolation, departmentIsolation, requirePermission(PermissionResource.DELIVERY_TEMPLATES, PermissionAction.DELETE), async (req, res) => {
  try {
    const template = await getDeliveryTemplateById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, error: 'Delivery template not found' })
    }
    if (template.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    // Check department access
    if (!req.canAccessAllDepartments && template.department_id && template.department_id !== req.departmentId) {
      return res.status(403).json({ success: false, error: 'Access denied to this department' })
    }
    
    const success = await deleteDeliveryTemplate(req.params.id)
    if (success) {
      await logAudit({
        hotel_id: req.hotelId, user_id: req.user.id, user_name: req.user.name,
        action: 'delete', entity_type: 'delivery_template', entity_id: req.params.id,
        details: { name: template.name }, ip_address: req.ip
      })
    }
    res.json({ success })
  } catch (error) {
    logError('Delete delivery template error', error)
    res.status(500).json({ success: false, error: 'Failed to delete delivery template' })
  }
})

export default router



