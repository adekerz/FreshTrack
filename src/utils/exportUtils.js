/**
 * Export Utilities
 * Утилиты для экспорта отчётов в Excel (CSV) и PDF
 */

/**
 * Экспорт данных в CSV (совместим с Excel)
 * @param {Array} data - Массив объектов для экспорта
 * @param {Array} columns - Конфигурация колонок [{key, title}]
 * @param {string} filename - Имя файла без расширения
 */
export function exportToCSV(data, columns, filename = 'export') {
  // BOM для корректного отображения кириллицы в Excel
  const BOM = '\uFEFF'

  // Заголовки
  const headers = columns.map((col) => `"${col.title}"`).join(';')

  // Строки данных
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        let value = item[col.key]

        // Обработка вложенных ключей (например, 'product.name')
        if (col.key.includes('.')) {
          const keys = col.key.split('.')
          value = keys.reduce((obj, key) => obj?.[key], item)
        }

        // Форматирование значения
        if (value === null || value === undefined) {
          value = ''
        } else if (typeof value === 'number') {
          value = value.toString()
        } else if (value instanceof Date) {
          value = value.toLocaleDateString('ru-RU')
        } else if (typeof value === 'boolean') {
          value = value ? 'Да' : 'Нет'
        } else {
          value = String(value).replace(/"/g, '""') // Экранирование кавычек
        }

        return `"${value}"`
      })
      .join(';')
  })

  const csv = BOM + headers + '\n' + rows.join('\n')

  // Создание и скачивание файла
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

/**
 * Экспорт данных в формате XLSX (простой Excel без библиотек)
 * Создаёт XML-based файл, совместимый с Excel
 */
