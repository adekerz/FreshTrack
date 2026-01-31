/**
 * MARSHA Code Service
 * Business logic for Marriott MARSHA code management
 */

import pool from '../db/postgres.js'
import { AuditAction, logAudit } from './AuditService.js'

class MarshaCodeService {
  /**
   * Search MARSHA codes by hotel name with fuzzy matching
   * @param {string} searchQuery - Search query (hotel name)
   * @param {object} options - Search options
   * @returns {Promise<Array>} Matching MARSHA codes
   */
  static async searchByName(searchQuery, options = {}) {
    const { limit = 10, includeAssigned = false } = options

    if (!searchQuery || searchQuery.length < 2) {
      return []
    }

    // Normalize query for better matching
    const normalizedQuery = searchQuery
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .trim()

    // При точном совпадении по коду (5 букв) показывать запись даже если is_assigned — чтобы находить TSERZ при редактировании отеля
    const exactCodeMatch = normalizedQuery.length === 5 && /^[a-z]+$/i.test(normalizedQuery)
    const showAssigned = includeAssigned || exactCodeMatch

    const result = await pool.query(`
      SELECT 
        mc.id, mc.code, mc.hotel_name, mc.city, mc.country, mc.region, mc.brand,
        (mc.is_assigned AND EXISTS (SELECT 1 FROM hotels h WHERE h.id = mc.assigned_to_hotel_id)) AS is_assigned,
        mc.assigned_to_hotel_id,
        similarity(LOWER(mc.hotel_name), $1) as name_sim,
        similarity(LOWER(mc.city), $1) as city_sim
      FROM marsha_codes mc
      WHERE 
        (${showAssigned ? 'TRUE' : '(mc.is_assigned = FALSE OR NOT EXISTS (SELECT 1 FROM hotels h2 WHERE h2.id = mc.assigned_to_hotel_id))'})
        AND (
          LOWER(mc.hotel_name) LIKE '%' || $1 || '%'
          OR LOWER(mc.city) LIKE '%' || $1 || '%'
          OR LOWER(mc.hotel_name) % $1
          OR mc.code ILIKE $1 || '%'
          OR (LENGTH($1) = 5 AND UPPER(mc.code) = UPPER($1))
        )
      ORDER BY 
        CASE WHEN UPPER(mc.code) = UPPER($1) THEN 0 WHEN mc.code ILIKE $1 || '%' THEN 1 ELSE 2 END,
        name_sim DESC,
        city_sim DESC,
        hotel_name ASC
      LIMIT $2
    `, [normalizedQuery, limit])

    return result.rows
  }

  /**
   * Get all available (unassigned) MARSHA codes
   * @param {object} filters - Filter options
   * @returns {Promise<Array>} Available codes
   */
  static async getAvailableCodes(filters = {}) {
    const { country, region, brand, limit = 100, offset = 0 } = filters

    let queryText = `
      SELECT id, code, hotel_name, city, country, region, brand
      FROM marsha_codes
      WHERE is_assigned = FALSE
    `
    const params = []
    let paramIndex = 1

    if (country) {
      queryText += ` AND country = $${paramIndex++}`
      params.push(country)
    }
    if (region) {
      queryText += ` AND region = $${paramIndex++}`
      params.push(region)
    }
    if (brand) {
      queryText += ` AND brand = $${paramIndex++}`
      params.push(brand)
    }

    queryText += ` ORDER BY country, city, hotel_name LIMIT $${paramIndex++} OFFSET $${paramIndex}`
    params.push(limit, offset)

    const result = await pool.query(queryText, params)
    return result.rows
  }

  /**
   * Get MARSHA code by code string
   * @param {string} code - 5-character MARSHA code
   * @returns {Promise<object|null>} MARSHA code details
   */
  static async getByCode(code) {
    if (!code || code.length !== 5) {
      return null
    }

    const result = await pool.query(`
      SELECT 
        mc.*,
        h.name as assigned_hotel_name
      FROM marsha_codes mc
      LEFT JOIN hotels h ON mc.assigned_to_hotel_id = h.id
      WHERE mc.code = $1
    `, [code.toUpperCase()])

    return result.rows[0] || null
  }

