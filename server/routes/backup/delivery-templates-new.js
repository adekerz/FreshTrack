/**
 * FreshTrack Delivery Templates API - PostgreSQL Async Version
 */

import express from 'express'
import {
  getAllDeliveryTemplates,
  getDeliveryTemplateById,
  createDeliveryTemplate,
  updateDeliveryTemplate,
  deleteDeliveryTemplate,
  logAudit
} from '../db/database.js'
import { authMiddleware, hotelIsolation, hotelAdminOnly } from '../middleware/auth.js'

const router = express.Router()

// GET /api/delivery-templates
router.get('/', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const { department_id, supplier, is_active } = req.query
    const filters = {
      department_id: department_id || req.departmentId,
      supplier,
      is_active: is_active !== undefined ? is_active === 'true' : undefined
    }
    const templates = await getAllDeliveryTemplates(req.hotelId, filters)
    res.json({ success: true, templates })
  } catch (error) {
    console.error('Get delivery templates error:', error)
    res.status(500).json({ success: false, error: 'Failed to get delivery templates' })
  }
})

// GET /api/delivery-templates/:id
router.get('/:id', authMiddleware, hotelIsolation, async (req, res) => {
  try {
    const template = await getDeliveryTemplateById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, error: 'Delivery template not found' })
    }
    if (template.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    res.json({ success: true, template })
  } catch (error) {
    console.error('Get delivery template error:', error)
    res.status(500).json({ success: false, error: 'Failed to get delivery template' })
  }
})

// POST /api/delivery-templates
router.post('/', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const { name, description, supplier, department_id, items, schedule, notes } = req.body
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Template name is required' })
    }
    
    const template = await createDeliveryTemplate({
      hotel_id: req.hotelId,
      name, description, supplier,
      department_id: department_id || req.departmentId,
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
    console.error('Create delivery template error:', error)
    res.status(500).json({ success: false, error: 'Failed to create delivery template' })
  }
})

// PUT /api/delivery-templates/:id
router.put('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const template = await getDeliveryTemplateById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, error: 'Delivery template not found' })
    }
    if (template.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    
    const { name, description, supplier, department_id, items, schedule, notes, is_active } = req.body
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
    console.error('Update delivery template error:', error)
    res.status(500).json({ success: false, error: 'Failed to update delivery template' })
  }
})

// DELETE /api/delivery-templates/:id
router.delete('/:id', authMiddleware, hotelIsolation, hotelAdminOnly, async (req, res) => {
  try {
    const template = await getDeliveryTemplateById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, error: 'Delivery template not found' })
    }
    if (template.hotel_id !== req.hotelId) {
      return res.status(403).json({ success: false, error: 'Access denied' })
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
    console.error('Delete delivery template error:', error)
    res.status(500).json({ success: false, error: 'Failed to delete delivery template' })
  }
})

export default router