export function exportToExcel(data, columns, filename = 'export', sheetName = 'Sheet1') {
  const escapeXml = (str) => {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // Создание XML для Excel
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Size="11"/>
      <Interior ss:Color="#F5F0E8" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="date">
      <NumberFormat ss:Format="Short Date"/>
    </Style>
    <Style ss:ID="danger">
      <Font ss:Color="#C4554D"/>
    </Style>
    <Style ss:ID="warning">
      <Font ss:Color="#D4A853"/>
    </Style>
    <Style ss:ID="success">
      <Font ss:Color="#4A7C59"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>`

  // Заголовки
  xml += '\n      <Row>'
  columns.forEach((col) => {
    xml += `\n        <Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(col.title)}</Data></Cell>`
  })
  xml += '\n      </Row>'

  // Данные
  data.forEach((item) => {
    xml += '\n      <Row>'
    columns.forEach((col) => {
      let value = item[col.key]

      // Обработка вложенных ключей
      if (col.key.includes('.')) {
        const keys = col.key.split('.')
        value = keys.reduce((obj, key) => obj?.[key], item)
      }

      let type = 'String'
      let style = ''

      if (typeof value === 'number') {
        type = 'Number'
      } else if (value instanceof Date) {
        type = 'DateTime'
        value = value.toISOString()
        style = ' ss:StyleID="date"'
      } else if (col.status) {
        // Применение стиля на основе статуса
        const status = item[col.statusKey] || item.status
        if (status === 'critical' || status === 'expired') style = ' ss:StyleID="danger"'
        else if (status === 'warning') style = ' ss:StyleID="warning"'
        else if (status === 'good') style = ' ss:StyleID="success"'
      }

      value = value ?? ''

      xml += `\n        <Cell${style}><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>`
    })
    xml += '\n      </Row>'
  })

  xml += `
    </Table>
  </Worksheet>
</Workbook>`

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  downloadBlob(blob, `${filename}.xls`)
}

/**
 * Экспорт в PDF с использованием браузерной печати
 * @param {string} title - Заголовок отчёта
 * @param {Array} data - Данные для отчёта
 * @param {Array} columns - Колонки
 * @param {Object} options - Дополнительные опции
 */
export function exportToPDF(title, data, columns, options = {}) {
  const {
    subtitle = '',
    companyName = 'The Ritz-Carlton',
    printDate = new Date().toLocaleDateString('ru-RU'),
    orientation = 'landscape',
    summary = null
  } = options

  // Создание нового окна для печати
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна для создания PDF')
    return
  }

  // HTML для печати
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 15mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #1A1A1A;
      background: white;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #1A1A1A;
    }
    
    .logo {
      font-size: 14pt;
      font-weight: 600;
      color: #1A1A1A;
    }
    
    .logo-sub {
      font-size: 9pt;
      color: #6B6560;
    }
    
    .report-info {
      text-align: right;
      font-size: 9pt;
      color: #6B6560;
    }
    
    h1 {
      font-size: 16pt;
      font-weight: 500;
      margin-bottom: 5px;
    }
    
    .subtitle {
      font-size: 10pt;
      color: #6B6560;
      margin-bottom: 15px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
      padding: 15px;
      background: #FAF8F5;
      border-radius: 8px;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-value {
      font-size: 18pt;
      font-weight: 600;
    }
    
    .summary-label {
      font-size: 8pt;
      color: #6B6560;
      text-transform: uppercase;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    
    th {
      background: #F5F0E8;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #1A1A1A;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #E5E2DE;
      font-size: 9pt;
    }
    
    tr:nth-child(even) {
      background: #FAFAFA;
    }
    
    .status-good { color: #4A7C59; }
    .status-warning { color: #D4A853; }
    .status-critical, .status-expired { color: #C4554D; }
    
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 500;
    }
    
    .badge-good { background: #E8F5E9; color: #4A7C59; }
    .badge-warning { background: #FFF8E1; color: #D4A853; }
    .badge-critical { background: #FFEBEE; color: #C4554D; }
    .badge-expired { background: #FFEBEE; color: #C4554D; }
    
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 10px 15mm;
      font-size: 8pt;
      color: #6B6560;
      border-top: 1px solid #E5E2DE;
      display: flex;
      justify-content: space-between;
    }
    
    @media print {
      .no-print { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #1A1A1A;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12pt;
    }
    
    .print-button:hover {
      background: #333;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print(); setTimeout(() => window.close(), 100);">
    Печать / Сохранить PDF
  </button>

  <div class="header">
    <div>
      <div class="logo">${companyName}</div>
      <div class="logo-sub">FreshTrack System</div>
    </div>
    <div class="report-info">
      <div>Дата отчёта: ${printDate}</div>
      <div>Всего записей: ${data.length}</div>
    </div>
  </div>
  
  <h1>${title}</h1>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
  
  ${
    summary
      ? `
  <div class="summary">
    ${Object.entries(summary)
      .map(
        ([label, value]) => `
      <div class="summary-item">
        <div class="summary-value">${value}</div>
        <div class="summary-label">${label}</div>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }
  
  <table>
    <thead>
      <tr>
        ${columns.map((col) => `<th>${col.title}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (item) => `
        <tr>
          ${columns
            .map((col) => {
              let value = item[col.key]

              // Обработка вложенных ключей
              if (col.key.includes('.')) {
                const keys = col.key.split('.')
                value = keys.reduce((obj, key) => obj?.[key], item)
              }

              // Форматирование
              if (value instanceof Date) {
                value = value.toLocaleDateString('ru-RU')
              }

              // Применение стилей для статусов
              let className = ''
              if (col.isStatus && value) {
                className = `badge badge-${value}`
                const statusLabels = {
                  good: 'Хорошо',
                  warning: 'Внимание',
                  critical: 'Критично',
                  expired: 'Просрочено'
                }
                value = `<span class="${className}">${statusLabels[value] || value}</span>`
              }

              return `<td>${value ?? ''}</td>`
            })
            .join('')}
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  
  <div class="footer">
    <span>© ${new Date().getFullYear()} ${companyName} - FreshTrack</span>
    <span>Страница 1</span>
  </div>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
}

/**
 * Вспомогательная функция для скачивания Blob
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Форматирование данных для экспорта из массива партий
 */
export function formatBatchesForExport(batches, t) {
  return batches.map((batch) => ({
    ...batch,
    formattedDate: new Date(batch.expiryDate).toLocaleDateString('ru-RU'),
    statusLabel:
      {
        good: t?.('common.good') || 'Хорошо',
        warning: t?.('common.warning') || 'Внимание',
        critical: t?.('common.critical') || 'Критично',
        expired: t?.('common.expired') || 'Просрочено'
      }[batch.status] || batch.status
  }))
}

/**
 * Конфигурации колонок для разных типов отчётов
 */
export const EXPORT_COLUMNS = {
  inventory: (t) => [
    { key: 'productName', title: t?.('export.columns.product') || 'Товар' },
    { key: 'category', title: t?.('export.columns.category') || 'Категория' },
    { key: 'department', title: t?.('export.columns.department') || 'Отдел' },
    { key: 'quantity', title: t?.('export.columns.quantity') || 'Количество' },
    { key: 'unit', title: t?.('export.columns.unit') || 'Единица' },
    { key: 'formattedDate', title: t?.('export.columns.expiryDate') || 'Срок годности' },
    { key: 'daysLeft', title: t?.('export.columns.daysLeft') || 'Дней осталось' },
    {
      key: 'statusLabel',
      title: t?.('export.columns.status') || 'Статус',
      isStatus: true,
      statusKey: 'status'
    }
  ],

  notifications: (t) => [
    { key: 'timestamp', title: t?.('export.columns.date') || 'Дата' },
    { key: 'type', title: t?.('export.columns.type') || 'Тип' },
    { key: 'message', title: t?.('export.columns.message') || 'Сообщение' },
    { key: 'status', title: t?.('export.columns.status') || 'Статус' }
  ],

  collections: (t) => [
    { key: 'timestamp', title: t?.('export.columns.date') || 'Дата' },
    { key: 'productName', title: t?.('export.columns.product') || 'Товар' },
    { key: 'department', title: t?.('export.columns.department') || 'Отдел' },
    { key: 'quantity', title: t?.('export.columns.quantity') || 'Количество' },
    { key: 'reason', title: t?.('export.columns.reason') || 'Причина' },
    { key: 'collectedBy', title: t?.('export.columns.collectedBy') || 'Собрал' }
  ]
}

export default {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  formatBatchesForExport,
  EXPORT_COLUMNS
}