  /**
   * Get hotel by MARSHA code
   * @param {string} code - 5-character MARSHA code
   * @returns {Promise<object|null>} Hotel details or null if not found/not assigned
   */
  static async getHotelByMarshaCode(code) {
    if (!code || code.length < 3) {
      return null
    }

    const result = await pool.query(`
      SELECT h.*
      FROM hotels h
      INNER JOIN marsha_codes mc ON h.marsha_code_id = mc.id
      WHERE mc.code = $1
    `, [code.toUpperCase()])

    return result.rows[0] || null
  }

  /**
   * Assign MARSHA code to a hotel
   * @param {string} hotelId - Hotel UUID
   * @param {string} marshaCodeId - MARSHA code UUID
   * @param {object} user - User performing the action
   * @returns {Promise<object>} Updated hotel
   */
  static async assignToHotel(hotelId, marshaCodeId, user) {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Get MARSHA code
      const codeResult = await client.query(
        'SELECT * FROM marsha_codes WHERE id = $1',
        [marshaCodeId]
      )

      if (codeResult.rows.length === 0) {
        throw new Error('MARSHA code not found')
      }

      const marshaCode = codeResult.rows[0]

      if (marshaCode.is_assigned && marshaCode.assigned_to_hotel_id) {
        const assignedHotel = await client.query(
          'SELECT id FROM hotels WHERE id = $1',
          [marshaCode.assigned_to_hotel_id]
        )
        if (assignedHotel.rows.length > 0) {
          throw new Error('This MARSHA code is already assigned to another hotel')
        }
      }

      // Get hotel
      const hotelResult = await client.query(
        'SELECT * FROM hotels WHERE id = $1',
        [hotelId]
      )

      if (hotelResult.rows.length === 0) {
        throw new Error('Hotel not found')
      }

      const hotel = hotelResult.rows[0]

      // Check if hotel already has a MARSHA code
      if (hotel.marsha_code) {
        throw new Error('Hotel already has a MARSHA code assigned. Release it first.')
      }

      // Update MARSHA code
      await client.query(`
        UPDATE marsha_codes 
        SET is_assigned = TRUE, 
            assigned_to_hotel_id = $1, 
            assigned_at = CURRENT_TIMESTAMP,
            assigned_by = $2
        WHERE id = $3
      `, [hotelId, user.id, marshaCodeId])

      // Update hotel
      await client.query(`
        UPDATE hotels 
        SET marsha_code = $1, 
            marsha_code_id = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [marshaCode.code, marshaCodeId, hotelId])

      await client.query('COMMIT')

      // Audit log
      try {
        await logAudit({
          hotel_id: hotelId,
          user_id: user.id,
          user_name: user.name,
          action: 'ASSIGN_MARSHA',
          entity_type: 'marsha_code',
          entity_id: marshaCode.id,
          details: {
            marshaCode: marshaCode.code,
            marshaHotelName: marshaCode.hotel_name,
            assignedToHotel: hotel.name,
            hotelId
          }
        })
      } catch (auditError) {
        console.error('Failed to log audit:', auditError)
      }

      return {
        hotelId,
        marshaCode: marshaCode.code,
        marshaHotelName: marshaCode.hotel_name
      }

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Release MARSHA code from a hotel
   * @param {string} hotelId - Hotel UUID
   * @param {object} user - User performing the action
   * @returns {Promise<object>} Released code info
   */
  static async releaseFromHotel(hotelId, user) {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Get hotel with MARSHA code
      const hotelResult = await client.query(`
        SELECT h.*, mc.code as marsha_code_value, mc.hotel_name as marsha_hotel_name
        FROM hotels h
        LEFT JOIN marsha_codes mc ON h.marsha_code_id = mc.id
        WHERE h.id = $1
      `, [hotelId])

      if (hotelResult.rows.length === 0) {
        throw new Error('Hotel not found')
      }

      const hotel = hotelResult.rows[0]

      if (!hotel.marsha_code_id) {
        throw new Error('Hotel does not have a MARSHA code assigned')
      }

      const releasedCode = hotel.marsha_code_value
      const releasedMarshaId = hotel.marsha_code_id

      // Release MARSHA code
      await client.query(`
        UPDATE marsha_codes 
        SET is_assigned = FALSE, 
            assigned_to_hotel_id = NULL, 
            assigned_at = NULL,
            assigned_by = NULL
        WHERE id = $1
      `, [releasedMarshaId])

      // Update hotel
      await client.query(`
        UPDATE hotels 
        SET marsha_code = NULL, 
            marsha_code_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [hotelId])

      await client.query('COMMIT')

      // Audit log
      try {
        await logAudit({
          hotel_id: hotelId,
          user_id: user.id,
          user_name: user.name,
          action: 'RELEASE_MARSHA',
          entity_type: 'marsha_code',
          entity_id: null,
          details: {
            releasedCode,
            fromHotel: hotel.name,
            hotelId
          }
        })
      } catch (auditError) {
        console.error('Failed to log audit:', auditError)
      }

      return {
        hotelId,
        releasedCode
      }

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Auto-suggest MARSHA code based on hotel name
   * Uses fuzzy matching to find best matches
   * @param {string} hotelName - Name of the hotel
   * @returns {Promise<Array>} Suggested MARSHA codes
   */
  static async suggestForHotelName(hotelName) {
    if (!hotelName || hotelName.length < 3) {
      return []
    }

    // Normalize and extract key words
    const words = hotelName
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['the', 'hotel', 'and', 'spa', 'resort'].includes(w))

    if (words.length === 0) {
      return this.searchByName(hotelName, { limit: 5 })
    }

    // Build query with multiple word matching
    const wordConditions = words.map((_, i) =>
      `LOWER(hotel_name) LIKE '%' || $${i + 1} || '%'`
    ).join(' OR ')

    const result = await pool.query(`
      SELECT 
        id, code, hotel_name, city, country, region, brand,
        is_assigned,
        (
          ${words.map((_, i) =>
      `CASE WHEN LOWER(hotel_name) LIKE '%' || $${i + 1} || '%' THEN 1 ELSE 0 END`
    ).join(' + ')}
        ) as match_score
      FROM marsha_codes
      WHERE 
        is_assigned = FALSE
        AND (${wordConditions})
      ORDER BY match_score DESC, hotel_name ASC
      LIMIT 5
    `, words)

    return result.rows
  }

