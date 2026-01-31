/**
 * Audit Export Service — PDF и Excel с читаемым форматом
 * Журнал действий: критичность, человекочитаемые описания
 * PDF: шрифт DejaVu Sans для корректной кириллицы
 */

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Путь к TTF с поддержкой кириллицы (DejaVu Sans) */
function getPdfFontPath() {
  const fromService = path.join(__dirname, '..', 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans.ttf')
  const fromRoot = path.join(__dirname, '..', '..', 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans.ttf')
  if (fs.existsSync(fromService)) return fromService
  if (fs.existsSync(fromRoot)) return fromRoot
  return null
}

/** Безопасная строка для PDF (кириллица и латиница) */
function safePdfText(v) {
  if (v == null || typeof v !== 'string') return '—'
  return String(v)
}

/** Строка подзаголовка: отель и код отеля */
function formatHotelSubtitle(info) {
  const name = (typeof info === 'string' ? info : info?.hotelName)?.trim()
  const code = (typeof info === 'object' && info?.hotelCode) ? String(info.hotelCode).trim() : ''
  const parts = []
  if (name) parts.push(`Отель: ${name}`)
  if (code) parts.push(`Код: ${code}`)
  return parts.length ? parts.join(', ') : 'Отель'
}

/** Форматирование даты для экспорта в часовом поясе отеля */
function formatDate(value, withTime = true, timeZone = 'UTC') {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const opts = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: timeZone || 'UTC'
  }
  if (withTime) {
    opts.hour = '2-digit'
    opts.minute = '2-digit'
    return d.toLocaleString('ru-RU', opts)
  }
  return d.toLocaleDateString('ru-RU', opts)
}

export class AuditExportService {
  /**
   * PDF Export с читаемым форматом
   * @param {Object[]} logs — обогащённые записи
   * @param {{ hotelName?: string, hotelCode?: string, hotelTimezone?: string } | string} hotelInfo — отель (название, код, часовой пояс)
   * @returns {Promise<Buffer>}
   */
  static async generatePDF(logs, hotelInfo) {
    const timeZone =
      typeof hotelInfo === 'object' && hotelInfo?.hotelTimezone
        ? hotelInfo.hotelTimezone
        : 'UTC'

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 })
      const chunks = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const fontPath = getPdfFontPath()
      if (fontPath) {
        try {
          doc.registerFont('DejaVuSans', fontPath)
          doc.font('DejaVuSans')
        } catch {
          // шрифт не загрузился — PDF будет с латиницей по умолчанию
        }
      }

      doc.fontSize(20).text('Журнал действий', { align: 'center' })
      doc.fontSize(12).text(formatHotelSubtitle(hotelInfo), { align: 'center' })
      doc.moveDown()

      doc.fontSize(10)
      doc.fillColor('red').text('Критично', { continued: true })
      doc.fillColor('orange').text('  Важно', { continued: true })
      doc.fillColor('green').text('  Обычно')
      doc.moveDown()

      const pageWidth = 550
      const leftMargin = 50

      logs.forEach((log, index) => {
        if (index > 0) {
          doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke()
          doc.moveDown(0.5)
        }

        const severityIcon =
          log.severity === 'critical' ? 'Критично' : log.severity === 'important' ? 'Важно' : 'Обычно'

        doc
          .fillColor('black')
          .fontSize(11)
          .text(`${severityIcon} — ${safePdfText(log.human_readable_description || log.action)}`, {
            bold: true
          })

        doc
          .fontSize(9)
          .fillColor('gray')
          .text(`${formatDate(log.created_at, true, timeZone)} • ${safePdfText(log.user_name)}`)

        const details = safePdfText(log.human_readable_details)
        if (details !== '—') {
          doc.fillColor('black').fontSize(9).text(details, { indent: 20 })
        }

        doc.moveDown(0.5)
      })

      doc
        .fontSize(8)
        .fillColor('gray')
        .text(`Сгенерировано ${formatDate(new Date(), true, timeZone)}`, { align: 'center' })

      doc.end()
    })
  }

  /**
   * Excel Export с цветовой маркировкой по критичности
   * @param {Object[]} logs
   * @param {{ hotelName?: string, hotelCode?: string, hotelTimezone?: string } | string} hotelInfo
   * @returns {Promise<Buffer>}
   */
  static async generateExcel(logs, hotelInfo) {
    const timeZone =
      typeof hotelInfo === 'object' && hotelInfo?.hotelTimezone
        ? hotelInfo.hotelTimezone
        : 'UTC'

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Журнал действий', {
      properties: { tabColor: { argb: 'FF10B981' } }
    })

    const hotelSubtitle = formatHotelSubtitle(hotelInfo)
    worksheet.addRow([hotelSubtitle]).font = { italic: true }
    worksheet.addRow([])

    worksheet.columns = [
      { header: 'Время', key: 'timestamp', width: 20 },
      { header: 'Пользователь', key: 'user', width: 20 },
      { header: 'Отдел', key: 'department', width: 15 },
      { header: 'Действие', key: 'action', width: 30 },
      { header: 'Детали', key: 'details', width: 50 },
      { header: 'Критичность', key: 'severity', width: 15 }
    ]

    const headerRow = worksheet.getRow(3)
    headerRow.values = ['Время', 'Пользователь', 'Отдел', 'Действие', 'Детали', 'Критичность']
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' }
    }

    logs.forEach((log) => {
      const severityLabel =
        log.severity === 'critical'
          ? 'КРИТИЧНО'
          : log.severity === 'important'
            ? 'ВАЖНО'
            : 'ОБЫЧНО'

      const row = worksheet.addRow({
        timestamp: formatDate(log.created_at, true, timeZone),
        user: log.user_name || '—',
        department: log.department_name || '',
        action: log.human_readable_description || log.action || '—',
        details: log.human_readable_details || '',
        severity: severityLabel
      })

      if (log.severity === 'critical') {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFECACA' }
          }
        })
      } else if (log.severity === 'important') {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF3C7' }
          }
        })
      }
    })

    worksheet.autoFilter = {
      from: 'A3',
      to: `F${3 + logs.length}`
    }

    return workbook.xlsx.writeBuffer()
  }
}
