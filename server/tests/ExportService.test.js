/**
 * ExportService Tests
 * Phase 4+6: Tests for unified export functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExportService, ExportFormat, MimeTypes } from '../services/ExportService.js'

describe('ExportService', () => {
  describe('ExportFormat', () => {
    it('should define CSV, XLSX, and JSON formats', () => {
      expect(ExportFormat.CSV).toBe('csv')
      expect(ExportFormat.XLSX).toBe('xlsx')
      expect(ExportFormat.JSON).toBe('json')
    })

    it('should have EXCEL alias for XLSX', () => {
      expect(ExportFormat.EXCEL).toBe('xlsx')
    })
  })

  describe('MimeTypes', () => {
    it('should define correct MIME types for each format', () => {
      expect(MimeTypes.csv).toBe('text/csv; charset=utf-8')
      expect(MimeTypes.xlsx).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(MimeTypes.json).toBe('application/json; charset=utf-8')
    })
  })

  describe('getMimeType', () => {
    it('should return correct MIME type for csv', () => {
      expect(ExportService.getMimeType('csv')).toBe('text/csv; charset=utf-8')
    })

    it('should return correct MIME type for xlsx', () => {
      expect(ExportService.getMimeType('xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })

    it('should return correct MIME type for json', () => {
      expect(ExportService.getMimeType('json')).toBe('application/json; charset=utf-8')
    })

    it('should handle excel alias', () => {
      expect(ExportService.getMimeType('excel')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })

    it('should return octet-stream for unknown format', () => {
      expect(ExportService.getMimeType('unknown')).toBe('application/octet-stream')
    })
  })

  describe('formatValue', () => {
    it('should return empty string for null values', () => {
      expect(ExportService.formatValue(null, 'test')).toBe('')
      expect(ExportService.formatValue(undefined, 'test')).toBe('')
    })

    it('should format dates with _at suffix', () => {
      const date = new Date('2024-03-15T10:30:00Z')
      const formatted = ExportService.formatValue(date.toISOString(), 'created_at')
      expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/)
    })

    it('should format expiry_date as date only', () => {
      const date = new Date('2024-03-15')
      const formatted = ExportService.formatValue(date.toISOString(), 'expiry_date')
      expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/)
    })

    it('should format booleans as Да/Нет', () => {
      expect(ExportService.formatValue(true, 'is_active')).toBe('Да')
      expect(ExportService.formatValue(false, 'is_active')).toBe('Нет')
    })

    it('should format known reason values', () => {
      expect(ExportService.formatValue('expired', 'reason')).toBe('Истёк срок')
      expect(ExportService.formatValue('damaged', 'reason')).toBe('Повреждён')
      expect(ExportService.formatValue('CONSUMPTION', 'reason')).toBe('Расход')
    })

    it('should format known action values', () => {
      expect(ExportService.formatValue('create', 'action')).toBe('Создание')
      expect(ExportService.formatValue('delete', 'action')).toBe('Удаление')
      expect(ExportService.formatValue('fifo_collect', 'action')).toBe('FIFO списание')
    })

    it('should stringify objects', () => {
      const obj = { key: 'value' }
      expect(ExportService.formatValue(obj, 'details')).toBe('{"key":"value"}')
    })

    it('should convert other values to string', () => {
      expect(ExportService.formatValue(123, 'quantity')).toBe('123')
      expect(ExportService.formatValue('test', 'name')).toBe('test')
    })
  })

  describe('toCSV', () => {
    const testData = [
      { name: 'Product A', quantity: 10, is_active: true },
      { name: 'Product B', quantity: 20, is_active: false }
    ]

    it('should generate CSV with headers', () => {
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'quantity', header: 'Quantity' }
      ]
      const csv = ExportService.toCSV(testData, 'products', { columns })
      
      expect(csv).toContain('"Name","Quantity"')
      expect(csv).toContain('"Product A","10"')
      expect(csv).toContain('"Product B","20"')
    })

    it('should generate CSV without headers when specified', () => {
      const columns = [
        { key: 'name', header: 'Name' }
      ]
      const csv = ExportService.toCSV(testData, 'products', { columns, includeHeaders: false })
      
      expect(csv).not.toContain('"Name"')
      expect(csv).toContain('"Product A"')
    })

    it('should use custom delimiter', () => {
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'quantity', header: 'Quantity' }
      ]
      const csv = ExportService.toCSV(testData, 'products', { columns, delimiter: ';' })
      
      expect(csv).toContain('"Name";"Quantity"')
    })

    it('should escape quotes in values', () => {
      const dataWithQuotes = [{ name: 'Product "Test"', quantity: 10 }]
      const columns = [{ key: 'name', header: 'Name' }]
      const csv = ExportService.toCSV(dataWithQuotes, 'products', { columns })
      
      expect(csv).toContain('""Test""')
    })

    it('should return only headers for empty data', () => {
      const columns = [{ key: 'name', header: 'Name' }]
      const csv = ExportService.toCSV([], 'products', { columns })
      
      // Headers are quoted in the CSV output
      expect(csv).toContain('Name')
    })
  })

  describe('toJSON', () => {
    const testData = [
      { name: 'Product A', quantity: 10 },
      { name: 'Product B', quantity: 20 }
    ]

    it('should generate JSON with metadata by default', () => {
      const json = ExportService.toJSON(testData, 'products')
      const parsed = JSON.parse(json)
      
      expect(parsed.entityType).toBe('products')
      expect(parsed.totalRecords).toBe(2)
      expect(parsed.exportedAt).toBeDefined()
      expect(parsed.data).toEqual(testData)
    })

    it('should generate JSON without metadata when specified', () => {
      const json = ExportService.toJSON(testData, 'products', { includeMetadata: false })
      const parsed = JSON.parse(json)
      
      expect(parsed).toEqual(testData)
    })

    it('should handle empty data', () => {
      const json = ExportService.toJSON([], 'products')
      const parsed = JSON.parse(json)
      
      expect(parsed.totalRecords).toBe(0)
      expect(parsed.data).toEqual([])
    })

    it('should generate compact JSON when pretty is false', () => {
      const json = ExportService.toJSON(testData, 'products', { pretty: false })
      expect(json).not.toContain('\n')
    })
  })

  describe('toXLSX', () => {
    const testData = [
      { name: 'Product A', quantity: 10 },
      { name: 'Product B', quantity: 20 }
    ]

    it('should generate XLSX buffer', async () => {
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'quantity', header: 'Quantity' }
      ]
      const buffer = await ExportService.toXLSX(testData, 'products', { columns })
      
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('should handle empty data', async () => {
      const columns = [{ key: 'name', header: 'Name' }]
      const buffer = await ExportService.toXLSX([], 'products', { columns })
      
      expect(buffer).toBeInstanceOf(Buffer)
    })
  })

  describe('toXLSXData (deprecated)', () => {
    const testData = [
      { name: 'Product A', quantity: 10 }
    ]

    it('should return headers, rows, and sheetName', () => {
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'quantity', header: 'Quantity' }
      ]
      const result = ExportService.toXLSXData(testData, 'products', { columns })
      
      expect(result.headers).toEqual(['Name', 'Quantity'])
      expect(result.rows).toEqual([['Product A', '10']])
      expect(result.sheetName).toBe('products')
    })

    it('should use custom sheetName', () => {
      const result = ExportService.toXLSXData(testData, 'products', { 
        columns: [{ key: 'name', header: 'Name' }],
        sheetName: 'Custom Sheet'
      })
      
      expect(result.sheetName).toBe('Custom Sheet')
    })
  })

  describe('getColumnsForEntity', () => {
    it('should return columns for products entity', () => {
      const columns = ExportService.getColumnsForEntity('products')
      expect(columns.length).toBeGreaterThan(0)
      expect(columns.some(c => c.key === 'name')).toBe(true)
    })

    it('should return columns for batches entity', () => {
      const columns = ExportService.getColumnsForEntity('batches')
      expect(columns.some(c => c.key === 'expiry_date')).toBe(true)
    })

    it('should return columns for auditLogs entity', () => {
      const columns = ExportService.getColumnsForEntity('auditLogs')
      expect(columns.some(c => c.key === 'action')).toBe(true)
      expect(columns.some(c => c.key === 'entity_type')).toBe(true)
    })

    it('should return columns for collectionHistory entity (Phase 8)', () => {
      const columns = ExportService.getColumnsForEntity('collectionHistory')
      expect(columns.some(c => c.key === 'product_name')).toBe(true)
      expect(columns.some(c => c.key === 'category_name')).toBe(true)
      expect(columns.some(c => c.key === 'expiry_date')).toBe(true)
      expect(columns.some(c => c.key === 'reason')).toBe(true)
    })

    it('should return empty array for unknown entity', () => {
      const columns = ExportService.getColumnsForEntity('unknown')
      expect(columns).toEqual([])
    })
  })

  describe('buildExportSummary', () => {
    it('should return export summary with all fields', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const summary = ExportService.buildExportSummary(data, 'products')
      
      expect(summary.entityType).toBe('products')
      expect(summary.totalRecords).toBe(2)
      expect(summary.exportedAt).toBeDefined()
      expect(summary.availableFormats).toContain('csv')
      expect(summary.availableFormats).toContain('xlsx')
      expect(summary.availableFormats).toContain('json')
    })

    it('should handle null data', () => {
      const summary = ExportService.buildExportSummary(null, 'products')
      expect(summary.totalRecords).toBe(0)
    })
  })

  describe('sendExport', () => {
    let mockRes

    beforeEach(() => {
      mockRes = {
        setHeader: vi.fn(),
        send: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      }
    })

    it('should send CSV export with correct headers', async () => {
      const data = [{ name: 'Test' }]
      await ExportService.sendExport(mockRes, data, 'products', 'csv')
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8'
      )
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.csv')
      )
      expect(mockRes.send).toHaveBeenCalled()
    })

    it('should send JSON export with correct headers', async () => {
      const data = [{ name: 'Test' }]
      await ExportService.sendExport(mockRes, data, 'products', 'json')
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8'
      )
      expect(mockRes.send).toHaveBeenCalled()
    })

    it('should send XLSX export with correct headers', async () => {
      const data = [{ name: 'Test' }]
      await ExportService.sendExport(mockRes, data, 'products', 'xlsx')
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      expect(mockRes.send).toHaveBeenCalled()
    })

    it('should handle excel format alias', async () => {
      const data = [{ name: 'Test' }]
      await ExportService.sendExport(mockRes, data, 'products', 'excel')
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })

    it('should return error for unsupported format', async () => {
      await ExportService.sendExport(mockRes, [], 'products', 'pdf')
      
      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'UNSUPPORTED_FORMAT'
        })
      )
    })

    it('should use custom filename', async () => {
      const data = [{ name: 'Test' }]
      await ExportService.sendExport(mockRes, data, 'products', 'csv', { 
        filename: 'custom_export' 
      })
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="custom_export.csv"'
      )
    })
  })
})