  /**
   * Get statistics about MARSHA codes
   * @returns {Promise<object>} Statistics
   */
  static async getStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_assigned THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN NOT is_assigned THEN 1 ELSE 0 END) as available
      FROM marsha_codes
    `)

    const byRegion = await pool.query(`
      SELECT region, COUNT(*) as count,
        SUM(CASE WHEN is_assigned THEN 1 ELSE 0 END) as assigned
      FROM marsha_codes
      GROUP BY region
      ORDER BY count DESC
    `)

    const byBrand = await pool.query(`
      SELECT brand, COUNT(*) as count
      FROM marsha_codes
      WHERE is_assigned = FALSE
      GROUP BY brand
      ORDER BY count DESC
      LIMIT 10
    `)

    return {
      total: parseInt(result.rows[0].total),
      assigned: parseInt(result.rows[0].assigned),
      available: parseInt(result.rows[0].available),
      byRegion: byRegion.rows,
      availableByBrand: byBrand.rows
    }
  }

  /**
   * Get all unique countries from MARSHA codes
   * @returns {Promise<Array>} Countries
   */
  static async getCountries() {
    const result = await pool.query(`
      SELECT DISTINCT country 
      FROM marsha_codes 
      ORDER BY country
    `)
    return result.rows.map(r => r.country)
  }

  /**
   * Get all unique regions from MARSHA codes
   * @returns {Promise<Array>} Regions
   */
  static async getRegions() {
    const result = await pool.query(`
      SELECT DISTINCT region 
      FROM marsha_codes 
      ORDER BY region
    `)
    return result.rows.map(r => r.region)
  }

  /**
   * Get all unique brands from MARSHA codes
   * @returns {Promise<Array>} Brands
   */
  static async getBrands() {
    const result = await pool.query(`
      SELECT DISTINCT brand
      FROM marsha_codes
      ORDER BY brand
    `)
    return result.rows.map(r => r.brand)
  }

  /**
   * Get all MARSHA codes with filtering and pagination (SUPER_ADMIN only)
   * @param {object} params - Query parameters
   * @returns {Promise<object>} { codes, total, page, limit, totalPages }
   */
  static async getAll(params = {}) {
    const {
      search,
      country,
      region,
      brand,
      isAssigned,
      page = 1,
      limit = 50
    } = params

    const conditions = []
    const queryParams = []
    let paramIndex = 1

    // Search filter (by code, hotel_name, city)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`
      conditions.push(`(
        LOWER(mc.code) LIKE $${paramIndex}
        OR LOWER(mc.hotel_name) LIKE $${paramIndex}
        OR LOWER(mc.city) LIKE $${paramIndex}
      )`)
      queryParams.push(searchTerm)
      paramIndex++
    }

    // Country filter
    if (country) {
      conditions.push(`mc.country = $${paramIndex}`)
      queryParams.push(country)
      paramIndex++
    }

    // Region filter
    if (region) {
      conditions.push(`mc.region = $${paramIndex}`)
      queryParams.push(region)
      paramIndex++
    }

    // Brand filter
    if (brand) {
      conditions.push(`mc.brand = $${paramIndex}`)
      queryParams.push(brand)
      paramIndex++
    }

    // Assignment status filter
    if (isAssigned !== undefined && isAssigned !== null && isAssigned !== '') {
      const isAssignedValue = isAssigned === true || isAssigned === 'true'
      conditions.push(`mc.is_assigned = $${paramIndex}`)
      queryParams.push(isAssignedValue)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM marsha_codes mc ${whereClause}`
    const countResult = await pool.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0].total, 10)

    // Pagination
    const offset = (page - 1) * limit
    const dataQuery = `
      SELECT
        mc.id, mc.code, mc.hotel_name, mc.city, mc.country, mc.region, mc.brand,
        mc.is_assigned, mc.assigned_to_hotel_id, mc.assigned_at, mc.assigned_by,
        mc.created_at,
        h.name as assigned_hotel_name,
        h.marsha_code as assigned_hotel_marsha,
        u.name as assigned_by_name
      FROM marsha_codes mc
      LEFT JOIN hotels h ON mc.assigned_to_hotel_id = h.id
      LEFT JOIN users u ON mc.assigned_by = u.id
      ${whereClause}
      ORDER BY mc.country, mc.city, mc.hotel_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    queryParams.push(limit, offset)

    const dataResult = await pool.query(dataQuery, queryParams)

    const codes = dataResult.rows.map(row => ({
      id: row.id,
      code: row.code,
      hotelName: row.hotel_name,
      city: row.city,
      country: row.country,
      region: row.region,
      brand: row.brand,
      isAssigned: row.is_assigned,
      assignedAt: row.assigned_at,
      createdAt: row.created_at,
      assignedHotel: row.assigned_to_hotel_id ? {
        id: row.assigned_to_hotel_id,
        name: row.assigned_hotel_name
      } : null,
      assignedBy: row.assigned_by ? {
        id: row.assigned_by,
        name: row.assigned_by_name
      } : null
    }))

    return {
      codes,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / limit)
    }
  }
}

export default MarshaCodeService
